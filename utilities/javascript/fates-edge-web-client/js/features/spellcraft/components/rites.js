/**
 * Rites / Songs / Arts – Patron-specific magical abilities
 * 
 * Displays rites from the patron's JSON data with expandable details,
 * obligation tracking, and integration with the character's magic path.
 * 
 * Data source: /data/patrons/<patron-id>.json (loaded by patrons feature)
 * Uses the patrons module for data loading and management.
 * 
 * PATH-AWARE: Supports both Runekeepers (single patron) and Invokers (multiple patrons).
 * 
 * TIER STANDARDIZATION: Supports the standardized Low/Standard/High tiers
 * (used by Cantors), while remaining backward‑compatible with older tier
 * names (Basic, Advanced, Master, Epic, Cantrip).
 * 
 * NEW: Patron's Gifts (Imbuement) for Runekeepers with Familiar (Thiasos) only,
 * and Borrowed Grace for Invokers carrying Symbols.
 *
 * ────────────────────────────────────────────────────────────────────────
 * RULES FIX (this pass) — Rites must be learned, not free access:
 * Player's Guide §9.7 ("Step 5: Choose Your First Rites") has a Runekeeper
 * buy two starting Low Rites individually with XP — every Rite in every
 * patron's catalog throughout the book carries its own XP cost (e.g.
 * "Road-Sense (Low, 4 XP)"), and "buy new Rites" is listed alongside
 * raising Attributes/Skills as an ordinary XP expenditure during play.
 * Crack the Seal (§4.2.3, Invoker) explicitly resolves "a KNOWN Rite" —
 * implying an Invoker's usable Rites are a specific acquired subset too,
 * not their whole patron's catalog. This file used to show every rite
 * from every carried patron as immediately usable the moment you had a
 * Symbol (Invoker) or Codex (Runekeeper). It now checks each Rite against
 * `char.rites` (a plain array of learned Rite names — already present on
 * the character schema in editor.js/wizard.js) and only allows Crack the
 * Seal on Rites actually in that list. Unlearned Rites still display in
 * full (so you can browse and decide what's worth learning) with a
 * "📖 Learn (X XP)" button that spends the Rite's own listed `xp` cost.
 * ────────────────────────────────────────────────────────────────────────
 *
 * ────────────────────────────────────────────────────────────────────────
 * NEW: VTT integration — every invocation (Patron's Gift, Borrowed Grace,
 * Crack the Seal) now sends a beautifully formatted card to the VTT,
 * matching the spellbook's style. Uses window.sendToVTT if available.
 * ────────────────────────────────────────────────────────────────────────
 */

import { t as i18nText } from '@core/i18n.js';
import { getState, saveState, getCharacter, updateCharacter } from '@core/state.js';
import { showToast } from '@components/Toast.js';
import { escHtml, safeParseInt } from '@core/utils.js';
import patrons from '@features/patrons/index.js';

const { 
    loadPatronData, 
    getPatronObligation, 
    setPatronObligation,
    savePatronData 
} = patrons;

// ============================================================
// CONFIGURATION
// ============================================================

// Known rivalries for Cross-Resonance warnings (for Invokers)
const KNOWN_RIVALRIES = {
    'aveh': ['oath-of-flame-light', 'varnek-karn', 'sealed-gate'],
    'oath-of-flame-light': ['aveh', 'khemesh', 'ikasha'],
    'ikasha': ['oath-of-flame-light', 'the-witness'],
    'the-witness': ['ikasha', 'silent-choir'],
    'raeyn': ['khemesh'],
    'khemesh': ['raeyn', 'oath-of-flame-light'],
    'livaea': ['maelstraeus'],
    'maelstraeus': ['livaea', 'morag-the-hag'],
    'morag-the-hag': ['maelstraeus'],
    'thrysos': ['palinode'],
    'palinode': ['thrysos'],
};

// ============================================================
// MODULE STATE (for Invoker patron selection)
// ============================================================

let selectedInvokerPatron = null;      // currently selected patron ID for the open rites panel
let currentRitesParams = null;         // store parameters for re-rendering

// ============================================================
// HELPERS
// ============================================================

function safeString(val) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(v => safeString(v)).join(', ');
    if (typeof val === 'object') {
        if (val.name) return safeString(val.name);
        if (val.label) return safeString(val.label);
        if (val.description) return safeString(val.description);
        if (val.effect) return safeString(val.effect);
        if (val.text) return safeString(val.text);
        if (val.quote) return safeString(val.quote);
        if (val.lore) return safeString(val.lore);
        try { return JSON.stringify(val); } catch (e) { return '[object]'; }
    }
    return String(val);
}

function formatText(text) {
    if (!text) return '';
    return escHtml(text).replace(/\n/g, '<br>');
}

/**
 * Sort rites by tier (using standardized tiers plus legacy names).
 */
function sortRites(a, b) {
    const tiers = {
        'Cantrip': 0,
        'Basic': 1,
        'Low': 1,
        'Standard': 2,
        'Advanced': 3,
        'Master': 4,
        'Epic': 5,
        'High': 6
    };
    const tierA = tiers[a.tier] ?? 99;
    const tierB = tiers[b.tier] ?? 99;
    if (tierA !== tierB) return tierA - tierB;
    return (a.name || '').localeCompare(b.name || '');
}

function getTierColor(tier) {
    const colors = {
        'Cantrip': 'var(--text3)',
        'Basic': '#6baa7a',
        'Low': '#6baa7a',
        'Standard': '#d4af37',
        'Advanced': '#c47a7a',
        'Master': '#b84a8a',
        'Epic': '#d94a4a',
        'High': '#8e44ad'
    };
    return colors[tier] || 'var(--text2)';
}

function getTierBadge(tier) {
    const badges = {
        'Cantrip': '🎵',
        'Basic': '🟢',
        'Low': '🟢',
        'Standard': '🟡',
        'Advanced': '🟠',
        'Master': '🔴',
        'Epic': '🟣',
        'High': '👑'
    };
    return badges[tier] || '📜';
}

function getPatronName(patronId, state) {
    if (!patronId) return patronId;
    const found = findPatronData(state, patronId);
    return found?.name || found?.title || patronId;
}

/**
 * Find a patron in the state by ID, checking both cosmic and terrestrial patrons.
 * Also tries to reload patron data if none is found.
 */
function findPatronData(state, patronId) {
    if (!patronId) return null;

    // First, try the state passed in
    let patronData = findInState(state, patronId);
    if (patronData) return patronData;

    // If not found, get the global state (in case state is a shallow copy)
    const globalState = getState();
    if (globalState !== state) {
        patronData = findInState(globalState, patronId);
        if (patronData) return patronData;
    }

    return null;
}

function findInState(state, patronId) {
    if (!state?.patrons) return null;

    if (state.patrons.cosmic) {
        const found = state.patrons.cosmic.find(p => p.id === patronId);
        if (found) return found;
    }

    if (state.patrons.terrestrial) {
        const found = state.patrons.terrestrial.find(p => p.id === patronId);
        if (found) return found;
    }

    if (state.patrons.religions) {
        for (const religion of state.patrons.religions) {
            if (religion.orders) {
                const found = religion.orders.find(o => o.id === patronId);
                if (found) {
                    return {
                        ...found,
                        _religion: religion.name,
                        _religionIcon: religion.icon
                    };
                }
            }
        }
    }

    return null;
}

