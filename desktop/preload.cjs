const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("rocketStatsDesktop", Object.freeze({
  getState: () => ipcRenderer.invoke("desktop:get-state"),
  setLocale: (locale) => ipcRenderer.invoke("desktop:set-locale", locale),
  setPort: (port) => ipcRenderer.invoke("desktop:set-port", port),
  toggleScope: () => ipcRenderer.invoke("desktop:toggle-scope"),
  resetStats: () => ipcRenderer.invoke("desktop:reset-stats"),
  getMmrHistory: () => ipcRenderer.invoke("desktop:mmr-history"),
  configureApi: () => ipcRenderer.invoke("desktop:configure-api"),
  checkUpdate: () => ipcRenderer.invoke("desktop:check-update"),
  downloadUpdate: () => ipcRenderer.invoke("desktop:download-update"),
  getUpdateMatchStatus: () => ipcRenderer.invoke("desktop:update-match-status"),
  installUpdate: (confirmedStatus) => ipcRenderer.invoke("desktop:install-update", confirmedStatus),
  setAutoUpdates: (enabled) => ipcRenderer.invoke("desktop:set-auto-updates", enabled),
  onUpdate: (callback) => subscribe("desktop:update", callback),
  onModel: (callback) => subscribe("desktop:model", callback),
  onStatus: (callback) => subscribe("desktop:status", callback),
  onError: (callback) => subscribe("desktop:error", callback)
}));
