// markdown-editor.js — Obsidian 风格分栏 Markdown 编辑器
const MarkdownEditor = (() => {
  let currentMode = 'split'; // 'edit' | 'split' | 'preview'

  // 获取 marked 实例（v18+ 使用 marked.parse(text, options)）
  function getMarked() {
    return (typeof marked !== 'undefined') ? marked : null;
  }

  // 渲染 markdown 为 HTML
  function renderMarkdown(text) {
    const m = getMarked();
    if (m) {
      try {
        // marked v18+ API：parse(text, options)，不是 use(options)
        return m.parse(text || '', {
          breaks: true,
          gfm: true,
        });
      } catch {
        return escapePreview(text || '');
      }
    }
    return escapePreview(text || '');
  }

  // 简单 escape（marked 不可用时的回退）
  function escapePreview(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }

  // 防抖函数
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * 创建 Obsidian 风格分栏编辑器
   */
  function createSplitEditor(container, content) {
    currentMode = 'split';
    container.innerHTML = '';

    // === 构建 DOM ===
    const root = document.createElement('div');
    root.className = 'obsidian-editor';

    // 模式切换栏
    const toolbar = document.createElement('div');
    toolbar.className = 'obsidian-toolbar';
    toolbar.innerHTML = `
      <div class="obsidian-mode-group">
        <button class="obsidian-mode-btn" data-mode="edit" title="仅编辑">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 3.5l2 2L6 16H4v-2L14.5 3.5z"/>
          </svg>
        </button>
        <button class="obsidian-mode-btn active" data-mode="split" title="分栏">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="7" height="14" rx="1"/><rect x="11" y="3" width="7" height="14" rx="1"/>
          </svg>
        </button>
        <button class="obsidian-mode-btn" data-mode="preview" title="仅预览">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="10" cy="10" r="3"/><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z"/>
          </svg>
        </button>
      </div>
    `;

    // 分栏区域
    const panes = document.createElement('div');
    panes.className = 'obsidian-panes';

    // 编辑面板
    const editPane = document.createElement('div');
    editPane.className = 'obsidian-edit-pane';
    const textarea = document.createElement('textarea');
    textarea.className = 'obsidian-textarea';
    textarea.value = content || '';
    textarea.placeholder = '写点什么……';
    textarea.spellcheck = false;
    textarea.wrap = 'off';
    editPane.appendChild(textarea);

    // 预览面板
    const previewPane = document.createElement('div');
    previewPane.className = 'obsidian-preview-pane';
    const previewContent = document.createElement('div');
    previewContent.className = 'obsidian-preview-content markdown-body';
    previewContent.innerHTML = renderMarkdown(content || '');
    previewPane.appendChild(previewContent);

    panes.appendChild(editPane);
    panes.appendChild(previewPane);

    root.appendChild(toolbar);
    root.appendChild(panes);
    container.appendChild(root);

    // === 模式切换逻辑 ===
    const modeButtons = toolbar.querySelectorAll('.obsidian-mode-btn');
    const applyMode = (mode) => {
      currentMode = mode;
      modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      root.setAttribute('data-mode', mode);

      // 切换时重新渲染预览
      if (mode === 'preview' || mode === 'split') {
        previewContent.innerHTML = renderMarkdown(textarea.value);
      }

      // 如果切换到预览模式，确保预览滚动位置合理
      if (mode === 'preview') {
        previewPane.scrollTop = 0;
      }

      // 编辑模式下同步一次预览
      if (mode === 'edit') {
        // 不显示预览，但后台保持更新以便切换回分栏时是最新的
        previewContent.innerHTML = renderMarkdown(textarea.value);
      }
    };

    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        applyMode(btn.dataset.mode);
        // 聚焦编辑区（非预览模式时）
        if (btn.dataset.mode !== 'preview') {
          textarea.focus();
        }
      });
    });

    // === 实时预览 ===
    const updatePreview = debounce(() => {
      if (currentMode === 'edit') return; // 纯编辑模式不渲染
      previewContent.innerHTML = renderMarkdown(textarea.value);
    }, 150);

    textarea.addEventListener('input', updatePreview);

    // === Tab 键支持 ===
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);
        // 插入 2 个空格
        textarea.value = before + '  ' + after;
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        // 手动触发 input 以更新预览
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // === 滚动同步（编辑 → 预览） ===
    let syncing = false;
    textarea.addEventListener('scroll', () => {
      if (syncing) return;
      if (currentMode !== 'split') return;
      syncing = true;
      const ratio = textarea.scrollTop / Math.max(1, textarea.scrollHeight - textarea.clientHeight);
      // 预览面板的实际可滚动内容可能比容器高
      const previewMaxScroll = Math.max(1, previewPane.scrollHeight - previewPane.clientHeight);
      previewPane.scrollTop = ratio * previewMaxScroll;
      requestAnimationFrame(() => { syncing = false; });
    });

    // 预览面板独立滚动时不同步回编辑区（单向同步即可）

    // 预览面板中的链接：尝试通过 opener 打开（Electron 中会触发系统浏览器）
    previewPane.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && link.href && !link.href.startsWith('#')) {
        e.preventDefault();
        // Electron 中 window.open 配合 target='_blank' 会用系统浏览器打开
        window.open(link.href, '_blank');
      }
    });

    // === 暴露统一 API ===
    container._getContent = () => textarea.value;
    container._setContent = (val) => {
      textarea.value = val || '';
      previewContent.innerHTML = renderMarkdown(val || '');
      if (currentMode === 'edit') {
        // 编辑模式下也后台更新预览，切换时就能看到
        previewContent.innerHTML = renderMarkdown(val || '');
      }
    };
    container._onChange = (fn) => {
      textarea.addEventListener('input', fn);
    };
    container._scrollTarget = () => {
      if (currentMode === 'preview') return previewPane;
      return textarea;
    };
    container._destroy = () => {
      container.innerHTML = '';
      container._getContent = null;
      container._setContent = null;
      container._onChange = null;
      container._scrollTarget = null;
      container._destroy = null;
    };

    // 聚焦编辑区
    requestAnimationFrame(() => textarea.focus());

    return container;
  }

  /**
   * 创建纯文本编辑器（Markdown 禁用时）
   */
  function createPlainEditor(container, content) {
    currentMode = 'edit';
    container.innerHTML = '';

    const textarea = document.createElement('textarea');
    textarea.className = 'plain-textarea';
    textarea.value = content || '';
    textarea.placeholder = '写点什么……';
    textarea.spellcheck = false;
    textarea.wrap = 'off';
    container.appendChild(textarea);

    // Tab 键支持
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
    container._destroy = () => {
      container.innerHTML = '';
      container._getContent = null;
      container._setContent = null;
      container._onChange = null;
      container._scrollTarget = null;
      container._destroy = null;
    };

    requestAnimationFrame(() => textarea.focus());
    return container;
  }

  return {
    /**
     * 初始化编辑器
     * @param {HTMLElement} container - 挂载容器
     * @param {string} content - 初始内容 (Markdown 源码)
     * @param {boolean} useMarkdown - true=分栏编辑器, false=纯文本
     */
    init(container, content, useMarkdown) {
      if (useMarkdown) {
        createSplitEditor(container, content);
      } else {
        createPlainEditor(container, content);
      }
    },

    /** 销毁编辑器和所有事件监听 */
    destroy() {
      // _destroy 在 container 上，由 renderer 调用前通过 container._destroy() 完成
      // 这里只是确保没有全局残留
    },

    /** 获取编辑器内容 (Markdown 字符串) */
    getContent(container) {
      if (container && container._getContent) return container._getContent();
      return '';
    },

    /** 设置编辑器内容 */
    setContent(container, content) {
      if (container && container._setContent) container._setContent(content);
    },

    /** 注册内容变更回调 */
    onChange(container, fn) {
      if (container && container._onChange) container._onChange(fn);
    },

    /** 获取滚动容器 */
    getScrollTarget(container) {
      if (container && container._scrollTarget) return container._scrollTarget();
      return null;
    },

    /** 主题切换时调用 */
    updateTheme() {
      // 预览面板通过 CSS 变量自动适配，无需额外操作
    },

    /** 获取当前模式 */
    getMode() { return currentMode; },
  };
})();
