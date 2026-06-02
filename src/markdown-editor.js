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
