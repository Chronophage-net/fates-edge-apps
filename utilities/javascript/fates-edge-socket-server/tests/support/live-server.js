const { spawn } = require('node:child_process');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const WebSocket = require('ws');

async function startTestServer(settings = {}) {
    const directory = await mkdtemp(join(tmpdir(), 'fe-socket-test-'));
    await writeFile(join(directory, 'config.json'), '{}');
    const child = spawn(process.execPath, [resolve(__dirname, '../../server-start.js')], {
        cwd: directory,
        env: { ...process.env, HOST: '127.0.0.1', PORT: '0', CONFIG_FILE: join(directory, 'config.json'),
            DATABASE_TYPE: 'sqlite', DATABASE_URL: join(directory, 'test.db'),
            ROOM_DIRECTORY_FILE: join(directory, 'rooms.json'), AUTH_JWT_SECRET: 'isolated-test-jwt-secret',
            API_KEY: 'isolated-test-admin-key', MANAGER_URL: '', REDIS_URL: '', CLUSTER_WORKERS: '0',
            CORS_ORIGIN: '*', MAX_CLIENTS_PER_ROOM: '0', MAX_CHAT_HISTORY: '50',
            WS_MESSAGE_RATE_MAX: '120', WS_MAX_PAYLOAD_BYTES: '8388608', HANDSHAKE_TIMEOUT_MS: '10000',
            API_RATE_LIMIT_MAX: '300', LOG_LEVEL: 'WARN', ...settings },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    const clients = [];
    async function close() {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
        const killTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
        try {
            const result = await exited;
            return result;
        } finally {
            clearTimeout(killTimer);
            clients.forEach(client => client.terminate());
            await rm(directory, { recursive: true, force: true });
        }
    }
    try {
        const port = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Server start timed out: ${output.slice(-1500)}`)), 10000);
            child.once('error', error => { clearTimeout(timer); reject(error); });
            child.once('exit', () => { clearTimeout(timer); reject(new Error(`Server exited during startup: ${output.slice(-1500)}`)); });
            const collect = bytes => {
                output += bytes.toString();
                const match = output.match(/Server running on 127\.0\.0\.1:(\d+)/);
                if (match) { clearTimeout(timer); resolve(Number(match[1])); }
            };
            child.stdout.on('data', collect);
            child.stderr.on('data', collect);
        });
        return { port, base: `http://127.0.0.1:${port}`, clients, close, get output() { return output; } };
    } catch (error) { await close(); throw error; }
}

async function connect(server, { socketIO = false, path = '/?room=LIVE', origin } = {}) {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}${socketIO ? '/socket.io/?EIO=4&transport=websocket' : path}`, origin ? { origin } : {});
    server.clients.push(ws);
    const messages = [], pending = [];
    const closed = new Promise(resolve => ws.once('close', (code, reason) => resolve({ code, reason: reason.toString() })));
    const deliver = (type, data) => {
        const message = { ...data, type };
        messages.push(message);
        const index = pending.findIndex(item => item.type === type);
        if (index >= 0) { const [item] = pending.splice(index, 1); clearTimeout(item.timer); item.resolve(message); }
    };
    ws.on('error', error => deliver('connection-error', { message: error.message }));
    ws.on('message', bytes => {
        const text = bytes.toString();
        if (socketIO) {
            if (text.startsWith('0')) ws.send('40');
            else if (text === '2') ws.send('3');
            else if (text.startsWith('40')) deliver('ready', JSON.parse(text.slice(2)));
            else if (text.startsWith('42')) { const [type, data] = JSON.parse(text.slice(2)); deliver(type, data); }
        } else { const data = JSON.parse(text); deliver(data.type, data); }
    });
    // Each wait consumes one event. Retain a separate log for negative assertions.
    const consumed = new Set();
    function wait(type) {
        const existing = messages.find(item => item.type === type && !consumed.has(item));
        if (existing) { consumed.add(existing); return Promise.resolve(existing); }
        return new Promise((resolve, reject) => {
            const item = { type, resolve(message) { consumed.add(message); resolve(message); }, timer: null };
            item.timer = setTimeout(() => { pending.splice(pending.indexOf(item), 1); reject(new Error(`Timed out waiting for ${type}; server: ${server.output.slice(-1000)}`)); }, 5000);
            pending.push(item);
        });
    }
    await wait(socketIO ? 'ready' : 'connected');
    return { ws, messages, wait, closed,
        send(type, data = {}) { ws.send(socketIO ? '42' + JSON.stringify([type, data]) : JSON.stringify({ ...data, type })); },
        async join(code = 'LIVE', fields = {}) {
            this.send(socketIO ? 'join-room' : 'handshake', { roomCode: code, clientName: 'Test Player', ...fields });
            return wait(socketIO ? 'room-joined' : 'handshake_ack');
        },
    };
}
module.exports = { startTestServer, connect };
