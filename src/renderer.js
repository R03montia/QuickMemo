const SVG = {
  note: '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><line x1="6.5" y1="7.5" x2="13.5" y2="7.5"/><line x1="6.5" y1="10.5" x2="11" y2="10.5"/><line x1="6.5" y1="13.5" x2="9" y2="13.5"/></svg>',
  alarm: '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7A5 5 0 0 0 5 7c0 5.5-2.5 7.5-2.5 7.5h15S15 12.5 15 7"/><path d="M11.4 16.5a1.5 1.5 0 0 1-2.8 0"/></svg>',
  plus: '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h14"/><path d="M16 6v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6"/></svg>',
  check: '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 5.5 8 14.5 4 10.5"/></svg>',
  drag: '<svg class="icon icon-drag" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="5" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="10" r="1"/><circle cx="8" cy="15" r="1"/><circle cx="12" cy="15" r="1"/></svg>',
  clock: '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><polyline points="10 6 10 10 13 13"/></svg>',
  pen: '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.5l2 2L6 16H4v-2l10.5-10.5z"/></svg>',
  notems: '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3l2 2L6 17H3v-3L15 3z"/><line x1="13" y1="5" x2="15" y2="7"/></svg>',
  checkbox: '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="2"/><polyline points="14 8 9 13 6 10"/></svg>',
};

let state = { notes: [], reminders: [], selectedId: null, multiSelected: new Set(), multiMode: false };
let saveTimer = null;
let settings = { markdownEnabled: true, notemsMarkdownEnabled: false, theme: 'system', appearance: 'bordered', panelAlpha: 82 };

function isMarkdownEnabledForNote(note) {
  if (note.markdownEnabled !== undefined) return note.markdownEnabled;
  if (note.notemsKey) return settings.notemsMarkdownEnabled !== false;
  return settings.markdownEnabled !== false;
}
let calDate = new Date();
let selectedDate = new Date();
let selectedHour = 0;
let selectedMinute = 0;
let currentAccent = '#005fb8';
let isDark = false;
let currentPanelAlpha = 82;
let currentThemePref = 'system';
let currentAppearance = 'bordered';

// ====== 初始化 ======
async function init() {
  currentAccent = await window.electronAPI.getAccentColor();
  const theme = await window.electronAPI.getTheme();
  isDark = theme === 'dark';
  applyTheme();

  currentThemePref = await window.electronAPI.getThemePreference();

  // 加载保存的不透明度
  const savedAlpha = await window.electronAPI.getPanelAlpha();
  currentPanelAlpha = savedAlpha;
  applyPanelAlpha(savedAlpha);

  const data = await window.electronAPI.loadData();
  state.notes = data.notes || [];
  state.reminders = data.reminders || [];
  if (data.settings) {
    settings = Object.assign(settings, data.settings);
  }

  renderSidebar();
  if (state.notes.length > 0) selectNote(state.notes[0].id);

  window.electronAPI.onThemeChanged(({ accent, dark, theme }) => {
    currentAccent = accent;
    isDark = dark;
    currentThemePref = theme || currentThemePref;
    applyTheme();
    applyPanelAlpha(currentPanelAlpha);
  });

  setupTitlebar();
  setupAppearance();
  setupSettings();
  setupNewNote();
  setupEditor();
  setupContextMenu();
  setupMultiToolbar();
  setupCalendar();
  setupTimeWheel();
}

function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty('--accent', currentAccent);
  const r = parseInt(currentAccent.slice(1,3), 16);
  const g = parseInt(currentAccent.slice(3,5), 16);
  const b = parseInt(currentAccent.slice(5,7), 16);
  root.style.setProperty('--accent-hover', `rgb(${Math.max(0,r-20)}, ${Math.max(0,g-20)}, ${Math.max(0,b-20)})`);
  document.body.style.colorScheme = isDark ? 'dark' : 'light';
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  if (typeof MarkdownEditor !== 'undefined') MarkdownEditor.updateTheme();
}

