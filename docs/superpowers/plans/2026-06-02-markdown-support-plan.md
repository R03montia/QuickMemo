# Markdown 支持 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 集成 Toast UI Editor 3.x 实现 Typora 风格所见即所得 Markdown 编辑，支持全局/单条笔记粒度开关控制。

**Architecture:** Toast UI Editor 通过 CDN 下载的 IIFE 版本（全局 `toastui.Editor`）加载，挂载到 `#note-body-container` div。新增 `markdown-editor.js` 封装编辑器生命周期。原有 `renderer.js` 中扩展开关逻辑、设置面板和右键菜单。

**Tech Stack:** Toast UI Editor 3.2.2 (IIFE), code-syntax-highlight plugin (IIFE), 原生 JS

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `assets/editor/toastui-editor-all.min.js` | 已下载 | Toast UI Editor + ProseMirror 打包 |
| `assets/editor/toastui-editor.min.css` | 已下载 | 编辑器默认样式 |
| `assets/editor/toastui-editor-plugin-code-syntax-highlight-all.min.js` | 已下载 | 代码高亮插件 |
| `assets/editor/toastui-editor-plugin-code-syntax-highlight.min.css` | 已下载 | 代码高亮插件样式 |
| `src/index.html` | 修改 | 替换 textarea → 容器 div，添加 CSS/JS 引用 |
| `src/markdown-editor.js` | 新建 | 编辑器单例封装 |
| `src/renderer.js` | 修改 | 编辑器生命周期、开关逻辑、右键菜单、设置页面 |
| `src/styles.css` | 修改 | Win11 主题覆盖 Toast 样式，纯文本模式 textarea 样式 |
| `main.js` | 不修改 | 无需变更 |
| `preload.js` | 不修改 | 数据读写无变化（body 仍是 string） |
| `assets/editor/` | 添加 | .gitignore 处理或提交（酌情） |

---

### Task 1: 在 index.html 中引入 Toast UI Editor 的 CSS/JS

**Files:**
- Modify: `src/index.html`

- [ ] **Step 1: 添加 Toast UI Editor CSS 引用**

在 `<head>` 的 `<link rel="stylesheet" href="styles.css">` 之后，添加：

```html
<link rel="stylesheet" href="../assets/editor/toastui-editor.min.css">
<link rel="stylesheet" href="../assets/editor/toastui-editor-plugin-code-syntax-highlight.min.css">
```

- [ ] **Step 2: 添加 Toast UI Editor JS 引用**

在 `</body>` 前、`<script src="renderer.js"></script>` 之前，添加：

```html
<script src="../assets/editor/toastui-editor-all.min.js"></script>
<script src="../assets/editor/toastui-editor-plugin-code-syntax-highlight-all.min.js"></script>
```

- [ ] **Step 3: 替换 textarea 为容器 div**

将：
```html
<textarea id="note-body" placeholder="写点什么……"></textarea>
```

替换为：
```html
<div id="note-body-container"></div>
```

- [ ] **Step 4: 验证文件加载**

启动应用并打开 DevTools (`npm run dev`)，在 Console 中确认 `toastui.Editor` 存在：
```
> typeof toastui.Editor
< "function"
```

---

### Task 2: 创建 markdown-editor.js 编辑器封装模块

**Files:**
- Create: `src/markdown-editor.js`

- [ ] **Step 1: 创建模块文件**

