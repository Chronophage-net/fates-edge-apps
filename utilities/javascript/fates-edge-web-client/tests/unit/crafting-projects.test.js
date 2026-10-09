import { describe, it, assert, assertEqual } from '../runner.js';
import { createProject, resolveProjectRoll, choosePartial, completeProject, resolveGathering, toggleOwnedAttunement, payItemUpkeep } from '../../js/features/crafting/projects.js';
import { canForage, resetForageCount, applyDowntimeTick } from '../../js/features/crafting/state.js';
import { renderWorkshop, renderCollection } from '../../js/features/crafting/workshop.js';
import { readFileSync } from 'node:fs';
const character = () => ({ totalXp: 20, xpSpent: 0, boons: 0, obligation: 0 });
const roll = (successes, storyBeats = 0) => ({ successes, storyBeats, dice: [] });
const project = (char, kind = 'work', extra = {}) => createProject(char, { name: 'Lantern', kind, dv: 3, ...extra }, 'qa');
function rejects(fn) { let threw = false; try { fn(); } catch { threw = true; } assert(threw, 'expected rejection'); }

describe('Crafting project rules', () => {
    it('pays legacy numeric-ID upkeep once and handles intensive cost', () => {
        const char = character(); char.crafting = { attuned: [{ id: 42, cost: 4, condition: 'neglected' }] };
        assertEqual(payItemUpkeep(char, '42', 'intensive'), 1);
        assertEqual(char.xpSpent, 1); assertEqual(char.crafting.attuned[0].condition, 'maintained');
        rejects(() => payItemUpkeep(char, '42', 'efficient')); assertEqual(char.xpSpent, 1);
    });
    it('blocks unaffordable upkeep, artifacts, and Compromised items', () => {
        const char = character(); char.totalXp = 0; char.crafting = { attuned: [{ id: 'x', cost: 4, condition: 'neglected' }] };
        rejects(() => payItemUpkeep(char, 'x', 'intensive')); assertEqual(char.xpSpent, 0);
        char.totalXp = 20; char.crafting.attuned[0].condition = 'compromised';
        rejects(() => payItemUpkeep(char, 'x', 'efficient'));
        char.crafting.attuned[0].condition = 'maintained'; char.crafting.attuned[0].category = 'artifact';
        rejects(() => payItemUpkeep(char, 'x', 'efficient')); assertEqual(char.xpSpent, 0);
    });
    it('keeps materials and existing items unchanged when starting', () => {
        const char = character(); char.crafting = { ingredients: ['Silver'], crafted: [{ id: 'old' }] };
        project(char); assertEqual(char.crafting.ingredients[0], 'Silver'); assertEqual(char.crafting.crafted[0].id, 'old');
    });
    it('validates project kind, name, timer and tier', () => {
        const char = character(); rejects(() => project(char, 'artifact')); rejects(() => project(char, 'work', { name: ' ' }));
        rejects(() => createProject(char, { name: 'Missing ID', kind: 'work' }, ''));
        rejects(() => project(char, 'constructor'));
        const p = project(char, 'wonder', { timer: 1, tier: 'constructor' });
        assertEqual(p.timer, 6); assertEqual(p.cost, 2); assertEqual(p.skill, 'arcana');
        rejects(() => project(char));
    });
    it('finishes a single-use Provision without XP or Obligation', () => {
        const char = character(), p = project(char, 'provision');
        resolveProjectRoll(char, p, roll(3)); completeProject(char, p);
        assertEqual(char.crafting.crafted[0].uses, 1); assertEqual(char.xpSpent, 0); assertEqual(char.obligation, 0);
        rejects(() => completeProject(char, p)); assertEqual(char.crafting.crafted.length, 1);
    });
    it('a Provision partial can wait for a later scene without phantom progress', () => {
        const char = character(), p = project(char, 'provision');
        resolveProjectRoll(char, p, roll(1)); choosePartial(char, p, 'clean');
        assertEqual(p.status, 'active'); assertEqual(p.progress, 0); assertEqual(char.boons, 1);
    });
    it('a Provision partial can produce a genuinely flawed item', () => {
        const char = character(), p = project(char, 'provision');
        resolveProjectRoll(char, p, roll(1)); choosePartial(char, p, 'flaw', 'loud'); completeProject(char, p);
        assertEqual(char.crafting.crafted[0].flaws[0].id, 'loud');
    });
    it('blocks rerolls until a partial is resolved and awards its Boon once', () => {
        const char = character(), p = project(char);
        resolveProjectRoll(char, p, roll(1)); rejects(() => resolveProjectRoll(char, p, roll(3)));
        rejects(() => choosePartial(char, p, 'flaw', 'invented'));
        choosePartial(char, p, 'clean'); rejects(() => choosePartial(char, p, 'clean'));
        assertEqual(char.boons, 1); assertEqual(p.progress, 1);
    });
    it('preserves partial choice and progress through JSON reload', () => {
        const char = character(), p = project(char); resolveProjectRoll(char, p, roll(1));
        const restored = JSON.parse(JSON.stringify(char)); choosePartial(restored, restored.crafting.projects[0], 'flaw', 'marked');
        assertEqual(restored.crafting.projects[0].progress, 2); assertEqual(restored.boons, 1);
    });
    it('a later success does not remove earlier Flaws', () => {
        const char = character(), p = project(char);
        resolveProjectRoll(char, p, roll(1)); choosePartial(char, p, 'flaw', 'brittle');
        resolveProjectRoll(char, p, roll(3, 2)); completeProject(char, p);
        assertEqual(char.crafting.crafted[0].flaws[0].id, 'brittle'); assertEqual(p.lastRoll.storyBeats, 2);
        assertEqual(char.crafting.crafted[0].uses, null);
    });
    it('a miss has no progress and Boons respect the cap', () => {
        const char = character(); char.boons = 4; const p = project(char);
        resolveProjectRoll(char, p, roll(0, 1)); assertEqual(char.boons, 5); assertEqual(p.progress, 0);
    });
    it('rejects invalid table totals', () => {
        const char = character(), p = project(char);
        rejects(() => resolveProjectRoll(char, p, roll(-1))); rejects(() => resolveProjectRoll(char, p, roll(1.5)));
        assertEqual(p.progress, 0);
    });
    it('charges Wonder XP and Obligation exactly once, only at completion', () => {
        const char = character(), p = project(char, 'wonder', { tier: 'major' });
        for (let i = 0; i < 3; i++) resolveProjectRoll(char, p, roll(3));
        assertEqual(char.xpSpent, 0); completeProject(char, p); rejects(() => completeProject(char, p));
        assertEqual(char.xpSpent, 4); assertEqual(char.obligation, 2); assertEqual(char.crafting.crafted.length, 1);
    });
    it('keeps a ready Wonder safely pending if XP is insufficient', () => {
        const char = character(); char.totalXp = 0; const p = project(char, 'wonder');
        for (let i = 0; i < 3; i++) resolveProjectRoll(char, p, roll(3));
        rejects(() => completeProject(char, p)); assertEqual(p.status, 'ready'); assertEqual(p.progress, 6);
        char.totalXp = 2; completeProject(char, p); assertEqual(char.obligation, 1);
    });
    it('gathering is once per downtime and benefits only the declared project', () => {
        const char = character(), p = project(char);
        const other = createProject(char, { name: 'Other', kind: 'work' }, 'other');
        resolveGathering(char, p, roll(3), 3); assert(p.gathered); assert(!other.gathered); assert(!canForage(char));
        rejects(() => resolveGathering(char, other, roll(3), 3)); resetForageCount(char); assert(canForage(char));
    });
    it('unsuccessful gathering still consumes its attempt and grants Boons', () => {
        const char = character(), p = project(char); resolveGathering(char, p, roll(0), 2);
        assert(!p.gathered); assertEqual(char.boons, 2); assert(!canForage(char));
    });
    it('attunement respects cap and release does not cure neglect', () => {
        const char = character(), p = project(char, 'wonder');
        for (let i = 0; i < 3; i++) resolveProjectRoll(char, p, roll(3)); completeProject(char, p);
        const id = char.crafting.crafted[0].id; toggleOwnedAttunement(char, id);
        applyDowntimeTick(char.crafting.attuned); toggleOwnedAttunement(char, id); toggleOwnedAttunement(char, id);
        assertEqual(char.crafting.attuned[0].condition, 'neglected');
        toggleOwnedAttunement(char, id); char.crafting.attuned = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        rejects(() => toggleOwnedAttunement(char, id));
    });
    it('repairs a named Flaw with a distinct DV4 Timer4 project', () => {
        const char = character(), p = project(char);
        resolveProjectRoll(char, p, roll(1)); choosePartial(char, p, 'flaw', 'loud'); resolveProjectRoll(char, p, roll(3)); completeProject(char, p);
        const item = char.crafting.crafted[0]; const input = { name: 'Repair', kind: 'repair', targetId: item.id, flawId: 'loud' };
        const repair = createProject(char, input, 'repair'); rejects(() => createProject(char, input, 'duplicate'));
        assertEqual(repair.dv, 4); resolveProjectRoll(char, repair, roll(4)); resolveProjectRoll(char, repair, roll(4)); completeProject(char, repair);
        assertEqual(item.flaws.length, 0); assertEqual(char.xpSpent, 0);
    });
});

