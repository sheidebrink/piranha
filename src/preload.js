const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Top-level tab management
  switchTab: (tabId) => ipcRenderer.invoke('switch-tab', tabId),
  getTabs: () => ipcRenderer.invoke('get-tabs'),
  onTabsUpdated: (callback) => ipcRenderer.on('tabs-updated', (event, tabs) => callback(tabs)),
  
  // Nested web tab management
  loadUrl: (url) => ipcRenderer.invoke('load-url', url),
  createWebTab: (url) => ipcRenderer.invoke('create-web-tab', url),
  switchWebTab: (tabId) => ipcRenderer.invoke('switch-web-tab', tabId),
  closeWebTab: (tabId) => ipcRenderer.invoke('close-web-tab', tabId),
  getWebTabs: () => ipcRenderer.invoke('get-web-tabs'),
  onWebTabsUpdated: (callback) => ipcRenderer.on('web-tabs-updated', (event, tabs) => callback(tabs)),
  
  // Metrics and tracking
  trackEvent: (eventData) => ipcRenderer.invoke('track-event', eventData),
  getMetrics: (filters) => ipcRenderer.invoke('get-metrics', filters),
  getSessionSummary: () => ipcRenderer.invoke('get-session-summary'),
  onClaimInfoUpdated: (callback) => ipcRenderer.on('claim-info-updated', (event, data) => callback(data)),
  
  // Email
  onEmailSearchResult: (callback) => ipcRenderer.on('email-search-result', (event, data) => callback(data)),
  openEmailTab: () => ipcRenderer.invoke('open-email-tab'),
  
  // API Status
  onApiStatus: (callback) => ipcRenderer.on('api-status', (event, data) => callback(data)),
  getApiStatus: () => ipcRenderer.invoke('get-api-status'),
  
  // User Info
  getUserInfo: () => ipcRenderer.invoke('get-user-info'),
  
  // Utilities
  clearSession: () => ipcRenderer.invoke('clear-session'),
  hideBrowserView: () => ipcRenderer.invoke('hide-browser-view'),
  showBrowserView: () => ipcRenderer.invoke('show-browser-view'),
  setZoom: (zoomLevel) => ipcRenderer.invoke('set-zoom', zoomLevel),
  testNotification: () => ipcRenderer.invoke('test-notification'),
  getSettings: () => ipcRenderer.invoke('get-settings')
});
