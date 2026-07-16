/**
 * Fate's Edge Toolkit – Main Application Entry Point
 * v3.1 – Unified router integration, cleaned up.
 */

import { initMediaModule } from './core/media.js';
import './core/highlight-tags.js';
import { loadState, onSave, getState, mergeState, resolveConflict } from './core/state.js';
import { checkPasswordGate, isToolkitUnlocked, unlockToolkit } from './core/password.js';
import { initRouter, navigate, ROUTE_REDIRECTS, preloadModule } from './router.js';
import { showToast } from './components/Toast.js';
import { syncManager } from './core/sync/index.js';
import { getUserAvatar } from './core/gravatar.js';
import { getStorage, setStorage } from './core/utils.js';

// ============================================================
// TEST MODE HANDLING
// ============================================================

/*
const isTestMode = window.location.search.includes('test=true') || window.location.pathname.includes('/tests/');
if (isTestMode) {
    console.log('🧪 Running in test mode');
     import('./tests/runner.js')
        .then(module => {
            import('./tests/unit/operations.test.js');
            import('./tests/unit/offline-queue.test.js');
            import('./tests/unit/conflict.test.js');
            import('./tests/unit/presence.test.js');
            import('./tests/integration/sync-integration.test.js');
            import('./tests/integration/websocket-integration.test.js');
            if (module.initTestRunner) module.initTestRunner();
            setTimeout(() => { if (module.runTests) module.runTests(); }, 500);
        })
        .catch(err => console.error('Test runner load failed:', err));
  
   // Stop normal execution in test mode
    throw new Error('Test mode active – stopping app initialization');
}
*/

// ============================================================
// INITIALISATION
// ============================================================

let routerInitialized = false;

function initializeRouter() {
    if (routerInitialized) return;
    routerInitialized = true;
    console.log('🔀 Initializing router...');
    initRouter();
    // The router handles hash and initial navigation internally
}

function onUnlockSuccess() {
    console.log('🔓 Toolkit unlocked');
    showToast('Welcome back!', 'success');
    initializeRouter();
}

async function init() {
    console.log('Fate\'s Edge Toolkit v3.1 — Loading...');

    try {
        // 1. Load state
        loadState();
        const state = getState();

        // 2. Init media (requires user ID)
        const userId = state.sessionId || 'app-' + Date.now().toString(36);
        initMediaModule(userId);

        // 3. Setup save indicator
        const saveStatus = document.getElementById('save-status');
        if (saveStatus) {
            onSave((status) => {
                saveStatus.className = 'saved-indicator';
                if (status === 'saving') {
                    saveStatus.textContent = '○ Saving…';
                    saveStatus.classList.add('saving');
                } else if (status === 'saved') {
                    saveStatus.textContent = '● Saved';
                    saveStatus.classList.add('saved');
                } else {
                    saveStatus.textContent = '⚠ Error';
                    saveStatus.classList.add('error');
                }
            });
        }

        // 4. Setup UI components
        setupImportExport();
        setupTheme();
        setupModals();
        setupSyncUI();
        setupSettingsTabHook();
        setupNavigation();
        setupConflictModalListener();

        // 5. Password gate
        const hasPassword = !!state.passwordHash;
        if (hasPassword) {
            console.log('🔐 Password required');
            if (isToolkitUnlocked()) {
                console.log('🔓 Already unlocked from session');
                onUnlockSuccess();
            } else {
                showPasswordOverlay(state);
            }
        } else {
            console.log('🔓 No password required');
            initializeRouter();
        }

        // 6. Preload common modules in background
        preloadCommonModules();

        // 7. Sync event listeners
        setupSyncEventListeners();

        console.log('✅ Fate\'s Edge Toolkit v3.1 — Ready');
    } catch (error) {
        console.error('❌ Failed to initialize app:', error);
        showToast('Failed to initialize application. Please refresh.', 'error');
    }
}

// ============================================================
// PASSWORD OVERLAY
// ============================================================

