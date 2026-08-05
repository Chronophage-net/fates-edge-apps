/**
 * Crafting – The Bench and the Codex
 *
 * "A magic sword is not a toy. It is a creditor. It demands maintenance,
 * attention, and sometimes a blood-price. If you cannot afford the
 * upkeep, do not pick it up. The edge is not worth the interest."
 * – The Gray Wanderer
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHY THIS IS ITS OWN TOP-LEVEL FEATURE (not a Spellcraft tab):
 * Crafting — foraging/buying ingredients, combining them, working recipes,
 * and browsing/attuning magic items — has nothing to do with any one
 * magic path. It used to live inside spellcraft/components/witchcraft.js
 * as a "Crafting Bench" section bolted onto the Witch's hedge-magic panel,
 * open to everyone but hidden behind a path-specific module. It is pulled
 * out here so it (a) shows up in its own sidebar slot, reachable without
 * detouring through Spellcraft, and (b) can grow independently of
 * witchcraft-specific concerns like Shadow/Shame/Identity Strain, Hedge
 * Gifts, or the Weaver. witchcraft.js now contains ONLY hedge-magic-
 * specific material.
 *
 * Character state lives under char.crafting (NOT char.witch) — a fresh,
 * dedicated namespace: { ingredients, crafted, attuned, log, forageCount }.
 * ────────────────────────────────────────────────────────────────────────
 *
 * MODULE LAYOUT (split out for size — this used to be one ~1000+ line
 * file mixing game data, state helpers, HTML templates, and event wiring):
 *   - data.js   — static game data (fallback ingredients/recipes/Codex)
 *                 and /data/wiki.json loading/parsing.
 *   - state.js  — character-side persisted-state accessors, plus the
 *                 pure attunement/upkeep/decay/forage-limit helpers
 *                 (exported here too, re-exported for backward
 *                 compatibility with existing test imports).
 *   - render.js — HTML templating only, no DOM/persistence/inline CSS.
 *   - index.js (this file) — orchestration: render(), event wiring,
 *                 action handlers (the only place that calls
 *                 saveCharacter/updateCharacter), and the module-level
 *                 'downtime-tick' listener.
 *
 * STYLING: all presentational CSS lives in css/app.css under
 * "CRAFTING FEATURE" (plus the app-wide .btn/.panel/.flex-between
 * component classes) — no inline `style="..."` attributes or `<style>`
 * blocks in the templates this module builds.
 *
 * ────────────────────────────────────────────────────────────────────────
 * THE CODEX (Item & Artifact reference + attunement tracking).
 * Fate's Edge's gear rules (Player's Guide ch. "Gear, Magic Items, and
 * Crafting", sections/items.tex) price magic items by Talent-equivalent
 * tier — Minor (2 XP), Major (4 XP), Prestige (6 XP), Epic (8 XP) — and
 * require paid upkeep each downtime for up to 3 attuned items, with a
 * Maintained → Neglected → Compromised decay track if upkeep is skipped.
 * Artifacts use Obligation instead of XP/upkeep and never decay. The
 * Codex tab is a browsable reference for sample items/consumables/
 * artifacts (loaded from /data/wiki.json, categories "magic_item" /
 * "consumable" / "artifact"), plus lightweight bookkeeping so a table
 * can actually track attunement and upkeep instead of doing it on paper.
 * ────────────────────────────────────────────────────────────────────────
 *
 * ────────────────────────────────────────────────────────────────────────
 * DECAY STATE & FORAGE LIMIT are both driven by a 'downtime-tick'
 * CustomEvent dispatched from js/features/factions/index.js's
 * "GM Downtime (Faction Turn)" button — see handleDowntimeTick() near
 * the bottom of this file. Each downtime: unpaid attuned items decay one
 * step (state.js applyDowntimeTick()), and every character's forage
 * attempt count resets to 0 (state.js resetForageCount()).
 * ────────────────────────────────────────────────────────────────────────
 */

import { vttStore } from '../../core/vtt-store.js';
import { getState, getCharacter, updateCharacter } from '../../core/state.js';
import { escHtml, generateId, safeParseInt } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { performRoll } from '../../core/dice.js';

