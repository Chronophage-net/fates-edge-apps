const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

// Resolve existing ancestors too, so a new file under a symlink cannot
// escape the approved directory. Fail closed on errors other than ENOENT.
function canonicalPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) return null;
  let current = path.resolve(value);
  const missing = [];
  for (;;) {
    try { return path.join(fs.realpathSync(current), ...missing.reverse()); }
    catch (error) {
      if (error.code !== 'ENOENT') return null;
      try { if (fs.lstatSync(current).isSymbolicLink()) return null; }
      catch (statError) { if (statError.code !== 'ENOENT') return null; }
      const parent = path.dirname(current);
      if (parent === current) return null;
      missing.push(path.basename(current)); current = parent;
    }
  }
}

function isAllowedPath(value, roots, grants = new Set()) {
  const candidate = canonicalPath(value);
  if (!candidate) return false;
  if (grants.has(candidate)) return true;
  return roots.some(root => {
    const canonical = canonicalPath(root);
    return canonical && (candidate === canonical || candidate.startsWith(canonical + path.sep));
  });
}

function isRendererUrl(value, rendererDir) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'file:' || url.host || url.search) return false;
    return path.resolve(fileURLToPath(url)) === path.resolve(rendererDir, 'index.html');
  } catch { return false; }
}

function isTrustedSender(event, rendererDir, contents) {
  try {
    return contents.includes(event.sender) && !!event.senderFrame
      && event.senderFrame === event.sender.mainFrame
      && isRendererUrl(event.senderFrame.url, rendererDir);
  } catch { return false; }
}

function secureContents(contents, rendererDir) {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (!isRendererUrl(url, rendererDir)) event.preventDefault();
  });
  contents.on('will-redirect', (event, url) => {
    if (!isRendererUrl(url, rendererDir)) event.preventDefault();
  });
  contents.on('will-attach-webview', event => event.preventDefault());
}

function backupPath(root, id) {
  if (typeof id !== 'string' || !/^backup-\d{1,20}$/.test(id)) return null;
  const candidate = path.join(root, `${id}.json`);
  return isAllowedPath(candidate, [root]) ? candidate : null;
}

module.exports = { canonicalPath, isAllowedPath, isRendererUrl, isTrustedSender, secureContents, backupPath };
