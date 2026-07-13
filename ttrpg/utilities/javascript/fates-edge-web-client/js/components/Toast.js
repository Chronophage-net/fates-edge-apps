import { escHtml } from '../core/utils.js';

let container = null;

/**
 * Get or create the toast container
 */
function getContainer() {
    if (!container) {
        container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
    }
    return container;
}

/**
 * Show a toast notification
 */
export function showToast(msg, type = 'info', duration = 4000) {
    const c = getContainer();
    const t = document.createElement('div');
    t.className = 'toast';
    
    // Style based on type
    const colors = {
        error: 'var(--red)',
        success: 'var(--green)',
        warning: 'var(--gold)',
        info: 'var(--gold)'
    };
    t.style.borderLeft = `4px solid ${colors[type] || colors.info}`;
    
    t.innerHTML = `<span>${escHtml(msg)}</span><button onclick="this.parentElement.remove()">✕</button>`;
    c.appendChild(t);
    
    setTimeout(() => {
        if (t.parentElement) t.remove();
    }, duration);
}

/**
 * Convenience methods
 */
export const toast = {
    info: (msg, duration) => showToast(msg, 'info', duration),
    success: (msg, duration) => showToast(msg, 'success', duration),
    warning: (msg, duration) => showToast(msg, 'warning', duration),
    error: (msg, duration) => showToast(msg, 'error', duration)
};
