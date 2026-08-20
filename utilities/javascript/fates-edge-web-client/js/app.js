/**
 * Fate's Edge Toolkit – Main Application Entry Point
 * See CHANGELOG.md at the repo root for the full version history —
 * this file no longer hardcodes a version number in its own comments;
 * see core/version.js for the single source of truth the app displays.
 *
 * ────────────────────────────────────────────────────────────────────────
 * X-Card overlay toggle via Ctrl+Shift+X or the floating button; raises
 * broadcast to the whole table when connected.
 * Auto‑load "The Lantern at Dusk" if no adventures present.
 * ────────────────────────────────────────────────────────────────────────
 */

import { initMediaModule } from './core/media.js';
import { APP_VERSION, applyDisplayedVersion } from './core/version.js';
import './core/highlight-tags.js';
import { loadState, onSave, getState, mergeState, resolveConflict, saveState, getStableClientId } from './core/state.js';
import { checkPasswordGate, isToolkitUnlocked, unlockToolkit } from './core/password.js';
import { initRouter, navigate, ROUTE_REDIRECTS, preloadModule } from './router.js';
import { showToast } from './components/Toast.js';
import { syncManager } from './core/sync/index.js';
import { getUserAvatar } from './core/gravatar.js';
import { getStorage, setStorage } from './core/utils.js';
import { getFeatureAccess, getFeatureLockMessage, watchFeatureVisibility } from './core/feature-toggles.js';
import { lockApp, initLocalLock } from './core/local-lock.js';
import { escHtml } from './core/utils.js';
import { sendEvent, onWSEvent, isConnectedToServer } from './core/websocket.js';
import { initTheme, setTheme, getCurrentPreference, getResolvedThemeId } from './core/theme-manager.js';
import { initPackManager } from './core/pack-manager.js';

// ============================================================
// TEST MODE HANDLING (disabled)
// ============================================================

// (existing test mode code, unchanged)

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
    console.log(`Fate's Edge Toolkit v${APP_VERSION} — Loading...`);
    applyDisplayedVersion();

    try {
        // 1. Load state
        loadState();
        const state = getState();

        // 2. Auto‑load starter adventure if none exist
        await autoLoadStarterAdventure(state);

        // 3. Init media (requires user ID)
        // BUGFIX: was `state.sessionId || 'app-' + Date.now().toString(36)`.
        // state.sessionId was never assigned anywhere, so this always hit the
        // fallback and minted a fresh random id on every app load/module
        // re-init — see getStableClientId()'s doc comment in core/state.js
        // for how that desynced the recording HUD's start/stop tracking.
        const userId = getStableClientId();
        initMediaModule(userId);

        // 4. Setup save indicator
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

        // 5. Setup UI components
        //
        // CHANGED: initPackManager() used to only run when the Settings tab
        // was opened (settings/index.js's tab-render hook), so any
        // pack-supplied theme (see core/theme-manager.js) sat unregistered —
        // and the app silently fell back to dark — until the user happened
        // to visit Settings after every reload. Running it here too (it's
        // idempotent — just re-reads localStorage and rebuilds the in-memory
        // pack registry) means a previously-selected pack theme is
        // registered and applied before setupTheme()/initTheme() resolves
        // the user's saved preference, with no flash of the wrong theme.
        initPackManager();
        setupImportExport();
        setupTheme();
        setupModals();
        setupSyncUI();
        setupSettingsTabHook();
        setupNavigation();
        setupFeatureAccess();
        setupLocalLock();
        setupConflictModalListener();
        setupXCardShortcut();
        setupXCard();  // button/resume clicks + remote raise/resume listeners
        setupShortcutsModal();

        // 6. Password gate
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

        // 7. Preload common modules in background (including Spellcraft)
        preloadCommonModules();

        // 8. Sync event listeners
        setupSyncEventListeners();

        console.log(`✅ Fate's Edge Toolkit v${APP_VERSION} — Ready`);
    } catch (error) {
        console.error('❌ Failed to initialize app:', error);
        showToast('Failed to initialize application. Please refresh.', 'error');
    }
}

