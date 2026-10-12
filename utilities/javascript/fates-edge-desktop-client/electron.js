/**
 * Fate's Edge Desktop Client - Electron Main Process
 *
 * HISTORY: this file used to contain preload-only code (contextBridge.
 * exposeInMainWorld), which is invalid in the main process and would
 * throw immediately on launch -- there was no BrowserWindow, no
 * ipcMain.handle() for any of the channels preload.js calls, and no
 * renderer content bundled anywhere in the package (electron-builder's
 * `files` list didn't ship the web client at all). This file is now the
 * real main process: it creates the window, loads the bundled web client
 * from renderer/ (see scripts/copy-renderer.js), and implements every
 * channel preload.js invokes. Section headings match preload.js's.
 *
 * NOTE: this was written and syntax-checked (`node --check`) in an
 * environment without a display or a way to actually launch Electron, so
 * it hasn't been run end-to-end. Do a smoke test (`npm start`) before
 * shipping a build.
 */

const {
  app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray,
  Notification, globalShortcut, desktopCapturer, nativeImage
} = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const security = require('./security');

const Store = require('electron-store');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

// ============================================================
// Logging setup
// ============================================================

log.transports.file.level = 'info';
log.transports.console.level = 'debug';
autoUpdater.logger = log;

// ============================================================
// Persistent stores
// ============================================================

const DEFAULT_SETTINGS = {
  serverUrl: 'ws://localhost:10000',
  autoConnect: true,
  playerName: '',
  theme: 'default'
};

const settingsStore = new Store({ name: 'settings', defaults: DEFAULT_SETTINGS });
const localDataStore = new Store({ name: 'localdata', defaults: {} });

// ============================================================
// Module-level state
// ============================================================

let mainWindow = null;
const secondaryWindows = new Map(); // windowId -> BrowserWindow
let tray = null;
const registeredShortcuts = new Set();
let connectionState = { status: 'disconnected', lastChange: null };
const connectionHistory = [];
const MAX_CONNECTION_HISTORY = 50;

// Paths a renderer-supplied file path is allowed to touch. We never trust
// a bare string from the renderer as a filesystem path -- only paths the
// user explicitly picked via a native dialog (save-file/open-file/
// choose-directory), plus the app's own data directories, are allowed.
// Without this, read-file/write-file/get-files-in-directory would be an
// arbitrary local file read/write primitive reachable from any web
// content the window loads.
const grantedPaths = new Set();
const RENDERER_DIR = path.join(__dirname, 'renderer');
const USER_DATA_DIR = () => app.getPath('userData');
const BACKUPS_DIR = () => path.join(USER_DATA_DIR(), 'backups');
const SESSIONS_DIR = () => path.join(USER_DATA_DIR(), 'sessions');

function isAllowedPath(targetPath) {
  return security.isAllowedPath(targetPath, [USER_DATA_DIR(), BACKUPS_DIR(), SESSIONS_DIR()], grantedPaths);
}

function grantPath(p) {
  const canonical = security.canonicalPath(p);
  if (canonical) grantedPaths.add(canonical);
  return p;
}

// ============================================================
// Window creation
// ============================================================

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'fe_icon.png'),
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  security.secureContents(mainWindow.webContents, RENDERER_DIR);
  const indexPath = path.join(RENDERER_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    log.error(`Renderer not found at ${indexPath}`);
    mainWindow.loadURL(
      'data:text/html,' +
      encodeURIComponent(`
        <body style="background:#0f1117;color:#eee;font-family:sans-serif;padding:2rem;">
          <h1>Renderer not built</h1>
          <p>renderer/index.html is missing. Run <code>npm run build</code> in
          fates-edge-web-client, then <code>node scripts/copy-renderer.js</code>
          in this package before starting the app.</p>
        </body>
      `)
    );
  }

  mainWindow.on('focus', () => mainWindow.webContents.send('window-focus'));
  mainWindow.on('blur', () => mainWindow.webContents.send('window-blur'));
  mainWindow.on('resize', () => mainWindow.webContents.send('window-resize', mainWindow.getBounds()));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function getTargetWindow(windowId) {
  if (windowId && secondaryWindows.has(windowId)) return secondaryWindows.get(windowId);
  return BrowserWindow.getFocusedWindow() || mainWindow;
}

