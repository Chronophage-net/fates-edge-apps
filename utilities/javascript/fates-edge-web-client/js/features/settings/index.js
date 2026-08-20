/**
 * Settings Module – Data management, sync, preferences
 * 
 * Features:
 * - Data export/import/clear
 * - Password protection management
 * - WebSocket configuration
 * - Live campaign sync (WebSocket + HTTP)
 * - Pack management
 * - Session archives
 * - Theme switching
 * - License display
 * - Tours & Onboarding (Welcome Tour + Magic Paths Tour)
 */

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
    addCharacter
} from '../../core/state.js';
import { checkPasswordGate, hashPassword } from '../../core/password.js';
import { escHtml, formatDate } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { getUserAvatar } from '../../core/gravatar.js';
import {
    connectWebSocket,
    disconnectWebSocket,
    isWSConnected,
    getWSStatus,
    testWSConnection,
    sendWSMessage,
    onWSEvent,
    isConnectedToServer
} from '../../core/websocket.js';
import {
    installPack,
    uninstallPack,
    getInstalledPacks,
    getPack,
    getDocuments,
    initPackManager
} from '../../core/pack-manager.js';
import {
    getThemes,
    getTheme,
    setTheme as applyTheme,
    getCurrentPreference,
    getResolvedThemeId
} from '../../core/theme-manager.js';
import { getMyStoredRole, isGmLikeRole } from '../../core/feature-toggles.js';
import {
    loadAdventureManifest,
    loadAdventureFromFile
} from '../adventure-manager/index.js';

let container = null;
let themeChangeListenerAttached = false;

// ============================================================
// ADVENTURE MODULE LIBRARY (Settings/Admin one-click install)
// ============================================================
//
// browseAdventureLibrary() (adventure-manager/index.js) already lists
// and installs from the local /data/adventures/ folder, but only from
// inside the Adventures panel itself, as a modal takeover -- there was
// no admin-facing entry point, and no lightweight metadata preview
// (title/tier/author/description) without either opening that modal or
// hand-placing a .json file. This section reuses the same underlying
// pieces (loadAdventureManifest(), loadAdventureFromFile()) from
// Settings, with a read-only metadata fetch for the card list so
// browsing doesn't itself install anything -- only clicking "Install"
// does.
//
// Must match adventure-manager/index.js's own ADVENTURES_DATA_PATH --
// not exported from there, so kept in sync here manually.
const ADVENTURE_LIBRARY_PATH = '/data/adventures/';

let adventureLibraryEntries = null; // null = not yet loaded this session
let adventureLibraryLoading = false;
let adventureLibraryError = null;

function isGMForLibrary() {
    if (!isConnectedToServer()) return true; // solo/local -- allow all
    return isGmLikeRole(getMyStoredRole());
}

// Read-only metadata fetch -- does NOT call loadAdventureFromFile(), so
// merely opening/refreshing this panel never installs anything.
async function fetchAdventurePreview(id) {
    const candidates = [`${ADVENTURE_LIBRARY_PATH}${id}.json`, `.${ADVENTURE_LIBRARY_PATH}${id}.json`];
    for (const url of candidates) {
        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const data = await response.json();
            return {
                id,
                title: data.title || id,
                tier: data.tierRange || data.tier || '',
                author: data.author || '',
                description: data.description || data.notes || '',
                sessions: data.sessions || ''
            };
        } catch (e) { /* try next candidate */ }
    }
    return { id, title: id, tier: '', author: '', description: '(Could not load metadata)', sessions: '' };
}

async function loadAdventureLibrary() {
    adventureLibraryLoading = true;
    adventureLibraryError = null;
    render(container);
    try {
        const ids = await loadAdventureManifest();
        if (ids === null) {
            adventureLibraryError = `Couldn't reach manifest.json under ${ADVENTURE_LIBRARY_PATH}.`;
            adventureLibraryEntries = [];
        } else {
            adventureLibraryEntries = await Promise.all(ids.map(fetchAdventurePreview));
        }
    } catch (e) {
        adventureLibraryError = e.message || String(e);
        adventureLibraryEntries = [];
    } finally {
        adventureLibraryLoading = false;
        render(container);
    }
}

async function handleAdventureInstall(id, btn) {
    if (!isGMForLibrary()) {
        showToast('Only the GM can install adventure modules.', 'error');
        return;
    }
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Installing…'; }
    try {
        const installed = await loadAdventureFromFile(id);
        if (installed) {
            showToast(`📚 Installed "${installed.title}" into your adventure library.`, 'success');
        } else {
            showToast(`Failed to install "${id}" — check the console for details.`, 'error');
        }
    } catch (e) {
        showToast(`Failed to install "${id}": ${e.message || e}`, 'error');
    }
    render(container);
}

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
║  Fate's Edge is © Nicholas A. Gasper. Used with permission, All rights reserved.   ║
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
║  For permissions regarding Copyright, contact:    ║
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

📜 Fate's Edge is © Nicholas A. Gasper. Used with permission, All rights reserved.

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
// DEFAULT CONFIGURATION
// ============================================================