// ============================================================
// AUTO-LOAD STARTER ADVENTURE (NEW)
// ============================================================

async function autoLoadStarterAdventure(state) {
    // Ensure state.adventures exists
    if (!state.adventures) {
        state.adventures = [];
        saveState();
    }
    // If already have adventures, skip
    if (state.adventures.length > 0) return;

    console.log('📖 No adventures found – attempting to auto-load "The Lantern at Dusk"...');
    try {
        const response = await fetch('/data/adventures/lantern_at_dusk.json');
        if (!response.ok) {
            console.warn('⚠️ Could not fetch lantern_at_dusk.json (HTTP', response.status, ')');
            return;
        }
        const adventure = await response.json();
        // Basic validation
        if (!adventure.id || !adventure.title) {
            console.warn('⚠️ Loaded adventure missing id or title – skipping');
            return;
        }
        state.adventures.push(adventure);
        saveState();
        console.log('✅ Auto-loaded "The Lantern at Dusk" adventure.');
    } catch (e) {
        console.warn('⚠️ Auto-load failed:', e);
    }
}

// ============================================================
// X-CARD / SAFETY TOOL
// ============================================================
//
// The floating #xcard-toggle button + #xcard-overlay (see index.html) are
// global chrome, rendered outside the router so they float over every
// route including the VTT. Previously this had two half-built code paths:
// setupXCardShortcut() (Ctrl+Shift+X, wired) and setupXCard() (the actual
// button/resume click handlers — defined but NEVER CALLED, so the button
// itself did nothing). Both are replaced by a single triggerXCard()/
// resumeXCard() pair so the button, the resume button, and the keyboard
// shortcut all do exactly the same thing.
//
// An X-Card only matters if it stops the WHOLE table, not just the person
// who clicked it — so raising it also broadcasts over the network (when
// connected) and posts a notice to VTT chat, and every other connected
// client's overlay opens too via the 'x-card-raised' listener below.

function getXCardSenderName() {
    try {
        const state = getState();
        const active = (state.characters || []).find(c => c.active !== false);
        return active?.name || 'Someone';
    } catch (e) {
        return 'Someone';
    }
}

function postXCardNoticeToVTT(text) {
    import('./features/vtt/index.js')
        .then(module => {
            if (module.addChatMessage && typeof module.addChatMessage === 'function') {
                module.addChatMessage({ text, sender: 'System', system: true });
            } else if (module.sendMessage && typeof module.sendMessage === 'function') {
                module.sendMessage(text, 'System', 'all', { system: true });
            }
        })
        .catch(() => { /* VTT module not loaded this session — fine, chat-only bridge is best-effort */ });
}

function updateXCardContent() {
    const overlay = document.getElementById('xcard-overlay');
    if (!overlay) return;
    const state = getState();
    const safety = state.campaign?.safety || { lines: '', veils: '' };
    const lines = safety.lines || 'None set';
    const veils = safety.veils || 'None set';
    const existing = overlay.querySelector('.xcard-safety-info');
    if (existing) existing.remove();
    const info = document.createElement('div');
    info.className = 'xcard-safety-info';
    info.style.cssText = 'margin-top:1rem;text-align:left;font-size:0.85rem;background:rgba(255,255,255,0.05);padding:0.8rem;border-radius:8px;border-left:3px solid var(--gold);';
    info.innerHTML = `
        <div><strong style="color:var(--gold);">Lines:</strong> ${escHtml(lines)}</div>
        <div><strong style="color:var(--gold);">Veils:</strong> ${escHtml(veils)}</div>
        <div style="font-size:0.7rem;color:var(--text3);margin-top:0.3rem;">These are the safety boundaries set by the group. Respect them.</div>
    `;
    overlay.querySelector('.xcard-content')?.appendChild(info);
}

/**
 * Open the X-Card overlay locally. `announce` is false when this call is a
 * *reaction* to a remote 'x-card-raised' broadcast (so we don't re-broadcast
 * an echo back out or double-post the chat notice).
 */