// ====== 窗口控件（同时支持有边框和无边框） ======
function setupTitlebar() {
  // 有边框标题栏按钮
  bindClick('btn-minimize-bar', () => window.electronAPI.minimize());
  bindClick('btn-maximize-bar', () => window.electronAPI.maximize());
  bindClick('btn-close-bar', () => window.electronAPI.close());
  // 无边框浮动按钮
  bindClick('btn-minimize', () => window.electronAPI.minimize());
  bindClick('btn-maximize', () => window.electronAPI.maximize());
  bindClick('btn-close', () => window.electronAPI.close());

  // 拖拽最大化窗口的标题栏 → 先还原再拖拽
  let isRestoring = false;
  document.querySelectorAll('#titlebar-drag, #main-drag').forEach(el => {
    if (!el) return;

    // 双击切换最大化
    el.addEventListener('dblclick', async () => {
      await window.electronAPI.maximize();
    });

    // 鼠标按下时若最大化 → 先还原
    el.addEventListener('mousedown', async (e) => {
      const maximized = await window.electronAPI.isMaximized();
      if (maximized) {
        isRestoring = true;
        await window.electronAPI.unmaximize();
        // 短暂延迟后允许继续拖拽
        setTimeout(() => { isRestoring = false; }, 150);
      }
    });
  });
}

function bindClick(id, fn) {
  const el = document.getElementById(id);
  if (!el) { console.warn('QuickMemo: element #' + id + ' not found'); return; }
  el.addEventListener('click', () => fn());
}

async function setupAppearance() {
  currentAppearance = await window.electronAPI.getAppearance();
  document.documentElement.setAttribute('data-appearance', currentAppearance);

  window.electronAPI.onAppearanceChanged((appearance) => {
    currentAppearance = appearance;
    document.documentElement.setAttribute('data-appearance', appearance);
  });
}

// ====== 拖拽排序 ======
let dragSourceId = null, dragOverId = null;

function setupDragDrop(item, noteId) {
  item.draggable = true;
  item.addEventListener('dragstart', (e) => {
    dragSourceId = noteId;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', noteId);
  });
  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    document.querySelectorAll('.note-item').forEach(el => el.classList.remove('drag-over', 'drag-above', 'drag-below'));
    dragSourceId = null; dragOverId = null;
  });
  item.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (noteId === dragSourceId) return;
    dragOverId = noteId;
    const rect = item.getBoundingClientRect();
    item.classList.remove('drag-above', 'drag-below');
    item.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-above' : 'drag-below');
  });
  item.addEventListener('dragleave', () => item.classList.remove('drag-above', 'drag-below'));
  item.addEventListener('drop', (e) => {
    e.preventDefault();
    const isBelow = item.classList.contains('drag-below');
    item.classList.remove('drag-above', 'drag-below');
    if (!dragSourceId || dragSourceId === noteId) return;
    let fromIdx = state.notes.findIndex(n => n.id === dragSourceId);
    if (fromIdx === -1) return;
    const [moved] = state.notes.splice(fromIdx, 1);
    const targetIdx = state.notes.findIndex(n => n.id === noteId);
    if (targetIdx === -1) { state.notes.splice(fromIdx, 0, moved); return; }
    state.notes.splice(isBelow ? targetIdx + 1 : targetIdx, 0, moved);
    scheduleSave();
    renderSidebar();
    document.querySelectorAll('.note-item').forEach(el => el.classList.toggle('active', el.dataset.id === state.selectedId));
  });
}

// ====== 右键菜单 ======
let contextTargetId = null;

function showContextMenu(e, noteId) {
  e.preventDefault();
  contextTargetId = noteId;
  const menu = document.getElementById('context-menu');
  // 动态构建菜单
  const multiCount = state.multiSelected.size;
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
      html += `<div class="context-menu-item" data-action="md-disable">${SVG.notems}关闭 Markdown</div>`;
    } else {
      html += `<div class="context-menu-item" data-action="md-enable">${SVG.notems}启用 Markdown</div>`;
    }
  }

  html += `<div class="context-menu-separator"></div>`;
  html += `<div class="context-menu-item" data-action="delete">${SVG.trash}删除</div>`;
  menu.innerHTML = html;
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.style.display = 'block';
}

function hideContextMenu() {
  document.getElementById('context-menu').style.display = 'none';
  contextTargetId = null;
}

function setupContextMenu() {
  const menu = document.getElementById('context-menu');
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) hideContextMenu(); });
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('.note-item') && !menu.contains(e.target)) hideContextMenu(); });
  menu.addEventListener('click', (e) => {
    const actionItem = e.target.closest('.context-menu-item');
    if (!actionItem) return;
    const action = actionItem.dataset.action;
    const targetId = contextTargetId;
    hideContextMenu();
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
    if (action === 'mul-sel') enterMultiSelect(targetId);
    else if (action === 'rename') {
      const n = state.notes.find(x => x.id === targetId);
      if (!n || n.notemsKey) return;
      startRename(targetId);
    }
    else if (action === 'delete') deleteNote(targetId);
    else if (action === 'delete-multi') deleteMultiNotes();
  });
}