// Overridable at BUILD time via Vite env vars (VITE_WS_URL / VITE_WS_ROOM /
// VITE_SERVER_URL) -- e.g. docker-compose.full.yml's demo build bakes in
// ws://localhost:<port> + room DEMO here so a locally-built demo image talks
// to its own local server out of the box, instead of everyone's first run
// silently connecting to the hosted production server. Falls back to the
// hosted production server/room for the normal (non-demo) build, unchanged
// from before. Still fully user-overridable afterward in Settings -- these
// are just the pre-Settings defaults.
const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || 'wss://fates-edge-socket-server.onrender.com';
const DEFAULT_WS_ROOM = import.meta.env.VITE_WS_ROOM || 'AC12'; // matches fates-edge-ai-gm-bot's own ROOM default (ai-gm-bot.js) -- 'vtt-room' was a made-up placeholder no bot ever actually defaulted to joining
const DEFAULT_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://fates-edge-socket-server.onrender.com';

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    const state = getAppState();
    const archives = getArchives();
    const settings = state.settings || {};
    
    const serverUrl = localStorage.getItem('fates-edge-server-url') || DEFAULT_SERVER_URL;
    const userEmail = localStorage.getItem('fates-edge-user-email') || '';
    const userName = localStorage.getItem('fates-edge-client-name') || '';
    const showAvatars = localStorage.getItem('fates-edge-show-avatars') !== 'false';
    const useGravatars = localStorage.getItem('fates-edge-use-gravatars') !== 'false';
    const accountUsername = localStorage.getItem('fates-edge-auth-username') || '';
    
    const wsConnected = isWSConnected ? isWSConnected() : false;
    const wsStatus = getWSStatus ? getWSStatus() : 'disconnected';
    
    const installedPacks = getInstalledPacks();
    const packDocuments = getDocuments();
    const installedAdventureIds = new Set((state.adventures || []).map(a => a.id));

    container.innerHTML = `
        <div class="settings-layout">
            <style>
                /* ─── Settings Panel Header Fix ───────────────────────────── */
                .settings-header {
                    background: var(--bg2);
                    padding: 1rem 1.2rem;
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                    margin-bottom: 1rem;
                }
                .settings-header .page-title {
                    margin: 0;
                    color: var(--gold);
                }
                .settings-header .page-sub {
                    margin: 0.1rem 0 0;
                    color: var(--text3);
                    font-size: 0.9rem;
                }
                /* ─── Tours panel ─────────────────────────────────────────── */
                .settings-tours .flex {
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                /* ─── Stats bar ───────────────────────────────────────────── */
                .settings-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }
                .stat-item {
                    background: var(--bg2);
                    padding: 0.5rem 0.8rem;
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                    text-align: center;
                }
                .stat-label {
                    font-size: 0.65rem;
                    color: var(--text3);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    display: block;
                }
                .stat-value {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--text);
                }
                .stat-value.enabled { color: var(--green); }
                .stat-value.disabled { color: var(--text3); }
                /* ─── Sync status ──────────────────────────────────────────── */
                .sync-status {
                    padding: 0.3rem 0.6rem;
                    border-radius: var(--radius);
                    margin-top: 0.5rem;
                    font-size: 0.9rem;
                }
                .sync-status.connected {
                    background: rgba(76, 175, 80, 0.12);
                    color: var(--green);
                    border: 1px solid var(--green);
                }
                .sync-status.disconnected {
                    background: rgba(244, 67, 54, 0.08);
                    color: var(--red);
                    border: 1px solid var(--red);
                }
                .sync-status.connecting {
                    background: rgba(255, 193, 7, 0.12);
                    color: var(--gold);
                    border: 1px solid var(--gold);
                }
                .sync-status.error {
                    background: rgba(244, 67, 54, 0.12);
                    color: var(--red);
                    border: 1px solid var(--red);
                }
                .status-badge {
                    display: inline-block;
                    padding: 0.1rem 0.6rem;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                .status-badge.connected {
                    background: rgba(76, 175, 80, 0.15);
                    color: var(--green);
                }
                .status-badge.disconnected {
                    background: rgba(244, 67, 54, 0.1);
                    color: var(--red);
                }
                /* ─── Avatar preview ───────────────────────────────────────── */
                .avatar-preview-container {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    padding: 0.3rem 0.6rem;
                    background: var(--bg3);
                    border-radius: var(--radius);
                    margin: 0.3rem 0;
                }
                .avatar-preview-container img {
                    border-radius: 50%;
                    border: 2px solid var(--border);
                    width: 48px;
                    height: 48px;
                    object-fit: cover;
                }
                .avatar-name {
                    font-weight: 600;
                    color: var(--text);
                }
                .avatar-email {
                    font-size: 0.8rem;
                    color: var(--text3);
                }
                /* ─── Presence list ────────────────────────────────────────── */
                .presence-list {
                    max-height: 120px;
                    overflow-y: auto;
                    padding: 0.2rem 0.4rem;
                    background: var(--bg3);
                    border-radius: var(--radius);
                }
                .presence-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.2rem 0.3rem;
                    border-bottom: 1px solid var(--border);
                }
                .presence-item:last-child { border-bottom: none; }
                .presence-item .avatar {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    object-fit: cover;
                }
                .presence-item .name { flex: 1; font-weight: 500; font-size: 0.85rem; }
                .presence-item .role { font-size: 0.65rem; color: var(--text3); }
                .presence-item .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    display: inline-block;
                }
                .presence-item .status-dot.online { background: var(--green); }
                .presence-item .status-dot.away { background: var(--gold); }
                /* ─── Password status ──────────────────────────────────────── */
                .password-status-badge {
                    font-size: 0.7rem;
                    padding: 0.1rem 0.6rem;
                    border-radius: 12px;
                    font-weight: 600;
                }
                .password-status-badge.enabled {
                    background: rgba(76, 175, 80, 0.15);
                    color: var(--green);
                }
                .password-status-badge.disabled {
                    background: rgba(244, 67, 54, 0.1);
                    color: var(--text3);
                }
                .password-settings-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 0.5rem;
                    margin-bottom: 0.5rem;
                }
                @media (max-width: 700px) {
                    .password-settings-row {
                        grid-template-columns: 1fr;
                    }
                }
                /* ─── Session archives ────────────────────────────────────── */
                .session-archive-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.3rem 0.5rem;
                    border-bottom: 1px solid var(--border);
                }
                .session-archive-item:last-child { border-bottom: none; }
                .session-archive-item .name { font-weight: 500; }
                .session-archive-item .meta { font-size: 0.7rem; color: var(--text3); }
                /* ─── Pack list ───────────────────────────────────────────── */
                .pack-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.3rem 0.5rem;
                    border-bottom: 1px solid var(--border);
                }
                .pack-item:last-child { border-bottom: none; }
                .pack-item .pack-name { font-weight: 500; }
                .pack-item .pack-version { font-size: 0.65rem; color: var(--text2); background: var(--bg3); padding: 0.05rem 0.4rem; border-radius: 8px; }
                .pack-item .pack-type { font-size: 0.6rem; color: var(--text3); text-transform: uppercase; }
                .pack-item .pack-meta { font-size: 0.7rem; color: var(--text3); }
                .pack-document-item {
                    display: inline-block;
                    padding: 0.1rem 0.5rem;
                    margin: 0.1rem;
                    background: var(--bg3);
                    border-radius: 12px;
                    font-size: 0.75rem;
                }
                .pack-document-item .doc-title { color: var(--text); }
                .pack-document-item .doc-category { color: var(--text3); margin-left: 0.3rem; font-size: 0.65rem; }
                .campaign-feedback {
                    padding: 0.3rem 0.6rem;
                    border-radius: var(--radius);
                    font-size: 0.85rem;
                    min-height: 1.5rem;
                }
                .campaign-feedback.success { color: var(--green); background: rgba(76,175,80,0.08); border: 1px solid var(--green); }
                .campaign-feedback.error { color: var(--red); background: rgba(244,67,54,0.08); border: 1px solid var(--red); }
                .license-box {
                    background: var(--bg3);
                    padding: 0.8rem 1rem;
                    border-radius: var(--radius);
                    font-size: 0.8rem;
                    color: var(--text2);
                    border: 1px solid var(--border);
                }
                .license-box p { margin: 0.3rem 0; }
                .bundled-packs-hint {
                    background: var(--bg3);
                    padding: 0.7rem 0.9rem;
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                    border-left: 3px solid var(--gold);
                }
                .bundled-packs-hint code {
                    background: var(--bg4);
                    padding: 0.05rem 0.3rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    color: var(--text2);
                    word-break: break-all;
                }
                .theme-btn.active { border-color: var(--gold); background: var(--bg4); }
                .theme-status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.3rem 0.6rem;
                    border-radius: var(--radius);
                    background: var(--bg3);
                    border: 1px solid var(--border);
                    font-size: 0.85rem;
                }
                .theme-status-badge .dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--green);
                    display: inline-block;
                }
                .theme-status-badge .source-tag {
                    font-size: 0.65rem;
                    color: var(--text3);
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    background: var(--bg4);
                    padding: 0.05rem 0.4rem;
                    border-radius: 8px;
                    margin-left: 0.2rem;
                }
            </style>

            <header class="settings-header">
                <h1 class="page-title">⚙️ Settings</h1>
                <p class="page-sub">Manage your data, backups, and preferences.</p>
            </header>

            <!-- ============================================================
                 QUICK STATS BAR
                 ============================================================ -->
            <div class="settings-stats">
                <div class="stat-item"><span class="stat-label">💾 Storage</span><span class="stat-value">Local</span></div>
                <div class="stat-item"><span class="stat-label">📦 Archives</span><span class="stat-value">${archives.length}</span></div>
                <div class="stat-item"><span class="stat-label">📚 Packs</span><span class="stat-value">${installedPacks.length}</span></div>
                <div class="stat-item"><span class="stat-label">🔐 Password</span><span class="stat-value ${state.passwordHash ? 'enabled' : 'disabled'}">${state.passwordHash ? '✅ Set' : '❌ Not set'}</span></div>
            </div>
            
            <!-- ============================================================
                 PACK MANAGEMENT
                 ============================================================ -->
            <div class="panel settings-panel" id="pack-management-panel">
                <div class="panel-header">
                    <h3>📦 Pack Management</h3>
                    <span class="badge pack-count">${installedPacks.length} installed</span>
                </div>
                <p class="text-muted small">Install custom packs to extend the toolkit with new modules, documents, and data.</p>

                <div class="bundled-packs-hint mt-1">
                    <strong style="color:var(--gold);">📚 Bundled theme packs</strong>
                    <p class="text-sm" style="margin:0.3rem 0;">Two ready-to-install theme packs ship in the <strong>docs repo</strong> (fates-edge-docs), not this one — each bundles a full reskin (colors, borders, glow/vignette treatment) plus a matching faction, region, and quick-reference doc:</p>
                    <ul class="text-sm" style="margin:0.2rem 0 0.3rem 1.2rem;">
                        <li><strong>🌆 Modern Noir</strong> — <code>ttrpg/reference/expansions/modern-noir-module/web-client/modern-noir-module.pack.zip</code></li>
                        <li><strong>🕯️ Horror</strong> — <code>ttrpg/reference/expansions/horror-module/web-client/horror-module.pack.zip</code></li>
                    </ul>
                    <p class="text-xs text-muted" style="margin:0;">Grab the .zip from that repo and install it below. Once installed, the theme shows up in Theme &amp; Appearance further down this page.</p>
                </div>

                <div class="form-row">
                    <div class="field" style="flex:3;">
                        <label>Install Pack</label>
                        <input type="file" id="pack-file-input" accept=".zip" />
                        <div class="field-hint">Select a .zip pack file to install</div>
                    </div>
                </div>
                
                <div class="flex">
                    <button class="btn btn-gold" id="pack-install-btn">📦 Install Pack</button>
                    <button class="btn btn-sm btn-secondary" id="pack-refresh-btn">↻ Refresh</button>
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
                                    ${pack.theme ? `<span class="pack-type" title="This pack registers a theme: ${escHtml(pack.theme.label)}">🎨 theme</span>` : ''}
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
                 ADVENTURE MODULE LIBRARY (one-click install)
                 ============================================================ -->
            <div class="panel settings-panel" id="adventure-library-panel">
                <div class="panel-header">
                    <h3>🗺️ Adventure Module Library</h3>
                    <span class="badge">${installedAdventureIds.size} installed</span>
                </div>
                <p class="text-muted small">Browse adventure modules bundled in the local <code>${ADVENTURE_LIBRARY_PATH}</code> folder and install them into your library in one click — no manual JSON placement or modal needed.</p>

                <div class="flex">
                    <button class="btn btn-gold" id="adventure-library-browse-btn">📚 ${adventureLibraryEntries === null ? 'Browse Library' : 'Refresh List'}</button>
                </div>

                ${adventureLibraryError ? `<div class="mt-1" style="color:var(--red);">⚠️ ${escHtml(adventureLibraryError)}</div>` : ''}

                <div class="mt-1" id="adventure-library-list">
                    ${adventureLibraryLoading ? '<div class="text-muted small">⏳ Loading module list…</div>' : ''}
                    ${!adventureLibraryLoading && adventureLibraryEntries === null ? '<div class="text-muted small">Click "Browse Library" to see available modules.</div>' : ''}
                    ${!adventureLibraryLoading && adventureLibraryEntries !== null && adventureLibraryEntries.length === 0 && !adventureLibraryError ? '<div class="text-muted small">No modules found.</div>' : ''}
                    ${!adventureLibraryLoading && adventureLibraryEntries ? adventureLibraryEntries.map(entry => {
                        const already = installedAdventureIds.has(entry.id);
                        return `
                            <div class="pack-item" style="align-items:flex-start;">
                                <div class="pack-info" style="flex:1;">
                                    <span class="pack-name">${escHtml(entry.title)}</span>
                                    ${entry.tier ? `<span class="pack-type">Tier ${escHtml(entry.tier)}</span>` : ''}
                                    ${entry.sessions ? `<span class="pack-type">${escHtml(entry.sessions)} sessions</span>` : ''}
                                    <div class="pack-meta">${entry.author ? `by ${escHtml(entry.author)}` : ''}</div>
                                    <div class="text-sm text-muted" style="margin-top:0.2rem;max-width:520px;">${escHtml(entry.description)}</div>
                                </div>
                                <div class="flex" style="flex-shrink:0;">
                                    <button class="btn btn-xs ${already ? 'btn-secondary' : 'btn-gold'} adventure-install-btn" data-id="${escHtml(entry.id)}" ${already ? 'disabled' : ''}>
                                        ${already ? '✅ Installed' : '⬇️ Install'}
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('') : ''}
                </div>
            </div>

            <!-- ============================================================
                 WEBSOCKET SETTINGS
                 ============================================================ -->
            <div class="panel settings-panel">
                <div class="panel-header">
                    <h3>🔗 WebSocket Connection</h3>
                    <span class="badge ${wsConnected ? 'connected' : 'disconnected'}">${wsConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
                </div>
                <p class="text-muted small">Configure the WebSocket server for real-time VTT features. Default: <strong>${DEFAULT_WS_URL}</strong></p>
                
                <div class="form-row">
                    <div class="field" style="flex:3;">
                        <label>WebSocket Server URL</label>
                        <input type="text" id="settings-ws-url" 
                               value="${escHtml(settings.wsUrl || DEFAULT_WS_URL)}" 
                               placeholder="${DEFAULT_WS_URL}" />
                        <div class="field-hint">The WebSocket server URL for VTT synchronization</div>
                    </div>
                    <div class="field" style="flex:1;">
                        <label>Room Name</label>
                        <input type="text" id="settings-ws-room" 
                               value="${escHtml(settings.wsRoom || DEFAULT_WS_ROOM)}" 
                               placeholder="${DEFAULT_WS_ROOM}" />
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
                        <!-- NEW: real local-only mode. Unchecking this is the
                             same "no connection attempts, no reconnect loop"
                             toggle as the "Work fully offline" button on the
                             VTT local view (core/websocket.js's
                             isLocalOnlyMode()/setLocalOnlyMode()) -- spelled
                             out here since "Enable WebSocket" alone doesn't
                             make that clear from Settings. -->
                        <div class="field-hint">Unchecking this fully disables auto-connect and background reconnect attempts &mdash; use it to work offline with no connection noise.</div>
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
                    <button class="btn btn-sm btn-secondary" id="settings-ws-test">🔍 Test Connection</button>
                    <button class="btn btn-sm btn-gold" id="settings-ws-connect">🔗 Connect</button>
                    <button class="btn btn-sm btn-secondary" id="settings-ws-disconnect">🔌 Disconnect</button>
                    <span id="settings-ws-status" class="status-badge ${wsConnected ? 'connected' : 'disconnected'}">
                        ${wsConnected ? '🟢 Connected' : '🔴 Disconnected'}
                    </span>
                </div>
                
                <div id="settings-ws-result" class="mt-1" style="display:none;"></div>
            </div>
            
            <!-- ============================================================
                 ACCOUNT (optional)
                 ============================================================ -->
            <div class="panel settings-panel" id="account-panel">
                <div class="panel-header">
                    <h3>🔐 Account <span class="text-muted small">(optional)</span></h3>
                    <span id="account-status-badge" class="badge ${accountUsername ? '' : 'disconnected'}">${accountUsername ? `✅ ${escHtml(accountUsername)}` : '🔴 Not logged in'}</span>
                </div>
                <p class="text-muted small">
                    Completely optional. Without an account, joining a campaign works exactly as before --
                    you'll just need the room password every time. With an account, a GM can let you back into
                    a password-protected room without re-entering it, and bans against your account stick even
                    across reconnects. Accounts require the server you're connecting to have database storage
                    configured -- ask your GM/host if registration fails.
                </p>
                ${accountUsername ? `
                <div class="flex">
                    <button class="btn btn-sm btn-danger" id="account-logout-btn">🚪 Log Out (${escHtml(accountUsername)})</button>
                </div>
                ` : `
                <div class="form-row">
                    <div class="field">
                        <label>Username</label>
                        <input type="text" id="account-username" placeholder="3-32 chars, letters/numbers/_/-" />
                    </div>
                    <div class="field">
                        <label>Password</label>
                        <input type="password" id="account-password" placeholder="8+ characters" />
                    </div>
                </div>
                <div class="flex">
                    <button class="btn btn-sm btn-gold" id="account-login-btn">🔑 Log In</button>
                    <button class="btn btn-sm btn-secondary" id="account-register-btn">✨ Register</button>
                </div>
                <div id="account-result" class="mt-1" style="display:none;"></div>
                `}
            </div>

            <!-- ============================================================
                 LIVE CAMPAIGN (Sync)
                 ============================================================ -->
            <div class="panel settings-panel" id="sync-panel">
                <div class="panel-header">
                    <h3>🌐 Live Campaign</h3>
                    <span id="sync-status-badge" class="badge disconnected">🔴 Disconnected</span>
                </div>
                <p class="text-muted small">Connect to a campaign server for real-time collaboration with your group. Default: <strong>${DEFAULT_SERVER_URL}</strong></p>
                
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
                        <button class="btn btn-sm btn-primary" id="sync-save-profile-btn">💾 Save Profile</button>
                    </div>
                </div>

                <div class="field" style="flex:0 0 120px;">
                    <label>Role</label>
                    <select id="sync-user-role" style="height: 38px;">
                        <option value="player" ${localStorage.getItem('fates-edge-client-role') === 'player' ? 'selected' : ''}>👤 Player</option>
                        <option value="gm" ${localStorage.getItem('fates-edge-client-role') === 'gm' ? 'selected' : ''}>🎯 GM</option>
                        <option value="spectator" ${localStorage.getItem('fates-edge-client-role') === 'spectator' ? 'selected' : ''}>👁️ Spectator</option>
                    </select>
                    <p class="text-muted small" style="font-size:0.7rem;margin:0.2rem 0 0;">Co-GM isn't self-selectable here — it's granted by the room's GM after you join.</p>
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
                <div class="flex mt-1" style="margin-bottom:0.6rem;padding:0.3rem 0.6rem;background:var(--bg3);border-radius:var(--radius);flex-wrap:wrap;">
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
                        <input type="text" id="sync-server-url" placeholder="${DEFAULT_SERVER_URL}" value="${escHtml(serverUrl)}" />
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
                
                <div class="flex">
                    <button class="btn btn-gold" id="sync-connect-btn">🔗 Connect</button>
                    <button class="btn btn-danger" id="sync-disconnect-btn" style="display:none;">⛔ Disconnect</button>
                    <button class="btn btn-sm btn-secondary" id="sync-refresh-btn">↻ Refresh</button>
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
                <div class="panel-header">
                    <h3>📦 Campaign Sharing (HTTP)</h3>
                </div>
                <p class="text-muted small">Upload your current toolkit state to a campaign server, then share the generated code with your group. They can load it with the same code. Default: <strong>${DEFAULT_SERVER_URL}</strong></p>
                <div class="form-row">
                    <div class="field large"><label>Server URL</label><input type="text" id="campaign-server-url" placeholder="${DEFAULT_SERVER_URL}" value="${escHtml(serverUrl)}" /></div>
                    <div class="field" style="flex:0 0 120px;"><label>Campaign Code</label><input type="text" id="campaign-code" placeholder="AC12" maxlength="6" style="text-transform:uppercase;" /></div>
                </div>
                <div class="flex">
                    <button class="btn btn-gold" id="campaign-upload-btn">⬆ Upload Current State</button>
                    <button class="btn btn-primary" id="campaign-load-btn">⬇ Load State</button>
                    <button class="btn btn-danger" id="campaign-delete-btn">🗑️ Delete Campaign</button>
                </div>
                <div id="campaign-feedback" class="campaign-feedback mt-1"></div>
            </div>
            
            <!-- ============================================================
                 PREFERENCES – TOURS & ONBOARDING (NEW)
                 ============================================================ -->
            <div class="panel settings-panel settings-tours">
                <div class="panel-header">
                    <h3>🎭 Tours & Onboarding</h3>
                </div>
                <p class="text-muted small">Re‑open the introductory tours if you dismissed them earlier.</p>
                <div class="flex">
                    <button class="btn btn-sm btn-secondary" id="settings-show-welcome-tour">📜 Show Welcome Tour</button>
                    <button class="btn btn-sm btn-secondary" id="settings-show-magic-tour">🧙 Show Magic Paths Tour</button>
                </div>
                <div class="text-muted small mt-1" style="font-size:0.7rem;">
                    The Welcome Tour appears on the Home tab. The Magic Paths Tour appears in the Spellcraft tab.
                </div>
            </div>
            
            <!-- ============================================================
                 PASSWORD PROTECTION
                 ============================================================ -->
            <div class="panel settings-panel" id="password-settings-panel">
                <div class="panel-header">
                    <h3>🔐 Password Protection</h3>
                    <span id="passwordStatusBadge" class="password-status-badge ${state.passwordHash ? 'enabled' : 'disabled'}">
                        ${state.passwordHash ? '🔒 Enabled' : '🔓 Disabled'}
                    </span>
                </div>
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
                <div class="panel-header">
                    <h3>🌐 Document Base URL</h3>
                </div>
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
                <div class="panel-header">
                    <h3>📦 Session Archives</h3>
                    <span class="badge">${archives.length} archives</span>
                </div>
                <div id="session-archives"></div>
                <button class="btn btn-sm btn-primary mt-1" id="settings-new-session">📦 New Session (archive current)</button>
            </div>
            
            <!-- ============================================================
                 THEME & APPEARANCE
                 CHANGED: the built-in dark/light/auto buttons used to be the
                 only three that could ever exist here — now the row is
                 rendered from theme-manager's registry, so any theme a pack
                 registers (see core/theme-manager.js's doc comment, and a
                 pack's optional pack.json theme block) shows up right
                 alongside them the moment that pack is installed, no code
                 change needed here. "Auto" is still handled as a meta-option
                 (not a registered theme) exactly as before.
                 ============================================================ -->
            <div class="panel settings-panel">
                <div class="panel-header">
                    <h3>🎨 Theme & Appearance</h3>
                    <span class="badge" id="theme-count-badge">${getThemes().length} installed</span>
                </div>
                <p class="text-muted small">Pick from any built-in theme, or a theme registered by an installed pack (see Pack Management above). "Auto" follows your system's light/dark preference.</p>
                <div class="flex" style="gap:0.5rem;flex-wrap:wrap;" id="theme-picker">
                    ${renderThemeButtons()}
                </div>
                <div id="theme-status-line" class="mt-1">
                    ${renderThemeStatusLine()}
                </div>
            </div>
            
            <!-- ============================================================
                 LICENSE & COPYRIGHT
                 ============================================================ -->
            <div class="panel settings-panel">
                <div class="panel-header">
                    <h3>📜 License & Copyright</h3>
                </div>
                <div class="license-box">
                    <p><strong>Fate's Edge</strong> is © Nicholas A. Gasper. <strong>Used with permission, All rights reserved.</strong></p>
                    <p>The <strong>SRD</strong> and <strong>Essentials</strong> guide are licensed under CC BY-NC-SA 4.0.</p>
                    <p>All other content — setting lore, original characters, proprietary magic systems, artwork, etc. — is <strong>All Rights Reserved</strong>.</p>
                    <p><strong>Code:</strong> MIT License</p>
                    <div class="flex" style="gap:0.5rem;margin-top:0.5rem;">
                        <button class="btn btn-sm btn-secondary" id="settings-license-btn">📜 Full License</button>
                        <button class="btn btn-sm btn-secondary" id="settings-license-summary-btn">📋 Summary</button>
                    </div>
                </div>
            </div>
            
            <!-- ============================================================
                 ABOUT (UPDATED)
                 ============================================================ -->
            <div class="panel settings-panel">
                <div class="panel-header">
                    <h3>ℹ️ About Fate's Edge</h3>
                </div>
                <div style="display:flex; gap:1rem; align-items:flex-start; margin-bottom:1rem;">
                    <span style="font-size:2.5rem;">🐉</span>
                    <div>
                        <p style="margin:0 0 0.5rem; color:var(--text);">
                            <strong>Fate's Edge</strong> is an open-source, narrative-first Virtual Tabletop. 
                            It runs entirely in your browser; all data stays local.
                        </p>
                        <p style="margin:0; color:var(--text2); font-size:0.9rem;">
                            <strong>Toolkit v4.0</strong> — Modular Edition · WebSocket & Voice Support
                        </p>
                    </div>
                </div>
                <hr style="border-color:var(--border); margin:1rem 0;" />
                <div>
                    <h4 style="margin:0 0 0.5rem; color:var(--gold);">
                        🛠️ Creator: Nicholas A. Gasper 
                        <span style="font-weight:400; color:var(--text2);">(Chronophage)</span>
                    </h4>
                    <p style="margin:0 0 0.5rem; color:var(--text); font-size:0.95rem;">
                        I've been rolling dice since I was twelve — over three decades of tabletop stories.
                        I live in the Twin Cities, Minnesota, and I'm a friendly, if slightly shy, 
                        sysadmin/DevOps consultant with 20+ years in FreeBSD / Linux.
                    </p>
                    <p style="margin:0 0 0.8rem; color:var(--text); font-size:0.95rem;">
                        I designed <em>Fate's Edge</em> and built this Virtual Tabletop as my first large 
                        software project — an open‑source companion that puts the narrative first.
                    </p>
                    <blockquote style="margin:0.8rem 0; padding:0.8rem 1rem; background:rgba(201,168,76,0.05); border-left:3px solid var(--gold); border-radius:4px; font-style:italic; color:var(--text2); font-size:0.9rem;">
                        <p style="margin:0;">
                            “Keep It Stupid — minimal but not fragile. Work from user needs, 
                            set a feature limit, build in layers. I'm not a developer by trade, 
                            but that pattern has served me for decades.”
                        </p>
                    </blockquote>
                    <p style="margin:0.5rem 0 0; color:var(--text3); font-size:0.85rem;">
                        ☕ Fueled by coffee · 🧠 Neurodivergent & proud · 🌱 Community grows from within and without
                    </p>
                </div>
            </div>
            <!-- END ABOUT SECTION -->
        </div>
    `;
    
    renderSessionArchives();
    attachEvents();
      
    setTimeout(initSyncUI, 100);
    
    try {
        initPackManager();
    } catch (e) {
        // Pack manager may not be available
    }
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
    try {
        uninstallPack(packId);
        setTimeout(() => render(container), 500);
        showToast('Pack uninstalled', 'success');
    } catch (e) {
        showToast('Uninstall failed: ' + e.message, 'error');
    }
}

function refreshPackList() {
    render(container);
    showToast('Pack list refreshed', 'info');
}

// ============================================================
// SYNC UI INITIALIZATION
// ============================================================

function initSyncUI() {
    function updateSyncStatus(status) {
        const statusEl = document.getElementById('sync-status');
        const badgeEl = document.getElementById('sync-status-badge');
        const connectBtn = document.getElementById('sync-connect-btn');
        const disconnectBtn = document.getElementById('sync-disconnect-btn');
        const presenceList = document.getElementById('presence-list');
        const showAvatars = document.getElementById('sync-show-avatars')?.checked !== false;
        
        if (!statusEl || !connectBtn || !disconnectBtn) return;
        
        if (status && status.isConnected) {
            statusEl.innerHTML = `🟢 Connected to ${status.campaignCode || 'campaign'}`;
            statusEl.className = 'sync-status connected';
            if (badgeEl) {
                badgeEl.textContent = `🟢 Connected`;
                badgeEl.className = 'badge connected';
            }
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-block';
            
            if (presenceList) {
                const clients = status.clients || [];
                if (clients.length > 0) {
                    presenceList.innerHTML = clients
                        .filter(client => client.id !== status.clientId)
                        .map(client => {
                            const avatarUrl = showAvatars 
                                ? getUserAvatar(client.email || '', client.name || 'User', 32)
                                : '';
                            return `
                                <div class="presence-item">
                                    ${showAvatars ? `<img src="${escHtml(avatarUrl)}" alt="${escHtml(client.name) || 'User'}" class="avatar" loading="lazy" />` : ''}
                                    <span class="name">${escHtml(client.name || 'Anonymous')}</span>
                                    <span class="role">${client.role === 'gm' ? '🎯 GM' : '👤 Player'}</span>
                                    <span class="status-dot ${client.status === 'online' ? 'online' : 'away'}"></span>
                                </div>
                            `;
                        }).join('') || '<div style="color:var(--text2);padding:0.3rem 0;">Only you are connected</div>';
                } else {
                    presenceList.innerHTML = '<div style="color:var(--text2);padding:0.3rem 0;">No other users online</div>';
                }
            }
        } else {
            statusEl.innerHTML = '🔴 Disconnected';
            statusEl.className = 'sync-status disconnected';
            if (badgeEl) {
                badgeEl.textContent = '🔴 Disconnected';
                badgeEl.className = 'badge disconnected';
            }
            connectBtn.style.display = 'inline-block';
            disconnectBtn.style.display = 'none';
            
            if (presenceList) {
                presenceList.innerHTML = '<div style="color:var(--text2);padding:0.3rem 0;">Not connected</div>';
            }
        }
    }
    
    import('../../core/sync/index.js')
        .then(module => {
            const { syncManager } = module;
            window.__syncManager = syncManager;
            
            try {
                const status = syncManager.getStatus ? syncManager.getStatus() : { isConnected: false };
                updateSyncStatus(status);
            } catch (e) {
                console.warn('Sync getStatus not available:', e);
                updateSyncStatus({ isConnected: false });
            }
            
            if (syncManager.on) {
                syncManager.on('connection_change', updateSyncStatus);
                syncManager.on('presence_update', updateSyncStatus);
            }
            
            console.log('✅ Sync module loaded successfully');
        })
        .catch(e => {
            console.warn('⚠️ Sync module not available:', e.message);
            const statusEl = document.getElementById('sync-status');
            const badgeEl = document.getElementById('sync-status-badge');
            if (statusEl) {
                statusEl.innerHTML = '⚠️ Sync module unavailable';
                statusEl.className = 'sync-status error';
            }
            if (badgeEl) {
                badgeEl.textContent = '⚠️ Unavailable';
                badgeEl.className = 'badge error';
            }
        });
}

// ============================================================
// ACCOUNT (optional login/register)
// ============================================================
// Layers on top of the existing anonymous room-code+password flow --
// see js/core/sync/index.js's sendHandshake() and js/core/websocket.js's
// joinRoom(), both of which now send whatever token is stored under
// 'fates-edge-auth-token'. A client that never uses this panel keeps
// joining exactly as it always has.

/** Turn whatever's in the Server URL field (ws://, wss://, bare host, or
 *  already http(s)://) into an http(s) base for plain REST fetch()
 *  calls to the same server's /api/auth/* routes. Mirrors the inverse
 *  logic of SyncManager.buildWebSocketUrl(). */
function deriveHttpBase(serverUrl) {
    let base = (serverUrl || '').trim();
    if (!base) return '';
    if (base.startsWith('ws://')) base = 'http://' + base.slice(5);
    else if (base.startsWith('wss://')) base = 'https://' + base.slice(6);
    else if (!base.startsWith('http://') && !base.startsWith('https://')) {
        const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
        base = (isSecure ? 'https://' : 'http://') + base;
    }
    return base.replace(/\/+$/, '');
}

async function submitAccountAuth(mode) {
    const serverUrl = document.getElementById('sync-server-url')?.value.trim() || DEFAULT_SERVER_URL;
    const username = document.getElementById('account-username')?.value.trim();
    const password = document.getElementById('account-password')?.value;
    const resultEl = document.getElementById('account-result');

    if (!username || !password) {
        showToast('Enter a username and password', 'error');
        return;
    }

    const httpBase = deriveHttpBase(serverUrl);
    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';

    try {
        const res = await fetch(`${httpBase}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const message = data?.error || `Request failed (${res.status})`;
            if (resultEl) {
                resultEl.style.display = 'block';
                resultEl.innerHTML = `<span style="color:var(--red);">❌ ${escHtml(message)}</span>`;
            }
            showToast(message, 'error');
            return;
        }

        localStorage.setItem('fates-edge-auth-token', data.token);
        localStorage.setItem('fates-edge-auth-username', data.user?.username || username);

        // Keep any already-connected sync session's token current too --
        // it only re-reads localStorage at connect() time otherwise.
        try {
            const { syncManager } = await import('../../core/sync/index.js');
            syncManager.authToken = data.token;
        } catch (e) { /* sync module not loaded yet -- fine, connect() will pick it up */ }

        showToast(mode === 'register' ? 'Account created and logged in!' : 'Logged in!', 'success');
        render(container); // re-render to swap the form for the logged-in state
    } catch (e) {
        const message = `Could not reach ${httpBase}: ${e.message}`;
        if (resultEl) {
            resultEl.style.display = 'block';
            resultEl.innerHTML = `<span style="color:var(--red);">❌ ${escHtml(message)}</span>`;
        }
        showToast(message, 'error');
    }
}

