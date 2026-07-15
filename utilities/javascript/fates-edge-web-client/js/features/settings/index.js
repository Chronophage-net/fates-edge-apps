import { 
    getState as getAppState,
    getArchives, 
    addArchive, 
    deleteArchive, 
    clearAllData, 
    importData, 
    forceSave,
    setBaseUrl,
    getBaseUrl,
    setPasswordHash,
    saveState,
    addCharacter  // ← Add this here
} from '../../core/state.js';
import { checkPasswordGate, hashPassword } from '../../core/password.js';
import { escHtml, formatDate } from '../../core/utils.js';  // ← Remove addCharacter from here
import { showToast } from '../../components/Toast.js';
import { getUserAvatar } from '../../core/gravatar.js';
import { 
    connectWebSocket, 
    disconnectWebSocket, 
    isWSConnected, 
    getWSStatus, 
    testWSConnection,
    sendWSMessage,
    onWSEvent
} from '../../core/websocket.js';
import { 
    installPack, 
    uninstallPack, 
    getInstalledPacks, 
    getPack,
    getDocuments,
    initPackManager
} from '../../core/pack-manager.js';

let container = null;

// ============================================================
// LICENSE & COPYRIGHT NOTICE
// ============================================================

const LICENSE_TEXT = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                     FATE'S EDGE                              ║
║                                                              ║
║                      COPYRIGHT NOTICE                        ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Fate's Edge is © Nicholas A. Gasper. All Rights Reserved.   ║
║                                                              ║
║  ── Dual License ──                                          ║
║                                                              ║
║  The System Reference Document (SRD) and Essentials guide    ║
║  are licensed under the Creative Commons Attribution-        ║
║  NonCommercial-ShareAlike 4.0 International License          ║
║  (CC BY-NC-SA 4.0).                                          ║
║                                                              ║
║  ═════════════════════════════════════════════════════════   ║
║                                                              ║
║  ALL OTHER CONTENT IS ALL RIGHTS RESERVED, including but    ║
║  not limited to:                                             ║
║                                                              ║
║    • Setting lore (Acasia, Aeler, Vhasia, the Curse, etc.)  ║
║    • Original characters, NPCs, and named figures           ║
║    • Faction descriptions and campaign-specific content     ║
║    • Proprietary magic systems (Runekeeper, Invoker,        ║
║      Cantor, Summoner, etc.)                                ║
║    • Artwork, maps, and graphical elements                  ║
║    • Original prose, framing devices, and narrative text    ║
║    • The Deck of Consequences and Crown Spread systems      ║
║    • The Travel Framework and regional generators          ║
║    • Any content not explicitly marked as SRD              ║
║                                                              ║
║  ── Code License ──                                          ║
║                                                              ║
║  The source code for this toolkit is licensed under the     ║
║  MIT License. See the LICENSE file in the repository.       ║
║                                                              ║
║  ── Permissions ──                                           ║
║                                                              ║
║  For permissions regarding proprietary content, contact:    ║
║  support@fates-edge.com                                     ║
║                                                              ║
║                                                              ║
║  "The coin that never spends is the one you don't           ║
║   remember taking."                                         ║
║          — Serafine of the Velvet Touch                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

