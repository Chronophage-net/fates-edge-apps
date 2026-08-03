/**
 * VTT – Main entry point
 * Selects Local or Connected module based on WebSocket availability.
 * Exposes window.sendToVTT for other modules to post messages/cards.
 */

import { isConnectedToServer, onEvent, offEvent } from '../../core/websocket.js';
import * as LocalVTT from './vtt-local.js';
import * as ConnectedVTT from './vtt-connected.js';

let currentModule = null;
let currentMode = null;
let currentContainer = null;
let connectionListener = null;
let isDestroying = false;

function getModuleForMode(mode) {
    return mode === 'local' ? LocalVTT : ConnectedVTT;
}

function safeDestroy(module) {
    if (!module) return;
    if (typeof module.destroy === 'function') {
        try {
            module.destroy();
        } catch (e) {
            console.warn('[VTT] Error destroying module:', e);
        }
    }
}

function renderModule(el) {
    const isConnected = isConnectedToServer();
    const mode = isConnected ? 'connected' : 'local';
    const Module = getModuleForMode(mode);

    if (currentModule && currentModule !== Module) {
        safeDestroy(currentModule);
        currentModule = null;
        currentMode = null;
    }

    if (currentModule === Module) {
        currentContainer = el;
        Module.render(el);
        return;
    }

    currentModule = Module;
    currentMode = mode;
    currentContainer = el;
    Module.render(el);

    // ─── Expose global send function ──────────────────────────
    // Other modules can call window.sendToVTT(text, sender, options)
    // where options: { isHTML: boolean, recipient: string, metadata: object }
    // If sender is 'System' or 'GM' and isHTML is true, the message is sanitised.
    if (typeof Module.sendMessage === 'function') {
        window.sendToVTT = (text, sender = 'System', options = {}) => {
            const { isHTML = false, recipient = 'all', metadata = {} } = options;
            // Only allow HTML for trusted senders
            if (isHTML && sender !== 'System' && sender !== 'GM') {
                console.warn('[VTT] HTML messages only allowed for System or GM senders.');
                return false;
            }
            // The renderer in vtt-core already treats System/GM as trusted and sanitises.
            Module.sendMessage(text, sender, recipient, metadata);
            return true;
        };
        console.log('[VTT] Global sendToVTT exposed');
    }

    console.log(`[VTT] Switched to ${mode} mode`);
}

export function render(el) {
    if (!connectionListener) {
        connectionListener = (connected) => {
            if (currentContainer) {
                renderModule(currentContainer);
            }
        };
        onEvent('connected', connectionListener);
        onEvent('disconnected', connectionListener);
    }
    renderModule(el);
}

export function sendMessage(text, sender, recipient = 'all', metadata = {}) {
    if (currentModule && typeof currentModule.sendMessage === 'function') {
        return currentModule.sendMessage(text, sender, recipient, metadata);
    }
    console.warn('[VTT] No active module to send message');
    return false;
}

export function isWSConnected() {
    return isConnectedToServer();
}

export function destroy() {
    if (connectionListener) {
        offEvent('connected', connectionListener);
        offEvent('disconnected', connectionListener);
        connectionListener = null;
    }
    safeDestroy(currentModule);
    currentModule = null;
    currentMode = null;
    currentContainer = null;
    // Clean up global
    if (window.sendToVTT) delete window.sendToVTT;
    console.log('[VTT] Destroyed');
}

export default {
    render,
    sendMessage,
    isWSConnected,
    destroy,
};