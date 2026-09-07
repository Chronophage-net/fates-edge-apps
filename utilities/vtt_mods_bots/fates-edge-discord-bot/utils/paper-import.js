const { randomUUID } = require('node:crypto');
const parser = () => import('../vendor/paper-import.mjs');
const TTL = 5 * 60 * 1000;

class PaperImports {
    constructor({ now = Date.now, makeId = randomUUID } = {}) {
        this.now = now;
        this.makeId = makeId;
        this.pending = new Map();
    }
    prune() {
        for (const [key, item] of this.pending) if (item.expires <= this.now()) this.pending.delete(key);
    }
    async preview(text, context) {
        this.prune();
        // A new preview invalidates earlier buttons belonging to the same person.
        for (const [key, item] of this.pending) {
            if (item.context.user === context.user && item.context.guild === context.guild) this.pending.delete(key);
        }
        if (!text || text.length > 4000) throw new Error('Paste between 1 and 4,000 characters. Split longer sheets into separate imports.');
        const { parsePaperImport, planPaperImport } = await parser();
        const parsed = parsePaperImport(text);
        const issues = parsed.issues.map(i => `Line ${i.line}: ${i.code}${i.value ? ` — ${i.value}` : ''}`);
        if (parsed.entries.some(e => Object.hasOwn(e.fields, 'id'))) {
            issues.push('ID updates are available in the web client only. Discord creates new entries; omit ID only if you intend to create a new entry.');
        }
        if (parsed.issues.some(i => i.code !== 'corrected') || parsed.entries.some(e => Object.hasOwn(e.fields, 'id'))) {
            return { issues, report: issues.join('\n'), token: null };
        }
        if (parsed.entries.length > 10) throw new Error('Import at most 10 entries at a time.');
        if (this.pending.size >= 100) throw new Error('Too many pending imports. Try again in five minutes.');
        const operations = planPaperImport(parsed, {}, this.makeId);
        for (const op of operations) {
            if (op.type === 'add_character') {
                op.value = { body: 1, wits: 1, spirit: 1, presence: 1, totalXp: 32, fatigue: 0, harm: 0, boons: 0, ...op.value };
            }
        }
        const token = this.makeId();
        const report = [`Room: ${context.room}`, 'CREATE NEW ENTRIES — no existing records will be updated.',
            ...issues, ...operations.map(op => `${op.type}\n${JSON.stringify(op.value, null, 2)}`)].join('\n\n');
        this.pending.set(token, { context: { ...context }, operations, expires: this.now() + TTL });
        return { token, report, count: operations.length, issues };
    }
    take(token, context) {
        this.prune();
        const item = this.pending.get(token);
        if (!item) throw new Error('This preview expired or was already used.');
        if (Object.keys(item.context).some(key => item.context[key] !== context[key])) {
            throw new Error('The user, channel or VTT connection changed. Create a fresh preview.');
        }
        this.pending.delete(token); // Consume before the first await to prevent duplicate clicks.
        return item.operations;
    }
}

async function deliverOperations(vtt, operations, context) {
    let confirmed = 0;
    for (const operation of operations) {
        if (!vtt.connected || vtt.roomCode !== context.room || vtt.clientId !== context.connection || vtt.config.serverUrl !== context.server) {
            return { confirmed, total: operations.length, uncertain: false };
        }
        try {
            await vtt.sendPaperOperation(operation);
            confirmed++;
        } catch {
            // Stop on the first uncertain delivery. Never retry or send the remaining entries.
            return { confirmed, total: operations.length, uncertain: true };
        }
    }
    return { confirmed, total: operations.length, uncertain: false };
}
module.exports = { PaperImports, deliverOperations };