// Every privileged handler uses the same top-level, owned-window check.
function handleIPC(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    const contents = [mainWindow, ...secondaryWindows.values()].filter(Boolean).map(win => win.webContents);
    if (!security.isTrustedSender(event, RENDERER_DIR, contents)) throw new Error('Untrusted IPC sender');
    return handler(event, ...args);
  });
}

// ============================================================
// Deep link handling
// ============================================================

function parseDeepLink(url) {
  try {
    const parsed = new URL(url);
    return {
      raw: url,
      action: parsed.hostname || parsed.pathname.replace(/^\//, ''),
      params: Object.fromEntries(parsed.searchParams.entries())
    };
  } catch (err) {
    return { raw: url, action: null, params: {} };
  }
}

function handleIncomingDeepLink(url) {
  if (!url || !url.startsWith('fatesedge://')) return;
  const payload = parseDeepLink(url);
  log.info('Deep link received:', payload);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.send('deep-link', payload);
  }
}

// ============================================================
// App lifecycle
// ============================================================

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deepLinkArg = argv.find((a) => a.startsWith('fatesedge://'));
    if (deepLinkArg) handleIncomingDeepLink(deepLinkArg);
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleIncomingDeepLink(url);
  });

  app.whenReady().then(() => {
    createMainWindow();
    buildApplicationMenu();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    // Give the renderer a chance to flush unsaved state (e.g. an
    // in-progress session autosave) before the window actually closes.
    if (mainWindow) mainWindow.webContents.send('before-quit');
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
}

// ============================================================
// Application menu
// ============================================================

function sendMenuAction(action) {
  const win = mainWindow;
  if (win) win.webContents.send('menu-action', action);
}

const MENU_ACTIONS = {
  'open-settings': () => {
    sendMenuAction('open-settings');
    if (mainWindow) mainWindow.webContents.send('open-settings');
  },
  reload: () => mainWindow && mainWindow.webContents.reload(),
  quit: () => app.quit(),
  'toggle-devtools': () => mainWindow && mainWindow.webContents.toggleDevTools()
};

function buildApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings...', accelerator: 'Cmd+,', click: () => MENU_ACTIONS['open-settings']() },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        ...(isMac ? [] : [{ label: 'Settings...', click: () => MENU_ACTIONS['open-settings']() }, { type: 'separator' }]),
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Fate\'s Edge on GitHub', click: () => shell.openExternal('https://github.com/Chronophage-net/fates-edge-apps') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ============================================================
// IPC HANDLERS -- SETTINGS
// ============================================================

handleIPC('get-server-url', () => settingsStore.get('serverUrl'));
handleIPC('set-server-url', (event, url) => {
  settingsStore.set('serverUrl', url);
  notifySettingsChanged();
  return true;
});
handleIPC('get-settings', () => settingsStore.store);
handleIPC('set-settings', (event, settings) => {
  settingsStore.set({ ...settingsStore.store, ...(settings || {}) });
  notifySettingsChanged();
  return settingsStore.store;
});
handleIPC('reset-settings', () => {
  settingsStore.clear();
  settingsStore.set(DEFAULT_SETTINGS);
  notifySettingsChanged();
  return settingsStore.store;
});
handleIPC('get-setting', (event, key) => settingsStore.get(key));
handleIPC('set-setting', (event, key, value) => {
  settingsStore.set(key, value);
  notifySettingsChanged();
  return true;
});

function notifySettingsChanged() {
  if (mainWindow) mainWindow.webContents.send('settings-changed', settingsStore.store);
}

// ============================================================
// IPC HANDLERS -- CONNECTION MANAGEMENT
// ============================================================

handleIPC('get-connection-status', () => connectionState);
handleIPC('get-connection-history', () => connectionHistory);
handleIPC('report-connection-status', (event, status) => {
  connectionState = { status: status?.status || 'unknown', lastChange: Date.now(), detail: status };
  connectionHistory.push(connectionState);
  if (connectionHistory.length > MAX_CONNECTION_HISTORY) connectionHistory.shift();
  if (mainWindow) mainWindow.webContents.send('connection-status-change', connectionState);
  return true;
});
handleIPC('reconnect', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.webContents.send('connection-command', { command: 'reconnect' });
  return { relayed: !!win };
});
handleIPC('disconnect', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.webContents.send('connection-command', { command: 'disconnect' });
  return { relayed: !!win };
});

