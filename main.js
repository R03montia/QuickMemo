const { app, BrowserWindow, ipcMain, Notification, nativeTheme, systemPreferences, Tray, Menu, nativeImage, net, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(__dirname, 'data', 'notes.json');
const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Q';
let mainWindow = null;
let tray = null;
let reminderTimers = new Map();

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ notes: [], reminders: [], settings: { theme: 'system', appearance: 'bordered', panelAlpha: 82 } }), 'utf-8');
  }
}

function readData() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return { notes: [], reminders: [], settings: { theme: 'system', appearance: 'bordered', panelAlpha: 82 } };
  }
}

function writeData(data) {
  if (!data.settings) data.settings = { theme: 'system', appearance: 'bordered', panelAlpha: 82 };
  if (data.settings.panelAlpha === undefined) data.settings.panelAlpha = 82;
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getAccentColor() {
  try {
    if (process.platform === 'win32' && systemPreferences.getAccentColor) {
      const hex = systemPreferences.getAccentColor();
      return '#' + hex;
    }
  } catch {}
  return '#005fb8';
}

function scheduleReminders() {
  for (const [id, timer] of reminderTimers) { clearTimeout(timer); }
  reminderTimers.clear();
  const data = readData();
  const now = Date.now();
  for (const reminder of data.reminders) {
    if (reminder.done) continue;
    const t = new Date(reminder.time).getTime();
    const delay = t - now;
    if (delay > 0) {
      const timer = setTimeout(() => {
        const note = data.notes.find(n => n.id === reminder.noteId);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
        new Notification({
          title: 'QuickMemo 提醒',
          body: note ? note.title : '你有新的提醒事项',
          silent: false,
        }).show();
        reminder.done = true;
        writeData(data);
      }, delay);
      reminderTimers.set(reminder.id, timer);
    }
  }
}

// ====== 全局快捷键 ======
function getShortcut() {
  const data = readData();
  return (data.settings && data.settings.shortcut) || DEFAULT_SHORTCUT;
}

// ====== .md 文件打开 ======
function getMdFileFromArgs(argv) {
  if (!argv) return null;
  for (const arg of argv) {
    if (arg.endsWith('.md') || arg.endsWith('.markdown') || arg.endsWith('.txt')) {
      return arg;
    }
  }
  return null;
}

function openMdFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const name = path.basename(filePath, path.extname(filePath));
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('open-md-file', {
        path: filePath,
        name: name,
        content: content,
      });
    }
  } catch (e) {
    console.warn('QuickMemo: failed to open file', filePath, e.message);
  }
}

function registerGlobalShortcut(accelerator) {
  globalShortcut.unregisterAll();
  try {
    const ok = globalShortcut.register(accelerator, () => {
      toggleWindow();
    });
    if (!ok) {
      console.warn('QuickMemo: failed to register shortcut', accelerator);
    }
  } catch (e) {
    console.warn('QuickMemo: shortcut registration error', e.message);
  }
}

function setShortcut(accelerator) {
  const d = readData();
  d.settings = d.settings || {};
  d.settings.shortcut = accelerator;
  writeData(d);
  registerGlobalShortcut(accelerator);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shortcut-changed', accelerator);
  }
}

// ====== 主题管理 ======
function getThemePreference() {
  const data = readData();
  return (data.settings && data.settings.theme) || 'system';
}

function setTheme(theme) {
  const d = readData();
  d.settings = d.settings || {};
  d.settings.theme = theme;
  writeData(d);
  nativeTheme.themeSource = theme;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('theme-changed', {
      accent: getAccentColor(),
      dark: nativeTheme.shouldUseDarkColors,
      theme: theme,
    });
  }
  updateTrayMenu();
}

// ====== 外观管理 ======
function getAppearance() {
  const data = readData();
  return (data.settings && data.settings.appearance) || 'bordered';
}

