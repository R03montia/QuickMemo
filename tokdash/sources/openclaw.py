from __future__ import annotations

import glob
import json
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

try:
    from ..pricing import PricingDatabase
except ImportError:  # pragma: no cover
    # Allow importing when running this code from the repo by file path.
    from pricing import PricingDatabase


def _cache_hit_rate(tokens_in: Any, tokens_cache: Any) -> Optional[float]:
    """Prompt cache-hit rate = cacheRead / (input_incl_cacheWrite + cacheRead).

    Local copy of compute.cache_hit_rate to avoid a circular import (compute imports
    this module). ``tokens_in`` already folds cacheWrite into billable input here, so
    ``tokens_in + tokens_cache`` is the full prompt input. Returns None when there is
    no prompt input.
    """
    num = int(tokens_cache or 0)
    den = int(tokens_in or 0) + num
    if den <= 0:
        return None
    return round(num / den, 4)


def parse_session_file(filepath: str) -> List[Dict[str, Any]]:
    """Parse a single OpenClaw session JSONL file into a list of entries."""
    entries: List[Dict[str, Any]] = []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except Exception:
        return []
    return entries


def _i(v: Any) -> int:
    try:
        return int(v or 0)
    except Exception:
        return 0


def _parse_message_datetime(ts: Any) -> Optional[datetime]:
    if not ts:
        return None

    try:
        if isinstance(ts, (int, float)):
            # Handle seconds vs milliseconds.
            if ts > 1e11:
                dt = datetime.fromtimestamp(ts / 1000, timezone.utc)
            else:
                dt = datetime.fromtimestamp(ts, timezone.utc)
            return dt
        if isinstance(ts, str):
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None

    return None


def _resolve_usage_datetime(entry: Dict[str, Any], message: Dict[str, Any], filepath: str) -> Optional[datetime]:
    """Prefer OpenClaw's inner message timestamp, matching tokscale semantics."""
    msg_dt = _parse_message_datetime(message.get("timestamp"))
    if msg_dt is not None:
        return msg_dt

    entry_dt = _parse_message_datetime(entry.get("timestamp"))
    if entry_dt is not None:
        return entry_dt

    try:
        return datetime.fromtimestamp(os.path.getmtime(filepath), timezone.utc)
    except Exception:
        return None


def _usage_cost_from_payload(usage: dict) -> float:
    cost_data = usage.get("cost", 0.0) or usage.get("totalCost", 0.0) or 0.0
    if isinstance(cost_data, dict):
        cost = cost_data.get("total", 0.0) or cost_data.get("value", 0.0) or 0.0
        return float(cost or 0.0)
    if isinstance(cost_data, (int, float)):
        return float(cost_data)
    return 0.0


# ---------------------------------------------------------------------------
# File-signature-cached entry parsing
# ---------------------------------------------------------------------------
# OpenClaw usage is parsed once per file-signature and filtered by date in
# memory, mirroring coding_tools.BaseParser. Without this, every /api/usage and
# /api/stats request re-read ~1 GB of session logs with no cache (the dominant
# cold-start cost).
_ENTRY_CACHE: Dict[tuple, List[Dict[str, Any]]] = {}
_ENTRY_CACHE_MAX = 8


def _is_session_transcript(path: str) -> bool:
    """True for countable OpenClaw transcripts; False for sidecars and snapshot copies.

    The ``*.jsonl*`` glob over-matches. Excludes:
      - ``*.trajectory.jsonl`` / ``*.acp-stream.jsonl`` — sidecar logs with no usage rows
      - ``*.checkpoint.*.jsonl`` / ``*.jsonl.bak-*`` — byte-identical snapshot/backup COPIES
        of the live ``<session>.jsonl``; counting them double-counts every message
      - ``*.lock``
    Keeps the live ``<session>.jsonl`` plus the disjoint ``*.jsonl.reset.*`` /
    ``*.jsonl.deleted.*`` archives (renamed, never coexisting with their live file).
    """
    base = os.path.basename(path)
    if base.endswith(".lock"):
        return False
    if base.endswith(".trajectory.jsonl") or base.endswith(".acp-stream.jsonl"):
        return False
    if ".checkpoint." in base or ".jsonl.bak" in base:
        return False
    return True


def _session_files(session_dirs: list[str]) -> list[str]:
    files: list[str] = []
    for d in session_dirs:
        for f in glob.glob(os.path.join(d, "*.jsonl*")):
            if _is_session_transcript(f):
                files.append(f)
    files.sort()  # deterministic dedup order
    return files


def _signature(files: list[str]) -> tuple:
    items: List[tuple] = []
    for f in files:
        try:
            s = os.stat(f)
            items.append((f, s.st_mtime_ns, s.st_size))
        except OSError:
            continue
    return tuple(items)  # already path-sorted


