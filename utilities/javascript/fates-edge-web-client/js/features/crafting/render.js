/**
 * Crafting feature — HTML templating.
 *
 * Every function here is a pure string-builder: (data, uiState) -> HTML.
 * No DOM access, no persistence, no event wiring — that all lives in
 * index.js. All presentational styling comes from CSS classes defined
 * in css/app.css under "CRAFTING FEATURE" (plus the app-wide
 * .btn/.panel/.flex-between/etc. component classes) — there is
 * deliberately no inline `style="..."` or `<style>` block anywhere in
 * this module; see that app.css section for the class reference.
 */

import { escHtml } from '@core/utils.js';
import { TIER_META, CATEGORY_META } from './data.js';
import {
    getIngredients, getCraftedItems, getAttunedItems, getCraftingLog,
    availableXp, conditionMeta, itemRequiresUpkeep, upkeepCostFor,
    ATTUNEMENT_LIMIT, FORAGE_LIMIT_PER_DOWNTIME, getForageCount
} from './state.js';

// ============================================================
// ROOT SHELL (header + tabs)
// ============================================================

export function renderRoot(char, tabContentHtml, uiState) {
    return `
        <div class="crafting-container">
            <div class="crafting-header">
                <div class="crafting-header-left">
                    <span class="crafting-icon-lg">🔨</span>
                    <div>
                        <span class="crafting-header-title">Crafting</span>
                        <span class="crafting-header-sub">${escHtml(char.name || 'Unnamed')}</span>
                    </div>
                </div>
                <div class="crafting-header-actions">
                    <span class="crafting-xp-display">${availableXp(char)} XP available</span>
                    <button class="btn btn-ghost btn-xs" id="craft-refresh-btn" title="Reload wiki data">🔄</button>
                </div>
            </div>
            <div class="crafting-tabs">
                <button class="crafting-tab ${uiState.activeTab === 'crafting' ? 'active' : ''}" data-tab="crafting">🧪 Crafting</button>
                <button class="crafting-tab ${uiState.activeTab === 'codex' ? 'active' : ''}" data-tab="codex">📖 Codex</button>
            </div>
            <div class="crafting-panel-content">
                ${tabContentHtml}
            </div>
        </div>
    `;
}

// ============================================================
// CRAFTING TAB
// ============================================================

