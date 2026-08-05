/**
 * TURN Credentials
 * Fetches short-lived TURN credentials from the connected socket-server
 * (see server/turn.js + GET /api/turn-credentials) to supplement the
 * hardcoded STUN servers in VoiceChat.js, so voice chat can traverse
 * symmetric NAT / restrictive firewalls that plain STUN can't.
 *
 * This is entirely best-effort: self-hosted deployments that haven't
 * configured TURN_SECRET get a 404 (or the request may fail outright if
 * not connected to a server at all, or an older server without this
 * route) and voice chat simply falls back to STUN-only, exactly as it
 * always has.
 */

import { getApiBaseUrl, getSocketId, isConnectedToServer } from './websocket.js';

const FETCH_TIMEOUT_MS = 5000;

/**
 * Fetch extra ICE servers (TURN) for the currently connected server, if
 * any are configured. Never throws -- returns [] on any failure.
 * @returns {Promise<Array<{urls: string, username?: string, credential?: string}>>}
 */
export async function fetchTurnIceServers() {
    if (!isConnectedToServer()) return [];

    const apiBase = getApiBaseUrl();
    if (!apiBase) return [];

    const clientId = getSocketId() || 'anon';
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;

    try {
        const res = await fetch(`${apiBase}/turn-credentials?clientId=${encodeURIComponent(clientId)}`, {
            method: 'GET',
            signal: controller ? controller.signal : undefined
        });

        // 404 = server has no TURN configured. Any other non-OK status =
        // treat the same way (best-effort, STUN-only fallback).
        if (!res.ok) return [];

        const data = await res.json();
        if (!data || !Array.isArray(data.iceServers)) return [];
        return data.iceServers;
    } catch (err) {
        console.debug('[TURN] Could not fetch TURN credentials, falling back to STUN-only:', err.message);
        return [];
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

export default { fetchTurnIceServers };