```js
// markdown-editor.js — Toast UI Editor 生命周期封装
const MarkdownEditor = (() => {
  let editorInstance = null;
  let mode = 'wysiwyg'; // 'wysiwyg' | 'plain'

  /**
   * 创建纯文本 textarea 编辑器
   */
  function createPlainEditor(container, content) {
    // 清空容器
    container.innerHTML = '';

    const textarea = document.createElement('textarea');
    textarea.id = 'note-body-plain';
    textarea.className = 'plain-textarea';
    textarea.value = content || '';
    textarea.placeholder = '写点什么……';
    textarea.spellcheck = false;
    container.appendChild(textarea);

    // 暴露统一的 content getter/setter
    container._getContent = () => textarea.value;
    container._setContent = (val) => { textarea.value = val; };
    container._onChange = (fn) => { textarea.addEventListener('input', fn); };
    container._scrollTarget = () => textarea;
    container._destroy = () => {
      container.innerHTML = '';
      container._getContent = null;
      container._setContent = null;
      container._onChange = null;
      container._scrollTarget = null;
      container._destroy = null;
    };

    mode = 'plain';
    return container;
  }

  /**
   * 创建 WYSIWYG 编辑器
   */
  function createWysiwygEditor(container, content) {
    // 清空容器
    container.innerHTML = '';

    // Toast UI Editor 会自行创建内部滚动容器
    editorInstance = new toastui.Editor({
      el: container,
      height: '100%',
      initialEditType: 'wysiwyg',
      previewStyle: 'tab',
      initialValue: content || '',
      placeholder: '写点什么……',
      usageStatistics: false,
      toolbarItems: [
        ['heading', 'bold', 'italic', 'strike'],
        ['hr', 'quote'],
        ['ul', 'ol', 'task'],
        ['table', 'link'],
        ['code', 'codeblock'],
        ['scrollSync'],
      ],
      plugins: [
        typeof toastui !== 'undefined' && toastui.Editor
          ? [toastui.Editor.plugin.codeSyntaxHighlight]
          : [],
      ].flat().filter(Boolean),
    });

    // 暴露统一的接口
    container._getContent = () => editorInstance.getMarkdown();
    container._setContent = (val) => editorInstance.setMarkdown(val);
    container._onChange = (fn) => editorInstance.on('change', fn);
    container._scrollTarget = () => {
      // Toast UI Editor 的 WYSIWYG 内容区
      const el = container.querySelector('.ProseMirror');
      return el ? el.parentElement : container.querySelector('.toastui-editor-contents');
    };
    container._destroy = () => {
      if (editorInstance) {
        editorInstance.destroy();
        editorInstance = null;
      }
      container._getContent = null;
      container._setContent = null;
      container._onChange = null;
      container._scrollTarget = null;
      container._destroy = null;
    };

    mode = 'wysiwyg';
    return container;
  }

  return {
    /**
     * 初始化编辑器，根据 useMarkdown 决定模式
     * @param {HTMLElement} container - 挂载容器
     * @param {string} content - 初始内容 (Markdown 源码)
     * @param {boolean} useMarkdown - true=WYSIWYG, false=纯文本
     */
    init(container, content, useMarkdown) {
      if (useMarkdown) {
        createWysiwygEditor(container, content);
      } else {
        createPlainEditor(container, content);
      }
    },

    /**
     * 销毁当前编辑器实例
     */
    destroy() {
      if (editorInstance) {
        editorInstance.destroy();
        editorInstance = null;
      }
    },

    /**
     * 获取编辑器内容 (Markdown 字符串)
     */
    getContent(container) {
      if (container._getContent) return container._getContent();
      return '';
    },

    /**
     * 设置编辑器内容
     */
    setContent(container, content) {
      if (container._setContent) container._setContent(content);
    },

    /**
     * 注册内容变更回调
     */
    onChange(container, fn) {
      if (container._onChange) container._onChange(fn);
    },

    /**
     * 获取滚动容器（用于滚动到底按钮）
     */
    getScrollTarget(container) {
      if (container._scrollTarget) return container._scrollTarget();
      return null;
    },

    /**
     * 获取当前模式
     */
    getMode() { return mode; },

    /**
     * 获取编辑器是否具有焦点
     */
    hasFocus(container) {
      if (mode === 'wysiwyg' && editorInstance) {
        return editorInstance.isFocused();
      }
      const ta = container.querySelector('#note-body-plain');
      return ta && document.activeElement === ta;
    },
  };
})();
```

- [ ] **Step 2: 在 index.html 中引入新模块**

在 `<script src="renderer.js"></script>` 之前添加：
```html
<script src="markdown-editor.js"></script>
```

---

### Task 3: 修改 renderer.js — 替换编辑器逻辑

**Files:**
- Modify: `src/renderer.js`

> 本节修改较多，分步进行。

- [ ] **Step 1: 添加 Markdown 开关判断函数**

在 `let saveTimer = null;` 之后添加：

```js
let settings = { markdownEnabled: true, notemsMarkdownEnabled: false, theme: 'system', appearance: 'bordered', panelAlpha: 82 };

function isMarkdownEnabledForNote(note) {
  if (note.markdownEnabled !== undefined) return note.markdownEnabled;
  if (note.notemsKey) return settings.notemsMarkdownEnabled !== false;
  return settings.markdownEnabled !== false;
}
```

