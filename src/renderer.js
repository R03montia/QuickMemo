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
  file: '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h10l4 4v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><polyline points="14 2 14 8 20 8"/><line x1="6" y1="12" x2="14" y2="12"/><line x1="6" y1="15" x2="11" y2="15"/></svg>',
  // C4 修复：原 updateMaximizeIcon 里的硬编码 SVG 字符串
  maximize: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1.5" y="1.5" width="9" height="9" rx="1"/></svg>',
  maximizeRestored: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="1.5" width="7" height="7" rx="0.5"/><rect x="3" y="3.5" width="7" height="7" rx="0.5"/></svg>',
};

let state = { notes: [], reminders: [], selectedId: null, multiSelected: new Set(), multiMode: false };
let saveTimer = null;
let settings = { markdownEnabled: true, notemsMarkdownEnabled: false, theme: 'system', appearance: 'bordered', panelAlpha: 82, customCSS: '' };

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
let currentAppearance = 'bordered';

// ====== 初始化 ======
async function init() {
  // 同步注册 IPC 监听器（必须在任何 await 之前，防止竞态）
  setupFileOpenSync();

  // 一次性收集所有初始数据
  const [accent, sysTheme, savedAlpha, data] = await Promise.all([
    window.electronAPI.getAccentColor(),
    window.electronAPI.getTheme(),
    window.electronAPI.getPanelAlpha(),
    window.electronAPI.loadData(),
  ]);
  systemAccent = accent;
  isDark = sysTheme === 'dark';
  currentPanelAlpha = savedAlpha;

  state.notes = data.notes || [];
  state.reminders = data.reminders || [];
  if (data.settings) settings = Object.assign(settings, data.settings);

  // 迁移：旧 settings.theme（'system'/'light'/'dark'/'sunset'/'ocean'/'trans'/'lesbian'/'gay'）
  //   → 新 settings.theme + settings.mode
  if (!data.settings || (data.settings.theme === undefined && data.settings.mode === undefined)) {
    // 兼容老格式：data.settings.theme 是单个字段
    const oldTheme = data.settings && data.settings.theme;
    if (oldTheme === 'system' || !oldTheme) {
      currentThemePref = 'default';
      currentModePref = 'system';
    } else if (oldTheme === 'light' || oldTheme === 'dark') {
      currentThemePref = 'default';
      currentModePref = oldTheme;
    } else if (oldTheme === 'trans') {
      // trans 已删除，回退到默认
      currentThemePref = 'default';
      currentModePref = 'light';
    } else if (oldTheme === 'lesbian') {
      // 旧名 lesbian → 新名 sunset
      currentThemePref = 'sunset';
      currentModePref = 'light';
    } else if (oldTheme === 'gay') {
      // 旧名 gay → 新名 ocean
      currentThemePref = 'ocean';
      currentModePref = 'light';
    } else {
      // 旧 sunset/ocean：保持
      currentThemePref = oldTheme;
      currentModePref = 'light';
    }
    // 回写新格式
    await window.electronAPI.saveData({ ...data, settings: { ...(data.settings || {}), theme: currentThemePref, mode: currentModePref } });
  } else {
    currentThemePref = data.settings.theme || 'default';
    currentModePref = data.settings.mode || 'system';
  }

  applyTheme();
  applyPanelAlpha(savedAlpha);

  renderSidebar();
  if (state.notes.length > 0) selectNote(state.notes[0].id);
  else setMainView('empty');

  // 系统主题变更监听：旗帜主题下不响应（用户选了什么就用什么）
  window.electronAPI.onThemeChanged(({ accent, dark }) => {
    // 始终更新 systemAccent 和 isDark
    systemAccent = accent;
    isDark = dark;
    // 当前是旗帜主题 → 忽略 OS 主题切换事件（用户已显式选择）
    if (isFlagTheme(currentThemePref)) return;
    // 默认主题 + system mode：响应 OS 切换
    if (currentModePref === 'system') {
      applyTheme();
      applyPanelAlpha(currentPanelAlpha);
    }
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
  setupFileOpen();
  setupSidebarResizer();
  setupUsage();

  // 标记初始化完成，处理等待中的文件打开
  initComplete = true;
  if (pendingFileOpen) {
    processOpenMdFile(pendingFileOpen);
    pendingFileOpen = null;
  }
}

// ====== .md 文件打开 ======
let pendingFileOpen = null;
let initComplete = false;

// 同步注册 IPC 监听器（避免竞态条件：主进程可能在 init() 的 await 期间发送消息）
function setupFileOpenSync() {
  if (window.electronAPI.onOpenMdFile) {
    window.electronAPI.onOpenMdFile((data) => {
      if (!initComplete) {
        pendingFileOpen = data;
        return;
      }
      processOpenMdFile(data);
    });
  }
}

function processOpenMdFile(data) {
  if (!data || typeof data !== 'object') return;
  const { path: filePath, name, content } = data;
  if (!filePath) return;

  // C5 修复：Windows 路径大小写不敏感，统一小写比较
  const normPath = (p) => p ? p.replace(/\\/g, '/').toLowerCase() : p;
  const filePathKey = normPath(filePath);

  try {
    const existing = state.notes.find(n => normPath(n.filePath) === filePathKey);
    if (existing) {
      // 同步文件最新内容
      if (content !== undefined) existing.body = content;
      existing.updatedAt = new Date().toISOString();
      selectNote(existing.id);
      scheduleSave();
      return;
    }
    const note = {
      id: genNoteId(),
      title: name || '未命名',
      body: content || '',
      filePath: filePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _autoTitled: false,
    };
    state.notes.unshift(note);
    selectNote(note.id);
    scheduleSave();
  } catch (e) {
    console.error('QuickMemo: processOpenMdFile error:', e);
  }
}

function setupFileOpen() {
  // 拖拽 Markdown / 纯文本文件到窗口，生成一份独立笔记
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (!files || !files.length) return;
    for (const file of files) {
      if (!file.name.match(/\.(md|markdown|txt)$/i)) continue;
      // 通过 File API 读取完整内容，保留原始 Markdown 格式
      const content = await file.text();
      const title = file.name.replace(/\.(md|markdown|txt)$/i, '');
      const note = {
        id: genNoteId(),
        title: title,
        body: content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _autoTitled: false,
      };
      state.notes.unshift(note);
      selectNote(note.id);
      scheduleSave();
    }
  });
}

// 系统强调色（init 时记录，onThemeChanged 时同步更新）
let systemAccent = '#0078d4';
// 主题/模式运行时状态（持久化在 settings.theme / settings.mode）
let currentThemePref = 'default';
let currentModePref = 'system';

// 主题化的强调色 + 侧栏/主区域基础 RGB（用于 alpha 滑块动态计算透明度）
// 每个主题两种模式（light/dark）的基础色不同
const FLAG_THEMES = {
  sunset: {
    accent: { light: '#FF4500', dark: '#FF6B35' },
    sidebar: { light: '255, 165, 100', dark: '60, 20, 10' },
    main:    { light: '255, 248, 240', dark: '35, 14, 8' },
  },
  ocean: {
    accent: { light: '#0074D9', dark: '#4FC3F7' },
    sidebar: { light: '57, 204, 204',  dark: '8, 18, 35' },
    main:    { light: '240, 250, 255', dark: '5, 12, 25' },
  },
  bloom: {
    accent: { light: '#e85478', dark: '#ff8fa5' },
    sidebar: { light: '240, 150, 175', dark: '70, 18, 32' },
    main:    { light: '255, 245, 248', dark: '40, 12, 22' },
  },
};