function startRename(noteId) {
  const item = document.querySelector(`.note-item[data-id="${noteId}"]`);
  if (!item) return;
  const titleSpan = item.querySelector('.note-item-title');
  const currentTitle = titleSpan.textContent;
  const input = document.createElement('input');
  input.className = 'note-item-title note-item-title-editing';
  input.value = currentTitle;
  titleSpan.replaceWith(input);
  input.focus();
  input.select();
  const finish = () => {
    const newTitle = input.value.trim() || '未命名';
    const note = state.notes.find(n => n.id === noteId);
    if (note) { note.title = newTitle; scheduleSave(); }
    const span = document.createElement('span');
    span.className = 'note-item-title';
    span.textContent = newTitle;
    input.replaceWith(span);
    if (state.selectedId === noteId) document.getElementById('note-title').value = newTitle;
  };
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = currentTitle; input.blur(); }
  });
}

function deleteNote(noteId) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return;
  showConfirm('确定要删除「' + (note.title || '未命名') + '」吗？').then(ok => {
    if (!ok) return;
    const idx = state.notes.findIndex(n => n.id === noteId);
    if (idx === -1) return;
    state.notes.splice(idx, 1);
    const reminders = state.reminders.filter(r => r.noteId === noteId);
    for (const r of reminders) window.electronAPI.cancelReminder(r.id);
    state.reminders = state.reminders.filter(r => r.noteId !== noteId);
    if (state.selectedId === noteId) {
      if (state.notes.length > 0) selectNote(state.notes[0].id);
      else {
        state.selectedId = null;
        document.getElementById('note-editor').style.display = 'none';
        document.getElementById('empty-state').style.display = 'block';
      }
    }
    renderSidebar();
    scheduleSave();
  });
}

// ====== 侧边栏 ======
function renderSidebar() {
  const list = document.getElementById('note-list');
  list.innerHTML = '';
  for (const note of state.notes) {
    const item = document.createElement('div');
    let cls = 'note-item';
    if (note.id === state.selectedId) cls += ' active';
    if (state.multiSelected.has(note.id)) cls += ' multi-selected';
    item.className = cls;
    item.dataset.id = note.id;
    const reminder = state.reminders.find(r => r.noteId === note.id && !r.done);
    let icon = SVG.note;
    if (note.notemsKey) icon = SVG.notems;
    if (reminder) icon = SVG.alarm;
    item.innerHTML = `
      <span class="note-item-drag-handle">${SVG.drag}</span>
      <span class="note-item-icon">${icon}</span>
      <span class="note-item-title">${escapeHtml(note.title || '未命名')}</span>
      <span class="note-item-time">${formatTime(note.updatedAt)}</span>
    `;
    item.addEventListener('click', (e) => {
      if (e.target.closest('.note-item-drag-handle')) return;
      if (state.multiMode) {
        if (state.multiSelected.has(note.id)) {
          state.multiSelected.delete(note.id);
        } else {
          state.multiSelected.add(note.id);
        }
        item.classList.toggle('multi-selected', state.multiSelected.has(note.id));
        updateMultiCount();
        return;
      }
      selectNote(note.id);
    });
    item.addEventListener('contextmenu', (e) => showContextMenu(e, note.id));
    setupDragDrop(item, note.id);
    list.appendChild(item);
  }
}

function deleteMultiNotes() {
  showConfirm('确定要删除选中的 ' + state.multiSelected.size + ' 个笔记吗？').then(ok => {
    if (!ok) return;
    const ids = [...state.multiSelected];
    const selectedWasDeleted = ids.includes(state.selectedId);
    for (const id of ids) {
      const idx = state.notes.findIndex(n => n.id === id);
      if (idx === -1) continue;
      state.notes.splice(idx, 1);
      for (const r of state.reminders.filter(r => r.noteId === id)) window.electronAPI.cancelReminder(r.id);
      state.reminders = state.reminders.filter(r => r.noteId !== id);
    }
    state.multiSelected.clear();
    state.multiMode = false;
    document.getElementById('multi-toolbar').style.display = 'none';
    if (selectedWasDeleted) {
      if (state.notes.length > 0) selectNote(state.notes[0].id);
      else { state.selectedId = null; document.getElementById('note-editor').style.display = 'none'; document.getElementById('empty-state').style.display = 'block'; }
    }
    renderSidebar();
    scheduleSave();
  });
}

