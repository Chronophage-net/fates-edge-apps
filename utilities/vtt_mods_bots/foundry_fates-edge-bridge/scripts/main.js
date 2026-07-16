/**
 * Fate's Edge Bridge v1.2.0 - Main Entry Point
 * Supports Deck of Consequences, Crown Spread, Modules, Regions, and GM Election/Promotion
 */

import { FatesEdgeBridge } from './bridge.js';
import { registerSettings } from './settings.js';

// ============================================================
// Module Registration
// ============================================================

Hooks.once('init', () => {
    console.log('⚔️ Fate\'s Edge Bridge v1.2.0 initializing...');
    
    // Register settings
    registerSettings();
    
    // Register hooks
    FatesEdgeBridge.initialize();
    
    // Add status bar UI
    addStatusBarUI();
    
    // Listen for GM state changes
    Hooks.on('fates-edge-gm-state-changed', (state) => {
        updateGmPanel(state);
    });
    
    console.log('⚔️ Fate\'s Edge Bridge v1.2.0 initialized (with GM support)');
});

Hooks.once('ready', () => {
    // Auto-connect if enabled
    if (game.settings.get('fates-edge-bridge', 'autoConnect')) {
        setTimeout(() => {
            FatesEdgeBridge.connect();
        }, 2000);
    }
});

// ============================================================
// Status Bar UI
// ============================================================

let gmDialog = null;
let gmDialogRendered = false;

function addStatusBarUI() {
    const statusBar = document.getElementById('ui-left');
    if (!statusBar) return;
    
    // Check if already added
    if (document.getElementById('fates-edge-status-container')) return;
    
    const container = document.createElement('div');
    container.id = 'fates-edge-status-container';
    container.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: 8px;
        padding: 4px 10px;
        background: rgba(0, 0, 0, 0.6);
        border-radius: 4px;
        font-size: 12px;
        cursor: default;
        border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    
    container.innerHTML = `
        <span id="fates-edge-status" style="color: #747f8d;">⚪ Disconnected</span>
        <span id="fates-edge-deck" style="color: #d4af37;">🃏 54</span>
        <span id="fates-edge-voice" style="color: #747f8d;">🎤 Off</span>
        <span id="fates-edge-region" style="color: #8ac49a;">📍 ${game.settings.get('fates-edge-bridge', 'defaultRegion') || 'Acasia'}</span>
        <button id="fates-edge-gm-btn" style="
            background: rgba(212, 175, 55, 0.2);
            border: 1px solid #d4af37;
            border-radius: 4px;
            color: #d4af37;
            padding: 2px 8px;
            font-size: 11px;
            cursor: pointer;
            transition: background 0.2s;
        ">👑 GM</button>
    `;
    
    // Click on status container toggles connection (except on buttons)
    container.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (FatesEdgeBridge.connected) {
            FatesEdgeBridge.disconnect();
        } else {
            FatesEdgeBridge.connect();
        }
    });
    
    // GM button opens/closes GM panel
    const gmBtn = container.querySelector('#fates-edge-gm-btn');
    gmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleGmPanel();
    });
    
    statusBar.prepend(container);
}

// ============================================================
// GM Panel Management
// ============================================================

function toggleGmPanel() {
    if (gmDialog && gmDialog.rendered) {
        gmDialog.close();
        gmDialog = null;
        return;
    }
    openGmPanel();
}

function openGmPanel() {
    const state = {
        clients: FatesEdgeBridge.clients,
        gmId: FatesEdgeBridge.gmId,
        pendingRequests: FatesEdgeBridge.pendingRequests,
        myRole: FatesEdgeBridge.myRole,
        currentGM: FatesEdgeBridge.getCurrentGM(),
        clientId: FatesEdgeBridge.clientId
    };
    
    const content = buildGmPanelContent(state);
    
    gmDialog = new Dialog({
        title: '👑 Game Master Management',
        content: content,
        buttons: {
            close: {
                label: 'Close',
                callback: () => {
                    gmDialog = null;
                }
            }
        },
        default: 'close',
        render: (html) => {
            attachGmPanelEvents(html);
            gmDialogRendered = true;
        },
        close: () => {
            gmDialog = null;
            gmDialogRendered = false;
        }
    });
    
    gmDialog.render(true);
}

