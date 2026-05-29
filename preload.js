const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAccentColor: () => ipcRenderer.invoke('get-accent-color'),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  getThemePreference: () => ipcRenderer.invoke('get-theme-preference'),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  setReminder: (noteId, time) => ipcRenderer.invoke('set-reminder', { noteId, time }),
  cancelReminder: (id) => ipcRenderer.invoke('cancel-reminder', id),
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  close: () => ipcRenderer.invoke('close-window'),
  onThemeChanged: (cb) => {
    ipcRenderer.on('theme-changed', (_, data) => cb(data));
  },
  getAppearance: () => ipcRenderer.invoke('get-appearance'),
  setAppearance: (mode) => ipcRenderer.invoke('set-appearance', mode),
  onAppearanceChanged: (cb) => {
    ipcRenderer.on('appearance-changed', (_, mode) => cb(mode));
  },
  getPanelAlpha: () => ipcRenderer.invoke('get-panel-alpha'),
  setPanelAlpha: (alpha) => ipcRenderer.invoke('set-panel-alpha', alpha),
  getNotemsContent: (key) => ipcRenderer.invoke('notems-get', key),
  setNotemsContent: (key, content) => ipcRenderer.invoke('notems-put', { key, content }),
});
