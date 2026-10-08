// Build-time addresses are public configuration, never credentials.
// Docker's combined stack defaults to the host the player's browser opened,
// not localhost (which would refer to the player's own device).
export function getConnectionDefaults(env = import.meta.env || {}, location = globalThis.location) {
    const secure = location?.protocol === 'https:';
    const port = env.VITE_SELF_HOSTED_SERVER_PORT;
    const host = location?.hostname || 'localhost';
    const authority = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
    const local = port ? `${authority}:${port}` : null;
    return {
        wsUrl: env.VITE_WS_URL || (local ? `${secure ? 'wss' : 'ws'}://${local}` : secure ? 'wss://fates-edge-socket-server.onrender.com' : 'ws://localhost:10000'),
        serverUrl: env.VITE_SERVER_URL || (local ? `${secure ? 'https' : 'http'}://${local}` : secure ? 'https://fates-edge-socket-server.onrender.com' : 'http://localhost:10000'),
        room: env.VITE_WS_ROOM || 'AC12'
    };
}