function showPasswordOverlay(state) {
    let overlay = document.getElementById('passwordOverlay');
    if (overlay) {
        overlay.classList.add('open');
        const input = document.getElementById('passwordInput');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
        return;
    }

    overlay = document.createElement('div');
    overlay.id = 'passwordOverlay';
    overlay.className = 'password-overlay open';

    overlay.innerHTML = `
        <div class="gate-box">
            <span class="gate-icon">🔐</span>
            <h2 class="gate-title">Password Required</h2>
            <p class="gate-sub">This toolkit is password protected. Enter the password to continue.</p>

            <div id="passwordError" class="gate-error"></div>

            <form id="passwordForm" style="display:contents;">
                <input
                    type="password"
                    id="passwordInput"
                    class="gate-input"
                    placeholder="Enter password..."
                    autofocus
                    autocomplete="current-password"
                />
                <button type="submit" id="passwordSubmitBtn" class="gate-btn">
                    🔓 Unlock
                </button>
            </form>

            <div class="gate-foot">🔑 Required to access the toolkit</div>
        </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('passwordInput');
    if (input) {
        setTimeout(() => input.focus(), 200);
    }

    const form = document.getElementById('passwordForm');
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handlePasswordSubmit(state);
    });

    input?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            await handlePasswordSubmit(state);
        }
    });
}

async function handlePasswordSubmit(state) {
    const input = document.getElementById('passwordInput');
    const errorEl = document.getElementById('passwordError');
    const submitBtn = document.getElementById('passwordSubmitBtn');

    if (!input || !errorEl) return;

    const password = input.value.trim();

    if (!password) {
        errorEl.textContent = '⚠️ Please enter a password.';
        input.classList.add('error');
        setTimeout(() => input.classList.remove('error'), 1000);
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Checking...';
    }

    try {
        const result = await checkPasswordGate(state, password);

        if (result.unlocked) {
            unlockToolkit();
            const overlay = document.getElementById('passwordOverlay');
            if (overlay) {
                overlay.classList.remove('open');
                setTimeout(() => {
                    overlay.style.display = 'none';
                }, 400);
            }
            onUnlockSuccess();
        } else {
            errorEl.textContent = '❌ ' + (result.error || 'Invalid password. Please try again.');
            input.value = '';
            input.classList.add('error');
            setTimeout(() => input.classList.remove('error'), 1000);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '🔓 Unlock';
            }
            setTimeout(() => input.focus(), 100);
        }
    } catch (error) {
        console.error('Password check error:', error);
        errorEl.textContent = '❌ An error occurred. Please try again.';
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '🔓 Unlock';
        }
    }
}

// ============================================================
// UI SETUP FUNCTIONS
// ============================================================

function setupNavigation() {
    // Sidebar clicks are already handled by router.js.
    // This is kept for any extra redirection logic if needed.
    document.querySelectorAll('.sidebar-nav .nav-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab) {
                const targetTab = ROUTE_REDIRECTS[tab] || tab;
                if (targetTab !== tab) {
                    btn.dataset.tab = targetTab; // update for next time
                }
                navigate(targetTab); // router will update hash
            }
        });
    });
}

function setupImportExport() {
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');

    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                const { exportAllData } = await import('./features/settings/index.js');
                if (exportAllData) exportAllData();
            } catch (error) {
                console.error('Failed to export data:', error);
                showToast('Failed to export data', 'error');
            }
        });
    }

    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', async (event) => {
            try {
                const { importAllData } = await import('./features/settings/index.js');
                if (importAllData) importAllData(event);
            } catch (error) {
                console.error('Failed to import data:', error);
                showToast('Failed to import data', 'error');
            }
        });
    }
}

function setupTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    const theme = getStorage('fates-edge-theme');
    if (theme === 'light') {
        document.documentElement.classList.add('light');
        toggle.textContent = '☀️';
    } else if (theme === 'dark') {
        document.documentElement.classList.remove('light');
        toggle.textContent = '🌙';
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (!prefersDark) {
            document.documentElement.classList.add('light');
            toggle.textContent = '☀️';
        }
    }

    toggle.addEventListener('click', () => {
        const isLight = document.documentElement.classList.contains('light');
        if (isLight) {
            document.documentElement.classList.remove('light');
            setStorage('fates-edge-theme', 'dark');
            toggle.textContent = '🌙';
        } else {
            document.documentElement.classList.add('light');
            setStorage('fates-edge-theme', 'light');
            toggle.textContent = '☀️';
        }
    });
}

function setupModals() {
    document.querySelectorAll('.modal .modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const overlay = btn.closest('.modal-overlay');
            if (overlay) overlay.classList.remove('open');
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('open');
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.open').forEach(m => {
                if (!m.classList.contains('password-overlay')) {
                    m.classList.remove('open');
                }
            });
        }
    });
}

// ============================================================
// SYNC UI SETUP
// ============================================================

function setupSyncUI() {
    const settingsTab = document.getElementById('tab-settings');
    if (!settingsTab) return;

    const observer = new MutationObserver(() => {
        if (settingsTab.classList.contains('active')) {
            renderSyncUI();
        }
    });
    observer.observe(settingsTab, { attributes: true, attributeFilter: ['class'] });

    if (settingsTab.classList.contains('active')) {
        renderSyncUI();
    }
}

function renderSyncUI() {
    if (document.getElementById('sync-panel')) return;

    const settingsContent = document.getElementById('tab-settings');
    if (!settingsContent) return;

    const dataPanel = settingsContent.querySelector('.panel:first-child');
    if (!dataPanel) return;

    const savedEmail = getStorage('fates-edge-user-email') || '';

    const syncPanel = document.createElement('div');
    syncPanel.className = 'panel';
    syncPanel.id = 'sync-panel';
    syncPanel.innerHTML = `
        <h3>🌐 Live Campaign</h3>
        <p class="text-muted small">Connect to a campaign server for real-time collaboration with your group.</p>

        <div class="form-row">
            <div class="field large">
                <label>Server URL</label>
                <input type="text" id="sync-server-url" placeholder="ws://localhost:3000 or https://your-server.com" />
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

        <div class="form-row">
            <div class="field large">
                <label>Your Email <span class="text-muted small">(for Gravatar avatar)</span></label>
                <input type="email" id="sync-user-email" placeholder="your@email.com" value="${savedEmail}" />
            </div>
            <div class="field" style="flex:0 0 auto;align-self:end;">
                <button class="btn btn-sm" id="sync-update-avatar-btn">🔄 Update Avatar</button>
            </div>
        </div>

        <div class="flex">
            <button class="btn btn-gold" id="sync-connect-btn">🔗 Connect</button>
            <button class="btn btn-danger" id="sync-disconnect-btn" style="display:none;">⛔ Disconnect</button>
            <button class="btn btn-sm" id="sync-refresh-btn">↻ Refresh</button>
        </div>

        <div id="sync-status" class="mt-1" style="font-size:0.9rem;padding:0.3rem 0.6rem;border-radius:var(--radius);background:var(--bg3);">
            🔴 Disconnected
        </div>

        <div class="mt-1">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                <h4 style="margin:0;font-size:0.95rem;">👥 Online Players</h4>
                <label class="inline-check" style="font-size:0.8rem;">
                    <input type="checkbox" id="sync-show-avatars" checked />
                    Show avatars
                </label>
            </div>
            <div id="presence-list" class="text-muted small" style="min-height:2rem;padding:0.3rem 0.6rem;background:var(--bg3);border-radius:var(--radius);">
                No other users online
            </div>
        </div>
    `;

    dataPanel.parentNode.insertBefore(syncPanel, dataPanel.nextSibling);

    const savedUrl = getStorage('fates-edge-sync-url') || '';
    const savedCode = getStorage('fates-edge-sync-code') || '';

    const urlInput = document.getElementById('sync-server-url');
    const codeInput = document.getElementById('sync-campaign-code');
    const passInput = document.getElementById('sync-password');
    const emailInput = document.getElementById('sync-user-email');
    const connectBtn = document.getElementById('sync-connect-btn');
    const disconnectBtn = document.getElementById('sync-disconnect-btn');
    const refreshBtn = document.getElementById('sync-refresh-btn');
    const avatarBtn = document.getElementById('sync-update-avatar-btn');
    const showAvatarsCheck = document.getElementById('sync-show-avatars');

    if (urlInput) urlInput.value = savedUrl;
    if (codeInput) codeInput.value = savedCode;

    if (emailInput) {
        emailInput.addEventListener('change', () => {
            const email = emailInput.value.trim();
            setStorage('fates-edge-user-email', email);
            if (syncManager.isConnected) {
                syncManager.setEmail(email);
            }
        });
    }

    if (avatarBtn) {
        avatarBtn.addEventListener('click', () => {
            if (emailInput) {
                const email = emailInput.value.trim();
                setStorage('fates-edge-user-email', email);
                if (syncManager.isConnected) {
                    syncManager.setEmail(email);
                }
                showToast('Avatar updated!', 'success');
            }
        });
    }

    if (showAvatarsCheck) {
        const savedShowAvatars = getStorage('fates-edge-show-avatars', 'true') !== 'false';
        showAvatarsCheck.checked = savedShowAvatars;
        showAvatarsCheck.addEventListener('change', () => {
            setStorage('fates-edge-show-avatars', showAvatarsCheck.checked ? 'true' : 'false');
            updatePresenceUI(syncManager.presence.getOnlineClients());
        });
    }

    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            const code = codeInput.value.trim().toUpperCase();
            const password = passInput.value.trim();
            const email = emailInput ? emailInput.value.trim() : '';

            if (!url) {
                showToast('Please enter a server URL.', 'error');
                return;
            }
            if (!code) {
                showToast('Please enter a campaign code.', 'error');
                return;
            }

            setStorage('fates-edge-sync-url', url);
            setStorage('fates-edge-sync-code', code);
            if (email) setStorage('fates-edge-user-email', email);

            connectBtn.disabled = true;
            connectBtn.textContent = 'Connecting…';

            try {
                await syncManager.connect(url, code, password, { email: email });
                connectBtn.style.display = 'none';
                disconnectBtn.style.display = 'inline-flex';
                updateSyncStatusUI({ connected: true, campaignCode: code });
                showToast('Connected to campaign!', 'success');
            } catch (e) {
                showToast('Connection failed: ' + e.message, 'error');
                updateSyncStatusUI({ connected: false, reason: e.message });
            } finally {
                connectBtn.disabled = false;
                connectBtn.textContent = '🔗 Connect';
            }
        });
    }

    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
            syncManager.disconnect();
            connectBtn.style.display = 'inline-flex';
            disconnectBtn.style.display = 'none';
            updateSyncStatusUI({ connected: false });
            showToast('Disconnected.', 'info');
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (syncManager.isConnected) {
                syncManager.requestFullSync();
                showToast('Requesting full sync…', 'info');
            } else {
                showToast('Not connected.', 'warning');
            }
        });
    }
}

function setupSettingsTabHook() {
    const settingsBtn = document.querySelector('.sidebar-nav .nav-item[data-tab="settings"]');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            setTimeout(renderSyncUI, 100);
        });
    }
}

function setupSyncEventListeners() {
    syncManager.on('connection_change', (status) => {
        updateSyncStatusUI(status);
        const connectBtn = document.getElementById('sync-connect-btn');
        const disconnectBtn = document.getElementById('sync-disconnect-btn');
        if (connectBtn && disconnectBtn) {
            if (status.connected) {
                connectBtn.style.display = 'none';
                disconnectBtn.style.display = 'inline-flex';
            } else {
                connectBtn.style.display = 'inline-flex';
                disconnectBtn.style.display = 'none';
            }
        }
    });

    syncManager.on('presence_update', (data) => {
        updatePresenceUI(data.clients);
    });

    syncManager.on('sync_ready', (data) => {
        showToast('Sync ready! Connected to ' + (data.clients?.length || 0) + ' other users.', 'success');
    });

    syncManager.on('sync_error', (error) => {
        showToast('Sync error: ' + error.message, 'error');
    });
}

function updateSyncStatusUI(status) {
    const statusEl = document.getElementById('sync-status');
    if (!statusEl) return;

    if (status.connected) {
        statusEl.innerHTML = `🟢 Connected to <strong>${status.campaignCode || 'campaign'}</strong>`;
        statusEl.style.color = 'var(--green)';
    } else {
        const reason = status.reason ? `: ${status.reason}` : '';
        statusEl.innerHTML = `🔴 Disconnected${reason}`;
        statusEl.style.color = 'var(--red)';
    }
}

function updatePresenceUI(clients) {
    const presenceEl = document.getElementById('presence-list');
    if (!presenceEl) return;

    if (!clients || clients.length === 0) {
        presenceEl.innerHTML = '<span class="text-muted">No other users online</span>';
        return;
    }

    const showAvatars = getStorage('fates-edge-show-avatars', 'true') !== 'false';

    presenceEl.innerHTML = clients.map(client => {
        const isYou = client.id === syncManager.clientId;
        return `
            <div class="presence-item" style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border);">
                ${showAvatars ? generateAvatarHTML(client.email, client.name, 32) : `
                    <span class="status-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${client.status === 'online' ? 'var(--green)' : 'var(--gold)'};"></span>
                `}
                <span style="font-weight:${isYou ? '600' : '400'};">${client.name || 'Unknown'} ${isYou ? '(you)' : ''}</span>
                <span class="text-muted small" style="font-size:0.7rem;background:var(--bg4);padding:0.05rem 0.4rem;border-radius:12px;">${client.role || 'player'}</span>
                ${client.status === 'away' ? '<span class="text-muted small">(away)</span>' : ''}
            </div>
        `;
    }).join('');
}

function generateAvatarHTML(email, name, size = 32) {
    const initial = (name || 'U')[0].toUpperCase();
    const avatarUrl = getUserAvatar(email, name, size);

    const fallbackSvg = encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <rect width="${size}" height="${size}" fill="#6C5CE7" rx="${size * 0.25}"/>
            <text x="${size/2}" y="${size * 0.65}" text-anchor="middle"
                  font-family="Arial" font-weight="bold" font-size="${size * 0.45}" fill="white">${initial}</text>
        </svg>
    `);
    const fallbackDataUrl = `data:image/svg+xml,${fallbackSvg}`;

    return `
        <img src="${avatarUrl}" alt="${name || 'User'}"
             style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;background:var(--bg3);border:2px solid var(--border);flex-shrink:0;"
             loading="lazy"
             onerror="this.src='${fallbackDataUrl.replace(/'/g, "\\'")}'" />
    `;
}

