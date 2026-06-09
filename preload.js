const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAccentColor: () => ipcRenderer.invoke('get-accent-color'),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  getThemePreference: () => ipcRenderer.invoke('get-theme-preference'),
  setMode: (mode) => ipcRenderer.invoke('set-mode', mode),
  getMode: () => ipcRenderer.invoke('get-mode'),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  setReminder: (noteId, time) => ipcRenderer.invoke('set-reminder', { noteId, time }),
  cancelReminder: (id) => ipcRenderer.invoke('cancel-reminder', id),
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  unmaximize: () => ipcRenderer.invoke('unmaximize-window'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  close: () => ipcRenderer.invoke('close-window'),
  onThemeChanged: (cb) => {
    ipcRenderer.on('theme-changed', (_, data) => cb(data));
  },
  getAppearance: () => ipcRenderer.invoke('get-appearance'),
  setAppearance: (mode) => ipcRenderer.invoke('set-appearance', mode),
  onAppearanceChanged: (cb) => {
    ipcRenderer.on('appearance-changed', (_, mode) => cb(mode));
  },
  onMaximizeChanged: (cb) => {
    ipcRenderer.on('maximize-changed', (_, maximized) => cb(maximized));
  },
  getShortcut: () => ipcRenderer.invoke('get-shortcut'),
  setShortcut: (acc) => ipcRenderer.invoke('set-shortcut', acc),
  onShortcutChanged: (cb) => {
    ipcRenderer.on('shortcut-changed', (_, acc) => cb(acc));
  },
  onOpenMdFile: (cb) => {
    ipcRenderer.on('open-md-file', (_, data) => cb(data));
  },
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  getPanelAlpha: () => ipcRenderer.invoke('get-panel-alpha'),
  setPanelAlpha: (alpha) => ipcRenderer.invoke('set-panel-alpha', alpha),
  getNotemsContent: (key) => ipcRenderer.invoke('notems-get', key),
  setNotemsContent: (key, content) => ipcRenderer.invoke('notems-put', { key, content }),
  exportMarkdownFile: (filename, content) => ipcRenderer.invoke('export-markdown-file', { filename, content }),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  startTokdashServer: () => ipcRenderer.invoke("start-tokdash-server"),
  tokdashFetch: (endpoint) => ipcRenderer.invoke("tokdash-fetch", endpoint)
});
