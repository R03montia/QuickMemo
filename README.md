# QuickMemo

Win11 风格快捷备忘录 — 轻量、美观、本地优先的桌面便签应用。

## 特性

- **多主题系统** — 4 套主题（默认 / 夕阳 / 海洋 / 霞光）× 3 种模式（跟随系统 / 浅色 / 深色），CSS 变量驱动
- **Markdown 编辑器** — 源码编辑 + 只读预览，基于 marked v18，支持 GFM 语法（表格 / 任务列表 / 代码高亮）
- **Win11 毛玻璃质感** — 透明窗口 + 液态玻璃效果，圆角裁剪，跟随系统强调色
- **灵活窗口** — 有边框 / 无边框自由切换，无边框模式拖拽条跟随主题色
- **实时调节** — 内置不透明度滑块，随时调整面板透度
- **笔记管理** — 新建、编辑、重命名、拖拽排序、多选批量操作，字数实时统计
- **提醒系统** — 自定义日历 + 时间滚轮选择器，到点系统通知
- **全局快捷键** — 自定义快捷键呼出 / 隐藏窗口，支持任意组合键
- **Note.ms 云同步** — 通过 note.ms 标识符拉取 / 回传笔记内容
- **文件关联** — 打开 `.md` / `.markdown` / `.txt` 文件，拖拽到窗口即可编辑，支持写回
- **Markdown 导出** — Ctrl+S 自动导出 `.md` 到个人文件夹
- **AI 集成** — Named Pipe 接口（`\\.\pipe\QuickMemo_AI`），外部 AI 工具可读写笔记

### AI Named Pipe 接口

QuickMemo 在本地启动一个 Named Pipe 服务（仅 Windows），外部 AI CLI 工具可通过 JSON 行协议读写笔记。

**Pipe 名称**：`\\.\pipe\QuickMemo_AI`

**支持的动作**：

| 动作 | 参数 | 说明 |
|------|------|------|
| `list_notes` | 无 | 列出所有笔记（id / 标题 / 时间） |
| `get_note` | `noteId` | 获取单篇笔记完整内容 |
| `create_note` | `noteBody`, `noteTitle`（可选） | 创建新笔记 |
| `update_note` | `noteId`, `noteBody`, `noteTitle`（可选） | 更新已有笔记 |
| `delete_notes` | `noteIds`（数组） | 批量删除笔记 |
| `search_notes` | `query` | 按标题/正文搜索（最多返回 20 条） |

**调用示例**（PowerShell）：

```powershell
# 列出所有笔记
$pipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "QuickMemo_AI", [System.IO.Pipes.PipeDirection]::InOut)
$pipe.Connect(1000)
$writer = New-Object System.IO.StreamWriter($pipe)
$reader = New-Object System.IO.StreamReader($pipe)
$writer.WriteLine('{"action":"list_notes"}')
$writer.Flush()
$reader.ReadLine()
$pipe.Close()
```

> 此功能当前仅在 Windows 上可用（Named Pipe 是 Windows 特有机制）。

- **使用统计** — 内建 Tokdash 统计面板，Token 消耗 / 花费 / 模型排行热力图一目了然
- **本地存储** — 数据保存在 `data/notes.json`，纯 JSON 格式，方便备份迁移
- **系统托盘** — 最小化到托盘，右键快速切换主题、模式和窗口样式

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/R03montia/QuickMemo.git
cd QuickMemo

# 安装依赖
npm install
```

> `npm install` 会自动尝试安装 Tokdash 统计功能所需的 Python 依赖（`fastapi`、`uvicorn`）。
> 如果自动安装失败（无 Python 环境），可手动执行：`pip install -r tokdash/requirements.txt`

```bash
# 启动应用
npm start

# 开发模式（带 DevTools）
npm run dev
```

## 环境要求

| 依赖 | 版本 | 必需 | 说明 |
|------|------|------|------|
| Node.js | >= 18 | 是 | Electron 33 运行环境 |
| npm | >= 9 | 是 | 随 Node.js 一同安装 |
| Python | >= 3.8 | 否 | 仅 Tokdash 使用统计功能需要 |
| pip | 随 Python | 否 | 安装 Tokdash 的 Python 依赖 |

> **没有 Python 也能正常使用**：笔记管理、Markdown 编辑、提醒、主题、快捷键等核心功能完全不依赖 Python。缺少 Python 只是「使用统计」面板无法启动后端服务。

### 安装 Python 依赖（可选）

```bash
# 自动安装（npm install 时触发）
npm install