function setAppearance(mode) {
  const d = readData();
  d.settings = d.settings || {};
  d.settings.appearance = mode;
  writeData(d);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('appearance-changed', mode);
  }
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  const theme = getThemePreference();
  const appearance = getAppearance();
  const menu = Menu.buildFromTemplate([
    { label: '显示 / 隐藏', click: () => toggleWindow() },
    { type: 'separator' },
    {
      label: '主题',
      submenu: [
        { label: ' 跟随系统', type: 'radio', checked: theme === 'system', click: () => setTheme('system') },
        { label: ' 浅色',     type: 'radio', checked: theme === 'light',  click: () => setTheme('light') },
        { label: ' 深色',     type: 'radio', checked: theme === 'dark',   click: () => setTheme('dark') },
      ],
    },
    { type: 'separator' },
    {
      label: '窗口样式',
      submenu: [
        { label: ' 有边框', type: 'radio', checked: appearance === 'bordered',   click: () => setAppearance('bordered') },
        { label: ' 无边框', type: 'radio', checked: appearance === 'borderless', click: () => setAppearance('borderless') },
      ],
    },
    { type: 'separator' },
    { label: '重启', click: () => { app.relaunch(); app.quit(); } },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

// ====== 托盘 ======
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('QuickMemo');
  updateTrayMenu();
  tray.on('click', () => toggleWindow());
}

function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible()) { mainWindow.hide(); }
  else { mainWindow.show(); mainWindow.focus(); }
}

// ====== 窗口 ======
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800, height: 600,
    minWidth: 500, minHeight: 400,
    frame: false, titleBarStyle: 'hidden',
    transparent: true,
    icon: path.join(__dirname, 'assets', 'quickmemo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
    show: false,
  });

  // Win11 圆角窗口
  try { mainWindow.setWindowCornerPreference?.('round'); } catch {}

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Windows：最大化时拖拽标题栏 → hook 系统消息先还原
  if (process.platform === 'win32') {
    // SC_MOVE：拖拽开始时的系统命令
    mainWindow.hookWindowMessage(0x0112, (wParam) => { // WM_SYSCOMMAND
      if ((wParam & 0xFFF0) === 0xF010 && mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      }
    });
    // 备用：非客户区左键按下时也尝试还原
    mainWindow.hookWindowMessage(0x00A1, () => { // WM_NCLBUTTONDOWN
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      }
    });
  }

  // 最大化状态变化 → 通知渲染进程更新按钮图标
  const notifyMaximize = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('maximize-changed', mainWindow.isMaximized());
    }
  };
  mainWindow.on('maximize', notifyMaximize);
  mainWindow.on('unmaximize', notifyMaximize);

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) { event.preventDefault(); mainWindow.hide(); }
  });

  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// ====== 应用生命周期 ======
app.isQuitting = false;

app.on('before-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    // 处理拖入的文件（第二个实例时）
    const filePath = getMdFileFromArgs(argv);
    if (filePath) openMdFile(filePath);
  });

  // 文件关联打开（macOS）
  app.on('open-file', (_event, filePath) => {
    openMdFile(filePath);
  });

  app.whenReady().then(() => {
    // 应用保存的主题偏好
    const savedTheme = getThemePreference();
    nativeTheme.themeSource = savedTheme;

    createWindow();
    createTray();
    scheduleReminders();

    // 注册全局快捷键
    registerGlobalShortcut(getShortcut());

    // 处理首次启动时的文件参数
    mainWindow.webContents.on('did-finish-load', () => {
      const filePath = getMdFileFromArgs(process.argv);
      if (filePath) openMdFile(filePath);
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  for (const timer of reminderTimers.values()) clearTimeout(timer);
  reminderTimers.clear();
});

// ====== IPC ======
ipcMain.handle('get-accent-color', () => getAccentColor());
ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
ipcMain.handle('get-theme-preference', () => getThemePreference());
ipcMain.handle('load-data', () => readData());
ipcMain.handle('save-data', (_, data) => {
  const existing = readData();
  data.settings = existing.settings || { theme: 'system', appearance: 'bordered', panelAlpha: 82 };
  writeData(data);
  scheduleReminders();
});
ipcMain.handle('set-reminder', (_, { noteId, time }) => {
  const data = readData();
  const reminder = { id: Date.now().toString(), noteId, time, done: false };
  data.reminders.push(reminder);
  writeData(data);
  scheduleReminders();
  return reminder;
});
ipcMain.handle('cancel-reminder', (_, reminderId) => {
  const data = readData();
  data.reminders = data.reminders.filter(r => r.id !== reminderId);
  writeData(data);
  scheduleReminders();
});
ipcMain.handle('minimize-window', () => mainWindow?.minimize());
ipcMain.handle('maximize-window', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('unmaximize-window', () => mainWindow?.unmaximize());
ipcMain.handle('is-maximized', () => mainWindow?.isMaximized() ?? false);
ipcMain.handle('close-window', () => mainWindow?.hide());
ipcMain.handle('save-file', (_, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    console.warn('QuickMemo: failed to save file', filePath, e.message);
    return false;
  }
});
ipcMain.handle('get-shortcut', () => getShortcut());
ipcMain.handle('set-shortcut', (_, accelerator) => {
  try { setShortcut(accelerator); return true; }
  catch (e) { return false; }
});
ipcMain.handle('get-window-bounds', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  return mainWindow.getBounds();
});
ipcMain.handle('set-window-bounds', (_, bounds) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (bounds.x != null) mainWindow.setBounds(bounds);
});
ipcMain.handle('get-appearance', () => getAppearance());
ipcMain.handle('set-appearance', (_, mode) => { setAppearance(mode); });
ipcMain.handle('set-theme', (_, theme) => { setTheme(theme); });
ipcMain.handle('get-panel-alpha', () => {
  const data = readData();
  return (data.settings && data.settings.panelAlpha) || 82;
});
ipcMain.handle('set-panel-alpha', (_, alpha) => {
  const d = readData();
  d.settings = d.settings || {};
  d.settings.panelAlpha = alpha;
  writeData(d);
});