function getRivalryWarnings(patronIds) {
    const warnings = [];
    for (let i = 0; i < patronIds.length; i++) {
        for (let j = i + 1; j < patronIds.length; j++) {
            const a = patronIds[i];
            const b = patronIds[j];
            if (KNOWN_RIVALRIES[a]?.includes(b) || KNOWN_RIVALRIES[b]?.includes(a)) {
                warnings.push([a, b]);
            }
        }
    }
    return warnings;
}

// ─── Patron's Gift helpers ──────────────────────────────────

function getPatronGift(patronData) {
    if (!patronData) return null;
    return patronData.patrons_gift || null;
}

// ─── Rite Obligation cost parsing (for Crack the Seal) ──────
function parseRiteBaseObligationCost(rite) {
    const costStr = safeString(rite?.cost || '');
    const match = costStr.match(/\+\s*(\d+)\s*Obligation/i);
    if (match) return parseInt(match[1], 10);
    return 1;
}

// ─── Character Tier (for High Rite gating) ─────────────────
const TIER_THRESHOLDS = [
    { min: 0,   max: 40,       tier: 'I',   name: 'Novice' },
    { min: 41,  max: 90,       tier: 'II',  name: 'Seasoned' },
    { min: 91,  max: 150,      tier: 'III', name: 'Veteran' },
    { min: 151, max: 220,      tier: 'IV',  name: 'Paragon' },
    { min: 221, max: Infinity, tier: 'V',   name: 'Mythic' }
];

const TIER_RANK = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5 };

function getCharacterTier(char) {
    if (char && char.tier && TIER_RANK[char.tier]) return char.tier;
    const totalXp = (char && char.totalXp) || 0;
    const found = TIER_THRESHOLDS.find(t => totalXp >= t.min && totalXp <= t.max);
    return found ? found.tier : 'I';
}

function meetsTierRequirement(char, requiredTier) {
    const charRank = TIER_RANK[getCharacterTier(char)] || 1;
    const requiredRank = TIER_RANK[requiredTier] || 1;
    return charRank >= requiredRank;
}

// ─── Rite identity (patron-scoped) ─────────────────────────
function riteKey(patronId, riteName) {
    return `${patronId}::${riteName}`;
}

function isRiteKnown(char, patronId, riteName) {
    const known = (char && char.rites) || [];
    if (known.includes(riteKey(patronId, riteName))) return true;
    // Legacy fallback: pre-fix characters may only have the bare name.
    return known.includes(riteName);
}

// ─── Check if character has access to Patron's Gifts ──────
function hasAccessToPatronGifts(char) {
    if (!char) return false;
    if (char.magicPath === 'runekeeper') {
        return (char.learnedTalents || []).includes('familiar');
    }
    if (char.magicPath === 'invoker') {
        return (char.symbols || []).length > 0;
    }
    return false;
}

function hasAccessToRites(char) {
    if (!char) return false;
    if (char.magicPath === 'runekeeper') {
        return (char.learnedTalents || []).includes('codex');
    }
    if (char.magicPath === 'invoker') {
        return (char.symbols || []).length > 0;
    }
    return false;
}

// ============================================================
// VTT HELPERS
// ============================================================

function sendVTTMessage(html) {
    if (typeof window.sendToVTT === 'function') {
        window.sendToVTT(html, 'System', { isHTML: true });
    } else {
        console.warn('[Rites] VTT not available — message not sent.');
    }
}

