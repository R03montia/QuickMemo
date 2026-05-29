# QuickMemo — Win11 风格快捷备忘录

## 项目概述
Electron 桌面备忘录应用，Win11 透明窗口 + 毛玻璃效果，支持笔记管理、提醒、主题切换、窗口样式切换、Note.ms 云同步。

## 技术栈
- **Electron** (主进程 + 渲染进程)
- **原生 HTML/CSS/JS**（无前端框架）
- **contextBridge + ipcRenderer** 进程通信
- 数据存储：`data/notes.json`（本地 JSON 文件）
- Note.ms 集成：`net.fetch` + 隐藏 BrowserWindow 操作

## 项目结构
```
QuickMemo/
├── main.js                  # Electron 主进程入口
├── preload.js               # contextBridge 桥接层
├── src/
│   ├── index.html           # 主页面 DOM 结构
│   ├── renderer.js          # 渲染进程逻辑
│   └── styles.css           # 样式 (Win11 毛玻璃)
├── assets/                  # 图标资源
├── data/
│   └── notes.json           # 本地数据持久化
├── CLAUDE.md                # 项目说明文档
└── scripts/
    └── generate-icons.js    # 图标生成工具
```

## 核心架构

### 主进程 (main.js)
- 窗口管理：无框窗口 + `transparent: true` 透明窗口 + `clip-path: inset(0 round 10px)` 圆角
- 系统托盘：主题切换 / 窗口样式切换 / 退出
- IPC handler：数据 CRUD、提醒调度、主题/外观管理、面板透明度
- Note.ms 集成：`net.fetch` GET 拉取内容，隐藏 BrowserWindow 注入 JS 提交保存
- 单实例锁（防重复启动）
- 关闭时隐藏到托盘（非退出）

### 预加载 (preload.js)
暴露 `window.electronAPI` 对象，包含：
- `getAccentColor()` / `getTheme()` / `getThemePreference()`
- `loadData()` / `saveData(data)`
- `setReminder(noteId, time)` / `cancelReminder(id)`
- `minimize()` / `maximize()` / `close()`
- `onThemeChanged(cb)` / `getAppearance()` / `setAppearance(mode)`
- `getPanelAlpha()` / `setPanelAlpha(alpha)` — 面板不透明度
- `getNotemsContent(key)` / `setNotemsContent(key, content)` — Note.ms 读写

### 渲染进程 (renderer.js)
- 状态管理：`state` 对象（笔记列表、提醒、选中、多选）
- 笔记 CRUD：新建、编辑、删除（带确认弹窗）
- 拖拽排序：原生 HTML5 Drag & Drop
- 多选模式：右键菜单进入，批量删除/设置提醒（带确认弹窗）
- 自定义日期时间选择器：日历 + 时间滚轮
- 主题响应：监听 `theme-changed` IPC 事件
- 自动保存：输入变更 500ms 防抖；Ctrl+S 手动保存
- 设置面板：左下角齿轮按钮，含主题/窗口样式/不透明度滑块
- Note.ms 集成：右键「新建笔记」→ 输入标识符拉取内容；Ctrl+S 自动回传
- Note.ms 笔记特征：笔图标、标题锁定只读、🔄 刷新按钮（带确认）

### 数据格式 (notes.json)
```json
{
  "notes": [{ "id", "title", "body", "createdAt", "updatedAt", "notemsKey?" }],
  "reminders": [{ "id", "noteId", "time", "done" }],
  "settings": { "theme": "system|light|dark", "appearance": "bordered|borderless", "panelAlpha": 82 }
}
```

## 特色功能

### Note.ms 云同步
- **拉取**：右键「新建笔记」→「获取 Notems 内容」→ 输入标识符 → 自动创建笔记
- **回传**：带笔图标的笔记手动 Ctrl+S 时自动上传到 note.ms 对应页面
- **刷新**：编辑器内 🔄 按钮重新拉取 note.ms 内容覆盖当前编辑
- **标识**：note.ms 笔记在侧栏显示笔图标（✏️），标题锁定不可修改

### 设置面板
- 左下角 ⚙ 齿轮打开设置
- 左侧导航：主题 / 窗口样式 / 不透明度
- 不透明度滑块可实时调节面板透出桌面的程度（5%~100%）
- 100% = 完全不透明（经典样式）

### 窗口
- 透明窗口（`transparent: true`）+ CSS 圆角裁剪（`clip-path`）
- 有边框/无边框两种模式切换
- 窗口阴影和圆角提供 Win11 风格质感

## 主题系统
- 三种模式：system / light / dark
- 通过 CSS 变量 + `data-theme` 属性切换
- Win11 强调色通过 `systemPreferences.getAccentColor()` 获取
- 窗口样式：bordered（有边框标题栏） / borderless（无边框浮动控件）

## 开发命令
- `npm start` — 启动应用
- `npm run dev` — 启动并打开 DevTools

## 约定规范
- IPC 通道命名使用 kebab-case（如 `get-accent-color`）
- 数据操作统一通过 `readData()` / `writeData()` 读写 `notes.json`
- 主进程不缓存数据，每次读写文件
- 渲染进程状态在 `state` 对象中维护，修改后调用 `scheduleSave()` 自动持久化
- SVG 图标统一放在 `SVG` 对象中管理
- CSS 变量以 `--` 开头，主题色使用 `--accent` 动态控制
- 所有删除操作均有确认弹窗