- [ ] **Step 2: 修改 `init()` 函数，从 data 中加载 settings**

找到 `init()` 函数中 `const data = ...` 后的部分，修改 `state.notes` 和 `state.reminders` 的赋值，同时加载 settings：

将：
```js
const data = await window.electronAPI.loadData();
state.notes = data.notes || [];
state.reminders = data.reminders || [];
```

改为：
```js
const data = await window.electronAPI.loadData();
state.notes = data.notes || [];
state.reminders = data.reminders || [];
if (data.settings) {
  settings = Object.assign(settings, data.settings);
}
```

- [ ] **Step 3: 修改 `renderEditor()` — 使用 MarkdownEditor 模块**

将 `renderEditor(id)` 函数中创建/更新编辑器的部分重写。

找到以下两行：
```js
document.getElementById('note-body').value = note.body || '';
```

以及后面的「重置滚动到底按钮状态」代码块，全部替换为：

```js
  // 销毁旧编辑器实例
  MarkdownEditor.destroy();

  const bodyContainer = document.getElementById('note-body-container');
  const useMarkdown = isMarkdownEnabledForNote(note);
  MarkdownEditor.init(bodyContainer, note.body || '', useMarkdown);

  // 重置滚动到底按钮状态
  const btnScrollBottom = document.getElementById('btn-scroll-bottom');
  if (btnScrollBottom) {
    btnScrollBottom.classList.remove('visible');
    requestAnimationFrame(() => {
      const scrollTarget = MarkdownEditor.getScrollTarget(bodyContainer);
      if (scrollTarget && scrollTarget.scrollHeight > scrollTarget.clientHeight + 10) {
        btnScrollBottom.classList.add('visible');
      }
    });
  }
```

- [ ] **Step 4: 修改 `setupEditor()` — 输入监听改用 MarkdownEditor.onChange**

找到 `setupEditor()` 中 `body.addEventListener('input', ...)` 部分。

将以下代码块：
```js
body.addEventListener('input', () => {
  const note = state.notes.find(n => n.id === state.selectedId);
  if (!note) return;
  note.body = body.value;
  scheduleSave();
});
```

改为：

```js
  // 使用 MarkdownEditor 统一的内容变更回调
  const bodyContainer = document.getElementById('note-body-container');
  MarkdownEditor.onChange(bodyContainer, () => {
    const note = state.notes.find(n => n.id === state.selectedId);
    if (!note) return;
    note.body = MarkdownEditor.getContent(bodyContainer);
    autoTitle(note);  // 自动生成标题
    scheduleSave();
  });
```

- [ ] **Step 5: 将 Ctrl+S 保存逻辑改为监听 document（兼容 WYSIWYG 和纯文本模式）**

`setupEditor()` 原来的 `const body = document.getElementById('note-body')` 不再有效（textarea 已移除）。需要：
1. 移除 `const body = document.getElementById('note-body');` 这行
2. 将 keydown Ctrl+S 监听从 `body` 移到 `document`，确保 WYSIWYG 模式和纯文本模式都能触发

找到 `setupEditor()` 中的：
```js
const body = document.getElementById('note-body');
```
和整段 `body.addEventListener('keydown', (e) => { ... })`，替换为：

```js
  // Ctrl+S 保存（监听 document，兼容 WYSIWYG 和纯文本模式）
  document.addEventListener('keydown', (e) => {
    if (!((e.ctrlKey || e.metaKey) && e.key === 's')) return;
    if (!state.selectedId) return;
    // 确保当前焦点在编辑器区域内
    const editor = document.getElementById('note-editor');
    if (!editor || editor.style.display === 'none') return;

    e.preventDefault();
    clearTimeout(saveTimer);
    const status = document.getElementById('note-status');
    if (status) status.textContent = '保存中…';
    const note = state.notes.find(n => n.id === state.selectedId);
    const bodyContainer = document.getElementById('note-body-container');
    if (note && bodyContainer) note.body = MarkdownEditor.getContent(bodyContainer);
    window.electronAPI.saveData({ notes: state.notes, reminders: state.reminders.filter(r => !r.done) }).then(() => {
      if (status) status.textContent = '已保存';
      if (note && note.notemsKey) {
        window.electronAPI.setNotemsContent(note.notemsKey, note.body).then(ok => {
          if (ok) { if (status) status.textContent = '已同步到 note.ms'; }
          else { if (status) status.textContent = 'note.ms 同步失败'; }
        });
      }
    });
  });
```

