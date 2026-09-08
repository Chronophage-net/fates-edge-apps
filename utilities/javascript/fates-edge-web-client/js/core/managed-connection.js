/** Validate a pasted manager connection. The socket node verifies its signature.
 * Credentials stay in memory and are never written to storage or URLs.
 */
export function parseManagedConnection(input, now = Date.now()) {
    let connection;
    try { connection = typeof input === 'string' ? JSON.parse(input) : input; }
    catch { throw new Error('Paste the complete connection copied from the manager.'); }
    if (!connection || typeof connection.room_token !== 'string' || connection.room_token.length > 16000) {
        throw new Error('A manager room connection is required, not an API key.');
    }
    let claims, url;
    try {
        const parts = connection.room_token.split('.');
        if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error();
        claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        url = new URL(connection.socket_url);
    } catch { throw new Error('The room connection is incomplete or invalid.'); }
    if (url.username || url.password || url.search || url.hash ||
        !(url.protocol === 'wss:' || (url.protocol === 'ws:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)))) {
        throw new Error('Managed rooms require a secure socket address (or localhost).');
    }
    if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= now || claims.exp * 1000 > now + 610000) {
        throw new Error('This connection has expired. Get a new connection from the manager.');
    }
    if (claims.room_id !== connection.room_id || claims.server_id !== connection.server_id ||
        claims.placement_version !== connection.placement_version || !Number.isInteger(claims.placement_version) ||
        typeof claims.room_code !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(claims.room_code) ||
        (connection.room_code && connection.room_code !== claims.room_code) ||
        !['gm','co-gm','assistant-gm','player','spectator'].includes(claims.role)) {
        throw new Error('The room and server details do not match this connection.');
    }
    return { roomToken: connection.room_token, roomId: claims.room_id, roomCode: claims.room_code,
        serverId: claims.server_id, placementVersion: claims.placement_version, serverUrl: url.href,
        expiresAt: claims.exp * 1000, role: claims.role };
}