// ====== 多选模式 ======
function enterMultiSelect(targetId) {
  state.multiMode = true;
  state.multiSelected.clear();
  if (targetId) state.multiSelected.add(targetId);
  renderSidebar();
  showMultiToolbar();
}

function exitMultiSelect() {
  state.multiMode = false;
  state.multiSelected.clear();
  document.getElementById('multi-toolbar').style.display = 'none';
  renderSidebar();
}

function showMultiToolbar() {
  const bar = document.getElementById('multi-toolbar');
  bar.style.display = 'flex';
  document.getElementById('btn-multi-delete').innerHTML = SVG.trash;
  document.getElementById('btn-multi-reminder').innerHTML = SVG.alarm;
  updateMultiCount();
}

function updateMultiCount() {
  const count = state.multiSelected.size;
  document.getElementById('multi-count').textContent = `已选 ${count} 项`;
  document.getElementById('btn-multi-delete').style.display = count > 0 ? '' : 'none';
  document.getElementById('btn-multi-reminder').style.display = count > 0 ? '' : 'none';
}

function setupMultiToolbar() {
  document.getElementById('btn-multi-delete').addEventListener('click', deleteMultiNotes);
  document.getElementById('btn-multi-reminder').addEventListener('click', () => {
    if (state.multiSelected.size > 0) {
      const firstId = [...state.multiSelected][0];
      contextTargetId = firstId;
      resetCalendar(new Date());
      document.getElementById('reminder-picker').style.display = 'flex';
    }
  });
  document.getElementById('btn-multi-done').addEventListener('click', exitMultiSelect);
}