- [ ] **Step 6: 修改滚动到底按钮监听目标**

找到「滚动到底按钮」代码块中的 `body` 引用，替换为 `MarkdownEditor.getScrollTarget()`。

将：
```js
const btnScrollBottom = document.getElementById('btn-scroll-bottom');
if (btnScrollBottom) {
  body.addEventListener('scroll', () => {
    ...
  });
  btnScrollBottom.addEventListener('click', () => {
    body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
  });
}
```

替换为：

```js
  const btnScrollBottom = document.getElementById('btn-scroll-bottom');
  if (btnScrollBottom) {
    const bodyContainer = document.getElementById('note-body-container');
    const getScrollEl = () => MarkdownEditor.getScrollTarget(bodyContainer);

    // 使用全局滚动监听（因为是动态滚动容器）
    let scrollHandler = null;
    const attachScroll = () => {
      const scrollEl = getScrollEl();
      if (scrollEl && !scrollHandler) {
        scrollHandler = () => {
          const threshold = 50;
          const atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - threshold;
          const scrollable = scrollEl.scrollHeight > scrollEl.clientHeight + 10;
          if (scrollable && !atBottom) {
            btnScrollBottom.classList.add('visible');
          } else {
            btnScrollBottom.classList.remove('visible');
          }
        };
        scrollEl.addEventListener('scroll', scrollHandler);
        // 初始检测
        scrollHandler();
      }
    };

    // 延迟附加滚动监听，等编辑器渲染完成
    setTimeout(attachScroll, 300);

    btnScrollBottom.addEventListener('click', () => {
      const scrollEl = getScrollEl();
      if (scrollEl) {
        scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
      }
    });
  }
```

- [ ] **Step 7: 清理旧的 body 事件监听**

由于 `#note-body` textarea 已不存在，需要移除 `setupEditor()` 中残留的 `body` 相关事件。

删除原有代码：
```js
body.addEventListener('keydown', (e) => { ... }); // 已在 Step 5 替换为 document 监听
body.addEventListener('blur', () => { ... });       // autoTitle 已通过 onChange 处理
```

并确保 `setupEditor()` 中原来的 `const body = document.getElementById('note-body');` 已被删除。

---

### Task 4: 修改 renderer.js — 右键菜单添加 Markdown 开关

**Files:**
- Modify: `src/renderer.js`

- [ ] **Step 1: 修改 `showContextMenu()` — 添加 Markdown 开关项**

在 `showContextMenu(e, noteId)` 函数中，在「重命名」之前添加动态判断的 Markdown 开关项。

修改 `let html = '';` 到 `html += ...`的部分：

将：
```js
let html = '';
html += `<div class="context-menu-item" data-action="mul-sel">${SVG.checkbox}多选</div>`;
html += `<div class="context-menu-separator"></div>`;
html += `<div class="context-menu-item" data-action="rename">${SVG.pen}重命名</div>`;
html += `<div class="context-menu-separator"></div>`;
html += `<div class="context-menu-item" data-action="delete">${SVG.trash}删除</div>`;
```

改为：
```js
let html = '';
html += `<div class="context-menu-item" data-action="mul-sel">${SVG.checkbox}多选</div>`;
html += `<div class="context-menu-separator"></div>`;
html += `<div class="context-menu-item" data-action="rename">${SVG.pen}重命名</div>`;

// Markdown 开关
const note = state.notes.find(n => n.id === noteId);
if (note) {
  const mdEnabled = isMarkdownEnabledForNote(note);
  html += `<div class="context-menu-separator"></div>`;
  if (mdEnabled) {
    html += `<div class="context-menu-item" data-action="md-disable">${SVG.note}关闭 Markdown</div>`;
  } else {
    html += `<div class="context-menu-item" data-action="md-enable">${SVG.note}启用 Markdown</div>`;
  }
}

html += `<div class="context-menu-separator"></div>`;
html += `<div class="context-menu-item" data-action="delete">${SVG.trash}删除</div>`;
```

