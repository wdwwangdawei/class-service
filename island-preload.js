const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('islandAPI', {
  getState: () => ipcRenderer.invoke('island-get-state'),
  getData: () => ipcRenderer.invoke('island-get-data'),
  setInteractive: (v) => ipcRenderer.invoke('island-set-interactive', v === true),
  setSetting: (key, value) => ipcRenderer.invoke('island-set-setting', { key, value }),
  saveSettings: (params) => ipcRenderer.invoke('island-save-settings', params),
  openMain: () => ipcRenderer.invoke('island-open-main'),
  openPage: (page) => ipcRenderer.invoke('island-open-page', page),
  openSettings: () => ipcRenderer.invoke('island-open-settings'),
  showMenu: () => ipcRenderer.invoke('island-context-menu'),
  refresh: () => ipcRenderer.invoke('island-refresh'),
  onVisibility: (cb) => ipcRenderer.on('island-visibility', (e, v) => cb(v)),
  onConfig: (cb) => ipcRenderer.on('island-config-updated', (e, c) => cb(c)),
  onAlert: (cb) => ipcRenderer.on('island-alert', (e, p) => cb(p || {})),
  onData: (cb) => ipcRenderer.on('island-data-updated', (e, d) => cb(d)),
  onLocked: (cb) => ipcRenderer.on('island-locked-state', (e, v) => cb(v)),
  onPreview: (cb) => ipcRenderer.on('island-preview', () => cb())
});