# 手动安装（自动安装失败时）
pip install -r tokdash/requirements.txt
```

> Windows 用户：推荐从 [python.org](https://python.org) 下载安装，安装时勾选「Add Python to PATH」。


## 编辑器

基于 `marked` 渲染引擎的双模式 Markdown 编辑器：

| 模式 | 说明 |
|------|------|
| 源码 | 全屏 Markdown 源码编辑，等宽字体，Tab 缩进 |
| 预览 | 只读渲染视图，支持 GFM 表格 / 任务列表 / 代码高亮 |

- **Markdown 开关**：设置面板全局开关 + 每篇笔记独立覆盖，关闭后为纯文本框
- **字数统计**：底部实时显示有效字符数（去空白）
- **极简界面**：无工具栏，专注写作

## 快捷键

| 快捷键 | 作用 |
|--------|------|
| `Ctrl+Shift+Q`（默认） | 全局呼出 / 隐藏窗口（可在设置中自定义） |
| `Ctrl+S` | 保存当前笔记 + 自动导出 `.md` 文件 |
| `Ctrl+N` | 新建笔记 |
| `Ctrl+W` | 关闭窗口（最小化到托盘） |
| 右键笔记 | 弹出上下文菜单（重命名 / 删除 / 多选） |
| 双击笔记标题 | 内联重命名 |
| 拖拽手柄 | 拖动排序笔记 |



## 使用指南

### 笔记操作
- **新建笔记**：点击侧栏「新建笔记」按钮
- **编辑**：点击笔记列表中的笔记，右侧编辑区域会同步显示
- **重命名**：右键笔记 → 重命名，或双击侧栏标题内联编辑
- **删除**：点击编辑器底部删除按钮，或侧栏右键菜单删除（有确认弹窗）
- **拖拽排序**：按住笔记左侧拖拽手柄上下拖动

### 多选模式
在笔记上右键 → 选择「多选」→ 勾选多个笔记 → 批量删除或设置提醒

### 提醒
点击编辑器中的「提醒」按钮 → 选择日期（日历）和时间（滚轮）→ 确定。到点系统会弹出通知并在侧栏显示闹钟图标。

### 主题与外观
系统托盘右键菜单可快速切换主题和窗口样式。左下角齿轮按钮打开设置面板。

### 设置面板
- **主题**：默认 / 夕阳 / 海洋 / 霞光 — 每套主题含独立浅色 / 深色模式
- **模式**：跟随系统 / 浅色 / 深色（旗帜主题下为浅色 / 深色切换）
- **窗口样式**：有边框（传统标题栏）/ 无边框（浮动控件）
- **不透明度**：滑块实时调节面板透出桌面的程度
- **编辑器**：全局 Markdown 开关、Note.ms 笔记 Markdown 开关
- **快捷键**：点击输入框后按下组合键，保存即可

### 主题列表

| 主题 | 键名 | 色调 | 说明 |
|------|------|------|------|
| 默认 | `default` | 跟随系统强调色 | 经典 Win11 风格 |
| 夕阳 | `sunset` | 橙金粉调 | 暖色渐变条带 |
| 海洋 | `ocean` | 深浅蓝调 | 冷色渐变条带 |
| 霞光 | `bloom` | 粉雾青空 | 玫粉到青绿渐变 |

### 窗口样式
- **有边框**：显示传统标题栏（36px）+ 窗口控制按钮
- **无边框**：隐藏标题栏，浮动窗口控件在右上角，拖拽区域在编辑器顶部

### 文件关联
- 右键 `.md` / `.txt` 文件 → 打开方式 → QuickMemo
- 或将文件直接拖入 QuickMemo 窗口
- 编辑后 `Ctrl+S` 自动写回原文件

### Note.ms 云同步
- **拉取**：右键「新建笔记」→「获取 Notems 内容」→ 输入标识符 → 自动创建笔记
- **回传**：Note.ms 笔记按 `Ctrl+S` 时自动上传到对应页面
- **刷新**：编辑器内刷新按钮重新拉取覆盖当前编辑（有确认弹窗）

### 使用统计 (Tokdash)
- 点击「统计」选项卡查看 Token 消耗与花费
- 首次使用需点击「启动数据服务」启动 Python 后端
- 支持按日 / 周 / 月 / 年切换统计周期
- 热力图展示全年使用分布，模型消耗排行一目了然

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 33 |
| 渲染引擎 | 原生 HTML / CSS / JS（零前端框架） |
| 进程通信 | contextBridge + ipcRenderer |
| Markdown | marked v18 |
| 使用统计 | Python (FastAPI + Uvicorn)，通过子进程调用 |
| 数据存储 | 本地 JSON 文件 |
| 云同步 | note.ms（HTTP 拉取 + BrowserWindow 注入保存） |

## 项目结构

```
QuickMemo/
├── main.js                    # Electron 主进程入口
├── preload.js                 # contextBridge 桥接层
├── src/
│   ├── index.html             # 主页面 DOM 结构
│   ├── renderer.js            # 渲染进程逻辑（状态管理、笔记 CRUD、设置等）
│   ├── markdown-editor.js     # 分栏编辑器模块
│   └── styles.css             # Win11 毛玻璃样式 + Markdown 预览样式
├── assets/
│   ├── marked.umd.js          # marked Markdown 解析库
│   ├── quickmemo.png / ico    # 应用图标
│   └── tray.png               # 系统托盘图标
├── data/
│   └── notes.json             # 本地数据持久化
├── tokdash/                   # 使用统计后端（Python）
│   ├── api.py                 # FastAPI 统计接口
│   ├── compute.py             # Token 计算引擎
│   └── requirements.txt       # Python 依赖
├── scripts/
│   ├── generate-icons.js      # 图标生成工具
│   └── install-tokdash-deps.js # Python 依赖自动安装
├── package.json
└── README.md
```

## 数据格式

```json
{
  "notes": [
    {
      "id": "1717000000000",
      "title": "笔记标题",
      "body": "Markdown 正文内容",
      "createdAt": "2024-05-29T12:00:00.000Z",
      "updatedAt": "2024-05-29T12:30:00.000Z",
      "notemsKey": "optional-note-ms-identifier",
      "filePath": "C:\\path\\to\\file.md",
      "markdownEnabled": true,
      "_autoTitled": false
    }
  ],
  "reminders": [
    {
      "id": "1717000000001",
      "noteId": "1717000000000",
      "time": "2024-05-29T14:00:00.000Z",
      "done": false
    }
  ],
  "settings": {
    "theme": "default",
    "mode": "system",
    "appearance": "bordered",
    "panelAlpha": 82,
    "shortcut": "CommandOrControl+Shift+Q",
    "markdownEnabled": true,
    "notemsMarkdownEnabled": false,
    "sidebarWidth": 280,
    "customCSS": ""
  }
}
```

## 开发约定

- IPC 通道命名使用 kebab-case（如 `get-accent-color`）
- 数据操作统一通过 `readData()` / `writeData()` 读写 `notes.json`
- 主进程不缓存数据，每次操作直接读写文件
- 渲染进程状态在 `state` 对象中维护，通过 `scheduleSave()` 500ms 防抖持久化
- SVG 图标统一放在 `SVG` 对象中管理
- CSS 变量以 `--` 开头，主题色使用 `--accent` 动态控制
- 所有删除操作均有确认弹窗

## 常见问题

### 应用无法启动

1. 确认 Node.js >= 18 已安装：`node --version`
2. 确认依赖已安装：`npm install`
3. 若报 Electron 相关错误，尝试：`npx electron --version`

### 全局快捷键不生效

- 快捷键可能被其他应用占用，尝试在设置中更换组合键
- 部分安全软件可能拦截全局快捷键注册

### Tokdash 统计面板无数据

1. 确认 Python 已安装：`python --version` 或 `py --version`
2. 确认依赖已安装：`pip install -r tokdash/requirements.txt`
3. 点击统计面板中的「启动数据服务」按钮
4. 若仍无数据，检查是否使用过 Codex / Claude Code / OpenCode（Tokdash 从这些工具的本地 session 文件读取统计）

### 窗口透明度过高看不清

- 点击左下角齿轮 -> 设置面板 -> 拖动不透明度滑块调整
- 深色模式下透明度效果更明显，可切换主题模式改善可读性

### 数据文件在哪

- 所有数据保存在 `data/notes.json`，纯 JSON 格式
- 备份迁移直接复制此文件即可
- 每次保存采用原子写入（先写 `.tmp` 再重命名），崩溃不会损坏数据


## 许可

MIT License