export function renderCraftingTab(char, ingredientMap, recipeMap, refinementMap, uiState) {
    const ingredients = getIngredients(char);
    const crafted = getCraftedItems(char);
    const log = getCraftingLog(char);

    const refinementIds = Object.keys(refinementMap);
    const normalRecipes = Object.values(recipeMap).filter(r => !refinementIds.includes(r.id));

    let filtered = normalRecipes;
    if (uiState.recipeSearchQuery.trim()) {
        const q = uiState.recipeSearchQuery.toLowerCase();
        filtered = filtered.filter(r => r.name.toLowerCase().includes(q) || r.effect.toLowerCase().includes(q));
    }
    if (uiState.recipeSkillFilter !== 'all') {
        filtered = filtered.filter(r => r.skill === uiState.recipeSkillFilter);
    }
    if (uiState.recipeTierFilter !== 'all') {
        filtered = filtered.filter(r => r.tier === uiState.recipeTierFilter);
    }

    const counts = {};
    ingredients.forEach(n => { counts[n] = (counts[n] || 0) + 1; });

    const refinements = Object.values(refinementMap);
    const forageCount = getForageCount(char);
    const forageExhausted = forageCount >= FORAGE_LIMIT_PER_DOWNTIME;

    return `
        <div class="crafting-toolbar">
            <button class="btn btn-secondary btn-xs" id="craft-forage-btn" ${forageExhausted ? 'disabled' : ''}
                title="${forageExhausted ? `No forage attempts left this downtime (${FORAGE_LIMIT_PER_DOWNTIME}/${FORAGE_LIMIT_PER_DOWNTIME} used)` : 'Forage a random common ingredient'}">
                🌿 Forage <span class="crafting-forage-count">(${forageCount}/${FORAGE_LIMIT_PER_DOWNTIME})</span>
            </button>
            <div class="crafting-inline-group">
                <select id="craft-buy-select" class="crafting-select">
                    ${Object.values(ingredientMap).filter(i => !i.common).map(i => `<option value="${escHtml(i.name)}">${i.icon} ${escHtml(i.name)} — ${i.cost} XP</option>`).join('')}
                </select>
                <button class="btn btn-secondary btn-xs" id="craft-buy-btn">💰 Buy</button>
            </div>
            <div class="crafting-inline-group">
                <span class="crafting-hint">Batch:</span>
                <input type="number" id="craft-batch-qty" class="crafting-input crafting-input-narrow" value="${uiState.batchQuantity}" min="1" max="10" />
            </div>
            ${uiState.craftCombineSelection.length > 0 ? `
                <button class="btn btn-gold btn-xs" id="craft-combine-btn">⚗️ Combine (${uiState.craftCombineSelection.length})</button>
                <button class="btn btn-ghost btn-xs" id="craft-clear-combine-btn">✕</button>
            ` : `<span class="crafting-hint">Check ingredients below to combine (up to 3)</span>`}
        </div>

        <div class="panel">
            <div class="flex-between">
                <span class="panel-title">📦 Inventory</span>
                <span class="crafting-hint">${ingredients.length} items</span>
            </div>
            <div class="craft-inventory-grid">
                ${ingredients.length === 0 ? `<div class="crafting-empty-note">No ingredients. Forage or buy some.</div>` :
                ingredients.map((name, idx) => {
                    const def = ingredientMap[name] || { name, icon: '🧪', common: true };
                    const selected = uiState.craftCombineSelection.includes(idx);
                    return `
                        <span class="craft-ingredient-chip ${selected ? 'selected' : ''}">
                            <input type="checkbox" ${selected ? 'checked' : ''} data-combine-idx="${idx}" />
                            <span>${def.icon} ${escHtml(name)}</span>
                            <button type="button" class="craft-ingredient-remove" data-remove-ingredient-idx="${idx}">✕</button>
                        </span>
                    `;
                }).join('')}
            </div>
        </div>

        ${refinements.length > 0 ? `
            <div class="panel">
                <div class="flex-between">
                    <span class="panel-title">⚗️ Refinement (ingredient crafting)</span>
                    <span class="crafting-hint">Turn base ingredients into advanced reagents</span>
                </div>
                <div class="craft-refinement-grid">
                    ${refinements.map(r => renderRefinementCard(r, counts, char)).join('')}
                </div>
            </div>
        ` : ''}

        <div class="panel">
            <div class="flex-between">
                <span class="panel-title">📜 Recipes</span>
                <div class="crafting-inline-group crafting-recipe-filters">
                    <input type="text" id="recipe-search" class="crafting-input" placeholder="Search..." value="${escHtml(uiState.recipeSearchQuery)}" />
                    <select id="recipe-skill-filter" class="crafting-select">
                        <option value="all" ${uiState.recipeSkillFilter === 'all' ? 'selected' : ''}>All Skills</option>
                        ${['craft', 'medicine', 'lore', 'arcana'].map(s => `<option value="${s}" ${uiState.recipeSkillFilter === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
                    </select>
                    <select id="recipe-tier-filter" class="crafting-select">
                        <option value="all" ${uiState.recipeTierFilter === 'all' ? 'selected' : ''}>All Tiers</option>
                        ${Object.keys(TIER_META).map(t => `<option value="${t}" ${uiState.recipeTierFilter === t ? 'selected' : ''}>${TIER_META[t].label}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="craft-recipe-grid">
                ${filtered.length === 0 ? `<div class="crafting-empty-note">No recipes match.</div>` :
                filtered.map(r => renderRecipeCard(r, counts, char, uiState)).join('')}
            </div>
        </div>

        <div class="panel">
            <div class="flex-between">
                <span class="panel-title">🎒 Crafted Items</span>
                <span class="crafting-hint">${crafted.length} on hand</span>
            </div>
            <div class="craft-crafted-list">
                ${crafted.length === 0 ? `<div class="crafting-empty-note">No crafted items.</div>` :
                crafted.map(c => renderCraftedItem(c)).join('')}
            </div>
        </div>

        ${log.length > 0 ? `
            <div class="crafting-log">
                <div class="crafting-log-title">📋 Recent Crafts</div>
                ${log.slice(0, 5).map(entry => `
                    <div class="crafting-log-entry">
                        <span>${entry.icon || '🔧'} ${escHtml(entry.name)}${entry.quality ? ` (${entry.quality})` : ''}</span>
                        <span class="crafting-log-time">${new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
}

// ============================================================
// REFINEMENT CARD
// ============================================================

export function renderRefinementCard(recipe, counts, char) {
    const required = recipe.ingredients || [];
    const missing = required.filter(req => !(counts[req] > 0));
    const canCraft = missing.length === 0;
    const canAffordXp = availableXp(char) >= recipe.xpCost;

    return `
        <div class="craft-recipe-card refinement ${canCraft ? 'ready' : 'missing'}">
            <div class="craft-recipe-header-left">
                <span>${recipe.icon}</span>
                <span class="craft-recipe-name">${escHtml(recipe.name)}</span>
                <span class="craft-refine-output">→ ${escHtml(recipe.outputIngredient)}</span>
            </div>
            <div class="craft-recipe-desc">${escHtml(recipe.description)}</div>
            <div class="craft-ingredient-list">
                ${required.map(req => {
                    const has = counts[req] > 0;
                    return `<span class="craft-ingredient-tag ${has ? 'has' : 'missing'}">${has ? '✓' : '✕'} ${escHtml(req)}</span>`;
                }).join('')}
            </div>
            <div>
                <button class="btn btn-gold btn-xs" ${canCraft && canAffordXp ? '' : 'disabled'} data-refine-recipe="${escHtml(recipe.id)}">
                    ⚗️ Refine (${recipe.xpCost} XP)
                </button>
            </div>
        </div>
    `;
}

// ============================================================
// RECIPE CARD
// ============================================================

export function renderRecipeCard(recipe, counts, char, uiState) {
    const required = recipe.ingredients || [];
    const missing = required.filter(req => !(counts[req] > 0));
    const canCraftFull = missing.length === 0;
    const expanded = uiState.craftExpandedRecipe === recipe.id;
    const canAffordXp = availableXp(char) >= recipe.xpCost * uiState.batchQuantity;

    return `
        <div class="craft-recipe-card ${canCraftFull ? 'ready' : 'missing'}">
            <div class="craft-recipe-header" data-toggle-recipe="${escHtml(recipe.id)}">
                <div class="craft-recipe-header-left">
                    <span>${recipe.icon || '🔧'}</span>
                    <span class="craft-recipe-name">${escHtml(recipe.name)}</span>
                    <span class="craft-recipe-meta">${escHtml(recipe.tier)} · DV ${recipe.dv} · ${recipe.xpCost} XP</span>
                    <span class="craft-recipe-status ${canCraftFull ? 'ready' : 'missing'}">${canCraftFull ? '✓ Ready' : '✕ missing'}</span>
                </div>
                <span class="craft-recipe-toggle">${expanded ? '▾' : '▸'}</span>
            </div>
            ${expanded ? `
                <div class="craft-recipe-details">
                    <div class="craft-recipe-desc">${escHtml(recipe.description || recipe.effect || '')}</div>
                    <div><strong>Effect:</strong> ${escHtml(recipe.effect)}</div>
                    <div class="craft-ingredient-list">
                        ${required.map(req => {
                            const has = counts[req] > 0;
                            return `<span class="craft-ingredient-tag ${has ? 'has' : 'missing'}">${has ? '✓' : '✕'} ${escHtml(req)}</span>`;
                        }).join('')}
                    </div>
                    <div class="recipe-xp-note ${canAffordXp ? '' : 'insufficient'}">
                        XP available: ${availableXp(char)}${canAffordXp ? '' : ' (not enough for batch)'}
                    </div>
                    <div>
                        <button class="btn btn-gold btn-xs" ${canAffordXp ? '' : 'disabled'} data-craft-recipe="${escHtml(recipe.id)}">
                            🔨 Craft (x${uiState.batchQuantity})
                        </button>
                        ${!canCraftFull ? `<span class="recipe-missing-note">Missing ingredients — may risk Flawed result</span>` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================================
// CRAFTED ITEM
// ============================================================

export function renderCraftedItem(item) {
    const uses = item.uses || 1;
    return `
        <div class="crafted-item">
            <div class="crafted-item-info">
                <span class="crafted-item-name">${escHtml(item.name)}</span>
                <span class="crafted-item-effect">${escHtml(item.effect)}</span>
                ${item.quality ? `<span class="crafted-item-quality ${item.quality === 'standard' ? 'standard' : 'flawed'}">(${item.quality})</span>` : ''}
                <span class="crafted-item-uses">${uses} uses</span>
            </div>
            <div class="crafted-item-actions">
                <button class="btn btn-gold btn-xs" data-use-crafted="${item.id}">Use</button>
                <button class="btn btn-ghost btn-xs crafted-item-remove" data-remove-crafted="${item.id}">✕</button>
            </div>
        </div>
    `;
}

// ============================================================
// CODEX TAB
// ============================================================

export function renderCodexTab(char, codex, uiState) {
    const attuned = getAttunedItems(char);
    const filtered = codex.filter(e => {
        if (e.category !== uiState.codexCategoryFilter) return false;
        if (uiState.codexCategoryFilter === 'magic_item' && uiState.codexTierFilter !== 'all' && e.tier !== uiState.codexTierFilter) return false;
        return true;
    });

    return `
        <div class="panel">
            <div class="flex-between">
                <span class="panel-title">🔗 Attuned Items</span>
                <span class="crafting-hint">${attuned.length}/${ATTUNEMENT_LIMIT}</span>
            </div>
            <div class="attuned-list">
                ${attuned.length === 0 ? `<div class="crafting-empty-note">No items attuned. Attune up to 3 from the Codex below.</div>` :
                attuned.map(item => renderAttunedItem(item)).join('')}
            </div>
        </div>

        <div class="panel">
            <div class="flex-between">
                <span class="panel-title">📖 Codex</span>
                <span class="crafting-hint">Magic items, consumables &amp; artifacts</span>
            </div>
            <div class="codex-filters">
                ${Object.keys(CATEGORY_META).map(cat => `
                    <button class="btn btn-xs ${uiState.codexCategoryFilter === cat ? 'btn-gold' : 'btn-secondary'}" data-codex-category="${cat}">
                        ${CATEGORY_META[cat].icon} ${CATEGORY_META[cat].label}
                    </button>
                `).join('')}
                ${uiState.codexCategoryFilter === 'magic_item' ? `
                    <select id="codex-tier-filter" class="crafting-select">
                        <option value="all" ${uiState.codexTierFilter === 'all' ? 'selected' : ''}>All Tiers</option>
                        ${Object.entries(TIER_META).map(([id, m]) => `<option value="${id}" ${uiState.codexTierFilter === id ? 'selected' : ''}>${m.label}</option>`).join('')}
                    </select>
                ` : ''}
            </div>
            <div class="codex-entry-list">
                ${filtered.length === 0 ? `<div class="crafting-empty-note">Nothing in this category yet.</div>` :
                filtered.map(e => renderCodexEntry(e, char)).join('')}
            </div>
        </div>
    `;
}

// ============================================================
// ATTUNED ITEM
// ============================================================

export function renderAttunedItem(item) {
    const cond = conditionMeta(item.condition);
    const needsUpkeep = itemRequiresUpkeep(item);
    const compromised = item.condition === 'compromised';

    return `
        <div class="attuned-item">
            <div class="attuned-item-info">
                <span class="attuned-item-name">${item.icon || '✨'} ${escHtml(item.name)}</span>
                <span class="attuned-condition ${item.condition}">${cond.label}</span>
                ${!needsUpkeep ? `<span class="attuned-note">(artifact)</span>` : ''}
                ${compromised ? `<span class="attuned-note compromised">requires quest</span>` : ''}
            </div>
            <div class="attuned-item-actions">
                ${needsUpkeep ? (compromised ? `
                    <button class="btn btn-gold btn-xs" data-restore-item="${item.id}">✨ Restore</button>
                ` : `
                    <span class="attuned-upkeep-cost">Upkeep: ${upkeepCostFor(item)} XP</span>
                    <button class="btn btn-gold btn-xs" data-pay-upkeep="${item.id}">Pay</button>
                    <button class="btn btn-secondary btn-xs" data-scene-upkeep="${item.id}">Scene</button>
                `) : ''}
                <button class="btn btn-ghost btn-xs attuned-retire" data-retire-item="${item.id}">Retire</button>
            </div>
        </div>
    `;
}

// ============================================================
// CODEX ENTRY
// ============================================================

export function renderCodexEntry(entry, char) {
    const attuned = getAttunedItems(char);
    const isAttuned = attuned.some(a => a.id === entry.id);
    const tierMeta = entry.tier ? (TIER_META[entry.tier] || TIER_META.minor) : null;

    const costLine = entry.category === 'artifact'
        ? `<span class="codex-cost obligation">Obligation ${entry.obligation ?? '?'}</span>`
        : `<span class="codex-cost">${entry.cost ?? '?'} XP${tierMeta ? ` · ${tierMeta.label}` : ''}</span>`;

    return `
        <div class="codex-entry" style="--codex-entry-accent: ${tierMeta ? tierMeta.color : 'var(--gold)'};">
            <div class="codex-entry-header">
                <span class="codex-entry-title">${entry.icon || '✨'} ${escHtml(entry.title)}</span>
                ${costLine}
            </div>
            <div class="codex-entry-body">${escHtml(entry.body || '')}</div>
            ${entry.category === 'magic_item' ? `
                <div>
                    <button class="btn btn-gold btn-xs" data-toggle-attune="${entry.id}" ${!isAttuned && attuned.length >= ATTUNEMENT_LIMIT ? `disabled title="Already attuned to ${ATTUNEMENT_LIMIT} items"` : ''}>
                        ${isAttuned ? '✕ Break Attunement' : '🔗 Attune'}
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================================
// NO-CHARACTER VIEW
// ============================================================

export function renderNoCharacterView(characters) {
    return `
        <div class="crafting-container crafting-empty-state">
            <div class="crafting-empty-icon">🔨</div>
            <h2 class="crafting-empty-title">Select a Character</h2>
            <p class="crafting-empty-text">Pick a character to forage ingredients, work recipes, and browse the Codex.</p>
            <div class="crafting-empty-actions">
                ${characters.length > 0 ? `
                    <select id="crafting-char-select" class="crafting-select crafting-char-select">
                        <option value="">— Choose a character —</option>
                        ${characters.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.name || 'Unnamed')}</option>`).join('')}
                    </select>
                ` : `<p class="crafting-empty-text">No characters yet — create one on the Characters tab first.</p>`}
                <button class="btn btn-gold" id="craft-go-to-vtt-btn">🎯 Go to VTT</button>
            </div>
        </div>
    `;
}

// ============================================================
// TOAST-WITH-HTML CONTENT (crafting/refinement roll result)
// ============================================================

export function renderCraftResultToast({ recipe, quantity, pool, dv, result, outcome, outcomeClass, totalXpCost, boons, sbCount, consumed, missing, itemsCreated }) {
    return `
        <div class="craft-result-toast">
            <div class="craft-result-title">🔧 Crafting: ${escHtml(recipe.name)} (×${quantity})</div>
            <div class="craft-result-desc">${escHtml(recipe.description)}</div>
            <div class="craft-result-meta">Pool: ${pool}d · DV: ${dv}</div>
            <div class="craft-result-roll">Roll: ${result.dice.join(', ')}</div>
            <div class="craft-result-successes">Rolled: <strong>${result.successes}</strong> successes</div>
            <div class="craft-result-outcome ${outcomeClass}">${outcome}</div>
            ${totalXpCost > 0 ? `<div class="craft-result-cost">Cost: ${totalXpCost} XP</div>` : ''}
            ${boons > 0 ? `<div class="craft-result-boons">⭐ +${boons} Boon${boons > 1 ? 's' : ''}</div>` : ''}
            ${sbCount > 0 ? `<div class="craft-result-sb">📖 GM gains ${sbCount} SB</div>` : ''}
            ${consumed.length > 0 ? `<div class="craft-result-consumed">Consumed: ${consumed.join(', ')}</div>` : ''}
            ${missing.length > 0 ? `<div class="craft-result-missing">Missing ingredients (crafted anyway): ${missing.join(', ')}</div>` : ''}
            ${itemsCreated.length > 0 ? `<div class="craft-result-created">Created ${itemsCreated.length} item${itemsCreated.length > 1 ? 's' : ''}</div>` : ''}
            <button class="btn btn-secondary btn-xs craft-result-close" type="button">Close</button>
        </div>
    `;
}
