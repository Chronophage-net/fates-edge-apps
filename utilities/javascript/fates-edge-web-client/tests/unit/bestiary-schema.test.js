import { readFileSync } from 'node:fs';
import { describe, it, assertEqual, assertTrue, assertDeepEqual } from '../runner.js';
import { parseBestiary, normalizeBestiaryRecord } from '../../js/features/encounters/bestiary-schema.js';

describe('Published bestiary parsing', () => {
    it('loads every shipped creature from the licensed data envelope, across TL 1–10', () => {
        const payload = JSON.parse(readFileSync(new URL('../../data/bestiary.json', import.meta.url), 'utf8'));
        const entries = parseBestiary(payload);
        assertEqual(entries.length, payload.data.length);
        assertTrue(entries.length > 250);
        assertDeepEqual([...new Set(entries.map(e => e.tl))].sort((a,b) => a-b), [1,2,3,4,5,6,7,8,9,10]);
        assertEqual(entries.find(e => e.name === 'Dragon (High Wyrm)').tl, 8);
        assertTrue(entries.every(e => typeof e.name === 'string' && Array.isArray(e.sb_spends)));
    });
    it('keeps bare arrays and wrapped legacy records readable without losing moves', () => {
        const move = { cost: 0, name: 'Watch', effect: 'Remain still.' };
        const entries = parseBestiary([{ Watcher: { 'Threat Level': 'IV', sb_spends: [move], summary: 'Waiting.' } }]);
        assertEqual(entries[0].tl, 4);
        assertDeepEqual(entries[0].sb_spends, [move]);
        assertEqual(entries[0].description, 'Waiting.');
    });
    it('keeps spirit taxonomy distinct from Threat Level', () => {
        assertEqual(normalizeBestiaryRecord({ name: 'Echo', class: 'I', tl: 3 }).tl, 3);
        assertEqual(normalizeBestiaryRecord({ name: 'Echo', class: 'II', tier: 'IV' }).tl, null);
    });
    it('handles explicit rating aliases and rejects invalid ratings and metadata', () => {
        for (const key of ['tl', 'threatLevel', 'threat_level', 'Threat Level']) {
            assertEqual(normalizeBestiaryRecord({ name: 'Giant', [key]: 'TL 7' }).tl, 7);
        }
        assertDeepEqual(parseBestiary({ _license: 'notice' }), []);
        assertDeepEqual(parseBestiary([null, 'invalid', { tl: 3 }]), []);
        assertEqual(normalizeBestiaryRecord({ name: 'Unknown', tl: 'garbage' }).tl, null);
    });
});

describe('Bestiary loader integration', () => {
    it('uses the published envelope on the first fetch and really reloads on Refresh', async () => {
        const { loadBestiaryData } = await import('../../js/features/encounters/bestiary.js');
        const { BESTIARY_CACHE_KEY } = await import('../../js/features/encounters/bestiary-schema.js');
        const payload = JSON.parse(readFileSync(new URL('../../data/bestiary.json', import.meta.url), 'utf8'));
        const previousFetch = globalThis.fetch;
        const previousCache = sessionStorage.getItem(BESTIARY_CACHE_KEY);
        let calls = 0;
        globalThis.fetch = async () => { calls++; return { ok: true, json: async () => payload }; };
        try {
            assertEqual((await loadBestiaryData({ refresh: true })).length, 257);
            assertEqual(calls, 1);
            assertEqual((await loadBestiaryData()).length, 257);
            assertEqual(calls, 1);
            assertEqual((await loadBestiaryData({ refresh: true })).length, 257);
            assertEqual(calls, 2);
        } finally {
            globalThis.fetch = previousFetch;
            if (previousCache === null) sessionStorage.removeItem(BESTIARY_CACHE_KEY);
            else sessionStorage.setItem(BESTIARY_CACHE_KEY, previousCache);
        }
    });
});