function isFlagTheme(theme) {
  return theme in FLAG_THEMES;
}

function applyTheme() {
  const root = document.documentElement;
  const flag = isFlagTheme(currentThemePref) ? FLAG_THEMES[currentThemePref] : null;

  // 决定 effective mode
  // - 默认主题：mode 可为 system/light/dark，system 跟随 isDark
  // - 旗帜主题：mode 直接取 currentModePref，system 当 light
  let effectiveMode;
  if (flag) {
    effectiveMode = currentModePref === 'dark' ? 'dark' : 'light';
  } else {
    if (currentModePref === 'system') effectiveMode = isDark ? 'dark' : 'light';
    else effectiveMode = currentModePref;
  }

  // 强调色：旗帜主题按 mode 取对应色；默认主题用系统色
  if (flag) {
    currentAccent = flag.accent[effectiveMode];
  } else {
    currentAccent = systemAccent;
  }
  root.style.setProperty('--accent', currentAccent);
  const r = parseInt(currentAccent.slice(1,3), 16);
  const g = parseInt(currentAccent.slice(3,5), 16);
  const b = parseInt(currentAccent.slice(5,7), 16);
  root.style.setProperty('--accent-hover', `rgb(${Math.max(0,r-20)}, ${Math.max(0,g-20)}, ${Math.max(0,b-20)})`);

  // 设置双属性
  root.setAttribute('data-theme', currentThemePref);
  root.setAttribute('data-mode', effectiveMode);
  document.body.style.colorScheme = effectiveMode === 'dark' ? 'dark' : 'light';

  if (typeof MarkdownEditor !== 'undefined') MarkdownEditor.updateTheme();
  if (typeof updateModeToggleIcon === 'function') updateModeToggleIcon();
}

// 标题栏/无边框模式切换按钮：更新 sun/moon/auto 图标（两组都要更新）
function updateModeToggleIcon() {
  const groups = [
    { sun: document.querySelector('#btn-mode-toggle .icon-sun'),
      moon: document.querySelector('#btn-mode-toggle .icon-moon'),
      auto: document.querySelector('#btn-mode-toggle .icon-auto') },
    { sun: document.querySelector('#btn-mode-toggle-float .icon-sun'),
      moon: document.querySelector('#btn-mode-toggle-float .icon-moon'),
      auto: document.querySelector('#btn-mode-toggle-float .icon-auto') },
  ];
  for (const g of groups) {
    if (!g.sun || !g.moon || !g.auto) continue;
    g.sun.style.display = 'none';
    g.moon.style.display = 'none';
    g.auto.style.display = 'none';
    if (currentModePref === 'dark') g.moon.style.display = '';
    else if (currentModePref === 'system') g.auto.style.display = '';
    else g.sun.style.display = '';
  }
}

// 标题栏模式按钮点击：light → dark → system → light（旗帜主题跳过 system）
function cycleMode() {
  if (isFlagTheme(currentThemePref)) {
    currentModePref = currentModePref === 'dark' ? 'light' : 'dark';
  } else {
    currentModePref = currentModePref === 'light' ? 'dark'
                   : currentModePref === 'dark' ? 'system'
                   : 'light';
  }
  applyTheme();
  applyPanelAlpha(currentPanelAlpha);
  window.electronAPI.setMode(currentModePref);
  // 同步设置面板高亮
  document.querySelectorAll('.settings-option[data-action="mode"]').forEach(b =>
    b.classList.toggle('active', b.dataset.value === currentModePref));
}

// ====== 窗口控件（同时支持有边框和无边框） ======
let isWindowMaximized = false;

function updateMaximizeIcon() {
  const btnBar = document.getElementById('btn-maximize-bar');
  const btnFloat = document.getElementById('btn-maximize');
  if (btnBar) btnBar.textContent = isWindowMaximized ? '❐' : '□';
  if (btnFloat) {
    // C4 修复：原硬编码 SVG 字符串移到 SVG 对象统一管理
    btnFloat.innerHTML = isWindowMaximized ? SVG.maximizeRestored : SVG.maximize;
  }

  // 最大化时拖拽区域改成点击还原，还原后恢复拖拽
  const dragEls = document.querySelectorAll('#titlebar-drag, #main-drag');
  dragEls.forEach(el => {
    if (isWindowMaximized) {
      el.style.webkitAppRegion = 'no-drag';
      el.style.cursor = 'default';
      el._unmaxHandler = el._unmaxHandler || (async () => {
        await window.electronAPI.unmaximize();
        isWindowMaximized = false;
        updateMaximizeIcon();
      });
      el.addEventListener('mousedown', el._unmaxHandler);
    } else {
      el.style.webkitAppRegion = 'drag';
      el.style.cursor = '';
      if (el._unmaxHandler) {
        el.removeEventListener('mousedown', el._unmaxHandler);
        el._unmaxHandler = null;
      }
    }
  });
}

async function toggleMaximize() {
  await window.electronAPI.maximize();
  isWindowMaximized = !isWindowMaximized;
  updateMaximizeIcon();
}

