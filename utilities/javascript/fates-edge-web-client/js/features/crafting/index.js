/** Crafting: project-based bench, collection, and Codex. Rules live in both Downtime guides. */
import { renderWorkshop, renderCollection } from './workshop.js';
import { projectsFor, createProject, resolveProjectRoll, choosePartial, completeProject, resolveGathering, toggleOwnedAttunement, payItemUpkeep } from './projects.js';
import { t as i18nText } from '@core/i18n.js';
import { vttStore } from '@core/vtt-store.js';
import { getState, getCharacter, updateCharacter } from '@core/state.js';
import { generateId } from '@core/utils.js';
import { showToast } from '@components/Toast.js';
import { performRoll } from '@core/dice.js';

import {
    ensureWikiLoaded, parseRecipesFromWiki, parseCodexFromWiki
} from './data.js';

import {
    getCraftedItems, getAttunedItems, availableXp,
    ATTUNEMENT_LIMIT, upkeepCostFor, intensiveUpkeepCostFor, canAttune,
    DECAY_ORDER, advanceDecay, itemRequiresUpkeep, applyDowntimeTick,
    FLAWS, flawById, wonderObligationFor,
    FORAGE_LIMIT_PER_DOWNTIME, getForageCount, canForage, recordForageAttempt, resetForageCount
} from './state.js';

import {
    renderRoot, renderCodexTab, renderNoCharacterView
} from './render.js';

// Re-exported for tests (tests/unit/crafting.test.js,
// tests/integration/downtime-tick-integration.test.js) and any other
// module that previously imported these directly from
// 'js/features/crafting/index.js' before this file was split up.
export {
    ATTUNEMENT_LIMIT, upkeepCostFor, intensiveUpkeepCostFor, canAttune,
    DECAY_ORDER, advanceDecay, itemRequiresUpkeep, applyDowntimeTick,
    FLAWS, flawById, wonderObligationFor,
    FORAGE_LIMIT_PER_DOWNTIME, getForageCount, canForage, recordForageAttempt, resetForageCount
};

// ============================================================
// STATE (module-local UI state — not persisted)
// ============================================================

let container = null;
let lastCharId = null;

const uiState = {
    codexTierFilter: 'all',
    codexCategoryFilter: 'magic_item',
    activeTab: 'crafting',
    projectDraft: {}
};

// Parsed wiki data, rebuilt each render() and read by the delegated event
// handlers. These used to be re-parsed from scratch inside the click handler
// on EVERY click, which is both wasteful and unnecessary: render() has
// already done exactly this work, and a click cannot change wiki.json.
let recipeMap = {};
let codexMap = {};

function resetUiStateIfCharChanged(char) {
    if (lastCharId !== char.id) {
        uiState.projectDraft = {};
        lastCharId = char.id;
    }
}

// ============================================================
// CHARACTER HELPERS
// ============================================================

function getCharacterData(options = {}) {
    const { silent = false } = options;
    const id = vttStore.getSelectedCharacterId();
    if (!id) {
        if (!silent) showToast(i18nText("feature.crafting.selectACharacterFirst", null, "Select a character first."), 'error');
        return null;
    }
    const char = getCharacter(id);
    if (!char) {
        if (!silent) showToast(i18nText("feature.crafting.characterNotFound", null, "Character not found."), 'error');
        return null;
    }
    return char;
}

function saveCharacter(updates) {
    const id = vttStore.getSelectedCharacterId();
    if (!id) return false;
    return !!updateCharacter(id, updates);
}

async function refreshPanel() {
    if (container) await render(container);
}

// ============================================================
// RENDER – ROOT
// ============================================================

export async function render(el) {
    container = el;
    if (!container) return;

    const char = getCharacterData({ silent: true });
    if (!char) {
        container.innerHTML = renderNoCharacterView(getState().characters || []);
        attachNoCharacterEvents();
        return;
    }

    resetUiStateIfCharChanged(char);
    await ensureWikiLoaded();

    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    recipeMap = parseRecipesFromWiki(wikiEntries);
    codexMap = parseCodexFromWiki(wikiEntries);

    const tabContent = uiState.activeTab === 'crafting'
        ? renderWorkshop(char, recipeMap, uiState)
        : uiState.activeTab === 'collection' ? renderCollection(char)
        : renderCodexTab(char, codexMap, uiState);

    container.innerHTML = renderRoot(char, tabContent, uiState);

    attachEvents();
}

