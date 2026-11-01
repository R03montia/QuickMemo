# QuickMemo — 注意事项（AGENTS.md）

Electron 备忘录应用，结构较复杂、牵一发而动全身。改动前先通读本文件与 `CLAUDE.md`。

## 1. Tokdash 统计服务端口（重要）

- 端口定义在 `main.js` 的 `TOKDASH_PORT`，当前为 **17523**（由 55423 改来，2026-08）。
- **根因**：旧端口 55423 落在 Windows 动态保留端口区间（Hyper-V/WSL 的 "excluded port range"，实测 `55338-55437`）内，导致 uvicorn 绑定失败 `[WinError 10013]` WSAEACCES。保留区间每次开机动态分配，所以服务"时好时坏"。
- 若再次遇到绑定失败：先 `netsh int ipv4 show excludedportrange protocol=tcp` 确认端口是否落在排除区间，再换一个远低于 49152 的端口。
- `startTokdash()` 用 `py -m tokdash.cli --port <port>` 启动；`start-tokdash-server` IPC 会调 `waitForTokdash()` 轮询 `/health` 确认就绪后才返回 `ok`，**不要改回"立即返回 ok"**（否则 UI 竞态：点了启动又显示未启动）。
- `tokdash/cli.py` 内部自带默认端口 55423（仅 `tokdash serve` 独立运行时用）；QuickMemo 启动时总是显式传 `--port`，所以应用不受影响，无需改 `cli.py`。

## 2. AI 生成标题功能已删除

- 旧的"AI 自动生成标题"（generateAITitle、AI 设置面板、aiSettings）已在 commit `8c706b0` 移除；残留死代码（styles.css 的 `#btn-ai-title` 动画、main.js 未使用的 `safeStorage` import）也已清理。
- `main.js` 里仍有一个 **AI CLI Named Pipe**（`\\.\pipe\QuickMemo_AI`，list_notes/get_note/create_note/...），是给外部 AI 工具用的，**不是**被删的"AI 标题"功能，别误删。

## 3. 工作区状态（2026-10-22 更新）

- 旧的 getnote.top 云同步（`getnote-get` / `getnote-put`）与大笔记预览截断
  (`PREVIEW_CHAR_LIMIT = 60000`) 已提交进 main，**不再有"未提交改动"这一说**。
- 目前唯一的未跟踪项：`落雨效果复现包/`（`demo.html` / `rain.css` / `traumarain.svg` /
  `README.md`）。这是独立复现素材，尚未决定是否纳入版本库，**不要当正式代码依赖**，
  也不要随手 `git add .` 把它带进提交。

## 4. 文件编码 BOM 坑

- 多个文件带 UTF-8 BOM：`package.json`、`tokdash/requirements.txt`、`scripts/install-tokdash-deps.js` 等。
- `tokdash/requirements.txt` 第一行实际是 `﻿fastapi`；若 `pip install -r` 报 "Invalid requirement"，先去掉 BOM。

## 5. 环境备注

- 本机 Windows 11；`python` / `py` 可用（3.13），**没有** `python3` 命令（win32 下 `startTokdash` 的 cmds 里 `python3` 用不上）。
- fastapi / uvicorn 已装（fastapi 0.136.3 / uvicorn 0.49.0）。

## 6. 验证方式

- tokdash：`python -m tokdash.cli --bind 127.0.0.1 --port 17523 --no-open` 后 `curl http://127.0.0.1:17523/health` 应返回 `{"status":"ok"}`。
- main.js 改动后：`node -c main.js` 做语法检查。
- 这是 Electron GUI 应用，改动 UI 后实际 `npm start` 跑起来点一遍。

## 7. 桌面快捷方式与图标源（2026-10-17 环境变更）

