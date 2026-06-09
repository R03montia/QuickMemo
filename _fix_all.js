const fs = require("fs");
let m = fs.readFileSync("main.js", "utf-8");

// 1. Replace entire tokdash section
const tokStart = "// ====== Tokdash Data Server ======";
const trayStart = "// ====== \u6258\u76d8 ======";
const idx1 = m.indexOf(tokStart);
const idx2 = m.indexOf(trayStart);

const newSection = 
"// ====== Tokdash Data Server ======\n" +
"var http = require(\"http\");\n" +
"\n" +
"function killTokdashPort() {\n" +
"  var { execSync } = require(\"child_process\");\n" +
"  try {\n" +
"    var out = execSync(\'netstat -ano | findstr \"127.0.0.1:\' + TOKDASH_PORT + \'\"\', { encoding: \"utf-8\", timeout: 3000 });\n" +
"    out.split(/[\\r\\n]+/).forEach(function(line) {\n" +
"      var parts = line.trim().split(/\\s+/);\n" +
"      var pid = parts[parts.length - 1];\n" +
"      if (pid && /^\\d+$/.test(pid) && parseInt(pid) !== process.pid) {\n" +
"        try { process.kill(parseInt(pid)); } catch (e) {}\n" +
"      }\n" +
"    });\n" +
"  } catch (e) {}\n" +
"}\n" +
"\n" +
"function startTokdash() {\n" +
"  if (tokdashProcess) return;\n" +
"  var tm = path.join(__dirname, \"tokdash-main.py\");\n" +
"  if (!fs.existsSync(tm)) { console.warn(\"[QuickMemo] tokdash-main.py not found\"); return; }\n" +
"  killTokdashPort();\n" +
"  var cmds = process.platform === \"win32\" ? [\"py\", \"python3\", \"python\"] : [\"python3\", \"python\"];\n" +
"  function ts(i) {\n" +
"    if (i >= cmds.length) { console.warn(\"[QuickMemo] No Python found\"); return; }\n" +
"    try {\n" +
"      var p = require(\"child_process\").spawn(cmds[i], [tm, \"--bind\", \"127.0.0.1\", \"--port\", String(TOKDASH_PORT), \"--no-open\", \"--log-level\", \"warning\"], {\n" +
"        cwd: __dirname,\n" +
"        env: Object.assign({}, process.env, { TOKDASH_NO_RETENTION_NOTICE: \"1\", PYTHONUNBUFFERED: \"1\" }),\n" +
"        stdio: \"pipe\",\n" +
"        windowsHide: true\n" +
"      });\n" +
"      p.on(\"close\", function() { tokdashProcess = null; });\n" +
"      p.on(\"error\", function(err) { console.warn(\"[QuickMemo] Spawn error:\", err.message); });\n" +
"      p.stdout.on(\"data\", function(d) { });\n" +
"      p.stderr.on(\"data\", function(d) { });\n" +
"      tokdashProcess = p;\n" +
"      console.log(\"[QuickMemo] Tokdash started with\", cmds[i]);\n" +
"    } catch (e) {\n" +
"      console.warn(\"[QuickMemo] Spawn exception:\", e.message);\n" +
"      if (i < cmds.length - 1) setTimeout(function() { ts(i + 1); }, 1000);\n" +
"    }\n" +
"  }\n" +
"  ts(0);\n" +
"}\n" +
"\n" +
"function stopTokdash() {\n" +
"  if (tokdashProcess) {\n" +
"    try { tokdashProcess.kill(); } catch (e) {}\n" +
"    tokdashProcess = null;\n" +
"  }\n" +
"}\n";

m = m.substring(0, idx1) + newSection + m.substring(idx2);

// 2. Replace start-tokdash-server handler
var h1 = m.indexOf("ipcMain.handle(\"start-tokdash-server\"");
if (h1 === -1) h1 = m.indexOf("ipcMain.handle(\'start-tokdash-server\'");
var h2 = m.indexOf("ipcMain.handle(\"tokdash-fetch\"");
if (h2 === -1) h2 = m.indexOf("ipcMain.handle(\'tokdash-fetch\'");
var oldH = m.substring(h1, h2);

var newH = 
"ipcMain.handle(\"start-tokdash-server\", function() {\n" +
"  startTokdash();\n" +
"  return { ok: true };\n" +
"});\n";

m = m.substring(0, h1) + newH + m.substring(h2);

// 3. Replace tokdash-fetch handler
var f1 = m.indexOf("ipcMain.handle(\"tokdash-fetch\"");
if (f1 === -1) f1 = m.indexOf("ipcMain.handle(\'tokdash-fetch\'");
var f2 = m.indexOf("ipcMain.handle(\"", f1 + 10);
if (f2 === -1) f2 = m.indexOf("ipcMain.handle(\'", f1 + 10);
// If that fails, find the end by looking for "});" followed by newline + ipcMain
// Simpler: just find the next ipcMain line
var restAfter = m.substring(f1 + 5);
var lines = restAfter.split("\n");
var endLine = -1;
for (var i = 0; i < lines.length; i++) {
  if (lines[i].indexOf("ipcMain.handle(") !== -1 && i > 0) {
    endLine = i;
    break;
  }
}
if (endLine > 0) {
  // Reconstruct the full old handler
  var oldFLines = lines.slice(0, endLine);
  var oldF = oldFLines.join("\n");
  var newF = 
"ipcMain.handle(\"tokdash-fetch\", function(_, ep) {\n" +
"  return new Promise(function(resolve) {\n" +
"    var req = http.get(\"http://127.0.0.1:\" + TOKDASH_PORT + ep, function(res) {\n" +
"      var body = \"\";\n" +
"      res.on(\"data\", function(c) { body += c; });\n" +
"      res.on(\"end\", function() {\n" +
"        if (res.statusCode !== 200) { resolve({ ok: false }); return; }\n" +
"        try { resolve({ ok: true, data: JSON.parse(body) }); }\n" +
"        catch(e) { resolve({ ok: false, error: e.message }); }\n" +
"      });\n" +
"    });\n" +
"    req.on(\"error\", function(e) { resolve({ ok: false, error: e.message }); });\n" +
"    req.setTimeout(8000, function() { req.destroy(); resolve({ ok: false, error: \"timeout\" }); });\n" +
"  });\n" +
"});\n";
  m = m.substring(0, f1) + newF + m.substring(f1 + oldF.length);
} else {
  console.log("Could not find end of tokdash-fetch handler");
}

fs.writeFileSync("main.js", m, "utf-8");
console.log("main.js done");