function openXCard(announce = true) {
    const overlay = document.getElementById('xcard-overlay');
    if (!overlay) {
        console.warn('X-Card overlay element (#xcard-overlay) not found.');
        return;
    }
    overlay.classList.add('open');
    document.body.classList.add('xcard-active');
    updateXCardContent();
    const resumeBtn = overlay.querySelector('.xcard-resume-btn');
    if (resumeBtn) setTimeout(() => resumeBtn.focus(), 100);

    if (announce) {
        const from = getXCardSenderName();
        if (isConnectedToServer()) {
            try { sendEvent({ type: 'x-card-raised', from }); } catch (e) { /* best-effort */ }
        }
        postXCardNoticeToVTT(`🛑 ${escHtml(from)} called an X-Card — pausing the scene. Check in before continuing.`);
    } else {
        showToast('🛑 An X-Card was called at the table — scene paused.', 'warning');
    }
}

/**
 * Close the X-Card overlay ("Resume"). Same announce/remote-echo logic as
 * openXCard().
 */
function resumeXCard(announce = true) {
    const overlay = document.getElementById('xcard-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.classList.remove('xcard-active');

    if (announce) {
        const from = getXCardSenderName();
        if (isConnectedToServer()) {
            try { sendEvent({ type: 'x-card-resumed', from }); } catch (e) { /* best-effort */ }
        }
        postXCardNoticeToVTT(`✅ ${escHtml(from)} resumed the scene.`);
    } else {
        showToast('✅ The table resumed — X-Card cleared.', 'success');
    }
}

function toggleXCard() {
    const overlay = document.getElementById('xcard-overlay');
    if (overlay && overlay.classList.contains('open')) {
        resumeXCard(true);
    } else {
        openXCard(true);
    }
}

function setupXCardShortcut() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+X (or Ctrl+Shift+x) toggles the X-Card overlay
        if (e.ctrlKey && e.shiftKey && (e.key === 'X' || e.key === 'x')) {
            e.preventDefault();
            toggleXCard();
        }
    });
}

/**
 * GM/player keyboard-shortcuts reference modal — opened via the sidebar's
 * ⌨️ footer button or the "?" key. Close/outside-click/Escape are handled
 * generically by setupModals() since this is a normal .modal-overlay.
 *
 * "?" is only armed when focus isn't in a text-entry control, so it never
 * steals a literal "?" character from chat, search, or any other input.
 */