import {
    ensureWikiLoaded, parseIngredientsFromWiki, parseRecipesFromWiki, parseCodexFromWiki
} from './data.js';

import {
    getIngredients, getCraftedItems, getAttunedItems,
    addToCraftingLog, availableXp,
    ATTUNEMENT_LIMIT, upkeepCostFor, intensiveUpkeepCostFor, canAttune,
    DECAY_ORDER, advanceDecay, itemRequiresUpkeep, applyDowntimeTick,
    FORAGE_LIMIT_PER_DOWNTIME, getForageCount, canForage, recordForageAttempt, resetForageCount
} from './state.js';

import {
    renderRoot, renderCraftingTab, renderCodexTab, renderNoCharacterView, renderCraftResultToast
} from './render.js';

// Re-exported for tests (tests/unit/crafting.test.js,
// tests/integration/downtime-tick-integration.test.js) and any other
// module that previously imported these directly from
// 'js/features/crafting/index.js' before this file was split up.
export {
    ATTUNEMENT_LIMIT, upkeepCostFor, intensiveUpkeepCostFor, canAttune,
    DECAY_ORDER, advanceDecay, itemRequiresUpkeep, applyDowntimeTick,
    FORAGE_LIMIT_PER_DOWNTIME, getForageCount, canForage, recordForageAttempt, resetForageCount
};

// ============================================================
// STATE (module-local UI state — not persisted)
// ============================================================

let container = null;
let lastCharId = null;

const uiState = {
    craftCombineSelection: [],
    craftExpandedRecipe: null,
    codexTierFilter: 'all',
    codexCategoryFilter: 'magic_item',
    activeTab: 'crafting',
    recipeSearchQuery: '',
    recipeSkillFilter: 'all',
    recipeTierFilter: 'all',
    batchQuantity: 1
};

// Refinement recipes (map of id -> recipe), rebuilt each render()
let refinementMap = {};

