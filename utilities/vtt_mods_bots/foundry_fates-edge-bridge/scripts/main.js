/**
 * Fate's Edge Bridge v2.1.0 - Main Entry Point
 * Supports Deck of Consequences, Crown Spread, Modules, Regions, and GM Election/Promotion
 */

import { FatesEdgeBridge } from './bridge.js';
import { registerSettings } from './settings.js';

// The GM panel's Dialog content is built as an HTML string and rendered
// via jQuery, same as bridge.js's ChatMessage content -- so display names
// that arrive over the WebSocket (requesterName, client name) need the
// same escaping before being interpolated in, or a malicious peer could
// inject HTML into the panel every connected client/GM sees.
function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Accessibility (see the web client's ACCESSIBILITY.md, "Foundry bridge
// CONFIG.ariaLabels" item): several controls in the status bar and GM
// panel below are icon-only or use short, ambiguous text ("👑", "Set", a
// bare role <select>) that isn't a useful accessible name on its own.
// Rather than hardcoding only English labels, this checks for a
// `CONFIG.ariaLabels` override first -- a lightweight, opt-in convention
// some Foundry modules/systems use so a GM's own localization/naming
// choices propagate across every module's UI instead of each one
// hardcoding its own -- and falls back to our own English text when the
// host instance doesn't define one. `CONFIG.ariaLabels` is not part of
// Foundry's core API, so this is written defensively: if it's undefined
// (the common case today), `ariaLabel()` is just a passthrough to
// `fallback` and nothing here depends on it existing.
function ariaLabel(key, fallback) {
    const override = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.ariaLabels) ? CONFIG.ariaLabels[key] : null;
    return (typeof override === 'string' && override.trim()) ? override : fallback;
}

// ============================================================
// Module Registration
// ============================================================