function selectNote(id) {
  if (state.multiMode) exitMultiSelect();
  state.selectedId = id;
  state.multiSelected.clear();
  renderSidebar();
  renderEditor(id);
  document.querySelectorAll('.note-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
}

// ====== 编辑器 ======
function renderEditor(id) {
  const note = state.notes.find(n => n.id === id);
  const editor = document.getElementById('note-editor');
  const empty = document.getElementById('empty-state');
  if (!note) { editor.style.display = 'none'; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  editor.style.display = 'flex';
  const titleEl = document.getElementById('note-title');
  titleEl.value = note.title || '';
  titleEl.readOnly = !!note.notemsKey;
  titleEl.style.cursor = note.notemsKey ? 'default' : '';
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

  const reminder = state.reminders.find(r => r.noteId === id && !r.done);
  const badge = document.getElementById('reminder-badge');
  const cancelBtn = document.getElementById('btn-cancel-reminder-badge');
  if (reminder) {
    badge.style.display = 'inline-flex';
    badge.innerHTML = `${SVG.clock}<span>${formatDateTime(reminder.time)}</span>`;
    cancelBtn.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
    cancelBtn.style.display = 'none';
  }
  document.getElementById('reminder-picker').style.display = 'none';

  // 显示/隐藏 note.ms 刷新按钮
  const refreshBtn = document.getElementById('btn-refresh-notems');
  if (note.notemsKey) {
    refreshBtn.style.display = 'inline-flex';
    refreshBtn.dataset.key = note.notemsKey;
  } else {
    refreshBtn.style.display = 'none';
  }
}

function setupNewNote() {
  const btn = document.getElementById('btn-new-note');
  btn.addEventListener('click', () => {
    const note = { id: Date.now().toString(), title: '新笔记', body: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    state.notes.unshift(note);
    selectNote(note.id);
    scheduleSave();
  });
  // 右键弹出「获取 Notems 内容」
  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openNotemsDialog();
  });
}

function setupEditor() {
  const title = document.getElementById('note-title');

  title.addEventListener('input', () => {
    const note = state.notes.find(n => n.id === state.selectedId);
    if (!note || note.notemsKey) return;
    note.title = title.value || '未命名'; scheduleSave(); updateSidebarItem(note.id, note.title);
  });

  function autoTitle(note) {
    const isDefault = !note.title || note.title === '新笔记' || note.title === '未命名';
    if (!isDefault) return;
    const firstLine = note.body.split('\n')[0].trim();
    if (firstLine && firstLine.length >= 3 && firstLine.length <= 60) {
      note.title = firstLine;
      document.getElementById('note-title').value = firstLine;
      updateSidebarItem(note.id, firstLine);
      scheduleSave();
    }
  }

  // 使用 MarkdownEditor 统一的内容变更回调
  const bodyContainer = document.getElementById('note-body-container');
  MarkdownEditor.onChange(bodyContainer, () => {
    const note = state.notes.find(n => n.id === state.selectedId);
    if (!note) return;
    note.body = MarkdownEditor.getContent(bodyContainer);
    autoTitle(note);  // 自动生成标题
    scheduleSave();
  });
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

  // ====== 滚动到底按钮 ======
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

  // ====== 提醒按钮 ======
  const btnReminder = document.getElementById('btn-reminder');
  const picker = document.getElementById('reminder-picker');
  const btnSet = document.getElementById('btn-set-reminder');
  const btnCancel = document.getElementById('btn-cancel-reminder');

  let closePicker = () => { picker.style.display = 'none'; };
  btnReminder.addEventListener('click', () => {
    const now = new Date();
    resetCalendar(now);
    picker.style.display = 'flex';
    // 点击提醒菜单外任意处关闭
    setTimeout(() => document.addEventListener('click', closePicker = (e) => {
      if (!picker.contains(e.target) && e.target !== btnReminder) {
        picker.style.display = 'none';
        document.removeEventListener('click', closePicker);
      }
    }), 0);
  });
  btnSet.addEventListener('click', async () => {
    const dt = getPickerDateTime();
    if (!dt || isNaN(dt.getTime())) return;
    picker.style.display = 'none';
    document.removeEventListener('click', closePicker);
    const reminder = await window.electronAPI.setReminder(state.selectedId, dt.toISOString());
    state.reminders.push(reminder);
    renderEditor(state.selectedId);
    renderSidebar();
  });
  btnCancel.addEventListener('click', () => {
    picker.style.display = 'none';
    document.removeEventListener('click', closePicker);
  });

  document.getElementById('btn-cancel-reminder-badge').addEventListener('click', async () => {
    const noteId = state.selectedId;
    const reminder = state.reminders.find(r => r.noteId === noteId && !r.done);
    if (!reminder) return;
    await window.electronAPI.cancelReminder(reminder.id);
    state.reminders = state.reminders.filter(r => r.id !== reminder.id);
    renderEditor(noteId);
    renderSidebar();
  });

  document.getElementById('btn-delete-note').addEventListener('click', async () => {
    const id = state.selectedId;
    if (!id) return;
    const delNote = state.notes.find(n => n.id === id);
    if (!delNote) return;
    const ok = await showConfirm('确定要删除「' + (delNote.title || '未命名') + '」吗？');
    if (!ok) return;
    state.notes = state.notes.filter(n => n.id !== id);
    for (const r of state.reminders.filter(r => r.noteId === id)) await window.electronAPI.cancelReminder(r.id);
    state.reminders = state.reminders.filter(r => r.noteId !== id);
    if (state.notes.length > 0) selectNote(state.notes[0].id);
    else { state.selectedId = null; renderSidebar(); document.getElementById('note-editor').style.display = 'none'; document.getElementById('empty-state').style.display = 'block'; }
    scheduleSave();
  });

  // ====== note.ms 刷新按钮 ======
  document.getElementById('btn-refresh-notems').addEventListener('click', async () => {
    const key = document.getElementById('btn-refresh-notems').dataset.key;
    if (!key) return;
    const ok = await showConfirm('将从 note.ms 重新获取内容，覆盖当前编辑。确定吗？');
    if (!ok) return;
    const btn = document.getElementById('btn-refresh-notems');
    btn.classList.add('spin');
    const content = await window.electronAPI.getNotemsContent(key);
    btn.classList.remove('spin');
    if (content) {
      const note = state.notes.find(n => n.id === state.selectedId);
      if (note) {
        note.body = content;
        MarkdownEditor.setContent(document.getElementById('note-body-container'), content);
        scheduleSave();
      }
    }
  });
}

// ====== 自定义日历 ======
function renderCalendar() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  document.getElementById('cal-month-year').textContent = `${year}年${month + 1}月`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const grid = document.getElementById('cal-days');
  grid.classList.remove('cal-slide-in');
  grid.innerHTML = '';
  void grid.offsetWidth; // force reflow
  grid.classList.add('cal-slide-in');
  const today = new Date();

  for (let i = firstDay - 1; i >= 0; i--) {
    const btn = document.createElement('button');
    btn.className = 'cal-day other-month';
    btn.textContent = daysInPrev - i;
    btn.addEventListener('click', () => { calDate.setMonth(month - 1); selectDay(daysInPrev - i); });
    grid.appendChild(btn);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const btn = document.createElement('button');
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const isSel = d === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
    btn.className = 'cal-day' + (isToday ? ' today' : '') + (isSel ? ' selected' : '');
    btn.textContent = d;
    btn.addEventListener('click', () => selectDay(d));
    grid.appendChild(btn);
  }
  const totalCells = firstDay + daysInMonth;
  const remaining = (7 - totalCells % 7) % 7;
  for (let d = 1; d <= remaining; d++) {
    const btn = document.createElement('button');
    btn.className = 'cal-day other-month';
    btn.textContent = d;
    btn.addEventListener('click', () => { calDate.setMonth(month + 1); selectDay(d); });
    grid.appendChild(btn);
  }
}

