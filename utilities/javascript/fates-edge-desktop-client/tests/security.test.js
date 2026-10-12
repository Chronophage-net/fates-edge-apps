const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');
const security = require('../security');

test('privileged renderer URLs are limited to the bundled entry point', () => {
  const root = path.resolve('/tmp/fates-renderer');
  const valid = pathToFileURL(path.join(root, 'index.html')).href;
  assert(security.isRendererUrl(valid + '#docs', root));
  for (const value of ['https://evil.example/', 'file:///etc/passwd', valid + '?redirect=evil',
    pathToFileURL(path.join(root, 'data', 'import.html')).href, 'data:text/html,test']) {
    assert.equal(security.isRendererUrl(value, root), false, value);
  }
  const sender = { mainFrame: { url: valid } };
  assert(security.isTrustedSender({ sender, senderFrame: sender.mainFrame }, root, [sender]));
  assert.equal(security.isTrustedSender({ sender, senderFrame: { url: valid } }, root, [sender]), false);
  assert.equal(security.isTrustedSender({ sender, senderFrame: sender.mainFrame }, root, []), false);
  assert.equal(security.isTrustedSender({ sender, senderFrame: null }, root, [sender]), false);
});

test('navigation, redirects, popups and webviews cannot open privileged untrusted content', () => {
  const contents = new EventEmitter();
  contents.setWindowOpenHandler = handler => { contents.open = handler; };
  const root = path.resolve('/tmp/fates-renderer');
  security.secureContents(contents, root);
  assert.deepEqual(contents.open({ url: 'https://evil.example' }), { action: 'deny' });
  for (const event of ['will-navigate', 'will-redirect', 'will-attach-webview']) {
    let blocked = false;
    contents.emit(event, { preventDefault() { blocked = true; } }, 'https://evil.example');
    assert(blocked, event);
  }
});

test('file grants and backup IDs reject traversal and symlink escapes', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-security-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const allowed = path.join(root, 'allowed'), outside = path.join(root, 'outside');
  fs.mkdirSync(allowed); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(allowed, 'escape'), 'dir');
  assert(security.isAllowedPath(path.join(allowed, 'new.json'), [allowed]));
  assert.equal(security.isAllowedPath(path.join(allowed, 'escape', 'new.json'), [allowed]), false);
  assert.equal(security.isAllowedPath(outside, [allowed]), false);
  assert(security.backupPath(allowed, 'backup-123'));
  for (const id of ['../../settings', '../allowed-other/file', '/tmp/file', 'backup-1/../../x', null, {}]) {
    assert.equal(security.backupPath(allowed, id), null);
  }
  fs.symlinkSync(path.join(outside, 'new.json'), path.join(allowed, 'backup-9.json'));
  // Dangling symlinks must not grant an apparent in-root destination.
  assert.equal(security.backupPath(allowed, 'backup-9'), null);
});

test('preload callbacks never expose IPC events and can be removed', () => {
  const ipc = new EventEmitter(); let api;
  vm.runInNewContext(fs.readFileSync(require.resolve('../preload'), 'utf8'), {
    require: () => ({ ipcRenderer: ipc, contextBridge: { exposeInMainWorld: (_key, value) => { api = value; } } }),
    process: { platform: 'test', versions: {} }, window: { addEventListener() {} },
  });
  const received = [];
  const callback = (...args) => received.push(args);
  api.onUpdateAvailable(callback);
  ipc.emit('update-available', { sender: { dangerous: true } }, { version: 'safe' });
  assert.equal(received[0][0], null);
  assert.deepEqual(received[0][1], { version: 'safe' });
  api.removeListener('update-available', callback);
  ipc.emit('update-available', {}, {});
  assert.equal(received.length, 1);
});

test('every IPC handler is gated and both windows are sandboxed', () => {
  const source = fs.readFileSync(require.resolve('../electron'), 'utf8');
  assert.equal((source.match(/^\s*ipcMain\.handle\(/gm) || []).length, 1); // gated registration only
  assert(!source.includes('sandbox: false'));
  assert.equal((source.match(/sandbox: true/g) || []).length, 3); // app, secondary, print
  assert(source.includes("options.path !== 'index.html'"));
});
