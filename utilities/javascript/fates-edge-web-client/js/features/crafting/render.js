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
    getAttunedItems,
    availableXp, conditionMeta, itemRequiresUpkeep, upkeepCostFor,
    ATTUNEMENT_LIMIT
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
                        <span class="crafting-header-title" data-i18n="feature.crafting.render.crafting">Crafting</span>
                        <span class="crafting-header-sub">${escHtml(char.name || 'Unnamed')}</span>
                    </div>
                </div>
                <div class="crafting-header-actions">
                    <span class="crafting-xp-display">${availableXp(char)} XP available</span>
                    <button class="btn btn-ghost btn-xs" id="craft-refresh-btn" title="Reload wiki data" data-i18n-attr="title:feature.crafting.render.reloadWikiData">🔄</button>
                </div>
            </div>
            <div class="crafting-tabs">
                <button class="crafting-tab ${uiState.activeTab === 'crafting' ? 'active' : ''}" data-tab="crafting">⚒ Project bench</button>
                <button class="crafting-tab ${uiState.activeTab === 'collection' ? 'active' : ''}" data-tab="collection">◇ Collection & upkeep</button>
                <button class="crafting-tab ${uiState.activeTab === 'codex' ? 'active' : ''}" data-tab="codex">📖 Codex</button>
            </div>
            <div class="crafting-panel-content">
                ${tabContentHtml}
            </div>
        </div>
    `;
}

// Workshop and collection rendering live in workshop.js.

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
                <span class="panel-title" data-i18n="feature.crafting.render.attunedItems">🔗 Attuned Items</span>
                <span class="crafting-hint">${attuned.length}/${ATTUNEMENT_LIMIT}</span>
            </div>
            <div class="attuned-list">
                ${attuned.length === 0 ? `<div class="crafting-empty-note">No items attuned. Craft Wonders at the bench, or record items your GM has already awarded below. Codex entries are references, not free acquisitions.</div>` :
                attuned.map(item => renderAttunedItem(item)).join('')}
            </div>
        </div>

        <div class="panel">
            <div class="flex-between">
                <span class="panel-title" data-i18n="feature.crafting.render.codex">📖 Codex</span>
                <span class="crafting-hint" data-i18n="feature.crafting.render.magicItemsConsumablesArtifacts">Magic items, consumables & artifacts</span>
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
                <span class="attuned-item-name">${escHtml(item.icon || '✨')} ${escHtml(item.name)}</span>
                <span class="attuned-condition ${escHtml(item.condition)}">${cond.label}</span>
                ${!needsUpkeep ? `<span class="attuned-note">(artifact)</span>` : ''}
                ${compromised ? `<span class="attuned-note compromised">requires quest</span>` : ''}
            </div>
            <div class="attuned-item-actions">
                ${needsUpkeep ? (compromised ? `
                    <button class="btn btn-gold btn-xs" data-restore-item="${escHtml(item.id)}">Record restoration quest complete</button>
                ` : `
                    <span class="attuned-upkeep-cost">Upkeep: ${upkeepCostFor(item)} XP</span>
                    <button class="btn btn-gold btn-xs" data-pay-upkeep="${escHtml(item.id)}" ${item.paidUpkeepThisDowntime ? 'disabled' : ''}>${item.paidUpkeepThisDowntime ? 'Paid this downtime' : 'Pay XP'}</button>
                    <button class="btn btn-secondary btn-xs" data-scene-upkeep="${escHtml(item.id)}" ${item.paidUpkeepThisDowntime ? 'disabled' : ''}>1 XP + scene</button>
                `) : ''}
                <button class="btn btn-ghost btn-xs attuned-retire" data-retire-item="${escHtml(item.id)}">Release · quiet scene</button>
            </div>
        </div>
    `;
}

// ============================================================
// CODEX ENTRY
// ============================================================

export function renderCodexEntry(entry, char) {
    const attuned = getAttunedItems(char);
    const isAttuned = attuned.some(a => String(a.id) === String(entry.id));
    const tierMeta = entry.tier ? (TIER_META[entry.tier] || TIER_META.minor) : null;

    const costLine = entry.category === 'artifact'
        ? `<span class="codex-cost obligation">Obligation ${entry.obligation ?? '?'}</span>`
        : `<span class="codex-cost">${entry.cost ?? '?'} XP${tierMeta ? ` · ${tierMeta.label}` : ''}</span>`;

    return `
        <div class="codex-entry" style="--codex-entry-accent: ${tierMeta ? tierMeta.color : 'var(--gold)'};">
            <div class="codex-entry-header">
                <span class="codex-entry-title">${escHtml(entry.icon || '✨')} ${escHtml(entry.title)}</span>
                ${costLine}
            </div>
            <div class="codex-entry-body">${escHtml(entry.body || '')}</div>
            ${entry.category === 'magic_item' ? `
                <div>
                    <button class="btn btn-gold btn-xs" data-toggle-attune="${escHtml(entry.id)}" ${!isAttuned && attuned.length >= ATTUNEMENT_LIMIT ? `disabled title="Already attuned to ${ATTUNEMENT_LIMIT} items"` : ''}>
                        ${isAttuned ? 'Release · quiet scene' : 'Record owned item · attune'}
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
            <h2 class="crafting-empty-title" data-i18n="feature.crafting.render.selectACharacter">Select a Character</h2>
            <p class="crafting-empty-text">Pick a character to start projects, track finished items, and manage upkeep.</p>
            <div class="crafting-empty-actions">
                ${characters.length > 0 ? `
                    <select id="crafting-char-select" class="crafting-select crafting-char-select">
                        <option value="" data-i18n="feature.crafting.render.chooseACharacter">— Choose a character —</option>
                        ${characters.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.name || 'Unnamed')}</option>`).join('')}
                    </select>
                ` : `<p class="crafting-empty-text">No characters yet — create one on the Characters tab first.</p>`}
                <button class="btn btn-gold" id="craft-go-to-vtt-btn" data-i18n="feature.crafting.render.goToVTT">🎯 Go to VTT</button>
            </div>
        </div>
    `;
}