function attachNoCharacterEvents() {
    const select = document.getElementById('crafting-char-select');
    if (select) {
        select.addEventListener('change', () => {
            const id = select.value;
            if (!id) return;
            vttStore.updateCharacters(getState().characters || []);
            vttStore.selectCharacter(id);
            refreshPanel();
        });
    }
    const goBtn = document.getElementById('craft-go-to-vtt-btn');
    if (goBtn) goBtn.addEventListener('click', () => { window.location.hash = 'vtt'; });
}

// ============================================================
// ACTIONS
// ============================================================

function useCraftedItem(char, itemId) {
    const item = getCraftedItems(char).find(i => String(i.id) === String(itemId));
    if (!item || ['work', 'wonder'].includes(item.kind)) return;
    item.uses = (item.uses || 1) - 1;
    if (item.uses <= 0) char.crafting.crafted = getCraftedItems(char).filter(i => String(i.id) !== String(itemId));
    saveCharacter({ crafting: char.crafting });
    showToast('Used ' + item.name + '. Apply its effect and any Flaws at the table.', 'success');
    refreshPanel();
}

// ─── Codex actions ─────────────────────────────────────────────

function toggleAttune(char, codex, entryId) {
    const entry = codex.find(e => String(e.id) === String(entryId));
    if (!entry) return showToast(i18nText("feature.crafting.itemNotFoundInTheCodex", null, "Item not found in the Codex."), 'error');
    const attuned = getAttunedItems(char);
    const idx = attuned.findIndex(a => String(a.id) === String(entryId));
    if (idx !== -1) {
        (char.crafting.releasedItems ||= {})[entryId] = { ...attuned[idx] };
        attuned.splice(idx, 1);
        showToast(i18nText("feature.crafting.brokeAttunementWithValue", { value0: entry.title }, "Broke attunement with {{value0}}."), 'info');
    } else {
        if (!canAttune(attuned, entry.id)) return showToast(i18nText("feature.crafting.alreadyAttunedToValueItemsBreakOne", { value0: ATTUNEMENT_LIMIT }, "Already attuned to {{value0}} items — break one first."), 'warning');
        attuned.push({ id: entry.id, name: entry.title, cost: entry.cost, tier: entry.tier, icon: entry.icon, category: entry.category, condition: 'maintained', paidUpkeepThisDowntime: false, attunedAt: Date.now(), ...char.crafting.releasedItems?.[entryId] });
        showToast(i18nText("feature.crafting.attunedToValue", { value0: entry.title }, "🔗 Attuned to {{value0}}."), 'success');
    }
    saveCharacter({ crafting: char.crafting });
    refreshPanel();
}

function payUpkeep(char, itemId, mode) {
    try {
        const cost = payItemUpkeep(char, itemId, mode);
        saveCharacter({ xpSpent: char.xpSpent, crafting: char.crafting });
        showToast('Upkeep paid: ' + cost + ' XP' + (mode === 'intensive' ? ' and a downtime scene.' : '.'), 'success');
        refreshPanel();
    } catch (error) { showToast(error.message, 'error'); }
}

// Compromised items require a quest, not upkeep, to fix (items.tex).
// This app has no quest-tracking of its own, so this is a deliberate,
// explicit GM/player action to record that the quest happened —
// distinct from payUpkeep(), which is blocked for compromised items.
function restoreCompromisedItem(char, itemId) {
    const attuned = getAttunedItems(char);
    const item = attuned.find(a => String(a.id) === String(itemId));
    if (!item) return showToast(i18nText("feature.crafting.itemNotFound", null, "Item not found."), 'error');
    if (item.condition !== 'compromised') return showToast(i18nText("feature.crafting.valueIsnTCompromised", { value0: item.name }, "{{value0}} isn't Compromised."), 'info');
    item.condition = 'maintained';
    item.paidUpkeepThisDowntime = true;
    saveCharacter({ crafting: char.crafting });
    showToast(i18nText("feature.crafting.valueRestoredAfterAQuestToFix", { value0: item.name }, "✨ {{value0}} restored after a quest to fix it."), 'success');
    refreshPanel();
}

function retireItem(char, itemId) {
    const item = getAttunedItems(char).find(i => String(i.id) === String(itemId));
    if (!item) return;
    const owned = getCraftedItems(char).find(i => String(i.id) === String(itemId));
    if (owned) owned.attunementState = { ...item };
    else (char.crafting.releasedItems ||= {})[itemId] = { ...item };
    char.crafting.attuned = getAttunedItems(char).filter(i => String(i.id) !== String(itemId));
    saveCharacter({ crafting: char.crafting });
    showToast('Attunement released after a quiet scene. No XP refunded.', 'info');
    refreshPanel();
}

