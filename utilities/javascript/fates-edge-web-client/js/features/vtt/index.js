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
let isDestroying = false; // Prevent reentrant destroys

function getModuleForMode(mode) {
    return mode === 'local' ? LocalVTT : ConnectedVTT;
}

function safeDestroy(module) {
    if (!module) return;
    // Only call destroy if the module exports it as a function
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

    // If mode changed or first load, destroy previous
    if (currentModule && currentModule !== Module) {
        safeDestroy(currentModule);
        currentModule = null;
        currentMode = null;
    }

    // If same module, just render (it will reattach)
    if (currentModule === Module) {
        // Ensure the container is up to date
        currentContainer = el;
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

// Re-export functions that might be needed externally (like sendMessage)
export function sendMessage(text, sender, recipient = 'all', metadata = {}) {
    if (currentModule && typeof currentModule.sendMessage === 'function') {
        return currentModule.sendMessage(text, sender, recipient, metadata);
    }
    console.warn('[VTT] No active module to send message');
}

export function isWSConnected() {
    return isConnectedToServer();
}

export function destroy() {
    // Clean up connection listener
    if (connectionListener) {
        offEvent('connected', connectionListener);
        offEvent('disconnected', connectionListener);
        connectionListener = null;
    }
    // Destroy current module
    safeDestroy(currentModule);
    currentModule = null;
    currentMode = null;
    currentContainer = null;
    console.log('[VTT] Destroyed');
}

export default {
    render,
    sendMessage,
    isWSConnected,
    destroy,
};