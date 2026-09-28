const { Server } = require('socket.io');
const WebSocket = require('ws');

function isOriginAllowed(origin, configured = '*') {
    // Native clients do not send Origin; credentials still gate room admission.
    if (!origin) return true;
    if (configured === '*') return true;
    return (Array.isArray(configured) ? configured : [configured]).includes(origin);
}

function createTransports(server, config) {
    const io = new Server(server, {
        cors: { origin: config.corsOrigin, methods: ['GET', 'POST'], credentials: config.corsOrigin !== '*' },
        allowRequest: (req, callback) => callback(null, isOriginAllowed(req.headers.origin, config.corsOrigin)),
        transports: ['websocket', 'polling'],
        maxHttpBufferSize: config.wsMaxPayloadBytes,
        // The dispatcher below owns non-Socket.IO upgrades.
        destroyUpgrade: false,
    });
    const wss = new WebSocket.Server({ noServer: true, maxPayload: config.wsMaxPayloadBytes });
    server.on('upgrade', (req, socket, head) => {
        const reject = status => {
            socket.on('error', () => {});
            socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
        };
        let pathname;
        try { pathname = new URL(req.url, 'http://localhost').pathname; }
        catch { return reject('400 Bad Request'); }
        if (pathname.startsWith('/socket.io/')) return;
        if (pathname !== '/' && !/^\/campaign\/[A-Za-z0-9_-]{1,64}\/?$/.test(pathname)) return reject('404 Not Found');
        if (!isOriginAllowed(req.headers.origin, config.corsOrigin)) return reject('403 Forbidden');
        wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    });
    return { io, wss };
}

/** Stop accepting traffic while closing upgraded connections in parallel. */
async function closeTransports(server, io, wss, timeoutMs = 1500) {
    const timer = setTimeout(() => {
        for (const client of wss.clients) client.terminate();
        server.closeAllConnections?.();
    }, timeoutMs);
    timer.unref();
    try {
        const wsClosed = new Promise(resolve => wss.close(resolve));
        for (const client of wss.clients) client.close(1001, 'Server shutting down');
        // Socket.IO closes its transports AND the shared HTTP listener.
        await Promise.all([wsClosed, new Promise(resolve => io.close(resolve))]);
    } finally { clearTimeout(timer); }
}
module.exports = { createTransports, closeTransports, isOriginAllowed };