// ====== Note.ms 集成 ======
ipcMain.handle('notems-get', async (_, key) => {
  try {
    const url = 'https://note.ms/' + encodeURIComponent(key);
    const resp = await net.fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    const html = await resp.text();

    // 尝试多种方式提取内容
    const patterns = [
      /<textarea[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/textarea>/i,
      /<textarea[^>]*>([\s\S]*?)<\/textarea>/i,
      /<div[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/div>/i,
      /<pre[^>]*>([\s\S]*?)<\/pre>/i,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1].trim().length > 0) return m[1].trim();
    }
    // 没匹配到内容，返回 HTML 前 300 字符辅助排查
    return '__DEBUG__:' + html.substring(0, 300);
  } catch (e) {
    return '__ERROR__:' + e.message;
  }
});

ipcMain.handle('notems-put', async (_, { key, content }) => {
  return new Promise((resolve) => {
    // 开隐藏窗口加载 note.ms 页面，用真实浏览器环境操作保存
    const saveWin = new BrowserWindow({
      width: 1, height: 1, show: false, frame: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    let done = false;
    const finish = (ok) => { if (!done) { done = true; resolve(ok); try { saveWin.close(); } catch {} } };

    saveWin.webContents.on('did-finish-load', async () => {
      try {
        const jsonContent = JSON.stringify(content);
        await saveWin.webContents.executeJavaScript(`
          new Promise((res) => {
            const ta = document.querySelector('textarea');
            if (!ta) { res(false); return; }
            ta.value = ${jsonContent};
            // 触发 input/change 事件让页面 JS 知道内容变了
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
            // 找提交按钮或表单
            const form = document.querySelector('form');
            if (form) {
              // 用原生表单提交（会触发页面自己的 save 逻辑）
              const btn = form.querySelector('button[type="submit"], button:not([type])');
              if (btn) { btn.click(); res(true); }
              else { form.requestSubmit ? form.requestSubmit() : form.submit(); res(true); }
            } else {
              // 没有表单，尝试触发页面的保存函数
              const btn = document.querySelector('button');
              if (btn && btn.onclick) { btn.click(); res(true); }
              else res(false);
            }
          });
        `).then(ok => {
          // 给页面一点时间提交
          setTimeout(() => finish(true), 2000);
        }).catch(() => finish(false));
      } catch { finish(false); }
    });

    saveWin.webContents.on('did-fail-load', () => finish(false));

    saveWin.loadURL('https://note.ms/' + encodeURIComponent(key));
  });
});

nativeTheme.on('updated', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('theme-changed', {
      accent: getAccentColor(),
      dark: nativeTheme.shouldUseDarkColors,
      theme: getThemePreference(),
    });
  }
});