# QuickMemo

Win11 风格快捷备忘录 — 轻量、美观、本地优先的桌面便签应用。

![screenshot](assets/quickmemo.png)

## 特性

- **Obsidian 风格编辑器** — 分栏 Markdown 编辑 + 实时预览，支持仅编辑/分栏/仅预览三种模式
- **Win11 毛玻璃质感** — 透明窗口 + 模糊背景，跟随系统强调色自动适配
- **深浅主题** — 支持跟随系统、浅色、深色三种模式，CSS 变量驱动
- **灵活窗口** — 有边框/无边框自由切换，CSS `clip-path` 圆角裁剪
- **实时调节** — 内置不透明度滑块（5%~100%），随时调整面板透度
- **笔记管理** — 新建、编辑、重命名、拖拽排序、多选批量操作
- **提醒系统** — 自定义日历 + 时间滚轮选择器，到点系统通知
- **全局快捷键** — 自定义快捷键呼出/隐藏窗口，支持任意组合键
- **Note.ms 云同步** — 通过 note.ms 标识符拉取/回传笔记内容
- **文件关联** — 支持打开 `.md` / `.markdown` / `.txt` 文件，拖拽到窗口即可编辑
- **本地存储** — 数据保存在 `data/notes.json`，纯 JSON 格式，方便备份迁移
- **系统托盘** — 最小化到托盘，右键快速切换主题和窗口样式

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/R03montia/QuickMemo.git
cd QuickMemo

# 安装依赖
npm install

# 启动应用
npm start

# 开发模式（带 DevTools）
npm run dev
```

## 编辑器

QuickMemo 使用自研的 **Obsidian 风格分栏 Markdown 编辑器**，基于 `marked` 渲染引擎：

| 模式 | 图标 | 说明 |
|------|------|------|
| 仅编辑 | ✏️ | 全屏 Markdown 源码编辑，等宽字体 |
| 分栏 | ⊞ | 左写右览，编辑区与预览区同步滚动 |
| 仅预览 | 👁 | 全屏预览渲染后的 HTML，适合阅读 |

- **实时预览**：150ms 防抖渲染，编辑区滚动同步到预览区
- **Tab 键**：插入缩进空格而非切换焦点
- **Markdown 开关**：每篇笔记可独立切换纯文本/Markdown 模式
- **无工具栏**：极简界面，专注写作

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
系统托盘右键菜单可快速切换主题和窗口样式。左下角 ⚙ 齿轮打开设置面板。

### 设置面板
- **主题**：跟随系统 / 浅色 / 深色
- **窗口样式**：有边框（传统标题栏）/ 无边框（浮动控件）
- **不透明度**：滑块实时调节面板透出桌面的程度
- **编辑器**：全局 Markdown 开关、Note.ms 笔记 Markdown 开关
- **快捷键**：点击输入框后按下组合键，保存即可

### 窗口样式
- **有边框**：显示传统标题栏（36px）+ 窗口控制按钮
- **无边框**：隐藏标题栏，浮动窗口控件在右上角，拖拽区域在编辑器顶部

### 文件关联
- 右键 `.md` / `.txt` 文件 → 打开方式 → QuickMemo
- 或将文件直接拖入 QuickMemo 窗口
- 编辑后 `Ctrl+S` 自动写回原文件

### Note.ms 云同步
- **拉取**：右键「新建笔记」→「获取 Notems 内容」→ 输入标识符 → 自动创建笔记（✏️ 图标标识）
- **回传**：Note.ms 笔记按 `Ctrl+S` 时自动上传到对应页面
- **刷新**：编辑器内 🔄 按钮重新拉取覆盖当前编辑（有确认弹窗）

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 33 |
| 渲染引擎 | 原生 HTML/CSS/JS（零前端框架） |
| 进程通信 | contextBridge + ipcRenderer |
| Markdown | marked v18 |
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
│   ├── markdown-editor.js     # Obsidian 风格分栏编辑器模块
│   └── styles.css             # Win11 毛玻璃样式 + Markdown 预览样式
├── assets/
│   ├── marked.umd.js          # marked Markdown 解析库
│   ├── quickmemo.png/ico      # 应用图标
│   └── tray.png               # 系统托盘图标
├── data/
│   └── notes.json             # 本地数据持久化
├── scripts/
│   └── generate-icons.js      # 图标生成工具
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
      "markdownEnabled": true
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
    "theme": "system",
    "appearance": "bordered",
    "panelAlpha": 82,
    "shortcut": "CommandOrControl+Shift+Q",
    "markdownEnabled": true,
    "notemsMarkdownEnabled": false
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

## 许可

MIT License
