/** Plain-text paper exchange format. Parsing never changes campaign state. */
const SKILLS = ['melee', 'ranged', 'athletics', 'stealth', 'endurance', 'craft', 'sway', 'deception', 'performance', 'insight', 'lore', 'arcana'];
const NUMBERS = { body: [1, 5], wits: [1, 5], spirit: [1, 5], presence: [1, 5], fatigue: [0, 100], harm: [0, 3], boons: [0, 100], xp: [0, 100000], segments: [4, 10], current: [0, 10] };
const FIELDS = {
    character: ['id', 'name', 'body', 'wits', 'spirit', 'presence', 'fatigue', 'harm', 'boons', 'xp', 'skills', 'notes'],
    timer: ['id', 'name', 'segments', 'current'],
    journal: ['id', 'title', 'content', 'tags']
};
export const PAPER_EXAMPLE = `=== Character ===
Name: Rowan
Body: 2
Wits: 3
Spirit: 1
Presence: 2
XP: 32
Skills: Melee=2, Lore=1
Fatigue: 0
Harm: 0
Boons: 1
Notes: Arrived at the old bridge.

=== Timer ===
Name: Patrol returns
Segments: 6
Current: 2

=== Journal ===
Title: Session at the bridge
Content: We promised to return before dawn.
Tags: session, bridge`;

export function parsePaperImport(input) {
    const entries = [], issues = [];
    const issue = (line, code, value = '') => issues.push({ line, code, value });
    if (typeof input !== 'string' || input.length > 50000) return { entries, issues: [{ line: 0, code: 'size', value: '' }] };
    let entry = null, lastKey = null;
    input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').forEach((raw, index) => {
        const line = index + 1;
        const text = raw.normalize('NFKC').trim();
        if (!text || text.startsWith('#')) return;
        const header = text.match(/^={2,}\s*(.*?)\s*={2,}$/);
        if (header) {
            const type = header[1].toLowerCase();
            entry = null; lastKey = null;
            if (!Object.hasOwn(FIELDS, type)) return issue(line, 'section', header[1]);
            entry = { type, line, fields: {} };
            entries.push(entry);
            return;
        }
        if (!entry) return issue(line, 'header', text);
        const pair = text.match(/^([^:]+):\s*(.*)$/);
        if (!pair && ['notes', 'content', 'skills', 'tags'].includes(lastKey)) {
            entry.fields[lastKey] += `${lastKey === 'skills' || lastKey === 'tags' ? ',' : '\n'}${text.replace(/^[-•]\s*/, '')}`;
            return;
        }
        if (!pair) return issue(line, 'field', text);
        const key = pair[1].trim().toLowerCase();
        lastKey = null;
        if (!FIELDS[entry.type].includes(key)) return issue(line, 'field', pair[1]);
        if (Object.hasOwn(entry.fields, key)) return issue(line, 'duplicate', key);
        entry.fields[key] = pair[2];
        lastKey = key;
    });
    const number = (value, key, line, range = NUMBERS[key]) => {
        // Only repair common OCR lookalikes inside numeric fields, and report each change.
        const fixed = value.replace(/[oO]/g, '0').replace(/[Il|]/g, '1');
        if (fixed !== value) issue(line, 'corrected', `${key}: ${value} → ${fixed}`);
        if (!/^\d+$/.test(fixed) || +fixed < range[0] || +fixed > range[1]) {
            issue(line, 'number', `${key}: ${value} (${range.join('–')})`);
            return 0;
        }
        return +fixed;
    };
    for (const item of entries) {
        const f = item.fields, value = {};
        for (const [key, text] of Object.entries(f)) {
            if (key === 'skills') {
                value.skills = {};
                for (const skill of text.split(',').map(s => s.trim()).filter(Boolean)) {
                    const match = skill.match(/^([a-z]+)\s*[=:]\s*(\S+)$/i);
                    const name = match?.[1].toLowerCase();
                    if (!SKILLS.includes(name)) { issue(item.line, 'skill', skill); continue; }
                    if (Object.hasOwn(value.skills, name)) issue(item.line, 'duplicate', name);
                    value.skills[name] = number(match[2], name, item.line, [0, 5]);
                }
            } else if (key === 'tags') value.tags = text.split(',').map(s => s.trim()).filter(Boolean);
            else if (Object.hasOwn(NUMBERS, key)) value[key === 'xp' ? 'totalXp' : key] = number(text, key, item.line);
            else value[key] = text;
        }
        if (!value.name && item.type !== 'journal') issue(item.line, 'required', 'Name');
        if (item.type === 'journal' && (!value.title || !value.content)) issue(item.line, 'required', 'Title, Content');
        if (item.type === 'timer') {
            if (![4, 6, 8, 10].includes(value.segments)) issue(item.line, 'number', 'Segments: 4, 6, 8, 10');
            value.current ??= 0;
            if (value.current > value.segments) issue(item.line, 'number', 'Current > Segments');
        }
        item.value = value;
    }
    if (!entries.length) issue(0, 'empty');
    return { entries, issues };
}

/** Resolve explicit IDs only; never overwrite someone based on a similar name. */
export function planPaperImport(parsed, state, makeId) {
    if (parsed.issues.some(i => i.code !== 'corrected')) throw new Error('Fix the highlighted input before importing.');
    const seen = new Set();
    return parsed.entries.map(({ type, value }) => {
        const collection = { character: 'characters', timer: 'timers', journal: 'wikiEntries' }[type];
        const existing = value.id ? (state[collection] || []).find(e => e.id === value.id) : null;
        if (value.id && !existing) throw new Error(`Unknown ID: ${value.id}`);
        if (type !== 'character' && existing) throw new Error('Timer and journal blocks create new entries; omit ID.');
        const id = existing?.id || makeId();
        if (seen.has(`${collection}:${id}`)) throw new Error(`Repeated ID: ${id}`);
        seen.add(`${collection}:${id}`);
        const next = { ...value, id };
        if (existing && value.skills) next.skills = { ...existing.skills, ...value.skills };
        return {
            type: existing ? 'update_character' : { character: 'add_character', timer: 'add_timer', journal: 'add_wiki_entry' }[type],
            ...(existing ? { path: [id] } : {}),
            value: next
        };
    });
}
