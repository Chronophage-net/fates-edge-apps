/**
 * System Status
 * A single page showing which integrations are currently connected:
 * the real-time server, voice chat (+ TURN availability), session
 * recording, the sync/offline-queue layer, who's in the room (with a
 * best-effort "looks like a bot" flag for the AI GM bot / Discord
 * bridge), the search backend (Solr/Elasticsearch/local Fuse.js), and a
 * few browser feature checks the rest of the toolkit depends on.
 *
 * Deliberately read-only / best-effort throughout: every check here
 * degrades to "unknown"/"unavailable" rather than throwing, since the
 * whole point of this page is to be trustworthy when something else
 * is broken.
 */

import {
    isConnectedToServer,
    getConnectionMode,
    getRoomCode,
    getSocketId,
    getWSStatus,
    getConnectedClients
} from '../../core/websocket.js';
import { fetchTurnIceServers } from '../../core/turn.js';
import { getRecordingStatus } from '../../core/media.js';
import { getSyncManager } from '../../core/sync/index.js';
import { getSearchStatus } from '../search/index.js';

const REFRESH_INTERVAL_MS = 5000;
let refreshTimer = null;

// Best-effort only -- neither bot currently sends an explicit "I am a
// bot" flag over the wire (see fates-edge-ai-gm-bot's handshake, which
// sends role:'gm' + a configurable clientName, and the Discord bridge,
// which proxies individual Discord usernames with role:'player'). This
// catches the common/default configurations, not a guarantee.
const BOT_NAME_PATTERNS = [/\bbot\b/i, /^ai[_-]?gm$/i, /\baigm\b/i, /discord/i];

function looksLikeBot(name) {
    if (!name) return false;
    return BOT_NAME_PATTERNS.some(re => re.test(name));
}

function statusDot(ok, label) {
    const cls = ok === true ? 'online' : ok === false ? 'offline' : 'connecting';
    return `<span class="status-dot ${cls}" title="${label}"></span>`;
}

function badge(text, color = 'blue') {
    return `<span class="badge badge-${color}">${text}</span>`;
}

function capabilityRow(label, ok) {
    return `<div class="status-row"><span>${label}</span>${badge(ok ? 'Available' : 'Not available', ok ? 'green' : 'red')}</div>`;
}

// ============================================================
// DATA COLLECTION (each piece independently best-effort)
// ============================================================

async function collectServerStatus() {
    const connected = isConnectedToServer();
    return {
        connected,
        mode: getConnectionMode(),
        wsStatus: getWSStatus(),
        room: getRoomCode(),
        socketId: getSocketId()
    };
}

async function collectVoiceStatus() {
    // Lazy import: js/features/vtt/voice.js pulls in the full VTT stack
    // (WebSocket event wiring, media module, etc.), which we don't want
    // to force-load just to show a status page. This also means this
    // page works even if voice was never initialized this session.
    let voice = null;
    try {
        voice = await import('../vtt/voice.js');
    } catch (e) {
        return { available: false, error: e.message };
    }

    const initialized = voice.isVoiceInitialized ? voice.isVoiceInitialized() : false;
    const status = voice.getVoiceStatus ? voice.getVoiceStatus() : { enabled: false, muted: false };
    const peers = voice.getActiveVoiceClients ? voice.getActiveVoiceClients() : [];

    let turnConfigured = null; // null = unknown/not checked (not connected to a server)
    try {
        const turnServers = await fetchTurnIceServers();
        turnConfigured = turnServers.length > 0;
    } catch (e) {
        turnConfigured = false;
    }

    return { available: true, initialized, status, peerCount: peers.length, turnConfigured };
}

function collectRecordingStatus() {
    try {
        return getRecordingStatus();
    } catch (e) {
        return { isRecording: false, duration: 0 };
    }
}

function collectSyncStatus() {
    try {
        const sync = getSyncManager();
        return sync.getConnectionStatus ? sync.getConnectionStatus() : null;
    } catch (e) {
        return null;
    }
}