- [ ] **Step 2: 修改右键菜单点击处理 — 添加 Markdown 开关逻辑**

在 `setupContextMenu()` 的 `menu.addEventListener('click', ...)` 回调中，在现有的 `if (action === 'mul-sel')` 之前添加：

```js
if (action === 'md-enable' || action === 'md-disable') {
  const note = state.notes.find(n => n.id === targetId);
  if (note) {
    note.markdownEnabled = action === 'md-enable';
    scheduleSave();
    // 如果切换的是当前选中的笔记，即时重建编辑器
    if (state.selectedId === targetId) {
      const bodyContainer = document.getElementById('note-body-container');
      const content = MarkdownEditor.getContent(bodyContainer);
      MarkdownEditor.destroy();
      MarkdownEditor.init(bodyContainer, content, note.markdownEnabled);
    }
    renderSidebar();
  }
  return;
}
```

---

### Task 5: 修改 renderer.js — 「编辑器」设置页

**Files:**
- Modify: `src/renderer.js`
- Modify: `src/index.html`

- [ ] **Step 1: 在 index.html 的 settings-nav 中添加「编辑器」导航项**

在 `#settings-nav` 的导航项末尾（`</div>` 之前）添加：

```html
<div class="settings-nav-item" data-section="editor">编辑器</div>
```

当前 `#settings-nav`：
```html
<div id="settings-nav" style="display:none;">
  <div class="settings-nav-item active" data-section="theme">主题</div>
  <div class="settings-nav-item" data-section="appearance">窗口样式</div>
  <div class="settings-nav-item" data-section="opacity">不透明度</div>
</div>
```

改为：
```html
<div id="settings-nav" style="display:none;">
  <div class="settings-nav-item active" data-section="theme">主题</div>
  <div class="settings-nav-item" data-section="appearance">窗口样式</div>
  <div class="settings-nav-item" data-section="opacity">不透明度</div>
  <div class="settings-nav-item" data-section="editor">编辑器</div>
</div>
```

- [ ] **Step 2: 在 index.html 的 settings-section 中添加「编辑器」页面**

在 `#section-opacity` 之后添加：

```html
<div id="section-editor" class="settings-page" style="display:none;">
  <div class="settings-page-header">编辑器</div>
  <div class="settings-page-body">
    <div class="editor-toggle-item">
      <div class="editor-toggle-label">
        <span class="editor-toggle-title">普通笔记 Markdown</span>
        <span class="editor-toggle-desc">新建和编辑普通笔记时默认使用所见即所得 Markdown 编辑器</span>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="toggle-md-global" checked>
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="editor-toggle-item">
      <div class="editor-toggle-label">
        <span class="editor-toggle-title">Notems 笔记 Markdown</span>
        <span class="editor-toggle-desc">从 note.ms 获取的笔记也使用 Markdown 渲染</span>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="toggle-md-notems">
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>
</div>
```

- [ ] **Step 3: 在 renderer.js `setupSettings()` 中添加编辑器页面的逻辑**

在 `switchSettingsSection(section)` 函数里添加 `editor` case。找到 `switchSettingsSection` 函数体中最后的 `if (section === 'opacity') { ... }` 块，在其后添加：

```js
if (section === 'editor') {
  document.getElementById('toggle-md-global').checked = settings.markdownEnabled !== false;
  document.getElementById('toggle-md-notems').checked = settings.notemsMarkdownEnabled === true;
}
```

- [ ] **Step 4: 添加 toggle 开关事件处理**

在 `setupSettings()` 函数末尾（`}` 之前），添加两个 toggle 的事件监听：