const LICENSE_SUMMARY = `
FATE'S EDGE — LICENSE SUMMARY
=============================

📜 Fate's Edge is © Nicholas A. Gasper. All Rights Reserved.

📖 The SRD and Essentials guide are licensed under 
   CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike 4.0)

🔒 ALL OTHER CONTENT is All Rights Reserved:
   • Setting lore, original characters, factions
   • Proprietary magic systems (Runekeeper, Invoker, Cantor, etc.)
   • Artwork, maps, graphical elements
   • Original prose, narrative text
   • Deck of Consequences, Crown Spread, Travel Framework
   • Any content not explicitly marked as SRD

💻 The toolkit source code is MIT Licensed.

📧 For permissions: support@fates-edge.com

"The coin that never spends is the one you don't remember taking."
— Serafine of the Velvet Touch
`;

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    const state = getAppState();
    const archives = getArchives();
    const settings = state.settings || {};
    
    // Get stored settings
    const serverUrl = localStorage.getItem('fates-edge-server-url') || 'http://localhost:3000';
    const userEmail = localStorage.getItem('fates-edge-user-email') || '';
    const userName = localStorage.getItem('fates-edge-client-name') || '';
    const showAvatars = localStorage.getItem('fates-edge-show-avatars') !== 'false';
    const useGravatars = localStorage.getItem('fates-edge-use-gravatars') !== 'false';
    
    const wsConnected = isWSConnected ? isWSConnected() : false;
    const wsStatus = getWSStatus ? getWSStatus() : 'disconnected';
    
    // Get installed packs
    const installedPacks = getInstalledPacks();
    const packDocuments = getDocuments();
    
    container.innerHTML = `
        <h1 class="page-title">⚙️ Settings</h1>
        <p class="page-sub">Manage your data, backups, and preferences.</p>
        
        <!-- ============================================================
             PACK MANAGEMENT
             ============================================================ -->
        <div class="panel settings-panel" id="pack-management-panel">
            <h3>📦 Pack Management</h3>
            <p class="text-muted small">Install custom packs to extend the toolkit with new modules, documents, and data.</p>
            
            <div class="form-row">
                <div class="field" style="flex:3;">
                    <label>Install Pack</label>
                    <input type="file" id="pack-file-input" accept=".zip" />
                    <div class="field-hint">Select a .zip pack file to install</div>
                </div>
            </div>
            
            <div class="flex">
                <button class="btn btn-gold" id="pack-install-btn">📦 Install Pack</button>
                <button class="btn btn-sm" id="pack-refresh-btn">↻ Refresh</button>
            </div>
            
            <div id="pack-install-feedback" class="mt-1" style="min-height:1.5rem;"></div>
            
            <div class="mt-1">
                <h4 style="margin:0.5rem 0 0.2rem;font-size:0.95rem;">📋 Installed Packs</h4>
                <div id="pack-list" class="pack-list">
                    ${installedPacks.length === 0 ? '<div class="text-muted small">No packs installed.</div>' : ''}
                    ${installedPacks.map(pack => `
                        <div class="pack-item">
                            <div class="pack-info">
                                <span class="pack-name">${escHtml(pack.name)}</span>
                                <span class="pack-version">v${escHtml(pack.version)}</span>
                                <span class="pack-type">${pack.type}</span>
                                <span class="pack-meta">${pack.author ? `by ${escHtml(pack.author)}` : ''} · ${new Date(pack.installed).toLocaleDateString()}</span>
                            </div>
                            <div class="flex">
                                <button class="btn btn-xs btn-danger uninstall-pack-btn" data-id="${pack.id}">🗑️ Uninstall</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="mt-1">
                <h4 style="margin:0.5rem 0 0.2rem;font-size:0.95rem;">📄 Pack Documents</h4>
                <div id="pack-documents-list">
                    ${packDocuments.length === 0 ? '<div class="text-muted small">No documents loaded from packs.</div>' : ''}
                    ${packDocuments.map(doc => `
                        <div class="pack-document-item">
                            <span class="doc-title">${escHtml(doc.title)}</span>
                            <span class="doc-category">${escHtml(doc.category || 'general')}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <!-- ============================================================
             WEBSOCKET SETTINGS
             ============================================================ -->
        <div class="panel settings-panel">
            <h3>🔗 WebSocket Connection</h3>
            <p class="text-muted small">Configure the WebSocket server for real-time VTT features.</p>
            
            <div class="form-row">
                <div class="field" style="flex:3;">
                    <label>WebSocket Server URL</label>
                    <input type="text" id="settings-ws-url" 
                           value="${escHtml(settings.wsUrl || 'wss://fates-edge-ws.onrender.com')}" 
                           placeholder="wss://your-websocket-server.com" />
                    <div class="field-hint">The WebSocket server URL for VTT synchronization</div>
                </div>
                <div class="field" style="flex:1;">
                    <label>Room Name</label>
                    <input type="text" id="settings-ws-room" 
                           value="${escHtml(settings.wsRoom || 'vtt-room')}" 
                           placeholder="vtt-room" />
                    <div class="field-hint">Room to join for multiplayer</div>
                </div>
            </div>
            
            <div class="form-row">
                <div class="field" style="flex:0 0 auto;">
                    <label class="inline-check">
                        <input type="checkbox" id="settings-ws-enabled" 
                               ${settings.wsEnabled !== false ? 'checked' : ''} />
                        Enable WebSocket
                    </label>
                </div>
                <div class="field" style="flex:0 0 auto;">
                    <label class="inline-check">
                        <input type="checkbox" id="settings-ws-reconnect" 
                               ${settings.wsReconnect !== false ? 'checked' : ''} />
                        Auto-reconnect
                    </label>
                </div>
                <div class="field" style="flex:0 0 120px;">
                    <label>Reconnect Interval</label>
                    <input type="number" id="settings-ws-interval" 
                           value="${settings.wsReconnectInterval || 3000}" 
                           min="1000" max="10000" step="500" />
                    <div class="field-hint">ms between reconnect attempts</div>
                </div>
            </div>
            
            <div class="flex">
                <button class="btn btn-sm" id="settings-ws-test">🔍 Test Connection</button>
                <button class="btn btn-sm btn-gold" id="settings-ws-connect">🔗 Connect</button>
                <button class="btn btn-sm" id="settings-ws-disconnect">🔌 Disconnect</button>
                <span id="settings-ws-status" class="status-badge ${wsConnected ? 'connected' : 'disconnected'}">
                    ${wsConnected ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
            </div>
            
            <div id="settings-ws-result" class="mt-1" style="display:none;"></div>
        </div>
        
        <!-- ============================================================
             DATA MANAGEMENT
             ============================================================ -->
        <div class="panel settings-panel">
            <h3>💾 Data Management</h3>
            <div class="flex">
                <button class="btn btn-primary" id="settings-export-btn">📥 Export All Data (JSON)</button>
                <button class="btn" id="settings-import-btn">📤 Import JSON</button>
                <input type="file" id="settings-import-file" accept=".json" style="display:none" />
                <button class="btn btn-danger" id="settings-clear-btn">🗑️ Clear All Data</button>
            </div>
            <p class="text-muted mt-1">Data is stored in your browser's local storage. Export regularly for backup.</p>
        </div>
        
        <!-- ============================================================
             LIVE CAMPAIGN (Sync)
             ============================================================ -->
        <div class="panel settings-panel" id="sync-panel">
            <h3>🌐 Live Campaign</h3>
            <p class="text-muted small">Connect to a campaign server for real-time collaboration with your group.</p>
            
            <!-- User Profile Settings -->
            <div class="form-row" style="margin-bottom:0.6rem;">
                <div class="field">
                    <label>Your Name</label>
                    <input type="text" id="sync-user-name" placeholder="Your display name" value="${escHtml(userName)}" />
                </div>
                <div class="field">
                    <label>Your Email <span class="text-muted small">(for Gravatar)</span></label>
                    <input type="email" id="sync-user-email" placeholder="your@email.com" value="${escHtml(userEmail)}" />
                </div>
                <div class="field" style="flex:0 0 auto;align-self:end;">
                    <button class="btn btn-sm" id="sync-save-profile-btn">💾 Save Profile</button>
                </div>
            </div>
            
            <!-- Avatar Preview -->
            <div class="avatar-preview-container">
                <img id="avatar-preview" src="${getUserAvatar(userEmail, userName, 48)}" 
                     alt="Your avatar" />
                <div>
                    <div class="avatar-name" id="avatar-preview-name">${userName || 'You'}</div>
                    <div class="avatar-email" id="avatar-preview-email">${userEmail || 'No email set'}</div>
                </div>
            </div>
            
            <!-- Avatar Settings -->
            <div class="flex mt-1" style="margin-bottom:0.6rem;padding:0.3rem 0.6rem;background:var(--bg3);border-radius:var(--radius);">
                <label class="inline-check">
                    <input type="checkbox" id="sync-show-avatars" ${showAvatars ? 'checked' : ''} />
                    Show avatars in presence list
                </label>
                <label class="inline-check">
                    <input type="checkbox" id="sync-use-gravatars" ${useGravatars ? 'checked' : ''} />
                    Use Gravatar (fallback to initials)
                </label>
            </div>
            
            <!-- Connection Settings -->
            <div class="form-row">
                <div class="field large">
                    <label>Server URL</label>
                    <input type="text" id="sync-server-url" placeholder="ws://localhost:3000 or https://your-server.com" value="${escHtml(serverUrl)}" />
                </div>
                <div class="field">
                    <label>Campaign Code</label>
                    <input type="text" id="sync-campaign-code" placeholder="ABC123" maxlength="6" style="text-transform:uppercase;" />
                </div>
                <div class="field">
                    <label>Password</label>
                    <input type="password" id="sync-password" placeholder="Campaign password" />
                </div>
            </div>
            
            <div class="flex">
                <button class="btn btn-gold" id="sync-connect-btn">🔗 Connect</button>
                <button class="btn btn-danger" id="sync-disconnect-btn" style="display:none;">⛔ Disconnect</button>
                <button class="btn btn-sm" id="sync-refresh-btn">↻ Refresh</button>
            </div>
            
            <div id="sync-status" class="sync-status disconnected">
                🔴 Disconnected
            </div>
            
            <div class="mt-1">
                <h4 style="margin:0.5rem 0 0.2rem;font-size:0.95rem;">👥 Online Players</h4>
                <div id="presence-list" class="presence-list text-muted small">
                    No other users online
                </div>
            </div>
        </div>
        
        <!-- ============================================================
             CAMPAIGN SHARING (HTTP)
             ============================================================ -->
        <div class="panel settings-panel">
            <h3>📦 Campaign Sharing (HTTP)</h3>
            <p class="text-muted small">Upload your current toolkit state to a campaign server, then share the generated code with your group. They can load it with the same code.</p>
            <div class="form-row">
                <div class="field large"><label>Server URL</label><input type="text" id="campaign-server-url" placeholder="http://localhost:3000" value="${escHtml(serverUrl)}" /></div>
                <div class="field" style="flex:0 0 120px;"><label>Campaign Code</label><input type="text" id="campaign-code" placeholder="ABC123" maxlength="6" style="text-transform:uppercase;" /></div>
            </div>
            <div class="flex">
                <button class="btn btn-gold" id="campaign-upload-btn">⬆ Upload Current State</button>
                <button class="btn btn-primary" id="campaign-load-btn">⬇ Load State</button>
                <button class="btn btn-danger" id="campaign-delete-btn">🗑️ Delete Campaign</button>
            </div>
            <div id="campaign-feedback" class="campaign-feedback mt-1"></div>
        </div>
        
        <!-- ============================================================
             PASSWORD PROTECTION
             ============================================================ -->
        <div class="panel settings-panel" id="password-settings-panel">
            <h3 class="flex-between">
                <span>🔐 Password Protection</span>
                <span id="passwordStatusBadge" class="password-status-badge ${state.passwordHash ? 'enabled' : 'disabled'}">
                    ${state.passwordHash ? '🔒 Enabled' : '🔓 Disabled'}
                </span>
            </h3>
            <p class="text-muted small">Require a password to access the entire toolkit. Ideal for sharing with playtesters.</p>
            <div id="passwordSettingsContent">
                <div class="password-settings-row">
                    <div class="field"><label>Current Password <span class="text-muted small">(required to change)</span></label><input type="password" id="ps-current-pw" placeholder="Enter current password" autocomplete="current-password" /></div>
                    <div class="field"><label>New Password</label><input type="password" id="ps-new-pw" placeholder="New password (min 4 chars)" autocomplete="new-password" /></div>
                    <div class="field"><label>Confirm</label><input type="password" id="ps-confirm-pw" placeholder="Confirm new password" autocomplete="new-password" /></div>
                </div>
                <div class="flex">
                    <button class="btn btn-gold" id="ps-save-btn">🔑 Set / Change Password</button>
                    <button class="btn btn-danger" id="ps-remove-btn">🗝️ Remove Password</button>
                </div>
                <div id="passwordSettingsFeedback" class="mt-1 small" style="min-height:1.4rem;"></div>
            </div>
        </div>
        
        <!-- ============================================================
             BASE URL
             ============================================================ -->
        <div class="panel settings-panel">
            <h3>🌐 Document Base URL</h3>
            <p class="text-muted small">Set the base URL used when generating shareable document links. Leave empty to auto-detect from the browser.</p>
            <div class="form-row">
                <div class="field large"><label>Base URL</label><input type="text" id="ps-base-url" placeholder="e.g. https://yourdomain.com/fates-edge/" value="${escHtml(state.baseUrl || '')}" /></div>
                <div class="field" style="flex:0 0 auto;align-self:end;"><button class="btn btn-primary" id="ps-base-url-btn">💾 Save</button></div>
            </div>
            <div id="baseUrlFeedback" class="mt-1 small" style="min-height:1.2rem;"></div>
            <div class="text-muted small mt-1">Current document links will use: <span id="currentBaseUrlDisplay" style="color:var(--gold);">${getBaseUrl()}</span></div>
        </div>
        
        <!-- ============================================================
             SESSION ARCHIVES
             ============================================================ -->
        <div class="panel settings-panel">
            <h3>📦 Session Archives</h3>
            <div id="session-archives"></div>
            <button class="btn btn-sm mt-1" id="settings-new-session">📦 New Session (archive current)</button>
        </div>
        
        <!-- ============================================================
             THEME & APPEARANCE
             ============================================================ -->
        <div class="panel settings-panel">
            <h3>🎨 Theme & Appearance</h3>
            <div class="flex">
                <button class="btn btn-sm theme-btn" data-theme="dark">🌙 Dark</button>
                <button class="btn btn-sm theme-btn" data-theme="light">☀️ Light</button>
                <button class="btn btn-sm theme-btn" data-theme="auto">🔄 Auto</button>
            </div>
        </div>
        
        <!-- ============================================================
             LICENSE & COPYRIGHT
             ============================================================ -->
        <div class="panel settings-panel">
            <h3>📜 License & Copyright</h3>
            <div class="license-box">
                <p><strong>Fate's Edge</strong> is © Nicholas A. Gasper. <strong>All Rights Reserved.</strong></p>
                <p>The <strong>SRD</strong> and <strong>Essentials</strong> guide are licensed under CC BY-NC-SA 4.0.</p>
                <p>All other content — setting lore, original characters, proprietary magic systems, artwork, etc. — is <strong>All Rights Reserved</strong>.</p>
                <p><strong>Code:</strong> MIT License</p>
                <button class="btn btn-sm mt-1" id="settings-license-btn">📜 Full License</button>
                <button class="btn btn-sm mt-1" id="settings-license-summary-btn">📋 Summary</button>
            </div>
        </div>
        
        <!-- ============================================================
             ABOUT
             ============================================================ -->
        <div class="panel settings-panel">
            <h3>About</h3>
            <p class="text-muted">Fate's Edge Toolkit v3.0 — Modular Edition with WebSocket & Voice<br />All data stays in your browser.</p>
            <p class="text-muted small mt-1">© ${new Date().getFullYear()} Nicholas A. Gasper. All Rights Reserved.</p>
            <p class="text-muted small">The SRD and Essentials are CC BY-NC-SA 4.0. Code is MIT.</p>
        </div>
    `;
    
    renderSessionArchives();
    attachEvents();
      
    // Initialize sync UI
    setTimeout(initSyncUI, 100);
    
    // Initialize pack manager
    initPackManager();
}

// ============================================================
// PACK MANAGEMENT FUNCTIONS
// ============================================================

async function handlePackInstall() {
    const fileInput = document.getElementById('pack-file-input');
    const feedback = document.getElementById('pack-install-feedback');
    const installBtn = document.getElementById('pack-install-btn');
    
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        feedback.innerHTML = '<span style="color:var(--red);">❌ Please select a .zip pack file.</span>';
        showToast('Please select a pack file', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    
    if (!file.name.endsWith('.zip')) {
        feedback.innerHTML = '<span style="color:var(--red);">❌ File must be a .zip archive.</span>';
        showToast('Invalid pack format', 'error');
        return;
    }
    
    feedback.innerHTML = '<span style="color:var(--gold);">⏳ Installing pack...</span>';
    installBtn.disabled = true;
    
    try {
        const result = await installPack(file);
        feedback.innerHTML = `
            <span style="color:var(--green);">✅ Pack "${result.name}" v${result.version} installed successfully!</span>
            <span class="text-muted small"> ${result.modules?.length || 0} modules, ${result.documents?.length || 0} documents</span>
        `;
        showToast(`Pack "${result.name}" installed!`, 'success');
        fileInput.value = '';
        // Refresh the UI
        render(container);
    } catch (err) {
        feedback.innerHTML = `<span style="color:var(--red);">❌ ${err.message}</span>`;
        showToast('Install failed: ' + err.message, 'error');
    } finally {
        installBtn.disabled = false;
    }
}

function handlePackUninstall(packId) {
    if (!packId) return;
    uninstallPack(packId);
    // Refresh the UI
    setTimeout(() => render(container), 500);
}

function refreshPackList() {
    render(container);
    showToast('Pack list refreshed', 'info');
}

// ============================================================
// SYNC UI INITIALIZATION
// ============================================================

/**
 * Initialize sync UI elements
 * FIXED: Properly handles missing sync module
 */
function initSyncUI() {
    // Update sync status display
    function updateSyncStatus(status) {
        const statusEl = document.getElementById('sync-status');
        const connectBtn = document.getElementById('sync-connect-btn');
        const disconnectBtn = document.getElementById('sync-disconnect-btn');
        const presenceList = document.getElementById('presence-list');
        const showAvatars = document.getElementById('sync-show-avatars')?.checked !== false;
        
        if (!statusEl || !connectBtn || !disconnectBtn) return;
        
        if (status && status.isConnected) {
            statusEl.innerHTML = `🟢 Connected to ${status.campaignCode || 'campaign'}`;
            statusEl.className = 'sync-status connected';
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-block';
            
            // Update presence list with avatars
            if (presenceList) {
                const clients = status.clients || [];
                if (clients.length > 1) {
                    presenceList.innerHTML = clients
                        .filter(client => client.id !== status.clientId)
                        .map(client => {
                            const avatarUrl = showAvatars 
                                ? getUserAvatar(client.email || '', client.name || 'User', 32)
                                : '';
                            return `
                                <div class="presence-item">
                                    ${showAvatars ? `<img src="${avatarUrl}" alt="${client.name || 'User'}" class="avatar" loading="lazy" />` : ''}
                                    <span class="name">${escHtml(client.name || 'Anonymous')}</span>
                                    <span class="role">${client.role === 'gm' ? 'GM' : 'Player'}</span>
                                    <span class="status-dot ${client.status === 'online' ? 'online' : 'away'}"></span>
                                </div>
                            `;
                        }).join('');
                } else {
                    presenceList.innerHTML = '<div style="color:var(--text2);padding:0.3rem 0;">No other users online</div>';
                }
            }
        } else {
            statusEl.innerHTML = '🔴 Disconnected';
            statusEl.className = 'sync-status disconnected';
            connectBtn.style.display = 'inline-block';
            disconnectBtn.style.display = 'none';
            
            if (presenceList) {
                presenceList.innerHTML = '<div style="color:var(--text2);padding:0.3rem 0;">Not connected</div>';
            }
        }
    }
    
    // Try to import sync module
    import('../../core/sync/index.js')
        .then(module => {
            const { syncManager } = module;
            
            // Store reference for cleanup
            window.__syncManager = syncManager;
            
            // Get initial status
            try {
                const status = syncManager.getStatus ? syncManager.getStatus() : { isConnected: false };
                updateSyncStatus(status);
            } catch (e) {
                console.warn('Sync getStatus not available:', e);
                updateSyncStatus({ isConnected: false });
            }
            
            // Listen for sync events
            if (syncManager.on) {
                syncManager.on('connection_change', updateSyncStatus);
                syncManager.on('presence_update', updateSyncStatus);
            }
            
            console.log('✅ Sync module loaded successfully');
        })
        .catch(e => {
            console.warn('⚠️ Sync module not available:', e.message);
            // Update status to disconnected with a note
            const statusEl = document.getElementById('sync-status');
            if (statusEl) {
                statusEl.innerHTML = '⚠️ Sync module unavailable';
                statusEl.className = 'sync-status error';
            }
        });
}

// ============================================================
// CONNECT TO SYNC SERVER
// ============================================================

async function connectToSyncServer() {
    const serverUrl = document.getElementById('sync-server-url').value.trim();
    const campaignCode = document.getElementById('sync-campaign-code').value.trim();
    const password = document.getElementById('sync-password').value;
    const userName = document.getElementById('sync-user-name').value.trim() || 'Player';
    const userEmail = document.getElementById('sync-user-email').value.trim();
    const statusEl = document.getElementById('sync-status');
    
    if (!serverUrl || !campaignCode) {
        showToast('Please enter server URL and campaign code', 'error');
        return;
    }
    
    statusEl.innerHTML = '🔄 Connecting...';
    statusEl.className = 'sync-status connecting';
    
    try {
        const { syncManager } = await import('../../core/sync/index.js');
        
        // Store credentials for reconnection
        syncManager.lastPassword = password;
        
        // Save profile settings
        localStorage.setItem('fates-edge-client-name', userName);
        if (userEmail) localStorage.setItem('fates-edge-user-email', userEmail);
        localStorage.setItem('fates-edge-server-url', serverUrl);
        
        await syncManager.connect(serverUrl, campaignCode, password, {
            name: userName,
            email: userEmail
        });
        
        showToast('Connected to campaign!', 'success');
    } catch (e) {
        statusEl.innerHTML = `❌ ${e.message}`;
        statusEl.className = 'sync-status disconnected';
        showToast(`Connection failed: ${e.message}`, 'error');
    }
}

// ============================================================
// DISCONNECT FROM SYNC SERVER
// ============================================================

async function disconnectFromSyncServer() {
    try {
        const { syncManager } = await import('../../core/sync/index.js');
        syncManager.disconnect();
        showToast('Disconnected from campaign', 'info');
    } catch (e) {
        showToast(`Disconnect failed: ${e.message}`, 'error');
    }
}

// ============================================================
// SAVE USER PROFILE
// ============================================================

function saveUserProfile() {
    const userName = document.getElementById('sync-user-name').value.trim();
    const userEmail = document.getElementById('sync-user-email').value.trim();
    
    if (userName) {
        localStorage.setItem('fates-edge-client-name', userName);
    }
    if (userEmail) {
        localStorage.setItem('fates-edge-user-email', userEmail);
    }
    
    // Update avatar preview
    const avatarPreview = document.getElementById('avatar-preview');
    const nameDisplay = document.getElementById('avatar-preview-name');
    const emailDisplay = document.getElementById('avatar-preview-email');
    const useGravatars = document.getElementById('sync-use-gravatars')?.checked !== false;
    
    if (avatarPreview) {
        avatarPreview.src = getUserAvatar(useGravatars ? userEmail : '', userName || 'You', 48);
    }
    if (nameDisplay) {
        nameDisplay.textContent = userName || 'You';
    }
    if (emailDisplay) {
        emailDisplay.textContent = userEmail || 'No email set';
    }
    
    // Update sync manager if connected
    import('../../core/sync/index.js').then(module => {
        const { syncManager } = module;
        if (syncManager.isConnected && syncManager.setName) {
            syncManager.setName(userName || 'Player');
            if (syncManager.send) {
                syncManager.send({
                    type: 'presence',
                    action: 'update',
                    clientId: syncManager.clientId,
                    name: userName || 'Player',
                    email: userEmail
                });
            }
        }
    });
    
    showToast('Profile saved!', 'success');
}

// ============================================================
// TOGGLE AVATARS
// ============================================================

function toggleAvatars() {
    const showAvatars = document.getElementById('sync-show-avatars').checked;
    localStorage.setItem('fates-edge-show-avatars', String(showAvatars));
    // Refresh presence list
    initSyncUI();
}

function toggleGravatars() {
    const useGravatars = document.getElementById('sync-use-gravatars').checked;
    localStorage.setItem('fates-edge-use-gravatars', String(useGravatars));
    // Update avatar preview
    const email = document.getElementById('sync-user-email').value.trim();
    const name = document.getElementById('sync-user-name').value.trim();
    const avatarPreview = document.getElementById('avatar-preview');
    if (avatarPreview) {
        avatarPreview.src = getUserAvatar(
            useGravatars ? email : '', 
            name || 'You', 
            48
        );
    }
}

// ============================================================
// WEBSOCKET SETTINGS FUNCTIONS
// ============================================================

function getWSSettingsFromUI() {
    const wsUrl = document.getElementById('settings-ws-url')?.value || 'wss://fates-edge-ws.onrender.com';
    const wsRoom = document.getElementById('settings-ws-room')?.value || 'vtt-room';
    const wsEnabled = document.getElementById('settings-ws-enabled')?.checked !== false;
    const wsReconnect = document.getElementById('settings-ws-reconnect')?.checked !== false;
    const wsReconnectInterval = parseInt(document.getElementById('settings-ws-interval')?.value || '3000', 10);
    
    return { wsUrl, wsRoom, wsEnabled, wsReconnect, wsReconnectInterval };
}

async function testWSConnectionHandler() {
    const url = document.getElementById('settings-ws-url')?.value;
    const resultDiv = document.getElementById('settings-ws-result');
    
    if (!url) {
        showToast('Please enter a WebSocket URL', 'error');
        return;
    }
    
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div class="text-muted">⏳ Testing connection...</div>';
    }
    
    const result = await testWSConnection(url);
    
    if (resultDiv) {
        if (result.success) {
            resultDiv.innerHTML = `
                <div style="color:var(--green);padding:0.5rem;background:var(--bg3);border-radius:4px;">
                    ✅ Connection successful! Server is reachable.
                </div>
            `;
            showToast('Connection test successful!', 'success');
        } else {
            resultDiv.innerHTML = `
                <div style="color:var(--red);padding:0.5rem;background:var(--bg3);border-radius:4px;">
                    ❌ Connection failed: ${result.error || 'Unknown error'}
                </div>
            `;
            showToast('Connection test failed', 'error');
        }
    }
}

function connectWSHandler() {
    const settings = getWSSettingsFromUI();
    
    // Save settings to state
    const state = getState();
    state.settings = { ...state.settings, ...settings };
    saveState(state);
    
    localStorage.setItem('fates-edge-ws-url', settings.wsUrl);
    localStorage.setItem('fates-edge-ws-room', settings.wsRoom);
    localStorage.setItem('fates-edge-ws-enabled', String(settings.wsEnabled));
    
    if (!settings.wsEnabled) {
        showToast('WebSocket is disabled in settings', 'warning');
        return;
    }
    
    if (!settings.wsUrl) {
        showToast('Please enter a WebSocket URL', 'error');
        return;
    }
    
    connectWebSocket(settings.wsRoom);
    updateWSStatusDisplay();
    showToast('Connecting to WebSocket...', 'info');
}

function disconnectWSHandler() {
    disconnectWebSocket();
    updateWSStatusDisplay();
    showToast('WebSocket disconnected', 'info');
}

function updateWSStatusDisplay() {
    const statusEl = document.getElementById('settings-ws-status');
    if (!statusEl) return;
    
    const connected = isWSConnected();
    
    statusEl.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
    statusEl.className = `status-badge ${connected ? 'connected' : 'disconnected'}`;
    
    const connectBtn = document.getElementById('settings-ws-connect');
    const disconnectBtn = document.getElementById('settings-ws-disconnect');
    
    if (connectBtn && disconnectBtn) {
        connectBtn.style.display = connected ? 'none' : 'inline-block';
        disconnectBtn.style.display = connected ? 'inline-block' : 'none';
    }
}

function saveWSSettings() {
    const settings = getWSSettingsFromUI();
    const state = getState();
    state.settings = { ...state.settings, ...settings };
    saveState(state);
    
    localStorage.setItem('fates-edge-ws-url', settings.wsUrl);
    localStorage.setItem('fates-edge-ws-room', settings.wsRoom);
    localStorage.setItem('fates-edge-ws-enabled', String(settings.wsEnabled));
    localStorage.setItem('fates-edge-ws-reconnect', String(settings.wsReconnect));
    localStorage.setItem('fates-edge-ws-interval', String(settings.wsReconnectInterval));
    
    if (settings.wsEnabled) {
        disconnectWebSocket();
        connectWebSocket(settings.wsRoom);
    } else {
        disconnectWebSocket();
    }
    
    updateWSStatusDisplay();
    showToast('WebSocket settings saved!', 'success');
}

// ============================================================
// ATTACH EVENTS
// ============================================================

export function attachEvents() {
    // Pack management
    document.getElementById('pack-install-btn')?.addEventListener('click', handlePackInstall);
    document.getElementById('pack-refresh-btn')?.addEventListener('click', refreshPackList);
    document.getElementById('pack-file-input')?.addEventListener('change', (e) => {
        const feedback = document.getElementById('pack-install-feedback');
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            feedback.innerHTML = `<span class="text-muted">📎 Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>`;
        }
    });
    
    // Pack uninstall buttons (delegated)
    document.getElementById('pack-list')?.addEventListener('click', (e) => {
        const uninstallBtn = e.target.closest('.uninstall-pack-btn');
        if (uninstallBtn) {
            handlePackUninstall(uninstallBtn.dataset.id);
        }
    });
    
    // Data management
    document.getElementById('settings-export-btn')?.addEventListener('click', exportAllData);
    document.getElementById('settings-import-btn')?.addEventListener('click', () => {
        document.getElementById('settings-import-file')?.click();
    });
    document.getElementById('settings-import-file')?.addEventListener('change', importAllData);
    document.getElementById('settings-clear-btn')?.addEventListener('click', clearAllDataHandler);
    
    // Password
    document.getElementById('ps-save-btn')?.addEventListener('click', savePasswordSettings);
    document.getElementById('ps-remove-btn')?.addEventListener('click', removePassword);
    
    // Base URL
    document.getElementById('ps-base-url-btn')?.addEventListener('click', saveBaseUrl);
    
    // Campaign
    document.getElementById('campaign-upload-btn')?.addEventListener('click', campaignUpload);
    document.getElementById('campaign-load-btn')?.addEventListener('click', campaignLoad);
    document.getElementById('campaign-delete-btn')?.addEventListener('click', campaignDelete);
    
    // Sync
    document.getElementById('sync-connect-btn')?.addEventListener('click', connectToSyncServer);
    document.getElementById('sync-disconnect-btn')?.addEventListener('click', disconnectFromSyncServer);
    document.getElementById('sync-refresh-btn')?.addEventListener('click', () => {
        import('../../core/sync/index.js').then(module => {
            if (module.syncManager && module.syncManager.requestFullSync) {
                module.syncManager.requestFullSync();
                showToast('Refreshing sync...', 'info');
            }
        });
    });
    
    // Profile
    document.getElementById('sync-save-profile-btn')?.addEventListener('click', saveUserProfile);
    document.getElementById('sync-show-avatars')?.addEventListener('change', toggleAvatars);
    document.getElementById('sync-use-gravatars')?.addEventListener('change', toggleGravatars);
    
    document.getElementById('sync-user-name')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveUserProfile();
    });
    document.getElementById('sync-user-email')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveUserProfile();
    });
    
    // Session
    document.getElementById('settings-new-session')?.addEventListener('click', newSessionHandler);
    
    // Theme
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => setTheme(btn.dataset.theme));
    });
    
    // License
    document.getElementById('settings-license-btn')?.addEventListener('click', openLicenseModal);
    document.getElementById('settings-license-summary-btn')?.addEventListener('click', openLicenseSummaryModal);
    
    // WebSocket
    document.getElementById('settings-ws-test')?.addEventListener('click', testWSConnectionHandler);
    document.getElementById('settings-ws-connect')?.addEventListener('click', connectWSHandler);
    document.getElementById('settings-ws-disconnect')?.addEventListener('click', disconnectWSHandler);
    
    ['settings-ws-url', 'settings-ws-room', 'settings-ws-enabled', 'settings-ws-reconnect', 'settings-ws-interval'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', saveWSSettings);
            if (el.type !== 'checkbox' && el.type !== 'number') {
                el.addEventListener('blur', saveWSSettings);
            }
        }
    });
    
    setTimeout(updateWSStatusDisplay, 200);
}