function buildGiftCardHtml(title, patronName, patronIcon, effect, costDetails, extraNote = '') {
    return `
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--border);
            border-inline-start:4px solid var(--gold);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    <span style="font-size:1.2rem;">${escHtml(patronIcon || '🔮')}</span>
                    <span style="font-weight:700;font-size:1.05rem;color:var(--gold);">${escHtml(title)}</span>
                </div>
                <span style="font-size:0.65rem;color:var(--text3);">${escHtml(patronName)}</span>
            </div>
            ${effect ? `<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;">${formatText(effect)}</div>` : ''}
            ${costDetails ? `<div style="font-size:0.7rem;color:var(--text3);margin-top:0.15rem;">${formatText(costDetails)}</div>` : ''}
            ${extraNote ? `<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">${formatText(extraNote)}</div>` : ''}
        </div>
    `;
}

function buildRiteCardHtml(riteName, patronName, patronIcon, effect, costDetails, extraNote = '') {
    return `
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--border);
            border-inline-start:4px solid var(--gold);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    <span style="font-size:1.2rem;">${escHtml(patronIcon || '📜')}</span>
                    <span style="font-weight:700;font-size:1.05rem;color:var(--gold);">${escHtml(riteName)}</span>
                </div>
                <span style="font-size:0.65rem;color:var(--text3);">${escHtml(patronName)}</span>
            </div>
            ${effect ? `<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;">${formatText(effect)}</div>` : ''}
            ${costDetails ? `<div style="font-size:0.7rem;color:var(--text3);margin-top:0.15rem;">${formatText(costDetails)}</div>` : ''}
            ${extraNote ? `<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">${formatText(extraNote)}</div>` : ''}
        </div>
    `;
}

// ============================================================
// MAIN RENDER
// ============================================================

export async function renderRites(el, patronIds, characterId, options = {}) {
    if (!el) return;

    // Ensure patron data is loaded
    await loadPatronData();

    // Normalize IDs: convert underscores to hyphens and lowercase
    const normalizeId = (id) => id.replace(/_/g, '-').toLowerCase();
    let ids = Array.isArray(patronIds) ? patronIds : (patronIds ? [patronIds] : []);
    ids = ids.map(normalizeId).filter(id => id && id.trim() !== '');

    const path = options.path || 'runekeeper';
    const charName = options.characterName || 'Character';

    // Get character from state
    const state = getState();
    const char = state.characters?.find(c => c.id === characterId) || state.characters?.[characterId];
    if (!char) {
        el.innerHTML = `<div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);">Character not found.</div>`;
        return;
    }

    // Debug: log what we have
    console.log('[Rites] Received patronIds (after normalization):', ids);
    console.log('[Rites] Available cosmic patrons:', state.patrons?.cosmic?.map(p => p.id) || []);

    // If no patron IDs provided, show a helpful message
    if (ids.length === 0) {
        let guidance = '';
        if (char.magicPath === 'invoker') {
            guidance = 'Add Symbols in the Character Editor (Invoker tab).';
        } else if (char.magicPath === 'runekeeper') {
            guidance = 'Set a Bound Patron in the Character Editor (Runekeeper tab).';
        } else if (char.magicPath === 'cantor') {
            guidance = 'Set a Bound Patron in the Character Editor (Cantor tab).';
        } else {
            guidance = 'Select a magic path that uses patrons (Invoker, Runekeeper, Cantor) in the Character Editor.';
        }
        el.innerHTML = `
            <div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
                <div style="font-size:1.5rem;">🔮</div>
                <p>No patron selected for this character.</p>
                <p style="font-size:0.85rem;">${guidance}</p>
            </div>
        `;
        return;
    }

    // Gather patron data for the IDs, with retry logic
    let patronDataList = [];
    let notFound = [];
    let retried = false;

    const gatherData = () => {
        patronDataList = [];
        notFound = [];
        for (const id of ids) {
            if (!id) continue;
            // Try to find by normalized ID
            let data = findPatronData(state, id);
            // If not found, try the original (in case someone passed hyphenated)
            if (!data && id.includes('-')) {
                const altId = id.replace(/-/g, '_');
                data = findPatronData(state, altId);
            }
            if (data) {
                patronDataList.push(data);
            } else {
                notFound.push(id);
            }
        }
    };

    gatherData();

    // If some patrons were not found, try force-reloading the data once
    if (notFound.length > 0 && !retried) {
        console.warn('[Rites] Patrons not found:', notFound, '– forcing reload of patron data.');
        await loadPatronData(true); // force reload
        retried = true;
        // Re-gather data after reload
        gatherData();
    }

    // If still not found, create dummy patrons for each missing ID
    if (notFound.length > 0) {
        console.warn('[Rites] Still missing some patrons after reload – creating dummy entries for:', notFound);
        for (const id of notFound) {
            patronDataList.push({
                id: id,
                name: `Unknown Patron (${id})`,
                title: `Unknown`,
                icon: '❓',
                description: 'This patron could not be loaded from the data files. Please check the patron ID or refresh the data.',
                rites: [],
                patrons_gift: null,
                color: 'var(--text3)',
                _dummy: true
            });
        }
        notFound = [];
    }

    if (patronDataList.length === 0) {
        el.innerHTML = `
            <div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);">
                <div style="font-size:1.5rem;">🔮</div>
                <p>No patron data found for any of the provided IDs.</p>
                <p style="font-size:0.85rem;">Try refreshing the patrons tab or check the console for details.</p>
                <button class="btn btn-sm btn-secondary" onclick="window.refreshPatrons && window.refreshPatrons()" data-i18n="feature.spellcraft.components.rites.refreshPatrons">🔄 Refresh Patrons</button>
            </div>
        `;
        return;
    }

    // ─── BUILD THE RITES PANEL ──────────────────────────────────────
    // We'll construct HTML for all patrons, showing gifts and rites.
    let html = '';
    const isInvoker = path === 'invoker';
    const isMultiPatron = patronDataList.length > 1;

    // Cross-Resonance warnings for Invokers
    if (isInvoker && isMultiPatron) {
        const patronIds = patronDataList.map(p => p.id);
        const warnings = getRivalryWarnings(patronIds);
        if (warnings.length > 0) {
            html += `
                <div class="info-box" style="border-inline-start-color:var(--orange);margin-bottom:0.5rem;">
                    <strong>⚠️ Cross-Resonance Warning:</strong> Carrying symbols from rival patrons:
                    ${warnings.map(([a, b]) => {
                        const nameA = getPatronName(a, state);
                        const nameB = getPatronName(b, state);
                        return `<span style="color:var(--orange);">${nameA} & ${nameB}</span>`;
                    }).join('; ')}
                    <br><span style="font-size:0.7rem;color:var(--text3);">Using rites from rival patrons simultaneously may incur additional Obligation or complications.</span>
                </div>
            `;
        }
    }

    // ─── New Scene button ────────────────────────────────────────────
    html += `
        <div style="display:flex;justify-content:flex-end;margin-bottom:0.5rem;">
            <button class="btn btn-sm btn-secondary" onclick="window.startNewScene('${characterId}')">🎬 New Scene</button>
        </div>
    `;

    // ─── Render each patron ──────────────────────────────────────────
    for (const patronData of patronDataList) {
        // Render Patron's Gift (if any)
        const giftHtml = renderPatronGiftsForSinglePatron(char, patronData, path, characterId);
        if (giftHtml) html += giftHtml;

        // Render Rites
        const ritesHtml = renderSinglePatronRites(patronData, characterId, charName, ids, path, char);
        html += ritesHtml;
    }

    // ─── Insert into container ──────────────────────────────────────
    el.innerHTML = html;

    // ─── Attach event listeners for expand/collapse ────────────────
    attachRiteToggleEvents(el);

    // ─── Store current parameters for future updates ────────────────
    currentRitesParams = { patronIds: ids, characterId, options };
}

// ============================================================
// RENDER PATRON'S GIFTS FOR A SINGLE PATRON
// ============================================================

function renderPatronGiftsForSinglePatron(char, patronData, path, characterId) {
    const gift = getPatronGift(patronData);
    if (!gift) return '';

    const isRunekeeper = path === 'runekeeper';
    const isInvoker = path === 'invoker';

    const patronId = patronData.id;
    const patronName = patronData.name || patronData.title;
    const patronIcon = patronData.icon || '🔮';
    const name = safeString(gift.name || 'Patron\'s Gift');
    const description = safeString(gift.description || '');
    const effect = safeString(gift.effect || '');
    const costDesc = safeString(gift.cost || '+1 Obligation');

    const costOptionsHtml = `
        <option value="boon" data-i18n="feature.spellcraft.components.rites.1Boon">1 Boon</option>
        <option value="fatigue" data-i18n="feature.spellcraft.components.rites.1Fatigue">1 Fatigue</option>
    `;

    const isCompromised = isInvoker && (char.compromisedSymbols || []).includes(patronId);
    const borrowedGraceUsed = !!(char.sceneFlags && char.sceneFlags.borrowedGrace);

    return `
        <div class="patron-gifts" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-inline-start:4px solid var(--gold);margin-bottom:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">${isRunekeeper ? '🔮 Patron\'s Gift' : '🎴 Borrowed Grace (Symbol)'}</span>
                <span style="font-size:0.6rem;color:var(--text3);">${isInvoker && borrowedGraceUsed ? 'used this scene' : ''}</span>
            </div>
            <div class="gift-item" style="display:flex;flex-direction:column;gap:0.2rem;padding:0.2rem 0.3rem;border-bottom:1px solid var(--border);background:var(--bg3);border-radius:var(--radius);margin-top:0.1rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    <span style="font-size:1.1rem;">${patronIcon}</span>
                    <span style="font-weight:600;font-size:0.85rem;">${escHtml(name)}</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${escHtml(patronName)}</span>
                    ${isRunekeeper ? `<span style="font-size:0.55rem;color:var(--gold);">(Bound)</span>` : `<span style="font-size:0.55rem;color:var(--orange);">(Symbol)</span>`}
                    ${isCompromised ? `<span style="font-size:0.55rem;color:var(--red);">⚠️ Compromised: −1 die</span>` : ''}
                </div>
                <div style="font-size:0.75rem;color:var(--text2);">${formatText(description)}</div>
                <div style="font-size:0.7rem;color:var(--text3);">${formatText(effect)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:0.2rem;align-items:center;margin-top:0.1rem;">
                    <span style="font-size:0.65rem;color:var(--text3);">Cost: ${escHtml(costDesc)}</span>
                    ${isRunekeeper ? `
                        <button class="btn btn-xs btn-primary" onclick="window.usePatronGift('${patronId}', '${characterId}')" style="font-size:0.6rem;">Use Gift</button>
                    ` : `
                        <select id="gift-${patronId}-cost" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.2rem;" ${borrowedGraceUsed ? 'disabled' : ''}>
                            ${costOptionsHtml}
                        </select>
                        <button class="btn btn-xs ${borrowedGraceUsed ? 'btn-secondary' : 'btn-gold'}" ${borrowedGraceUsed ? 'disabled' : ''} onclick="window.useBorrowedGrace('${patronId}', document.getElementById('gift-${patronId}-cost').value, '${characterId}')" style="font-size:0.6rem;">
                            ${borrowedGraceUsed ? '✓ Used this scene' : 'Invoke Borrowed Grace'}
                        </button>
                    `}
                </div>
            </div>
            <div style="font-size:0.55rem;color:var(--text3);margin-top:0.1rem;">
                ${isRunekeeper ? 'Patron\'s Gift is an Imbuement: once per scene, touch an item to gain +1 die to a thematic skill and a special benefit. Costs +1 Obligation.' : 'Borrowed Grace: once per scene, spend 1 Boon or 1 Fatigue, mark +1 Obligation, and gain the Symbol\'s Gift effect. Works at −1 die if the Symbol is Compromised. Use "🎬 New Scene" above to reset.'}
            </div>
        </div>
    `;
}

