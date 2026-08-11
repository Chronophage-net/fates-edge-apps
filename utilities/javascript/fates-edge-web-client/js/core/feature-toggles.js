/**
 * Feature Toggles – two related but distinct gates on the sidebar:
 *
 * 1. A HARD role restriction (ROLE_LOCKED_FEATURES): some features, like
 *    GM Tools, are simply never available to a non-GM client. Non-optional.
 * 2. The GM's own OPT-IN toggle (TOGGLEABLE_FEATURES): the client currently
 *    holding GM can additionally hide certain tabs from their own sidebar
 *    (e.g. decluttering GM Tools/Adventure Manager away for a session).
 *    Purely personal — never affects any other client.
 *
 * Both gates only make sense while actually connected to a session — solo
 * / local play has no GM/player distinction at all. See the
 * isConnectedToServer() check in getFeatureAccess() below: role
 * restrictions are live-gated on actually being connected right now, not
 * just on whatever role happened to be cached from a previous session.
 * (BUGFIX: this used to rely purely on the localStorage-mirrored role,
 * which never got cleared on disconnect — so GM Tools stayed grayed out
 * forever after leaving a connected session as a player.)
 *
 * DESIGN NOTE: this module is fully self-contained. It listens directly
 * for 'gmRoleUpdate' and 'presenceUpdate' (real DOM CustomEvents) to keep
 * its localStorage-mirrored role in sync, AND for 'connected'/
 * 'disconnected' via core/websocket.js's onEvent() — note those two are
 * NOT DOM events, they're websocket.js's own internal pub-sub, so they
 * must be subscribed to via onEvent(), not document.addEventListener().
 * Neither vtt-connected.js nor core/sync/presence.js needs to import this
 * file or know it exists.
 */

import { isConnectedToServer, onEvent } from './websocket.js';

const DISABLED_KEY = 'fates-edge-disabled-features';
const ROLE_KEY = 'fates-edge-my-role';

// The set of features a GM is allowed to hide from their own sidebar.
export const TOGGLEABLE_FEATURES = [
    { id: 'gm-tools', label: 'GM Tools', icon: '🎬' },
    { id: 'adventure-manager', label: 'Adventure Manager', icon: '🗺️' },
];

