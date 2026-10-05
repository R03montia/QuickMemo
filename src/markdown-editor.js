// markdown-editor.js — 双模式 Markdown 编辑器
//   - 'source'  模式：textarea，显示原始 Markdown 源码，可编辑
//   - 'preview' 模式：只读 div，显示渲染后的 Markdown
//   切换模式时保留内容；预览始终基于源内容重新渲染。
//   打开笔记默认进 preview（阅读优先），用户手动切换后本次会话沿用该选择。
const MarkdownEditor = (() => {
  let container = null;
  let currentMode = 'source'; // 'source' | 'preview'
  let preferredMode = 'preview'; // 打开笔记时的默认视图，用户手切后跟随
  let scrollEl = null;        // 当前可滚动元素（textarea 或 preview div）

  function getMarked() {
    return (typeof marked !== 'undefined') ? marked : null;
  }

  // marked 默认放行原始 HTML，所以解析后再净化输出：
  // 移除危险元素与 on* 事件属性，并把 URL 限制在安全协议内。
  // 注意不能像以前那样在解析前整体转义实体——那会打断 "> 引用" 语法，
  // 也会把行内代码里的 "<div>" 二次编码成 "&lt;div>"。
  const BLOCKED_TAGS = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'STYLE', 'BASE', 'FORM']);
  const DANGEROUS_URL = /^\s*(?:javascript|vbscript|data:text\/html)/i;
  // 交给系统浏览器打开的链接只认这三种协议，避免把本地路径甩给系统 shell
  const EXTERNAL_URL = /^(?:https?|mailto):/i;

  function sanitizeHtml(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    tpl.content.querySelectorAll('*').forEach(el => {
      if (BLOCKED_TAGS.has(el.tagName)) { el.remove(); return; }
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        const isUrl = name === 'href' || name === 'src' || name === 'xlink:href';
        if (name.startsWith('on') || name === 'style' || (isUrl && DANGEROUS_URL.test(attr.value))) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return tpl.innerHTML;
  }

  function renderMarkdown(text) {
    const m = getMarked();
    if (m) {
      try {
        return sanitizeHtml(m.parse(text || '', { breaks: true, gfm: true }));
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

  // Preview rendering cap: a very large markdown body becomes tens/hundreds of
  // thousands of DOM nodes after marked parses it. Selecting across that many
  // nodes (Ctrl+A in preview selects the whole document because the preview
  // host is contenteditable=false) makes Chromium block the main thread for
  // many seconds / permanently. Capping the rendered preview DOM keeps
  // selection bounded; the full text still lives in source mode and in
  // _lastSourceContent, so editing/copying/createdAt are unaffected.
  const PREVIEW_CHAR_LIMIT = 60000;

  function renderPreviewHtml(content) {
    const text = (content || '');
    if (text.length <= PREVIEW_CHAR_LIMIT) return renderMarkdown(text);
    // cut at a line boundary near the limit for cleaner markdown
    let cut = text.lastIndexOf('\n', PREVIEW_CHAR_LIMIT);
    if (cut < PREVIEW_CHAR_LIMIT * 0.5) cut = PREVIEW_CHAR_LIMIT;
    const head = text.slice(0, cut);
    const n = text.length.toLocaleString();
    const notice = '<div class="md-preview-notice">内容过长（' + n +
      ' 字），仅预览前 ' + head.length.toLocaleString() +
      ' 字。请切换到"源码"模式查看 / 编辑 / 复制全文。</div>';
    const foot = '<div class="md-preview-notice md-preview-notice-foot">…（已截断，共 ' + n + ' 字）</div>';
    return notice + renderMarkdown(head) + foot;
  }

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
    container._setContent = (val) => {
      textarea.value = val || '';
      container._lastSourceContent = val || '';
    };
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
    div.innerHTML = renderPreviewHtml(content || '');
    root.appendChild(div);
    scrollEl = div;

    // 拦截 <a> 点击：阻止默认跳转，转交系统浏览器打开（仅限安全协议）
    div.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a || !a.href) return;
      e.preventDefault();
      e.stopPropagation();
      if (!EXTERNAL_URL.test(a.href)) return;
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(a.href).catch(() => {});
      }
    });

    container._getContent = () => container._lastSourceContent || '';
    container._setContent = (val) => {
      container._lastSourceContent = val || '';
      div.innerHTML = renderPreviewHtml(val || '');
    };
    container._onChange = () => {};
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

      // Markdown 笔记跟随用户偏好（首次为 preview），纯文本笔记恒为 source
      currentMode = useMarkdown ? preferredMode : 'source';

      const root = document.createElement('div');
      root.className = useMarkdown ? 'md-editor md-editor-markdown' : 'md-editor md-editor-plain';
      root.setAttribute('data-mode', currentMode);
      cont.appendChild(root);

      // 记住最近一次的源内容（供预览模式 getContent 读取）
      container._lastSourceContent = content || '';

      if (currentMode === 'preview') {
        mountPreview(root, content);
      } else {
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
      preferredMode = mode;   // 记住用户的选择，切换笔记时沿用
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
