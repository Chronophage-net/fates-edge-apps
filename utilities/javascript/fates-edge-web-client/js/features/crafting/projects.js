import { getCraftState, getCraftedItems, getAttunedItems, availableXp, FLAWS, addToCraftingLog, canForage, recordForageAttempt, upkeepCostFor, intensiveUpkeepCostFor, itemRequiresUpkeep } from './state.js';

export const TIERS = { minor: 2, major: 4, prestige: 6, epic: 8 };
export const KINDS = { provision: 'Provision', work: 'Work', wonder: 'Wonder', repair: 'Flaw repair' };
export const projectsFor = char => (getCraftState(char).projects ||= []);
const integer = (value, min, max, fallback) => Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;
const text = (value, max) => String(value || '').trim().slice(0, max);

export function createProject(char, input, id) {
    if (typeof id !== 'string' || !id.trim()) throw new Error('A project needs a unique identifier.');
    if (!Object.hasOwn(KINDS, input.kind)) throw new Error('Choose a project kind.');
    const name = text(input.name, 100);
    if (!name) throw new Error('Give the project a name.');
    if (projectsFor(char).some(p => p.id === id)) throw new Error('That project already exists.');
    const kind = input.kind;
    const tier = Object.hasOwn(TIERS, input.tier) ? input.tier : 'minor';
    const timers = kind === 'wonder' ? [6, 8, 10] : [4, 6];
    const target = kind === 'repair' ? getCraftedItems(char).find(i => i.id === input.targetId) : null;
    if (kind === 'repair' && (!target || !target.flaws?.some(f => f.id === input.flawId))) throw new Error('Choose an existing item and Flaw to repair.');
    if (kind === 'repair' && projectsFor(char).some(p => p.status !== 'complete' && p.targetId === target.id && p.flawId === input.flawId)) throw new Error('A repair for that Flaw is already on the bench.');
    const project = { id, name, kind, tier, effect: text(input.effect, 2000), materials: text(input.materials, 1000),
        timer: kind === 'provision' ? 0 : kind === 'repair' ? 4 : timers.includes(Number(input.timer)) ? Number(input.timer) : timers[0],
        dv: kind === 'repair' ? 4 : integer(input.dv, 2, 10, 3), progress: 0, flaws: [], status: 'active',
        cost: kind === 'wonder' ? TIERS[tier] : 0, obligation: kind === 'wonder' ? TIERS[tier] / 2 : 0,
        skill: kind === 'wonder' || target?.kind === 'wonder' ? 'arcana' : 'craft',
        targetId: target?.id, flawId: target ? input.flawId : undefined, createdAt: Date.now() };
    projectsFor(char).unshift(project);
    return project;
}

function finishProgress(project, segments) {
    project.progress = Math.min(project.timer, project.progress + segments);
    if (project.kind === 'provision' || project.progress >= project.timer) project.status = 'ready';
}

// Every call represents one declared action/scene, not a unit of elapsed real time.
export function resolveProjectRoll(char, project, result, approach = {}) {
    if (project.status !== 'active' || project.pendingPartial) throw new Error('Resolve the current result before rolling again.');
    if (!Number.isInteger(result.successes) || result.successes < 0 || !Number.isInteger(result.storyBeats) || result.storyBeats < 0) throw new Error('Enter non-negative whole-number results.');
    const outcome = result.successes >= project.dv ? 'success' : result.successes > 0 ? 'partial' : 'miss';
    const boons = outcome === 'partial' ? 1 : outcome === 'miss' ? 2 : 0;
    char.boons = Math.min(5, (char.boons || 0) + boons);
    project.lastRoll = { ...result, ...approach, outcome, boons, timestamp: Date.now() };
    if (outcome === 'success') finishProgress(project, 2);
    if (outcome === 'partial') project.pendingPartial = true;
    addToCraftingLog(char, { name: `${project.name}: ${outcome}; ${result.successes} successes, ${result.storyBeats} SB to bank`, quality: outcome, icon: '🔨' });
    return outcome;
}

export function choosePartial(char, project, choice, flawId) {
    if (!project.pendingPartial || project.status !== 'active') throw new Error('There is no partial result awaiting a choice.');
    if (!['clean', 'flaw'].includes(choice)) throw new Error('Choose careful progress or a named Flaw.');
    if (choice === 'flaw') {
        const flaw = FLAWS.find(f => f.id === flawId && !project.flaws.some(existing => existing.id === f.id));
        if (!flaw) throw new Error('Choose a Flaw the piece does not already have.');
        project.flaws.push({ ...flaw });
        finishProgress(project, 2);
    } else if (project.kind !== 'provision') finishProgress(project, 1);
    project.pendingPartial = false;
    addToCraftingLog(char, { name: `${project.name}: ${choice === 'flaw' ? 'accepted a Flaw' : project.kind === 'provision' ? 'retry in a later scene' : '1 clean segment'}`, quality: 'partial', icon: '🔨' });
}

