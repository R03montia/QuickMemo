// markdown-editor.js — 双模式 Markdown 编辑器
//   - 'source'  模式：textarea，显示原始 Markdown 源码，可编辑
//   - 'preview' 模式：div，显示渲染后的 Markdown，只读
//   切换模式时保留内容；预览始终基于 state.notes[i].body 重新渲染。
const MarkdownEditor = (() => {
  let container = null;
  let currentMode = 'source'; // 'source' | 'preview'
  let scrollEl = null;        // 当前可滚动元素（textarea 或 preview div）

  function getMarked() {
    return (typeof marked !== 'undefined') ? marked : null;
  }

  // XSS protection: 转义 HTML 实体后再交给 marked
  function escapeHtmlEntities(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function renderMarkdown(text) {
    const m = getMarked();
    if (m) {
      try {
        const safe = escapeHtmlEntities(text || '');
        return m.parse(safe, { breaks: true, gfm: true });
      } catch {
        return escapePreview(text || '');
      }
    }
    return escapePreview(text || '');
  }

  function escapePreview(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }

  // 构造一个 <style> 元素注入基础 markdown 样式（如果还没有）
  function ensureMarkdownStyles() {
    if (document.getElementById('markdown-body-styles')) return;
    const style = document.createElement('style');
    style.id = 'markdown-body-styles';
    style.textContent = `
      .markdown-body { color: var(--text); line-height: 1.7; font-size: 14px; }
      .markdown-body h1, .markdown-body h2, .markdown-body h3,
      .markdown-body h4, .markdown-body h5, .markdown-body h6 {
        font-weight: 600; margin: 1.2em 0 0.5em; color: var(--text);
      }
      .markdown-body h1 { font-size: 1.8em; border-bottom: 1px solid var(--border); padding-bottom: 0.2em; }
      .markdown-body h2 { font-size: 1.5em; }
      .markdown-body h3 { font-size: 1.25em; }
      .markdown-body p { margin: 0.6em 0; }
      .markdown-body a { color: var(--accent); text-decoration: none; }
      .markdown-body a:hover { text-decoration: underline; }
      .markdown-body ul, .markdown-body ol { padding-left: 1.6em; margin: 0.6em 0; }
      .markdown-body li { margin: 0.2em 0; }
      .markdown-body code {
        font-family: var(--font-mono); font-size: 0.92em;
        background: var(--item-hover); padding: 1px 5px; border-radius: 3px;
      }
      .markdown-body pre {
        font-family: var(--font-mono); font-size: 13px;
        background: var(--item-hover); padding: 12px 14px;
        border-radius: 6px; overflow-x: auto; line-height: 1.5;
      }
      .markdown-body pre code { background: transparent; padding: 0; }
      .markdown-body blockquote {
        border-left: 3px solid var(--accent-soft);
        padding-left: 12px; margin: 0.8em 0;
        color: var(--text-secondary);
      }
      .markdown-body hr { border: none; border-top: 1px solid var(--border); margin: 1.2em 0; }
      .markdown-body table { border-collapse: collapse; margin: 0.8em 0; }
      .markdown-body th, .markdown-body td {
        border: 1px solid var(--border); padding: 6px 10px;
      }
      .markdown-body img { max-width: 100%; border-radius: 4px; }
      .markdown-body input[type="checkbox"] { margin-right: 4px; }
    `;
    document.head.appendChild(style);
  }

  // ===== 源代码视图：textarea =====
  function mountSource(root, content) {
    const textarea = document.createElement('textarea');
    textarea.className = 'md-source-textarea';
    textarea.value = content || '';
    textarea.placeholder = '在这里写 Markdown...（**粗体** *斜体* [链接](url) 等）';
    textarea.spellcheck = false;
    root.appendChild(textarea);
    scrollEl = textarea;

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    container._getContent = () => textarea.value;
    container._setContent = (val) => { textarea.value = val || ''; };
    container._onChange = (fn) => { textarea.addEventListener('input', fn); };
    container._scrollTarget = () => textarea;

    requestAnimationFrame(() => textarea.focus());
  }

  // ===== 渲染视图：只读 div =====
  function mountPreview(root, content) {
    ensureMarkdownStyles();
    const div = document.createElement('div');
    div.className = 'md-preview-content markdown-body';
    div.setAttribute('contenteditable', 'false');
    div.innerHTML = renderMarkdown(content || '');
    root.appendChild(div);
    scrollEl = div;

    // 拦截 <a> 点击：阻止默认跳转（会改 window.location 让整个 app 消失），
    // 转交给主进程用系统浏览器打开。
    div.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a || !a.href) return;
      e.preventDefault();
      e.stopPropagation();
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(a.href).catch(() => {});
      }
    });

    container._getContent = () => {
      // 预览是只读的，但 getContent 必须返回当前内容以便切换模式时不丢失
      // 由于预览不会修改源，直接返回上次的 source 即可
      return container._lastSourceContent || '';
    };
    container._setContent = (val) => {
      container._lastSourceContent = val || '';
      div.innerHTML = renderMarkdown(val || '');
    };
    container._onChange = () => { /* 预览只读，无变化 */ };
    container._scrollTarget = () => div;
  }

  function clearContainer() {
    if (container) {
      container.innerHTML = '';
      container._getContent = null;
      container._setContent = null;
      container._onChange = null;
      container._scrollTarget = null;
      container._lastSourceContent = null;
    }
    scrollEl = null;
  }

  return {
    init(cont, content, useMarkdown) {
      clearContainer();
      container = cont;

      const root = document.createElement('div');
      root.className = useMarkdown ? 'md-editor md-editor-markdown' : 'md-editor md-editor-plain';
      root.setAttribute('data-mode', currentMode);
      cont.appendChild(root);

      // 记住最近一次的源内容（供预览模式 getContent 读取）
      container._lastSourceContent = content || '';

      if (!useMarkdown) {
        // 纯文本模式：永远是 source 视图
        currentMode = 'source';
        mountSource(root, content);
      } else {
        // Markdown 模式：默认 source，用户可切到 preview
        currentMode = 'source';
        mountSource(root, content);
      }

      container._destroy = () => {
        clearContainer();
        container = null;
      };
    },

    /** 切换 'source' / 'preview' 模式 */
    setMode(mode) {
      if (!container) return;
      if (mode !== 'source' && mode !== 'preview') return;
      if (mode === currentMode) return;

      // 保存当前内容
      const content = this.getContent(container) || '';
      currentMode = mode;
      const root = container.querySelector('.md-editor');
      if (!root) return;
      root.setAttribute('data-mode', mode);
      // 清空子元素但保留 root
      root.innerHTML = '';

      if (mode === 'source') {
        mountSource(root, content);
      } else {
        mountPreview(root, content);
      }
      // 每次模式切换都更新一次 _lastSourceContent
      container._lastSourceContent = content;

      // 通知 renderer.js 重新挂载 onChange 回调
      const bodyContainer = document.getElementById('note-body-container');
      if (bodyContainer && typeof registerEditorCallbacks === 'function') {
        registerEditorCallbacks();
      }
      window.dispatchEvent(new CustomEvent('editor-mode-changed', { detail: { mode } }));
    },

    getMode() { return currentMode; },

    destroy() {
      if (container && container._destroy) container._destroy();
    },

    getContent(cont) {
      const c = cont || container;
      if (c && c._getContent) return c._getContent();
      return '';
    },

    setContent(cont, content) {
      const c = cont || container;
      if (c && c._setContent) {
        c._setContent(content);
        c._lastSourceContent = content || '';
      }
    },

    onChange(cont, fn) {
      const c = cont || container;
      if (c && c._onChange) c._onChange(fn);
    },

    getScrollTarget(cont) {
      const c = cont || container;
      if (c && c._scrollTarget) return c._scrollTarget();
      return null;
    },

    updateTheme() {},
  };
})();
