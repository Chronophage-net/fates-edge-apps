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

import { getState, saveState, getCharacter, updateCharacter } from '../../../core/state.js';
import { showToast } from '../../../components/Toast.js';
import { escHtml, safeParseInt } from '../../../core/utils.js';
import patrons from '../../patrons/index.js';

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
 */
function findPatronData(state, patronId) {
    if (!patronId) return null;
    
    if (state.patrons?.cosmic) {
        const found = state.patrons.cosmic.find(p => p.id === patronId);
        if (found) return found;
    }
    
    if (state.patrons?.terrestrial) {
        const found = state.patrons.terrestrial.find(p => p.id === patronId);
        if (found) return found;
    }
    
    if (state.patrons?.religions) {
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
            border-left:4px solid var(--gold);
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
            border-left:4px solid var(--gold);
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

    // Normalize to array
    const ids = Array.isArray(patronIds) ? patronIds : (patronIds ? [patronIds] : []);
    const path = options.path || 'runekeeper'; // 'runekeeper' or 'invoker'
    const charName = options.characterName || 'Character';
    
    // Get character from state
    const state = getState();
    const char = state.characters?.find(c => c.id === characterId) || state.characters?.[characterId];
    if (!char) {
        el.innerHTML = `<div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);">Character not found.</div>`;
        return;
    }

    // Gather patron data for the IDs
    const patronDataList = [];
    const notFound = [];
    for (const id of ids) {
        if (!id) continue;
        const data = findPatronData(state, id);
        if (data) {
            patronDataList.push(data);
        } else {
            notFound.push(id);
        }
    }

    if (patronDataList.length === 0) {
        el.innerHTML = `
            <div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);">
                <div style="font-size:1.5rem;">🔮</div>
                <p>No patron data found for: <strong>${escHtml(notFound.join(', '))}</strong></p>
                <p style="font-size:0.85rem;">Make sure the patron's JSON file is in <code>/data/patrons/</code></p>
            </div>
        `;
        return;
    }

    // Determine access
    const canAccessGifts = hasAccessToPatronGifts(char);
    const canAccessRites = hasAccessToRites(char);

    // Check for Cross-Resonance warnings (Invokers)
    const rivalryWarnings = path === 'invoker' ? getRivalryWarnings(ids) : [];
    const totalObligation = ids.reduce((sum, id) => sum + getPatronObligation(characterId, id), 0);

    // Build HTML
    let html = `<div class="rites-multi-container" style="display:flex;flex-direction:column;gap:0.6rem;">`;

    // ─── Path Header ──────────────────────────────────────────
    html += `
        <div class="rites-path-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid ${path === 'invoker' ? 'var(--orange)' : 'var(--gold)'};">
            <div style="display:flex;align-items:center;gap:0.3rem;">
                <span style="font-size:1.2rem;">${path === 'invoker' ? '🎴' : '📜'}</span>
                <span style="font-weight:600;font-size:0.95rem;color:${path === 'invoker' ? 'var(--orange)' : 'var(--gold)'};">
                    ${path === 'invoker' ? 'Invoker' : 'Runekeeper'}
                </span>
                <span style="font-size:0.7rem;color:var(--text3);">
                    ${path === 'invoker' ? `${ids.length} Symbols · ` : ''}Total Obligation: ${totalObligation}
                </span>
            </div>
            <div style="display:flex;align-items:center;gap:0.4rem;">
                ${path === 'invoker' && ids.length > 4 ? `
                    <span style="font-size:0.65rem;color:var(--red);font-weight:600;">⚠️ ${ids.length} Symbols – beyond recommended limit!</span>
                ` : ''}
                ${path === 'invoker' ? `
                    <button class="btn btn-xs btn-ghost" onclick="window.startNewScene('${characterId}')" title="Reset once-per-scene abilities like Borrowed Grace">🎬 New Scene</button>
                ` : ''}
            </div>
        </div>
    `;

    // ─── Patron's Gifts Section ──────────────────────────────
    if (canAccessGifts) {
        html += renderPatronGiftsSection(char, patronDataList, path, characterId);
    }

    // ─── Cross-Resonance Warnings (Invokers) ──────────────────
    if (rivalryWarnings.length > 0) {
        html += `
            <div class="rites-resonance-warning" style="background:rgba(212,175,55,0.15);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--orange);">
                <div style="font-size:0.75rem;font-weight:600;color:var(--orange);">⚡ Cross-Resonance Detected</div>
                <div style="font-size:0.7rem;color:var(--text2);">
                    ${rivalryWarnings.map(([a, b]) => 
                        `• ${getPatronName(a, state)} and ${getPatronName(b, state)} – their Symbols create friction.`
                    ).join('<br>')}
                </div>
                <div style="font-size:0.6rem;color:var(--text3);margin-top:0.1rem;">First invocation of a scene costs +1 Obligation. Narrative complications may arise.</div>
            </div>
        `;
    }

    // ─── Rites Section (only if character has access) ────────
    if (canAccessRites) {
        for (const patronData of patronDataList) {
            html += renderSinglePatronRites(patronData, characterId, charName, ids, path, char);
        }
    } else {
        if (path === 'runekeeper' && !canAccessRites) {
            html += `
                <div class="rites-no-access" style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
                    <p>You do not have a Codex. Rites are not available.</p>
                    <p style="font-size:0.8rem;">Acquire a Codex (talent) to learn and invoke Rites.</p>
                </div>
            `;
        }
        // For Invokers without Symbols, we already handle that earlier.
    }

    html += `</div>`;
    el.innerHTML = html;

    // Attach toggle events for expandable rites (if any)
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
// RENDER PATRON'S GIFTS SECTION
// ============================================================

function renderPatronGiftsSection(char, patronDataList, path, characterId = 'default-character') {
    const isRunekeeper = path === 'runekeeper';
    const isInvoker = path === 'invoker';

    // Gather gifts
    const gifts = [];
    if (isRunekeeper) {
        // Runekeeper: only one patron (the bound one)
        const patronData = patronDataList[0]; // assume first
        if (patronData) {
            const gift = getPatronGift(patronData);
            if (gift) {
                gifts.push({
                    patronId: patronData.id,
                    patronName: patronData.name || patronData.title,
                    patronIcon: patronData.icon || '🔮',
                    gift: gift,
                    isBound: true
                });
            }
        }
    } else if (isInvoker) {
        // Invoker: each Symbol gives access
        const symbols = char.symbols || [];
        for (const patronId of symbols) {
            const patronData = findPatronData(getState(), patronId);
            if (patronData) {
                const gift = getPatronGift(patronData);
                if (gift) {
                    gifts.push({
                        patronId: patronData.id,
                        patronName: patronData.name || patronData.title,
                        patronIcon: patronData.icon || '🔮',
                        gift: gift,
                        isBound: false
                    });
                }
            }
        }
    }

    if (gifts.length === 0) return '';

    // Build cost options for Invoker (Boon or Fatigue)
    const costOptionsHtml = `
        <option value="boon">1 Boon</option>
        <option value="fatigue">1 Fatigue</option>
    `;

    // RULES FIX (Player's Guide/Invoker Guide App. A.2): Borrowed Grace is
    // usable once per scene, and works at -1 die if the Symbol invoked is
    // Compromised (the state Crack the Seal itself puts a Symbol into).
    const borrowedGraceUsed = !!(char.sceneFlags && char.sceneFlags.borrowedGrace);

    let html = `
        <div class="patron-gifts" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);margin-bottom:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">${isRunekeeper ? '🔮 Patron\'s Gift' : '🎴 Borrowed Grace (Symbols)'}</span>
                <span style="font-size:0.6rem;color:var(--text3);">${gifts.length} gift${gifts.length > 1 ? 's' : ''}${isInvoker && borrowedGraceUsed ? ' · used this scene' : ''}</span>
            </div>
            ${gifts.map((item, idx) => {
                const gift = item.gift;
                const name = safeString(gift.name || 'Patron\'s Gift');
                const description = safeString(gift.description || '');
                const effect = safeString(gift.effect || '');
                const costDesc = safeString(gift.cost || '+1 Obligation');
                const patronIcon = item.patronIcon;
                const patronName = item.patronName;

                // For Runekeeper, the cost is already +1 Obligation; for Invoker, they choose Boon or Fatigue.
                const isBound = item.isBound;
                const giftId = `gift-${item.patronId}`;
                const isCompromised = !isBound && (char.compromisedSymbols || []).includes(item.patronId);

                return `
                    <div class="gift-item" style="display:flex;flex-direction:column;gap:0.2rem;padding:0.2rem 0.3rem;border-bottom:1px solid var(--border);background:var(--bg3);border-radius:var(--radius);margin-top:0.1rem;">
                        <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                            <span style="font-size:1.1rem;">${patronIcon}</span>
                            <span style="font-weight:600;font-size:0.85rem;">${escHtml(name)}</span>
                            <span style="font-size:0.6rem;color:var(--text3);">${escHtml(patronName)}</span>
                            ${isBound ? `<span style="font-size:0.55rem;color:var(--gold);">(Bound)</span>` : `<span style="font-size:0.55rem;color:var(--orange);">(Symbol)</span>`}
                            ${isCompromised ? `<span style="font-size:0.55rem;color:var(--red);">⚠️ Compromised: −1 die</span>` : ''}
                        </div>
                        <div style="font-size:0.75rem;color:var(--text2);">${formatText(description)}</div>
                        <div style="font-size:0.7rem;color:var(--text3);">${formatText(effect)}</div>
                        <div style="display:flex;flex-wrap:wrap;gap:0.2rem;align-items:center;margin-top:0.1rem;">
                            <span style="font-size:0.65rem;color:var(--text3);">Cost: ${escHtml(costDesc)}</span>
                            ${isBound ? `
                                <button class="btn btn-xs btn-primary" onclick="window.usePatronGift('${item.patronId}', '${characterId}')" style="font-size:0.6rem;">Use Gift</button>
                            ` : `
                                <select id="${giftId}-cost" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.2rem;" ${borrowedGraceUsed ? 'disabled' : ''}>
                                    ${costOptionsHtml}
                                </select>
                                <button class="btn btn-xs ${borrowedGraceUsed ? 'btn-secondary' : 'btn-gold'}" ${borrowedGraceUsed ? 'disabled' : ''} onclick="window.useBorrowedGrace('${item.patronId}', document.getElementById('${giftId}-cost').value, '${characterId}')" style="font-size:0.6rem;">
                                    ${borrowedGraceUsed ? '✓ Used this scene' : 'Invoke Borrowed Grace'}
                                </button>
                            `}
                        </div>
                    </div>
                `;
            }).join('')}
            <div style="font-size:0.55rem;color:var(--text3);margin-top:0.1rem;">
                ${isRunekeeper ? 'Patron\'s Gift is an Imbuement: once per scene, touch an item to gain +1 die to a thematic skill and a special benefit. Costs +1 Obligation.' : 'Borrowed Grace: once per scene, spend 1 Boon or 1 Fatigue, mark +1 Obligation, and gain the Symbol\'s Gift effect. Works at −1 die if the Symbol is Compromised. Use "🎬 New Scene" above to reset.'}
            </div>
        </div>
    `;
    return html;
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
            <div class="rites-patron-block" style="border-left:3px solid ${color};padding-left:0.5rem;background:var(--bg2);border-radius:var(--radius);padding:0.5rem;">
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
        <div class="rites-patron-block" style="border-left:3px solid ${color};padding-left:0.5rem;background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
            <!-- Header -->
            <div class="rites-header" style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;border-bottom:1px solid var(--border);padding-bottom:0.2rem;margin-bottom:0.2rem;">
                <span style="font-size:1.2rem;">${escHtml(icon)}</span>
                <span style="font-weight:600;font-size:1rem;color:${color};">${escHtml(name)}</span>
                ${domain ? `<span style="font-size:0.7rem;color:var(--text3);">— ${escHtml(domain)}</span>` : ''}
                <span style="font-size:0.65rem;color:var(--text3);margin-left:auto;">${rites.length} rites · Obligation: ${obligation}</span>
            </div>

            <!-- ─── Obligation Controls ────────────────────────── -->
            <div class="rites-obligation" style="display:flex;gap:0.2rem;align-items:center;font-size:0.75rem;margin-bottom:0.2rem;flex-wrap:wrap;">
                <span style="color:var(--text3);">⛓️ Obligation:</span>
                <span style="font-weight:600;font-size:0.85rem;">${obligation}</span>
                <button class="btn btn-xs btn-primary" onclick="window.addRiteObligation('${patronId}', 1, '${characterId}')">+1</button>
                <button class="btn btn-xs btn-secondary" onclick="window.addRiteObligation('${patronId}', -1, '${characterId}')">−1</button>
                <button class="btn btn-xs btn-ghost" onclick="window.clearRiteObligation('${patronId}', '${characterId}')" style="color:var(--red);">✕ Clear</button>
                ${isInvoker ? `
                    <span style="font-size:0.55rem;color:var(--text3);margin-left:0.3rem;">
                        (${isMultiPatron ? `Symbol ${allPatronIds.indexOf(patronId) + 1}/${allPatronIds.length}` : 'Single Symbol'})
                    </span>
                ` : ''}
                ${isInvoker && isMultiPatron ? `
                    <span style="font-size:0.55rem;color:var(--orange);margin-left:0.3rem;">
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
                        <span style="font-size:0.65rem;color:var(--red);" title="High Rites require Tier III or higher">
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
        <div class="rite-item ${hasDetails ? 'rite-expandable' : ''}" data-rite-id="${escHtml(riteId)}" style="background:var(--bg3);border-radius:var(--radius);padding:0.2rem 0.5rem;border-left:2px solid ${color};margin-bottom:0.1rem;${isKnown ? '' : 'opacity:0.75;'}">
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
// GLOBAL FUNCTIONS: Patron's Gift (Runekeeper) — WITH VTT
// ============================================================

window.usePatronGift = async function(patronId, characterId) {
    const char = getState().characters?.find(c => c.id === characterId);
    if (!char) {
        showToast('Character not found.', 'error');
        return;
    }
    if (char.magicPath !== 'runekeeper') {
        showToast('Only Runekeepers can use Patron\'s Gift.', 'error');
        return;
    }
    if (!(char.learnedTalents || []).includes('familiar')) {
        showToast('You need a Familiar (Thiasos) to use Patron\'s Gift.', 'error');
        return;
    }

    const state = getState();
    const patronData = findPatronData(state, patronId);
    if (!patronData) {
        showToast('Patron not found.', 'error');
        return;
    }
    const gift = getPatronGift(patronData);
    if (!gift) {
        showToast('This patron has no Gift defined.', 'error');
        return;
    }

    // Apply cost: +1 Obligation
    const currentObligation = getPatronObligation(char.id, patronId);
    setPatronObligation(char.id, patronId, currentObligation + 1);
    savePatronData();

    const name = safeString(gift.name || 'Patron\'s Gift');
    const effect = safeString(gift.effect || 'The item glows with patron\'s favor.');
    const costDetails = `Obligation +1 (now ${currentObligation + 1})`;

    showToast(`✨ ${name}: ${effect} (Obligation +1)`, 'success');

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
        import('../index.js').then(module => {
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
        showToast('Only Invokers can use Borrowed Grace.', 'error');
        return;
    }
    if (!(char.symbols || []).includes(patronId)) {
        showToast('You do not carry a Symbol for this patron.', 'error');
        return;
    }

    if (char.sceneFlags && char.sceneFlags.borrowedGrace) {
        showToast('Borrowed Grace has already been used this scene. Start a New Scene to use it again.', 'error');
        return;
    }

    const isCompromised = (char.compromisedSymbols || []).includes(patronId);

    // Deduct cost (Boon or Fatigue)
    if (costType === 'boon') {
        const boons = char.boons || 0;
        if (boons < 1) {
            showToast('Not enough Boons! Need 1 Boon.', 'error');
            return;
        }
        char.boons = boons - 1;
    } else if (costType === 'fatigue') {
        const fatigue = char.fatigue || 0;
        const maxFatigue = char.attributes?.body || 1;
        if (fatigue >= maxFatigue) {
            showToast('Fatigue track is full!', 'error');
            return;
        }
        char.fatigue = fatigue + 1;
    } else {
        showToast('Invalid cost type. Choose boon or fatigue.', 'error');
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
        showToast('Patron not found.', 'error');
        return;
    }
    const gift = getPatronGift(patronData);
    if (!gift) {
        showToast('This patron has no Gift defined.', 'error');
        return;
    }

    const name = safeString(gift.name || 'Borrowed Grace');
    const effect = safeString(gift.effect || 'The Symbol flares with borrowed power.');
    const costDetails = `Cost: 1 ${costType}, Obligation +1 (now ${currentObligation + 1})`;
    const penaltyNote = isCompromised ? '⚠️ Symbol is Compromised — this applies at −1 die.' : '';

    showToast(`🎴 ${name}: ${effect}${penaltyNote ? ' ' + penaltyNote : ''} (Cost: 1 ${costType}, Obligation +1)`, 'success');

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
        import('../index.js').then(module => {
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
    showToast('🎬 New scene — once-per-scene abilities (like Borrowed Grace) are available again.', 'info');

    const container = document.getElementById('spellcraft-content');
    if (container) {
        import('../index.js').then(module => {
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
        showToast('Patron not found.', 'error');
        return;
    }

    const rite = patronData.rites?.[riteIndex];
    if (!rite) {
        showToast('Rite not found.', 'error');
        return;
    }

    const char = state.characters?.find(c => c.id === characterId) || state.characters?.[characterId];
    if (!char) {
        showToast('Character not found.', 'error');
        return;
    }

    const riteName = safeString(rite.name);
    if (!char.rites) char.rites = [];
    if (isRiteKnown(char, patronId, riteName)) {
        showToast(`"${riteName}" is already known.`, 'info');
        return;
    }

    // RULES FIX: High Rites require Tier III+.
    const riteTier = safeString(rite.tier || '');
    if (riteTier.toLowerCase() === 'high' && !meetsTierRequirement(char, 'III')) {
        showToast(`"${riteName}" is a High Rite and requires Tier III (you're Tier ${getCharacterTier(char)}).`, 'error');
        return;
    }

    const xpCost = safeParseInt(rite.xp, 0);
    const totalXp = char.totalXp || 0;
    const spent = char.xpSpent || 0;
    const available = totalXp - spent;

    if (xpCost > 0 && available < xpCost) {
        showToast(`Not enough XP. Need ${xpCost}, have ${available} available.`, 'error');
        return;
    }

    if (!confirm(`Learn "${riteName}" (${rite.tier || ''}) for ${xpCost} XP?`)) return;

    char.rites.push(riteKey(patronId, riteName));
    char.xpSpent = spent + xpCost;
    saveState();
    showToast(`📖 Learned "${riteName}" (${xpCost} XP spent).`, 'success');

    const container = document.getElementById('spellcraft-content');
    if (container) {
        import('../index.js').then(module => {
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
        showToast('Patron not found.', 'error');
        return;
    }

    const rite = patronData.rites?.[riteIndex];
    if (!rite) {
        showToast('Rite not found.', 'error');
        return;
    }

    const riteName = safeString(rite.name);
    const char = state.characters?.find(c => c.id === characterId) || state.characters?.[characterId];
    if (!char || !isRiteKnown(char, patronId, riteName)) {
        showToast(`You haven't learned "${riteName}" yet — learn it first.`, 'error');
        return;
    }

    const baseCost = parseRiteBaseObligationCost(rite);
    const currentObligation = getPatronObligation(characterId, patronId);
    const newObligation = currentObligation + baseCost;
    const actionText = safeString(rite.action || '');

    if (!confirm(`Invoke "${riteName}"${actionText ? ` (${actionText})` : ''}?\n\nCost: +${baseCost} Obligation (total: ${currentObligation} → ${newObligation}).`)) return;

    setPatronObligation(characterId, patronId, newObligation);
    savePatronData();

    const costDetails = `Obligation +${baseCost} (now ${newObligation})`;
    const effect = safeString(rite.effect || rite.description || 'The rite resolves.');
    const extraNote = [actionText, safeString(rite.range || '')].filter(Boolean).join(' · ');

    showToast(`📜 "${riteName}" invoked. Obligation +${baseCost} (now ${newObligation}).`, 'success');

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
        import('../index.js').then(module => {
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
        showToast('Patron not found.', 'error');
        return;
    }

    const rite = patronData.rites?.[riteIndex];
    if (!rite) {
        showToast('Rite not found.', 'error');
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
    showToast(`📡 "${riteName}" sent to VTT as a reference card.`, 'success');
};

window.crackTheSeal = function(patronId, riteIndex, characterId = 'default-character') {
    const state = getState();
    const patronData = findPatronData(state, patronId);
    if (!patronData) {
        showToast('Patron not found.', 'error');
        return;
    }

    const rite = patronData.rites?.[riteIndex];
    if (!rite) {
        showToast('Rite not found.', 'error');
        return;
    }

    const riteName = safeString(rite.name);

    const char = state.characters?.find(c => c.id === characterId) || state.characters?.[characterId];
    if (!char || !isRiteKnown(char, patronId, riteName)) {
        showToast(`You haven't learned "${riteName}" yet — learn it first.`, 'error');
        return;
    }
    const tier = safeString(rite.tier || '');
    const isHighTier = tier.toLowerCase() === 'high';
    const baseCost = parseRiteBaseObligationCost(rite);
    const minimum = isHighTier ? 3 : 2;
    const crackCost = Math.max(baseCost * 2, minimum);

    const currentObligation = getPatronObligation(characterId, patronId);
    const newObligation = currentObligation + crackCost;

    if (!confirm(`💥 Crack the Seal: invoke "${riteName}" instantly?\n\nThis rite's base cost is ${baseCost} Obligation. Crack the Seal doubles it (minimum +${minimum}${isHighTier ? ' for High Rites' : ''}), costing +${crackCost} Obligation this time (total: ${currentObligation} → ${newObligation}). The Symbol becomes Compromised.`)) return;

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

    showToast(`💥 "${riteName}" invoked instantly! Obligation +${crackCost} (now ${newObligation}). Symbol is now Compromised (−1 die on Borrowed Grace until restored).`, 'warning');

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
        import('../index.js').then(module => {
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
    showToast(`Obligation ${amount > 0 ? '+' : ''}${amount} for ${patronId}`, amount > 0 ? 'success' : 'info');
    
    const container = document.getElementById('spellcraft-content');
    if (container) {
        import('../index.js').then(module => {
            if (module.renderActiveTabContent) module.renderActiveTabContent();
        });
    }
};

window.clearRiteObligation = function(patronId, characterId = 'default-character') {
    setPatronObligation(characterId, patronId, 0);
    savePatronData();
    showToast(`Obligation cleared for ${patronId}`, 'info');
    
    const container = document.getElementById('spellcraft-content');
    if (container) {
        import('../index.js').then(module => {
            if (module.renderActiveTabContent) module.renderActiveTabContent();
        });
    }
};

// ============================================================
// EXPORT
// ============================================================

export default { renderRites };