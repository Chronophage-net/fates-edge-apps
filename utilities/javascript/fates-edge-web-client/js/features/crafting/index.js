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
 * and now browsing/attuning magic items — has nothing to do with any one
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
 * dedicated namespace: { ingredients, crafted, attuned }.
 * ────────────────────────────────────────────────────────────────────────
 *
 * ────────────────────────────────────────────────────────────────────────
 * NEW: THE CODEX (Item & Artifact reference + attunement tracking).
 * Fate's Edge's gear rules (see the Players' Guide, "Gear, Magic Items,
 * and Crafting") price magic items by Talent-equivalent tier — Minor (2
 * XP), Major (4 XP), Prestige (6 XP), Epic (8 XP) — and require paid
 * upkeep each downtime for up to 3 attuned items, with a Maintained →
 * Neglected → Compromised decay track if upkeep is skipped. Artifacts use
 * Obligation instead of XP/upkeep. The Codex below is a browsable
 * reference for the sample items/consumables/artifacts (loaded from
 * /data/wiki.json, categories "magic_item" / "consumable" / "artifact"),
 * plus lightweight bookkeeping so a table can actually track attunement
 * and upkeep instead of doing it on paper.
 * ────────────────────────────────────────────────────────────────────────
 */

import { vttStore } from '../../core/vtt-store.js';
import { getState, getCharacter, updateCharacter, saveState } from '../../core/state.js';
import { escHtml, generateId, safeParseInt } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { performRoll } from '../../core/dice.js';

// ============================================================
// STATE (module-local UI state — not persisted)
// ============================================================

let container = null;
let lastCharId = null;
let craftCombineSelection = [];
let craftExpandedRecipe = null;
let codexTierFilter = 'all';
let codexCategoryFilter = 'magic_item';