// ============================================================
// DATA MANAGEMENT FUNCTIONS
// ============================================================

export function exportAllData() {
    const state = getState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fates-edge-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Data exported.', 'success');
}

export function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data || typeof data !== 'object') throw new Error('Invalid data file.');
            importData(data);
            showToast('Data imported successfully!', 'success');
            render(container);
        } catch (err) {
            showToast('Error importing: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllDataHandler() {
    if (!confirm('Delete ALL data? This cannot be undone.')) return;
    clearAllData();
    showToast('All data cleared.', 'success');
    render(container);
}

// ============================================================
// PASSWORD FUNCTIONS
// ============================================================

async function savePasswordSettings() {
    const currentPw = document.getElementById('ps-current-pw').value.trim();
    const newPw = document.getElementById('ps-new-pw').value.trim();
    const confirmPw = document.getElementById('ps-confirm-pw').value.trim();
    const feedback = document.getElementById('passwordSettingsFeedback');
    const state = getState();
    
    feedback.textContent = '';
    
    if (state.passwordHash) {
        if (!currentPw) {
            feedback.textContent = '❌ Current password is required to change it.';
            feedback.style.color = 'var(--red)';
            return;
        }
        const currentHash = await hashPassword(currentPw);
        if (currentHash !== state.passwordHash) {
            feedback.textContent = '❌ Current password is incorrect.';
            feedback.style.color = 'var(--red)';
            return;
        }
    }
    
    if (!newPw) {
        feedback.textContent = '❌ New password cannot be empty.';
        feedback.style.color = 'var(--red)';
        return;
    }
    if (newPw.length < 4) {
        feedback.textContent = '❌ Password must be at least 4 characters.';
        feedback.style.color = 'var(--red)';
        return;
    }
    if (newPw !== confirmPw) {
        feedback.textContent = '❌ Passwords do not match.';
        feedback.style.color = 'var(--red)';
        return;
    }
    
    try {
        const hash = await hashPassword(newPw);
        setPasswordHash(hash);
        feedback.textContent = '✅ Password updated successfully!';
        feedback.style.color = 'var(--green)';
        document.getElementById('ps-current-pw').value = '';
        document.getElementById('ps-new-pw').value = '';
        document.getElementById('ps-confirm-pw').value = '';
        showToast('Password updated.', 'success');
        render(container);
    } catch (e) {
        feedback.textContent = '⚠️ Error hashing password.';
        feedback.style.color = 'var(--red)';
    }
}

async function removePassword() {
    if (!confirm('Remove password protection? Anyone will be able to access the toolkit.')) return;
    const state = getState();
    if (!state.passwordHash) {
        showToast('No password is set.', 'info');
        return;
    }
    
    const currentPw = document.getElementById('ps-current-pw').value.trim();
    if (!currentPw) {
        showToast('Please enter your current password to remove it.', 'error');
        return;
    }
    
    try {
        const currentHash = await hashPassword(currentPw);
        if (currentHash !== state.passwordHash) {
            showToast('Current password incorrect.', 'error');
            return;
        }
        setPasswordHash(null);
        document.getElementById('ps-current-pw').value = '';
        showToast('Password removed.', 'success');
        render(container);
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// ============================================================
// BASE URL FUNCTIONS
// ============================================================

function saveBaseUrl() {
    const input = document.getElementById('ps-base-url');
    const feedback = document.getElementById('baseUrlFeedback');
    let url = input.value.trim();
    if (url && !url.endsWith('/')) url += '/';
    setBaseUrl(url);
    feedback.textContent = '✅ Base URL saved.';
    feedback.style.color = 'var(--green)';
    document.getElementById('currentBaseUrlDisplay').textContent = getBaseUrl();
    showToast('Base URL updated.', 'success');
}

// ============================================================
// CAMPAIGN SHARING FUNCTIONS
// ============================================================

async function campaignUpload() {
    const serverUrl = document.getElementById('campaign-server-url').value.trim() || 'http://localhost:3000';
    const feedback = document.getElementById('campaign-feedback');
    const btn = document.getElementById('campaign-upload-btn');
    btn.disabled = true;
    feedback.textContent = 'Uploading…';
    feedback.className = 'campaign-feedback mt-1';

    try {
        const state = getState();
        const response = await fetch(`${serverUrl}/campaigns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Server error');
        }
        const result = await response.json();
        document.getElementById('campaign-code').value = result.code;
        feedback.innerHTML = `✅ Uploaded! Share code: <strong>${result.code}</strong>`;
        feedback.className = 'campaign-feedback mt-1 success';
        showToast(`Campaign uploaded with code ${result.code}`, 'success');
    } catch (err) {
        feedback.textContent = '❌ ' + err.message;
        feedback.className = 'campaign-feedback mt-1 error';
        showToast('Upload failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

async function campaignLoad() {
    const serverUrl = document.getElementById('campaign-server-url').value.trim() || 'http://localhost:3000';
    const code = document.getElementById('campaign-code').value.trim().toUpperCase();
    const feedback = document.getElementById('campaign-feedback');
    const btn = document.getElementById('campaign-load-btn');
    if (!code) {
        feedback.textContent = '❌ Please enter a campaign code.';
        feedback.className = 'campaign-feedback mt-1 error';
        return;
    }
    btn.disabled = true;
    feedback.textContent = 'Loading…';
    feedback.className = 'campaign-feedback mt-1';

    try {
        const response = await fetch(`${serverUrl}/campaigns/${code}`);
        if (!response.ok) {
            if (response.status === 404) throw new Error('Campaign not found');
            const err = await response.json();
            throw new Error(err.error || 'Server error');
        }
        const data = await response.json();
        importData(data);
        feedback.innerHTML = `✅ Loaded campaign <strong>${code}</strong> successfully!`;
        feedback.className = 'campaign-feedback mt-1 success';
        showToast('Campaign loaded!', 'success');
    } catch (err) {
        feedback.textContent = '❌ ' + err.message;
        feedback.className = 'campaign-feedback mt-1 error';
        showToast('Load failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

async function campaignDelete() {
    const serverUrl = document.getElementById('campaign-server-url').value.trim() || 'http://localhost:3000';
    const code = document.getElementById('campaign-code').value.trim().toUpperCase();
    const feedback = document.getElementById('campaign-feedback');
    const btn = document.getElementById('campaign-delete-btn');
    if (!code) {
        feedback.textContent = '❌ Please enter a campaign code to delete.';
        feedback.className = 'campaign-feedback mt-1 error';
        return;
    }
    if (!confirm(`Delete campaign ${code} from the server?`)) return;
    btn.disabled = true;
    feedback.textContent = 'Deleting…';
    feedback.className = 'campaign-feedback mt-1';

    try {
        const response = await fetch(`${serverUrl}/campaigns/${code}`, { method: 'DELETE' });
        if (!response.ok) {
            if (response.status === 404) throw new Error('Campaign not found');
            const err = await response.json();
            throw new Error(err.error || 'Server error');
        }
        feedback.innerHTML = `✅ Campaign <strong>${code}</strong> deleted.`;
        feedback.className = 'campaign-feedback mt-1 success';
        document.getElementById('campaign-code').value = '';
        showToast('Campaign deleted.', 'success');
    } catch (err) {
        feedback.textContent = '❌ ' + err.message;
        feedback.className = 'campaign-feedback mt-1 error';
        showToast('Delete failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// ============================================================
// SESSION ARCHIVES FUNCTIONS
// ============================================================

function renderSessionArchives() {
    const el = document.getElementById('session-archives');
    if (!el) return;
    const archives = getArchives();
    if (archives.length === 0) {
        el.innerHTML = '<span class="text-muted">No archived sessions.</span>';
        return;
    }
    el.innerHTML = archives.slice().reverse().map(a => `
        <div class="session-archive-item">
            <div class="archive-info">
                <span class="name">${escHtml(a.label || 'Unnamed')}</span>
                <span class="meta">${new Date(a.timestamp).toLocaleString()} · ${a.rollHistory?.length || 0} rolls</span>
            </div>
            <div class="flex">
                <button class="btn btn-xs btn-primary view-archive-btn" data-id="${a.id}">👁️</button>
                <button class="btn btn-xs btn-danger delete-archive-btn" data-id="${a.id}">🗑️</button>
            </div>
        </div>
    `).join('');
    
    el.querySelectorAll('.view-archive-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            const archive = getArchives().find(a => a.id === id);
            if (archive) {
                showToast(`Viewing archive: ${archive.label}`, 'info');
            }
        });
    });
    el.querySelectorAll('.delete-archive-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('Delete this archive?')) {
                deleteArchive(parseInt(btn.dataset.id));
                renderSessionArchives();
                showToast('Archive deleted.', 'success');
            }
        });
    });
}

function newSessionHandler() {
    const state = getState();
    if (state.rollHistory.length === 0 && state.chatHistory.length === 0) {
        showToast('No data to archive.', 'info');
        return;
    }
    const label = prompt('Session label:', `Session ${getArchives().length + 1}`) || `Session ${getArchives().length + 1}`;
    const archive = {
        id: Date.now(),
        timestamp: Date.now(),
        rollHistory: [...state.rollHistory],
        chatHistory: [...state.chatHistory],
        label
    };
    addArchive(archive);
    state.rollHistory = [];
    state.chatHistory = [];
    saveState();
    renderSessionArchives();
    showToast('New session started; previous archived.', 'success');
}

// ============================================================
// THEME FUNCTIONS
// ============================================================

function setTheme(mode) {
    if (mode === 'light') {
        document.documentElement.classList.add('light');
        localStorage.setItem('fates-edge-theme', 'light');
    } else if (mode === 'dark') {
        document.documentElement.classList.remove('light');
        localStorage.setItem('fates-edge-theme', 'dark');
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) document.documentElement.classList.remove('light');
        else document.documentElement.classList.add('light');
        localStorage.removeItem('fates-edge-theme');
    }
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        const isLight = document.documentElement.classList.contains('light');
        toggle.textContent = isLight ? '☀️' : '🌙';
    }
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === mode);
    });
}

// ============================================================
// LICENSE MODALS
// ============================================================

function openLicenseModal() {
    const modal = document.getElementById('licenseModal');
    if (!modal) return;
    const content = document.getElementById('licenseContent');
    if (content) {
        content.innerHTML = `
            <div style="font-family:var(--font-mono);white-space:pre-wrap;font-size:0.85rem;line-height:1.6;color:var(--text2);">
                ${LICENSE_TEXT}
            </div>
        `;
    }
    modal.classList.add('open');
}

function openLicenseSummaryModal() {
    const modal = document.getElementById('licenseModal');
    if (!modal) return;
    const content = document.getElementById('licenseContent');
    if (content) {
        content.innerHTML = `
            <div style="font-family:var(--font-mono);white-space:pre-wrap;font-size:0.9rem;line-height:1.8;color:var(--text2);">
                ${LICENSE_SUMMARY}
            </div>
        `;
    }
    modal.classList.add('open');
}

// ============================================================
// GET STATE HELPER
// ============================================================

function getState() {
    return getAppState();
}

// ============================================================
// PERIODIC UPDATES
// ============================================================

setInterval(() => {
    const statusEl = document.getElementById('sync-status');
    if (statusEl && window.__syncManager) {
        try {
            const status = window.__syncManager.getStatus ? window.__syncManager.getStatus() : null;
            if (status && status.isConnected) {
                statusEl.innerHTML = `🟢 Connected to ${status.campaignCode || 'campaign'}`;
            }
        } catch (e) {
            // Ignore
        }
    }
    updateWSStatusDisplay();
}, 10000);

// ============================================================
// EXPORT
// ============================================================

export default { render, attachEvents };
