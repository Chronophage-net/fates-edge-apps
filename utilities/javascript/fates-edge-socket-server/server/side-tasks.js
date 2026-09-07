// Server-owned access lists for temporary, human-supervised side rooms.
const { randomBytes } = require('node:crypto');
const room = require('./room');
const { isGmLike } = require('./security');
const tasks = new Map();
const actorAllowed = actor => actor && (isGmLike(actor.role) || actor.role === 'assistant-gm');
const identity = value => value == null ? null : String(value);

function access(target, user, data = {}) {
    const task = target.sideTask;
    if (!task) return data.sideTaskId || data.delegationToken ? { allowed: false } : { allowed: true };
    if (task.closed) return { allowed: false };
    if (data.sideTaskId === task.id && data.delegationToken === task.token) return { allowed: true, role: 'gm' };
    const id = identity(user?.userId);
    if (!id || !task.users.includes(id)) return { allowed: false };
    return { allowed: true, role: id === task.supervisor ? 'co-gm' : 'player' };
}
function request(source, actor, data, config = {}) {
    if (!actorAllowed(actor)) throw new Error('A GM or granted Assistant GM must host side tasks.');
    if (config.manager || process.env.REDIS_URL || Number(process.env.CLUSTER_WORKERS || 0) > 1) {
        throw new Error('Side tasks currently require a single unmanaged server instance.');
    }
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(data.taskId || '')) throw new Error('Invalid task ID.');
    const key = `${source.code}:${data.taskId}`;
    if (data.action === 'open') {
        const supervisor = source.clients.get(data.supervisorClientId);
        if (!supervisor?.userId || !isGmLike(supervisor.role)) throw new Error('The supervising human GM must be signed in.');
        const users = [...new Set((Array.isArray(data.participants) ? data.participants : []).map(identity))];
        if (!users.length || users.length > 8 || users.some(id => !id || ![...source.clients.values()].some(c => identity(c.userId) === id))) {
            throw new Error('Choose 1–8 signed-in participants currently in the original room.');
        }
        let task = tasks.get(key);
        if (task) {
            if (task.token !== data.delegationToken || task.supervisor !== identity(supervisor.userId) || task.closed) throw new Error('Side task cannot be reclaimed.');
            if (JSON.stringify(task.participants) !== JSON.stringify(users)) throw new Error('Participants changed; create a new task.');
        } else {
            if ([...tasks.values()].filter(t => t.source === source.code && !t.closed).length >= 3 || tasks.size >= 100) throw new Error('Side-task room limit reached.');
            let code;
            do { code = 'DT' + randomBytes(4).toString('hex').toUpperCase(); } while (room.rooms.has(code));
            task = { id: data.taskId, source: source.code, code, token: randomBytes(32).toString('hex'),
                supervisor: identity(supervisor.userId), participants: users, users: [...new Set([...users, identity(supervisor.userId)])], closed: false };
            tasks.set(key, task);
        }
        task.owner = actor.id;
        let target = room.rooms.get(task.code);
        if (!target) target = room.createRoom(task.code);
        target.sideTask = task;
        return { room: task.code, taskId: task.id, delegationToken: task.token };
    }
    const task = tasks.get(key);
    if (!task || task.owner !== actor.id || task.token !== data.delegationToken) throw new Error('Side-task ownership changed.');
    if (data.action === 'close') {
        task.closed = true;
        const target = room.rooms.get(task.code);
        if (target) {
            for (const client of [...target.clients.values()]) {
                if (client.ws) client.ws.close(1000, 'Side task closed; return to original room');
                else if (client.socket) { client.socket.leave(task.code); client.socket.disconnect(true); }
            }
            room.rooms.delete(task.code);
        }
        tasks.delete(key);
        return { closed: true };
    }
    if (data.action !== 'report' && data.action !== 'invite') throw new Error('Unknown side-task action.');
    const recipients = data.action === 'invite' ? task.users : [task.supervisor];
    const text = data.action === 'invite'
        ? `Side task ${task.id}: open a second web client and connect Live Campaign Sync to room ${task.code} on this server using your signed-in account. Original room: ${source.code}.`
        : String(data.text || '').slice(0, 12000);
    let delivered = 0;
    for (const target of source.clients.values()) {
        if (!recipients.includes(identity(target.userId))) continue;
        if (data.action === 'report' && !isGmLike(target.role)) continue;
        room.deliverWhisper(source.code, 'chat-message', { message: { text, sender: 'Side-task GM', whisper: true, recipient: target.id,
            verifiedGM: true, senderClientId: actor.id, timestamp: Date.now() } }, null, target.id);
        delivered++;
    }
    return { delivered };
}
module.exports = { access, request };
