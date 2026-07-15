const { contextBridge, ipcRenderer, shell } = require('electron');

/**
 * Fate's Edge Desktop Client - Preload Script
 * Exposes protected APIs to the renderer process
 * Version 1.3.0
 */

// ============================================================
// API Exposures
// ============================================================

contextBridge.exposeInMainWorld('electronAPI', {
  // ============================================================
  // SETTINGS
  // ============================================================
  
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('set-server-url', url),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
  
  // ============================================================
  // CONNECTION MANAGEMENT
  // ============================================================
  
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  reconnect: () => ipcRenderer.invoke('reconnect'),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  getConnectionHistory: () => ipcRenderer.invoke('get-connection-history'),
  
  // ============================================================
  // APP CONTROL
  // ============================================================
  
  restartApp: () => ipcRenderer.invoke('restart-app'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  reloadApp: () => ipcRenderer.invoke('reload-app'),
  minimizeApp: () => ipcRenderer.invoke('minimize-app'),
  maximizeApp: () => ipcRenderer.invoke('maximize-app'),
  closeApp: () => ipcRenderer.invoke('close-app'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  
  // ============================================================
  // SYSTEM
  // ============================================================
  
  showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  isPackaged: () => ipcRenderer.invoke('is-packaged'),
  
  // ============================================================
  // FILE OPERATIONS
  // ============================================================
  
  saveFile: (content, defaultPath, options) => 
    ipcRenderer.invoke('save-file', content, defaultPath, options),
  openFile: (options) => ipcRenderer.invoke('open-file', options),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
  chooseDirectory: (options) => ipcRenderer.invoke('choose-directory', options),
  getFileStats: (path) => ipcRenderer.invoke('get-file-stats', path),
  getFilesInDirectory: (path, options) => 
    ipcRenderer.invoke('get-files-in-directory', path, options),
  
  // ============================================================
  // LOCAL DATA
  // ============================================================
  
  getLocalData: (key) => ipcRenderer.invoke('get-local-data', key),
  setLocalData: (key, value) => ipcRenderer.invoke('set-local-data', key, value),
  deleteLocalData: (key) => ipcRenderer.invoke('delete-local-data', key),
  clearAllLocalData: () => ipcRenderer.invoke('clear-all-local-data'),
  exportLocalData: (options) => ipcRenderer.invoke('export-local-data', options),
  importLocalData: (path) => ipcRenderer.invoke('import-local-data', path),
  
  // ============================================================
  // BACKUP & RESTORE
  // ============================================================
  
  createBackup: (options) => ipcRenderer.invoke('create-backup', options),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  restoreBackup: (backupId) => ipcRenderer.invoke('restore-backup', backupId),
  deleteBackup: (backupId) => ipcRenderer.invoke('delete-backup', backupId),
  
  // ============================================================
  // UPDATE MANAGEMENT
  // ============================================================
  
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
  
  // ============================================================
  // DEEP LINKS
  // ============================================================
  
  onDeepLink: (callback) => ipcRenderer.on('deep-link', callback),
  handleDeepLink: (url) => ipcRenderer.invoke('handle-deep-link', url),
  registerProtocol: () => ipcRenderer.invoke('register-protocol'),
  
  // ============================================================
  // SHORTCUTS & HOTKEYS
  // ============================================================
  
  registerGlobalShortcut: (shortcut, callback) => 
    ipcRenderer.invoke('register-global-shortcut', shortcut, callback),
  unregisterGlobalShortcut: (shortcut) => 
    ipcRenderer.invoke('unregister-global-shortcut', shortcut),
  unregisterAllShortcuts: () => ipcRenderer.invoke('unregister-all-shortcuts'),
  
  // ============================================================
  // WINDOW MANAGEMENT
  // ============================================================
  
  createWindow: (options) => ipcRenderer.invoke('create-window', options),
  closeWindow: (windowId) => ipcRenderer.invoke('close-window', windowId),
  focusWindow: (windowId) => ipcRenderer.invoke('focus-window', windowId),
  setWindowBounds: (bounds) => ipcRenderer.invoke('set-window-bounds', bounds),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('set-always-on-top', enabled),
  setFullScreen: (enabled) => ipcRenderer.invoke('set-full-screen', enabled),
  
  // ============================================================
  // NOTIFICATIONS
  // ============================================================
  
  sendNotification: (title, body, options) => 
    ipcRenderer.invoke('send-notification', title, body, options),
  getNotificationPermission: () => ipcRenderer.invoke('get-notification-permission'),
  requestNotificationPermission: () => 
    ipcRenderer.invoke('request-notification-permission'),
  
  // ============================================================
  // TRAY MENU
  // ============================================================
  
  setTrayIcon: (iconPath) => ipcRenderer.invoke('set-tray-icon', iconPath),
  setTrayTooltip: (tooltip) => ipcRenderer.invoke('set-tray-tooltip', tooltip),
  showTrayContextMenu: () => ipcRenderer.invoke('show-tray-context-menu'),
  
  // ============================================================
  // EVENTS (main -> renderer)
  // ============================================================
  
  onSettingsChanged: (callback) => ipcRenderer.on('settings-changed', callback),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  onConnectionStatusChange: (callback) => 
    ipcRenderer.on('connection-status-change', callback),
  onWindowFocus: (callback) => ipcRenderer.on('window-focus', callback),
  onWindowBlur: (callback) => ipcRenderer.on('window-blur', callback),
  onWindowResize: (callback) => ipcRenderer.on('window-resize', callback),
  onBeforeQuit: (callback) => ipcRenderer.on('before-quit', callback),
  
  // ============================================================
  // MENU ACTIONS (for app menu bar integration)
  // ============================================================
  
  onMenuAction: (callback) => ipcRenderer.on('menu-action', callback),
  triggerMenuAction: (action) => ipcRenderer.invoke('trigger-menu-action', action),
  
  // ============================================================
  // LOGGING
  // ============================================================
  
  log: (level, message, data) => 
    ipcRenderer.invoke('log', level, message, data),
  getLogs: (options) => ipcRenderer.invoke('get-logs', options),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  exportLogs: (path) => ipcRenderer.invoke('export-logs', path),
  
  // ============================================================
  // VOICE CHAT (desktop-specific)
  // ============================================================
  
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  setAudioDevice: (deviceId, type) => 
    ipcRenderer.invoke('set-audio-device', deviceId, type),
  getAudioDevice: (type) => ipcRenderer.invoke('get-audio-device', type),
  testAudioDevice: (deviceId) => ipcRenderer.invoke('test-audio-device', deviceId),
  getAudioLevel: () => ipcRenderer.invoke('get-audio-level'),
  
  // ============================================================
  // GRID COMBAT (desktop-specific)
  // ============================================================
  
  exportGridMap: (code, format) => 
    ipcRenderer.invoke('export-grid-map', code, format),
  importGridMap: (path) => ipcRenderer.invoke('import-grid-map', path),
  
  // ============================================================
  // WHITEBOARD (desktop-specific)
  // ============================================================
  
  exportWhiteboard: (code, format) => 
    ipcRenderer.invoke('export-whiteboard', code, format),
  importWhiteboard: (path) => ipcRenderer.invoke('import-whiteboard', path),
  printWhiteboard: (code) => ipcRenderer.invoke('print-whiteboard', code),
  
  // ============================================================
  // DOCK (macOS specific)
  // ============================================================
  
  setDockBadge: (count) => ipcRenderer.invoke('set-dock-badge', count),
  setDockMenu: (menuItems) => ipcRenderer.invoke('set-dock-menu', menuItems),
  
  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================
  
  saveSession: (name) => ipcRenderer.invoke('save-session', name),
  loadSession: (name) => ipcRenderer.invoke('load-session', name),
  listSessions: () => ipcRenderer.invoke('list-sessions'),
  deleteSession: (name) => ipcRenderer.invoke('delete-session', name),
  autoSaveSession: () => ipcRenderer.invoke('auto-save-session'),
  
  // ============================================================
  // SCREENSHOT
  // ============================================================
  
  captureScreen: (options) => ipcRenderer.invoke('capture-screen', options),
  captureArea: (bounds) => ipcRenderer.invoke('capture-area', bounds),
  
  // ============================================================
  // REMOVE EVENT LISTENERS (cleanup)
  // ============================================================
  
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback)
});

// ============================================================
// UTILITY HELPERS
// ============================================================

// Detect if running in Electron
window.isElectron = true;

// Detect platform
window.platform = process.platform;

// Detect if packaged
window.isPackaged = process.env.NODE_ENV === 'production';

// Version info
window.appVersion = process.env.npm_package_version || '1.3.0';

// ============================================================
// CONSOLE BRIDGE (for logging from renderer)
// ============================================================

const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

// Wrap console methods to send logs to main process
console.log = function(...args) {
  originalConsole.log(...args);
  try {
    ipcRenderer.invoke('log', 'info', args.map(a => {
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' '));
  } catch (e) { /* ignore */ }
};

console.error = function(...args) {
  originalConsole.error(...args);
  try {
    ipcRenderer.invoke('log', 'error', args.map(a => {
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' '));
  } catch (e) { /* ignore */ }
};

console.warn = function(...args) {
  originalConsole.warn(...args);
  try {
    ipcRenderer.invoke('log', 'warn', args.map(a => {
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' '));
  } catch (e) { /* ignore */ }
};

// ============================================================
// UNHANDLED ERROR HANDLING
// ============================================================

window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
  try {
    ipcRenderer.invoke('log', 'error', `Unhandled error: ${event.error?.stack || event.message}`);
  } catch (e) { /* ignore */ }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  try {
    ipcRenderer.invoke('log', 'error', `Unhandled rejection: ${event.reason?.stack || event.reason}`);
  } catch (e) { /* ignore */ }
});

// ============================================================
// EXPOSE ADDITIONAL HELPERS
// ============================================================

// Helper to check if a feature is available
window.featureAvailable = function(feature) {
  const features = {
    'settings': true,
    'backup': true,
    'updates': true,
    'deepLinks': true,
    'globalShortcuts': true,
    'tray': true,
    'notifications': true,
    'voice': true,
    'gridCombat': true,
    'whiteboard': true,
    'sessions': true,
    'screenshots': true
  };
  return features[feature] || false;
};

// Version helper
window.getAppVersion = function() {
  return window.appVersion;
};

// Platform helper
window.isMac = window.platform === 'darwin';
window.isWindows = window.platform === 'win32';
window.isLinux = window.platform === 'linux';

console.log('[Preload] Fate\'s Edge Desktop Client v' + window.appVersion + ' loaded');
console.log('[Preload] Platform:', window.platform);
console.log('[Preload] Packaged:', window.isPackaged);