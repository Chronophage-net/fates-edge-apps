/**
 * VTT – Main entry point
 * Selects Local or Connected module based on WebSocket availability.
 */

import { isConnectedToServer, onEvent, offEvent } from '../../core/websocket.js';
import * as LocalVTT from './vtt-local.js';
import * as ConnectedVTT from './vtt-connected.js';

let currentModule = null;
let currentMode = null;
let currentContainer = null;
let connectionListener = null;

function getModuleForMode(mode) {
    return mode === 'local' ? LocalVTT : ConnectedVTT;
}

function renderModule(el) {
    const isConnected = isConnectedToServer();
    const mode = isConnected ? 'connected' : 'local';
    const Module = getModuleForMode(mode);

    // Destroy previous module if different
    if (currentModule && currentModule !== Module) {
        try {
            currentModule.destroy();
        } catch (e) {
            console.warn('[VTT] Error destroying previous module:', e);
        }
        currentModule = null;
    }

    // If same module, just render (it will reattach)
    if (currentModule === Module) {
        Module.render(el);
        return;
    }

    // First time or mode change
    currentModule = Module;
    currentMode = mode;
    currentContainer = el;
    Module.render(el);
    console.log(`[VTT] Switched to ${mode} mode`);
}

export function render(el) {
    // Ensure we are listening to connection changes
    if (!connectionListener) {
        connectionListener = (connected) => {
            if (currentContainer) {
                // Re-render with the correct mode
                renderModule(currentContainer);
            }
        };
        onEvent('connected', connectionListener);
        onEvent('disconnected', connectionListener);
    }
    renderModule(el);
}

export function destroy() {
    if (connectionListener) {
        offEvent('connected', connectionListener);
        offEvent('disconnected', connectionListener);
        connectionListener = null;
    }
    if (currentModule) {
        try {
            currentModule.destroy();
        } catch (e) {
            console.warn('[VTT] Error destroying module:', e);
        }
        currentModule = null;
        currentMode = null;
        currentContainer = null;
    }
}

// Re-export functions that might be needed externally (like sendMessage)
export function sendMessage(text, sender, recipient = 'all', metadata = {}) {
    if (currentModule && currentModule.sendMessage) {
        return currentModule.sendMessage(text, sender, recipient, metadata);
    }
    console.warn('[VTT] No active module to send message');
}

export function isWSConnected() {
    return isConnectedToServer();
}

export default {
    render,
    destroy,
    sendMessage,
    isWSConnected,
};