// ============================================================
// RENDER A SINGLE PATRON'S RITES
// ============================================================

function renderSinglePatronRites(patronData, characterId, charName, allPatronIds, path, char) {
    const patronId = patronData.id;
    const rites = patronData.rites || [];
    const name = safeString(patronData.name || patronData.title || patronId);
    const icon = safeString(patronData.icon || '🔮');
    const domain = safeString(patronData.domain || patronData.subtitle || '');
    const color = patronData.color || 'var(--gold)';
    const isInvoker = path === 'invoker';
    const isMultiPatron = allPatronIds && allPatronIds.length > 1;

    const obligation = getPatronObligation(characterId, patronId);
    const totalObligation = isMultiPatron ? allPatronIds.reduce((sum, id) => sum + getPatronObligation(characterId, id), 0) : obligation;

    if (rites.length === 0) {
        return `
            <div class="rites-patron-block" style="border-inline-start:3px solid ${color};padding-inline-start:0.5rem;background:var(--bg2);border-radius:var(--radius);padding:0.5rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span style="font-size:1.2rem;">${escHtml(icon)}</span>
                    <span style="font-weight:600;color:${color};">${escHtml(name)}</span>
                    <span style="font-size:0.7rem;color:var(--text3);">— no rites listed</span>
                </div>
                ${isInvoker ? `<div style="font-size:0.6rem;color:var(--text3);">Symbol carried. Obligation: ${obligation}</div>` : ''}
            </div>
        `;
    }

    const sortedRites = [...rites].sort(sortRites);

    // Group by tier
    const grouped = {};
    sortedRites.forEach(rite => {
        const tier = rite.tier || 'Basic';
        if (!grouped[tier]) grouped[tier] = [];
        grouped[tier].push(rite);
    });

    let html = `
        <div class="rites-patron-block" style="border-inline-start:3px solid ${color};padding-inline-start:0.5rem;background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
            <!-- Header -->
            <div class="rites-header" style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;border-bottom:1px solid var(--border);padding-bottom:0.2rem;margin-bottom:0.2rem;">
                <span style="font-size:1.2rem;">${escHtml(icon)}</span>
                <span style="font-weight:600;font-size:1rem;color:${color};">${escHtml(name)}</span>
                ${domain ? `<span style="font-size:0.7rem;color:var(--text3);">— ${escHtml(domain)}</span>` : ''}
                <span style="font-size:0.65rem;color:var(--text3);margin-inline-start:auto;">${rites.length} rites · Obligation: ${obligation}</span>
            </div>

            <!-- ─── Obligation Controls ────────────────────────── -->
            <div class="rites-obligation" style="display:flex;gap:0.2rem;align-items:center;font-size:0.75rem;margin-bottom:0.2rem;flex-wrap:wrap;">
                <span style="color:var(--text3);">⛓️ Obligation:</span>
                <span style="font-weight:600;font-size:0.85rem;">${obligation}</span>
                <button class="btn btn-xs btn-primary" onclick="window.addRiteObligation('${patronId}', 1, '${characterId}')">+1</button>
                <button class="btn btn-xs btn-secondary" onclick="window.addRiteObligation('${patronId}', -1, '${characterId}')">−1</button>
                <button class="btn btn-xs btn-ghost" onclick="window.clearRiteObligation('${patronId}', '${characterId}')" style="color:var(--red);">✕ Clear</button>
                ${isInvoker ? `
                    <span style="font-size:0.55rem;color:var(--text3);margin-inline-start:0.3rem;">
                        (${isMultiPatron ? `Symbol ${allPatronIds.indexOf(patronId) + 1}/${allPatronIds.length}` : 'Single Symbol'})
                    </span>
                ` : ''}
                ${isInvoker && isMultiPatron ? `
                    <span style="font-size:0.55rem;color:var(--orange);margin-inline-start:0.3rem;">
                        ⚡ Cross-Resonance possible
                    </span>
                ` : ''}
            </div>

            <!-- ─── Patron Relationship (Runekeeper) ─────────────── -->
            ${!isInvoker && char ? `
                <div class="rites-relationship" style="font-size:0.65rem;color:var(--text3);margin-bottom:0.2rem;">
                    <strong>📿 Relationship:</strong> 
                    ${char.patronTier ? `Tier ${char.patronTier} · ` : ''}
                    ${char.patronBond ? `${char.patronBond} · ` : ''}
                    ${char.patronFavor || 'Covenant maintained'}
                </div>
            ` : ''}

            <!-- Rites list -->
            <div class="rites-list" style="display:flex;flex-direction:column;gap:0.3rem;max-height:350px;overflow-y:auto;padding:0.1rem;">
    `;

    const tierOrder = ['Cantrip', 'Basic', 'Low', 'Standard', 'Advanced', 'Master', 'Epic', 'High'];
    tierOrder.forEach(tier => {
        if (!grouped[tier]) return;
        const ritesInTier = grouped[tier];
        const tierColor = getTierColor(tier);
        const badge = getTierBadge(tier);

        html += `
            <div class="rite-tier-group" style="margin-top:0.1rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;font-size:0.7rem;color:${tierColor};font-weight:600;border-bottom:1px solid var(--border);padding-bottom:0.05rem;margin-bottom:0.1rem;">
                    ${badge} ${tier} (${ritesInTier.length})
                </div>
        `;

        ritesInTier.forEach((rite, localIdx) => {
            const globalIdx = rites.indexOf(rite);
            html += renderRiteItem(rite, patronId, globalIdx, isInvoker, characterId, char, localIdx === 0);
        });

        html += `</div>`;
    });

    html += `
            </div>
        </div>
    `;

    return html;
}

// ============================================================
// RENDER A SINGLE RITE
// ============================================================