function selectDay(d) {
  selectedDate = new Date(calDate.getFullYear(), calDate.getMonth(), d);
  renderCalendar();
}

function resetCalendar(now) {
  calDate = new Date(now);
  selectedDate = new Date(now);
  selectedHour = now.getHours();
  selectedMinute = Math.min(now.getMinutes(), 59);
  if (selectedMinute >= 60) { selectedMinute = 0; selectedHour = (selectedHour + 1) % 24; }
  renderCalendar();
  renderTimeWheel();
}

function getPickerDateTime() {
  const dt = new Date(selectedDate);
  dt.setHours(selectedHour, selectedMinute, 0, 0);
  return dt;
}

// ====== 双列时间滚轮（时 / 分） ======
function renderWheelColumn(containerId, value, max, step, setter) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const range = 4;
  const stepSize = step || 1;

  for (let i = -range; i <= range; i++) {
    const v = ((value + i * stepSize) % max + max) % max;
    const item = document.createElement('div');
    const dist = Math.abs(i);

    if (dist === 0) {
      item.className = 'tw-item tw-selected';
    } else {
      item.className = 'tw-item';
      item.style.opacity = Math.max(0.08, 1 - dist * 0.25);
      item.style.fontSize = Math.max(11, 15 - dist * 1.8) + 'px';
    }

    item.textContent = String(v).padStart(2, '0');
    item.addEventListener('click', () => { setter(v); renderTimeWheel(); });
    container.appendChild(item);
  }
  // 垂直居中：4个24px项 + 半个28px选中项 = 110px，容器中心70px → 偏移 -40px
  container.style.marginTop = '-40px';
}

function renderTimeWheel() {
  renderWheelColumn('tw-hours-items', selectedHour, 24, 1, (v) => { selectedHour = v; });
  renderWheelColumn('tw-minutes-items', selectedMinute, 60, 1, (v) => { selectedMinute = v; });
}

function setupTimeWheel() {
  const cols = [
    { id: 'tw-hours-col', getter: () => selectedHour, setter: (v) => { selectedHour = ((v % 24) + 24) % 24; renderTimeWheel(); }, max: 24, step: 1 },
    { id: 'tw-minutes-col', getter: () => selectedMinute, setter: (v) => { selectedMinute = ((v % 60) + 60) % 60; renderTimeWheel(); }, max: 60, step: 1 },
  ];

  for (const col of cols) {
    const el = document.getElementById(col.id);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dir = e.deltaY > 0 ? 1 : -1;
      const current = col.getter();
      let next = ((current + dir * col.step) % col.max + col.max) % col.max;
      col.setter(next);
    }, { passive: false });
  }
}

function setupCalendar() {
  document.querySelectorAll('.cal-nav').forEach(btn => {
    btn.addEventListener('click', () => {
      calDate.setMonth(calDate.getMonth() + (btn.dataset.action === 'next' ? 1 : -1));
      if (selectedDate.getMonth() !== calDate.getMonth() || selectedDate.getFullYear() !== calDate.getFullYear()) {
        selectedDate = new Date(calDate.getFullYear(), calDate.getMonth(), Math.min(selectedDate.getDate(), new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0).getDate()));
      }
      renderCalendar();
    });
  });
  document.getElementById('custom-datepicker').addEventListener('wheel', (e) => {
    e.preventDefault();
    calDate.setMonth(calDate.getMonth() + (e.deltaY > 0 ? 1 : -1));
    renderCalendar();
  }, { passive: false });
}