// ============================================================
// CONFLICT MODAL
// ============================================================

function setupConflictModalListener() {
    document.addEventListener('syncConflict', (e) => {
        showConflictModal(e.detail.conflicts);
    });
}

function showConflictModal(conflicts) {
    if (!conflicts || conflicts.length === 0) return;

    let modal = document.getElementById('conflictModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'conflictModal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header">
                <h3>⚠️ Sync Conflict Detected</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                ${conflicts.map(c => `
                    <div class="panel" style="margin-bottom: 1rem;">
                        <h4>${c.type === 'character' ? 'Character' : 'Entity'} "${c.local.name || c.id}" was edited simultaneously.</h4>
                        <div style="display: flex; gap: 1rem;">
                            <div style="flex: 1;">
                                <strong>Your version:</strong>
                                <pre style="white-space: pre-wrap; font-size: 0.85rem; background: var(--bg3); padding: 0.5rem;">${JSON.stringify(c.local, null, 2)}</pre>
                            </div>
                            <div style="flex: 1;">
                                <strong>Remote version:</strong>
                                <pre style="white-space: pre-wrap; font-size: 0.85rem; background: var(--bg3); padding: 0.5rem;">${JSON.stringify(c.remote, null, 2)}</pre>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="modal-footer">
                <button class="btn" id="conflict-keep-local">Keep Yours</button>
                <button class="btn" id="conflict-use-remote">Use Remote</button>
                <button class="btn btn-gold" id="conflict-merge">Merge Both</button>
            </div>
        </div>
    `;

    modal.classList.add('open');

    modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.remove('open'));

    conflicts.forEach(c => {
        modal.querySelector('#conflict-keep-local').addEventListener('click', () => {
            resolveConflict(c.id, 'local');
            showToast('Kept local version.', 'info');
            modal.classList.remove('open');
        });
        modal.querySelector('#conflict-use-remote').addEventListener('click', () => {
            resolveConflict(c.id, 'remote');
            showToast('Applied remote version.', 'info');
            modal.classList.remove('open');
        });
        modal.querySelector('#conflict-merge').addEventListener('click', () => {
            resolveConflict(c.id, 'merge');
            showToast('Merged both versions.', 'success');
            modal.classList.remove('open');
        });
    });
}

// ============================================================
// BACKGROUND PRELOAD
// ============================================================

function preloadCommonModules() {
    // Preload often-used modules to speed up navigation
    const common = ['home', 'characters', 'dice'];
    common.forEach(tab => {
        preloadModule(tab).catch(() => {});
    });
}

// ============================================================
// START
// ============================================================

document.addEventListener('DOMContentLoaded', init);

// Export anything needed elsewhere
export { init };