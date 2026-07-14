/**
 * Fate's Edge Toolkit - Main Application Entry Point
 * v3.0 - Modular Architecture
 */

import { loadState, onSave, getState, getBaseUrl, mergeState } from './core/state.js';
import { checkPasswordGate, isToolkitUnlocked, onUnlock as onPasswordUnlock, unlockToolkit } from './core/password.js';
import { initRouter, registerRoute, navigate } from './router.js';
import { showToast } from './components/Toast.js';
import { syncManager } from './core/sync/index.js';
import { getUserAvatar } from './core/gravatar.js';
import { moduleLoader } from './module-loader.js';

// ============================================================
// FEATURE MODULES (dynamic imports for lazy loading)
// ============================================================

const FEATURES = {
    home: () => import('./features/home/index.js'),
    dashboard: () => import('./features/dashboard/index.js'),
    characters: () => import('./features/characters/index.js'),
    dice: () => import('./features/dice/index.js'),
    timers: () => import('./features/timers/index.js'),
    encounters: () => import('./features/encounters/index.js'),
    factions: () => import('./features/factions/index.js'),
    vtt: () => import('./features/vtt/index.js'),
    'scene-tools': () => import('./features/dashboard/scene-tools.js'),
    docs: () => import('./features/docs/index.js'),
    search: () => import('./features/search/index.js'),
    wiki: () => import('./features/wiki/index.js'),
    decks: () => import('./features/decks/index.js'),
    patrons: () => import('./features/patrons/index.js'),
    settings: () => import('./features/settings/index.js')
};

// ============================================================
// ROUTE REDIRECTS
// ============================================================

const ROUTE_REDIRECTS = {
    'consequences': 'decks',
    'regional': 'decks',
    'roller': 'dice'
};

// ============================================================
// TEST MODE
// ============================================================

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
            
            if (module.initTestRunner) {
                module.initTestRunner();
                setTimeout(() => {
                    if (module.runTests) {
                        module.runTests();
                    }
                }, 500);
            }
        })
        .catch(err => {
            console.error('Failed to load test runner:', err);
        });
    throw new Error('Test mode active - stopping app initialization');
}

// ============================================================
// STATE
// ============================================================

let routerInitialized = false;

// ============================================================
// ROUTER INITIALIZATION
// ============================================================

