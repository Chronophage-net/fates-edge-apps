const { contextBridge, ipcRenderer } = require('electron');

/**
 * Fate's Edge Desktop Client - Preload Script
 * Exposes a safe, whitelisted API to the renderer via contextBridge.
 *
 * HISTORY: this full API used to live in electron.js by mistake (it's
 * preload-only code -- contextBridge.exposeInMainWorld() throws outside a
 * preload context), while electron.js was the file package.json pointed
 * "main" at. That meant there was no actual Electron main process
 * anywhere in the repo, and the app couldn't launch. This file is now the
 * real preload script; electron.js is now the real main process
 * (BrowserWindow + app lifecycle + ipcMain.handle() for every channel
 * below). Every channel invoked here has a matching ipcMain.handle() in
 * electron.js -- see that file's "IPC HANDLERS" section, organized under
 * the same headings as below.
 */

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
  //
  // The actual WebSocket connection to the Fate's Edge server lives in
  // the renderer (the bundled web client's own JS), not in the main
  // process -- there's nothing for main to "reconnect" on its own. So
  // reconnect()/disconnect() ask main to relay a 'connection-command'
  // event back down to this same window; the page's own connection code
  // is what should listen via onConnectionCommand() and act on it.
  // getConnectionStatus()/getConnectionHistory() read whatever the page
  // last reported via reportConnectionStatus() -- call that from the web
  // client's WS event handlers to keep it current.

  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  getConnectionHistory: () => ipcRenderer.invoke('get-connection-history'),
  reportConnectionStatus: (status) => ipcRenderer.invoke('report-connection-status', status),
  reconnect: () => ipcRenderer.invoke('reconnect'),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  onConnectionCommand: (callback) => ipcRenderer.on('connection-command', callback),

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
  //
  // readFile/writeFile/getFileStats are intentionally NOT free-form --
  // main.js restricts them to paths the user actually picked via
  // saveFile/openFile/chooseDirectory's native dialogs (or paths under
  // the app's own userData dir), rather than trusting any path string
  // the renderer sends. See main.js's isAllowedPath().

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
  //
  // FIXED: registerGlobalShortcut used to take a `callback` argument and
  // pass it through ipcRenderer.invoke() -- but invoke() serializes its
  // arguments (structured clone), and functions aren't cloneable, so
  // `callback` always arrived in main as undefined/null. Now
  // registerGlobalShortcut() just takes the accelerator string; main
  // fires a shared 'global-shortcut-triggered' event (with the
  // accelerator that fired) whenever any registered shortcut activates,
  // and the renderer tells shortcuts apart via onGlobalShortcut().

  registerGlobalShortcut: (shortcut) =>
    ipcRenderer.invoke('register-global-shortcut', shortcut),
  unregisterGlobalShortcut: (shortcut) =>
    ipcRenderer.invoke('unregister-global-shortcut', shortcut),
  unregisterAllShortcuts: () => ipcRenderer.invoke('unregister-all-shortcuts'),
  onGlobalShortcut: (callback) => ipcRenderer.on('global-shortcut-triggered', callback),

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
  // MENU ACTIONS (app menu bar integration)
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
  //
  // NOTE: audio device enumeration (getAudioDevices/getAudioLevel) is a
  // renderer/navigator.mediaDevices capability, not something the main
  // process can see -- Node has no audio device APIs. main.js's handlers
  // for these are honest about that (they return an "unsupported" result
  // explaining to use navigator.mediaDevices.enumerateDevices() in the
  // page itself) rather than returning fabricated data. setAudioDevice
  // just persists the chosen deviceId via electron-store so it survives
  // restarts; the page still does the actual device selection.

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
// UTILITY GLOBALS (safe to expose directly -- plain values, no IPC)
// ============================================================

window.isElectron = true;
window.platform = process.platform;
window.isMac = process.platform === 'darwin';
window.isWindows = process.platform === 'win32';
window.isLinux = process.platform === 'linux';

// ============================================================
// CONSOLE BRIDGE (forward renderer console output to electron-log)
// ============================================================

const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn
};

function forwardLog(level, args) {
  try {
    const message = args.map((a) => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
    ipcRenderer.invoke('log', level, message);
  } catch (e) { /* ignore -- logging must never throw */ }
}

console.log = function (...args) {
  originalConsole.log(...args);
  forwardLog('info', args);
};

console.error = function (...args) {
  originalConsole.error(...args);
  forwardLog('error', args);
};

console.warn = function (...args) {
  originalConsole.warn(...args);
  forwardLog('warn', args);
};

window.addEventListener('error', (event) => {
  forwardLog('error', [`Unhandled error: ${event.error?.stack || event.message}`]);
});

window.addEventListener('unhandledrejection', (event) => {
  forwardLog('error', [`Unhandled rejection: ${event.reason?.stack || event.reason}`]);
});

console.log('[Preload] Fate\'s Edge Desktop Client preload loaded');
console.log('[Preload] Platform:', window.platform);