function renderRiteItem(rite, patronId, idx, isInvoker, characterId, char, isFirstInTier = false) {
    const riteId = `${patronId}-rite-${idx}`;
    const name = safeString(rite.name);
    const tier = safeString(rite.tier || 'Basic');
    const xp = rite.xp || rite.cost;
    const xpCost = safeParseInt(rite.xp, 0);
    const action = safeString(rite.action || '');
    const range = safeString(rite.range || '');
    const resist = safeString(rite.resist || '');
    const tags = rite.tags || [];
    const materials = safeString(rite.materials || '');
    const effect = safeString(rite.effect || rite.description || '');
    const pushIt = safeString(rite.push_it || '');
    const cost = safeString(rite.cost || '');
    const requires = safeString(rite.requires || '');
    const invoke = safeString(rite.invoke || '');
    const duration = safeString(rite.duration || '');
    const timer = safeString(rite.timer || '');

    const hasDetails = !!(effect || pushIt || materials || cost || requires || invoke || duration || timer || tags.length > 0);
    const color = getTierColor(tier);

    const expanded = isFirstInTier && hasDetails;

    const isKnown = isRiteKnown(char, patronId, name);

    const canCrackSeal = isInvoker && isKnown;

    const baseObligationCost = parseRiteBaseObligationCost(rite);
    const isHighTier = tier.toLowerCase() === 'high';
    const crackMinimum = isHighTier ? 3 : 2;
    const crackCostPreview = Math.max(baseObligationCost * 2, crackMinimum);

    const tierLocked = isHighTier && !isKnown && !meetsTierRequirement(char, 'III');
    const charTierDisplay = getCharacterTier(char);

    let detailsHtml = '';
    if (hasDetails) {
        detailsHtml = `
            <div class="rite-details" style="margin-top:0.3rem;padding:0.3rem 0.5rem;background:var(--bg2);border-radius:var(--radius);${expanded ? '' : 'display:none;'}">
                ${effect ? `<div class="rite-description" style="margin-bottom:0.2rem;line-height:1.4;font-size:0.85rem;">${formatText(effect)}</div>` : ''}
                ${materials ? `<div class="rite-meta" style="font-size:0.75rem;color:var(--text2);margin-bottom:0.1rem;"><strong>📦 Materials:</strong> ${formatText(materials)}</div>` : ''}
                ${pushIt ? `<div class="rite-meta" style="font-size:0.75rem;color:var(--text2);margin-bottom:0.1rem;"><strong>⚡ Push It:</strong> ${formatText(pushIt)}</div>` : ''}
                <div style="display:flex;flex-wrap:wrap;gap:0.2rem 0.6rem;font-size:0.7rem;color:var(--text3);margin-top:0.1rem;">
                    ${action ? `<span><strong>Action:</strong> ${escHtml(action)}</span>` : ''}
                    ${range ? `<span><strong>Range:</strong> ${escHtml(range)}</span>` : ''}
                    ${resist ? `<span><strong>Resist:</strong> ${escHtml(resist)}</span>` : ''}
                    ${duration ? `<span><strong>Duration:</strong> ${escHtml(duration)}</span>` : ''}
                    ${invoke ? `<span><strong>Invoke:</strong> ${escHtml(invoke)}</span>` : ''}
                    ${requires ? `<span><strong>Requires:</strong> ${escHtml(requires)}</span>` : ''}
                    ${cost ? `<span><strong>Cost:</strong> ${escHtml(cost)}</span>` : ''}
                    ${timer ? `<span><strong>Timer:</strong> ${escHtml(timer)}</span>` : ''}
                </div>
                ${tags.length > 0 ? `
                    <div class="rite-tags" style="display:flex;gap:0.15rem;flex-wrap:wrap;margin-top:0.1rem;">
                        ${tags.map(t => `<span class="tag-badge" style="display:inline-block;padding:0.05rem 0.3rem;border-radius:6px;background:var(--bg3);border:1px solid var(--border);font-size:0.6rem;color:var(--text3);">${escHtml(safeString(t))}</span>`).join('')}
                    </div>
                ` : ''}
                <div style="margin-top:0.2rem;display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-ghost" onclick="window.sendRiteCard('${patronId}', ${idx}, '${characterId}')" title="Send a formatted reference card to the VTT — no cost, no roll, works whether or not you've learned this rite" style="font-size:0.6rem;">
                        📡
                    </button>
                    ${tierLocked ? `
                        <span style="font-size:0.65rem;color:var(--red);" title="High Rites require Tier III or higher" data-i18n-attr="title:feature.spellcraft.components.rites.highRitesRequireTierIIIOrHigher">
                            🔒 Requires Tier III (currently Tier ${escHtml(charTierDisplay)})
                        </span>
                    ` : !isKnown ? `
                        <button class="btn btn-xs btn-gold" onclick="window.learnRite('${patronId}', ${idx}, '${characterId}')" title="Add this Rite to your known Rites for ${xpCost} XP">
                            📖 Learn (${xpCost} XP)
                        </button>
                    ` : `
                        <button class="btn btn-xs btn-gold" onclick="window.invokeRite('${patronId}', ${idx}, '${characterId}')" title="Invoke this rite normally, paying its listed Obligation cost, and send a card to the VTT">
                            🔮 Invoke (+${baseObligationCost} Obligation)
                        </button>
                        ${canCrackSeal ? `
                            <button class="btn btn-xs btn-danger" onclick="window.crackTheSeal('${patronId}', ${idx}, '${characterId}')" title="Invoke instantly at double the rite's Obligation cost (min +2, or +3 for High Rites)">
                                💥 Crack the Seal
                            </button>
                            <span style="font-size:0.55rem;color:var(--text3);align-self:center;">+${crackCostPreview} Obligation · Instant · Symbol becomes Compromised</span>
                        ` : ''}
                    `}
                </div>
            </div>
        `;
    }

    return `
        <div class="rite-item ${hasDetails ? 'rite-expandable' : ''}" data-rite-id="${escHtml(riteId)}" style="background:var(--bg3);border-radius:var(--radius);padding:0.2rem 0.5rem;border-inline-start:2px solid ${color};margin-bottom:0.1rem;${isKnown ? '' : 'opacity:0.75;'}">
            <div class="rite-header" style="display:flex;justify-content:space-between;align-items:center;cursor:${hasDetails ? 'pointer' : 'default'};">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    <span class="rite-name" style="font-weight:600;font-size:0.85rem;">${escHtml(name)}</span>
                    ${xp ? `<span style="font-size:0.65rem;color:var(--text3);">${escHtml(xp)} XP</span>` : ''}
                    ${isKnown
                        ? `<span style="font-size:0.55rem;color:var(--green);">✓ Known</span>`
                        : `<span style="font-size:0.55rem;color:var(--text3);">📖 Not learned</span>`}
                </div>
                <div style="display:flex;align-items:center;gap:0.2rem;">
                    ${tier ? `<span style="font-size:0.55rem;color:${color};font-weight:600;">${escHtml(tier)}</span>` : ''}
                    ${hasDetails ? `<span class="rite-expand-icon" style="font-size:0.65rem;color:var(--text3);">${expanded ? '▾' : '▸'}</span>` : ''}
                </div>
            </div>
            ${detailsHtml}
        </div>
    `;
}

// ============================================================
// RITE TOGGLE HELPERS
// ============================================================

