// Auto-install Python dependencies for Tokdash statistics service.
// Runs as npm postinstall — non-fatal on failure so npm install always succeeds.

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const reqFile = path.join(__dirname, "..", "tokdash", "requirements.txt");
if (!fs.existsSync(reqFile)) {
  console.log("[QuickMemo] tokdash/requirements.txt not found, skipping Python deps.");
  process.exit(0);
}

const winCmds = [["py", "-m", "pip"], ["python", "-m", "pip"]];
const unixCmds = [["python3", "-m", "pip"], ["python", "-m", "pip"]];
const cmdSets = process.platform === "win32" ? winCmds : unixCmds;

for (const [pythonBin, ...pipArgs] of cmdSets) {
  const args = [...pipArgs, "install", "-r", reqFile];
  const label = pythonBin + " " + args.join(" ");
  try {
    execSync(label, { stdio: "inherit", timeout: 120000 });
    console.log("[QuickMemo] Tokdash Python deps installed successfully via " + pythonBin + ".");
    process.exit(0);
  } catch (e) {
    // Try next command
  }
}

console.log("[QuickMemo] Could not auto-install Python dependencies for Tokdash.");
console.log("[QuickMemo] The statistics feature requires Python + fastapi/uvicorn.");
console.log("[QuickMemo] Install manually:  pip install -r tokdash/requirements.txt");