function buildGmPanelContent(state) {
    const gm = state.currentGM;
    const gmName = gm ? (gm.name || gm.data?.name || gm.id) : 'None';
    const isGM = state.myRole === 'gm';
    const pending = state.pendingRequests || [];
    const hasPending = pending.length > 0;
    
    let html = `
        <div style="padding: 10px; font-family: inherit;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #444;">
                <div>
                    <span style="font-weight: bold; color: #d4af37;">Current GM:</span>
                    <span id="gm-display" style="margin-left: 8px;">${gmName}</span>
                </div>
                <div>
                    <span id="gm-role-badge" style="
                        background: ${isGM ? '#d4af37' : '#444'};
                        color: ${isGM ? '#222' : '#aaa'};
                        padding: 2px 10px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: bold;
                    ">${isGM ? 'You are GM' : 'Player'}</span>
                </div>
            </div>
            <div id="gm-actions" style="margin-bottom: 10px;">
                ${isGM ? `
                    <button id="gm-resign-btn" style="
                        background: #d9534f;
                        border: none;
                        color: white;
                        padding: 6px 14px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Resign GM</button>
                ` : `
                    <button id="gm-request-btn" style="
                        background: #d4af37;
                        border: none;
                        color: #222;
                        padding: 6px 14px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Request GM</button>
                `}
            </div>
            <div id="gm-pending-requests" style="
                ${hasPending ? '' : 'display: none;'}
                margin-top: 10px;
                border-top: 1px solid #444;
                padding-top: 10px;
            ">
                <span style="font-weight: bold; color: #faa61a;">Pending Requests:</span>
                <div id="gm-requests-list" style="margin-top: 5px;">
                    ${pending.map(r => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #333;">
                            <span>${r.requesterName}</span>
                            ${isGM ? `
                                <div>
                                    <button class="gm-approve" data-target="${r.requesterId}" style="
                                        background: #43b581;
                                        border: none;
                                        color: white;
                                        padding: 2px 10px;
                                        border-radius: 3px;
                                        cursor: pointer;
                                        margin-right: 4px;
                                    ">Approve</button>
                                    <button class="gm-reject" data-target="${r.requesterId}" style="
                                        background: #d9534f;
                                        border: none;
                                        color: white;
                                        padding: 2px 10px;
                                        border-radius: 3px;
                                        cursor: pointer;
                                    ">Reject</button>
                                </div>
                            ` : `
                                <span style="color: #888; font-size: 0.8em;">(waiting for GM)</span>
                            `}
                        </div>
                    `).join('')}
                </div>
            </div>
            <div id="gm-clients-list" style="margin-top: 15px; border-top: 1px solid #444; padding-top: 10px;">
                <span style="font-weight: bold; color: #8ac49a;">👥 Clients (${state.clients.size}):</span>
                <div style="margin-top: 5px; max-height: 150px; overflow-y: auto; font-size: 0.9em;">
                    ${Array.from(state.clients.values()).map(c => {
                        const name = c.name || c.data?.name || c.id;
                        const role = c.role || 'player';
                        const isGM = c.id === state.gmId ? '👑 ' : '';
                        const isSelf = c.id === state.clientId ? ' (you)' : '';
                        return `<div style="padding: 2px 0;">${isGM}${name}${isSelf} — <span style="color: #aaa;">${role}</span></div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
    return html;
}

function attachGmPanelEvents(html) {
    // Request GM button
    const requestBtn = html.find('#gm-request-btn');
    if (requestBtn.length) {
        requestBtn.on('click', () => {
            FatesEdgeBridge.requestGM();
            ui.notifications.info('GM request sent. Waiting for approval.');
        });
    }
    
    // Resign GM button
    const resignBtn = html.find('#gm-resign-btn');
    if (resignBtn.length) {
        resignBtn.on('click', () => {
            // Resign is not directly supported by server, but we can send a request to demote self?
            // For now, inform the user.
            ui.notifications.info('To resign, approve a pending request or use /vtt gm approve to promote someone else.');
            // Option: we could send request_gm again to trigger a vote? Not ideal.
        });
    }
    
    // Approve/Reject buttons
    html.find('.gm-approve').on('click', function() {
        const targetId = $(this).data('target');
        if (targetId) {
            FatesEdgeBridge.approveGM(targetId);
            // Remove from pending list optimistically (already done in bridge)
            // The dialog will be refreshed by the hook
        }
    });
    
    html.find('.gm-reject').on('click', function() {
        const targetId = $(this).data('target');
        if (targetId) {
            // Reject just removes from pending list locally
            FatesEdgeBridge.pendingRequests = FatesEdgeBridge.pendingRequests.filter(r => r.requesterId !== targetId);
            FatesEdgeBridge._updateGmUI(); // triggers hook
            ui.notifications.info(`Rejected request from ${targetId}`);
        }
    });
}

function updateGmPanel(state) {
    // If the GM dialog is open, refresh its content
    if (gmDialog && gmDialog.rendered) {
        const content = buildGmPanelContent(state);
        gmDialog.data.content = content;
        gmDialog.render(true);
        // Reattach events after render
        gmDialog.element.then((html) => {
            attachGmPanelEvents(html);
        });
    }
    
    // Also update the status bar GM button style
    const gmBtn = document.getElementById('fates-edge-gm-btn');
    if (gmBtn) {
        if (state.myRole === 'gm') {
            gmBtn.style.background = 'rgba(212, 175, 55, 0.4)';
            gmBtn.style.borderColor = '#d4af37';
            gmBtn.style.color = '#fff';
        } else {
            gmBtn.style.background = 'rgba(212, 175, 55, 0.15)';
            gmBtn.style.borderColor = '#d4af37';
            gmBtn.style.color = '#d4af37';
        }
    }
}

// ============================================================
// Helper Functions for Macros
// ============================================================

// Global access for macro use
window.FatesEdgeBridge = FatesEdgeBridge;

// Quick macro functions
window.drawCard = function(count = 1) {
    FatesEdgeBridge.sendDeckDraw(count);
};

window.crownSpread = function(region = null) {
    FatesEdgeBridge.sendCrownSpread(region);
};

window.shuffleDeck = function() {
    FatesEdgeBridge.sendDeckShuffle();
};

window.setRegion = function(region) {
    FatesEdgeBridge.defaultRegion = region;
    FatesEdgeBridge._sendRegionUpdate(region);
    ui.notifications.info(`📍 Region set to: ${region}`);
};

window.listModules = function() {
    FatesEdgeBridge.sendModuleList();
};

window.getDeckStatus = function() {
    return {
        remaining: FatesEdgeBridge.deckState.remaining,
        history: FatesEdgeBridge.deckState.history.length
    };
};

// GM macro helpers
window.requestGM = function() {
    FatesEdgeBridge.requestGM();
};

window.approveGM = function(targetId) {
    FatesEdgeBridge.approveGM(targetId);
};

window.getGMStatus = function() {
    const gm = FatesEdgeBridge.getCurrentGM();
    return {
        currentGM: gm ? (gm.name || gm.id) : null,
        isGM: FatesEdgeBridge.myRole === 'gm',
        pendingRequests: FatesEdgeBridge.pendingRequests.length,
        clients: FatesEdgeBridge.clients.size
    };
};

// ============================================================
// CSS for status bar and GM panel
// ============================================================

const style = document.createElement('style');
style.textContent = `
    #fates-edge-status-container {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: 8px;
        padding: 4px 10px;
        background: rgba(0, 0, 0, 0.6);
        border-radius: 4px;
        font-size: 12px;
        cursor: default;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    #fates-edge-status-container:hover {
        background: rgba(0, 0, 0, 0.8);
        border-color: rgba(212, 175, 55, 0.3);
    }
    
    #fates-edge-status-container .status-item {
        cursor: default;
    }
    
    #fates-edge-status {
        min-width: 90px;
        cursor: pointer;
    }
    
    #fates-edge-deck {
        min-width: 40px;
        font-weight: bold;
        cursor: pointer;
    }
    
    #fates-edge-voice {
        min-width: 50px;
        cursor: pointer;
    }
    
    #fates-edge-region {
        min-width: 70px;
        cursor: pointer;
    }
    
    #fates-edge-gm-btn {
        background: rgba(212, 175, 55, 0.15);
        border: 1px solid #d4af37;
        border-radius: 4px;
        color: #d4af37;
        padding: 2px 8px;
        font-size: 11px;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
    }
    
    #fates-edge-gm-btn:hover {
        background: rgba(212, 175, 55, 0.3);
    }
    
    .fates-edge-status-connected {
        color: #43b581 !important;
    }
    
    .fates-edge-status-disconnected {
        color: #f04747 !important;
    }
    
    .fates-edge-status-connecting {
        color: #faa61a !important;
    }
    
    /* GM panel dialog overrides */
    .gm-approve, .gm-reject {
        transition: background 0.2s;
    }
    .gm-approve:hover {
        background: #2d8f6a !important;
    }
    .gm-reject:hover {
        background: #b94541 !important;
    }
    #gm-request-btn:hover {
        background: #e6c84d !important;
    }
    #gm-resign-btn:hover {
        background: #c9302c !important;
    }
`;
document.head.appendChild(style);