function resetUiStateIfCharChanged(char) {
    if (lastCharId !== char.id) {
        uiState.craftCombineSelection = [];
        uiState.craftExpandedRecipe = null;
        uiState.batchQuantity = 1;
        uiState.recipeSearchQuery = '';
        uiState.recipeSkillFilter = 'all';
        uiState.recipeTierFilter = 'all';
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
        if (!silent) showToast('Select a character first.', 'error');
        return null;
    }
    const char = getCharacter(id);
    if (!char) {
        if (!silent) showToast('Character not found.', 'error');
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
    const ingredientMap = parseIngredientsFromWiki(wikiEntries);
    const recipeMap = parseRecipesFromWiki(wikiEntries);
    const codex = parseCodexFromWiki(wikiEntries);

    refinementMap = {};
    for (const [id, recipe] of Object.entries(recipeMap)) {
        if (recipe.outputIngredient) refinementMap[id] = recipe;
    }

    const tabContent = uiState.activeTab === 'crafting'
        ? renderCraftingTab(char, ingredientMap, recipeMap, refinementMap, uiState)
        : renderCodexTab(char, codex, uiState);

    container.innerHTML = renderRoot(char, tabContent, uiState);

    attachEvents(char);
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

function forageIngredient(char, ingredientMap) {
    if (!canForage(char)) {
        return showToast(`No forage attempts left this downtime (${FORAGE_LIMIT_PER_DOWNTIME}/${FORAGE_LIMIT_PER_DOWNTIME} used). Wait for the next GM Downtime.`, 'warning');
    }
    const common = Object.values(ingredientMap).filter(i => i.common);
    if (common.length === 0) return showToast('No common ingredients defined.', 'error');
    const picked = common[Math.floor(Math.random() * common.length)];
    const ingredients = getIngredients(char);
    ingredients.push(picked.name);
    const count = recordForageAttempt(char);
    saveCharacter({ crafting: char.crafting });
    showToast(`🌿 Foraged ${picked.icon} ${picked.name} (${count}/${FORAGE_LIMIT_PER_DOWNTIME} this downtime)`, 'success');
    refreshPanel();
}

function purchaseIngredient(char, ingredientMap) {
    const select = document.getElementById('craft-buy-select');
    if (!select || !select.value) return showToast('Choose a rare ingredient to buy first.', 'error');
    const picked = ingredientMap[select.value];
    if (!picked) return showToast('Ingredient not found.', 'error');
    if (availableXp(char) < picked.cost) return showToast(`Not enough XP. Need ${picked.cost}, have ${availableXp(char)}.`, 'error');
    char.xpSpent = (char.xpSpent || 0) + picked.cost;
    const ingredients = getIngredients(char);
    ingredients.push(picked.name);
    saveCharacter({ xpSpent: char.xpSpent, crafting: char.crafting });
    showToast(`💰 Purchased ${picked.icon} ${picked.name} for ${picked.cost} XP`, 'success');
    refreshPanel();
}

function removeIngredientAt(char, index) {
    const ingredients = getIngredients(char);
    if (index < 0 || index >= ingredients.length) return;
    const [removed] = ingredients.splice(index, 1);
    char.crafting.ingredients = ingredients;
    uiState.craftCombineSelection = uiState.craftCombineSelection.filter(i => i !== index).map(i => (i > index ? i - 1 : i));
    saveCharacter({ crafting: char.crafting });
    showToast(`Removed ${removed}.`, 'info');
    refreshPanel();
}

function toggleCombineSelect(index) {
    const pos = uiState.craftCombineSelection.indexOf(index);
    if (pos === -1) {
        if (uiState.craftCombineSelection.length >= 3) return showToast('You can combine up to 3 ingredients at once.', 'warning');
        uiState.craftCombineSelection.push(index);
    } else {
        uiState.craftCombineSelection.splice(pos, 1);
    }
    refreshPanel();
}

function combineIngredients(char, recipeMap) {
    if (uiState.craftCombineSelection.length === 0) return showToast('Check at least one ingredient below to combine.', 'warning');
    const ingredients = getIngredients(char);
    const indices = [...new Set(uiState.craftCombineSelection)].filter(i => i >= 0 && i < ingredients.length).sort((a, b) => b - a);
    const selectedNames = indices.map(i => ingredients[i]).reverse();
    for (const i of indices) ingredients.splice(i, 1);
    char.crafting.ingredients = ingredients;
    uiState.craftCombineSelection = [];

    let matchedRecipe = null;
    for (const recipe of Object.values(recipeMap)) {
        const recipeIngs = recipe.ingredients || [];
        if (selectedNames.length > 0 && selectedNames.every(name => recipeIngs.some(r => r.toLowerCase() === name.toLowerCase()))) {
            matchedRecipe = recipe;
            break;
        }
    }

    if (matchedRecipe) {
        const crafted = getCraftedItems(char);
        crafted.push({ id: generateId('crafted_'), name: matchedRecipe.name, effect: matchedRecipe.effect, quality: 'standard', uses: matchedRecipe.tier === 'standard' ? 2 : 1, recipe: matchedRecipe.id, icon: matchedRecipe.icon || '🔧', createdAt: Date.now() });
        addToCraftingLog(char, { name: matchedRecipe.name, quality: 'standard', icon: matchedRecipe.icon });
        saveCharacter({ crafting: char.crafting });
        showToast(`⚗️ Successfully crafted ${matchedRecipe.icon} ${matchedRecipe.name}!`, 'success');
    } else {
        const randomEffects = [
            'A bubbly green liquid that smells of mint; drink it to restore 1 Fatigue.',
            'A grey powder that sparkles; it can be thrown to create a flash of light (distract enemies).',
            'A sticky tar that hardens on contact; can be used to patch a leak or jam a lock.',
            'A sweet syrup that induces vivid dreams; take it to gain +1 die on a future Wits roll.',
            'A bitter tonic that purges the system; removes one Poisoned condition (if any).'
        ];
        const effect = randomEffects[Math.floor(Math.random() * randomEffects.length)];
        const crafted = getCraftedItems(char);
        crafted.push({ id: generateId('crafted_'), name: '🧪 Unknown Concoction', effect, quality: 'flawed', uses: 1, recipe: null, icon: '🧪', createdAt: Date.now() });
        addToCraftingLog(char, { name: 'Unknown Concoction', quality: 'flawed', icon: '🧪' });
        saveCharacter({ crafting: char.crafting });
        showToast(`⚗️ You created an unknown concoction: ${effect}`, 'info');
    }
    refreshPanel();
}

function craftFromRecipe(char, recipeMap, recipeId, quantity = 1) {
    const recipe = recipeMap[recipeId];
    if (!recipe) return showToast('Recipe not found.', 'error');

    const required = recipe.ingredients || [];
    const ingredients = getIngredients(char);
    const missing = required.filter(req => !ingredients.some(i => i.toLowerCase() === req.toLowerCase()));
    const totalXpCost = recipe.xpCost * quantity;

    if (availableXp(char) < totalXpCost) return showToast(`Not enough XP. Need ${totalXpCost}, have ${availableXp(char)}.`, 'error');

    // One roll for the whole batch (rolling per-item would be more
    // granular but adds a lot of UI noise for little mechanical payoff).
    const skillLevel = char.skills?.[recipe.skill] || 0;
    const attr = recipe.skill === 'medicine' || recipe.skill === 'craft' ? 'wits' : 'spirit';
    const attrValue = char[attr] || 1;
    const pool = attrValue + skillLevel;
    const dv = recipe.dv;
    const result = performRoll(pool, dv);

    let success = false, outcome = '', outcomeClass = 'failure', boons = 0, sbCount = 0;
    if (result.successes >= dv) { success = true; outcome = '✅ Success'; outcomeClass = 'success'; }
    else if (result.successes > 0) { outcome = '⚠️ Partial'; outcomeClass = 'partial'; boons = 1; }
    else { outcome = '❌ Failure'; sbCount = result.storyBeats || 1; boons = 2; }

    const updates = {};
    let appliedXpCost = 0;
    if (success || outcome === '⚠️ Partial') {
        char.xpSpent = (char.xpSpent || 0) + totalXpCost;
        appliedXpCost = totalXpCost;
        updates.xpSpent = char.xpSpent;
    }
    if (boons > 0) {
        char.boons = Math.min(5, (char.boons || 0) + boons);
        updates.boons = char.boons;
    }

    // Ingredients are consumed regardless of outcome (components are
    // spent/wasted either way — matches the pre-existing behavior here).
    const consumed = [];
    for (const req of required) {
        for (let i = 0; i < quantity; i++) {
            const idx = ingredients.findIndex(ing => ing.toLowerCase() === req.toLowerCase());
            if (idx !== -1) {
                consumed.push(ingredients[idx]);
                ingredients.splice(idx, 1);
            }
        }
    }
    char.crafting.ingredients = ingredients;
    updates.crafting = char.crafting;

    const crafted = getCraftedItems(char);
    const itemsCreated = [];
    if (success || outcome === '⚠️ Partial') {
        for (let i = 0; i < quantity; i++) {
            const newItem = {
                id: generateId('crafted_'),
                name: recipe.name,
                effect: recipe.effect,
                quality: success ? 'standard' : 'flawed',
                uses: recipe.tier === 'standard' ? 2 : 1,
                recipe: recipe.id,
                icon: recipe.icon || '🔧',
                createdAt: Date.now()
            };
            crafted.push(newItem);
            itemsCreated.push(newItem);
        }
        updates.crafting = char.crafting;
        if (itemsCreated.length > 0) {
            addToCraftingLog(char, { name: recipe.name, quality: itemsCreated[0].quality, icon: recipe.icon });
        }
    } else {
        addToCraftingLog(char, { name: `Failed: ${recipe.name}`, quality: 'failure', icon: '💥' });
    }

    saveCharacter(updates);
    uiState.craftExpandedRecipe = null;

    showToastWithHTML(renderCraftResultToast({
        recipe, quantity, pool, dv, result, outcome, outcomeClass,
        totalXpCost: appliedXpCost, boons, sbCount, consumed, missing, itemsCreated
    }));
    refreshPanel();
}

function useCraftedItem(char, itemId) {
    const crafted = getCraftedItems(char);
    const item = crafted.find(c => c.id === itemId);
    if (!item) return showToast('Item not found.', 'error');
    showToast(`🧪 Used "${item.name}": ${item.effect || 'The item is used.'}`, 'success');
    item.uses = (item.uses || 1) - 1;
    if (item.uses <= 0) {
        char.crafting.crafted = crafted.filter(c => c.id !== itemId);
    }
    saveCharacter({ crafting: char.crafting });
    refreshPanel();
}

function removeCraftedItem(char, itemId) {
    char.crafting.crafted = getCraftedItems(char).filter(c => c.id !== itemId);
    saveCharacter({ crafting: char.crafting });
    showToast('Item removed.', 'info');
    refreshPanel();
}

// ─── Refinement actions ──────────────────────────────────────

function refineIngredient(char, recipeMap, recipeId) {
    const recipe = recipeMap[recipeId];
    if (!recipe || !recipe.outputIngredient) return showToast('Not a refinement recipe.', 'error');
    const required = recipe.ingredients || [];
    const ingredients = getIngredients(char);
    const missing = required.filter(req => !ingredients.some(i => i.toLowerCase() === req.toLowerCase()));
    if (missing.length > 0) return showToast(`Missing ingredients: ${missing.join(', ')}`, 'error');
    if (availableXp(char) < recipe.xpCost) return showToast(`Not enough XP. Need ${recipe.xpCost}.`, 'error');

    for (const req of required) {
        const idx = ingredients.findIndex(i => i.toLowerCase() === req.toLowerCase());
        if (idx !== -1) ingredients.splice(idx, 1);
    }
    ingredients.push(recipe.outputIngredient);
    char.xpSpent = (char.xpSpent || 0) + recipe.xpCost;
    addToCraftingLog(char, { name: recipe.outputIngredient, quality: 'refined', icon: recipe.icon });
    saveCharacter({ xpSpent: char.xpSpent, crafting: char.crafting });
    showToast(`⚗️ Refined ${recipe.outputIngredient} from ${required.join(', ')}.`, 'success');
    refreshPanel();
}

// ─── Codex actions ─────────────────────────────────────────────

function toggleAttune(char, codex, entryId) {
    const entry = codex.find(e => e.id === entryId);
    if (!entry) return showToast('Item not found in the Codex.', 'error');
    const attuned = getAttunedItems(char);
    const idx = attuned.findIndex(a => a.id === entryId);
    if (idx !== -1) {
        attuned.splice(idx, 1);
        showToast(`Broke attunement with ${entry.title}.`, 'info');
    } else {
        if (!canAttune(attuned, entryId)) return showToast(`Already attuned to ${ATTUNEMENT_LIMIT} items — break one first.`, 'warning');
        attuned.push({ id: entry.id, name: entry.title, cost: entry.cost, tier: entry.tier, icon: entry.icon, category: entry.category, condition: 'maintained', paidUpkeepThisDowntime: false, attunedAt: Date.now() });
        showToast(`🔗 Attuned to ${entry.title}.`, 'success');
    }
    saveCharacter({ crafting: char.crafting });
    refreshPanel();
}

function payUpkeep(char, itemId, mode) {
    const attuned = getAttunedItems(char);
    const item = attuned.find(a => a.id === itemId);
    if (!item) return showToast('Item not found.', 'error');

    // Compromised items don't come back from paying upkeep — items.tex:
    // "requires a quest to restore". Send the player to restoreCompromisedItem().
    if (item.condition === 'compromised') {
        return showToast(`${item.name} is Compromised — upkeep won't fix it. It requires a quest to restore.`, 'warning');
    }

    if (mode === 'efficient') {
        const cost = upkeepCostFor(item);
        if (availableXp(char) < cost) return showToast(`Not enough XP for upkeep. Need ${cost}.`, 'error');
        char.xpSpent = (char.xpSpent || 0) + cost;
        item.condition = 'maintained';
        item.paidUpkeepThisDowntime = true;
        saveCharacter({ xpSpent: char.xpSpent, crafting: char.crafting });
        showToast(`💰 Paid ${cost} XP upkeep for ${item.name}.`, 'success');
    } else {
        char.xpSpent = (char.xpSpent || 0) + intensiveUpkeepCostFor(item);
        item.condition = 'maintained';
        item.paidUpkeepThisDowntime = true;
        saveCharacter({ xpSpent: char.xpSpent, crafting: char.crafting });
        showToast(`🕯️ Spent a downtime scene maintaining ${item.name}.`, 'success');
    }
    refreshPanel();
}

// Compromised items require a quest, not upkeep, to fix (items.tex).
// This app has no quest-tracking of its own, so this is a deliberate,
// explicit GM/player action to record that the quest happened —
// distinct from payUpkeep(), which is blocked for compromised items.
function restoreCompromisedItem(char, itemId) {
    const attuned = getAttunedItems(char);
    const item = attuned.find(a => a.id === itemId);
    if (!item) return showToast('Item not found.', 'error');
    if (item.condition !== 'compromised') return showToast(`${item.name} isn't Compromised.`, 'info');
    item.condition = 'maintained';
    item.paidUpkeepThisDowntime = true;
    saveCharacter({ crafting: char.crafting });
    showToast(`✨ ${item.name} restored after a quest to fix it.`, 'success');
    refreshPanel();
}

function retireItem(char, itemId) {
    const attuned = getAttunedItems(char);
    const idx = attuned.findIndex(a => a.id === itemId);
    if (idx === -1) return;
    const [item] = attuned.splice(idx, 1);
    const refund = Math.floor((item.cost || 0) / 2);
    if (refund > 0) {
        char.xpSpent = Math.max(0, (char.xpSpent || 0) - refund);
    }
    saveCharacter({ xpSpent: char.xpSpent, crafting: char.crafting });
    showToast(`Retired ${item.name}${refund > 0 ? ` — regained ${refund} XP` : ''}.`, 'info');
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
        updateCharacter(char.id, { crafting: char.crafting });
    }
    if (anyDecay) {
        showToast('🕯️ Downtime passed — some attuned items decayed (unpaid upkeep). Forage attempts have reset.', 'warning');
    } else {
        showToast('🕯️ Downtime passed — forage attempts have reset.', 'info');
    }
    refreshPanel();
}

if (typeof document !== 'undefined') {
    document.addEventListener('downtime-tick', handleDowntimeTick);
}

// ============================================================
// EVENTS
// ============================================================

function attachEvents(char) {
    if (!container) return;

    const refreshBtn = document.getElementById('craft-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', async () => {
        showToast('🔄 Reloading crafting data…', 'info');
        await ensureWikiLoaded(true);
        await refreshPanel();
        showToast('✅ Crafting refreshed.', 'success');
    });

    // Tab switching
    container.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.crafting-tab');
        if (tabBtn) {
            uiState.activeTab = tabBtn.dataset.tab;
            refreshPanel();
        }
    });

    // Search/filter/batch-quantity inputs
    container.addEventListener('input', (e) => {
        const search = e.target.closest('#recipe-search');
        if (search) {
            uiState.recipeSearchQuery = search.value;
            return refreshPanel();
        }
        const batch = e.target.closest('#craft-batch-qty');
        if (batch) {
            let val = parseInt(batch.value, 10);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 10) val = 10;
            uiState.batchQuantity = val;
            return refreshPanel();
        }
    });

    container.addEventListener('change', (e) => {
        const tierFilter = e.target.closest('#codex-tier-filter');
        if (tierFilter) { uiState.codexTierFilter = tierFilter.value; return refreshPanel(); }

        const skillFilter = e.target.closest('#recipe-skill-filter');
        if (skillFilter) { uiState.recipeSkillFilter = skillFilter.value; return refreshPanel(); }

        const tierFilterRecipes = e.target.closest('#recipe-tier-filter');
        if (tierFilterRecipes) { uiState.recipeTierFilter = tierFilterRecipes.value; return refreshPanel(); }

        const combineCheckbox = e.target.closest('[data-combine-idx]');
        if (combineCheckbox) return toggleCombineSelect(parseInt(combineCheckbox.dataset.combineIdx, 10));
    });

    // Click actions (delegated)
    container.addEventListener('click', async (e) => {
        const state = getState();
        const wikiEntries = state.wikiEntries || [];
        const ingredientMap = parseIngredientsFromWiki(wikiEntries);
        const recipeMap = parseRecipesFromWiki(wikiEntries);
        const codex = parseCodexFromWiki(wikiEntries);

        const forageBtn = e.target.closest('#craft-forage-btn');
        if (forageBtn) return forageIngredient(char, ingredientMap);

        const buyBtn = e.target.closest('#craft-buy-btn');
        if (buyBtn) return purchaseIngredient(char, ingredientMap);

        const combineBtn = e.target.closest('#craft-combine-btn');
        if (combineBtn) return combineIngredients(char, recipeMap);

        const clearCombineBtn = e.target.closest('#craft-clear-combine-btn');
        if (clearCombineBtn) { uiState.craftCombineSelection = []; return refreshPanel(); }

        const removeIngBtn = e.target.closest('[data-remove-ingredient-idx]');
        if (removeIngBtn) return removeIngredientAt(char, parseInt(removeIngBtn.dataset.removeIngredientIdx, 10));

        const toggleRecipeBtn = e.target.closest('[data-toggle-recipe]');
        if (toggleRecipeBtn) {
            const id = toggleRecipeBtn.dataset.toggleRecipe;
            uiState.craftExpandedRecipe = uiState.craftExpandedRecipe === id ? null : id;
            return refreshPanel();
        }

        const craftRecipeBtn = e.target.closest('[data-craft-recipe]');
        if (craftRecipeBtn) return craftFromRecipe(char, recipeMap, craftRecipeBtn.dataset.craftRecipe, uiState.batchQuantity || 1);

        const refineBtn = e.target.closest('[data-refine-recipe]');
        if (refineBtn) return refineIngredient(char, recipeMap, refineBtn.dataset.refineRecipe);

        const useCraftedBtn = e.target.closest('[data-use-crafted]');
        if (useCraftedBtn) return useCraftedItem(char, useCraftedBtn.dataset.useCrafted);

        const removeCraftedBtn = e.target.closest('[data-remove-crafted]');
        if (removeCraftedBtn) return removeCraftedItem(char, removeCraftedBtn.dataset.removeCrafted);

        const codexCategoryBtn = e.target.closest('[data-codex-category]');
        if (codexCategoryBtn) { uiState.codexCategoryFilter = codexCategoryBtn.dataset.codexCategory; return refreshPanel(); }

        const attuneBtn = e.target.closest('[data-toggle-attune]');
        if (attuneBtn) return toggleAttune(char, codex, safeParseInt(attuneBtn.dataset.toggleAttune, 0));

        const payUpkeepBtn = e.target.closest('[data-pay-upkeep]');
        if (payUpkeepBtn) return payUpkeep(char, payUpkeepBtn.dataset.payUpkeep, 'efficient');

        const sceneUpkeepBtn = e.target.closest('[data-scene-upkeep]');
        if (sceneUpkeepBtn) return payUpkeep(char, sceneUpkeepBtn.dataset.sceneUpkeep, 'intensive');

        const retireBtn = e.target.closest('[data-retire-item]');
        if (retireBtn) return retireItem(char, retireBtn.dataset.retireItem);

        const restoreBtn = e.target.closest('[data-restore-item]');
        if (restoreBtn) return restoreCompromisedItem(char, restoreBtn.dataset.restoreItem);
    });
}

// ============================================================
// TOAST WITH HTML (roll-outcome readout, non-blocking)
// ============================================================

function showToastWithHTML(html) {
    const existing = document.querySelector('.custom-toast-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'custom-toast-modal';
    const inner = document.createElement('div');
    inner.className = 'custom-toast-modal-inner';
    inner.innerHTML = html;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    const closeBtn = inner.querySelector('.craft-result-close');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.remove());

    setTimeout(() => { if (modal.parentNode) modal.remove(); }, 10000);
}

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
