const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadUrl: (url) => ipcRenderer.invoke('load-url', url),
  trackEvent: (eventData) => ipcRenderer.invoke('track-event', eventData),
  getMetrics: (filters) => ipcRenderer.invoke('get-metrics', filters),
  getSessionSummary: () => ipcRenderer.invoke('get-session-summary'),
  onClaimInfoUpdated: (callback) => ipcRenderer.on('claim-info-updated', (event, data) => callback(data)),
  clearSession: () => ipcRenderer.invoke('clear-session'),
  createTab: (url) => ipcRenderer.invoke('create-tab', url),
  switchTab: (tabId) => ipcRenderer.invoke('switch-tab', tabId),
  closeTab: (tabId) => ipcRenderer.invoke('close-tab', tabId),
  getTabs: () => ipcRenderer.invoke('get-tabs'),
  onTabsUpdated: (callback) => ipcRenderer.on('tabs-updated', (event, tabs) => callback(tabs)),
  hideBrowserView: () => ipcRenderer.invoke('hide-browser-view'),
  showBrowserView: () => ipcRenderer.invoke('show-browser-view'),
  openEmailTab: () => ipcRenderer.invoke('open-email-tab')
});