function attachRiteToggleEvents(el) {
    el.querySelectorAll('.rite-expandable .rite-header').forEach(header => {
        header.addEventListener('click', (e) => {
            const item = header.closest('.rite-item');
            if (!item) return;
            const details = item.querySelector('.rite-details');
            if (!details) return;
            const isExpanded = details.style.display !== 'none';
            details.style.display = isExpanded ? 'none' : 'block';
            const icon = item.querySelector('.rite-expand-icon');
            if (icon) icon.textContent = isExpanded ? '▸' : '▾';
            const riteId = item.dataset.riteId;
            if (riteId) {
                const expanded = JSON.parse(sessionStorage.getItem('fates-edge-expanded-rites') || '{}');
                if (isExpanded) delete expanded[riteId];
                else expanded[riteId] = true;
                sessionStorage.setItem('fates-edge-expanded-rites', JSON.stringify(expanded));
            }
        });
    });

    // Restore expanded states
    const expanded = JSON.parse(sessionStorage.getItem('fates-edge-expanded-rites') || '{}');
    el.querySelectorAll('.rite-item[data-rite-id]').forEach(item => {
        const id = item.dataset.riteId;
        if (expanded[id]) {
            const details = item.querySelector('.rite-details');
            if (details) details.style.display = 'block';
            const icon = item.querySelector('.rite-expand-icon');
            if (icon) icon.textContent = '▾';
        }
    });
}

// ============================================================
// GLOBAL FUNCTIONS: Patron's Gift (Runekeeper) — WITH VTT
// ============================================================

window.usePatronGift = async function(patronId, characterId) {
    const char = getState().characters?.find(c => c.id === characterId);
    if (!char) {
        showToast(i18nText("feature.spellcraft.components.rites.characterNotFound", null, "Character not found."), 'error');
        return;
    }
    if (char.magicPath !== 'runekeeper') {
        showToast(i18nText("feature.spellcraft.components.rites.onlyRunekeepersCanUsePatronSGift", null, "Only Runekeepers can use Patron's Gift."), 'error');
        return;
    }
    if (!(char.learnedTalents || []).includes('familiar')) {
        showToast(i18nText("feature.spellcraft.components.rites.youNeedAFamiliarThiasosToUse", null, "You need a Familiar (Thiasos) to use Patron's Gift."), 'error');
        return;
    }

    const state = getState();
    const patronData = findPatronData(state, patronId);
    if (!patronData) {
        showToast(i18nText("feature.spellcraft.components.rites.patronNotFound", null, "Patron not found."), 'error');
        return;
    }
    const gift = getPatronGift(patronData);
    if (!gift) {
        showToast(i18nText("feature.spellcraft.components.rites.thisPatronHasNoGiftDefined", null, "This patron has no Gift defined."), 'error');
        return;
    }

    // Apply cost: +1 Obligation
    const currentObligation = getPatronObligation(char.id, patronId);
    setPatronObligation(char.id, patronId, currentObligation + 1);
    savePatronData();

    const name = safeString(gift.name || 'Patron\'s Gift');
    const effect = safeString(gift.effect || 'The item glows with patron\'s favor.');
    const costDetails = `Obligation +1 (now ${currentObligation + 1})`;

    showToast(i18nText("feature.spellcraft.components.rites.valueValueObligation1", { value0: name, value1: effect }, "✨ {{value0}}: {{value1}} (Obligation +1)"), 'success');

    // Send VTT card
    const cardHtml = buildGiftCardHtml(
        name,
        patronData.name || patronData.title || patronId,
        patronData.icon || '🔮',
        effect,
        costDetails,
        'Runekeeper — Patron\'s Gift (Imbuement)'
    );
    sendVTTMessage(cardHtml);

    // Refresh the rites view
    const container = document.getElementById('spellcraft-content');
    if (container) {
        import('@features/spellcraft/index.js').then(module => {
            if (module.renderActiveTabContent) module.renderActiveTabContent();
        });
    }
};

// ============================================================
// GLOBAL FUNCTIONS: Borrowed Grace (Invoker) — WITH VTT
// ============================================================

window.useBorrowedGrace = async function(patronId, costType, characterId = 'default-character') {
    const char = getState().characters?.find(c => c.id === characterId);
    if (!char) return;

    if (char.magicPath !== 'invoker') {
        showToast(i18nText("feature.spellcraft.components.rites.onlyInvokersCanUseBorrowedGrace", null, "Only Invokers can use Borrowed Grace."), 'error');
        return;
    }
    if (!(char.symbols || []).includes(patronId)) {
        showToast(i18nText("feature.spellcraft.components.rites.youDoNotCarryASymbolFor", null, "You do not carry a Symbol for this patron."), 'error');
        return;
    }

    if (char.sceneFlags && char.sceneFlags.borrowedGrace) {
        showToast(i18nText("feature.spellcraft.components.rites.borrowedGraceHasAlreadyBeenUsedThis", null, "Borrowed Grace has already been used this scene. Start a New Scene to use it again."), 'error');
        return;
    }

    const isCompromised = (char.compromisedSymbols || []).includes(patronId);

    // Deduct cost (Boon or Fatigue)
    if (costType === 'boon') {
        const boons = char.boons || 0;
        if (boons < 1) {
            showToast(i18nText("feature.spellcraft.components.rites.notEnoughBoonsNeed1Boon", null, "Not enough Boons! Need 1 Boon."), 'error');
            return;
        }
        char.boons = boons - 1;
    } else if (costType === 'fatigue') {
        const fatigue = char.fatigue || 0;
        const maxFatigue = char.attributes?.body || 1;
        if (fatigue >= maxFatigue) {
            showToast(i18nText("feature.spellcraft.components.rites.fatigueTrackIsFull", null, "Fatigue track is full!"), 'error');
            return;
        }
        char.fatigue = fatigue + 1;
    } else {
        showToast(i18nText("feature.spellcraft.components.rites.invalidCostTypeChooseBoonOrFatigue", null, "Invalid cost type. Choose boon or fatigue."), 'error');
        return;
    }

    // Apply Obligation (+1)
    const currentObligation = getPatronObligation(char.id, patronId);
    setPatronObligation(char.id, patronId, currentObligation + 1);
    savePatronData();

    // Mark Borrowed Grace as used for this scene
    if (!char.sceneFlags) char.sceneFlags = {};
    char.sceneFlags.borrowedGrace = true;

    const state = getState();
    const patronData = findPatronData(state, patronId);
    if (!patronData) {
        showToast(i18nText("feature.spellcraft.components.rites.patronNotFound", null, "Patron not found."), 'error');
        return;
    }
    const gift = getPatronGift(patronData);
    if (!gift) {
        showToast(i18nText("feature.spellcraft.components.rites.thisPatronHasNoGiftDefined", null, "This patron has no Gift defined."), 'error');
        return;
    }

    const name = safeString(gift.name || 'Borrowed Grace');
    const effect = safeString(gift.effect || 'The Symbol flares with borrowed power.');
    const costDetails = `Cost: 1 ${costType}, Obligation +1 (now ${currentObligation + 1})`;
    const penaltyNote = isCompromised ? '⚠️ Symbol is Compromised — this applies at −1 die.' : '';

    showToast(i18nText("feature.spellcraft.components.rites.valueValueValueCost1ValueObligation", { value0: name, value1: effect, value2: penaltyNote ? ' ' + penaltyNote : '', value3: costType }, "🎴 {{value0}}: {{value1}}{{value2}} (Cost: 1 {{value3}}, Obligation +1)"), 'success');

    // Send VTT card
    const cardHtml = buildGiftCardHtml(
        name,
        patronData.name || patronData.title || patronId,
        patronData.icon || '🔮',
        effect,
        costDetails,
        `Invoker — Borrowed Grace${penaltyNote ? ' · ' + penaltyNote : ''}`
    );
    sendVTTMessage(cardHtml);

    // Save character changes. char is the live reference returned by
    // state.characters.find() above, already mutated in place (boons/
    // fatigue/sceneFlags) — this just needs to persist it, matching
    // startNewScene()'s pattern below rather than the nonexistent
    // saveCharacter(characterId, updates) this used to call.
    saveState();

    // Refresh the rites view
    const container = document.getElementById('spellcraft-content');
    if (container) {
        import('@features/spellcraft/index.js').then(module => {
            if (module.renderActiveTabContent) module.renderActiveTabContent();
        });
    }
};