// ====== 工具函数 ======
function scheduleSave() {
  clearTimeout(saveTimer);
  const status = document.getElementById('note-status');
  if (status) status.textContent = '保存中…';
  saveTimer = setTimeout(async () => {
    await window.electronAPI.saveData({ notes: state.notes, reminders: state.reminders.filter(r => !r.done) });
    if (status) status.textContent = '已自动保存';
  }, 500);
}

function updateSidebarItem(id, title) {
  const item = document.querySelector(`.note-item[data-id="${id}"]`);
  if (item) { const s = item.querySelector('.note-item-title'); if (s) s.textContent = title; }
}

function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ====== 双滑块：不透明度 + 模糊度 ======
function applyPanelAlpha(percent) {
  const root = document.documentElement;
  const alpha = Math.max(0.05, Math.min(1, percent / 100));
  const isDark = root.getAttribute('data-theme') === 'dark';

  if (isDark) {
    const mainAlpha = Math.max(alpha - 0.07, 0.05);
    const barAlpha = Math.min(alpha + 0.07, 1);
    root.style.setProperty('--sidebar-bg', `rgba(28, 28, 28, ${alpha})`);
    root.style.setProperty('--main-bg', `rgba(36, 36, 36, ${mainAlpha})`);
    root.style.setProperty('--titlebar-bg', `rgba(28, 28, 28, ${barAlpha})`);
  } else {
    const mainAlpha = Math.max(alpha - 0.07, 0.05);
    const barAlpha = Math.min(alpha + 0.1, 1);
    root.style.setProperty('--sidebar-bg', `rgba(243, 243, 243, ${alpha})`);
    root.style.setProperty('--main-bg', `rgba(252, 252, 252, ${mainAlpha})`);
    root.style.setProperty('--titlebar-bg', `rgba(243, 243, 243, ${barAlpha})`);
  }
}

// ====== 设置面板 ======
let settingsOpen = false;

async function updateStoredSettings() {
  const data = await window.electronAPI.loadData();
  data.settings = Object.assign(data.settings || {}, settings);
  await window.electronAPI.saveData(data);
}

