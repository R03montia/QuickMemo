from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import webbrowser
from pathlib import Path

import uvicorn

from .api import app
from .compute import compute_usage


def _port_type(value: str) -> int:
    try:
        port = int(value)
    except Exception:
        raise argparse.ArgumentTypeError(f"Invalid port {value!r}. Must be an integer in 1..65535.")

    if not (1 <= port <= 65535):
        raise argparse.ArgumentTypeError(f"Invalid port {port}. Valid range is 1..65535.")

    return port


def _default_port() -> int:
    raw = os.environ.get("TOKDASH_PORT", "55423")
    try:
        return _port_type(raw)
    except argparse.ArgumentTypeError as e:
        raise SystemExit(f"Invalid TOKDASH_PORT={raw!r}. {e} Use --port <1-65535>.")


def _positive_int_env(name: str, default: int) -> int:
    """Read a positive integer from the environment, falling back on bad/empty values.

    A misconfigured knob must never crash ``serve``; we just use the default.
    """
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def build_parser(prog: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog=prog, description="Tokdash")
    parser.add_argument(
        "command",
        nargs="?",
        default="serve",
        choices=["serve", "export"],
        help="Command (default: serve)",
    )

    # Serve options
    parser.add_argument(
        "--bind",
        "--host",
        dest="bind",
        default=os.environ.get("TOKDASH_HOST", "127.0.0.1"),
        help="Bind address (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=_port_type,
        default=None,
        help="Port to listen on (default: 55423)",
    )
    parser.add_argument(
        "--log-level",
        default=os.environ.get("TOKDASH_LOG_LEVEL", "info"),
        help="Uvicorn log level (default: info)",
    )
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="Don't automatically open the browser",
    )

    # Export options
    parser.add_argument(
        "--period",
        default="today",
        help='Usage period: "today", "week", "month", or an integer number of days (default: today)',
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON output",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="(compat) export outputs JSON by default",
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Write output to a file instead of stdout",
    )

    return parser


def _has_display() -> bool:
    """Best-effort check for a usable GUI session.

    Returns False in headless contexts (CI, SSH sessions, systemd/launchd
    services, Linux without an X11/Wayland display) so we don't try to launch
    a browser where there is none. ``--no-open`` remains the explicit hard
    override on top of this.
    """
    # CI runners are headless regardless of OS. Most providers (GitHub Actions,
    # GitLab, Travis, CircleCI, ...) set CI=true.
    ci = os.environ.get("CI", "").strip().lower()
    if ci and ci not in {"0", "false", "no"}:
        return False
    # A remote shell with no local console: opening a browser is wrong here
    # even on macOS/Windows.
    if os.environ.get("SSH_CONNECTION") or os.environ.get("SSH_TTY"):
        return False
    # On Linux a GUI needs an X11 or Wayland display. macOS and Windows don't
    # expose these vars but do have a desktop session, so only gate on Linux.
    if sys.platform.startswith("linux"):
        return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))
    return True


def _open_browser(url: str) -> None:
    """Open ``url`` in a browser, swallowing any error.

    Opening a browser is a best-effort convenience; a missing/misconfigured
    browser must never take down the server.
    """
    try:
        webbrowser.open(url)
    except Exception:
        pass


def serve(host: str, port: int, log_level: str, open_browser: bool = True) -> None:
    url_host = "localhost" if host in {"0.0.0.0", "::"} else host
    url = f"http://{url_host}:{port}"
    print(f"🚀 Starting Tokdash on {url}")
    if os.environ.get("TOKDASH_NO_RETENTION_NOTICE", "").strip().lower() not in {"1", "true", "yes"}:
        print(
            "ℹ️  Note: Claude Code & Gemini CLI auto-delete sessions older than ~30 days, "
            "which can silently shrink Tokdash's history.\n"
            "   Keep full history → https://github.com/JingbiaoMei/tokdash#history-retention\n"
            "   Silence this notice with TOKDASH_NO_RETENTION_NOTICE=1"
        )
    # Open the browser only when explicitly enabled (--no-open is a hard
    # override) and a GUI is actually available. Fire it from a short-delay
    # daemon timer so the server has a moment to start listening first.
    if open_browser and _has_display():
        timer = threading.Timer(1.0, _open_browser, args=(url,))
        timer.daemon = True
        timer.start()
    # Backpressure: cap accepted concurrency and keep-alive lifetime so a load burst
    # returns 503 fast instead of queuing forever and wedging the server. The limit
    # sits above the AnyIO worker pool (~40) so cheap cache hits aren't rejected, but
    # is bounded so the connection backlog can't grow without limit.
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level=log_level,
        limit_concurrency=_positive_int_env("TOKDASH_LIMIT_CONCURRENCY", 64),
        timeout_keep_alive=_positive_int_env("TOKDASH_KEEPALIVE", 5),
    )


def export(period: str, pretty: bool, output: str | None) -> None:
    data = compute_usage(period)
    payload = json.dumps(data, indent=2 if pretty else None)

    if output:
        Path(output).write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)


def cli(argv: list[str] | None = None, prog: str = "tokdash") -> int:
    parser = build_parser(prog=prog)
    args = parser.parse_args(argv)

    if args.command == "serve":
        port = args.port if args.port is not None else _default_port()
        serve(args.bind, port, args.log_level, open_browser=not args.no_open)
        return 0

    if args.command == "export":
        export(args.period, args.pretty, args.output)
        return 0

    parser.error(f"Unknown command: {args.command}")
    return 2


def main() -> None:
    raise SystemExit(cli())


if __name__ == "__main__":
    main()