// ─── New Scene (resets once-per-scene abilities) ──────────────

window.startNewScene = function(characterId = 'default-character') {
    const state = getState();
    const char = state.characters?.find(c => c.id === characterId) || state.characters?.[characterId];
    if (!char) return;

    char.sceneFlags = {};
    saveState();
    showToast(i18nText("feature.spellcraft.components.rites.newSceneOncePerSceneAbilitiesLike", null, "🎬 New scene — once-per-scene abilities (like Borrowed Grace) are available again."), 'info');

    const container = document.getElementById('spellcraft-content');
    if (container) {
        import('@features/spellcraft/index.js').then(module => {
            if (module.renderActiveTabContent) module.renderActiveTabContent();
        });
    }
};

// ============================================================
// CRACK THE SEAL (Invokers only) — WITH VTT
// ============================================================

window.learnRite = function(patronId, riteIndex, characterId = 'default-character') {
    const state = getState();
    const patronData = findPatronData(state, patronId);
    if (!patronData) {
        showToast(i18nText("feature.spellcraft.components.rites.patronNotFound", null, "Patron not found."), 'error');
        return;
    }

    const rite = patronData.rites?.[riteIndex];
    if (!rite) {
        showToast(i18nText("feature.spellcraft.components.rites.riteNotFound", null, "Rite not found."), 'error');
        return;
    }

    const char = state.characters?.find(c => c.id === characterId) || state.characters?.[characterId];
    if (!char) {
        showToast(i18nText("feature.spellcraft.components.rites.characterNotFound", null, "Character not found."), 'error');
        return;
    }

    const riteName = safeString(rite.name);
    if (!char.rites) char.rites = [];
    if (isRiteKnown(char, patronId, riteName)) {
        showToast(i18nText("feature.spellcraft.components.rites.valueIsAlreadyKnown", { value0: riteName }, "\"{{value0}}\" is already known."), 'info');
        return;
    }

    // RULES FIX: High Rites require Tier III+.
    const riteTier = safeString(rite.tier || '');
    if (riteTier.toLowerCase() === 'high' && !meetsTierRequirement(char, 'III')) {
        showToast(i18nText("feature.spellcraft.components.rites.valueIsAHighRiteAndRequires", { value0: riteName, value1: getCharacterTier(char) }, "\"{{value0}}\" is a High Rite and requires Tier III (you're Tier {{value1}})."), 'error');
        return;
    }

    const xpCost = safeParseInt(rite.xp, 0);
    const totalXp = char.totalXp || 0;
    const spent = char.xpSpent || 0;
    const available = totalXp - spent;

    if (xpCost > 0 && available < xpCost) {
        showToast(i18nText("feature.spellcraft.components.rites.notEnoughXPNeedValueHaveValue", { value0: xpCost, value1: available }, "Not enough XP. Need {{value0}}, have {{value1}} available."), 'error');
        return;
    }

    if (!confirm(i18nText("feature.spellcraft.components.rites.learnValueValueForValueXP", { value0: riteName, value1: rite.tier || '', value2: xpCost }, "Learn \"{{value0}}\" ({{value1}}) for {{value2}} XP?"))) return;

    char.rites.push(riteKey(patronId, riteName));
    char.xpSpent = spent + xpCost;
    saveState();
    showToast(i18nText("feature.spellcraft.components.rites.learnedValueValueXPSpent", { value0: riteName, value1: xpCost }, "📖 Learned \"{{value0}}\" ({{value1}} XP spent)."), 'success');

    const container = document.getElementById('spellcraft-content');
    if (container) {
        import('@features/spellcraft/index.js').then(module => {
            if (module.renderActiveTabContent) module.renderActiveTabContent();
        });
    }
};

// ============================================================
// INVOKE RITE (normal use — Runekeepers and Invokers) — WITH VTT
// ============================================================
// This was the missing piece: previously a known Rite had no action at
// all for a Runekeeper, and an Invoker only had the emergency-priced
// Crack the Seal. This pays the rite's listed (non-doubled) Obligation
// cost, same as Crack the Seal but without the double cost or the
// Symbol-Compromised penalty, and sends the same style of VTT card.
window.invokeRite = function(patronId, riteIndex, characterId = 'default-character') {
    const state = getState();
    const patronData = findPatronData(state, patronId);
    if (!patronData) {
        showToast(i18nText("feature.spellcraft.components.rites.patronNotFound", null, "Patron not found."), 'error');
        return;
    }

    const rite = patronData.rites?.[riteIndex];
    if (!rite) {
        showToast(i18nText("feature.spellcraft.components.rites.riteNotFound", null, "Rite not found."), 'error');
        return;
    }

    const riteName = safeString(rite.name);
    const char = state.characters?.find(c => c.id === characterId) || state.characters?.[characterId];
    if (!char || !isRiteKnown(char, patronId, riteName)) {
        showToast(i18nText("feature.spellcraft.components.rites.youHavenTLearnedValueYetLearn", { value0: riteName }, "You haven't learned \"{{value0}}\" yet — learn it first."), 'error');
        return;
    }

    const baseCost = parseRiteBaseObligationCost(rite);
    const currentObligation = getPatronObligation(characterId, patronId);
    const newObligation = currentObligation + baseCost;
    const actionText = safeString(rite.action || '');

    if (!confirm(i18nText("feature.spellcraft.components.rites.invokeValueValueCostValueObligationTotal", { value0: riteName, value1: actionText ? ` (${actionText})` : '', value2: baseCost, value3: currentObligation, value4: newObligation }, "Invoke \"{{value0}}\"{{value1}}?\n\nCost: +{{value2}} Obligation (total: {{value3}} → {{value4}})."))) return;

    setPatronObligation(characterId, patronId, newObligation);
    savePatronData();

    const costDetails = `Obligation +${baseCost} (now ${newObligation})`;
    const effect = safeString(rite.effect || rite.description || 'The rite resolves.');
    const extraNote = [actionText, safeString(rite.range || '')].filter(Boolean).join(' · ');

    showToast(i18nText("feature.spellcraft.components.rites.valueInvokedObligationValueNowValue", { value0: riteName, value1: baseCost, value2: newObligation }, "📜 \"{{value0}}\" invoked. Obligation +{{value1}} (now {{value2}})."), 'success');

    // Send VTT card
    const cardHtml = buildRiteCardHtml(
        riteName,
        patronData.name || patronData.title || patronId,
        patronData.icon || '📜',
        effect,
        costDetails,
        extraNote
    );
    sendVTTMessage(cardHtml);

    // Refresh the rites view
    const container = document.getElementById('spellcraft-content');
    if (container) {
        import('@features/spellcraft/index.js').then(module => {
            if (module.renderActiveTabContent) module.renderActiveTabContent();
        });
    }
};