function setupSettings() {
  const sidebarHeader = document.getElementById('sidebar-header');
  const noteList = document.getElementById('note-list');
  const settingsNav = document.getElementById('settings-nav');
  const settingsSection = document.getElementById('settings-section');

  function openSettings() {
    settingsOpen = true;
    // 侧栏切换
    sidebarHeader.style.display = 'none';
    noteList.style.display = 'none';
    settingsNav.style.display = 'block';
    // 主区域切换
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('note-editor').style.display = 'none';
    settingsSection.style.display = 'flex';
    // 默认打开主题页
    switchSettingsSection('theme');
  }

  function closeSettings() {
    settingsOpen = false;
    sidebarHeader.style.display = '';
    noteList.style.display = '';
    settingsNav.style.display = 'none';
    settingsSection.style.display = 'none';
    if (state.selectedId) renderEditor(state.selectedId);
    else document.getElementById('empty-state').style.display = 'block';
  }

  function switchSettingsSection(section) {
    // 高亮导航
    document.querySelectorAll('.settings-nav-item').forEach(i =>
      i.classList.toggle('active', i.dataset.section === section));
    // 切换页面
    document.querySelectorAll('.settings-page').forEach(p => p.style.display = 'none');
    const page = document.getElementById('section-' + section);
    if (page) page.style.display = 'flex';
    // 同步高亮选项
    document.querySelectorAll('.settings-option[data-action="theme"]').forEach(b =>
      b.classList.toggle('active', b.dataset.value === currentThemePref));
    document.querySelectorAll('.settings-option[data-action="appearance"]').forEach(b =>
      b.classList.toggle('active', b.dataset.value === currentAppearance));
    // 同步滑块
    if (section === 'opacity') {
      const sr = document.getElementById('settings-opacity-range');
      const sl = document.getElementById('settings-opacity-value');
      if (sr) { sr.value = currentPanelAlpha; sl.textContent = currentPanelAlpha + '%'; }
    }
    if (section === 'editor') {
      document.getElementById('toggle-md-global').checked = settings.markdownEnabled !== false;
      document.getElementById('toggle-md-notems').checked = settings.notemsMarkdownEnabled === true;
    }
  }

  // ⚙ 切换设置
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    if (settingsOpen) closeSettings();
    else openSettings();
  });

  // 导航点击
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.addEventListener('click', () => switchSettingsSection(item.dataset.section));
  });

  // 主题切换
  document.querySelectorAll('.settings-option[data-action="theme"]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.electronAPI.setTheme(btn.dataset.value);
      document.querySelectorAll('.settings-option[data-action="theme"]').forEach(b =>
        b.classList.toggle('active', b.dataset.value === btn.dataset.value));
    });
  });

  // 窗口样式切换
  document.querySelectorAll('.settings-option[data-action="appearance"]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.electronAPI.setAppearance(btn.dataset.value);
      document.querySelectorAll('.settings-option[data-action="appearance"]').forEach(b =>
        b.classList.toggle('active', b.dataset.value === btn.dataset.value));
    });
  });

  // 不透明度滑块
  const settingsRange = document.getElementById('settings-opacity-range');
  const settingsLabel = document.getElementById('settings-opacity-value');
  if (settingsRange) {
    settingsRange.addEventListener('input', () => {
      const val = parseInt(settingsRange.value);
      currentPanelAlpha = val;
      settingsLabel.textContent = val + '%';
      applyPanelAlpha(val);
    });
    settingsRange.addEventListener('change', () => {
      window.electronAPI.setPanelAlpha(currentPanelAlpha);
    });
  }

  // Markdown 全局开关
  document.getElementById('toggle-md-global').addEventListener('change', function () {
    settings.markdownEnabled = this.checked;
    updateStoredSettings();
    // 如果当前打开的普通笔记无显式覆盖，即时重建编辑器
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
}

// ====== 确认弹窗 ======
function showConfirm(text) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-overlay');
    const textEl = document.getElementById('confirm-text');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    textEl.textContent = text;
    overlay.style.display = 'flex';
    const close = (result) => { overlay.style.display = 'none'; resolve(result); };
    okBtn.onclick = () => close(true);
    cancelBtn.onclick = () => close(false);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };
  });
}

// ====== Note.ms 对话框 ======
function openNotemsDialog() {
  const overlay = document.getElementById('notems-overlay');
  const input = document.getElementById('notems-input');
  const error = document.getElementById('notems-error');
  const confirmBtn = document.getElementById('notems-confirm');
  const cancelBtn = document.getElementById('notems-cancel');
  const closeBtn = document.getElementById('notems-close');

  input.value = '';
  error.style.display = 'none';
  overlay.style.display = 'flex';

  const close = () => {
    overlay.style.display = 'none';
    document.removeEventListener('keydown', onKey);
    overlay.onclick = null;
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') confirmBtn.click();
  };
  document.addEventListener('keydown', onKey);
  setTimeout(() => input.focus(), 100);

  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  cancelBtn.onclick = close;
  closeBtn.onclick = close;

  confirmBtn.onclick = async () => {
    const key = input.value.trim();
    if (!key) {
      error.textContent = '请输入标识符';
      error.style.display = 'block';
      return;
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = '获取中…';
    error.style.display = 'none';

    const content = await window.electronAPI.getNotemsContent(key);

    if (!content) {
      error.textContent = '内容为空，可能是标识符不存在或网络错误';
      error.style.display = 'block';
      confirmBtn.disabled = false;
      confirmBtn.textContent = '获取';
      return;
    }
    if (content.startsWith('__DEBUG__:') || content.startsWith('__ERROR__:')) {
      error.textContent = '调试信息：' + content.replace(/^__(?:DEBUG|ERROR)__:/, '').slice(0, 200);
      error.style.display = 'block';
      confirmBtn.disabled = false;
      confirmBtn.textContent = '获取';
      return;
    }

    // 创建新笔记
    const note = {
      id: Date.now().toString(),
      title: key,
      body: content,
      notemsKey: key,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.notes.unshift(note);
    selectNote(note.id);
    scheduleSave();
    close();
    confirmBtn.disabled = false;
    confirmBtn.textContent = '获取';
  };
}

init();