```js
// Markdown 全局开关
document.getElementById('toggle-md-global').addEventListener('change', function () {
  const wasEnabled = settings.markdownEnabled !== false;
  settings.markdownEnabled = this.checked;
  // 维护设置对象
  updateStoredSettings();
  // 如果当前打开的普通笔记且无显式覆盖，即时重建编辑器
  const note = state.notes.find(n => n.id === state.selectedId);
  if (note && !note.notemsKey && note.markdownEnabled === undefined) {
    const bodyContainer = document.getElementById('note-body-container');
    if (bodyContainer) {
      const content = MarkdownEditor.getContent(bodyContainer);
      MarkdownEditor.destroy();
      MarkdownEditor.init(bodyContainer, content, isMarkdownEnabledForNote(note));
    }
  }
});

// Notems Markdown 开关
document.getElementById('toggle-md-notems').addEventListener('change', function () {
  settings.notemsMarkdownEnabled = this.checked;
  updateStoredSettings();
  // 如果当前打开的 Notems 笔记无显式覆盖，即时重建编辑器
  const note = state.notes.find(n => n.id === state.selectedId);
  if (note && note.notemsKey && note.markdownEnabled === undefined) {
    const bodyContainer = document.getElementById('note-body-container');
    if (bodyContainer) {
      const content = MarkdownEditor.getContent(bodyContainer);
      MarkdownEditor.destroy();
      MarkdownEditor.init(bodyContainer, content, isMarkdownEnabledForNote(note));
    }
  }
});
```

- [ ] **Step 5: 添加 `updateStoredSettings()` 辅助函数**

在 `setupSettings()` 函数之前添加：

```js
async function updateStoredSettings() {
  const data = await window.electronAPI.loadData();
  data.settings = Object.assign(data.settings || {}, settings);
  await window.electronAPI.saveData(data);
}
```

---

### Task 6: 修改 styles.css — Win11 主题覆盖 + toggle 开关样式

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: 添加纯文本 textarea 样式**

在 CSS 文件末尾添加：

```css
/* ====== 纯文本模式 textarea ====== */
.plain-textarea {
  flex: 1;
  border: none;
  background: transparent;
  padding: 14px 20px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
  outline: none;
  resize: none;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace;
  width: 100%;
  height: 100%;
}

.plain-textarea::placeholder { color: var(--text-secondary); }
.plain-textarea::-webkit-scrollbar { width: 8px; }
.plain-textarea::-webkit-scrollbar-track { background: transparent; margin: 4px 0; }
.plain-textarea::-webkit-scrollbar-thumb {
  background: var(--scrollbar);
  border-radius: 4px;
  min-height: 40px;
  border: 2px solid transparent;
  background-clip: content-box;
  transition: background 0.2s;
}
.plain-textarea::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
  border-width: 1px;
}
```

- [ ] **Step 2: 添加 Toast UI Editor Win11 主题覆盖**

```css
/* ====== Toast UI Editor Win11 主题覆盖 ====== */

/* 编辑器容器 */
#note-body-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Toast UI Editor 内部字体 */
.toastui-editor-contents,
.toastui-editor-contents * {
  font-family: var(--font) !important;
}

/* 工具栏适配 */
.toastui-editor-toolbar {
  background: transparent !important;
  border-bottom: 1px solid var(--border) !important;
  padding: 2px 8px !important;
}

.toastui-editor-toolbar button {
  border-radius: var(--radius-sm) !important;
  transition: background var(--transition) !important;
}

.toastui-editor-toolbar button:hover {
  background: var(--item-hover) !important;
}

.toastui-editor-toolbar button.active {
  background: color-mix(in srgb, var(--accent) 15%, transparent) !important;
  color: var(--accent) !important;
}

/* 工具栏分隔线 */
.toastui-editor-toolbar .toolbar-divider {
  border-color: var(--border) !important;
}

/* 编辑区背景和文字 */
.toastui-editor-main {
  background: transparent !important;
}

.toastui-editor-md-container,
.toastui-editor-ww-container {
  background: transparent !important;
}

.ProseMirror {
  padding: 14px 20px !important;
  color: var(--text) !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  min-height: 100%;
}

.ProseMirror:focus {
  outline: none !important;
}

/* placeholder */
.ProseMirror p.is-editor-empty:first-child::before {
  color: var(--text-secondary) !important;
  font-style: italic;
}

/* 弹出层（链接编辑、表格控制等） */
.toastui-editor-popup {
  background: var(--main-bg) !important;
  backdrop-filter: blur(var(--blur-amount)) var(--blur-saturate) var(--blur-brightness) !important;
  -webkit-backdrop-filter: blur(var(--blur-amount)) var(--blur-saturate) var(--blur-brightness) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  box-shadow: var(--shadow-lg) !important;
  color: var(--text) !important;
}

.toastui-editor-popup input {
  background: var(--item-hover) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius-sm) !important;
  color: var(--text) !important;
}

.toastui-editor-popup button {
  border-radius: var(--radius-sm) !important;
}

/* 代码块 */
.toastui-editor-contents pre,
.ProseMirror pre {
  background: color-mix(in srgb, var(--text) 6%, transparent) !important;
  border-radius: var(--radius-sm) !important;
  border: 1px solid var(--border) !important;
}

/* 表格 */
.toastui-editor-contents table,
.ProseMirror table {
  border-color: var(--border) !important;
}

.toastui-editor-contents th,
.toastui-editor-contents td,
.ProseMirror th,
.ProseMirror td {
  border-color: var(--border) !important;
}

/* 引用块 */
.toastui-editor-contents blockquote,
.ProseMirror blockquote {
  border-left-color: var(--accent) !important;
  color: var(--text-secondary) !important;
}

/* 滚动条 */
.toastui-editor-main .toastui-editor-ww-container::-webkit-scrollbar,
.toastui-editor-main .toastui-editor-md-container::-webkit-scrollbar {
  width: 8px;
}
.toastui-editor-main .toastui-editor-ww-container::-webkit-scrollbar-track,
.toastui-editor-main .toastui-editor-md-container::-webkit-scrollbar-track {
  background: transparent;
  margin: 4px 0;
}
.toastui-editor-main .toastui-editor-ww-container::-webkit-scrollbar-thumb,
.toastui-editor-main .toastui-editor-md-container::-webkit-scrollbar-thumb {
  background: var(--scrollbar);
  border-radius: 4px;
  min-height: 40px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.toastui-editor-main .toastui-editor-ww-container::-webkit-scrollbar-thumb:hover,
.toastui-editor-main .toastui-editor-md-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
  border-width: 1px;
}
```