// ============================================================
// IPC HANDLERS -- APP CONTROL
// ============================================================

handleIPC('restart-app', () => {
  app.relaunch();
  app.exit(0);
});
handleIPC('quit-app', () => app.quit());
handleIPC('reload-app', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.webContents.reload();
});
handleIPC('minimize-app', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
handleIPC('maximize-app', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
handleIPC('close-app', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
handleIPC('get-app-version', () => app.getVersion());
handleIPC('get-app-path', (event, name) => {
  try {
    return app.getPath(name || 'userData');
  } catch (err) {
    return app.getPath('userData');
  }
});

// ============================================================
// IPC HANDLERS -- SYSTEM
// ============================================================

handleIPC('show-item-in-folder', (event, targetPath) => {
  if (!isAllowedPath(targetPath)) return { ok: false, error: 'Path not permitted' };
  shell.showItemInFolder(targetPath);
  return { ok: true };
});
handleIPC('open-external', (event, url) => {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return { ok: false, error: `Refusing to open unsupported scheme: ${parsed.protocol}` };
    }
    shell.openExternal(url);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Invalid URL' };
  }
});
handleIPC('open-dev-tools', (event) => BrowserWindow.fromWebContents(event.sender)?.webContents.openDevTools());
handleIPC('get-system-info', () => ({
  platform: process.platform,
  arch: process.arch,
  release: os.release(),
  totalMemory: os.totalmem(),
  freeMemory: os.freemem(),
  cpuCount: os.cpus().length,
  hostname: os.hostname()
}));
handleIPC('get-platform', () => process.platform);
handleIPC('is-packaged', () => app.isPackaged);

// ============================================================
// IPC HANDLERS -- FILE OPERATIONS
// ============================================================

handleIPC('save-file', async (event, content, defaultPath, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    defaultPath,
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  grantPath(result.filePath);
  const encoding = options.encoding === 'base64' ? 'base64' : 'utf8';
  await fsp.writeFile(result.filePath, content, encoding);
  return { ok: true, path: result.filePath };
});

handleIPC('open-file', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
  const filePath = result.filePaths[0];
  grantPath(filePath);
  const encoding = options.encoding === 'base64' ? 'base64' : 'utf8';
  const content = await fsp.readFile(filePath, encoding);
  return { ok: true, path: filePath, content };
});