function loginAccount() { submitAccountAuth('login'); }
function registerAccount() { submitAccountAuth('register'); }

async function logoutAccount() {
    localStorage.removeItem('fates-edge-auth-token');
    localStorage.removeItem('fates-edge-auth-username');
    try {
        const { syncManager } = await import('../../core/sync/index.js');
        syncManager.authToken = '';
    } catch (e) { /* fine */ }
    showToast('Logged out', 'info');
    render(container);
}

// ============================================================
// CONNECT TO SYNC SERVER
// ============================================================

async function connectToSyncServer() {
    const serverUrl = document.getElementById('sync-server-url')?.value.trim() || DEFAULT_SERVER_URL;
    const campaignCode = document.getElementById('sync-campaign-code')?.value.trim().toUpperCase();
    const password = document.getElementById('sync-password')?.value.trim();
    const userName = document.getElementById('sync-user-name')?.value.trim() || 'Player';
    const userEmail = document.getElementById('sync-user-email')?.value.trim() || '';
    const userRole = document.getElementById('sync-user-role')?.value || 'player';

    if (!serverUrl || !campaignCode) {
        showToast('Please enter server URL and campaign code', 'error');
        return;
    }

    const statusEl = document.getElementById('sync-status');
    if (statusEl) {
        statusEl.innerHTML = '🔄 Connecting...';
        statusEl.className = 'sync-status connecting';
    }

    try {
        const { syncManager } = await import('../../core/sync/index.js');

        syncManager.lastPassword = password;
        localStorage.setItem('fates-edge-client-role', userRole);

        await syncManager.connect(serverUrl, campaignCode, password, {
            name: userName,
            email: userEmail,
            role: userRole,
            // Explicit (rather than relying on SyncManager's constructor-
            // time read) so logging in/out AFTER the manager already
            // exists takes effect on the next connect without a reload.
            authToken: localStorage.getItem('fates-edge-auth-token') || ''
        });

        showToast('Connected to campaign!', 'success');
    } catch (e) {
        if (statusEl) {
            statusEl.innerHTML = `❌ ${e.message}`;
            statusEl.className = 'sync-status disconnected';
        }
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
    }).catch(() => {});
    
    showToast('Profile saved!', 'success');
}