// Features that are ALWAYS unavailable to a non-GM client, independent of
// any toggle — this is a hard permission boundary, not a preference.
// Consolidated here from what used to be a standalone inline <script> in
// index.html (see that file's "ROLE-BASED FEATURE TOGGLING" block) so
// there's one source of truth instead of the same rule living in two
// places that could drift out of sync.
// Features that are ALWAYS unavailable to a non-GM client, independent of
// any toggle — this is a hard permission boundary, not a preference.
export const ROLE_LOCKED_FEATURES = [
    'gm-tools',
    'decks',
    'adventure-manager',   // 👈 NEW
];
function getDisabledSet() {
    try {
        const raw = localStorage.getItem(DISABLED_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) {
        console.warn('[FeatureToggles] Failed to parse disabled-features storage, resetting.', e);
        return new Set();
    }
}

function saveDisabledSet(set) {
    localStorage.setItem(DISABLED_KEY, JSON.stringify([...set]));
}

/**
 * Best-known role for the CURRENT client, mirrored into localStorage
 * automatically by the listeners below whenever either event source fires
 * — no other file needs to be edited for this module to know the current
 * role. Defaults to 'player' (i.e. "show everything except role-locked
 * features") if never set.
 */
export function getMyStoredRole() {
    return localStorage.getItem(ROLE_KEY) || 'player';
}

// ─── v4.8: Co-GM / Spectator ──────────────────────────────────────────
// Co-GM gets every GM-gated feature a GM gets (server-side permission
// checks are the real enforcement; this is just UI visibility). A
// Spectator gets none of them AND is additionally read-only everywhere
// else -- see isReadOnlyRole() below, used by feature modules' own
// write-action gating (buttons, forms, etc.), not just sidebar visibility.
export function isGmLikeRole(role = getMyStoredRole()) {
    return role === 'gm' || role === 'co-gm';
}

export function isReadOnlyRole(role = getMyStoredRole()) {
    return role === 'spectator';
}

function setMyStoredRole(role) {
    if (!role || role === getMyStoredRole()) return;
    localStorage.setItem(ROLE_KEY, role);
    document.dispatchEvent(new CustomEvent('featureVisibilityChanged', { detail: { roleChanged: true } }));
}

// Two independent DOM-event role sources exist in this codebase —
// vtt-connected.js's 'gmRoleUpdate', and (per index.html's former inline
// script) 'presenceUpdate' from core/sync/presence.js.
document.addEventListener('gmRoleUpdate', (e) => {
    if (e.detail?.role) setMyStoredRole(e.detail.role);
});

document.addEventListener('presenceUpdate', (e) => {
    const myId = window.__vttClientId || (window.vttState && window.vttState.socketId);
    if (!myId || !e.detail?.clients) return;
    const me = e.detail.clients.find(c => c.id === myId);
    if (me?.role) setMyStoredRole(me.role);
});

// BUGFIX: 'connected'/'disconnected' are NOT DOM CustomEvents in this
// codebase — they're core/websocket.js's own internal pub-sub, so they
// must be subscribed to via onEvent(), not document.addEventListener()
// (which would silently never fire for them).
//
// On disconnect: reset the cached role to 'player' (the safe default) and
// force an immediate re-render, so a grayed-out GM Tools doesn't linger
// after leaving a session — getFeatureAccess() below already treats
// "not connected" as "show everything," but the sidebar still needs to
// be told to re-evaluate right now rather than waiting for some other
// event to happen to fire.
onEvent('disconnected', () => {
    localStorage.setItem(ROLE_KEY, 'player');
    document.dispatchEvent(new CustomEvent('featureVisibilityChanged', { detail: { disconnected: true } }));
});

// On (re)connect: force a re-render too. Role defaults back to 'player'
// until a fresh 'gmRoleUpdate'/'presenceUpdate' says otherwise — safe
// default, and it self-corrects the moment the real update arrives.
onEvent('connected', () => {
    document.dispatchEvent(new CustomEvent('featureVisibilityChanged', { detail: { connected: true } }));
});

/**
 * Whether a given feature should currently be shown/enabled in THIS
 * client's own sidebar, and if not, why — so the UI can show a specific
 * notification ("GM-only" vs "you hid this yourself") rather than a
 * generic "unavailable."
 *
 * Returns { accessible: boolean, reason: null | 'gm-only' | 'gm-hidden' }
 */
export function getFeatureAccess(featureId) {
    // Role restrictions only make sense in a connected multiplayer
    // session. Solo/local play has no GM/player distinction, so nothing
    // is ever role-locked while disconnected — regardless of whatever
    // role happens to still be cached from a previous session.
    if (!isConnectedToServer()) {
        return { accessible: true, reason: null };
    }

    const role = getMyStoredRole();

    if (ROLE_LOCKED_FEATURES.includes(featureId) && !isGmLikeRole(role)) {
        return { accessible: false, reason: 'gm-only' };
    }
    if (isGmLikeRole(role) && getDisabledSet().has(featureId)) {
        return { accessible: false, reason: 'gm-hidden' };
    }
    return { accessible: true, reason: null };
}

/**
 * Convenience boolean wrapper around getFeatureAccess, for callers (like
 * the router backstop) that only need a yes/no.
 */
export function isFeatureVisible(featureId) {
    return getFeatureAccess(featureId).accessible;
}

/** Human-readable message for whichever reason a feature is unavailable. */
export function getFeatureLockMessage(featureId) {
    const { reason } = getFeatureAccess(featureId);
    if (reason === 'gm-only') return 'Only the GM can access this.';
    if (reason === 'gm-hidden') return 'You\'ve hidden this from your own sidebar — re-enable it from your GM panel.';
    return null;
}

/**
 * Toggle a feature's visibility for the current (GM) client and notify
 * any listeners (sidebar nav, settings panels, etc.) to re-render.
 */
export function setFeatureVisible(featureId, visible) {
    const set = getDisabledSet();
    if (visible) {
        set.delete(featureId);
    } else {
        set.add(featureId);
    }
    saveDisabledSet(set);
    document.dispatchEvent(new CustomEvent('featureVisibilityChanged', {
        detail: { featureId, visible }
    }));
}

/**
 * Convenience helper for whatever renders the sidebar: call this once when
 * setting up the nav, and it'll re-run your render callback whenever a
 * toggle changes OR the current client's GM role changes (covers both
 * "I just hid Adventure Manager" and "GM status just changed hands, so
 * everything should reappear/disappear appropriately").
 *
 * Usage:
 *   import { isFeatureVisible, watchFeatureVisibility } from '../core/feature-toggles.js';
 *   watchFeatureVisibility(() => renderSidebarNav());
 *   // ...and inside renderSidebarNav's tab list:
 *   tabs.filter(tab => !isToggleable(tab.id) || isFeatureVisible(tab.id))
 */
export function watchFeatureVisibility(callback) {
    document.addEventListener('featureVisibilityChanged', callback);
    document.addEventListener('gmRoleUpdate', callback);
    document.addEventListener('presenceUpdate', callback);
    return () => {
        document.removeEventListener('featureVisibilityChanged', callback);
        document.removeEventListener('gmRoleUpdate', callback);
        document.removeEventListener('presenceUpdate', callback);
    };
}

export function isToggleable(featureId) {
    return TOGGLEABLE_FEATURES.some(f => f.id === featureId);
}

export default {
    TOGGLEABLE_FEATURES,
    ROLE_LOCKED_FEATURES,
    getMyStoredRole,
    isGmLikeRole,
    isReadOnlyRole,
    getFeatureAccess,
    isFeatureVisible,
    getFeatureLockMessage,
    setFeatureVisible,
    watchFeatureVisibility,
    isToggleable,
};
