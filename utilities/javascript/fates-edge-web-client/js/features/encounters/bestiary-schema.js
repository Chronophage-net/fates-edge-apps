/** Shared boundary for published bestiaries and older user-authored packs. */
export const BESTIARY_CACHE_KEY = 'fates-edge-bestiary-cache-v2';
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function normalizeBestiaryRecord(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    let entry = { ...raw };
    const keys = Object.keys(entry);
    if (!entry.name && keys.length === 1 && entry[keys[0]] && typeof entry[keys[0]] === 'object') {
        entry = { name: keys[0], ...entry[keys[0]] };
    }
    entry.name = entry.name || entry.title;
    if (typeof entry.name !== 'string' || !entry.name.trim()) return null;
    entry.description = entry.description || entry.summary || entry.lore || '';
    // Spirit Class is taxonomy, not difficulty. Never infer TL from Class or Tier.
    const rating = entry.tl ?? entry.threat_level ?? entry.threatLevel ?? entry['Threat Level'];
    const value = String(rating ?? '').trim().toUpperCase().replace(/^(?:TL|THREAT LEVEL)\s*:?\s*/, '');
    const tl = /^\d+$/.test(value) ? Number(value) : ROMAN.indexOf(value) + 1;
    entry.tl = tl >= 1 && tl <= 10 ? tl : null;
    return entry;
}

export function parseBestiary(payload) {
    const entries = Array.isArray(payload) ? payload : payload?.data;
    return Array.isArray(entries) ? entries.map(normalizeBestiaryRecord).filter(Boolean) : [];
}