async function collectRoomClients() {
    if (!isConnectedToServer()) return [];
    try {
        const clients = await getConnectedClients();
        return Array.isArray(clients) ? clients : [];
    } catch (e) {
        return [];
    }
}

// Best-effort: search/index.js's own state only exists once its render()
// or loadSearchIndex() has actually run at least once (e.g. the user has
// visited the Search tab this session) -- before that, getSearchStatus()
// still returns a valid shape (backend: null, indexCount: 0), which reads
// correctly here as "not loaded yet", not an error.
function collectSearchStatus() {
    try {
        return getSearchStatus();
    } catch (e) {
        return { isInitialized: false, backend: null, indexCount: 0, solrConfigured: false, elasticsearchConfigured: false, error: e.message };
    }
}

function collectBrowserCapabilities() {
    return {
        webrtc: typeof RTCPeerConnection !== 'undefined',
        getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        displayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
        indexedDB: typeof indexedDB !== 'undefined',
        notifications: typeof Notification !== 'undefined'
    };
}

// ============================================================
// RENDER
// ============================================================

function formatDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

async function buildStatusHtml() {
    const [server, voice, clients] = await Promise.all([
        collectServerStatus(),
        collectVoiceStatus(),
        collectRoomClients()
    ]);
    const recording = collectRecordingStatus();
    const sync = collectSyncStatus();
    const searchStatus = collectSearchStatus();
    const caps = collectBrowserCapabilities();

    const clientRows = clients.length
        ? clients.map(c => `
            <div class="status-row">
                <span>${c.name || 'Unknown'}${looksLikeBot(c.name) ? ' ' + badge('🤖 possible bot', 'purple') : ''}</span>
                ${badge(c.role || 'player', c.role === 'gm' ? 'gold' : 'blue')}
            </div>
        `).join('')
        : `<p class="text-muted small">${server.connected ? 'No other clients connected.' : 'Not connected to a server.'}</p>`;

    return `
        <div class="panel">
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <h3>🩺 System Status</h3>
                <button class="btn btn-sm" id="system-status-refresh">🔄 Refresh</button>
            </div>
            <p class="text-muted small">Auto-refreshes every ${REFRESH_INTERVAL_MS / 1000}s while this page is open.</p>

            <div class="grid-2" style="margin-top:1rem;">
                <div class="panel">
                    <h4>${statusDot(server.connected, server.connected ? 'Connected' : 'Disconnected')} Real-Time Server</h4>
                    <div class="status-row"><span>Status</span>${badge(server.connected ? 'Connected' : 'Disconnected', server.connected ? 'green' : 'red')}</div>
                    <div class="status-row"><span>Transport</span>${badge(server.mode, 'blue')}</div>
                    <div class="status-row"><span>Room</span>${badge(server.room || '—', 'blue')}</div>
                    <div class="status-row"><span>Client ID</span><span class="text-muted small">${server.socketId || '—'}</span></div>
                </div>

                <div class="panel">
                    <h4>${statusDot(voice.available && voice.status?.enabled, 'Voice chat')} Voice Chat</h4>
                    ${voice.available ? `
                        <div class="status-row"><span>Enabled</span>${badge(voice.status.enabled ? 'Yes' : 'No', voice.status.enabled ? 'green' : 'red')}</div>
                        <div class="status-row"><span>Muted</span>${badge(voice.status.muted ? 'Yes' : 'No', voice.status.muted ? 'gold' : 'green')}</div>
                        <div class="status-row"><span>Connected peers</span>${badge(String(voice.peerCount), 'blue')}</div>
                        <div class="status-row"><span>TURN (NAT traversal)</span>${voice.turnConfigured === null ? badge('Unknown', 'blue') : badge(voice.turnConfigured ? 'Available' : 'STUN-only', voice.turnConfigured ? 'green' : 'gold')}</div>
                    ` : `<p class="text-muted small">Voice module unavailable: ${voice.error || 'unknown error'}</p>`}
                </div>

                <div class="panel">
                    <h4>${statusDot(recording.isRecording, 'Recording')} Session Recording</h4>
                    <div class="status-row"><span>Status</span>${badge(recording.isRecording ? '🔴 Recording' : 'Idle', recording.isRecording ? 'red' : 'blue')}</div>
                    ${recording.isRecording ? `<div class="status-row"><span>Duration</span><span class="text-muted small">${formatDuration(recording.duration)}</span></div>` : ''}
                </div>

                <div class="panel">
                    <h4>${statusDot(!!sync?.isConnected, 'Sync layer')} Sync / Offline Queue</h4>
                    ${sync ? `
                        <div class="status-row"><span>Status</span>${badge(sync.isConnected ? 'Connected' : (sync.isConnecting ? 'Connecting…' : 'Disconnected'), sync.isConnected ? 'green' : (sync.isConnecting ? 'gold' : 'red'))}</div>
                        <div class="status-row"><span>Queued (offline) ops</span>${badge(String(sync.offlineQueueSize ?? 0), sync.offlineQueueSize ? 'gold' : 'green')}</div>
                        <div class="status-row"><span>Pending acks</span>${badge(String(sync.pendingOperations ?? 0), 'blue')}</div>
                    ` : `<p class="text-muted small">Sync manager unavailable.</p>`}
                </div>

                <div class="panel">
                    <h4>👥 Connected Clients ${server.connected ? badge(String(clients.length), 'blue') : ''}</h4>
                    ${clientRows}
                </div>

                <div class="panel">
                    <h4>${statusDot(searchStatus.isInitialized, 'Search index')} Search</h4>
                    <div class="status-row"><span>Backend</span>${badge(
                        searchStatus.backend === 'solr' ? 'Solr' :
                        searchStatus.backend === 'elasticsearch' ? 'Elasticsearch' :
                        searchStatus.backend === 'fuse' ? 'Local (Fuse.js)' : 'Not loaded yet',
                        searchStatus.backend === 'solr' || searchStatus.backend === 'elasticsearch' ? 'green' : 'blue'
                    )}</div>
                    <div class="status-row"><span>Indexed entries</span>${badge(String(searchStatus.indexCount ?? 0), 'blue')}</div>
                    ${(searchStatus.solrConfigured || searchStatus.elasticsearchConfigured) ? `
                        <div class="status-row"><span>Solr configured</span>${badge(searchStatus.solrConfigured ? 'Yes' : 'No', searchStatus.solrConfigured ? 'green' : 'blue')}</div>
                        <div class="status-row"><span>Elasticsearch configured</span>${badge(searchStatus.elasticsearchConfigured ? 'Yes' : 'No', searchStatus.elasticsearchConfigured ? 'green' : 'blue')}</div>
                    ` : `<p class="text-muted small">No external search backend configured — using the built-in local index.</p>`}
                </div>

                <div class="panel">
                    <h4>🌐 Browser Capabilities</h4>
                    ${capabilityRow('WebRTC', caps.webrtc)}
                    ${capabilityRow('Microphone (getUserMedia)', caps.getUserMedia)}
                    ${capabilityRow('Screen capture (getDisplayMedia)', caps.displayMedia)}
                    ${capabilityRow('Local storage (IndexedDB)', caps.indexedDB)}
                    ${capabilityRow('Notifications', caps.notifications)}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// MODULE LIFECYCLE (see js/module-loader.js for the contract)
// ============================================================

function stopAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

export async function render(container) {
    container.innerHTML = await buildStatusHtml();

    const refreshBtn = container.querySelector('#system-status-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => render(container));
    }

    stopAutoRefresh();
    refreshTimer = setInterval(async () => {
        // Guard against the page having been navigated away from between
        // ticks (container detached from the DOM).
        if (!container.isConnected) {
            stopAutoRefresh();
            return;
        }
        container.innerHTML = await buildStatusHtml();
        const btn = container.querySelector('#system-status-refresh');
        if (btn) btn.addEventListener('click', () => render(container));
    }, REFRESH_INTERVAL_MS);
}

export function onDeactivate() {
    stopAutoRefresh();
}

export function destroy() {
    stopAutoRefresh();
}

export default { render, onDeactivate, destroy };