export function completeProject(char, project) {
    if (project.status !== 'ready') throw new Error('This project is not ready to finish.');
    if (availableXp(char) < project.cost) throw new Error(`Keep the finished work on the bench until you have ${project.cost} XP.`);
    if (project.kind === 'repair') {
        const target = getCraftedItems(char).find(i => i.id === project.targetId);
        if (!target) throw new Error('The item being repaired is no longer in your collection.');
        target.flaws = (target.flaws || []).filter(f => f.id !== project.flawId);
        target.flaws.push(...project.flaws.filter(f => !target.flaws.some(existing => existing.id === f.id)));
        target.quality = target.flaws.length ? 'flawed' : 'standard';
    } else {
        getCraftedItems(char).push({ id: `item-${project.id}`, projectId: project.id, name: project.name, effect: project.effect, kind: project.kind,
            category: project.kind === 'wonder' ? 'magic_item' : project.kind === 'provision' ? 'consumable' : 'mundane',
            cost: project.cost, tier: project.tier, flaws: project.flaws.map(f => ({ ...f })), quality: project.flaws.length ? 'flawed' : 'standard',
            uses: project.kind === 'provision' ? 1 : null, createdAt: Date.now() });
    }
    char.xpSpent = (char.xpSpent || 0) + project.cost;
    char.obligation = (char.obligation || 0) + project.obligation;
    project.status = 'complete'; project.completedAt = Date.now();
    addToCraftingLog(char, { name: `${project.name}: finished (${project.cost} XP, ${project.obligation} Obligation)`, quality: 'standard', icon: '✓' });
}

export function resolveGathering(char, project, result, dv) {
    if (!canForage(char)) throw new Error('You have already gathered this downtime.');
    if (project.status !== 'active' || project.gathered) throw new Error('Choose an active project without gathered materials.');
    if (![2, 3, 4, 5].includes(dv)) throw new Error('Choose a gathering difficulty.');
    recordForageAttempt(char);
    project.gathered = result.successes >= dv;
    const outcome = project.gathered ? 'success' : result.successes > 0 ? 'partial' : 'miss';
    char.boons = Math.min(5, (char.boons || 0) + (outcome === 'partial' ? 1 : outcome === 'miss' ? 2 : 0));
    project.lastGathering = { ...result, outcome };
    addToCraftingLog(char, { name: `Gather for ${project.name}: ${outcome}; ${result.storyBeats} SB to bank`, quality: outcome, icon: '🌿' });
    return project.gathered;
}

export function toggleOwnedAttunement(char, itemId) {
    const item = getCraftedItems(char).find(i => i.id === itemId && i.kind === 'wonder');
    if (!item) throw new Error('Only a finished Wonder can be attuned here.');
    const attuned = getAttunedItems(char);
    const index = attuned.findIndex(i => i.id === itemId);
    if (index >= 0) {
        // Keep condition and paid upkeep on release; reattuning is not a free repair.
        item.attunementState = { ...attuned[index] };
        attuned.splice(index, 1);
    } else {
        if (attuned.length >= 3) throw new Error('Release one of your three attuned items first.');
        attuned.push({ id: item.id, name: item.name, cost: item.cost, tier: item.tier, category: 'magic_item', condition: 'maintained', paidUpkeepThisDowntime: false, ...item.attunementState });
    }
}

export function payItemUpkeep(char, itemId, mode) {
    const item = getAttunedItems(char).find(i => String(i.id) === String(itemId));
    if (!item) throw new Error('Item not found.');
    if (!itemRequiresUpkeep(item) || item.paidUpkeepThisDowntime) throw new Error('No upkeep is due for this item.');
    if (item.condition === 'compromised') throw new Error('A Compromised enchantment requires a restoration quest, not upkeep.');
    const cost = mode === 'efficient' ? upkeepCostFor(item) : intensiveUpkeepCostFor(item);
    if (availableXp(char) < cost) throw new Error(`Not enough XP. Upkeep needs ${cost} XP.`);
    char.xpSpent = (char.xpSpent || 0) + cost;
    item.condition = 'maintained'; item.paidUpkeepThisDowntime = true;
    return cost;
}
