/**
 * Fate's Edge Desktop Client - Renderer Integration Bridge
 *
 * Loaded as a plain <script> (not a module) after the web client's own
 * bundle, only in the desktop app's copied renderer/ -- this file is
 * injected by scripts/copy-renderer.js and does NOT exist in the shared
 * fates-edge-web-client source, so the browser deployment is unaffected.
 *
 * SCOPE: the web client's core feature code (js/core, js/features/...)
 * currently makes zero calls to window.electronAPI -- rewiring every
 * feature to be Electron-aware is a much larger change to a codebase
 * that's also shipped as a plain website, and wasn't part of this pass.
 * What's here is the safe, generic integration that doesn't require the
 * web client to know Electron exists: external links, native
 * notifications/dock badge using an existing public hook
 * (the 'ws-message' CustomEvent already dispatched on window by
 * js/core/websocket.js), and small documented extension points
 * (window.fatesEdgeElectron.*, 'fates-edge:*' events) that feature code
 * can opt into later without needing an Electron-specific rewrite.
 */

(function () {
  if (!window.isElectron || !window.electronAPI) return;

  const api = window.electronAPI;

  // ------------------------------------------------------------
  // External links: open in the OS browser instead of navigating the
  // app window away or spawning an unmanaged BrowserWindow.
  // ------------------------------------------------------------

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest && event.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) {
      event.preventDefault();
      api.openExternal(href);
    }
  });

  const nativeOpen = window.open;
  window.open = function (url, ...rest) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      api.openExternal(url);
      return null;
    }
    return nativeOpen.call(window, url, ...rest);
  };

  // ------------------------------------------------------------
  // Unread activity -> dock badge + native notification when the window
  // isn't focused. Uses the 'ws-message' event js/core/websocket.js
  // already dispatches on window -- no web-client changes needed.
  // ------------------------------------------------------------

  let unread = 0;
  let windowFocused = true;

  api.onWindowFocus(() => {
    windowFocused = true;
    unread = 0;
    api.setDockBadge(0);
  });
  api.onWindowBlur(() => { windowFocused = false; });

  window.addEventListener('ws-message', (event) => {
    if (windowFocused) return;
    unread += 1;
    api.setDockBadge(unread);
    const detail = event.detail || {};
    const summary = detail.text || detail.message || detail.type || 'New activity';
    api.sendNotification("Fate's Edge", String(summary).slice(0, 200));
  });

  // ------------------------------------------------------------
  // Menu / deep-link plumbing: re-dispatch as DOM CustomEvents so
  // feature code can listen without importing electronAPI directly.
  // ------------------------------------------------------------

  api.onMenuAction((event, action) => {
    window.dispatchEvent(new CustomEvent('fates-edge:menu-action', { detail: action }));
    if (action === 'open-settings') {
      // Best-effort: click a settings nav item if the current UI has one.
      const settingsNav = document.querySelector('[data-feature="settings"], #nav-settings, [href="#settings"]');
      if (settingsNav) settingsNav.click();
    }
  });

  api.onDeepLink((event, payload) => {
    window.dispatchEvent(new CustomEvent('fates-edge:deep-link', { detail: payload }));
  });

  api.onConnectionCommand((event, command) => {
    window.dispatchEvent(new CustomEvent('fates-edge:connection-command', { detail: command }));
  });

  window.addEventListener('beforeunload', () => {
    api.reportConnectionStatus({ status: 'closing' });
  });

  // ------------------------------------------------------------
  // Documented extension points for feature code to opt into later.
  // ------------------------------------------------------------

  window.fatesEdgeElectron = {
    notify: (title, body) => api.sendNotification(title, body),
    reportConnectionStatus: (status) => api.reportConnectionStatus(status),
    saveExport: (content, defaultName, options) => api.saveFile(content, defaultName, options)
  };

  console.log('[ElectronBridge] Fate\'s Edge desktop integration ready');
})();
