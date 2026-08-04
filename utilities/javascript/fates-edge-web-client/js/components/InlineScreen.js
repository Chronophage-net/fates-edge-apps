// components/InlineScreen.js
/**
 * Shared helper for "inline editor screens" — the app-wide replacement for
 * pop-up modals. Instead of floating a dialog above the current view with a
 * dark backdrop, we hide whatever's currently shown in the main content
 * area and swap in a full in-page panel with an explicit "← Back" control.
 *
 * Usage:
 *   import { openInlineScreen, closeInlineScreen } from '../../components/InlineScreen.js';
 *   const panel = openInlineScreen('my-feature-screen');
 *   panel.innerHTML = `...`;
 *   // later
 *   closeInlineScreen('my-feature-screen');
 */

const registry = new Map(); // id -> { panel, hiddenSiblings, host }

/**
 * Opens (or reuses) an inline screen panel with the given id, hiding the
 * current siblings in the host container (defaults to #app-content).
 * Returns the panel element — caller sets .innerHTML and wires up events.
 */
export function openInlineScreen(id, { hostId = 'app-content', maxWidth = null } = {}) {
    // If already open, just reuse it.
    const existing = registry.get(id);
    if (existing && existing.panel.isConnected) {
        return existing.panel;
    }

    const host = document.getElementById(hostId) || document.body;

    const panel = document.createElement('div');
    panel.id = id;
    panel.className = 'editor-screen-host';

    const hiddenSiblings = Array.from(host.children);
    hiddenSiblings.forEach(ch => { ch.style.display = 'none'; });

    host.appendChild(panel);
    window.scrollTo({ top: 0 });

    registry.set(id, { panel, hiddenSiblings, host });
    return panel;
}

/**
 * Closes the inline screen with the given id and restores whatever it hid.
 */
export function closeInlineScreen(id) {
    const entry = registry.get(id);
    if (!entry) return;

    if (entry.panel && entry.panel.parentNode) {
        entry.panel.parentNode.removeChild(entry.panel);
    }
    entry.hiddenSiblings.forEach(ch => { ch.style.display = ''; });
    registry.delete(id);
}

/**
 * Convenience: wraps HTML in the standard `.editor-screen` card with a
 * "← Back" button whose id is `${id}-back`.
 */
export function inlineScreenShell(id, title, bodyHtml, { backLabel = '← Back', maxWidth = '700px' } = {}) {
    return `
        <div class="editor-screen" style="max-width:${maxWidth};margin:0 auto;">
            <button id="${id}-back" class="btn btn-secondary editor-back">${backLabel}</button>
            ${title ? `<h2>${title}</h2>` : ''}
            ${bodyHtml}
        </div>
    `;
}