// ─── Downtime tick (decay + forage reset) ─────────────────────────
//
// Listens for the 'downtime-tick' event dispatched by
// js/features/factions/index.js's "GM Downtime (Faction Turn)" button.
// Applies to every character's attuned items and forage count, not just
// whichever character is currently selected in this panel — downtime
// passes for the whole party at once. Registered once at module load
// (not inside render()) so it fires regardless of which panel is on
// screen.
function handleDowntimeTick() {
    const characters = getState().characters || [];
    let anyDecay = false;
    for (const char of characters) {
        const attuned = getAttunedItems(char);
        const before = attuned.map(a => a.condition);
        if (attuned.length > 0) applyDowntimeTick(attuned);
        if (attuned.some((a, i) => a.condition !== before[i])) anyDecay = true;

        // Always reset — every character gets a fresh forage allowance
        // each downtime regardless of whether they have attuned items.
        resetForageCount(char);
        for (const item of getCraftedItems(char)) {
            if (item.attunementState) item.attunementState.paidUpkeepThisDowntime = false;
        }
        for (const item of Object.values(char.crafting.releasedItems || {})) item.paidUpkeepThisDowntime = false;
        updateCharacter(char.id, { crafting: char.crafting });
    }
    if (anyDecay) {
        showToast(i18nText("feature.crafting.downtimePassedSomeAttunedItemsDecayedUnpaid", null, "🕯️ Downtime passed — some attuned items decayed (unpaid upkeep). Forage attempts have reset."), 'warning');
    } else {
        showToast(i18nText("feature.crafting.downtimePassedForageAttemptsHaveReset", null, "🕯️ Downtime passed — forage attempts have reset."), 'info');
    }
    refreshPanel();
}

if (typeof document !== 'undefined') {
    document.addEventListener('downtime-tick', handleDowntimeTick);
}

// ============================================================
// EVENTS
// ============================================================

// The delegated listeners below are bound to `container`, which render()
// does NOT replace — it only overwrites container.innerHTML. Binding them on
// every render therefore ACCUMULATED handlers: one set after the first
// render, two after the first refresh, four after the next, and so on. Each
// duplicate re-ran the whole handler, and handlers call refreshPanel(), which
// re-bound again — so a couple of clicks (expand a recipe, collapse it) was
// enough to multiply the listener count into the hundreds and lock the page
// up. Worse, the toggle handler firing an even number of times cancelled
// itself out, so the card appeared not to respond at all.
//
// Fix: bind exactly once per container element, tracked by a flag on the
// element itself (so a genuinely new container in a later mount rebinds).
// Because the handlers now outlive any single render, none of them may close
// over a `char` captured at bind time — each reads the currently selected
// character itself via currentChar().
const BOUND_FLAG = '__fateseCraftingEventsBound';

function currentChar() {
    return getCharacterData({ silent: true });
}

function persistBench(char) {
    saveCharacter({ crafting: char.crafting, xpSpent: char.xpSpent || 0, obligation: char.obligation || 0, boons: char.boons || 0 });
    refreshPanel();
}