Hooks.once('init', () => {
    console.log('⚔️ Fate\'s Edge Bridge v2.1.0 initializing...');
    
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
    
    console.log('⚔️ Fate\'s Edge Bridge v2.1.0 initialized (with GM support)');
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
        <button id="fates-edge-gm-btn" aria-label="${escapeHtml(ariaLabel('fatesEdgeGmPanel', 'Open Game Master management panel'))}" style="
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
                    <span id="gm-display" style="margin-left: 8px;">${escapeHtml(gmName)}</span>
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
                    <button id="gm-resign-btn" aria-label="${escapeHtml(ariaLabel('fatesEdgeResignGm', 'Resign as Game Master'))}" style="
                        background: #d9534f;
                        border: none;
                        color: white;
                        padding: 6px 14px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Resign GM</button>
                ` : `
                    <button id="gm-request-btn" aria-label="${escapeHtml(ariaLabel('fatesEdgeRequestGm', 'Request the Game Master role'))}" style="
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
                            <span>${escapeHtml(r.requesterName)}</span>
                            ${isGM ? `
                                <div>
                                    <button class="gm-approve" data-target="${r.requesterId}" aria-label="${escapeHtml(ariaLabel('fatesEdgeApproveGmRequest', `Approve ${r.requesterName}'s Game Master request`))}" style="
                                        background: #43b581;
                                        border: none;
                                        color: white;
                                        padding: 2px 10px;
                                        border-radius: 3px;
                                        cursor: pointer;
                                        margin-right: 4px;
                                    ">Approve</button>
                                    <button class="gm-reject" data-target="${r.requesterId}" aria-label="${escapeHtml(ariaLabel('fatesEdgeRejectGmRequest', `Reject ${r.requesterName}'s Game Master request`))}" style="
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
                <div style="margin-top: 5px; max-height: 200px; overflow-y: auto; font-size: 0.9em;">
                    ${Array.from(state.clients.values()).map(c => {
                        const name = c.name || c.data?.name || c.id;
                        const role = c.role || 'player';
                        const isRowGM = c.id === state.gmId ? '👑 ' : '';
                        const isSelf = c.id === state.clientId ? ' (you)' : '';
                        // NEW: role-change controls (Co-GM / Assistant GM /
                        // Player / Spectator), same as the Roll20
                        // integration's `!fates-edge role set` chat command
                        // and Discord bot's `/vttadmin role` -- only shown
                        // to the current GM, and never for the GM's own row
                        // (reassigning the GM seat itself goes through the
                        // separate Resign/Request GM flow above, not this).
                        const canAssign = isGM && role !== 'gm';
                        const roleControl = canAssign ? `
                            <span style="display: inline-flex; align-items: center; gap: 4px;">
                                <select class="gm-role-select" data-target="${c.id}" data-current="${escapeHtml(role)}" aria-label="${escapeHtml(ariaLabel('fatesEdgeRoleSelect', `Change role for ${name}`))}" style="font-size: 0.85em; padding: 1px 3px;">
                                    <option value="co-gm" ${role === 'co-gm' ? 'selected' : ''}>Co-GM</option>
                                    <option value="assistant-gm" ${role === 'assistant-gm' ? 'selected' : ''}>Assistant GM</option>
                                    <option value="player" ${role === 'player' ? 'selected' : ''}>Player</option>
                                    <option value="spectator" ${role === 'spectator' ? 'selected' : ''}>Spectator</option>
                                </select>
                                <label style="font-size: 0.75em; color: #888; cursor: pointer;" title="Persist this grant across reconnects (demotions always persist)">
                                    <input type="checkbox" class="gm-role-persist" data-target="${c.id}" aria-label="${escapeHtml(ariaLabel('fatesEdgeRolePersist', `Persist ${name}'s role grant across reconnects`))}" style="vertical-align: middle;"> save
                                </label>
                                <button class="gm-role-apply" data-target="${c.id}" aria-label="${escapeHtml(ariaLabel('fatesEdgeRoleApply', `Apply role change for ${name}`))}" style="
                                    background: #4a90d9; border: none; color: white;
                                    padding: 1px 8px; border-radius: 3px; cursor: pointer; font-size: 0.85em;
                                ">Set</button>
                            </span>
                        ` : `<span style="color: #aaa;">${escapeHtml(role)}</span>`;
                        return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0;"><span>${isRowGM}${escapeHtml(name)}${isSelf}</span>${roleControl}</div>`;
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

    // NEW: role-change "Set" button -- reads the paired <select>/checkbox
    // for the same data-target and sends role_change_request over the
    // bridge's live connection (see bridge.js's changeRole()). The server
    // has final say (GM-only, server-side canManageGmSeat() check); this
    // button just fires the request and leans on the dialog's own refresh
    // (triggered by the room's role_update broadcast) to reflect the
    // result -- no optimistic local state change here.
    html.find('.gm-role-apply').on('click', function() {
        const targetId = $(this).data('target');
        const row = $(this).closest('span');
        const select = row.find('.gm-role-select');
        const persistBox = row.find('.gm-role-persist');
        const role = select.val();
        const persist = persistBox.is(':checked');
        if (!targetId || !role) return;
        const roleLabels = { 'co-gm': 'Co-GM', 'assistant-gm': 'Assistant GM', player: 'Player', spectator: 'Spectator' };
        FatesEdgeBridge.changeRole(targetId, role, persist);
        ui.notifications.info(`Requested: role → ${roleLabels[role] || role}${persist ? ' (saved)' : ''}.`);
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
// FIXED: sendDeckDraw already accepts a region as its 2nd argument, but
// this macro dropped it on the floor -- README documents drawCard(3,
// 'Vhasia') as a region-specific draw, which silently always fell back
// to the configured default region.
window.drawCard = function(count = 1, region = null) {
    FatesEdgeBridge.sendDeckDraw(count, region);
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

// Connect/disconnect macro helpers -- previously the only documented way
// to do this was a "Connect Now"/"Disconnect" button pair in a settings
// panel (templates/settings.html) that was never actually wired up to
// any FormApplication/settings menu, so those buttons never existed in a
// running game. FatesEdgeBridge.connect()/.disconnect() were always
// callable directly as `FatesEdgeBridge.connect()`; these are just
// short, documented macro names matching the rest of window.* above.
window.connectFatesEdge = function() {
    FatesEdgeBridge.connect();
};

window.disconnectFatesEdge = function() {
    FatesEdgeBridge.disconnect();
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