- [ ] **Step 3: 添加 toggle 开关组件样式**

```css
/* ====== Toggle 开关 ====== */
.editor-toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}

.editor-toggle-label {
  flex: 1;
}

.editor-toggle-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  display: block;
}

.editor-toggle-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 3px;
  display: block;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--item-active);
  border-radius: 22px;
  transition: background var(--transition);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform var(--transition);
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--accent);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(18px);
}

.toggle-switch input:focus-visible + .toggle-slider {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 4: 删除旧的 `#note-body` textarea 样式（如有冲突）**

检查 `#note-body` 相关样式，如 `padding`, `font-size`, `line-height` 等。这些样式现在由 Toast UI Editor 内部管理或 `.plain-textarea` 处理。保留 scrollbar 样式作为参考，但可以保留 `#note-body` 的规则以防万一（纯文本模式下 textarea 用新类 `.plain-textarea`）。

---

### Task 7: 最终验证

- [ ] **Step 1: 启动应用并测试基本功能**

```bash
cd "C:\Users\29981\Desktop\QuickMemo" && npm start
```

测试清单：
1. 新建笔记 → 应显示 WYSIWYG 编辑器（工具栏可见）
2. 输入 Markdown 语法（标题、加粗、列表）→ 实时渲染
3. 代码块语法高亮
4. Ctrl+S 保存 → 重新打开笔记内容不变
5. 右键菜单 → 可见「关闭 Markdown」选项
6. 点击「关闭 Markdown」→ 切换为纯文本等宽字体 textarea
7. 右键 → 可见「启用 Markdown」→ 切回 WYSIWYG
8. 设置 → 编辑器 → 关闭「普通笔记 Markdown」→ 新建笔记为纯文本模式
9. Notems 笔记 → 默认纯文本模式
10. 设置 → 开启「Notems 笔记 Markdown」→ Notems 笔记显示 WYSIWYG
11. 滚动到底按钮 → 长笔记中正常显示和工作

- [ ] **Step 2: 如有问题，`npm run dev` 打开 DevTools 查看 Console 错误**

---

### Task 8: 提交

- **Files:**
  - All changed files

```bash
cd "C:\Users\29981\Desktop\QuickMemo"
git add assets/editor/ src/index.html src/markdown-editor.js src/renderer.js src/styles.css docs/superpowers/
git commit -m "feat: add Typora-style WYSIWYG Markdown editing with per-note toggle"
```
