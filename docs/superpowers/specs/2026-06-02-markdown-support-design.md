# Markdown 支持 — 设计文档

**日期**: 2026-06-02  
**项目**: QuickMemo  
**状态**: 已确认

## 1. 概述

在 QuickMemo 笔记编辑器中集成所见即所得 Markdown 支持，采用 Typora 风格（编辑即预览），使用 Toast UI Editor 3.x 作为底层编辑器。同时支持全局和单条笔记粒度的 Markdown 开关控制。

## 2. 技术选型

| 包名 | 版本 | 用途 |
|------|------|------|
| `@toast-ui/editor` | `^3.2.2` | WYSIWYG Markdown 编辑器核心 |
| `@toast-ui/editor-plugin-code-syntax-highlight` | `^3.1.0` | 代码块语法高亮 |
| `prismjs` | peer dep | 语法高亮语法定 |

### 2.1 CSS/JS 加载方式

项目无打包工具。安装 npm 包后直接在 HTML 中通过 `<link>` 和 `<script>` 引入：

```html
<!-- Toast UI Editor CSS -->
<link rel="stylesheet" href="../node_modules/@toast-ui/editor/dist/toastui-editor.css">
<link rel="stylesheet" href="../node_modules/@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight.css">

<!-- Toast UI Editor JS (ES module 或 IIFE 版本) -->
<script src="../node_modules/@toast-ui/editor/dist/toastui-editor-all.js"></script>
<script src="../node_modules/@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight-all.js"></script>
```


## 3. 架构设计

### 3.1 组件关系

```
src/
├── index.html          — DOM 结构调整（编辑器容器替换 textarea）
├── renderer.js         — 编辑器生命周期管理 + 开关逻辑
├── styles.css          — Toast UI Editor 主题覆盖 / Win11 适配
└── markdown-editor.js  — 新建：封装 Toast UI 编辑器实例管理
```

### 3.2 数据流

```
笔记 body (string)
  ├── 写入：editor.getMarkdown() → note.body → scheduleSave()
  └── 读取：note.body → editor.setMarkdown()

Markdown 开关优先级（从高到低）：
  note.markdownEnabled  (显式值，右键菜单设置)
    → settings.notemsMarkdownEnabled (仅 Notems 笔记)
      → settings.markdownEnabled (全局默认)
```

### 3.3 编辑器实例管理

单例编辑器，挂载到 `#note-body-container`（新的容器 div）：

- **初始化** `initEditor(container, content, useMarkdown)` — 根据开关创建实例
- **销毁** `destroyEditor()` — 切换笔记/模式前销毁旧实例
- **重建** — 开关变化时：提取内容 → 销毁 → 重新创建 → 回填内容

## 4. 数据模型变更

### 4.1 `notes.json` — notes 数组项新增字段

```json
{
  "id": "...",
  "title": "...",
  "body": "...",
  "notemsKey": "optional",
  "markdownEnabled": true   // NEW: 可选字段，不设则跟随全局默认
}
```

### 4.2 `notes.json` — settings 新增字段

```json
{
  "settings": {
    "theme": "system",
    "appearance": "bordered",
    "panelAlpha": 82,
    "markdownEnabled": true,          // NEW: 普通笔记全局开关，默认 true
    "notemsMarkdownEnabled": false    // NEW: Notems 笔记全局开关，默认 false
  }
}
```

### 4.3 Markdown 开关决策函数

```js
function isMarkdownEnabled(note, settings) {
  if (note.markdownEnabled !== undefined) return note.markdownEnabled;
  if (note.notemsKey) return settings.notemsMarkdownEnabled !== false;
  return settings.markdownEnabled !== false;
}
```

## 5. UI 变更

### 5.1 HTML 结构变更

将 `#note-body` textarea 替换为容器 div：

```html
<!-- 旧 -->
<textarea id="note-body" placeholder="写点什么……"></textarea>

<!-- 新 -->
<div id="note-body-container" placeholder="写点什么……"></div>
<!-- Toast UI Editor 挂载到此 div -->
```

纯文本模式的 textarea 在 JS 中动态创建，与编辑器实例一起管理。

### 5.2 设置面板新增「编辑器」页

在 `#settings-nav` 中新增导航项，在 `#settings-section` 中新增对应页面：

```
编辑器
├── 普通笔记 Markdown  [toggle ON/OFF]  ← 全局默认开关
└── Notems 笔记 Markdown [toggle ON/OFF]  ← 仅对 Notems 笔记生效
```

### 5.3 右键菜单新增 Markdown 开关

动态判断当前笔记渲染状态：

- Markdown 渲染中 → 显示「关闭 Markdown」
- 纯文本模式 → 显示「启用 Markdown」

点击后即时切换当前编辑器模式，并持久化 `note.markdownEnabled` 值。

### 5.4 Toast UI Editor 工具栏

使用 WYSIWYG 模式自带工具栏：加粗、斜体、标题、引用、无序列表、有序列表、任务列表、代码块、表格、链接、图片、分割线。

## 6. 实现细节

### 6.1 `markdown-editor.js` 模块

```js
// 模块职责
- createEditor(container, content, opts) → Editor 实例
- destroyEditor(editor) → void
- switchMode(editor, useMarkdown) → Editor 新实例（保持内容不变）
- getContent(editor) → markdown 字符串
- setContent(editor, content) → void
```

### 6.2 编辑器生命周期

| 事件 | 动作 |
|------|------|
| 选中笔记 | 判断 Markdown 开关 → 创建编辑器实例 |
| 切换笔记 | 提取内容 → 销毁当前实例 → 创建新笔记实例 |
| 右键切换开关 | `getMarkdown()` → `destroy()` → 切换模式 → `create()` → `setMarkdown()` |
| 设置变更 | 同「右键切换开关」 |
| 输入变更 | `editor.on('change')` → 500ms 防抖 → `scheduleSave()` |
| Ctrl+S | `getMarkdown()` → `saveData()`（包含 notems 同步逻辑） |

### 6.3 Win11 主题适配

通过 CSS 变量覆盖 Toast UI Editor 默认样式：

- 背景色使用 `--main-bg`
- 文字色使用 `--text`
- 强调色使用 `--accent`
- 工具栏按钮圆角匹配 Win11 风格
- 浅色/深色模式同步切换

### 6.4 滚动到底按钮兼容

`#btn-scroll-bottom` 随 `#note-body-container`（使用 Toast UI Editor 自带的滚动容器）调整监听目标。

## 7. 向后兼容

- 旧笔记 `body` 字段不变（纯文本即合法 Markdown）
- 旧 `notes.json` 无新字段 → 默认值行为
- 保存时保留所有现有字段

## 8. 边界情况

| 场景 | 处理 |
|------|------|
| 空笔记 | 显示 placeholder，正常编辑 |
| 超大笔记（>100KB） | 编辑正常，关闭语法高亮避免卡顿 |
| 快速切换开关 | 防抖处理，确保旧实例完全销毁 |
| 切换笔记时编辑器未加载完 | 在 `createEditor` resolve 后再设置新内容 |
| Notems 笔记来源内容有 HTML | `getMarkdown()` 返回纯 Markdown，上传时兼容 |
| 设置面板打开时无选中笔记 | 开关仅改变全局默认，不影响编辑器 |
