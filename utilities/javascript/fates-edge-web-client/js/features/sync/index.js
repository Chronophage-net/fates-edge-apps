// js/features/sync/index.js

import { syncManager } from '../../core/sync/index.js';
import { showToast } from '../../components/Toast.js';

let isConnected = false;
let currentCampaignCode = null;

export function renderSyncUI() {
    const panel = document.getElementById('sync-panel');
    if (!panel) return;
    
    // Load saved settings
    const savedUrl = localStorage.getItem('fates-edge-sync-url') || 'ws://localhost:3000';
    const savedCode = localStorage.getItem('fates-edge-sync-code') || '';
    
    const urlInput = document.getElementById('sync-server-url');
    const codeInput = document.getElementById('sync-campaign-code');
    const passInput = document.getElementById('sync-password');
    const connectBtn = document.getElementById('sync-connect-btn');
    const disconnectBtn = document.getElementById('sync-disconnect-btn');
    const statusEl = document.getElementById('sync-status');
    
    if (urlInput) urlInput.value = savedUrl;
    if (codeInput) codeInput.value = savedCode;
    
    // Connect button handler
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            const code = codeInput.value.trim().toUpperCase();
            const password = passInput.value.trim();
            
            if (!url) {
                showToast('Please enter a server URL.', 'error');
                return;
            }
            if (!code) {
                showToast('Please enter a campaign code.', 'error');
                return;
            }
            
            // Save settings
            localStorage.setItem('fates-edge-sync-url', url);
            localStorage.setItem('fates-edge-sync-code', code);
            
            connectBtn.disabled = true;
            connectBtn.textContent = 'Connecting…';
            
            try {
                await syncManager.connect(url, code, password);
                isConnected = true;
                currentCampaignCode = code;
                connectBtn.style.display = 'none';
                disconnectBtn.style.display = 'inline-flex';
                updateStatusUI('connected', code);
                showToast('Connected to campaign!', 'success');
            } catch (e) {
                showToast('Connection failed: ' + e.message, 'error');
                updateStatusUI('error', null);
            } finally {
                connectBtn.disabled = false;
                connectBtn.textContent = '🔗 Connect';
            }
        });
    }
    
    // Disconnect button handler
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
            syncManager.disconnect();
            isConnected = false;
            currentCampaignCode = null;
            connectBtn.style.display = 'inline-flex';
            disconnectBtn.style.display = 'none';
            updateStatusUI('disconnected', null);
            showToast('Disconnected.', 'info');
        });
    }
    
    // Refresh button handler
    const refreshBtn = document.getElementById('sync-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (isConnected) {
                syncManager.requestFullSync();
                showToast('Requesting full sync…', 'info');
            } else {
                showToast('Not connected.', 'warning');
            }
        });
    }
    
    // Listen for sync events
    syncManager.on('connection_change', (status) => {
        isConnected = status.connected;
        if (status.connected) {
            currentCampaignCode = status.campaignCode;
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-flex';
            updateStatusUI('connected', status.campaignCode);
        } else {
            currentCampaignCode = null;
            connectBtn.style.display = 'inline-flex';
            disconnectBtn.style.display = 'none';
            updateStatusUI('disconnected', null);
        }
    });
    
    syncManager.on('presence_update', (data) => {
        updatePresenceUI(data.clients);
    });
    
    // Check if we're already connected (restore state)
    if (syncManager.isConnected && syncManager.campaignCode) {
        isConnected = true;
        currentCampaignCode = syncManager.campaignCode;
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-flex';
        updateStatusUI('connected', syncManager.campaignCode);
    }
    
    // Update presence if already connected
    if (isConnected) {
        const clients = syncManager.getClients?.() || [];
        updatePresenceUI(clients);
    }
}

function updateStatusUI(state, code) {
    const statusEl = document.getElementById('sync-status');
    if (!statusEl) return;
    
    switch (state) {
        case 'connected':
            statusEl.innerHTML = `🟢 Connected to <strong>${code}</strong>`;
            statusEl.style.color = 'var(--green)';
            break;
        case 'disconnected':
            statusEl.innerHTML = '🔴 Disconnected';
            statusEl.style.color = 'var(--red)';
            break;
        case 'error':
            statusEl.innerHTML = '🔴 Connection error';
            statusEl.style.color = 'var(--red)';
            break;
        default:
            statusEl.innerHTML = '⏳ Connecting…';
            statusEl.style.color = 'var(--gold)';
    }
}

function updatePresenceUI(clients) {
    const presenceEl = document.getElementById('presence-list');
    if (!presenceEl) return;
    
    if (!clients || clients.length === 0) {
        presenceEl.innerHTML = '<span class="text-muted">No other users online</span>';
        return;
    }
    
    presenceEl.innerHTML = clients.map(client => {
        const isYou = client.id === syncManager.clientId;
        return `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.2rem 0;border-bottom:1px solid var(--border);">
                <span class="status-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${client.status === 'online' ? 'var(--green)' : 'var(--red)'};"></span>
                <span style="font-weight:${isYou ? '600' : '400'};">${client.name} ${isYou ? '(you)' : ''}</span>
                <span class="text-muted small">${client.role || 'player'}</span>
                ${client.status === 'away' ? '<span class="text-muted small">(away)</span>' : ''}
            </div>
        `;
    }).join('');
}

// Export render function
export default { renderSyncUI };