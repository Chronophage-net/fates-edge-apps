import { describe, it, assertEqual, assertTrue } from '../runner.js';
import { parsePaperImport, planPaperImport, PAPER_EXAMPLE } from '../../js/core/paper-import.js';

function rejects(fn) { let failed = false; try { fn(); } catch { failed = true; } assertTrue(failed); }
describe('Paper import', () => {
    it('converts the documented example into existing operation types', () => {
        const parsed = parsePaperImport(PAPER_EXAMPLE);
        assertEqual(parsed.issues.length, 0);
        let id = 0;
        const ops = planPaperImport(parsed, {}, () => String(++id));
        assertEqual(ops.map(o => o.type).join(','), 'add_character,add_timer,add_wiki_entry');
        assertEqual(ops[0].value.skills.melee, 2);
        assertEqual(ops[1].value.current, 2);
        assertEqual(ops[2].value.tags.join(','), 'session,bridge');
    });
    it('tolerates line endings, full-width punctuation and numeric OCR while reporting repairs', () => {
        const parsed = parsePaperImport('== CHARACTER ==\r\nName： Rowan\r\nBody: I\r\nFatigue: O');
        assertEqual(parsed.issues.filter(i => i.code === 'corrected').length, 2);
        assertEqual(parsed.entries[0].value.body, 1);
        assertEqual(parsed.entries[0].value.fatigue, 0);
    });
    it('supports multiline lists and preserves notes', () => {
        const parsed = parsePaperImport('=== Character ===\nName: Rowan\nSkills: Melee=2\n- Lore=1\nNotes: First line\nSecond line');
        assertEqual(parsed.issues.length, 0);
        assertEqual(parsed.entries[0].value.skills.lore, 1);
        assertEqual(parsed.entries[0].value.notes, 'First line\nSecond line');
    });
    it('rejects malformed, unknown, duplicate and out-of-range input without a partial import', () => {
        for (const text of ['Name: Lost header', '=== Wrong ===\nName: X', '=== Character ===\nName: X\nBody: 2x', '=== Character ===\nName: X\nName: Y', '=== Character ===\nName: X\n__proto__: bad', '=== Timer ===\nName: Clock\nSegments: 5', '=== Timer ===\nName: Clock\nSegments: 4\nCurrent: 5', '=== Character ===\nName: X\nSkills: Magic=2']) {
            rejects(() => planPaperImport(parsePaperImport(text), {}, () => 'new'));
        }
    });
    it('merges supplied skills and leaves all other existing fields untouched', () => {
        const existing = { id: 'rowan', name: 'Rowan', body: 3, skills: { melee: 2, lore: 1 }, talents: ['gift'] };
        const before = JSON.stringify(existing);
        const parsed = parsePaperImport('=== Character ===\nID: rowan\nName: Rowan\nSkills: Lore=3\nHarm: 0');
        const [op] = planPaperImport(parsed, { characters: [existing] }, () => 'new');
        assertEqual(op.type, 'update_character');
        assertEqual(op.path[0], 'rowan');
        assertEqual(op.value.skills.melee, 2);
        assertEqual(op.value.skills.lore, 3);
        assertTrue(!Object.hasOwn(op.value, 'body'));
        assertEqual(JSON.stringify(existing), before);
    });
    it('does not match by name and rejects unknown or repeated update IDs', () => {
        const state = { characters: [{ id: 'known', name: 'Rowan' }] };
        const parsed = parsePaperImport('=== Character ===\nName: Rowan');
        assertEqual(planPaperImport(parsed, state, () => 'new')[0].type, 'add_character');
        rejects(() => planPaperImport(parsePaperImport('=== Character ===\nName: Rowan\nID: missing'), state, () => 'new'));
        rejects(() => planPaperImport(parsePaperImport('=== Character ===\nName: Rowan\nID: known\n=== Character ===\nName: Rowan\nID: known'), state, () => 'new'));
    });
});