def _parse_entries(files: list[str]) -> List[Dict[str, Any]]:
    """Parse countable assistant-usage messages, deduped by top-level ``id``.

    OpenClaw writes a unique top-level ``id`` per message; deduping by it makes the
    parse idempotent against any residual snapshot overlap (snapshot files are already
    excluded by ``_is_session_transcript``) and mirrors ``ClaudeParser``. Rows carry raw
    token fields only — cost is computed at aggregation time so a pricing-DB edit takes
    effect without re-parsing.
    """
    out: List[Dict[str, Any]] = []
    seen_ids: set = set()
    for filepath in files:
        for entry in parse_session_file(filepath):
            if entry.get("type") != "message":
                continue
            message = entry.get("message", {})
            if message.get("role") != "assistant":
                continue
            usage = message.get("usage", {})
            if not usage:
                continue

            entry_id = entry.get("id")
            if entry_id:
                if entry_id in seen_ids:
                    continue
                seen_ids.add(entry_id)

            msg_dt = _resolve_usage_datetime(entry, message, filepath)
            if not msg_dt:
                continue
            if msg_dt.tzinfo is None:
                msg_dt = msg_dt.replace(tzinfo=timezone.utc)

            provider = message.get("provider") or "unknown"
            model_id = message.get("model", "unknown")

            input_raw = _i(usage.get("input", 0) or usage.get("inputTokens", 0) or 0)
            cache_write = _i(usage.get("cacheWrite", 0) or usage.get("cacheWriteTokens", 0) or 0)
            output = _i(usage.get("output", 0) or usage.get("outputTokens", 0) or 0)
            cache_read = _i(usage.get("cacheRead", 0) or usage.get("cacheReadTokens", 0) or 0)
            if input_raw + cache_write + output + cache_read <= 0:
                continue

            model = f"{provider}/{model_id}" if provider not in (None, "", "unknown") else str(model_id)

            out.append(
                {
                    "msg_dt": msg_dt,
                    "model": model,
                    "input_raw": input_raw,
                    "cache_write": cache_write,
                    "output": output,
                    "cache_read": cache_read,
                    "payload_cost": _usage_cost_from_payload(usage),
                }
            )
    return out


def _collect_entries(session_dirs: list[str]) -> List[Dict[str, Any]]:
    """Return parsed+deduped entries for *session_dirs*, cached by file signature."""
    files = _session_files(session_dirs)
    sig = _signature(files)
    cached = _ENTRY_CACHE.get(sig)
    if cached is not None:
        return cached
    entries = _parse_entries(files)
    if len(_ENTRY_CACHE) >= _ENTRY_CACHE_MAX:
        _ENTRY_CACHE.clear()
    _ENTRY_CACHE[sig] = entries
    return entries