function setupShortcutsModal() {
    const modal = document.getElementById('shortcutsModal');
    const openBtn = document.getElementById('shortcutsBtn');
    if (!modal) return;

    const open = () => {
        modal.classList.add('open');
        modal.querySelector('.modal-close')?.focus();
    };

    openBtn?.addEventListener('click', open);

    document.addEventListener('keydown', (e) => {
        if (e.key !== '?') return;
        const target = e.target;
        const isTyping = target && (
            target.matches('input, textarea, select, [contenteditable="true"]')
        );
        if (isTyping || e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        open();
    });
}

function setupXCard() {
    const toggleBtn = document.getElementById('xcard-toggle');
    const resumeBtn = document.getElementById('xcard-resume');

    if (toggleBtn) toggleBtn.addEventListener('click', () => toggleXCard());
    if (resumeBtn) resumeBtn.addEventListener('click', () => resumeXCard(true));

    // React to OTHER clients raising/resuming the X-Card. Registered on both
    // the dedicated event names (raw WebSocket transport dispatches these
    // directly — see websocket.js's handleWebSocketMessage switch) and the
    // generic 'event' bucket (Socket.IO transport only relays generic
    // 'event' messages without per-type dispatch — see socket.on('event', ...)
    // in websocket.js), so this works whichever transport is active.
    const handleRemoteRaise = (data) => {
        if (document.getElementById('xcard-overlay')?.classList.contains('open')) return; // already open locally
        openXCard(false);
    };
    const handleRemoteResume = (data) => {
        resumeXCard(false);
    };
    onWSEvent('x-card-raised', handleRemoteRaise);
    onWSEvent('x-card-resumed', handleRemoteResume);
    onWSEvent('event', (data) => {
        if (data?.type === 'x-card-raised') handleRemoteRaise(data);
        else if (data?.type === 'x-card-resumed') handleRemoteResume(data);
    });
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
    // BUGFIX: this used to attach its own click listener to
    // '.sidebar-nav .nav-item[data-tab]', while router.js's initRouter()
    // separately attaches one to '.sidebar-nav button[data-tab]'. Since
    // every sidebar button here actually is a literal
    // <button class="nav-item" data-tab="...">, both selectors match the
    // SAME elements — meaning every sidebar click used to call navigate()
    // twice (and, once the feature-access backstop below was added, would
    // have shown its "not available" toast twice too). router.js's
    // initRouter() is the authoritative click handler (it also manages the
    // URL hash); this function is now a deliberate no-op, kept only so any
    // external caller expecting setupNavigation() to exist doesn't break.
}

// ============================================================
// FEATURE ACCESS (GM-only / GM-toggled sidebar items)
// ============================================================
//
// NEW: replaces the old inline <script> in index.html. Grays out any
// sidebar item this client currently can't access — either a hard role
// restriction (e.g. GM Tools for a non-GM) or the GM's own opt-in toggle
// (e.g. they've hidden Adventure Manager from themselves this session) —
// and shows a toast explaining why on click.
//
// Deliberately does NOT set btn.disabled: a disabled button never fires a
// click event at all, so there'd be no way to show a notification when
// someone clicks it. This was the actual gap in the old inline script,
// which could only offer a passive tooltip via the title attribute.

function applyFeatureAccess() {
    document.querySelectorAll('.sidebar-nav [data-tab]').forEach(btn => {
        // FAILS OPEN: if getFeatureAccess() throws for any reason, treat
        // the item as accessible rather than leaving it (or, worse, every
        // subsequent item in this loop) in an unknown/locked state.
        let accessible = true;
        try {
            accessible = getFeatureAccess(btn.dataset.tab).accessible;
        } catch (err) {
            console.warn('[App] getFeatureAccess failed, treating as accessible:', err);
        }
        btn.classList.toggle('nav-item-locked', !accessible);
        btn.setAttribute('aria-disabled', String(!accessible));
    });
}

function setupFeatureAccess() {
    applyFeatureAccess();

    // Re-apply whenever the GM flips a toggle, or GM status changes hands
    // mid-session (watchFeatureVisibility listens for 'featureVisibilityChanged',
    // 'gmRoleUpdate', and 'presenceUpdate' — see core/feature-toggles.js).
    watchFeatureVisibility(applyFeatureAccess);

    // Delegated click interceptor in the CAPTURE phase, so it runs before
    // this file's own setupNavigation() listener (and router.js's) ever
    // reach navigate(). Locked items stop here; unlocked items are
    // untouched and fall through exactly as before.
    //
    // FAILS OPEN: wrapped in try/catch so that if getFeatureLockMessage()
    // (or anything else in here) throws, the click is allowed to proceed
    // normally rather than being silently swallowed — a broken lock-check
    // should never be able to take down navigation entirely.
    document.querySelector('.sidebar-nav')?.addEventListener('click', (e) => {
        try {
            const btn = e.target.closest('[data-tab].nav-item-locked');
            if (!btn) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            showToast(getFeatureLockMessage(btn.dataset.tab) || 'This is currently unavailable.', 'info');
        } catch (err) {
            console.warn('[App] Feature-lock click handler failed, allowing navigation:', err);
        }
    }, true); // capture: true
}

// ============================================================
// LOCAL LOCK (manual screen lock, separate from the playtester gate)
// ============================================================
//
// See core/local-lock.js for the full design. initLocalLock() re-shows
// the lock overlay immediately if the page was reloaded while locked, and
// wires up the overlay's own password/reset-code inputs. The sidebar
// button here just triggers lockApp() — everything else (prompting for a
// password on first use, checking it, the emergency reset flow) lives in
// that module.

function setupLocalLock() {
    initLocalLock();
    document.getElementById('lockAppBtn')?.addEventListener('click', () => {
        lockApp();
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

// CHANGED: this used to be its OWN independent dark/light toggle
// implementation (documentElement.classList.add/remove('light') +
// localStorage['fates-edge-theme']) — a second copy of exactly the same
// logic settings/index.js's setTheme() also had, with no registry, no way
// for a third theme (built-in or pack-supplied) to plug in, and no shared
// source of truth between the two copies. Both now go through
// core/theme-manager.js; this function just keeps the sidebar's quick-toggle
// button in sync with whatever theme-manager resolves (dark/light/auto or —
// once one is installed — any pack-supplied theme, in which case the quick
// toggle simply flips between dark and light as a convenience, same as
// before; the Settings panel's theme picker is where every registered theme
// is actually selectable).
function setupTheme() {
    initTheme();

    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    const syncToggleIcon = () => {
        toggle.textContent = getResolvedThemeId() === 'light' ? '☀️' : '🌙';
    };
    syncToggleIcon();
    document.addEventListener('theme-changed', syncToggleIcon);

    toggle.addEventListener('click', () => {
        setTheme(getResolvedThemeId() === 'light' ? 'dark' : 'light');
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
                <input type="text" id="sync-campaign-code" placeholder="AC12" maxlength="6" style="text-transform:uppercase;" />
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
                <span style="font-weight:${isYou ? '600' : '400'};">${escHtml(client.name) || 'Unknown'} ${isYou ? '(you)' : ''}</span>
                <span class="text-muted small" style="font-size:0.7rem;background:var(--bg4);padding:0.05rem 0.4rem;border-radius:12px;">${escHtml(client.role) || 'player'}</span>
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
        <img src="${escHtml(avatarUrl)}" alt="${escHtml(name) || 'User'}"
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

let conflictModalHiddenSiblings = null;

function showConflictModal(conflicts) {
    if (!conflicts || conflicts.length === 0) return;

    let modal = document.getElementById('conflictModal');
    if (!modal) {
        // Inline editor screen — not a pop-up. Takes over the page in place
        // of whatever's currently shown.
        modal = document.createElement('div');
        modal.id = 'conflictModal';
        modal.className = 'editor-screen-host';
        modal.style.cssText = 'display:none;padding:1rem 0;';
        const hostContainer = document.getElementById('app-content') || document.body;
        hostContainer.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="editor-screen" style="max-width: 600px;margin:0 auto;">
            <div class="modal-header">
                <button class="btn btn-secondary editor-back modal-close">← Back</button>
                <h3>⚠️ Sync Conflict Detected</h3>
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

    const hostContainer = document.getElementById('app-content') || document.body;
    conflictModalHiddenSiblings = Array.from(hostContainer.children).filter(ch => ch !== modal);
    conflictModalHiddenSiblings.forEach(ch => { ch.style.display = 'none'; });
    modal.style.display = 'block';
    window.scrollTo({ top: 0 });

    const closeConflictModal = () => {
        modal.style.display = 'none';
        if (conflictModalHiddenSiblings) {
            conflictModalHiddenSiblings.forEach(ch => { ch.style.display = ''; });
            conflictModalHiddenSiblings = null;
        }
    };

    modal.querySelector('.modal-close').addEventListener('click', closeConflictModal);

    conflicts.forEach(c => {
        modal.querySelector('#conflict-keep-local').addEventListener('click', () => {
            resolveConflict(c.id, 'local');
            showToast('Kept local version.', 'info');
            closeConflictModal();
        });
        modal.querySelector('#conflict-use-remote').addEventListener('click', () => {
            resolveConflict(c.id, 'remote');
            showToast('Applied remote version.', 'info');
            closeConflictModal();
        });
        modal.querySelector('#conflict-merge').addEventListener('click', () => {
            resolveConflict(c.id, 'merge');
            showToast('Merged both versions.', 'success');
            closeConflictModal();
        });
    });
}

// ============================================================
// BACKGROUND PRELOAD
// ============================================================

function preloadCommonModules() {
    // Preload often-used modules to speed up navigation
    // Added 'spellcraft' to the list
    const common = ['home', 'characters', 'dice', 'spellcraft'];
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