function resetUiStateIfCharChanged(char) {
    if (lastCharId !== char.id) {
        craftCombineSelection = [];
        craftExpandedRecipe = null;
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
// WIKI DATA LOADING (ingredients, recipes, and the Codex)
// ============================================================

async function ensureWikiLoaded(force = false) {
    const state = getState();
    if (state.wikiEntries && !force) return;
    try {
        const response = await fetch('/data/wiki.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        state.wikiEntries = data.data || [];
        state.wikiData = data;
        saveState();
    } catch (err) {
        console.warn('[Crafting] Failed to load wiki.json, using fallback data.', err);
        state.wikiEntries = [...FALLBACK_WIKI_ENTRIES];
        state.wikiData = { data: state.wikiEntries };
        saveState();
    }
}

// ─── Fallback data (used only if /data/wiki.json can't be fetched) ────

const FALLBACK_INGREDIENTS = {
    'Herbs': { name: 'Herbs', cost: 0, common: true, icon: '🌿' },
    'Clean cloth': { name: 'Clean cloth', cost: 0, common: true, icon: '🧻' },
    'Rare herb': { name: 'Rare herb', cost: 1, common: false, icon: '🌱' },
    'Distilled water': { name: 'Distilled water', cost: 0, common: true, icon: '💧' },
    'Charcoal': { name: 'Charcoal', cost: 0, common: true, icon: '🪵' },
    'Valerian root': { name: 'Valerian root', cost: 0, common: true, icon: '🌰' },
    'Honey': { name: 'Honey', cost: 0, common: true, icon: '🍯' },
    'Moonwater': { name: 'Moonwater', cost: 1, common: false, icon: '🌙' },
    'Salt': { name: 'Salt', cost: 0, common: true, icon: '🧂' },
    'Blessed ash': { name: 'Blessed ash', cost: 1, common: false, icon: '🔥' },
    'Iron filings': { name: 'Iron filings', cost: 0, common: true, icon: '⚙️' },
    'Nightshade': { name: 'Nightshade', cost: 1, common: false, icon: '☠️' },
    'Pure water': { name: 'Pure water', cost: 0, common: true, icon: '💧' },
    'Blood': { name: 'Blood', cost: 0, common: true, icon: '🩸' },
    'Chamomile': { name: 'Chamomile', cost: 0, common: true, icon: '🌼' },
    'Moonwort': { name: 'Moonwort', cost: 1, common: false, icon: '🌙' },
    'Sulphur': { name: 'Sulphur', cost: 0, common: true, icon: '🟡' },
    'Saltpetre': { name: 'Saltpetre', cost: 0, common: true, icon: '🧪' },
    'Olive oil': { name: 'Olive oil', cost: 0, common: true, icon: '🫒' },
    'Incense': { name: 'Incense', cost: 0, common: true, icon: '🪔' }
};

const FALLBACK_RECIPES = {
    'healing-poultice': { id: 'healing-poultice', name: '🩹 Healing Poultice', description: 'A balm of herbs and salves that speeds recovery.', effect: 'Remove 1 Fatigue when applied during a short rest.', ingredients: ['Herbs', 'Clean cloth'], skill: 'medicine', dv: 2, xpCost: 1, tier: 'minor', icon: '🩹' },
    'antidote': { id: 'antidote', name: '🧪 Antidote', description: 'A bitter draught that neutralises common poisons.', effect: 'Remove one Poisoned Condition.', ingredients: ['Rare herb', 'Distilled water', 'Charcoal'], skill: 'medicine', dv: 3, xpCost: 2, tier: 'minor', icon: '🧪' },
    'sleep-draught': { id: 'sleep-draught', name: '💤 Sleep Draught', description: 'A sweet syrup that induces deep, dreamless sleep.', effect: 'Target tests Spirit+Resolve (DV 3) or falls asleep for 1 hour.', ingredients: ['Valerian root', 'Honey', 'Moonwater'], skill: 'craft', dv: 3, xpCost: 1, tier: 'minor', icon: '💤' },
    'ward-salt': { id: 'ward-salt', name: '🧂 Ward Salt', description: 'Salt blessed with protective herbs and iron filings.', effect: 'Line wards against spirits and undead (Spirit+Resolve DV 4 to cross).', ingredients: ['Salt', 'Blessed ash', 'Iron filings'], skill: 'lore', dv: 3, xpCost: 2, tier: 'minor', icon: '🧂' },
    'truth-serum': { id: 'truth-serum', name: '🔮 Truth Serum', description: 'A clear liquid that loosens the tongue.', effect: 'Target tests Spirit+Resolve (DV 4) or speaks only truth for one exchange.', ingredients: ['Nightshade', 'Pure water', 'Blood'], skill: 'craft', dv: 4, xpCost: 3, tier: 'standard', icon: '🔮' },
    'moon-tea': { id: 'moon-tea', name: '🌙 Moon Tea', description: 'A calming infusion that sharpens dreams and intuition.', effect: '+1 die on next Wits or Spirit roll within 1 hour.', ingredients: ['Chamomile', 'Moonwort', 'Honey'], skill: 'craft', dv: 2, xpCost: 1, tier: 'minor', icon: '🌙' },
    'fire-powder': { id: 'fire-powder', name: '🔥 Fire Powder', description: 'A volatile powder that ignites on contact with air.', effect: 'Creates a small fire (Harm 2, Area) in Close range. One use.', ingredients: ['Sulphur', 'Charcoal', 'Saltpetre'], skill: 'craft', dv: 4, xpCost: 3, tier: 'standard', icon: '🔥' },
    'blessed-oil': { id: 'blessed-oil', name: '🕯️ Blessed Oil', description: 'Oil consecrated to a Patron or Threshold.', effect: 'Anoints a weapon or threshold; counts as [WARD] or [BLESSED] for one scene.', ingredients: ['Olive oil', 'Incense'], skill: 'lore', dv: 3, xpCost: 2, tier: 'standard', icon: '🕯️' }
};

const FALLBACK_CODEX = [
    { id: 500, title: 'Salt-Line Charm', category: 'magic_item', tier: 'minor', cost: 2, icon: '🧂', body: 'A fired clay bead on twine. Once per scene, pour a pinch of salt from it to raise a [WARD] line in Near; spirits and the Hollowed suffer +1 DV to cross it.' },
    { id: 502, title: 'Coat of Second Debts', category: 'magic_item', tier: 'major', cost: 4, icon: '🧥', body: 'Once per scene, as a reaction, redirect Harm meant for an ally in Close to yourself instead. Each time you do, mark 1 Obligation to a creditor you have never met and cannot name.' },
    { id: 504, title: 'The Ninth Bell', category: 'magic_item', tier: 'prestige', cost: 6, icon: '🔔', body: "A hand bell with no clapper that rings anyway. Once per session, ring it: every active Downtime Project Timer and Promise Timer touching the scene advances 1 segment." },
    { id: 506, title: "Wanderer's Toll-Coin", category: 'magic_item', tier: 'epic', cost: 8, icon: '🪙', body: 'A coin that is always warm to the touch. Once per day, pay it to any gatekeeper, guard, or tollkeeper and you and your companions pass unmolested and unremembered.' },
    { id: 520, title: "Widow's Draught", category: 'consumable', cost: 1, icon: '🍵', body: 'A bitter tea. Drink to remove 1 Fatigue and gain [CLEANSE] against one ongoing minor Condition rooted in grief or fear.' },
    { id: 540, title: "The Wanderer's Last Match", category: 'artifact', obligation: 1, icon: '🕯️', body: "A single match that relights itself every dawn. While lit, you automatically find the nearest safe way out of anywhere you're lost." }
];

const FALLBACK_WIKI_ENTRIES = [
    ...Object.values(FALLBACK_INGREDIENTS).map((i, idx) => ({ id: 430 + idx, title: i.name, category: 'ingredient', body: '', tags: [i.common ? 'common' : 'rare'], cost: i.cost, icon: i.icon })),
    ...Object.values(FALLBACK_RECIPES).map((r, idx) => ({ id: 450 + idx, title: r.name, category: 'recipe', body: r.description, effect: r.effect, ingredients: r.ingredients, skill: r.skill, dv: r.dv, xpCost: r.xpCost, tier: r.tier, icon: r.icon })),
    ...FALLBACK_CODEX
];

// ============================================================
// DATA PARSING
// ============================================================

function parseIngredientsFromWiki(entries) {
    const map = {};
    for (const entry of entries) {
        if (entry.category === 'ingredient' && entry.title) {
            map[entry.title] = {
                name: entry.title,
                cost: entry.cost !== undefined ? entry.cost : 0,
                common: entry.tags?.includes('common') ?? true,
                icon: entry.icon || '🧪',
                description: entry.body || ''
            };
        }
    }
    return Object.keys(map).length ? map : FALLBACK_INGREDIENTS;
}

function parseRecipesFromWiki(entries) {
    const recipes = {};
    for (const entry of entries) {
        if (entry.category === 'recipe' && entry.title) {
            const id = String(entry.id) || entry.title.toLowerCase().replace(/ /g, '-');
            recipes[id] = {
                id, name: entry.title, description: entry.body || '', effect: entry.effect || entry.body || '',
                ingredients: entry.ingredients || [], skill: entry.skill || 'craft',
                dv: entry.dv !== undefined ? entry.dv : 3, xpCost: entry.xpCost !== undefined ? entry.xpCost : 1,
                tier: entry.tier || 'minor', icon: entry.icon || '🔧'
            };
        }
    }
    return Object.keys(recipes).length ? recipes : FALLBACK_RECIPES;
}

function parseCodexFromWiki(entries) {
    const codex = entries.filter(e => ['magic_item', 'consumable', 'artifact'].includes(e.category));
    return codex.length ? codex : FALLBACK_CODEX;
}

const TIER_META = {
    minor: { label: 'Minor', color: 'var(--text3)' },
    major: { label: 'Major', color: 'var(--green)' },
    prestige: { label: 'Prestige', color: 'var(--gold)' },
    epic: { label: 'Epic', color: 'var(--purple, #8e44ad)' }
};

const CATEGORY_META = {
    magic_item: { label: 'Magic Items', icon: '✨' },
    consumable: { label: 'Consumables', icon: '🧪' },
    artifact: { label: 'Artifacts', icon: '🏺' }
};

// ============================================================
// CHARACTER-SIDE STATE
// ============================================================

function getCraftState(char) {
    if (!char.crafting) char.crafting = {};
    return char.crafting;
}

function getIngredients(char) {
    const c = getCraftState(char);
    if (!c.ingredients) c.ingredients = [];
    return c.ingredients;
}

function getCraftedItems(char) {
    const c = getCraftState(char);
    if (!c.crafted) c.crafted = [];
    return c.crafted;
}

function getAttunedItems(char) {
    const c = getCraftState(char);
    if (!c.attuned) c.attuned = [];
    return c.attuned;
}

function availableXp(char) {
    return (char.totalXp || 0) - (char.xpSpent || 0);
}

// ============================================================
// RENDER – ROOT
// ============================================================

export async function render(el) {
    container = el;
    if (!container) return;

    const char = getCharacterData({ silent: true });
    if (!char) {
        container.innerHTML = renderNoCharacterView();
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

    container.innerHTML = `
        <div class="crafting-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <div class="crafting-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;background:linear-gradient(135deg, var(--bg2) 0%, var(--bg1) 100%);border-radius:var(--radius) var(--radius) 0 0;padding:0.5rem 0.8rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🔨</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Crafting</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-left:0.3rem;">${escHtml(char.name || 'Unnamed')}</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <span style="font-size:0.7rem;color:var(--text3);align-self:center;">${availableXp(char)} XP available</span>
                    <button class="btn btn-sm btn-ghost" id="craft-refresh-btn" title="Reload wiki data from disk">🔄</button>
                </div>
            </div>

            <div style="font-size:0.7rem;color:var(--text3);background:var(--bg2);border:1px dashed var(--border);border-radius:var(--radius);padding:0.4rem 0.6rem;">
                🔧 Open to every character, regardless of magic path. Hedge Gifts, Quick Workings, and Full Rituals live under <strong>Spellcraft → Witchcraft</strong> instead.
            </div>

            ${renderCraftingBench(char, ingredientMap, recipeMap)}
            ${renderCodex(char, codex)}

        </div>
    `;

    attachEvents(char);
}

function renderNoCharacterView() {
    const characters = getState().characters || [];
    return `
        <div class="panel" style="padding:1.5rem 1.5rem 2rem;text-align:center;color:var(--text3);background:var(--bg2);border-radius:var(--radius);border:1px dashed var(--border);">
            <div style="font-size:3rem;">🔨</div>
            <h2 style="margin:0.5rem 0;color:var(--text);">Select a Character</h2>
            <p style="margin:0 0 0.8rem;">Pick a character to forage ingredients, work recipes, and browse the Codex of magic items.</p>
            <div style="display:flex;gap:0.4rem;justify-content:center;align-items:center;flex-wrap:wrap;">
                ${characters.length > 0 ? `
                    <select id="crafting-char-select" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.35rem 0.6rem;font-size:0.85rem;min-width:220px;">
                        <option value="">— Choose a character —</option>
                        ${characters.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.name || 'Unnamed')}</option>`).join('')}
                    </select>
                ` : `<p style="font-size:0.85rem;color:var(--text3);margin:0;">No characters yet — create one on the Characters tab first.</p>`}
                <button class="btn btn-gold" id="craft-go-to-vtt-btn">🎯 Go to VTT</button>
            </div>
        </div>
    `;
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
// RENDER – CRAFTING BENCH (ingredients, recipes, crafted items)
// ============================================================

function renderCraftingToolbar(ingredientMap) {
    const rare = Object.values(ingredientMap).filter(i => !i.common);
    return `
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">
            <button class="btn btn-xs btn-secondary" id="craft-forage-btn" title="Forage a random common ingredient">🌿 Forage</button>
            ${rare.length > 0 ? `
                <div style="display:flex;gap:0.2rem;align-items:center;background:var(--bg3);border-radius:6px;padding:0.15rem 0.3rem;border:1px solid var(--border);">
                    <select id="craft-buy-select" style="background:var(--bg3);color:var(--text);border:none;font-size:0.7rem;">
                        ${rare.map(i => `<option value="${escHtml(i.name)}">${i.icon} ${escHtml(i.name)} — ${i.cost} XP</option>`).join('')}
                    </select>
                    <button class="btn btn-xs btn-secondary" id="craft-buy-btn">💰 Buy</button>
                </div>
            ` : ''}
            ${craftCombineSelection.length > 0 ? `
                <button class="btn btn-xs btn-gold" id="craft-combine-btn">⚗️ Combine Selected (${craftCombineSelection.length})</button>
                <button class="btn btn-xs btn-ghost" id="craft-clear-combine-btn">✕ Clear selection</button>
            ` : `<span style="font-size:0.6rem;color:var(--text3);">Check ingredients below to combine (up to 3)</span>`}
        </div>
    `;
}

function renderIngredientInventory(char, ingredientMap) {
    const ingredients = getIngredients(char);
    if (ingredients.length === 0) {
        return `<div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.4rem 0;">No ingredients yet. Forage or buy some above.</div>`;
    }
    return `
        <div class="craft-inventory-grid" style="display:flex;flex-wrap:wrap;gap:0.3rem;">
            ${ingredients.map((name, idx) => {
                const def = ingredientMap[name] || { name, icon: '🧪', common: true };
                const selected = craftCombineSelection.includes(idx);
                return `
                    <span class="craft-ingredient-chip" style="display:inline-flex;align-items:center;gap:0.25rem;background:${selected ? 'var(--gold)' : 'var(--bg3)'};color:${selected ? 'var(--bg1)' : 'var(--text)'};border:1px solid ${selected ? 'var(--gold)' : 'var(--border)'};border-radius:6px;padding:0.15rem 0.4rem;font-size:0.7rem;">
                        <input type="checkbox" ${selected ? 'checked' : ''} data-combine-idx="${idx}" style="margin:0;cursor:pointer;" title="Select for combining" />
                        <span>${def.icon || '🧪'} ${escHtml(name)}</span>
                        <button type="button" data-remove-ingredient-idx="${idx}" title="Discard" style="border:none;background:none;color:inherit;cursor:pointer;font-size:0.65rem;opacity:0.7;padding:0;">✕</button>
                    </span>
                `;
            }).join('')}
        </div>
    `;
}

function renderRecipeCard(recipe, counts, char) {
    const required = recipe.ingredients || [];
    const missing = required.filter(req => !(counts[req] > 0));
    const canCraftFull = missing.length === 0;
    const expanded = craftExpandedRecipe === recipe.id;
    const canAffordXp = availableXp(char) >= recipe.xpCost;

    return `
        <div class="craft-recipe-card" style="background:var(--bg3);border-radius:var(--radius);border-left:3px solid ${canCraftFull ? 'var(--green)' : 'var(--orange)'};padding:0.25rem 0.45rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" data-toggle-recipe="${escHtml(recipe.id)}">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    <span>${recipe.icon || '🔧'}</span>
                    <span style="font-weight:600;font-size:0.8rem;">${escHtml(recipe.name)}</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${escHtml(recipe.tier)} · DV ${recipe.dv} · ${recipe.xpCost} XP</span>
                    ${canCraftFull ? `<span style="font-size:0.55rem;color:var(--green);">✓ Ready</span>` : `<span style="font-size:0.55rem;color:var(--orange);">missing ${missing.length}</span>`}
                </div>
                <span style="font-size:0.65rem;color:var(--text3);">${expanded ? '▾' : '▸'}</span>
            </div>
            ${expanded ? `
                <div style="margin-top:0.3rem;display:flex;flex-direction:column;gap:0.2rem;">
                    <div style="font-size:0.7rem;color:var(--text2);">${escHtml(recipe.description || recipe.effect || '')}</div>
                    <div style="font-size:0.65rem;color:var(--text3);"><strong>Effect:</strong> ${escHtml(recipe.effect)}</div>
                    <div style="display:flex;flex-wrap:wrap;gap:0.2rem;">
                        ${required.map(req => {
                            const has = counts[req] > 0;
                            return `<span style="font-size:0.6rem;padding:0.05rem 0.3rem;border-radius:6px;background:${has ? 'rgba(107,170,122,0.15)' : 'rgba(217,74,74,0.15)'};color:${has ? 'var(--green)' : 'var(--red)'};border:1px solid ${has ? 'var(--green)' : 'var(--red)'};">${has ? '✓' : '✕'} ${escHtml(req)}</span>`;
                        }).join('')}
                    </div>
                    <div style="font-size:0.6rem;color:${canAffordXp ? 'var(--text3)' : 'var(--red)'};">XP available: ${availableXp(char)}${canAffordXp ? '' : ' (not enough)'}</div>
                    <div>
                        <button class="btn btn-xs btn-gold" ${canAffordXp ? '' : 'disabled'} data-craft-recipe="${escHtml(recipe.id)}" title="${canCraftFull ? 'Craft this recipe' : 'Missing ingredients — crafting anyway risks a Flawed result'}">
                            🔨 ${canCraftFull ? 'Craft' : 'Craft Anyway'}
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function renderRecipeBrowser(char, recipeMap) {
    const recipes = Object.values(recipeMap);
    const ingredients = getIngredients(char);
    const counts = {};
    ingredients.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
    if (recipes.length === 0) return `<div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.4rem 0;">No recipes available.</div>`;
    return `<div class="craft-recipe-grid" style="display:flex;flex-direction:column;gap:0.25rem;">${recipes.map(r => renderRecipeCard(r, counts, char)).join('')}</div>`;
}

function renderCraftedItem(item) {
    const uses = item.uses || 1;
    return `
        <div class="crafted-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
            <div style="flex:1;min-width:0;">
                <span style="font-weight:600;">${escHtml(item.name)}</span>
                <span style="font-size:0.65rem;color:var(--text3);">${escHtml(item.effect)}</span>
                ${item.quality ? `<span style="font-size:0.55rem;color:${item.quality === 'standard' ? 'var(--green)' : 'var(--orange)'};">(${item.quality})</span>` : ''}
                <span style="font-size:0.55rem;color:var(--text2);">${uses} uses</span>
            </div>
            <div style="display:flex;gap:0.2rem;">
                <button class="btn btn-xs btn-gold" data-use-crafted="${item.id}" style="font-size:0.6rem;">Use</button>
                <button class="btn btn-xs btn-ghost" data-remove-crafted="${item.id}" style="color:var(--red);font-size:0.6rem;">✕</button>
            </div>
        </div>
    `;
}

function renderCraftingBench(char, ingredientMap, recipeMap) {
    const crafted = getCraftedItems(char);
    return `
        <div class="crafting-bench panel" style="background:var(--bg2);border-radius:var(--radius);padding:0.4rem 0.5rem;border:1px solid var(--border);display:flex;flex-direction:column;gap:0.4rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🧪 Crafting Bench</span>
                <span style="font-size:0.6rem;color:var(--text3);">Mundane items &amp; consumables — a downtime action, 1–2 XP, DV 3 roll</span>
            </div>

            ${renderCraftingToolbar(ingredientMap)}

            <div>
                <div style="font-size:0.7rem;font-weight:600;color:var(--text2);margin-bottom:0.15rem;">📦 Inventory</div>
                ${renderIngredientInventory(char, ingredientMap)}
            </div>

            <div>
                <div style="font-size:0.7rem;font-weight:600;color:var(--text2);margin-bottom:0.15rem;">📜 Recipes</div>
                ${renderRecipeBrowser(char, recipeMap)}
            </div>

            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.15rem;">
                    <span style="font-size:0.7rem;font-weight:600;color:var(--text2);">🎒 Crafted Items</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${crafted.length} on hand</span>
                </div>
                <div style="max-height:120px;overflow-y:auto;">
                    ${crafted.length === 0 ? `<div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.3rem 0;">No crafted items yet.</div>` : crafted.map(c => renderCraftedItem(c)).join('')}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// RENDER – THE CODEX (magic items / consumables / artifacts)
// ============================================================

function upkeepCostFor(item) {
    const cost = item.cost || 0;
    return Math.max(1, Math.ceil(cost / 3));
}

function conditionMeta(condition) {
    if (condition === 'compromised') return { label: 'Compromised', color: 'var(--red)' };
    if (condition === 'neglected') return { label: 'Neglected', color: 'var(--orange)' };
    return { label: 'Maintained', color: 'var(--green)' };
}

function renderCodexFilters(codex) {
    const categories = Object.keys(CATEGORY_META);
    return `
        <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
            ${categories.map(cat => `
                <button class="btn btn-xs ${codexCategoryFilter === cat ? 'btn-gold' : 'btn-ghost'}" data-codex-category="${cat}">
                    ${CATEGORY_META[cat].icon} ${CATEGORY_META[cat].label}
                </button>
            `).join('')}
            ${codexCategoryFilter === 'magic_item' ? `
                <select id="codex-tier-filter" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:0.7rem;padding:0.1rem 0.3rem;">
                    <option value="all" ${codexTierFilter === 'all' ? 'selected' : ''}>All Tiers</option>
                    ${Object.entries(TIER_META).map(([id, m]) => `<option value="${id}" ${codexTierFilter === id ? 'selected' : ''}>${m.label}</option>`).join('')}
                </select>
            ` : ''}
        </div>
    `;
}

function renderCodexEntry(entry, char) {
    const attuned = getAttunedItems(char);
    const isAttuned = attuned.some(a => a.id === entry.id);
    const tierMeta = entry.tier ? (TIER_META[entry.tier] || TIER_META.minor) : null;

    let costLine;
    if (entry.category === 'artifact') {
        costLine = `<span style="font-size:0.65rem;color:var(--gold);">Obligation ${entry.obligation ?? '?'}</span>`;
    } else {
        costLine = `<span style="font-size:0.65rem;color:var(--text3);">${entry.cost ?? '?'} XP${tierMeta ? ` · ${tierMeta.label}` : ''}</span>`;
    }

    return `
        <div class="codex-entry" style="background:var(--bg3);border-radius:var(--radius);border-left:3px solid ${tierMeta ? tierMeta.color : 'var(--gold)'};padding:0.3rem 0.5rem;display:flex;flex-direction:column;gap:0.15rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;font-size:0.8rem;">${entry.icon || '✨'} ${escHtml(entry.title)}</span>
                ${costLine}
            </div>
            <div style="font-size:0.7rem;color:var(--text2);line-height:1.35;">${escHtml(entry.body || '')}</div>
            ${entry.category === 'magic_item' ? `
                <div>
                    <button class="btn btn-xs ${isAttuned ? 'btn-ghost' : 'btn-secondary'}" data-toggle-attune="${entry.id}" ${!isAttuned && attuned.length >= 3 ? 'disabled title="Already attuned to 3 items"' : ''}>
                        ${isAttuned ? '✕ Break Attunement' : '🔗 Attune'}
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

function renderAttunedList(char) {
    const attuned = getAttunedItems(char);
    if (attuned.length === 0) {
        return `<div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.4rem 0;">No items attuned. Attune up to 3 from the Codex below.</div>`;
    }
    return `
        <div style="display:flex;flex-direction:column;gap:0.2rem;">
            ${attuned.map(item => {
                const cond = conditionMeta(item.condition);
                const upkeep = upkeepCostFor(item);
                return `
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.3rem;padding:0.15rem 0.4rem;background:var(--bg3);border-radius:6px;flex-wrap:wrap;">
                        <div>
                            <span style="font-weight:600;font-size:0.75rem;">${item.icon || '✨'} ${escHtml(item.name)}</span>
                            <span style="font-size:0.6rem;color:${cond.color};margin-left:0.3rem;">${cond.label}</span>
                        </div>
                        <div style="display:flex;gap:0.2rem;align-items:center;">
                            <span style="font-size:0.6rem;color:var(--text3);">Upkeep: ${upkeep} XP</span>
                            <button class="btn btn-xs btn-gold" data-pay-upkeep="${item.id}" title="Efficient upkeep: pay XP">Pay</button>
                            <button class="btn btn-xs btn-secondary" data-scene-upkeep="${item.id}" title="Intensive upkeep: 1 XP + a downtime scene">Scene</button>
                            <button class="btn btn-xs btn-ghost" data-retire-item="${item.id}" title="Retire — regain half the XP cost" style="color:var(--red);">Retire</button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderCodex(char, codex) {
    const filtered = codex.filter(e => {
        if (e.category !== codexCategoryFilter) return false;
        if (codexCategoryFilter === 'magic_item' && codexTierFilter !== 'all' && e.tier !== codexTierFilter) return false;
        return true;
    });

    return `
        <div class="crafting-codex panel" style="background:var(--bg2);border-radius:var(--radius);padding:0.4rem 0.5rem;border:1px solid var(--border);display:flex;flex-direction:column;gap:0.4rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">📖 The Codex</span>
                <span style="font-size:0.6rem;color:var(--text3);">Magic items, consumables &amp; artifacts — attunement limit 3, upkeep each downtime</span>
            </div>

            <div>
                <div style="font-size:0.7rem;font-weight:600;color:var(--text2);margin-bottom:0.15rem;">🔗 Attuned Items</div>
                ${renderAttunedList(char)}
            </div>

            <div>
                ${renderCodexFilters(codex)}
                <div style="display:flex;flex-direction:column;gap:0.25rem;max-height:320px;overflow-y:auto;margin-top:0.3rem;">
                    ${filtered.length === 0
                        ? `<div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.4rem 0;">Nothing in this category yet.</div>`
                        : filtered.map(e => renderCodexEntry(e, char)).join('')}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// ACTIONS
// ============================================================

function forageIngredient(char, ingredientMap) {
    const common = Object.values(ingredientMap).filter(i => i.common);
    if (common.length === 0) return showToast('No common ingredients defined.', 'error');
    const picked = common[Math.floor(Math.random() * common.length)];
    const ingredients = getIngredients(char);
    ingredients.push(picked.name);
    saveCharacter({ crafting: char.crafting });
    showToast(`🌿 Foraged ${picked.icon} ${picked.name}`, 'success');
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
    craftCombineSelection = craftCombineSelection.filter(i => i !== index).map(i => (i > index ? i - 1 : i));
    saveCharacter({ crafting: char.crafting });
    showToast(`Removed ${removed}.`, 'info');
    refreshPanel();
}

function toggleCombineSelect(index) {
    const pos = craftCombineSelection.indexOf(index);
    if (pos === -1) {
        if (craftCombineSelection.length >= 3) return showToast('You can combine up to 3 ingredients at once.', 'warning');
        craftCombineSelection.push(index);
    } else {
        craftCombineSelection.splice(pos, 1);
    }
    refreshPanel();
}

function combineIngredients(char, recipeMap) {
    if (craftCombineSelection.length === 0) return showToast('Check at least one ingredient below to combine.', 'warning');
    const ingredients = getIngredients(char);
    const indices = [...new Set(craftCombineSelection)].filter(i => i >= 0 && i < ingredients.length).sort((a, b) => b - a);
    const selectedNames = indices.map(i => ingredients[i]).reverse();
    for (const i of indices) ingredients.splice(i, 1);
    char.crafting.ingredients = ingredients;
    craftCombineSelection = [];

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
        saveCharacter({ crafting: char.crafting });
        showToast(`⚗️ You created an unknown concoction: ${effect}`, 'info');
    }
    refreshPanel();
}

function craftFromRecipe(char, recipeMap, recipeId) {
    const recipe = recipeMap[recipeId];
    if (!recipe) return showToast('Recipe not found.', 'error');

    const required = recipe.ingredients || [];
    const ingredients = getIngredients(char);
    const missing = required.filter(req => !ingredients.some(i => i.toLowerCase() === req.toLowerCase()));

    if (availableXp(char) < recipe.xpCost) return showToast(`Not enough XP. Need ${recipe.xpCost}, have ${availableXp(char)}.`, 'error');

    const skillLevel = char.skills?.[recipe.skill] || 0;
    const attr = recipe.skill === 'medicine' || recipe.skill === 'craft' ? 'wits' : 'spirit';
    const attrValue = char[attr] || 1;
    const pool = attrValue + skillLevel;
    const dv = recipe.dv;
    const result = performRoll(pool, dv);

    let success = false, outcome = '', boons = 0, sbCount = 0;
    if (result.successes >= dv) { success = true; outcome = '✅ Success'; }
    else if (result.successes > 0) { outcome = '⚠️ Partial'; boons = 1; }
    else { outcome = '❌ Failure'; sbCount = result.storyBeats || 1; boons = 2; }

    const updates = {};
    if (success || outcome === '⚠️ Partial') {
        char.xpSpent = (char.xpSpent || 0) + recipe.xpCost;
        updates.xpSpent = char.xpSpent;
    }
    if (boons > 0) {
        char.boons = Math.min(5, (char.boons || 0) + boons);
        updates.boons = char.boons;
    }

    const consumed = [];
    for (const req of required) {
        const idx = ingredients.findIndex(i => i.toLowerCase() === req.toLowerCase());
        if (idx !== -1) { consumed.push(ingredients[idx]); ingredients.splice(idx, 1); }
    }
    char.crafting.ingredients = ingredients;
    updates.crafting = char.crafting;

    if (success || outcome === '⚠️ Partial') {
        const crafted = getCraftedItems(char);
        crafted.push({ id: generateId('crafted_'), name: recipe.name, effect: recipe.effect, quality: success ? 'standard' : 'flawed', uses: recipe.tier === 'standard' ? 2 : 1, recipe: recipe.id, icon: recipe.icon || '🔧', createdAt: Date.now() });
        updates.crafting = char.crafting;
    }

    saveCharacter(updates);
    craftExpandedRecipe = null;

    const outcomeColor = success ? 'var(--green)' : outcome === '⚠️ Partial' ? 'var(--orange)' : 'var(--red)';
    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;max-width:400px;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">🔧 Crafting: ${escHtml(recipe.name)}</div>
            <div style="font-size:0.8rem;color:var(--text2);">${escHtml(recipe.description)}</div>
            <div style="font-size:0.75rem;color:var(--text3);">Pool: ${pool}d · DV: ${dv}</div>
            <div style="font-size:0.7rem;color:var(--text3);">Roll: ${result.dice.join(', ')}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${result.successes}</strong> successes</div>
            <div style="font-size:1rem;font-weight:600;color:${outcomeColor};">${outcome}</div>
            ${success || outcome === '⚠️ Partial' ? `<div style="color:var(--text3);font-size:0.75rem;">Cost: ${recipe.xpCost} XP</div>` : ''}
            ${boons > 0 ? `<div style="color:var(--gold);font-size:0.75rem;">⭐ +${boons} Boon${boons > 1 ? 's' : ''}</div>` : ''}
            ${sbCount > 0 ? `<div style="color:var(--text3);font-size:0.75rem;">📖 GM gains ${sbCount} SB</div>` : ''}
            ${consumed.length > 0 ? `<div style="font-size:0.7rem;color:var(--text3);">Consumed: ${consumed.join(', ')}</div>` : ''}
            ${missing.length > 0 ? `<div style="font-size:0.7rem;color:var(--orange);">Missing ingredients (crafted anyway): ${missing.join(', ')}</div>` : ''}
        </div>
    `;
    showToastWithHTML(msg);
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
        if (attuned.length >= 3) return showToast('Already attuned to 3 items — break one first.', 'warning');
        attuned.push({ id: entry.id, name: entry.title, cost: entry.cost, tier: entry.tier, icon: entry.icon, condition: 'maintained', attunedAt: Date.now() });
        showToast(`🔗 Attuned to ${entry.title}.`, 'success');
    }
    saveCharacter({ crafting: char.crafting });
    refreshPanel();
}

function payUpkeep(char, itemId, mode) {
    const attuned = getAttunedItems(char);
    const item = attuned.find(a => a.id === itemId);
    if (!item) return showToast('Item not found.', 'error');

    if (mode === 'efficient') {
        const cost = upkeepCostFor(item);
        if (availableXp(char) < cost) return showToast(`Not enough XP for upkeep. Need ${cost}.`, 'error');
        char.xpSpent = (char.xpSpent || 0) + cost;
        item.condition = 'maintained';
        saveCharacter({ xpSpent: char.xpSpent, crafting: char.crafting });
        showToast(`💰 Paid ${cost} XP upkeep for ${item.name}.`, 'success');
    } else {
        char.xpSpent = (char.xpSpent || 0) + 1;
        item.condition = 'maintained';
        saveCharacter({ xpSpent: char.xpSpent, crafting: char.crafting });
        showToast(`🕯️ Spent a downtime scene maintaining ${item.name}.`, 'success');
    }
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
        if (clearCombineBtn) { craftCombineSelection = []; return refreshPanel(); }

        const removeIngBtn = e.target.closest('[data-remove-ingredient-idx]');
        if (removeIngBtn) return removeIngredientAt(char, parseInt(removeIngBtn.dataset.removeIngredientIdx, 10));

        const toggleRecipeBtn = e.target.closest('[data-toggle-recipe]');
        if (toggleRecipeBtn) {
            const id = toggleRecipeBtn.dataset.toggleRecipe;
            craftExpandedRecipe = craftExpandedRecipe === id ? null : id;
            return refreshPanel();
        }

        const craftRecipeBtn = e.target.closest('[data-craft-recipe]');
        if (craftRecipeBtn) return craftFromRecipe(char, recipeMap, craftRecipeBtn.dataset.craftRecipe);

        const useCraftedBtn = e.target.closest('[data-use-crafted]');
        if (useCraftedBtn) return useCraftedItem(char, useCraftedBtn.dataset.useCrafted);

        const removeCraftedBtn = e.target.closest('[data-remove-crafted]');
        if (removeCraftedBtn) return removeCraftedItem(char, removeCraftedBtn.dataset.removeCrafted);

        const codexCategoryBtn = e.target.closest('[data-codex-category]');
        if (codexCategoryBtn) { codexCategoryFilter = codexCategoryBtn.dataset.codexCategory; return refreshPanel(); }

        const attuneBtn = e.target.closest('[data-toggle-attune]');
        if (attuneBtn) return toggleAttune(char, codex, safeParseInt(attuneBtn.dataset.toggleAttune, 0));

        const payUpkeepBtn = e.target.closest('[data-pay-upkeep]');
        if (payUpkeepBtn) return payUpkeep(char, payUpkeepBtn.dataset.payUpkeep, 'efficient');

        const sceneUpkeepBtn = e.target.closest('[data-scene-upkeep]');
        if (sceneUpkeepBtn) return payUpkeep(char, sceneUpkeepBtn.dataset.sceneUpkeep, 'intensive');

        const retireBtn = e.target.closest('[data-retire-item]');
        if (retireBtn) return retireItem(char, retireBtn.dataset.retireItem);
    });

    container.addEventListener('change', (e) => {
        const combineCheckbox = e.target.closest('[data-combine-idx]');
        if (combineCheckbox) return toggleCombineSelect(parseInt(combineCheckbox.dataset.combineIdx, 10));

        const tierFilter = e.target.closest('#codex-tier-filter');
        if (tierFilter) { codexTierFilter = tierFilter.value; return refreshPanel(); }
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
    modal.style.cssText = `position: fixed; bottom: 1rem; right: 1rem; z-index: 9999; animation: toastFadeIn 0.2s ease;`;
    const inner = document.createElement('div');
    inner.style.cssText = `background: var(--bg1); padding: 1.2rem; border-radius: var(--radius); max-width: 420px; width: 90vw; border: 1px solid var(--border); box-shadow: 0 8px 32px rgba(0,0,0,0.5); max-height: 60vh; overflow-y: auto;`;
    inner.innerHTML = html + `<br><button class="btn btn-xs btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>`;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    if (!document.getElementById('toast-animation-style')) {
        const style = document.createElement('style');
        style.id = 'toast-animation-style';
        style.textContent = `@keyframes toastFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`;
        document.head.appendChild(style);
    }
    setTimeout(() => { if (modal.parentNode) modal.remove(); }, 10000);
}

// ============================================================
// EXPORT
// ============================================================

export function destroy() {
    container = null;
}

export default { render, destroy };
