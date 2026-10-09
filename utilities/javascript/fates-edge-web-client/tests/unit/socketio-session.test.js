import { describe, it, assert, assertEqual, assertDeepEqual } from '../runner.js';
import { createSocketIOSession } from '../../js/core/socketio-session.js';

function fixture(timeoutMs = 100) {
    const handlers = new Map(), sent = [];
    let ready = 0;
    const socket = {
        connected: true,
        on(name, fn) { handlers.set(name, fn); },
        off(name) { handlers.delete(name); },
        emit(name, data) { sent.push({ name, data }); },
        disconnect() { this.connected = false; handlers.get('disconnect')?.(); },
    };
    const session = createSocketIOSession(socket, { timeoutMs, onReady() { ready++; } });
    return { socket, session, sent, receive: (name, data) => handlers.get(name)?.(data), get ready() { return ready; } };
}
async function rejects(promise) { let error; try { await promise; } catch (e) { error = e; } assert(error, 'expected rejection'); }

describe('Socket.IO admission lifecycle', () => {
    it('forwards join details and resolves only room admission, ignoring GM conflict warnings', async () => {
        const f = fixture();
        try {
            const joined = f.session.join('live', { name: 'Host', role: 'gm', email: 'host@example.test', password: 'secret', authToken: 'token' });
            assertEqual(f.ready, 0);
            assertDeepEqual(f.sent[0].data, { roomCode: 'LIVE', playerName: 'Host', playerRole: 'gm', playerEmail: 'host@example.test', password: 'secret', authToken: 'token' });
            f.receive('error', { code: 'GM_CONFLICT' });
            await rejects(f.session.join('OTHER'));
            f.receive('room-joined', { room: 'canonical-id', clientRole: 'player' });
            assertEqual((await joined).clientRole, 'player');
            f.receive('room-joined', { room: 'canonical-id' });
            assertEqual(f.ready, 1);
        } finally { f.session.dispose(); }
    });
    it('clears rejected credentials so reconnect cannot retry a bad password', async () => {
        const f = fixture();
        try {
            const failed = rejects(f.session.join('LIVE', { password: 'bad' }));
            f.receive('error', { code: 'ROOM_PASSWORD_INVALID', message: 'Bad password' });
            await failed;
            f.receive('connect');
            assertEqual(f.sent.length, 1);
        } finally { f.session.dispose(); }
    });
    it('closes timed-out admission and ignores late acceptance', async () => {
        const f = fixture(5);
        try {
            await rejects(f.session.join('LIVE'));
            assertEqual(f.socket.connected, false);
            f.receive('room-joined', { room: 'LIVE' });
            assertEqual(f.ready, 0);
        } finally { f.session.dispose(); }
    });
    it('cancels pending admission when leaving or disposing', async () => {
        for (const action of ['leave', 'dispose']) {
            const f = fixture();
            const cancelled = rejects(f.session.join('LIVE'));
            f.session[action]();
            await cancelled;
            f.receive('room-joined', { room: 'LIVE' });
            assertEqual(f.ready, 0);
            f.session.dispose();
        }
    });
});