// ============================================================
// TOGGLE AVATARS
// ============================================================

function toggleAvatars() {
    const showAvatars = document.getElementById('sync-show-avatars').checked;
    localStorage.setItem('fates-edge-show-avatars', String(showAvatars));
    initSyncUI();
}

function toggleGravatars() {
    const useGravatars = document.getElementById('sync-use-gravatars').checked;
    localStorage.setItem('fates-edge-use-gravatars', String(useGravatars));
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
    const wsUrl = document.getElementById('settings-ws-url')?.value || DEFAULT_WS_URL;
    const wsRoom = document.getElementById('settings-ws-room')?.value || DEFAULT_WS_ROOM;
    const wsEnabled = document.getElementById('settings-ws-enabled')?.checked !== false;
    const wsReconnect = document.getElementById('settings-ws-reconnect')?.checked !== false;
    const wsReconnectInterval = parseInt(document.getElementById('settings-ws-interval')?.value || '3000', 10);
    
    return { wsUrl, wsRoom, wsEnabled, wsReconnect, wsReconnectInterval };
}

async function testWSConnectionHandler() {
    const url = document.getElementById('settings-ws-url')?.value || DEFAULT_WS_URL;
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
    
    const state = getAppState();
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
    
    const connected = isWSConnected ? isWSConnected() : false;
    
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
    const state = getAppState();
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

    // Adventure module library
    document.getElementById('adventure-library-browse-btn')?.addEventListener('click', () => {
        loadAdventureLibrary();
    });
    document.querySelectorAll('.adventure-install-btn').forEach(btn => {
        btn.addEventListener('click', () => handleAdventureInstall(btn.dataset.id, btn));
    });
    document.getElementById('pack-file-input')?.addEventListener('change', (e) => {
        const feedback = document.getElementById('pack-install-feedback');
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            feedback.innerHTML = `<span class="text-muted">📎 Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>`;
        }
    });
    
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
    document.getElementById('account-login-btn')?.addEventListener('click', loginAccount);
    document.getElementById('account-register-btn')?.addEventListener('click', registerAccount);
    document.getElementById('account-logout-btn')?.addEventListener('click', logoutAccount);

    document.getElementById('sync-connect-btn')?.addEventListener('click', connectToSyncServer);
    document.getElementById('sync-disconnect-btn')?.addEventListener('click', disconnectFromSyncServer);
    document.getElementById('sync-refresh-btn')?.addEventListener('click', () => {
        import('../../core/sync/index.js').then(module => {
            if (module.syncManager && module.syncManager.requestFullSync) {
                module.syncManager.requestFullSync();
                showToast('Refreshing sync...', 'info');
            }
        }).catch(() => {
            showToast('Sync module not available', 'warning');
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
    // Keep the status line accurate even when the theme changes from
    // outside this panel's own buttons — a pack finishing install
    // (registerTheme() re-applies live, see theme-manager.js) or the OS
    // light/dark preference flipping while "Auto" is selected both fire
    // 'theme-changed' without going through setTheme() above. Attached
    // once (not per-render) since this panel's own re-renders replace the
    // DOM nodes but never remove this document-level listener.
    if (!themeChangeListenerAttached) {
        themeChangeListenerAttached = true;
        document.addEventListener('theme-changed', refreshThemeStatus);
    }
    
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
    
    // ─── NEW: Tours & Onboarding ──────────────────────────────────────
    document.getElementById('settings-show-welcome-tour')?.addEventListener('click', () => {
        const state = getAppState();
        if (!state.app) state.app = {};
        state.app.welcomeSeen = false;
        saveState();
        window.location.hash = 'home';
        setTimeout(() => {
            const homeTab = document.querySelector('#tab-home');
            if (homeTab) {
                import('../home/index.js').then(module => {
                    if (module.render) module.render(homeTab);
                }).catch(() => {
                    window.location.reload();
                });
            }
        }, 200);
        showToast('Welcome Tour re‑enabled – go to the Home tab.', 'success');
    });

    document.getElementById('settings-show-magic-tour')?.addEventListener('click', () => {
        const state = getAppState();
        if (!state.app) state.app = {};
        state.app.magicTourSeen = false;
        saveState();
        window.location.hash = 'spellcraft';
        setTimeout(() => {
            const spellcraftTab = document.querySelector('#tab-spellcraft');
            if (spellcraftTab) {
                import('../spellcraft/index.js').then(module => {
                    if (module.render) module.render(spellcraftTab);
                }).catch(() => {
                    window.location.reload();
                });
            }
        }, 200);
        showToast('Magic Paths Tour re‑enabled – go to the Spellcraft tab.', 'success');
    });
    
    setTimeout(updateWSStatusDisplay, 200);
}

// ============================================================
// DATA MANAGEMENT FUNCTIONS
// ============================================================

export function exportAllData() {
    const state = getAppState();
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
    const state = getAppState();
    
    feedback.textContent = '';
    feedback.style.color = '';
    
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
    const state = getAppState();
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
    const serverUrl = document.getElementById('campaign-server-url').value.trim() || DEFAULT_SERVER_URL;
    const feedback = document.getElementById('campaign-feedback');
    const btn = document.getElementById('campaign-upload-btn');
    btn.disabled = true;
    feedback.textContent = 'Uploading…';
    feedback.className = 'campaign-feedback mt-1';

    try {
        const state = getAppState();
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
    const serverUrl = document.getElementById('campaign-server-url').value.trim() || DEFAULT_SERVER_URL;
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
    const serverUrl = document.getElementById('campaign-server-url').value.trim() || DEFAULT_SERVER_URL;
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
            <div class="flex" style="gap:0.3rem;">
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
    const state = getAppState();
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
//
// CHANGED: this used to be its own complete reimplementation of the same
// dark/light/auto toggle app.js's setupTheme() had (independently touching
// documentElement.classList and localStorage['fates-edge-theme']) — now
// both go through core/theme-manager.js, and this module's job is just
// rendering + rebinding the button row, including any pack-supplied themes.
// ============================================================

function renderThemeButtons() {
    const current = getCurrentPreference();
    const buttons = getThemes().map(t =>
        `<button class="btn btn-sm theme-btn${current === t.id ? ' active' : ''}" data-theme="${t.id}">${t.icon || '🎨'} ${escHtml(t.label)}</button>`
    );
    buttons.push(
        `<button class="btn btn-sm theme-btn${current === 'auto' ? ' active' : ''}" data-theme="auto">🔄 Auto</button>`
    );
    return buttons.join('');
}

/** Built-in themes (dark/light) ship with theme-manager itself; anything
 *  else currently registered got there via an installed pack's pack.json
 *  `theme` block (see pack-manager.js's installPack()/reregisterPackTheme()).
 *  Cross-referencing installed packs here lets the status line say *which*
 *  pack a non-built-in theme came from, rather than just "not built-in". */
function getThemeSource(themeId) {
    if (themeId === 'dark' || themeId === 'light' || themeId === 'high-contrast') {
        return { label: 'Built-in', pack: null };
    }
    const pack = getInstalledPacks().find(p => p.theme && p.theme.id === themeId);
    return pack
        ? { label: 'From Pack', pack }
        : { label: 'Registered', pack: null };
}

function renderThemeStatusLine() {
    const preference = getCurrentPreference();
    const isAuto = preference === 'auto';
    const resolvedId = getResolvedThemeId();
    const resolvedTheme = getTheme(resolvedId);
    const source = getThemeSource(resolvedId);

    const label = resolvedTheme ? `${resolvedTheme.icon || '🎨'} ${escHtml(resolvedTheme.label)}` : escHtml(resolvedId);
    const prefNote = isAuto
        ? ` <span class="text-muted small">(Auto — matches your system's ${resolvedId === 'dark' ? 'dark' : 'light'} preference)</span>`
        : '';
    const sourceNote = source.pack
        ? `<span class="source-tag" title="Registered by this pack">${escHtml(source.pack.name)} v${escHtml(source.pack.version)}</span>`
        : `<span class="source-tag">${escHtml(source.label)}</span>`;

    return `
        <span class="theme-status-badge">
            <span class="dot"></span>
            Active: <strong>${label}</strong>${prefNote}
            ${sourceNote}
        </span>
    `;
}

function refreshThemeStatus() {
    const badge = document.getElementById('theme-count-badge');
    if (badge) badge.textContent = `${getThemes().length} installed`;
    const statusLine = document.getElementById('theme-status-line');
    if (statusLine) statusLine.innerHTML = renderThemeStatusLine();
}

function setTheme(mode) {
    applyTheme(mode);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === mode);
    });
    refreshThemeStatus();
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