- 本机 `C:\Users\29981\Desktop` 目录存在 **shell 图标解析故障**：该目录下的 `.lnk` 一律显示系统默认白纸图标；shell 从该目录**读取任何图标资源**（`.ico` / `.exe`）同样失败。与文件本身无关，同一文件移出该目录立刻恢复正常。已知与该目录的 ACL、`desktop.ini`、图标缓存、AnyShare/OneDrive 叠加层均无关，未定位到根因。
- 因此 QuickMemo 的桌面快捷方式已**从用户桌面移到公共桌面** `C:\Users\Public\Desktop\QuickMemo.lnk`（公共桌面图标解析正常，且同样会显示在用户桌面上）。
- 该快捷方式的图标源已从项目内的 `assets\quickmemo.ico` 改为 `C:\Users\29981\Documents\quickmemo.ico`，因为项目位于坏目录内，快捷方式读不到项目里的图标。
- **改图标时要同步两处**：`assets\quickmemo.ico`（应用打包与托盘、窗口图标用）和 `C:\Users\29981\Documents\quickmemo.ico`（仅桌面快捷方式显示用）。只改前者，桌面图标不会更新。
- 在本机新建桌面快捷方式时，**不要放在 `C:\Users\29981\Desktop`**，否则必然白纸；放 `C:\Users\Public\Desktop` 或固定到开始菜单 / 任务栏。
- 其余背景：该故障于 2026-10-17 中午突然出现，当天用户桌面上 18 个快捷方式已全部迁到公共桌面，原文件在回收站。

## 8. 【根因已定位】桌面目录的低完整性标签（2026-10-18）

第 7 节的「图标全变白纸」与「QuickMemo 双击图标完全没反应」是**同一个根因**：

- `C:\Users\29981\Desktop` 目录被打上了 Windows 强制完整性标签
  `Mandatory Label\Low Mandatory Level:(OI)(CI)(NW)`，目录树内所有文件**继承**该标签。
- 后果 1：`electron.exe` 继承低完整性后，Chromium/Electron 启动即崩，退出码
  `-2147483645`（`0x80000003` STATUS_BREAKPOINT）——进程还没走到 `main.js` 就死了，
  所以**没有任何日志**，表现为「双击图标完全没反应」。注意：这与
  `ELECTRON_RUN_AS_NODE=1` 造成的 `app is undefined` 崩溃（main.js:394）是**两回事**，
  不要混为一谈。
- 后果 2：shell 从该目录读取/缓存图标资源失败 → 图标全变白纸。
- 目录上还挂着沙箱 ACE（`Recember\CodexSandboxUsers`、`S-1-4-*` 形式的
  AppContainer SID），指向 AI agent 沙箱（Codex/DSH 一类）——这类工具把某个目录
  当工作区时会向其写入 ACL，低完整性标签是它的副作用。时间（10-17 中午）吻合。

**一刀切开的验证方法**：把 `node_modules\electron\dist` 整个复制到 `C:\qm-test`
再启动 → 正常开窗；复制回 Desktop 目录内 → 必崩。

**修复命令**（普通用户权限即可，**不需要管理员**）：

```cmd
icacls "C:\Users\29981\Desktop" /setintegritylevel (OI)(CI)Medium
```

只改 Desktop 目录本身即可：桌面上的文件都是**继承**标签，会跟着自动恢复成 Medium。
若项目目录内存在显式（非继承）的低完整性文件，再补一条：

```cmd
icacls "C:\Users\29981\Desktop\QuickMemo" /setintegritylevel Medium /T /C
```

**复发判断**：`icacls "C:\Users\29981\Desktop"` 输出里若再次出现
`Low Mandatory Level`，就是同一问题，重跑上面的命令。桌面图标又变白纸 = 同一个信号。
**规避**：不要给会在目录上写 ACL / 完整性标签的沙箱工具，把含 `electron.exe`
的项目目录本身当工作区用。

## 8.1 `git` 报 `.git/index.lock: Permission denied`（2026-10-22 复现并定位）

- **症状**：`git add` / `git commit` 一律失败，报
  `fatal: Unable to create 'C:/.../.git/index.lock': Permission denied`；
  但同一时刻其他文件能正常改（用 `write` / `edit` 工具写 `src/` 下的源码没问题）。
- **根因是两条叠加**：
  1. `C:\Users\29981\Desktop` 上多出一条显式 `Everyone:(CI)(DENY)(DC)`
     （DENY DeleteChild），被 `.git` 等子目录继承 → git 建好 `index.lock` 后
     没法替换/删除它。
  2. agent 沙箱进程本身以 **Low 完整性**运行（`whoami /groups` 里是
     `Mandatory Label\Low Mandatory Level`），而 `QuickMemo`、`.git` 是
     显式 `Medium ... (NW)`（No-Write-Up）→ 低完整性进程写不进去。
- **关键经验：只修 ACL 不够**。ACL 干净之后，若进程仍是 Low 完整性，git 照样
  失败。最终是让 **git 以放宽沙箱的权限（DSH danger-full-access）执行**才成功；
  低完整性下 `git push` 还会报
  `schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS`，同一原因
  （读不到 Windows 凭据库），放宽后一并消失。