handleIPC('read-file', async (event, targetPath) => {
  if (!isAllowedPath(targetPath)) return { ok: false, error: 'Path not permitted' };
  try {
    const content = await fsp.readFile(targetPath, 'utf8');
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

handleIPC('write-file', async (event, targetPath, content) => {
  if (!isAllowedPath(targetPath)) return { ok: false, error: 'Path not permitted' };
  try {
    await fsp.writeFile(targetPath, content, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

handleIPC('choose-directory', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
  grantPath(result.filePaths[0]);
  return { ok: true, path: result.filePaths[0] };
});

handleIPC('get-file-stats', async (event, targetPath) => {
  if (!isAllowedPath(targetPath)) return { ok: false, error: 'Path not permitted' };
  try {
    const stats = await fsp.stat(targetPath);
    return {
      ok: true,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      modifiedAt: stats.mtimeMs,
      createdAt: stats.birthtimeMs
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

handleIPC('get-files-in-directory', async (event, targetPath, options = {}) => {
  if (!isAllowedPath(targetPath)) return { ok: false, error: 'Path not permitted' };
  try {
    const entries = await fsp.readdir(targetPath, { withFileTypes: true });
    let files = entries.filter((e) => e.isFile()).map((e) => e.name);
    if (options.extensions && Array.isArray(options.extensions)) {
      const exts = options.extensions.map((e) => e.toLowerCase());
      files = files.filter((name) => exts.includes(path.extname(name).slice(1).toLowerCase()));
    }
    return { ok: true, files };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ============================================================
// IPC HANDLERS -- LOCAL DATA
// ============================================================

handleIPC('get-local-data', (event, key) => (key ? localDataStore.get(key) : localDataStore.store));
handleIPC('set-local-data', (event, key, value) => {
  localDataStore.set(key, value);
  return true;
});
handleIPC('delete-local-data', (event, key) => {
  localDataStore.delete(key);
  return true;
});
handleIPC('clear-all-local-data', () => {
  localDataStore.clear();
  return true;
});
handleIPC('export-local-data', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    defaultPath: options.defaultPath || 'fates-edge-data-export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  grantPath(result.filePath);
  await fsp.writeFile(result.filePath, JSON.stringify(localDataStore.store, null, 2), 'utf8');
  return { ok: true, path: result.filePath };
});
handleIPC('import-local-data', async (event, targetPath) => {
  if (!isAllowedPath(targetPath)) return { ok: false, error: 'Path not permitted' };
  try {
    const raw = await fsp.readFile(targetPath, 'utf8');
    const data = JSON.parse(raw);
    localDataStore.set(data);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ============================================================
// IPC HANDLERS -- BACKUP & RESTORE
// ============================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

handleIPC('create-backup', async (event, options = {}) => {
  ensureDir(BACKUPS_DIR());
  const id = `backup-${Date.now()}`;
  const filePath = path.join(BACKUPS_DIR(), `${id}.json`);
  const snapshot = {
    id,
    createdAt: Date.now(),
    label: options.label || null,
    settings: settingsStore.store,
    localData: localDataStore.store
  };
  await fsp.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  return { ok: true, id, path: filePath };
});

handleIPC('list-backups', async () => {
  ensureDir(BACKUPS_DIR());
  const entries = await fsp.readdir(BACKUPS_DIR());
  const backups = [];
  for (const entry of entries.filter((f) => f.endsWith('.json'))) {
    try {
      const raw = await fsp.readFile(path.join(BACKUPS_DIR(), entry), 'utf8');
      const data = JSON.parse(raw);
      backups.push({ id: data.id, createdAt: data.createdAt, label: data.label });
    } catch (err) { /* skip corrupt backup file */ }
  }
  return backups.sort((a, b) => b.createdAt - a.createdAt);
});

handleIPC('restore-backup', async (event, backupId) => {
  const filePath = security.backupPath(BACKUPS_DIR(), backupId);
  if (!filePath) {
    return { ok: false, error: 'Invalid backup id' };
  }
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (data.settings) settingsStore.set(data.settings);
    if (data.localData) localDataStore.set(data.localData);
    notifySettingsChanged();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

handleIPC('delete-backup', async (event, backupId) => {
  const filePath = security.backupPath(BACKUPS_DIR(), backupId);
  if (!filePath) return { ok: false, error: 'Invalid backup id' };
  try {
    await fsp.unlink(filePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ============================================================
// IPC HANDLERS -- UPDATE MANAGEMENT
// ============================================================

let updateStatus = 'idle';

autoUpdater.on('checking-for-update', () => { updateStatus = 'checking'; });
autoUpdater.on('update-available', (info) => {
  updateStatus = 'available';
  if (mainWindow) mainWindow.webContents.send('update-available', info);
});
autoUpdater.on('update-not-available', () => { updateStatus = 'not-available'; });
autoUpdater.on('download-progress', (progress) => {
  updateStatus = 'downloading';
  if (mainWindow) mainWindow.webContents.send('update-progress', progress);
});
autoUpdater.on('update-downloaded', (info) => {
  updateStatus = 'downloaded';
  if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
});
autoUpdater.on('error', (err) => {
  updateStatus = 'error';
  if (mainWindow) mainWindow.webContents.send('update-error', err.message);
});

handleIPC('check-for-updates', async () => {
  if (!app.isPackaged) return { ok: false, reason: 'Auto-update is disabled outside of a packaged build.' };
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
handleIPC('install-update', () => {
  if (!app.isPackaged) return { ok: false, reason: 'Auto-update is disabled outside of a packaged build.' };
  autoUpdater.quitAndInstall();
});
handleIPC('get-update-status', () => updateStatus);

// ============================================================
// IPC HANDLERS -- DEEP LINKS
// ============================================================

handleIPC('handle-deep-link', (event, url) => {
  handleIncomingDeepLink(url);
  return true;
});
handleIPC('register-protocol', () => {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('fatesedge', process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient('fatesedge');
  }
  return true;
});

// ============================================================
// IPC HANDLERS -- SHORTCUTS
// ============================================================

handleIPC('register-global-shortcut', (event, shortcut) => {
  if (!shortcut || typeof shortcut !== 'string') return { ok: false, error: 'Invalid shortcut' };
  const success = globalShortcut.register(shortcut, () => {
    if (mainWindow) mainWindow.webContents.send('global-shortcut-triggered', shortcut);
  });
  if (success) registeredShortcuts.add(shortcut);
  return { ok: success };
});
handleIPC('unregister-global-shortcut', (event, shortcut) => {
  globalShortcut.unregister(shortcut);
  registeredShortcuts.delete(shortcut);
  return true;
});
handleIPC('unregister-all-shortcuts', () => {
  globalShortcut.unregisterAll();
  registeredShortcuts.clear();
  return true;
});

// ============================================================
// IPC HANDLERS -- WINDOW MANAGEMENT
// ============================================================

let nextWindowId = 1;

handleIPC('create-window', (event, options = {}) => {
  if (options.path && options.path !== 'index.html') return { ok: false, error: 'Only the bundled application may open a privileged window' };
  const id = nextWindowId++;
  const win = new BrowserWindow({
    width: options.width || 900,
    height: options.height || 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  security.secureContents(win.webContents, RENDERER_DIR);
  const target = path.join(RENDERER_DIR, 'index.html');
  if (fs.existsSync(target)) win.loadFile(target);
  secondaryWindows.set(id, win);
  win.on('closed', () => secondaryWindows.delete(id));
  return { ok: true, windowId: id };
});
handleIPC('close-window', (event, windowId) => {
  getTargetWindow(windowId)?.close();
  return true;
});
handleIPC('focus-window', (event, windowId) => {
  getTargetWindow(windowId)?.focus();
  return true;
});
handleIPC('set-window-bounds', (event, bounds) => {
  getTargetWindow()?.setBounds(bounds);
  return true;
});
handleIPC('get-window-bounds', (event) => getTargetWindow()?.getBounds() || null);
handleIPC('set-always-on-top', (event, enabled) => {
  getTargetWindow()?.setAlwaysOnTop(!!enabled);
  return true;
});
handleIPC('set-full-screen', (event, enabled) => {
  getTargetWindow()?.setFullScreen(!!enabled);
  return true;
});

// ============================================================
// IPC HANDLERS -- NOTIFICATIONS
// ============================================================

handleIPC('send-notification', (event, title, body, options = {}) => {
  if (!Notification.isSupported()) return { ok: false, error: 'Notifications not supported on this system' };
  const notification = new Notification({ title, body, silent: !!options.silent });
  notification.show();
  return { ok: true };
});
handleIPC('get-notification-permission', () => ({
  permission: Notification.isSupported() ? 'granted' : 'unsupported'
}));
handleIPC('request-notification-permission', () => ({
  permission: Notification.isSupported() ? 'granted' : 'unsupported'
}));

// ============================================================
// IPC HANDLERS -- TRAY
// ============================================================

handleIPC('set-tray-icon', (event, iconPath) => {
  try {
    const resolved = iconPath && fs.existsSync(iconPath) ? iconPath : path.join(__dirname, 'fe_icon.png');
    const image = nativeImage.createFromPath(resolved);
    if (!tray) {
      tray = new Tray(image);
      tray.on('click', () => {
        if (mainWindow) { mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show(); }
      });
    } else {
      tray.setImage(image);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
handleIPC('set-tray-tooltip', (event, tooltip) => {
  if (tray) tray.setToolTip(tooltip || '');
  return { ok: !!tray };
});
handleIPC('show-tray-context-menu', () => {
  if (!tray) return { ok: false, error: 'Tray not initialized' };
  const menu = Menu.buildFromTemplate([
    { label: 'Show Fate\'s Edge', click: () => mainWindow && mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.popUpContextMenu(menu);
  return { ok: true };
});

// ============================================================
// IPC HANDLERS -- MENU ACTIONS
// ============================================================

handleIPC('trigger-menu-action', (event, action) => {
  const handler = MENU_ACTIONS[action];
  if (!handler) return { ok: false, error: `Unknown action: ${action}` };
  handler();
  return { ok: true };
});

// ============================================================
// IPC HANDLERS -- LOGGING
// ============================================================

const LOG_LEVELS = new Set(['error', 'warn', 'info', 'debug']);

handleIPC('log', (event, level, message) => {
  const lvl = LOG_LEVELS.has(level) ? level : 'info';
  log[lvl](`[renderer] ${message}`);
  return true;
});
handleIPC('get-logs', async (event, options = {}) => {
  try {
    const filePath = log.transports.file.getFile().path;
    const raw = await fsp.readFile(filePath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const limit = options.limit || 200;
    return { ok: true, lines: lines.slice(-limit) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
handleIPC('clear-logs', async () => {
  try {
    const filePath = log.transports.file.getFile().path;
    await fsp.writeFile(filePath, '', 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
handleIPC('export-logs', async (event, targetPath) => {
  try {
    const srcPath = log.transports.file.getFile().path;
    let destPath = targetPath;
    if (!destPath) {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showSaveDialog(win, { defaultPath: 'fates-edge-logs.txt' });
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      destPath = result.filePath;
      grantPath(destPath);
    } else if (!isAllowedPath(destPath)) {
      return { ok: false, error: 'Path not permitted' };
    }
    await fsp.copyFile(srcPath, destPath);
    return { ok: true, path: destPath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ============================================================
// IPC HANDLERS -- VOICE CHAT
// ============================================================
//
// The main process has no visibility into audio input/output devices --
// that's navigator.mediaDevices in the renderer. These handlers are
// intentionally honest about that rather than returning made-up data.

handleIPC('get-audio-devices', () => ({
  ok: false,
  supported: false,
  reason: 'Audio device enumeration must happen in the renderer via navigator.mediaDevices.enumerateDevices().'
}));
handleIPC('set-audio-device', (event, deviceId, type) => {
  settingsStore.set(`audioDevice.${type || 'default'}`, deviceId);
  return { ok: true };
});
handleIPC('get-audio-device', (event, type) => settingsStore.get(`audioDevice.${type || 'default'}`) || null);
handleIPC('test-audio-device', () => ({
  ok: false,
  supported: false,
  reason: 'Audio device testing must happen in the renderer.'
}));
handleIPC('get-audio-level', () => ({ ok: false, supported: false }));

// ============================================================
// IPC HANDLERS -- GRID COMBAT / WHITEBOARD
// ============================================================

async function writeExportPayload(win, payload, format, defaultName) {
  const isImage = ['png', 'jpg', 'jpeg'].includes((format || '').toLowerCase());
  const result = await dialog.showSaveDialog(win, {
    defaultPath: defaultName,
    filters: [{ name: format ? format.toUpperCase() : 'File', extensions: [format || 'json'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  grantPath(result.filePath);

  if (isImage && typeof payload === 'string' && payload.startsWith('data:')) {
    const base64 = payload.split(',')[1] || '';
    await fsp.writeFile(result.filePath, Buffer.from(base64, 'base64'));
  } else if (typeof payload === 'string') {
    await fsp.writeFile(result.filePath, payload, 'utf8');
  } else {
    await fsp.writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
  return { ok: true, path: result.filePath };
}

handleIPC('export-grid-map', async (event, code, format) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return writeExportPayload(win, code, format, `grid-map.${format || 'json'}`);
});
handleIPC('import-grid-map', async (event, targetPath) => {
  if (!isAllowedPath(targetPath)) return { ok: false, error: 'Path not permitted' };
  try {
    const content = await fsp.readFile(targetPath, 'utf8');
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
handleIPC('export-whiteboard', async (event, code, format) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return writeExportPayload(win, code, format, `whiteboard.${format || 'json'}`);
});
handleIPC('import-whiteboard', async (event, targetPath) => {
  if (!isAllowedPath(targetPath)) return { ok: false, error: 'Path not permitted' };
  try {
    const content = await fsp.readFile(targetPath, 'utf8');
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
handleIPC('print-whiteboard', async (event, code) => {
  // 'code' is expected to be an HTML fragment/document string produced by
  // the renderer's whiteboard view. We render it in a hidden, throwaway
  // window so the OS print dialog reflects exactly what the user saw.
  const printWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  security.secureContents(printWin.webContents, RENDERER_DIR);
  try {
    await printWin.loadURL('data:text/html,' + encodeURIComponent(typeof code === 'string' ? code : String(code)));
    await new Promise((resolve, reject) => {
      printWin.webContents.print({ silent: false }, (success, reason) => {
        if (success) resolve(); else reject(new Error(reason || 'Print failed'));
      });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    printWin.close();
  }
});

// ============================================================
// IPC HANDLERS -- DOCK (macOS)
// ============================================================

handleIPC('set-dock-badge', (event, count) => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setBadge(count ? String(count) : '');
  }
  return { ok: process.platform === 'darwin' };
});
handleIPC('set-dock-menu', (event, menuItems) => {
  if (process.platform !== 'darwin' || !app.dock) return { ok: false, reason: 'macOS only' };
  // menuItems is a plain-data array of {label, action}. We can't accept
  // renderer-supplied click functions over IPC (same reason as
  // register-global-shortcut), so clicking dispatches a known action
  // string via the same 'menu-action' channel the app menu uses.
  const template = (Array.isArray(menuItems) ? menuItems : []).map((item) => ({
    label: item.label || '',
    click: () => sendMenuAction(item.action)
  }));
  app.dock.setMenu(Menu.buildFromTemplate(template));
  return { ok: true };
});

// ============================================================
// IPC HANDLERS -- SESSION MANAGEMENT
// ============================================================
//
// A "session" here is a named snapshot of the local-data store (the
// renderer's saved VTT state), not arbitrary renderer-supplied content --
// the preload API only passes a name, matching how settings/local-data
// are already tracked centrally in this process.

handleIPC('save-session', async (event, name) => {
  if (!name || typeof name !== 'string') return { ok: false, error: 'Session name required' };
  ensureDir(SESSIONS_DIR());
  const filePath = path.join(SESSIONS_DIR(), `${sanitizeFileName(name)}.json`);
  await fsp.writeFile(filePath, JSON.stringify({ name, savedAt: Date.now(), data: localDataStore.store }, null, 2), 'utf8');
  return { ok: true, path: filePath };
});
handleIPC('load-session', async (event, name) => {
  const filePath = path.join(SESSIONS_DIR(), `${sanitizeFileName(name)}.json`);
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    const session = JSON.parse(raw);
    localDataStore.set(session.data || {});
    return { ok: true, session };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
handleIPC('list-sessions', async () => {
  ensureDir(SESSIONS_DIR());
  const entries = await fsp.readdir(SESSIONS_DIR());
  const sessions = [];
  for (const entry of entries.filter((f) => f.endsWith('.json'))) {
    try {
      const raw = await fsp.readFile(path.join(SESSIONS_DIR(), entry), 'utf8');
      const data = JSON.parse(raw);
      sessions.push({ name: data.name, savedAt: data.savedAt });
    } catch (err) { /* skip corrupt session file */ }
  }
  return sessions.sort((a, b) => b.savedAt - a.savedAt);
});
handleIPC('delete-session', async (event, name) => {
  const filePath = path.join(SESSIONS_DIR(), `${sanitizeFileName(name)}.json`);
  try {
    await fsp.unlink(filePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
handleIPC('auto-save-session', async () => {
  ensureDir(SESSIONS_DIR());
  const filePath = path.join(SESSIONS_DIR(), '__autosave__.json');
  await fsp.writeFile(filePath, JSON.stringify({ name: '__autosave__', savedAt: Date.now(), data: localDataStore.store }, null, 2), 'utf8');
  return { ok: true };
});

function sanitizeFileName(name) {
  return String(name || 'session').replace(/[^a-z0-9_\-]/gi, '_').slice(0, 100);
}

// ============================================================
// IPC HANDLERS -- SCREENSHOT
// ============================================================

async function captureScreenSource(sourceId) {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 2560, height: 1600 }
  });
  if (!sources.length) throw new Error('No screen sources available');
  const source = sourceId ? sources.find((s) => s.id === sourceId) || sources[0] : sources[0];
  return source.thumbnail;
}

handleIPC('capture-screen', async (event, options = {}) => {
  try {
    const image = await captureScreenSource(options.sourceId);
    if (options.save) {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showSaveDialog(win, { defaultPath: 'screenshot.png', filters: [{ name: 'PNG', extensions: ['png'] }] });
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      grantPath(result.filePath);
      await fsp.writeFile(result.filePath, image.toPNG());
      return { ok: true, path: result.filePath };
    }
    return { ok: true, dataUrl: image.toDataURL() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
handleIPC('capture-area', async (event, bounds) => {
  try {
    const image = await captureScreenSource();
    const cropped = image.crop(bounds || { x: 0, y: 0, width: image.getSize().width, height: image.getSize().height });
    return { ok: true, dataUrl: cropped.toDataURL() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