function attachEvents() {
    if (!container) return;
    const refreshBtn = document.getElementById('craft-refresh-btn');
    refreshBtn?.addEventListener('click', async () => { await ensureWikiLoaded(true); await refreshPanel(); });
    if (container[BOUND_FLAG]) return;
    container[BOUND_FLAG] = true;

    container.addEventListener('input', e => {
        if (e.target.closest('#bench-create')) uiState.projectDraft = Object.fromEntries(new FormData(e.target.closest('form')));
    });
    container.addEventListener('change', e => {
        if (e.target.matches('#bench-create [name="kind"]')) {
            uiState.projectDraft = Object.fromEntries(new FormData(e.target.closest('form')));
            refreshPanel();
        }
        if (e.target.id === 'codex-tier-filter') { uiState.codexTierFilter = e.target.value; refreshPanel(); }
    });
    container.addEventListener('submit', e => {
        const form = e.target;
        if (!form.matches('#bench-create, .bench-roll, .bench-gather-form, .bench-notes')) return;
        e.preventDefault();
        const char = currentChar(); if (!char) return;
        const data = Object.fromEntries(new FormData(form));
        try {
            if (form.id === 'bench-create') {
                createProject(char, data, `project_${generateId(20)}`);
                uiState.projectDraft = {};
                showToast('Project started. Agree each bench action with your GM.', 'success');
            } else {
                const project = projectsFor(char).find(p => p.id === form.closest('[data-project]').dataset.project);
                if (!project) return;
                if (form.matches('.bench-notes')) {
                    project.materials = String(data.materials || '').trim().slice(0, 1000);
                    showToast('Project notes saved.', 'success');
                } else if (form.matches('.bench-gather-form')) {
                    if (!canForage(char)) throw new Error('Already gathered this downtime.');
                    const result = performRoll(Number(char.wits) || 1, Number(char.skills?.[data.skill]) || 0, Number(data.dv), data.position);
                    const success = resolveGathering(char, project, result, Number(data.dv));
                    showToast((success ? 'Right materials secured.' : 'No gathering advantage; agree the consequence with your GM.') + ' ' + result.storyBeats + ' SB to bank.', success ? 'success' : 'info');
                } else {
                    const bonus = Number(data.bonus);
                    const attr = Number(char[data.attribute]) || 1;
                    const skill = Number(char.skills?.[project.skill]) || 0;
                    if (attr + skill + bonus < 1) throw new Error('The adjusted pool must contain at least one die.');
                    const result = e.submitter?.name === 'manual'
                        ? { successes: Number(data.successes), storyBeats: Number(data.storyBeats), dice: [] }
                        : performRoll(attr + bonus, skill, project.dv, data.position);
                    resolveProjectRoll(char, project, result, { attribute: data.attribute, position: data.position });
                }
            }
            persistBench(char);
        } catch (error) { showToast(error.message, 'error'); }
    });
    container.addEventListener('click', e => {
        const tab = e.target.closest('.crafting-tab');
        if (tab) { uiState.activeTab = tab.dataset.tab; return refreshPanel(); }
        const category = e.target.closest('[data-codex-category]');
        if (category) { uiState.codexCategoryFilter = category.dataset.codexCategory; return refreshPanel(); }
        const char = currentChar(); if (!char) return;
        const button = e.target.closest('[data-bench-action]');
        if (button) {
            try {
                const action = button.dataset.benchAction;
                const card = button.closest('[data-project]');
                const project = projectsFor(char).find(p => p.id === card?.dataset.project);
                const item = getCraftedItems(char).find(i => i.id === button.closest('[data-item]')?.dataset.item);
                if (action === 'recipe') {
                    const recipe = recipeMap[container.querySelector('#bench-recipe')?.value];
                    if (!recipe) throw new Error('Choose a recipe first.');
                    uiState.projectDraft = { kind: 'provision', name: recipe.outputIngredient || recipe.name, effect: recipe.effect || recipe.description, materials: (recipe.ingredients || []).join(', '), dv: recipe.dv };
                    return refreshPanel();
                }
                if (action === 'partial-clean') choosePartial(char, project, 'clean');
                if (action === 'partial-flaw') choosePartial(char, project, 'flaw', card.querySelector('[name="flaw"]').value);
                if (action === 'finish') completeProject(char, project);
                if (action === 'shelve') project.shelved = true;
                if (action === 'resume') project.shelved = false;
                if (action === 'attune') toggleOwnedAttunement(char, item.id);
                if (action === 'repair') {
                    createProject(char, { kind: 'repair', name: 'Repair: ' + item.name, targetId: item.id, flawId: button.dataset.flaw, effect: 'Remove the ' + button.dataset.flaw + ' Flaw.' }, `project_${generateId(20)}`);
                    uiState.activeTab = 'crafting';
                }
                persistBench(char);
            } catch (error) { showToast(error.message, 'error'); }
            return;
        }
        const use = e.target.closest('[data-use-crafted]');
        if (use) return useCraftedItem(char, use.dataset.useCrafted);
        const attune = e.target.closest('[data-toggle-attune]');
        if (attune) return toggleAttune(char, codexMap, attune.dataset.toggleAttune);
        const pay = e.target.closest('[data-pay-upkeep]');
        if (pay) return payUpkeep(char, pay.dataset.payUpkeep, 'efficient');
        const scene = e.target.closest('[data-scene-upkeep]');
        if (scene) return payUpkeep(char, scene.dataset.sceneUpkeep, 'intensive');
        const release = e.target.closest('[data-retire-item]');
        if (release) return retireItem(char, release.dataset.retireItem);
        const restore = e.target.closest('[data-restore-item]');
        if (restore) return restoreCompromisedItem(char, restore.dataset.restoreItem);
    });
}

// ============================================================
// TOAST WITH HTML (roll-outcome readout, non-blocking)
// ============================================================


// ============================================================
// EXPORT
// ============================================================

export function destroy() {
    container = null;
    // Deliberately NOT removing the 'downtime-tick' listener here: decay
    // and forage-limit resets must keep applying even while the
    // Crafting panel isn't the visible tab (a GM can call downtime while
    // players are looking at Characters or the VTT). handleDowntimeTick()
    // itself guards refreshPanel() against a null `container`.
}

export default { render, destroy };