- **诊断三步**：
  ```powershell
  icacls "C:\Users\29981\Desktop"                     # 找 DENY(DC) / Low Mandatory Level
  icacls ".git"                                       # 找 .git 的显式 Low 标签
  whoami /groups | Select-String -Pattern Mandatory   # 看当前进程完整性级别
  ```
- **修复**（在低完整性沙箱里需要 UAC 提权；普通 Medium 终端不需要）：
  ```cmd
  icacls "C:\Users\29981\Desktop" /remove:d Everyone
  icacls "C:\Users\29981\Desktop\QuickMemo" /setintegritylevel Medium
  icacls "C:\Users\29981\Desktop\QuickMemo\.git" /setintegritylevel Medium
  ```
  然后以 medium/放宽沙箱的进程跑 git。注意别对项目根加 `/T` 递归——会遍历
  `node_modules`，非常慢；`.git` 的继承标签会在父级改完后自动跟随。
- **复发判断**：`icacls "C:\Users\29981\Desktop"` 又出现 `Everyone:(CI)(DENY)(DC)`
  或 `Low Mandatory Level`，就是同一问题，重跑上面的命令。
- 排查时临时写的 `*.ps1` 提权脚本跑完记得删掉，不要留在工作区（本次已清理）。

## 9 透明无边框窗口的"最大化"必须自管（2026-10-29）

`createWindow()` 是 `transparent: true` + `frame: false`，Windows 上这种窗口
**不会进入真正的 WS_MAXIMIZE 状态**（实测 Electron 33）：

- `win.maximize()` 只是把窗口撑到工作区，视觉上铺满；
- `win.isMaximized()` **恒为 `false`**（`maximize` 事件会触发，但状态读出来仍是 false）；
- `win.unmaximize()` **不会恢复尺寸**，窗口停在铺满状态。

所以**不要**用 `isMaximized()` 判断状态、也不要指望 `unmaximize()` 还原——
这正是"最大化后点最大化按钮无法还原"的根因（`maximize-window` 每次都走进
最大化分支）。

`main.js` 已改为自托管：`maximizeWindow()` / `unmaximizeWindow()` /
`isWindowMaximized()`。最大化前记录 `restoreBounds`，还原时 `unmaximize()`
之后强制 `setBounds(restoreBounds)`；`maximize-changed` 只用于刷新按钮图标。
新增窗口状态相关逻辑时沿用这三个函数，别再直连 `isMaximized()`。

## 10 启动项与静默启动（2026-11-01）

设置面板新增「启动」页（`data-section="startup"`），两个开关：

- **开机自启**：主进程**自管注册表**，写
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 的值 `QuickMemo`，内容为
  逐段加引号的 `"electron.exe" "<项目目录>"`（未打包时必须带 app 目录参数）。
  - **不要**改回 `app.setLoginItemSettings()`：未打包时它把值名固定成
    `electron.app.Electron`（Windows「启动应用」列表里显示 Electron 而非 QuickMemo），
    且命令行不加引号，路径含空格就起不来。非 win32 才回退 Electron API。
  - `setOpenAtLogin()` 的顺序是「先 `archiveLegacyStartupLnk` + `cleanupLegacyElectronRunEntry`，
    再按目标状态写/删」；反过来 cleanup 可能把刚关掉的自启又写回来。
- **迁移**：历史上用户把 `QuickMemo.lnk` 放在启动文件夹
  （`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`）。启动时
  `migrateLegacyStartupLnk()` 会把它改名成 `.lnk.disabled` 并补写注册表项，避免开机起两份。
- **静默启动**：`settings.silentStart`（存 `data/notes.json`）。为 true 时
  `createWindow()` 的 `ready-to-show` 不 `show()`，只驻留托盘；命令行 `--silent` 也可强制。
- **验证**：`reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v QuickMemo`；
  静默看 `data/notes.json` 的 `settings.silentStart`。改完必须**重启应用**才生效
  （preload / main 的 IPC 不热重载）。
- **本机跑 Electron 验证前**：清掉 `ELECTRON_RUN_AS_NODE`（否则以纯 Node 模式跑，
  报 `Cannot find module 'electron'`），且需要 danger-full-access（见第 8 节）。