describe('Crafting workshop and documentation', () => {
    it('uses the numeric-length ID API for both creation paths', () => {
        const source = readFileSync(new URL('../../js/features/crafting/index.js', import.meta.url), 'utf8');
        assertEqual((source.match(/generateId\(20\)/g) || []).length, 2);
        assert(!source.includes("generateId('project_')"));
    });
    it('shelved projects leave the active bench without losing their data', () => {
        const char = character(), p = project(char); p.shelved = true; p.progress = 2;
        const html = renderWorkshop(char, {}, {});
        assert(html.includes('Shelved projects · 1')); assert(html.includes('Return to bench'));
        assert(!html.includes('class="bench-project"')); assertEqual(p.progress, 2);
    });
    it('escapes project names, effects, materials and imported item IDs', () => {
        const char = character(); const p = project(char, 'work', { name: '<img onerror="bad">', materials: '<script>x</script>' });
        const html = renderWorkshop(char, {}, {}); assert(!html.includes('<img')); assert(html.includes('&lt;img')); assert(!html.includes('<script>'));
        char.crafting.crafted = [{ id: '" onclick="bad', name: 'Legacy', effect: '<img>' }];
        assert(renderCollection(char).includes('data-item="&quot; onclick=&quot;bad"'));
        assert(p.status === 'active');
    });
    it('has accessible labels, native progress, and no old shopping or batch controls', () => {
        const char = character(); project(char); const html = renderWorkshop(char, {}, {});
        assert(html.includes('<label')); assert(html.includes('<progress')); assert(html.includes('Record table roll'));
        assert(!html.includes('craft-buy-btn')); assert(!html.includes('craft-batch-qty'));
    });
    it('the Player, GM and both SRD references carry the same procedure', () => {
        const paths = ['players-guide/Players-_-Guide-_-11-_-Downtime.html','gm-guide/GM-_-Guide-_-09-_-Downtime.html','srd/crafting.html','srd/complete.html'];
        const blocks = paths.map(path => {
            const html = readFileSync(new URL('../../data/docs/' + path, import.meta.url),'utf8');
            const start = html.indexOf('<div class="panel panel-gold" data-crafting-rules="project-bench-v1">');
            assert(start >= 0); return html.slice(start, html.indexOf('</div>', start));
        });
        for (const block of blocks) assertEqual(block, blocks[0]);
    });
});