function initializeRouter() {
    if (routerInitialized) return;
    routerInitialized = true;
    console.log('🔀 Initializing router...');
    initRouter();
    
    const hash = window.location.hash.slice(1);
    const urlParams = new URLSearchParams(window.location.search);
    let tab = urlParams.get('tab') || hash || 'home';
    
    if (ROUTE_REDIRECTS[tab]) {
        const newTab = ROUTE_REDIRECTS[tab];
        console.log(`↪️ Redirecting "${tab}" → "${newTab}"`);
        tab = newTab;
        if (window.location.hash) {
            window.location.hash = newTab;
        }
    }
    
    setTimeout(() => {
        navigate(tab);
    }, 100);
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

function onUnlockSuccess() {
    console.log('🔓 Toolkit unlocked');
    showToast('Welcome back!', 'success');
    initializeRouter();
}

// ============================================================
// APP INITIALIZATION
// ============================================================

async function init() {
    console.log('Fate\'s Edge Toolkit v3.0 — Loading...');
    
    try {
        loadState();
        
        console.log('📋 Registering routes...');
        Object.entries(FEATURES).forEach(([tab, module]) => {
            registerRoute(tab, module);
        });
        console.log('✅ Routes registered:', Object.keys(FEATURES));
        
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
        
        setupImportExport();
        setupTheme();
        setupModals();
        setupSyncUI();
        setupSettingsTabHook();
        setupNavigation();

        const state = getState();
        const hasPassword = !!state.passwordHash;
        
        if (hasPassword) {
            console.log('🔐 Password required');
            const isUnlocked = isToolkitUnlocked();
            
            if (isUnlocked) {
                console.log('🔓 Already unlocked from session');
                onUnlockSuccess();
            } else {
                showPasswordOverlay(state);
            }
        } else {
            console.log('🔓 No password required');
            initializeRouter();
        }
        
        // Preload modules
        import('./features/decks/index.js')
            .then(module => {
                console.log('🃏 Decks module loaded');
                if (module.loadManifest) {
                    module.loadManifest().catch(() => {});
                }
            })
            .catch(err => {
                console.warn('Failed to preload decks module:', err);
            });
        
        import('./features/patrons/index.js')
            .then(module => {
                console.log('👁️ Patrons module loaded');
                if (module.loadPatronData) {
                    module.loadPatronData();
                }
            })
            .catch(err => {
                console.warn('Failed to preload patrons module:', err);
            });
        
        import('./features/factions/index.js')
            .then(module => {
                console.log('🏛️ Factions module loaded');
                if (module.loadFactionData) {
                    module.loadFactionData();
                }
            })
            .catch(err => {
                console.warn('Failed to preload factions module:', err);
            });
        
        import('./features/wiki/index.js')
            .then(module => {
                if (module.loadRemoteWiki) {
                    module.loadRemoteWiki().catch(() => {});
                }
            })
            .catch(err => {
                console.warn('Failed to load wiki module:', err);
            });
        
        setupSyncEventListeners();
        
        console.log('Fate\'s Edge Toolkit v3.0 — Ready');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showToast('Failed to initialize application. Please refresh.', 'error');
    }
}

// ============================================================
// SETUP FUNCTIONS
// ============================================================

function setupNavigation() {
    const navButtons = document.querySelectorAll('.sidebar-nav .nav-item[data-tab]');
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            if (tab) {
                const targetTab = ROUTE_REDIRECTS[tab] || tab;
                if (targetTab !== tab) {
                    console.log(`↪️ Redirecting "${tab}" → "${targetTab}"`);
                    button.dataset.tab = targetTab;
                }
                navigate(targetTab);
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
                if (exportAllData) {
                    exportAllData();
                }
            } catch (error) {
                console.error('Failed to export data:', error);
                showToast('Failed to export data', 'error');
            }
        });
    }
    
    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => {
            importFile.click();
        });
        importFile.addEventListener('change', async (event) => {
            try {
                const { importAllData } = await import('./features/settings/index.js');
                if (importAllData) {
                    importAllData(event);
                }
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
    
    const theme = localStorage.getItem('fates-edge-theme');
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
            localStorage.setItem('fates-edge-theme', 'dark');
            toggle.textContent = '🌙';
        } else {
            document.documentElement.classList.add('light');
            localStorage.setItem('fates-edge-theme', 'light');
            toggle.textContent = '☀️';
        }
    });
}

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
    
    const savedEmail = localStorage.getItem('fates-edge-user-email') || '';
    
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
    
    const savedUrl = localStorage.getItem('fates-edge-sync-url') || '';
    const savedCode = localStorage.getItem('fates-edge-sync-code') || '';
    
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
            localStorage.setItem('fates-edge-user-email', email);
            if (syncManager.isConnected) {
                syncManager.setEmail(email);
            }
        });
    }
    
    if (avatarBtn) {
        avatarBtn.addEventListener('click', () => {
            if (emailInput) {
                const email = emailInput.value.trim();
                localStorage.setItem('fates-edge-user-email', email);
                if (syncManager.isConnected) {
                    syncManager.setEmail(email);
                }
                showToast('Avatar updated!', 'success');
            }
        });
    }
    
    if (showAvatarsCheck) {
        const savedShowAvatars = localStorage.getItem('fates-edge-show-avatars') !== 'false';
        showAvatarsCheck.checked = savedShowAvatars;
        showAvatarsCheck.addEventListener('change', () => {
            localStorage.setItem('fates-edge-show-avatars', showAvatarsCheck.checked);
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
            
            localStorage.setItem('fates-edge-sync-url', url);
            localStorage.setItem('fates-edge-sync-code', code);
            if (email) localStorage.setItem('fates-edge-user-email', email);
            
            connectBtn.disabled = true;
            connectBtn.textContent = 'Connecting…';
            
            try {
                await syncManager.connect(url, code, password, { 
                    email: email 
                });
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

// ============================================================
// UI UPDATE FUNCTIONS
// ============================================================

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

function updatePresenceUI(clients) {
    const presenceEl = document.getElementById('presence-list');
    if (!presenceEl) return;
    
    if (!clients || clients.length === 0) {
        presenceEl.innerHTML = '<span class="text-muted">No other users online</span>';
        return;
    }
    
    const showAvatars = localStorage.getItem('fates-edge-show-avatars') !== 'false';
    
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
                ${showAvatars ? '' : `<span class="status-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${client.status === 'online' ? 'var(--green)' : 'var(--gold)'};margin-left:auto;"></span>`}
            </div>
        `;
    }).join('');
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

document.addEventListener('DOMContentLoaded', init);

export { init, moduleLoader, ROUTE_REDIRECTS };