// ============================================================
// SEND RITE CARD (reference only — no cost, no roll)
// ============================================================
// Matches spellbook.js's spellbookSendToVTT: works for any rite regardless
// of path or whether it's been learned yet, since it's purely informational
// — lets a player share what a rite does for the GM/table to read, without
// implying it was actually invoked.
window.sendRiteCard = function(patronId, riteIndex, characterId = 'default-character') {
    const state = getState();
    const patronData = findPatronData(state, patronId);
    if (!patronData) {
        showToast(i18nText("feature.spellcraft.components.rites.patronNotFound", null, "Patron not found."), 'error');
        return;
    }

    const rite = patronData.rites?.[riteIndex];
    if (!rite) {
        showToast(i18nText("feature.spellcraft.components.rites.riteNotFound", null, "Rite not found."), 'error');
        return;
    }

    const riteName = safeString(rite.name);
    const tier = safeString(rite.tier || '');
    const effect = safeString(rite.effect || rite.description || '');
    const action = safeString(rite.action || '');
    const range = safeString(rite.range || '');
    const cost = safeString(rite.cost || '');
    const detailsNote = [tier, action, range].filter(Boolean).join(' · ');

    const cardHtml = buildRiteCardHtml(
        riteName,
        patronData.name || patronData.title || patronId,
        patronData.icon || '📜',
        effect,
        cost ? `Cost: ${cost}` : '',
        detailsNote
    );
    sendVTTMessage(cardHtml);
    showToast(i18nText("feature.spellcraft.components.rites.valueSentToVTTAsAReference", { value0: riteName }, "📡 \"{{value0}}\" sent to VTT as a reference card."), 'success');
};

window.crackTheSeal = function(patronId, riteIndex, characterId = 'default-character') {
    const state = getState();
    const patronData = findPatronData(state, patronId);
    if (!patronData) {
        showToast(i18nText("feature.spellcraft.components.rites.patronNotFound", null, "Patron not found."), 'error');
        return;
    }

    const rite = patronData.rites?.[riteIndex];
    if (!rite) {
        showToast(i18nText("feature.spellcraft.components.rites.riteNotFound", null, "Rite not found."), 'error');
        return;
    }

    const riteName = safeString(rite.name);

    const char = state.characters?.find(c => c.id === characterId) || state.characters?.[characterId];
    if (!char || !isRiteKnown(char, patronId, riteName)) {
        showToast(i18nText("feature.spellcraft.components.rites.youHavenTLearnedValueYetLearn", { value0: riteName }, "You haven't learned \"{{value0}}\" yet — learn it first."), 'error');
        return;
    }
    const tier = safeString(rite.tier || '');
    const isHighTier = tier.toLowerCase() === 'high';
    const baseCost = parseRiteBaseObligationCost(rite);
    const minimum = isHighTier ? 3 : 2;
    const crackCost = Math.max(baseCost * 2, minimum);

    const currentObligation = getPatronObligation(characterId, patronId);
    const newObligation = currentObligation + crackCost;

    const highRiteMinimum = isHighTier
        ? i18nText('feature.spellcraft.components.rites.forHighRites', null, ' for High Rites')
        : '';
    if (!confirm(i18nText("feature.spellcraft.components.rites.crackTheSealInvokeValueInstantlyThis", { value0: riteName, value1: baseCost, value2: minimum, value3: highRiteMinimum, value4: crackCost, value5: currentObligation, value6: newObligation }, "💥 Crack the Seal: invoke \"{{value0}}\" instantly?\n\nThis rite's base cost is {{value1}} Obligation. Crack the Seal doubles it (minimum +{{value2}}{{value3}}), costing +{{value4}} Obligation this time (total: {{value5}} → {{value6}}). The Symbol becomes Compromised."))) return;

    setPatronObligation(characterId, patronId, newObligation);
    savePatronData();

    // Mark the Symbol as Compromised (narrative flag) and persist
    const stateStore = getState();
    if (stateStore.characters) {
        const char = stateStore.characters.find(c => c.id === characterId) || stateStore.characters[characterId];
        if (char) {
            if (!char.compromisedSymbols) char.compromisedSymbols = [];
            if (!char.compromisedSymbols.includes(patronId)) {
                char.compromisedSymbols.push(patronId);
                saveState();
            }
        }
    }

    const costDetails = `Obligation +${crackCost} (now ${newObligation}) · Symbol Compromised`;
    const effect = safeString(rite.effect || rite.description || 'The rite resolves instantly.');
    const extraNote = `Crack the Seal — ${isHighTier ? 'High' : 'Standard'} Rite, instant action.`;

    showToast(i18nText("feature.spellcraft.components.rites.valueInvokedInstantlyObligationValueNowValue", { value0: riteName, value1: crackCost, value2: newObligation }, "💥 \"{{value0}}\" invoked instantly! Obligation +{{value1}} (now {{value2}}). Symbol is now Compromised (−1 die on Borrowed Grace until restored)."), 'warning');

    // Send VTT card
    const cardHtml = buildRiteCardHtml(
        riteName,
        patronData.name || patronData.title || patronId,
        patronData.icon || '📜',
        effect,
        costDetails,
        extraNote
    );
    sendVTTMessage(cardHtml);

    // Refresh the rites view
    const container = document.getElementById('spellcraft-content');
    if (container) {
        import('@features/spellcraft/index.js').then(module => {
            if (module.renderActiveTabContent) module.renderActiveTabContent();
        });
    }
};

// ============================================================
// OBLIGATION MANAGEMENT
// ============================================================

window.addRiteObligation = function(patronId, amount = 1, characterId = 'default-character') {
    const current = getPatronObligation(characterId, patronId);
    setPatronObligation(characterId, patronId, Math.max(0, current + amount));
    savePatronData();
    showToast(i18nText("feature.spellcraft.components.rites.obligationValueValueForValue", { value0: amount > 0 ? '+' : '', value1: amount, value2: patronId }, "Obligation {{value0}}{{value1}} for {{value2}}"), amount > 0 ? 'success' : 'info');
    
    const container = document.getElementById('spellcraft-content');
    if (container) {
        import('@features/spellcraft/index.js').then(module => {
            if (module.renderActiveTabContent) module.renderActiveTabContent();
        });
    }
};

window.clearRiteObligation = function(patronId, characterId = 'default-character') {
    setPatronObligation(characterId, patronId, 0);
    savePatronData();
    showToast(i18nText("feature.spellcraft.components.rites.obligationClearedForValue", { value0: patronId }, "Obligation cleared for {{value0}}"), 'info');
    
    const container = document.getElementById('spellcraft-content');
    if (container) {
        import('@features/spellcraft/index.js').then(module => {
            if (module.renderActiveTabContent) module.renderActiveTabContent();
        });
    }
};

// ============================================================
// EXPORT
// ============================================================

export default { renderRites };
