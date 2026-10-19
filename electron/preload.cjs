const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('revibe', {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),
  getNativeTheme: () => ipcRenderer.invoke('app:theme'),
  getSystemAccentColor: () => ipcRenderer.invoke('system:accent-color'),
  onSystemAccentChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, color) => callback(color);
    ipcRenderer.on('system:accent-color-changed', listener);
    return () => ipcRenderer.removeListener('system:accent-color-changed', listener);
  },
  readSettings: () => ipcRenderer.invoke('settings:read'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  chooseFolder: (kind, defaultPath = '') => ipcRenderer.invoke('folder:choose', kind, defaultPath),
  scanFolder: (folder, kind) => ipcRenderer.invoke('folder:scan', folder, kind),
  refreshFolder: (folder, kind) => ipcRenderer.invoke('folder:refresh', folder, kind),
  chooseFiles: (kind) => ipcRenderer.invoke('files:choose', kind),
  onOpenMedia: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, files) => callback(Array.isArray(files) ? files : []);
    ipcRenderer.on('media:open-request', listener);
    ipcRenderer.send('media:open-ready');
    return () => ipcRenderer.removeListener('media:open-request', listener);
  },
  getOpenTvCatalog: (force = false) => ipcRenderer.invoke('tv:catalog', force),
  getExternalStorages: () => ipcRenderer.invoke('storage:list'),
  rescanExternalStorages: () => ipcRenderer.invoke('storage:rescan'),
  getMediaArtwork: (filePath, kind) => ipcRenderer.invoke('media:get-artwork', filePath, kind),
  searchArtwork: (item) => ipcRenderer.invoke('artwork:search', item),
  onExternalStorages: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, volumes) => callback(Array.isArray(volumes) ? volumes : []);
    ipcRenderer.on('storage:volumes', listener);
    return () => ipcRenderer.removeListener('storage:volumes', listener);
  },
  onDiscoveredMedia: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('storage:discovered-media', listener);
    return () => ipcRenderer.removeListener('storage:discovered-media', listener);
  },
  clearApplicationCaches: () => ipcRenderer.invoke('app:clear-cache'),
  fileUrl: (filePath) => ipcRenderer.invoke('media:file-url', filePath),
  getDroppedFilePath: (file) => {
    try { return webUtils.getPathForFile(file); } catch { return ''; }
  },
  openSoundSettings: () => ipcRenderer.invoke('devices:open-sound-settings'),
  windowAction: (action) => ipcRenderer.invoke('window:action', action),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  getWindowAppearance: () => ipcRenderer.invoke('window:appearance'),
  setWindowMaterial: (mode) => ipcRenderer.invoke('window:set-material', mode),
  onWindowState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, maximized) => callback(Boolean(maximized));
    ipcRenderer.on('window:state', listener);
    return () => ipcRenderer.removeListener('window:state', listener);
  }
});