def get_session_usage(
    sessions_dir: str | list[str],
    since_date: Optional[datetime] = None,
    until_date: Optional[datetime] = None,
    pricing_db: Optional[PricingDatabase] = None,
) -> Dict[str, Any]:
    """Aggregate OpenClaw session usage from local JSONL logs."""
    pricing_db = pricing_db or PricingDatabase()

    model_stats = defaultdict(
        lambda: {
            "tokens_in": 0,
            "tokens_out": 0,
            "tokens_cache": 0,
            "cost": 0.0,
            "messages": 0,
        }
    )

    # {date: {tokens_in,out,cacheRead,total,cost,messages, sources:{model:{...}}}}
    daily_contribs = defaultdict(
        lambda: {
            "tokens_in": 0,
            "tokens_out": 0,
            "tokens_cacheRead": 0,
            "tokens_total": 0,
            "cost": 0.0,
            "messages": 0,
            "sources": defaultdict(
                lambda: {
                    "tokens_in": 0,
                    "tokens_out": 0,
                    "tokens_cacheRead": 0,
                    "tokens_total": 0,
                    "cost": 0.0,
                    "messages": 0,
                }
            ),
        }
    )

    total_messages = 0

    session_dirs = sessions_dir if isinstance(sessions_dir, list) else [sessions_dir]
    entries = _collect_entries(session_dirs)

    for e in entries:
        msg_dt = e["msg_dt"]
        if since_date and msg_dt < since_date:
            continue
        if until_date and msg_dt > until_date:
            continue

        model = e["model"]
        tokens_input_raw = e["input_raw"]
        tokens_cache_write = e["cache_write"]
        tokens_in = tokens_input_raw + tokens_cache_write

        tokens_out = e["output"]
        tokens_cache_read = e["cache_read"]
        tokens_cache = tokens_cache_read
        tokens_total = tokens_in + tokens_out + tokens_cache
        # Prefer recomputed cost from local pricing DB (fall back to provider payload).
        cost_db = pricing_db.get_cost(model, tokens_input_raw, tokens_out, tokens_cache_read, tokens_cache_write)
        cost = cost_db if cost_db > 0.0 else e["payload_cost"]
        msg_date = msg_dt.astimezone().strftime("%Y-%m-%d")

        total_messages += 1

        stats = model_stats[model]
        stats["tokens_in"] += tokens_in
        stats["tokens_out"] += tokens_out
        stats["tokens_cache"] += tokens_cache
        stats["cost"] += cost
        stats["messages"] += 1

        day = daily_contribs[msg_date]
        day["tokens_in"] += tokens_in
        day["tokens_out"] += tokens_out
        day["tokens_cacheRead"] += tokens_cache
        day["tokens_total"] += tokens_total
        day["cost"] += cost
        day["messages"] += 1

        day_source = day["sources"][model]
        day_source["tokens_in"] += tokens_in
        day_source["tokens_out"] += tokens_out
        day_source["tokens_cacheRead"] += tokens_cache
        day_source["tokens_total"] += tokens_total
        day_source["cost"] += cost
        day_source["messages"] += 1

    models: Dict[str, Any] = {}
    total_tokens = 0
    total_cost = 0.0
    total_tokens_in = 0
    total_tokens_cache = 0

    for model, stats in model_stats.items():
        model_total_tokens = int(stats["tokens_in"]) + int(stats["tokens_out"]) + int(stats["tokens_cache"])
        total_tokens += model_total_tokens
        total_cost += float(stats["cost"] or 0.0)
        total_tokens_in += int(stats["tokens_in"])
        total_tokens_cache += int(stats["tokens_cache"])

        models[model] = {
            "tokens": model_total_tokens,
            "tokens_in": int(stats["tokens_in"]),
            "tokens_out": int(stats["tokens_out"]),
            "tokens_cache": int(stats["tokens_cache"]),
            "cost": float(stats["cost"] or 0.0),
            "messages": int(stats["messages"]),
            "cache_hit_rate": _cache_hit_rate(stats["tokens_in"], stats["tokens_cache"]),
        }

    contributions: list[dict] = []
    for date in sorted(daily_contribs.keys()):
        day = daily_contribs[date]
        sources = []
        for model, src in day["sources"].items():
            sources.append(
                {
                    "source": "openclaw",
                    "modelId": model,
                    "providerId": model.split("/")[0] if "/" in model else "unknown",
                    "tokens": {
                        "input": int(src["tokens_in"]),
                        "output": int(src["tokens_out"]),
                        "cacheRead": int(src["tokens_cacheRead"]),
                        "cacheWrite": 0,
                        "reasoning": 0,
                    },
                    "cost": float(src["cost"] or 0.0),
                    "messages": int(src["messages"]),
                }
            )

        contributions.append(
            {
                "date": date,
                "totals": {
                    "tokens": int(day["tokens_total"]),
                    "cost": round(float(day["cost"] or 0.0), 6),
                    "messages": int(day["messages"]),
                },
                "intensity": 0,
                "tokenBreakdown": {
                    "input": int(day["tokens_in"]),
                    "output": int(day["tokens_out"]),
                    "cacheRead": int(day["tokens_cacheRead"]),
                    "cacheWrite": 0,
                    "reasoning": 0,
                },
                "sources": sources,
            }
        )

    return {
        "total_tokens": int(total_tokens),
        "total_cost": float(total_cost),
        "total_messages": int(total_messages),
        "total_tokens_in": int(total_tokens_in),
        "total_tokens_cache": int(total_tokens_cache),
        "cache_hit_rate": _cache_hit_rate(total_tokens_in, total_tokens_cache),
        "models": models,
        "contributions": contributions,
    }


def get_usage_for_days(days: int) -> Dict[str, Any]:
    """Get usage for the last N *calendar* days (local midnight → now)."""
    sessions_dir = glob.glob(os.path.expanduser("~/.openclaw/agents/*/sessions"))

    now_local = datetime.now().astimezone()
    today_local_midnight = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    start_local = today_local_midnight - timedelta(days=max(days, 1) - 1)

    since = start_local.astimezone(timezone.utc)
    until = datetime.now(timezone.utc)

    return get_session_usage(sessions_dir, since_date=since, until_date=until)


def get_usage_for_month() -> Dict[str, Any]:
    """Get usage for current month (local time)."""
    sessions_dir = glob.glob(os.path.expanduser("~/.openclaw/agents/*/sessions"))

    now_local = datetime.now().astimezone()
    start_of_month_local = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    since = start_of_month_local.astimezone(timezone.utc)
    until = datetime.now(timezone.utc)

    return get_session_usage(sessions_dir, since_date=since, until_date=until)


def get_usage_for_range(since_date: datetime, until_date: datetime) -> Dict[str, Any]:
    """Get usage for an explicit datetime range."""
    sessions_dir = glob.glob(os.path.expanduser("~/.openclaw/agents/*/sessions"))
    return get_session_usage(sessions_dir, since_date=since_date, until_date=until_date)


def get_usage_for_year(year: int) -> Dict[str, Any]:
    """Get usage for a calendar year (local time)."""
    sessions_dir = glob.glob(os.path.expanduser("~/.openclaw/agents/*/sessions"))

    local_tz = datetime.now().astimezone().tzinfo or timezone.utc
    start_of_year = datetime(year, 1, 1, tzinfo=local_tz).astimezone(timezone.utc)
    end_of_year = (datetime(year + 1, 1, 1, tzinfo=local_tz).astimezone(timezone.utc) - timedelta(microseconds=1))

    return get_session_usage(sessions_dir, since_date=start_of_year, until_date=end_of_year)