function setupTitlebar() {
  // 有边框标题栏按钮
  bindClick('btn-minimize-bar', () => window.electronAPI.minimize());
  bindClick('btn-maximize-bar', () => toggleMaximize());
  bindClick('btn-close-bar', () => window.electronAPI.close());
  // 无边框浮动按钮
  bindClick('btn-minimize', () => window.electronAPI.minimize());
  bindClick('btn-maximize', () => toggleMaximize());
  bindClick('btn-close', () => window.electronAPI.close());

  // 模式快速切换按钮（标题栏 + 无边框浮动，都绑同一个 cycleMode）
  const btnModeToggle = document.getElementById('btn-mode-toggle');
  if (btnModeToggle) {
    btnModeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleMode();
    });
  }
  const btnModeToggleFloat = document.getElementById('btn-mode-toggle-float');
  if (btnModeToggleFloat) {
    btnModeToggleFloat.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleMode();
    });
  }

  // 启动时检测一次
  window.electronAPI.isMaximized().then(v => {
    isWindowMaximized = v;
    updateMaximizeIcon();
  });

  // 监听主进程通知（双击标题栏触发时）
  if (window.electronAPI.onMaximizeChanged) {
    window.electronAPI.onMaximizeChanged((maximized) => {
      isWindowMaximized = maximized;
      updateMaximizeIcon();
    });
  }
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
          registerEditorCallbacks();
          // 同步模式切换按钮可见性
          const ft = document.getElementById('footer-mode-toggle');
          const nm = document.getElementById('note-mode');
          if (ft) ft.style.display = note.markdownEnabled ? '' : 'none';
          if (nm) nm.style.display = note.markdownEnabled ? '' : 'none';
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
  showConfirm('确定要删除「' + (note.title || '未命名') + '」吗？').then(async ok => {
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
// B11 修复：原 renderSidebar 每次 innerHTML='' 全量重建 DOM，100+ 笔记会卡且丢失滚动位置。
// 改为增量 patch：保留 id→element 映射，只增删改。
const noteElCache = new Map();

function buildNoteItem(note) {
  const item = document.createElement('div');
  item.dataset.id = note.id;
  const reminder = state.reminders.find(r => r.noteId === note.id && !r.done);
  const titleText = escapeHtml(note.title || '未命名');
  const timeText = formatTime(note.updatedAt);
  let icon = SVG.note;
  if (note.filePath) icon = SVG.file;
  if (note.notemsKey) icon = SVG.notems;
  if (reminder) icon = SVG.alarm;
  item.innerHTML = `
    <span class="note-item-drag-handle">${SVG.drag}</span>
    <span class="note-item-icon">${icon}</span>
    <span class="note-item-title">${titleText}</span>
    <span class="note-item-time">${timeText}</span>
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
  return item;
}

function renderSidebar() {
  const list = document.getElementById('note-list');
  const seen = new Set();
  // 复用/创建/更新现有节点
  state.notes.forEach((note, idx) => {
    seen.add(note.id);
    let item = noteElCache.get(note.id);
    if (!item) {
      item = buildNoteItem(note);
      noteElCache.set(note.id, item);
    } else {
      // 更新 title / time / icon（className 由 updateSidebarItem 单独处理）
      const titleEl = item.querySelector('.note-item-title');
      const timeEl = item.querySelector('.note-item-time');
      const iconEl = item.querySelector('.note-item-icon');
      if (titleEl) titleEl.textContent = note.title || '未命名';
      if (timeEl) timeEl.textContent = formatTime(note.updatedAt);
      const reminder = state.reminders.find(r => r.noteId === note.id && !r.done);
      let icon = SVG.note;
      if (note.filePath) icon = SVG.file;
      if (note.notemsKey) icon = SVG.notems;
      if (reminder) icon = SVG.alarm;
      if (iconEl) iconEl.innerHTML = icon;
    }
    // 同步 active / multi-selected 状态
    let cls = 'note-item';
    if (note.id === state.selectedId) cls += ' active';
    if (state.multiSelected.has(note.id)) cls += ' multi-selected';
    item.className = cls;
    // 按 notes 顺序挂到正确位置
    if (list.children[idx] !== item) list.insertBefore(item, list.children[idx] || null);
  });
  // 移除已不存在的节点
  for (const [id, el] of noteElCache) {
    if (!seen.has(id)) {
      el.remove();
      noteElCache.delete(id);
    }
  }
  // 移除 list 末尾多余的孤儿（防御性，正常不应有）
  while (list.children.length > state.notes.length) {
    const last = list.lastChild;
    if (last) { noteElCache.delete(last.dataset.id); last.remove(); }
  }
  // 更新笔记计数
  const countEl = document.getElementById('sidebar-count');
  if (countEl) countEl.textContent = state.notes.length;
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
  hideUsage();
  if (state.multiMode) exitMultiSelect();
  state.selectedId = id;
  state.multiSelected.clear();
  setMainView('editor');
  renderSidebar();
  renderEditor(id);
  document.querySelectorAll('.note-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
}

// 防御：控制 .main 的 data-view 属性，确保只有 empty / editor / settings 之一可见
function setMainView(view) {
  const main = document.getElementById('main-content');
  if (main) main.setAttribute('data-view', view);
}

// ====== 编辑器 ======
function renderEditor(id) {
  const note = state.notes.find(n => n.id === id);
  const editor = document.getElementById('note-editor');
  const empty = document.getElementById('empty-state');
  const fabReminder = document.getElementById('fab-reminder');
  if (!note) {
    editor.style.display = 'none';
    empty.style.display = 'block';
    // 没有选中笔记时，隐藏 fab-reminder（仅在编辑器可见时显示）
    if (fabReminder) fabReminder.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  editor.style.display = 'flex';
  const titleEl = document.getElementById('note-title');
  titleEl.value = note.title || '';
  titleEl.readOnly = !!note.notemsKey;
  titleEl.style.cursor = note.notemsKey ? 'default' : '';
  // 显示文件路径
  let pathEl = document.getElementById('file-path-indicator');
  if (!pathEl) {
    pathEl = document.createElement('span');
    pathEl.id = 'file-path-indicator';
    titleEl.parentNode.insertBefore(pathEl, titleEl.nextSibling);
  }
  if (note.filePath) {
    pathEl.textContent = '📄 ' + note.filePath;
    pathEl.style.display = '';
  } else {
    pathEl.style.display = 'none';
  }
  // 销毁旧编辑器实例
  try { MarkdownEditor.destroy(); } catch (e) { console.warn('MarkdownEditor.destroy error:', e); }

  const bodyContainer = document.getElementById('note-body-container');
  const useMarkdown = isMarkdownEnabledForNote(note);
  try {
    MarkdownEditor.init(bodyContainer, note.body || '', useMarkdown);
  } catch (e) {
    console.error('MarkdownEditor.init error:', e);
    bodyContainer.innerHTML = '<textarea style="width:100%;height:100%;background:transparent;color:inherit;border:none;resize:none;padding:8px;font:inherit;">' + (note.body || '').replace(/</g, '&lt;') + '</textarea>';
  }

  // 同步模式切换按钮 UI（注意：updateModeToggleUI 可能在 setupEditor 之前就已被调用，
  // 用 typeof 防御；模块级定义见 setupEditor 上方）
  if (typeof updateModeToggleUI === 'function') {
    updateModeToggleUI(MarkdownEditor.getMode());
  }

  // 每次切换笔记后重新注册编辑器回调（因为 DOM 已被替换）
  registerEditorCallbacks();

  // 更新字数统计
  updateCharCount(note.body || '');

  // 同步 FAB-reminder 可见性（fabReminder 已在函数顶部声明）
  if (fabReminder) fabReminder.style.display = '';

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

  // Markdown 未开启时隐藏模式切换按钮和模式标识
  const footerToggle = document.getElementById('footer-mode-toggle');
  const noteModeEl = document.getElementById('note-mode');
  if (footerToggle) footerToggle.style.display = useMarkdown ? '' : 'none';
  if (noteModeEl) noteModeEl.style.display = useMarkdown ? '' : 'none';
}

function setupNewNote() {
  const btn = document.getElementById('btn-new-note');
  btn.addEventListener('click', () => {
    const note = { id: genNoteId(), title: '新笔记', body: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _autoTitled: false };
    state.notes.unshift(note);
    selectNote(note.id);
    scheduleSave();
  });
  // 右键弹出「获取 Notems 内容」
  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openNotemsDialog();
  });

  // 空状态里的"新建笔记"大按钮
  const btnEmptyNew = document.getElementById('btn-empty-new');
  if (btnEmptyNew) {
    btnEmptyNew.addEventListener('click', () => btn.click());
  }
}

// 自动生成标题（从正文第一行）
// BUG FIX: autoTitle should only run ONCE when body first gets content,
// not on every keystroke. Track with _autoTitled flag.
function autoTitle(note) {
  if (!note.body) return;
  const firstLine = note.body.split('\n')[0].trim();
  if (!firstLine) return;
  // 标题是默认值，或之前就是自动同步的 → 实时跟随第一行
  const isDefault = !note.title || note.title === '新笔记' || note.title === '未命名';
  if (!isDefault && !note._autoTitled) return; // 用户/AI改过，不覆盖
  note.title = firstLine;
  note._autoTitled = true;
  const titleInput = document.getElementById('note-title');
  if (titleInput) titleInput.value = firstLine;
  updateSidebarItem(note.id, firstLine);
}
function registerEditorCallbacks() {
  const bodyContainer = document.getElementById('note-body-container');
  if (!bodyContainer) return;
  MarkdownEditor.onChange(bodyContainer, () => {
    const note = state.notes.find(n => n.id === state.selectedId);
    if (!note) return;
    note.body = MarkdownEditor.getContent(bodyContainer);
    autoTitle(note);
    updateCharCount(note.body || '');
    scheduleSave();
  });

  // 滚动到底按钮 — 重新附着滚动监听
  const btnScrollBottom = document.getElementById('btn-scroll-bottom');
  if (!btnScrollBottom) return;
  const getScrollEl = () => MarkdownEditor.getScrollTarget(bodyContainer);

  // 移除旧监听（如果存在）
  if (btnScrollBottom._scrollHandler) {
    const oldEl = getScrollEl();
    if (oldEl) oldEl.removeEventListener('scroll', btnScrollBottom._scrollHandler);
  }

  const attachScroll = () => {
    const scrollEl = getScrollEl();
    if (!scrollEl) return;
    btnScrollBottom._scrollHandler = () => {
      const threshold = 50;
      const atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - threshold;
      const scrollable = scrollEl.scrollHeight > scrollEl.clientHeight + 10;
      btnScrollBottom.classList.toggle('visible', scrollable && !atBottom);
    };
    scrollEl.addEventListener('scroll', btnScrollBottom._scrollHandler);
    // 初始检测
    btnScrollBottom._scrollHandler();
    btnScrollBottom.classList.remove('visible');
    requestAnimationFrame(() => {
      const st = getScrollEl();
      if (st && st.scrollHeight > st.clientHeight + 10) {
        btnScrollBottom.classList.add('visible');
      }
    });
  };
  // 延迟附加滚动监听，等编辑器渲染完成
  // A6 修复：每次切换笔记前先清掉旧 timer，避免快速切换时多次重复 attach
  if (btnScrollBottom._scrollTimer) clearTimeout(btnScrollBottom._scrollTimer);
  btnScrollBottom._scrollTimer = setTimeout(attachScroll, 300);
}

function setupEditor() {
  const title = document.getElementById('note-title');

  title.addEventListener('input', () => {
    const note = state.notes.find(n => n.id === state.selectedId);
    if (!note || note.notemsKey) return;
    note.title = title.value || '未命名';
    // Manual title edit resets auto-title flag so we don't override
    note._autoTitled = true;
    scheduleSave(); updateSidebarItem(note.id, note.title);
    note._autoTitled = false; // 手动编辑后停止自动同步
  });
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
      // 同时导出当前笔记为 .md 到用户个人文件夹
      if (note) {
        const exportName = note.title || '未命名';
        window.electronAPI.exportMarkdownFile(exportName, note.body || '').then(result => {
          if (result && result.ok) {
            if (status) status.textContent = '已保存到 ' + result.path;
          }
        });
      }
      if (note && note.notemsKey) {
        window.electronAPI.setNotemsContent(note.notemsKey, note.body).then(ok => {
          if (ok) { if (status) status.textContent = '已同步到 note.ms'; }
          else { if (status) status.textContent = 'note.ms 同步失败'; }
        });
      }
    });
  });

  // ====== 滚动到底按钮点击（按钮是静态的，只需注册一次） ======
  const btnScrollBottom = document.getElementById('btn-scroll-bottom');
  if (btnScrollBottom) {
    btnScrollBottom.addEventListener('click', () => {
      const bodyContainer = document.getElementById('note-body-container');
      const scrollEl = MarkdownEditor.getScrollTarget(bodyContainer);
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

  // A1 修复：使用显式的 outsideHandler 变量管理 document.click 监听，
  // 避免原来"let closePicker = ... + setTimeout 内重新赋值"那种不直观的模式
  let pickerOutsideHandler = null;
  function dismissPicker() {
    picker.style.display = 'none';
    if (pickerOutsideHandler) {
      document.removeEventListener('click', pickerOutsideHandler);
      pickerOutsideHandler = null;
    }
  }
  function attachPickerOutsideClose() {
    if (pickerOutsideHandler) return; // 已注册则跳过
    pickerOutsideHandler = (e) => {
      if (!picker.contains(e.target) && e.target !== btnReminder) {
        dismissPicker();
      }
    };
    // 延迟一帧注册，避免本次打开 picker 的点击事件立刻被自己消费
    setTimeout(() => document.addEventListener('click', pickerOutsideHandler), 0);
  }

  btnReminder.addEventListener('click', (e) => {
    e.stopPropagation();
    const now = new Date();
    resetCalendar(now);
    picker.style.display = 'flex';
    attachPickerOutsideClose();
  });
  btnSet.addEventListener('click', async () => {
    const dt = getPickerDateTime();
    if (!dt || isNaN(dt.getTime())) return;
    dismissPicker();
    const reminder = await window.electronAPI.setReminder(state.selectedId, dt.toISOString());
    state.reminders.push(reminder);
    renderEditor(state.selectedId);
    renderSidebar();
  });
  btnCancel.addEventListener('click', () => {
    dismissPicker();
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

  // ====== 模式切换按钮（底部栏）======
  const btnToggleMode = document.getElementById('btn-toggle-mode');
  const iconSource = document.getElementById('icon-edit-mode');     // 用同一个 SVG id 但语义是 source
  const iconPreview = document.getElementById('icon-preview-mode');
  const modeLabel = document.getElementById('mode-toggle-label');
  const noteModeDisplay = document.getElementById('note-mode');

  // 注：updateModeToggleUI 是模块级函数（定义在 setupEditor 上方），
  // 因为 renderEditor 会在 init() 早期就调用它，那时 setupEditor 还没执行。

  if (btnToggleMode) {
    btnToggleMode.addEventListener('click', () => {
      const current = MarkdownEditor.getMode();
      const next = current === 'source' ? 'preview' : 'source';
      MarkdownEditor.setMode(next);
      updateModeToggleUI(next);
    });
  }

  // 监听 markdown-editor 内部模式变化（如初始化时）
  window.addEventListener('editor-mode-changed', (e) => {
    updateModeToggleUI(e.detail.mode);
  });
}

// 模块级：模式切换按钮 UI 同步函数（每次都重新查询 DOM，避免闭包捕获过期元素）
function updateModeToggleUI(mode) {
  const iconSource = document.getElementById('icon-edit-mode');
  const iconPreview = document.getElementById('icon-preview-mode');
  const modeLabel = document.getElementById('mode-toggle-label');
  const noteModeDisplay = document.getElementById('note-mode');
  const btnToggleMode = document.getElementById('btn-toggle-mode');
  if (mode === 'source') {
    // 当前在源码模式 → 按钮提示「点我去预览」
    if (iconSource) iconSource.style.display = '';
    if (iconPreview) iconPreview.style.display = 'none';
    if (modeLabel) modeLabel.textContent = '预览';
    if (noteModeDisplay) noteModeDisplay.textContent = '源码';
    if (btnToggleMode) btnToggleMode.classList.remove('active');
  } else {
    // 当前在预览模式 → 按钮提示「点我回源码」
    if (iconSource) iconSource.style.display = 'none';
    if (iconPreview) iconPreview.style.display = '';
    if (modeLabel) modeLabel.textContent = '源码';
    if (noteModeDisplay) noteModeDisplay.textContent = '渲染';
    if (btnToggleMode) btnToggleMode.classList.add('active');
  }
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
  // B6 修复：原 -40px 是 magic number（容器高 140px，左右各 4 个 24px 项 + 选中 28px 居中需要 -15px，
  // 旧值 -40px 是为放大选中项预留了视觉空间）。改为读 CSS 变量 --tw-center-offset
  container.style.marginTop = 'var(--tw-center-offset, -40px)';
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
    // B12 修复：原 wheel 事件直接更新 state + renderTimeWheel()，快速滚动会触发 N 次 setState。
    // 用 requestAnimationFrame 节流 + 累加 deltaY 防止单次大滚动跳过多个值
    let rafId = null;
    let pendingDelta = 0;
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      pendingDelta += e.deltaY;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        // 一次 raf 内累积的滚动量：每 100px 跳一格
        const steps = Math.sign(pendingDelta) * Math.min(3, Math.max(1, Math.abs(pendingDelta) / 100 | 0));
        const current = col.getter();
        const next = ((current + steps * col.step) % col.max + col.max) % col.max;
        col.setter(next);
        pendingDelta = 0;
      });
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
  // Sync editor content to note.body before scheduling, so snapshot is fresh
  const bodyContainer = document.getElementById('note-body-container');
  const currentNote = state.notes.find(n => n.id === state.selectedId);
  if (currentNote && bodyContainer) {
    currentNote.body = MarkdownEditor.getContent(bodyContainer);
  }
  // A7 修复：调度时立刻快照当前选中笔记和filePath，
  // 避免 500ms 延迟期间用户切走笔记导致 saveFile 写到错误文件
  const snapshotId = state.selectedId;
  const snapshotNote = state.notes.find(n => n.id === snapshotId);
  const snapshotFilePath = snapshotNote ? snapshotNote.filePath : null;
  const snapshotBody = snapshotNote ? snapshotNote.body : null;
  saveTimer = setTimeout(async () => {
    await window.electronAPI.saveData({ notes: state.notes, reminders: state.reminders.filter(r => !r.done), settings: settings });
    if (snapshotFilePath) {
      // 用快照时的 body 和 filePath 写入，不读最新的 state.selectedId
      const ok = await window.electronAPI.saveFile(snapshotFilePath, snapshotBody || '');
      if (status) status.textContent = ok ? '已保存到文件' : '文件保存失败';
    } else {
      if (status) status.textContent = '已自动保存';
    }


  }, 500);
}

function updateSidebarItem(id, title) {
  const item = document.querySelector(`.note-item[data-id="${id}"]`);
  if (item) { const s = item.querySelector('.note-item-title'); if (s) s.textContent = title; }
}

function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

// A3 修复：原 Date.now().toString() 1ms 内连建会撞 id。改用时间戳 + 随机后缀
function genNoteId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

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

// ====== 字数统计 ======
function updateCharCount(text) {
  const el = document.getElementById('note-charcount');
  if (!el) return;
  const len = (text || '').replace(/\s/g, '').length;
  el.textContent = len + ' 字';
}

// ====== 不透明度滑块 ======
function applyPanelAlpha(percent) {
  const root = document.documentElement;
  const alpha = Math.max(0.05, Math.min(1, percent / 100));
  const currentTheme = root.getAttribute('data-theme');
  const currentMode = root.getAttribute('data-mode') || 'light';
  const isDarkMode = currentMode === 'dark';
  const flag = isFlagTheme(currentTheme) ? FLAG_THEMES[currentTheme] : null;

  // 关键：先清掉 --titlebar-bg 的 inline 覆写
  // 防止状态泄漏：默认主题分支写过 inline rgba(...)，切到旗帜主题时
  // inline 会屏蔽 CSS 里的 linear-gradient，导致条带消失。
  // 默认主题分支会重新设这个变量；旗帜主题分支通过 return 保留 CSS 规则
  root.style.removeProperty('--titlebar-bg');

  // 模糊联动：alpha 越低 → blur 越强
  const blurFactor = (0.05 - alpha) * (-1 / 0.95) + 1;
  root.style.setProperty('--panel-alpha-factor', blurFactor.toFixed(3));

  if (flag) {
    // 旗帜主题：用当前 mode 的基础色 + 用户 alpha
    const modeKey = isDarkMode ? 'dark' : 'light';
    // 浅色旗帜：侧栏用主区域基础色（更亮更不透明），保证文字可读；
    //          暗色旗帜：保持原旗帜色调（深色背景下橙/青有强对比）
    const sidebarRgb = isDarkMode ? flag.sidebar[modeKey] : flag.main[modeKey];
    const sidebarA = isDarkMode ? alpha * 0.85 : Math.max(alpha * 0.85, 0.55);
    const mainA = Math.max((isDarkMode ? alpha : alpha * 0.92), 0.10);
    root.style.setProperty('--sidebar-bg', `rgba(${sidebarRgb}, ${sidebarA})`);
    root.style.setProperty('--main-bg', `rgba(${flag.main[modeKey]}, ${mainA})`);
    // 标题栏保留 CSS 里的 linear-gradient（不被覆盖）
    return;
  }

  // 默认主题：按 data-mode 选基础色（必须用 data-mode，不能用模块级 isDark，
  // 否则 cycleMode 切换后 isDark 仍指向 init 时的值，背景永远是错色）
  const mainAlpha = Math.max(alpha - 0.07, 0.05);
  const barAlpha = Math.min((isDarkMode ? alpha + 0.07 : alpha + 0.1), 1);
  if (isDarkMode) {
    root.style.setProperty('--sidebar-bg', `rgba(28, 28, 28, ${alpha})`);
    root.style.setProperty('--main-bg', `rgba(36, 36, 36, ${mainAlpha})`);
    root.style.setProperty('--titlebar-bg', `rgba(28, 28, 28, ${barAlpha})`);
  } else {
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
    hideUsage();
    settingsOpen = true;
    // 侧栏切换
    sidebarHeader.style.display = 'none';
    noteList.style.display = 'none';
    settingsNav.style.display = 'flex';
    // 主区域切换 —— 用 data-view + inline style 双保险
    setMainView('settings');
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
    if (state.selectedId) {
      setMainView('editor');
      renderEditor(state.selectedId);
    } else {
      setMainView('empty');
      document.getElementById('empty-state').style.display = 'flex';
    }
  }

  function switchSettingsSection(section) {
    // 高亮导航
    document.querySelectorAll('.settings-nav-item').forEach(i =>
      i.classList.toggle('active', i.dataset.section === section));
    // 切换页面 —— 用 .active class 控制，配合 CSS 防御
    document.querySelectorAll('.settings-page').forEach(p => {
      p.classList.remove('active');
      p.style.display = 'none';
    });
    const page = document.getElementById('section-' + section);
    if (page) {
      page.classList.add('active');
      page.style.display = 'flex';
    }
    // 同步高亮选项
    document.querySelectorAll('.settings-option[data-action="theme"]').forEach(b =>
      b.classList.toggle('active', b.dataset.value === currentThemePref));
    document.querySelectorAll('.settings-option[data-action="mode"]').forEach(b =>
      b.classList.toggle('active', b.dataset.value === currentModePref));
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
    if (section === 'shortcut') {
      loadShortcutInput();
    }
    if (section === 'customcss') {
      loadCustomCSS();
    }
  }

  // ====== 快捷键设置 ======
  let shortcutKeys = [];

  async function loadShortcutInput() {
    const input = document.getElementById('shortcut-input');
    const status = document.getElementById('shortcut-status');
    if (!input) return;
    try {
      const acc = await window.electronAPI.getShortcut();
      // 显示格式：CommandOrControl+Shift+K → Ctrl+Shift+K
      input.value = acc
        .replace('CommandOrControl', 'Ctrl')
        .replace('Command', 'Cmd')
        .replace('+', ' + ');
      if (status) status.textContent = '点击输入框后按下新快捷键组合';
    } catch (e) {
      input.value = '加载失败';
    }
  }

  function keysToDisplay(keys) {
    return keys
      .map(k => {
        if (k === 'CommandOrControl') return 'Ctrl';
        return k.length === 1 ? k.toUpperCase() : k;
      })
      .join(' + ');
  }

  function keysToAccelerator(keys) {
    return keys.join('+');
  }

  const shortcutInput = document.getElementById('shortcut-input');
  if (shortcutInput) {
    shortcutInput.addEventListener('keydown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      shortcutKeys = [];
      if (e.ctrlKey || e.metaKey) shortcutKeys.push('CommandOrControl');
      if (e.altKey) shortcutKeys.push('Alt');
      if (e.shiftKey) shortcutKeys.push('Shift');
      const key = e.key;
      // 忽略纯修饰键
      if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') return;
      shortcutKeys.push(key.length === 1 ? key.toUpperCase() : key);
      shortcutInput.value = keysToDisplay(shortcutKeys);
    });

    shortcutInput.addEventListener('focus', () => {
      shortcutKeys = [];
      shortcutInput.value = '';
    });
  }

  const btnSaveShortcut = document.getElementById('btn-save-shortcut');
  if (btnSaveShortcut) {
    btnSaveShortcut.addEventListener('click', async () => {
      const input = document.getElementById('shortcut-input');
      const status = document.getElementById('shortcut-status');
      if (!shortcutKeys.length || !input.value.trim()) {
        if (status) status.textContent = '请先点击输入框并按下快捷键组合';
        return;
      }
      const acc = keysToAccelerator(shortcutKeys);
      const ok = await window.electronAPI.setShortcut(acc);
      if (ok) {
        if (status) status.textContent = '✓ 已保存：' + keysToDisplay(shortcutKeys);
        input.value = keysToDisplay(shortcutKeys);
      } else {
        if (status) status.textContent = '✗ 注册失败，请尝试其他组合';
      }
    });
  }

  // ⚙ 切换设置
  document.getElementById('btn-usage')?.addEventListener('click', showUsage);

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
      currentThemePref = btn.dataset.value;       // 本地立即更新
      applyTheme();                                // 立即重渲染
      applyPanelAlpha(currentPanelAlpha);
      window.electronAPI.setTheme(btn.dataset.value);  // 持久化（异步）
      document.querySelectorAll('.settings-option[data-action="theme"]').forEach(b =>
        b.classList.toggle('active', b.dataset.value === btn.dataset.value));
    });
  });

  // 模式切换（独立于主题）
  document.querySelectorAll('.settings-option[data-action="mode"]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentModePref = btn.dataset.value;        // 本地立即更新
      applyTheme();                                // 立即重渲染
      applyPanelAlpha(currentPanelAlpha);
      window.electronAPI.setMode(btn.dataset.value);  // 持久化 + 通知 OS
      document.querySelectorAll('.settings-option[data-action="mode"]').forEach(b =>
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
        registerEditorCallbacks();
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
        registerEditorCallbacks();
      }
    }
  });

  // ====== 自定义 CSS ======
  let customCssStyleEl = null;

  function getDefaultCSS() {
    // 返回一个简化版默认样式说明，用户可参照编写自定义 CSS
    return `/* QuickMemo 自定义 CSS 示例 */
/* 可覆盖 styles.css 中的任何样式 */

/* 示例：修改编辑器背景色 */
/* .md-editor { background: rgba(255,255,255,0.05); } */

/* 示例：修改标题字体大小 */
/* .editor-title { font-size: 26px; } */

/* 示例：修改侧栏宽度 */
/* #sidebar { width: 320px; } */

/* 示例：修改强调色为紫色 */
/* :root { --accent: #8b5cf6; } */`;
  }

  function applyCustomCSS(css) {
    if (!customCssStyleEl) {
      customCssStyleEl = document.createElement('style');
      customCssStyleEl.id = 'user-custom-css';
      document.head.appendChild(customCssStyleEl);
    }
    customCssStyleEl.textContent = css || '';
  }

  function loadCustomCSS() {
    const textarea = document.getElementById('custom-css-input');
    if (!textarea) return;
    // 初始化显示默认模板或已保存的 CSS
    const saved = settings.customCSS || '';
    textarea.value = saved || getDefaultCSS();
  }

  function saveCustomCSS(css) {
    settings.customCSS = css;
    applyCustomCSS(css);
    updateStoredSettings();
  }

  const customCssInput = document.getElementById('custom-css-input');
  if (customCssInput) {
    // 实时预览：每次输入都应用（带防抖）
    let cssTimer = null;
    customCssInput.addEventListener('input', () => {
      clearTimeout(cssTimer);
      cssTimer = setTimeout(() => {
        applyCustomCSS(customCssInput.value);
      }, 200);
    });

    customCssInput.addEventListener('keydown', (e) => {
      // Tab 键插入两个空格
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = customCssInput.selectionStart;
        const end = customCssInput.selectionEnd;
        customCssInput.value = customCssInput.value.substring(0, start) + '  ' + customCssInput.value.substring(end);
        customCssInput.selectionStart = customCssInput.selectionEnd = start + 2;
        customCssInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  const btnSaveCss = document.getElementById('btn-save-css');
  if (btnSaveCss) {
    btnSaveCss.addEventListener('click', () => {
      const css = document.getElementById('custom-css-input').value;
      saveCustomCSS(css);
      showToastMessage('自定义 CSS 已保存并应用');
    });
  }

  const btnResetCss = document.getElementById('btn-reset-css');
  if (btnResetCss) {
    btnResetCss.addEventListener('click', () => {
      const textarea = document.getElementById('custom-css-input');
      if (textarea) textarea.value = getDefaultCSS();
      applyCustomCSS(getDefaultCSS());
    });
  }

  // 应用已保存的 CSS（初始化时加载）
  if (settings.customCSS) {
    setTimeout(() => applyCustomCSS(settings.customCSS), 100);
  }

}
// ====== Toast 通知 =====
function showToast(message, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast' + (type ? ' toast-' + type : '');
  toast.textContent = message;
  container.appendChild(toast);
  // 触发进入动画
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  // 每个 toast 独立管理自己的生命周期，互不干扰
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showToastMessage(text) {
  const status = document.getElementById('note-status');
  if (!status) return;
  const orig = status.textContent;
  status.textContent = text;
  status.style.color = 'var(--accent)';
  setTimeout(() => {
    status.textContent = orig;
    status.style.color = '';
  }, 2500);
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
      id: genNoteId(),
      title: key,
      body: content,
      notemsKey: key,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _autoTitled: true, // notems notes have fixed title
    };
    state.notes.unshift(note);
    selectNote(note.id);
    scheduleSave();
    close();
    confirmBtn.disabled = false;
    confirmBtn.textContent = '获取';
  };
}

// ====== 侧栏拖拽手柄：调整宽度并持久化到 settings ======
const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT = 280;

function applySidebarWidth(width) {
  const w = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Math.round(width)));
  const app = document.getElementById('app-container');
  if (app) app.style.setProperty('--sidebar-width', `${w}px`);
  // resizer 位置 = 侧栏宽（用 CSS 变量同步，避免 JS 计算误差）
  const resizer = document.getElementById('sidebar-resizer');
  if (resizer) resizer.style.left = `${w}px`;
  return w;
}

function setupSidebarResizer() {
  const resizer = document.getElementById('sidebar-resizer');
  if (!resizer) return;

  // 初始化：从 settings 恢复；无则用默认
  const initial = (settings && typeof settings.sidebarWidth === 'number')
    ? settings.sidebarWidth
    : SIDEBAR_DEFAULT;
  applySidebarWidth(initial);

  let dragging = false;
  let startX = 0;
  let startWidth = 0;

  const onPointerDown = (e) => {
    dragging = true;
    startX = e.clientX;
    const app = document.getElementById('app-container');
    startWidth = app ? parseFloat(getComputedStyle(app).getPropertyValue('--sidebar-width')) || SIDEBAR_DEFAULT : SIDEBAR_DEFAULT;
    resizer.classList.add('dragging');
    document.body.classList.add('resizing');
    try { resizer.setPointerCapture(e.pointerId); } catch {}
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    const delta = e.clientX - startX;
    applySidebarWidth(startWidth + delta);
  };
  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.classList.remove('resizing');
    try { resizer.releasePointerCapture(e.pointerId); } catch {}
    // 持久化到 settings
    const app = document.getElementById('app-container');
    if (app) {
      const w = parseFloat(getComputedStyle(app).getPropertyValue('--sidebar-width')) || SIDEBAR_DEFAULT;
      settings.sidebarWidth = w;
      scheduleSave();
    }
  };

  resizer.addEventListener('pointerdown', onPointerDown);
  resizer.addEventListener('pointermove', onPointerMove);
  resizer.addEventListener('pointerup', onPointerUp);
  resizer.addEventListener('pointercancel', onPointerUp);

  // 双击重置为默认宽度
  resizer.addEventListener('dblclick', () => {
    applySidebarWidth(SIDEBAR_DEFAULT);
    settings.sidebarWidth = SIDEBAR_DEFAULT;
    scheduleSave();
  });
}



// ====== Usage Stats (Tokdash) ======
let _usageServerRunning = false;
let _usageData = null;
let _usagePeriod = "today";
const _periodLabels = { today:"今日", "7d":"近7日", "30d":"近30日", month:"本月" };

function showUsage() {
  var u = document.getElementById("usage-section");
  var e = document.getElementById("empty-state");
  var ed = document.getElementById("note-editor");
  var s = document.getElementById("settings-section");
  if (e) e.style.display = "none";
  if (ed) ed.style.display = "none";
  if (s) s.style.display = "none";
  if (u) { u.style.display = "block"; setMainView("usage"); if (!_usageServerRunning) { renderUsage(); window.electronAPI.tokdashFetch("/api/stats").then(function(r) { if (r && !r.error) { _usageServerRunning = true; renderUsage(); } }); } else { renderUsage(); } }
}

function hideUsage() {
  var u = document.getElementById("usage-section");
  if (u) u.style.display = "none";
}

function fmtTok(v) {
  if (v == null) return "—";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return Math.round(v).toLocaleString();
}

function fmtCost(v) {
  if (v == null) return "—";
  if (v < 0.01) return "$" + v.toFixed(4);
  return "$" + v.toFixed(2);
}

function fmtPct(v) {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

function renderUsage() {
  var c = document.getElementById("usage-section");
  if (!c) return;

  if (!_usageServerRunning) {
    c.innerHTML =
      '<div class="usage-server-notice">' +
      '<div class="notice-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div>' +
      '<div class="notice-title">数据服务未启动</div>' +
      '<div class="notice-desc">需要启动 Tokdash 数据服务来读取 AI 工具的使用统计。数据来自 Claude Code / Codex 的本地日志。</div>' +
      '<button class="btn btn-primary" id="btn-start-tokdash-server">启动数据服务</button>' +
      '</div>';
    return;
  }

  c.innerHTML = '<div class="usage-loading"><div class="usage-spinner"></div><div class="usage-loading-text">加载中…</div></div>';

  Promise.all([
    window.electronAPI.tokdashFetch("/api/usage?period=" + _usagePeriod),
    window.electronAPI.tokdashFetch("/api/stats"),
  ])
  .then(function(results) {
    var d = results[0], st = results[1];
    if (!d || d.error) {
      _usageServerRunning = false;
      renderUsage();
      return;
    }
    var t = d.total_tokens || 0;
    var cost = d.total_cost || 0;
    var msgs = d.total_messages || 0;
    var comp = d.comparison || {};
    var models = d.top_models || d.coding_models || d.combined_models || [];
    var days = st.contributions || [];
    var now2 = new Date();
    var cutoff = new Date(now2);
    if (_usagePeriod === "7d") cutoff.setDate(now2.getDate() - 7);
    else if (_usagePeriod === "30d") cutoff.setDate(now2.getDate() - 30);
    else if (_usagePeriod === "month") cutoff = new Date(now2.getFullYear(), now2.getMonth(), 1);
    else if (_usagePeriod === "today") cutoff = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate());

    function chg(v, prev) {
      if (prev == null || prev === 0) return '<div class="usage-kpi-change neutral">—</div>';
      var p = ((v - prev) / prev * 100).toFixed(1);
      var dir = p >= 0 ? "up" : "down";
      var sym = p >= 0 ? "↑" : "↓";
      if (Math.abs(p) > 999) return '<div class="usage-kpi-change ' + dir + '">' + sym + " 999+%</div>";
      return '<div class="usage-kpi-change ' + dir + '">' + sym + " " + Math.abs(p) + "%</div>";
    }

    function periodBtn(p) {
      return '<button class="usage-period-btn' +
        (_usagePeriod === p ? " active" : "") +
        '" data-period="' + p + '">' +
        (_periodLabels[p] || p) + "</button>";
    }

    var btns = ["today","7d","30d","month"].map(periodBtn).join("");

    var mh = "";
    if (!models || models.length === 0) {
      mh = '<div class="usage-empty"><p>暂无模型数据</p></div>';
    } else {
      var maxCost = Math.max.apply(null, models.map(function(m) { return m.cost || 0; }));
      mh = models.map(function(m) {
        var pw = maxCost > 0 ? (m.cost / maxCost * 100) : 0;
        return '<div class="usage-model-row">' +
          '<span class="usage-model-name">' + m.name + "</span>" +
          '<div class="usage-model-bar"><div class="usage-model-bar-fill" style="width:' + pw + '%"></div></div>' +
          '<span class="usage-model-pct">' +
          (d.total_cost > 0 ? (m.cost / d.total_cost * 100).toFixed(1) : "0") + "%</span>" +
          '<span class="usage-model-cost">' + fmtCost(m.cost) + "</span>" +
          "</div>";
      }).join("");
    }

    var pct = d.cache_hit_rate || 0;

    var gh = "";
    // Full-year GitHub-style contribution grid (53 weeks)
    var nowDate = new Date();
    var startDate = new Date(nowDate);
    startDate.setDate(startDate.getDate() - 370);
    var sd = startDate.getDay() || 7;
    if (sd > 1) startDate.setDate(startDate.getDate() - (sd - 1));
    var dayMap = {};
    if (st && st.contributions) {
      st.contributions.forEach(function(e) { dayMap[e.date] = e; });
    }
    var weeks = [];
    var cursor = new Date(startDate);
    for (var w = 0; w < 53; w++) {
      var wk = [];
      for (var d = 0; d < 7; d++) {
        var y = cursor.getFullYear();
        var m = String(cursor.getMonth() + 1).padStart(2, "0");
        var dd = String(cursor.getDate()).padStart(2, "0");
        var ds = y + "-" + m + "-" + dd;
        var en = dayMap[ds] || null;
        if (en) {
          var tk2 = (en.totals && en.totals.tokens) || en.total_tokens || 0;
          var lv = tk2 === 0 ? "empty" : tk2 > 50000000 ? "lv6" : tk2 > 5000000 ? "lv5" : tk2 > 500000 ? "lv4" : tk2 > 50000 ? "lv3" : tk2 > 5000 ? "lv2" : "lv1";
          wk.push({ date: ds, tokens: tk2, level: lv, month: cursor.getMonth(), year: y });
        } else { wk.push(null); }
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(wk);
    }
    gh += '<div class="gh-grid">';
    gh += '<div class="gh-months">';
    var mn = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
    var lm = -1;
    weeks.forEach(function(w, wi) {
      for (var r = 0; r < 7; r++) {
        if (w[r] && w[r].month !== lm) {
          gh += '<span class="gh-month-label" style="grid-row:1;grid-column:' + (wi + 2) + ';">' + mn[w[r].month] + '</span>';
          lm = w[r].month; break;
        }
      }
    });
    gh += '</div>';
    var dl = ["","一","","三","","五",""];
    for (var row = 0; row < 7; row++) {
      if (dl[row]) {
        gh += '<div class="gh-dow" style="grid-row:' + (row + 2) + ';grid-column:1;">' + dl[row] + '</div>';
      }
      weeks.forEach(function(w, wi) {
        var cell = w[row] || null;
        if (!cell) {
          gh += '<div class="gh-cell empty" style="grid-row:' + (row + 2) + ';grid-column:' + (wi + 2) + ';"></div>';
          return;
        }
        gh += '<div class="gh-cell ' + cell.level + '" style="grid-row:' + (row + 2) + ';grid-column:' + (wi + 2) + ';" title="' + cell.date + ': ' + fmtTok(cell.tokens) + ' tok"></div>';
      });
    }
    gh += '</div>';
    gh += '<div class="gh-footer">';
    gh += '<span class="gh-legend-label">少</span>';
    ["empty","lv1","lv2","lv3","lv4","lv5","lv6"].forEach(function(l) { gh += '<div class="gh-legend-cell ' + l + '"></div>'; });
    gh += '<span class="gh-legend-label">多</span></div>';
    c.innerHTML =
      '<div class="usage-header">' +
      '<h2>使用统计</h2>' +
      '<div class="usage-period-select">' + btns + "</div>" +
      "</div>" +
      '<div class="usage-kpis">' +
      '<div class="usage-kpi-card">' +
      '<div class="usage-kpi-label">Token</div>' +
      '<div class="usage-kpi-value">' + fmtTok(t) + "</div>" + chg(t, comp.tokens_prev) +
      "</div>" +
      '<div class="usage-kpi-card">' +
      '<div class="usage-kpi-label">花费</div>' +
      '<div class="usage-kpi-value">' + fmtCost(cost) + "</div>" + chg(cost, comp.cost_prev) +
      "</div>" +
      '<div class="usage-kpi-card">' +
      '<div class="usage-kpi-label">消息</div>' +
      '<div class="usage-kpi-value">' + msgs.toLocaleString() + "</div>" + chg(msgs, comp.messages_prev) +
      "</div>" +
      '<div class="usage-kpi-card">' +
      '<div class="usage-kpi-label">缓存命中</div>' +
      '<div class="usage-kpi-value">' + fmtPct(pct) + "</div>" +
      '<div class="usage-kpi-sub">' + (Object.keys(d.by_tool || {}).length) + " 个来源</div>" +
      "</div>" +
      "</div>" +
      '<div class="usage-section-card"><h3>使用日历</h3><div class="usage-grid">' + gh + "</div></div>" +
      '<div class="usage-section-card"><h3>模型消耗排行</h3>' + mh + "</div>";
    // Auto-scroll grid to show most recent days
    setTimeout(function() {
      var gridEl = c.querySelector('.usage-grid');
      if (gridEl) gridEl.scrollLeft = gridEl.scrollWidth;
    }, 100);
  })
  .catch(function() { _usageServerRunning = false; renderUsage(); });
}

function setupUsage() {
  document.getElementById("usage-section").addEventListener("click", function(e) {
    var pb = e.target.closest(".usage-period-btn");
    if (pb) { _usagePeriod = pb.dataset.period; renderUsage(); return; }
    var sb = e.target.closest("#btn-start-tokdash-server");
    if (sb) {
      sb.disabled = true;
      sb.textContent = "启动中…";
      window.electronAPI.startTokdashServer().then(function(result) {
        if (result && result.ok) {
          _usageServerRunning = true;
          renderUsage();
        } else {
          document.getElementById("usage-section").innerHTML =
            '<div class="usage-server-notice"><div class="notice-title">启动失败</div>' +
            '<div class="notice-desc">' + (result && result.error ? result.error : "服务启动超时，请检查 Python / uvicorn 是否安装") + '</div>' +
            '<button class="btn btn-primary" id="btn-start-tokdash-server">重试</button></div>';
        }
      })
      .catch(function(err) {
        document.getElementById("usage-section").innerHTML =
          '<div class="usage-server-notice"><div class="notice-title">启动失败</div>' +
          '<div class="notice-desc">' + (err && err.message ? err.message : "IPC调用失败") + '</div>' +
          '<button class="btn btn-primary" id="btn-start-tokdash-server">重试</button></div>';
      });
    }
  });
}

init();




