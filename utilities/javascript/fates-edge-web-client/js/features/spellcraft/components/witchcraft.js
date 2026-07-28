/**
 * Witchcraft – The Hedge and the Threshold
 *
 * "The hedge is what keeps the wolves from the flock. I am the one who tends the hedge."
 * – The Gray Wanderer
 *
 * Witchcraft is a practice, not just a path. Any character can learn Hedge Gifts,
 * but those who walk the Witch path gain deeper access to the Weave's hidden grammar.
 *
 * Features:
 * - Universal Hedge Gifts available to all characters
 * - Weaver selection from patron data (patron-specific witchcraft traditions)
 * - Price tracks: Shadow, Shame, Identity Strain with visual thresholds
 * - Promise Timers for debts and obligations
 * - Full Ritual system with the five-step process
 * - Quick Workings for immediate magical effects
 * - Crafting with recipes, materials, and XP costs
 * - Crafted item inventory with uses tracking
 * - Magic path detection: Witch path gets full features; others get a simplified view
 * - All functionality works for any character with the Craft of the Hedge talent
 *
 * ────────────────────────────────────────────────────────────────────────
 * BUGFIX NOTE (read this before touching saveCharacter calls below):
 * getWitchState(char) does `if (!char.witch) char.witch = {}` and returns a
 * live reference into the character object, and getPriceTracks/
 * getHedgeGifts/getPromiseTimers/getFullRituals/getCraftedItems all read
 * and mutate through that same reference. That means char.witch already
 * holds the up-to-date {prices, hedgeGifts, promiseTimers, rituals,
 * crafted} object at the moment we call saveCharacter.
 *
 * The previous version of this file called saveCharacter with only ONE of
 * those sub-keys at a time, e.g. saveCharacter({ witch: { prices } }) or
 * saveCharacter({ witch: { crafted } }). If saveCharacter's merge is a
 * normal shallow merge (as it appears to be elsewhere in this codebase,
 * e.g. cantor.js's saveCharacter({ fatigue, corruption })), passing
 * `witch: { prices }` REPLACES char.witch entirely with just { prices },
 * silently deleting hedgeGifts/promiseTimers/rituals/crafted every time.
 * In practice: add a Hedge Gift, then tick a Promise Timer, and the gift
 * you just added would vanish.
 *
 * Fix: always pass the whole, already-mutated char.witch object, so
 * nothing sibling gets clobbered regardless of merge depth.
 * ────────────────────────────────────────────────────────────────────────
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml, generateId, safeParseInt } from '../../../core/utils.js';
import { showToast } from '../../../components/Toast.js';
import { getState } from '../../../core/state.js';

// ============================================================
// CONSTANTS – Universal Hedge Gifts (available to all)
// ============================================================

const UNIVERSAL_HEDGE_GIFTS = [
    { id: 'steady-hand', name: 'Steady Hand', effect: 'Remove 1 Fatigue from yourself or a touched ally.', limit: 'Once per scene' },
    { id: 'salt-line', name: 'Salt Line', effect: 'Pour a line of salt; spirits must test Spirit+Resolve (DV 3) to cross.', limit: 'Once per scene' },
    { id: 'hearth-sense', name: 'Hearth-Sense', effect: 'Ask the GM one yes/no question about a threshold, boundary, or debt.', limit: 'Once per scene' },
    { id: 'unlit-candle', name: 'The Unlit Candle', effect: 'Extinguish a light source; create dim light or darkness in Near range.', limit: 'Once per session' },
    { id: 'knot-of-favor', name: 'Knot of Favor', effect: 'Tie a knot; you and allies gain +1 die to one type of roll for the scene.', limit: 'Once per scene' },
    { id: 'warm-hand', name: 'Warm Hand', effect: 'Touch someone; their next physical action gains +1 die or suffers -1 die.', limit: 'Once per scene' },
    { id: 'counting-eighth', name: 'Counting the Eighth', effect: 'Whisper a number (1-8); if GM\'s SB count matches, gain +2 dice.', limit: 'Once per scene' },
    { id: 'threshold-whisper', name: 'Threshold Whisper', effect: 'Learn the nature of a threshold (door, bridge, boundary) with a touch.', limit: 'Once per scene' },
    { id: 'red-thread', name: 'Red Thread', effect: 'Tie a thread on a door; next person crossing forgets why they entered (Resist DV 2).', limit: 'Once per session' },
    { id: 'cup-mark', name: 'Cup-Mark', effect: 'Leave a cup-mark on a stone; return before dawn to ignore one minor social complication.', limit: 'Once per session' }
];

// ─── Crafting Recipes (Universal) ─────────────────────────────

const CRAFTING_RECIPES = {
    'healing-poultice': {
        id: 'healing-poultice',
        name: '🩹 Healing Poultice',
        description: 'A balm of herbs and salves that speeds recovery.',
        effect: 'Remove 1 Fatigue when applied during a short rest.',
        materials: ['Herbs (1 Supply)', 'Clean cloth', 'Time (1 hour)'],
        skill: 'medicine',
        dv: 2,
        xpCost: 1,
        tier: 'minor',
        icon: '🩹'
    },
    'antidote': {
        id: 'antidote',
        name: '🧪 Antidote',
        description: 'A bitter draught that neutralises common poisons.',
        effect: 'Remove one Poisoned Condition.',
        materials: ['Specific herb (rare)', 'Distilled water', 'Charcoal'],
        skill: 'medicine',
        dv: 3,
        xpCost: 2,
        tier: 'minor',
        icon: '🧪'
    },
    'sleep-draught': {
        id: 'sleep-draught',
        name: '💤 Sleep Draught',
        description: 'A sweet syrup that induces deep, dreamless sleep.',
        effect: 'Target tests Spirit+Resolve (DV 3) or falls asleep for 1 hour.',
        materials: ['Valerian root', 'Honey', 'Moonwater'],
        skill: 'craft',
        dv: 3,
        xpCost: 1,
        tier: 'minor',
        icon: '💤'
    },
    'ward-salt': {
        id: 'ward-salt',
        name: '🧂 Ward Salt',
        description: 'Salt blessed with protective herbs and iron filings.',
        effect: 'Line wards against spirits and undead (Spirit+Resolve DV 4 to cross).',
        materials: ['Salt (1 Supply)', 'Blessed ash', 'Iron filings'],
        skill: 'lore',
        dv: 3,
        xpCost: 2,
        tier: 'minor',
        icon: '🧂'
    },
    'truth-serum': {
        id: 'truth-serum',
        name: '🔮 Truth Serum',
        description: 'A clear liquid that loosens the tongue.',
        effect: 'Target tests Spirit+Resolve (DV 4) or speaks only truth for one exchange.',
        materials: ['Nightshade (carefully prepared)', 'Pure water', 'A drop of blood'],
        skill: 'craft',
        dv: 4,
        xpCost: 3,
        tier: 'standard',
        icon: '🔮'
    },
    'moon-tea': {
        id: 'moon-tea',
        name: '🌙 Moon Tea',
        description: 'A calming infusion that sharpens dreams and intuition.',
        effect: '+1 die on next Wits or Spirit roll within 1 hour.',
        materials: ['Chamomile', 'Moonwort', 'Honey'],
        skill: 'craft',
        dv: 2,
        xpCost: 1,
        tier: 'minor',
        icon: '🌙'
    },
    'fire-powder': {
        id: 'fire-powder',
        name: '🔥 Fire Powder',
        description: 'A volatile powder that ignites on contact with air.',
        effect: 'Creates a small fire (Harm 2, Area) in Close range. One use.',
        materials: ['Sulphur', 'Charcoal', 'Saltpetre'],
        skill: 'craft',
        dv: 4,
        xpCost: 3,
        tier: 'standard',
        icon: '🔥'
    },
    'blessed-oil': {
        id: 'blessed-oil',
        name: '🕯️ Blessed Oil',
        description: 'Oil consecrated to a Patron or Threshold.',
        effect: 'Anoints a weapon or threshold; counts as [WARD] or [BLESSED] for one scene.',
        materials: ['Olive oil', 'Incense', 'A prayer or rite'],
        skill: 'lore',
        dv: 3,
        xpCost: 2,
        tier: 'standard',
        icon: '🕯️'
    }
};

// ─── Price Track Thresholds ───────────────────────────────────

const PRICE_THRESHOLDS = {
    shadow: { label: 'Shadow', icon: '🌑', max: 5, warningAt: 3, color: 'var(--purple)' },
    shame: { label: 'Shame', icon: '😞', max: 5, warningAt: 3, color: 'var(--red)' },
    identityStrain: { label: 'Identity Strain', icon: '🌀', max: 5, warningAt: 3, color: 'var(--gold)' }
};

// ============================================================
// WITCHCRAFT LOOKUP
// ============================================================

function getWitchcraftFromPatron(patronData) {
    if (!patronData) return null;
    return patronData.witchcraft || null;
}

function findPatronWitchcraft(patronId) {
    const state = getState();

    if (state.patrons?.cosmic) {
        const patron = state.patrons.cosmic.find(p => p.id === patronId);
        if (patron && patron.witchcraft) {
            return { patron, witchcraft: patron.witchcraft };
        }
    }

    if (state.patrons?.terrestrial) {
        const patron = state.patrons.terrestrial.find(p => p.id === patronId);
        if (patron && patron.witchcraft) {
            return { patron, witchcraft: patron.witchcraft };
        }
    }

    if (state.patrons?.religions) {
        for (const religion of state.patrons.religions) {
            if (religion.orders) {
                const order = religion.orders.find(o => o.id === patronId);
                if (order && order.witchcraft) {
                    return { patron: order, witchcraft: order.witchcraft, religion: religion.name };
                }
            }
        }
    }

    return null;
}

function getAllWitchcraftPatrons() {
    const state = getState();
    const results = [];

    if (state.patrons?.cosmic) {
        for (const patron of state.patrons.cosmic) {
            if (patron.witchcraft) {
                results.push({
                    patronId: patron.id,
                    patronName: patron.name || patron.title || patron.id,
                    patronIcon: patron.icon || '🧙',
                    witchcraft: patron.witchcraft,
                    source: 'cosmic'
                });
            }
        }
    }

    if (state.patrons?.terrestrial) {
        for (const patron of state.patrons.terrestrial) {
            if (patron.witchcraft) {
                results.push({
                    patronId: patron.id,
                    patronName: patron.name || patron.title || patron.id,
                    patronIcon: patron.icon || '🏛️',
                    witchcraft: patron.witchcraft,
                    source: 'terrestrial'
                });
            }
        }
    }

    if (state.patrons?.religions) {
        for (const religion of state.patrons.religions) {
            if (religion.orders) {
                for (const order of religion.orders) {
                    if (order.witchcraft) {
                        results.push({
                            patronId: order.id,
                            patronName: order.name || order.id,
                            patronIcon: order.icon || religion.icon || '⛪',
                            witchcraft: order.witchcraft,
                            source: 'religion',
                            religion: religion.name
                        });
                    }
                }
            }
        }
    }

    return results;
}

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
        try { return JSON.stringify(val); } catch (e) { return '[object]'; }
    }
    return String(val);
}

function formatText(text) {
    if (!text) return '';
    return escHtml(text).replace(/\n/g, '<br>');
}

function rollDice(pool) {
    let successes = 0;
    let ones = 0;
    for (let i = 0; i < pool; i++) {
        const roll = Math.floor(Math.random() * 10) + 1;
        if (roll >= 6) successes++;
        if (roll === 10) successes++;
        if (roll === 1) ones++;
    }
    return { successes, ones };
}

function getTierFromXp(xp) {
    if (xp < 40) return 'I';
    if (xp < 90) return 'II';
    if (xp < 150) return 'III';
    if (xp < 220) return 'IV';
    return 'V';
}

// ─── Magic Paths Reference ─────────────────────────────────────
// Shown as a resource when no character is selected at all, so the panel
// is useful before a character exists. Kept in sync manually with the
// richer MAGIC_PATHS object in features/characters/index.js — this is a
// small, self-contained copy rather than a cross-feature import, so a
// wrong relative path can never break this panel.
const MAGIC_PATH_REFERENCE = [
    { icon: '🔥', label: 'Free Caster', blurb: 'Raw TAGS grammar, no patron — pure will and improvisation.' },
    { icon: '📖', label: 'Runekeeper', blurb: 'Bound to one patron via Thiasos or Codex; steady Rites.' },
    { icon: '🔯', label: 'Invoker', blurb: 'Carries Symbols from multiple patrons; risks Cross-Resonance.' },
    { icon: '🎵', label: 'Cantor', blurb: "Sings a patron's Rites as Songs; Corruption blooms with Pushing." },
    { icon: '👁️', label: 'Summoner', blurb: 'Binds spirits from the Bestiary; manages the Leash.' },
    { icon: '🌿', label: 'Witch', blurb: 'Hedge magic at Thresholds, paid in Shadow, Shame, Identity Strain.' },
    { icon: '🧠', label: 'Psion', blurb: 'Mind-born power fueled by Mental Strain.' },
    { icon: '🧘', label: 'Monk', blurb: 'Patron-optional path of Breath States and monastic Techniques.' },
    { icon: '🦅', label: 'Familiar Only', blurb: 'A bonded companion without a full magic path.' },
    { icon: '🍃', label: 'Hedge Gifts', blurb: 'Small universal gifts available to any character.' }
];

function renderMagicPathReferenceHtml(highlightLabel) {
    return `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.4rem;text-align:left;margin-top:0.8rem;">
            ${MAGIC_PATH_REFERENCE.map(p => `
                <div style="padding:0.4rem 0.5rem;border-radius:var(--radius);background:var(--bg2);border:1px solid ${p.label === highlightLabel ? 'var(--gold)' : 'var(--border)'};">
                    <div style="display:flex;align-items:center;gap:0.3rem;">
                        <span style="font-size:1.1rem;">${p.icon}</span>
                        <strong style="font-size:0.82rem;${p.label === highlightLabel ? 'color:var(--gold);' : ''}">${p.label}</strong>
                    </div>
                    <div style="font-size:0.68rem;color:var(--text3);margin-top:0.15rem;line-height:1.3;">${p.blurb}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================================
// WITCHCRAFT STATE (per character)
// ============================================================

function getWitchState(char) {
    if (!char.witch) char.witch = {};
    return char.witch;
}

function getPriceTracks(char) {
    const w = getWitchState(char);
    if (!w.prices) w.prices = { shadow: 0, shame: 0, identityStrain: 0 };
    return w.prices;
}

function getPromiseTimers(char) {
    const w = getWitchState(char);
    if (!w.promiseTimers) w.promiseTimers = [];
    return w.promiseTimers;
}

function getHedgeGifts(char) {
    const w = getWitchState(char);
    if (!w.hedgeGifts) w.hedgeGifts = [];
    return w.hedgeGifts;
}

function getFullRituals(char) {
    const w = getWitchState(char);
    if (!w.rituals) w.rituals = [];
    return w.rituals;
}

function getCraftedItems(char) {
    const w = getWitchState(char);
    if (!w.crafted) w.crafted = [];
    return w.crafted;
}

// ============================================================
// MAIN RENDER – Path-aware
// ============================================================

export function renderWitchcraft(el) {
    const char = getCharacterData();
    if (!char) {
        el.innerHTML = `
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🧹</div>
                <p>Select a character to view their hedge magic.</p>
                <div style="margin-top:0.5rem;font-weight:600;color:var(--gold);">📚 Magic Paths Reference</div>
                ${renderMagicPathReferenceHtml('Witch')}
            </div>
        `;
        return;
    }

    const isWitch = char.magicPath === 'witch';
    const hasHedgeGifts = (char.hedgeGifts || []).length > 0 || (char.witch?.hedgeGifts || []).length > 0;
    const hasCraftOfTheHedge = (char.talents || []).some(t =>
        t.name === 'Craft of the Hedge' || t.id === 'craft-of-the-hedge'
    );

    // If not a witch but has Hedge Gifts or Craft of the Hedge, show limited view
    if (!isWitch && !hasHedgeGifts && !hasCraftOfTheHedge) {
        el.innerHTML = `
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🧹</div>
                <p>Hedge magic is available to all characters with the <strong>Craft of the Hedge</strong> talent.</p>
                <p style="font-size:0.85rem;">Learn Hedge Gifts, craft items, and work with thresholds.</p>
                <p style="font-size:0.75rem;color:var(--text2);">Witches gain deeper access to rituals and price tracks.</p>
            </div>
        `;
        return;
    }

    const patronId = char.patron;
    const witchcraftData = patronId ? findPatronWitchcraft(patronId) : null;
    const prices = getPriceTracks(char);
    const timers = getPromiseTimers(char);
    const gifts = getHedgeGifts(char);
    const rituals = getFullRituals(char);
    const crafted = getCraftedItems(char);
    const allPatrons = getAllWitchcraftPatrons();

    // Build list of available gifts for dropdown (universal + patron)
    const patronGifts = witchcraftData?.witchcraft?.hedge_gifts || [];
    const availableGifts = [...UNIVERSAL_HEDGE_GIFTS, ...patronGifts];
    // Remove duplicates (by id)
    const seen = new Set();
    const uniqueGifts = availableGifts.filter(g => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
    });

    const identityThreshold = prices.identityStrain >= 3;

    // Determine which sections to show
    const showFullWitch = isWitch;

    el.innerHTML = `
        <div class="witchcraft-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="witchcraft-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;background:linear-gradient(135deg, var(--bg2) 0%, var(--bg1) 100%);border-radius:var(--radius) var(--radius) 0 0;padding:0.3rem 0.8rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🧹</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Hedge Magic</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-left:0.3rem;">${isWitch ? 'Witch' : 'Hedge-Gifted'}</span>
                        ${witchcraftData ? `<span style="font-size:0.6rem;color:var(--text3);">· ${witchcraftData.patron.name}</span>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" onclick="window.witchQuickWork()">⚡ Quick Work</button>
                    ${showFullWitch ? `<button class="btn btn-sm btn-secondary" onclick="window.witchFullRitual()">🕯️ Ritual</button>` : ''}
                    <button class="btn btn-sm btn-secondary" onclick="window.witchCraftItem()">🔧 Craft</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.witchAddGift()">🌿 Gift</button>
                    <button class="btn btn-sm btn-ghost" onclick="window.witchRefresh()">🔄</button>
                </div>
            </div>

            <!-- ─── Price Tracks (Witches only) ────────────────── -->
            ${showFullWitch ? `
                <div class="witchcraft-prices" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.3rem;background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;${identityThreshold ? 'border:2px solid var(--red);' : 'border:1px solid var(--border);'}">
                    ${Object.entries(PRICE_THRESHOLDS).map(([key, meta]) => {
                        const value = prices[key] || 0;
                        const pct = Math.min(100, (value / meta.max) * 100);
                        const isWarning = value >= meta.warningAt;
                        return `
                            <div style="text-align:center;">
                                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                                    <span style="color:${meta.color};">${meta.icon} ${meta.label}</span>
                                    <span style="font-weight:600;color:${isWarning ? 'var(--red)' : 'var(--text)'};">${value}/${meta.max}</span>
                                </div>
                                <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                                    <div style="width:${pct}%;height:100%;background:${isWarning ? 'var(--red)' : meta.color};border-radius:3px;transition:width 0.3s;"></div>
                                </div>
                                ${isWarning ? `<div style="font-size:0.5rem;color:var(--red);">⚠️ Near threshold</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                    <div style="display:flex;gap:0.2rem;align-items:center;justify-content:center;">
                        <button class="btn btn-xs btn-ghost" onclick="window.witchClearPrices()" style="font-size:0.6rem;">✕ Clear</button>
                    </div>
                </div>
            ` : ''}

            <!-- ─── Weaver Display ─────────────────────────────── -->
            ${witchcraftData ? renderWeaver(witchcraftData, char) : renderNoWeaver(allPatrons)}

            <!-- ─── Hedge Gifts ────────────────────────────────── -->
            <div class="witchcraft-gifts" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🌿 Hedge Gifts</span>
                    <div style="display:flex;gap:0.2rem;align-items:center;">
                        <span style="font-size:0.6rem;color:var(--text3);">${gifts.length} learned</span>
                        <select id="witch-gift-select" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.3rem;max-width:140px;">
                            ${uniqueGifts.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                        </select>
                        <button class="btn btn-xs btn-secondary" onclick="window.witchAddGiftFromSelect()">+ Add</button>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:200px;overflow-y:auto;">
                    ${gifts.length === 0 ? `
                        <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                            No hedge gifts learned. Select a gift from the dropdown and click "Add".
                        </div>
                    ` : gifts.map(g => renderGiftItem(g, char)).join('')}
                </div>
            </div>

            <!-- ─── Promise Timers ────────────────────────────── -->
            <div class="witchcraft-timers" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">⏳ Promise Timers</span>
                    <div style="display:flex;gap:0.2rem;">
                        <span style="font-size:0.6rem;color:var(--text3);">${timers.length} active</span>
                        <button class="btn btn-xs btn-secondary" onclick="window.witchAddTimer()">+ Add</button>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:150px;overflow-y:auto;">
                    ${timers.length === 0 ? `
                        <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                            No active promises. When you make a deal, track it here.
                        </div>
                    ` : timers.map(t => renderTimerItem(t, char)).join('')}
                </div>
            </div>

            <!-- ─── Crafting ────────────────────────────────────── -->
            <div class="witchcraft-crafting" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🔧 Crafted Items</span>
                    <div style="display:flex;gap:0.2rem;">
                        <span style="font-size:0.6rem;color:var(--text3);">${crafted.length} items</span>
                        <button class="btn btn-xs btn-secondary" onclick="window.witchCraftItem()">+ Craft</button>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:150px;overflow-y:auto;">
                    ${crafted.length === 0 ? `
                        <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                            No crafted items. Use the Craft button to make something.
                        </div>
                    ` : crafted.map(c => renderCraftedItem(c, char)).join('')}
                </div>
            </div>

            <!-- ─── Full Rituals (Witches only) ────────────────── -->
            ${showFullWitch ? `
                <div class="witchcraft-rituals" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                        <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🕯️ Full Rituals</span>
                        <span style="font-size:0.6rem;color:var(--text3);">${rituals.length} performed</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:120px;overflow-y:auto;">
                        ${rituals.length === 0 ? `
                            <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                                No rituals performed. Perform a ritual to shape the world.
                            </div>
                        ` : rituals.slice(-5).reverse().map(r => renderRitualItem(r, char)).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- ─── Quick Reference ────────────────────────────── -->
            <div class="witchcraft-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.1rem;font-size:0.6rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.15rem 0.3rem;border:1px solid var(--border);">
                <div>🌿 <strong>Gifts:</strong> No-roll, limited scope</div>
                <div>⚡ <strong>Quick:</strong> Single action, roll required</div>
                ${showFullWitch ? `<div>🕯️ <strong>Ritual:</strong> Extended, lasting effects</div>` : ''}
                <div>🔧 <strong>Craft:</strong> Recipes, materials, XP</div>
                <div>⏳ <strong>Timer:</strong> When full, price comes due</div>
            </div>

            <!-- ─── The Gray Wanderer's Wisdom ──────────────────── -->
            <div class="witchcraft-wisdom" style="background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.5rem;border-left:4px solid var(--gold);font-size:0.7rem;color:var(--text3);font-style:italic;">
                "${witchcraftData?.witchcraft?.quote || 'The hedge is what keeps the wolves from the flock. I am the one who tends the hedge.'}"
                <span style="display:block;text-align:right;font-size:0.6rem;color:var(--text2);">— The Gray Wanderer</span>
            </div>

        </div>
    `;

    // After rendering, attach any extra event listeners (none needed for this file)
}

// ============================================================
// RENDER HELPERS
// ============================================================

function renderWeaver(witchcraftData, char) {
    const patron = witchcraftData.patron;
    const wc = witchcraftData.witchcraft;
    const color = wc.color || '#d4af37';
    const icon = patron.icon || '🧙';
    const name = patron.name || patron.title || 'The Weaver';
    const description = wc.description || 'A witch of the hedge.';
    const signatureRite = wc.signature_rite || 'Unknown';
    const hedgeGifts = wc.hedge_gifts || [];

    return `
        <div class="witchcraft-weaver" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid ${color};border:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                <span style="font-size:1.2rem;">${icon}</span>
                <span style="font-weight:600;font-size:0.95rem;color:${color};">${name}</span>
                <span style="font-size:0.7rem;color:var(--text3);">${description}</span>
                ${witchcraftData.religion ? `<span style="font-size:0.6rem;color:var(--text3);">⛪ ${witchcraftData.religion}</span>` : ''}
            </div>
            ${wc.lore ? `<div style="font-size:0.75rem;color:var(--text2);margin:0.15rem 0;">${wc.lore}</div>` : ''}
            ${signatureRite ? `<div style="font-size:0.75rem;color:var(--text2);"><strong>Signature Rite:</strong> ${signatureRite}</div>` : ''}
            ${hedgeGifts.length > 0 ? `
                <div style="display:flex;gap:0.3rem;font-size:0.65rem;color:var(--text3);flex-wrap:wrap;margin-top:0.1rem;">
                    ${hedgeGifts.map(g => `<span>🌿 ${g.name}</span>`).join(' · ')}
                </div>
            ` : ''}
        </div>
    `;
}

function renderNoWeaver(allPatrons) {
    const list = allPatrons.map(p =>
        `• ${p.patronIcon} ${p.patronName}: ${p.witchcraft.name || 'Witchcraft'}`
    ).join('\n');

    return `
        <div class="witchcraft-no-weaver" style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
            <div style="font-size:1.5rem;">🧙</div>
            <p>No weaver selected. Choose a patron who offers witchcraft.</p>
            <div style="font-size:0.7rem;text-align:left;max-height:80px;overflow-y:auto;padding:0.2rem;background:var(--bg3);border-radius:var(--radius);margin:0.2rem 0;">
                ${list || 'No patrons with witchcraft found. Check your patron JSON files.'}
            </div>
            <button class="btn btn-sm btn-primary" onclick="window.witchChooseWeaver()">Choose Weaver</button>
        </div>
    `;
}

function renderGiftItem(gift, char) {
    return `
        <div class="gift-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
            <div style="flex:1;min-width:0;">
                <span style="font-weight:600;">${escHtml(gift.name)}</span>
                <span style="font-size:0.65rem;color:var(--text3);">${escHtml(gift.effect)}</span>
                ${gift.limit ? `<span style="font-size:0.55rem;color:var(--text2);">(${gift.limit})</span>` : ''}
            </div>
            <button class="btn btn-xs btn-ghost" onclick="window.witchRemoveGift('${gift.id || gift.name}')" style="color:var(--red);font-size:0.6rem;">✕</button>
        </div>
    `;
}

function renderTimerItem(timer, char) {
    const pct = Math.min(100, ((timer.current || 0) / (timer.segments || 4)) * 100);
    const isFull = pct >= 100;
    return `
        <div class="timer-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;">
                    <span style="font-weight:600;color:${isFull ? 'var(--red)' : 'var(--text)'};">${escHtml(timer.name)}</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${timer.current || 0}/${timer.segments || 4}</span>
                </div>
                <div style="width:100%;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${isFull ? 'var(--red)' : pct > 80 ? 'var(--orange)' : 'var(--gold)'};border-radius:2px;"></div>
                </div>
                ${timer.description ? `<div style="font-size:0.6rem;color:var(--text2);">${escHtml(timer.description)}</div>` : ''}
                ${isFull ? `<div style="font-size:0.6rem;color:var(--red);">⚠️ DUE!</div>` : ''}
            </div>
            <div style="display:flex;gap:0.2rem;">
                <button class="btn btn-xs btn-secondary" onclick="window.witchTickTimer('${timer.id}')" style="font-size:0.6rem;">+</button>
                <button class="btn btn-xs btn-ghost" onclick="window.witchRemoveTimer('${timer.id}')" style="color:var(--red);font-size:0.6rem;">✕</button>
            </div>
        </div>
    `;
}

function renderCraftedItem(item, char) {
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
                <button class="btn btn-xs btn-gold" onclick="window.witchUseCraftedItem('${item.id}')" style="font-size:0.6rem;">Use</button>
                <button class="btn btn-xs btn-ghost" onclick="window.witchRemoveCraftedItem('${item.id}')" style="color:var(--red);font-size:0.6rem;">✕</button>
            </div>
        </div>
    `;
}

function renderRitualItem(ritual, char) {
    return `
        <div class="ritual-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.7rem;">
            <div style="flex:1;min-width:0;">
                <span style="font-weight:600;">${escHtml(ritual.name)}</span>
                <span style="font-size:0.6rem;color:var(--text3);">${ritual.result || 'Pending'}</span>
                ${ritual.effect ? `<span style="font-size:0.6rem;color:var(--text2);">— ${escHtml(ritual.effect)}</span>` : ''}
            </div>
            <span style="font-size:0.5rem;color:var(--text3);">${ritual.date || ''}</span>
        </div>
    `;
}

// ============================================================
// GLOBAL FUNCTIONS (exposed to HTML onclick)
// ============================================================

// ─── Hedge Gifts ──────────────────────────────────────────────

window.witchAddGiftFromSelect = function() {
    const char = getCharacterData();
    if (!char) return;

    // Check if they have Craft of the Hedge
    const hasCraft = (char.talents || []).some(t =>
        t.name === 'Craft of the Hedge' || t.id === 'craft-of-the-hedge'
    );
    if (!hasCraft && char.magicPath !== 'witch') {
        showToast('Learn the "Craft of the Hedge" talent first.', 'error');
        return;
    }

    const select = document.getElementById('witch-gift-select');
    if (!select) return;
    const giftId = select.value;
    const patronData = char.patron ? findPatronWitchcraft(char.patron) : null;
    const patronGifts = patronData?.witchcraft?.hedge_gifts || [];
    const available = [...UNIVERSAL_HEDGE_GIFTS, ...patronGifts];
    const selected = available.find(g => g.id === giftId);
    if (!selected) {
        showToast('Gift not found.', 'error');
        return;
    }

    const gifts = getHedgeGifts(char);
    if (gifts.some(g => g.name === selected.name)) {
        showToast('Already learned this gift.', 'warning');
        return;
    }

    gifts.push({ ...selected, id: generateId('gift_') });
    // Save the whole witch object to avoid clobbering siblings
    saveCharacter({ witch: char.witch });
    showToast(`🌿 Learned "${selected.name}"`, 'success');
    window.witchRefresh();
};

// The old `window.witchAddGift` is kept for backward compatibility but now
// redirects to the select-based version.
window.witchAddGift = function() {
    // If the select exists, use it; otherwise, show a message.
    const select = document.getElementById('witch-gift-select');
    if (select) {
        window.witchAddGiftFromSelect();
    } else {
        showToast('Please refresh the panel to see the gift selection dropdown.', 'info');
    }
};

window.witchRemoveGift = function(giftId) {
    const char = getCharacterData();
    if (!char) return;
    let gifts = getHedgeGifts(char);
    gifts = gifts.filter(g => g.id !== giftId && g.name !== giftId);
    char.witch.hedgeGifts = gifts;
    saveCharacter({ witch: char.witch });
    showToast('Removed gift.', 'info');
    window.witchRefresh();
};

// ─── Quick Work ───────────────────────────────────────────────

window.witchQuickWork = function() {
    const char = getCharacterData();
    if (!char) return;

    // Step 1: Name the Threshold
    const threshold = prompt('⚡ Name the threshold (door, tide line, wound, vow, breath):', 'door');
    if (!threshold) return;

    // Step 2: Choose a Layer
    const layerOptions = '1. Echo (past memory, accumulated intention)\n2. Veil (present boundary, current state)\n3. Flow (future direction, will of elements)';
    const layerChoice = prompt(`Choose a layer:\n\n${layerOptions}\n\nEnter 1, 2, or 3:`, '2');
    if (!layerChoice) return;
    const layerMap = { '1': 'Echo', '2': 'Veil', '3': 'Flow' };
    const layer = layerMap[layerChoice];
    if (!layer) { showToast('Invalid layer. Choose 1, 2, or 3.', 'error'); return; }

    // Step 3: Choose a Tag
    const tag = prompt('Choose a single Tag (e.g., BIND, LIGHT, SILENCE, BURNING, HEAL, WARD):', 'BIND');
    if (!tag) return;

    // Step 4: Set Position
    const pos = prompt('Position: Controlled (you have time) or Desperate (threatened)', 'Controlled');
    const isDesperate = pos.toLowerCase() === 'desperate';

    // Step 5: Roll
    const wits = char.wits || 1;
    const lore = char.skills?.lore || 0;
    const pool = wits + lore;
    const dv = isDesperate ? 4 : 3;
    const result = rollDice(pool);

    // Step 6: Determine Outcome and Price
    let outcome, priceType, sbCount = 0, boons = 0;
    if (result.successes >= dv && result.ones === 0) {
        outcome = '✨ Clean Success';
        priceType = 'none';
    } else if (result.successes >= dv && result.ones > 0) {
        outcome = '⚠️ Success with SB';
        priceType = 'shadow';
        sbCount = result.ones;
    } else if (result.successes > 0 && result.successes < dv) {
        outcome = '⚠️ Partial Success';
        priceType = 'shame';
        sbCount = result.ones;
        boons = 1;
    } else {
        outcome = '💀 Miss';
        priceType = 'identity';
        sbCount = result.ones || 1;
        boons = 2;
    }

    // Apply price (only if witch)
    const isWitch = char.magicPath === 'witch';
    let priceApplied = false;
    if (isWitch && priceType !== 'none') {
        const prices = getPriceTracks(char);
        if (priceType === 'shadow') {
            prices.shadow += 1;
            priceApplied = true;
        } else if (priceType === 'shame') {
            prices.shame += 1;
            priceApplied = true;
        } else if (priceType === 'identity') {
            prices.identityStrain += 1;
            priceApplied = true;
        }
        if (priceApplied) {
            saveCharacter({ witch: char.witch });
            if (prices.identityStrain >= 3) {
                showToast('🌀 Identity Strain threshold reached! Risk losing something of yourself.', 'error');
            }
        }
    }

    // Boons
    if (boons > 0) {
        char.boons = (char.boons || 0) + boons;
        if (char.boons > 5) char.boons = 5;
        saveCharacter({ boons: char.boons });
    }

    const outcomeColor = outcome === '✨ Clean Success' ? 'var(--green)' :
                         outcome === '⚠️ Success with SB' ? 'var(--gold)' :
                         outcome === '⚠️ Partial Success' ? 'var(--orange)' : 'var(--red)';

    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;max-width:400px;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">⚡ Quick Working</div>
            <div style="font-size:0.85rem;color:var(--text2);">
                <div><strong>Threshold:</strong> ${escHtml(threshold)}</div>
                <div><strong>Layer:</strong> ${escHtml(layer)} · <strong>Tag:</strong> ${escHtml(tag)}</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text3);">Pool: ${pool}d · DV: ${dv} · Position: ${isDesperate ? 'Desperate' : 'Controlled'}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${result.successes}</strong> successes, ${result.ones} ones</div>
            <div style="font-size:1rem;font-weight:600;color:${outcomeColor};">${outcome}</div>
            ${priceApplied ? `<div style="color:var(--red);font-size:0.8rem;">Price: ${priceType} (+1)</div>` : '<div style="color:var(--green);">No price.</div>'}
            ${sbCount > 0 ? `<div style="color:var(--text3);font-size:0.75rem;">📖 GM gains ${sbCount} SB</div>` : ''}
            ${boons > 0 ? `<div style="color:var(--gold);font-size:0.75rem;">⭐ +${boons} Boon${boons > 1 ? 's' : ''}</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>
        </div>
    `;

    showToastWithHTML(msg, outcome === '✨ Clean Success' ? 'success' : 'info');
    window.witchRefresh();
};

// ─── Full Ritual ──────────────────────────────────────────────

window.witchFullRitual = function() {
    const char = getCharacterData();
    if (!char) return;

    if (char.magicPath !== 'witch') {
        showToast('Full rituals require the Witch magic path.', 'error');
        return;
    }

    // Step 1: Identify the Threshold
    const threshold = prompt('🕯️ Step 1: Identify the Threshold (door, crossroads, grave, hearth):', 'Crossroads');
    if (!threshold) return;

    // Step 2: Choose a Witness
    const witness = prompt('Step 2: Choose a Witness (person, spirit, Hollowed):', 'The Pale Shepherd');
    if (!witness) return;

    // Step 3: Name the Will
    const will = prompt('Step 3: Name the Will (what do you intend to change?):', 'Heal the land');
    if (!will) return;

    // Step 4: Set the Price
    const price = prompt('Step 4: Set the Price (memory, name, lock of hair, promise, blood):', 'Memory of a childhood home');
    if (!price) return;

    // Step 5: Make the Exchange
    const dv = safeParseInt(prompt('Step 5: Difficulty (DV 3-6):', '4'), 4);
    const spirit = char.spirit || 1;
    const lore = char.skills?.lore || 0;
    const pool = spirit + lore;
    const result = rollDice(pool);

    let outcome, success = false, boons = 0, sbCount = 0;
    if (result.successes >= dv && result.ones === 0) {
        outcome = '✅ Success';
        success = true;
    } else if (result.successes >= dv && result.ones > 0) {
        outcome = '⚠️ Success with Echo';
        success = true;
        sbCount = result.ones;
    } else if (result.successes > 0 && result.successes < dv) {
        outcome = '⚠️ Partial Success';
        boons = 1;
    } else {
        outcome = '❌ Failure';
        sbCount = result.ones || 1;
        boons = 2;
    }

    // Apply Identity Strain
    const prices = getPriceTracks(char);
    prices.identityStrain += 1;
    saveCharacter({ witch: char.witch });
    if (prices.identityStrain >= 3) {
        showToast('🌀 Identity Strain threshold reached! Risk losing something of yourself.', 'error');
    }

    // Boons
    if (boons > 0) {
        char.boons = (char.boons || 0) + boons;
        if (char.boons > 5) char.boons = 5;
        saveCharacter({ boons: char.boons });
    }

    // Log the ritual
    const rituals = getFullRituals(char);
    rituals.push({
        id: generateId('ritual_'),
        name: will.slice(0, 30) + (will.length > 30 ? '...' : ''),
        effect: will,
        threshold,
        witness,
        price,
        dv,
        result: success ? 'Success' : outcome,
        date: new Date().toLocaleDateString()
    });
    saveCharacter({ witch: char.witch });

    const outcomeColor = success ? 'var(--green)' : outcome === '⚠️ Partial Success' ? 'var(--orange)' : 'var(--red)';

    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;max-width:400px;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">🕯️ Full Ritual</div>
            <div style="font-size:0.85rem;color:var(--text2);">
                <div><strong>Threshold:</strong> ${escHtml(threshold)}</div>
                <div><strong>Witness:</strong> ${escHtml(witness)}</div>
                <div><strong>Will:</strong> ${escHtml(will)}</div>
                <div><strong>Price:</strong> ${escHtml(price)}</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text3);">Pool: ${pool}d · DV: ${dv}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${result.successes}</strong> successes</div>
            <div style="font-size:1rem;font-weight:600;color:${outcomeColor};">${outcome}</div>
            <div style="color:var(--red);font-size:0.8rem;">🌀 Identity Strain +1</div>
            ${sbCount > 0 ? `<div style="color:var(--text3);font-size:0.75rem;">📖 GM gains ${sbCount} SB</div>` : ''}
            ${boons > 0 ? `<div style="color:var(--gold);font-size:0.75rem;">⭐ +${boons} Boon${boons > 1 ? 's' : ''}</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>
        </div>
    `;

    showToastWithHTML(msg, success ? 'success' : 'info');
    window.witchRefresh();
};

// ─── Crafting ──────────────────────────────────────────────────

window.witchCraftItem = function() {
    const char = getCharacterData();
    if (!char) return;

    const recipeList = Object.values(CRAFTING_RECIPES);
    const recipeOptions = recipeList.map((r, i) =>
        `${i+1}. ${r.name} – ${r.effect} (DV ${r.dv}, ${r.xpCost} XP, ${r.tier})`
    ).join('\n');

    const choice = prompt(`🔧 Available recipes:\n\n${recipeOptions}\n\nEnter the number:`, '1');
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= recipeList.length) {
        showToast('Invalid selection.', 'error');
        return;
    }

    const recipe = recipeList[idx];
    const skillLevel = char.skills?.[recipe.skill] || 0;
    const attr = recipe.skill === 'medicine' ? 'wits' :
                 recipe.skill === 'craft' ? 'wits' : 'spirit';
    const attrValue = char[attr] || 1;
    const pool = attrValue + skillLevel;
    const result = rollDice(pool);
    const dv = recipe.dv;

    let outcome, success = false, boons = 0, sbCount = 0;
    if (result.successes >= dv) {
        outcome = '✅ Success';
        success = true;
    } else if (result.successes > 0 && result.successes < dv) {
        outcome = '⚠️ Partial';
        boons = 1;
    } else {
        outcome = '❌ Failure';
        sbCount = result.ones || 1;
        boons = 2;
    }

    // Deduct XP if successful
    if (success || outcome === '⚠️ Partial') {
        const xpCost = recipe.xpCost;
        const totalXp = char.totalXp || 0;
        const spent = char.xpSpent || 0;
        const available = totalXp - spent;
        if (available < xpCost) {
            showToast(`Not enough XP. Need ${xpCost}, have ${available}.`, 'error');
            return;
        }
        char.xpSpent = spent + xpCost;
        saveCharacter({ xpSpent: char.xpSpent });
    }

    // Boons
    if (boons > 0) {
        char.boons = (char.boons || 0) + boons;
        if (char.boons > 5) char.boons = 5;
        saveCharacter({ boons: char.boons });
    }

    // Add to crafted items
    if (success || outcome === '⚠️ Partial') {
        const crafted = getCraftedItems(char);
        const quality = success ? 'standard' : 'flawed';
        crafted.push({
            id: generateId('crafted_'),
            name: recipe.name,
            effect: recipe.effect,
            quality: quality,
            uses: recipe.tier === 'standard' ? 2 : 1,
            recipe: recipe.id,
            icon: recipe.icon || '🔧',
            createdAt: Date.now()
        });
        saveCharacter({ witch: char.witch });
        showToast(`🔧 Crafted "${recipe.name}"!`, 'success');
    } else {
        showToast('❌ Crafting failed. Materials consumed.', 'error');
    }

    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;max-width:400px;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">🔧 Crafting: ${escHtml(recipe.name)}</div>
            <div style="font-size:0.8rem;color:var(--text2);">${escHtml(recipe.description)}</div>
            <div style="font-size:0.75rem;color:var(--text3);">Pool: ${pool}d · DV: ${dv}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${result.successes}</strong> successes</div>
            <div style="font-size:1rem;font-weight:600;color:${success ? 'var(--green)' : outcome === '⚠️ Partial' ? 'var(--orange)' : 'var(--red)'};">${outcome}</div>
            ${success || outcome === '⚠️ Partial' ? `<div style="color:var(--text3);font-size:0.75rem;">Cost: ${recipe.xpCost} XP</div>` : ''}
            ${boons > 0 ? `<div style="color:var(--gold);font-size:0.75rem;">⭐ +${boons} Boon${boons > 1 ? 's' : ''}</div>` : ''}
            ${sbCount > 0 ? `<div style="color:var(--text3);font-size:0.75rem;">📖 GM gains ${sbCount} SB</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>
        </div>
    `;

    showToastWithHTML(msg, 'info');
    window.witchRefresh();
};

window.witchUseCraftedItem = function(itemId) {
    const char = getCharacterData();
    if (!char) return;
    const crafted = getCraftedItems(char);
    const item = crafted.find(c => c.id === itemId);
    if (!item) return showToast('Item not found.', 'error');

    const effect = item.effect || 'The item is used.';
    showToast(`🧪 Used "${item.name}": ${effect}`, 'success');

    item.uses = (item.uses || 1) - 1;
    if (item.uses <= 0) {
        window.witchRemoveCraftedItem(itemId);
    } else {
        saveCharacter({ witch: char.witch });
        window.witchRefresh();
    }
};

window.witchRemoveCraftedItem = function(itemId) {
    const char = getCharacterData();
    if (!char) return;
    let crafted = getCraftedItems(char);
    crafted = crafted.filter(c => c.id !== itemId);
    char.witch.crafted = crafted;
    saveCharacter({ witch: char.witch });
    showToast('Item removed.', 'info');
    window.witchRefresh();
};

// ─── Promise Timers ────────────────────────────────────────────

window.witchAddTimer = function() {
    const char = getCharacterData();
    if (!char) return;

    const name = prompt('⏳ Promise name:', 'Debt to the Web');
    if (!name) return;
    const segments = safeParseInt(prompt('Segments (default 4):', '4'), 4);
    const description = prompt('Description (when due):', 'Price comes due') || '';

    const timers = getPromiseTimers(char);
    timers.push({
        id: generateId('timer_'),
        name,
        segments: Math.max(1, segments),
        current: 0,
        description,
        createdAt: Date.now()
    });
    saveCharacter({ witch: char.witch });
    showToast(`⏳ Promise "${name}" created.`, 'success');
    window.witchRefresh();
};

window.witchTickTimer = function(timerId) {
    const char = getCharacterData();
    if (!char) return;
    const timers = getPromiseTimers(char);
    const timer = timers.find(t => t.id === timerId);
    if (!timer) return showToast('Timer not found.', 'error');

    timer.current = (timer.current || 0) + 1;
    if (timer.current >= timer.segments) {
        showToast(`⏳ "${timer.name}" is full! The price comes due.`, 'warning');
    }
    saveCharacter({ witch: char.witch });
    window.witchRefresh();
};

window.witchRemoveTimer = function(timerId) {
    const char = getCharacterData();
    if (!char) return;
    let timers = getPromiseTimers(char);
    timers = timers.filter(t => t.id !== timerId);
    char.witch.promiseTimers = timers;
    saveCharacter({ witch: char.witch });
    showToast('Timer removed.', 'info');
    window.witchRefresh();
};

// ─── Price Management ─────────────────────────────────────────

window.witchClearPrices = function() {
    const char = getCharacterData();
    if (!char) return;
    if (!confirm('Clear all price tracks?')) return;
    const prices = getPriceTracks(char);
    prices.shadow = 0;
    prices.shame = 0;
    prices.identityStrain = 0;
    saveCharacter({ witch: char.witch });
    showToast('Prices cleared.', 'info');
    window.witchRefresh();
};

// ─── Weaver Selection ─────────────────────────────────────────

// Note: weaver selection still uses a prompt because it involves choosing a patron
// from a list, but we could later add a dropdown. For now we keep the prompt.

window.witchChooseWeaver = function() {
    const char = getCharacterData();
    if (!char) return;

    const allPatrons = getAllWitchcraftPatrons();
    if (allPatrons.length === 0) {
        showToast('No patrons with witchcraft found.', 'error');
        return;
    }

    const list = allPatrons.map((p, i) =>
        `${i+1}. ${p.patronIcon} ${p.patronName} – ${p.witchcraft.name || 'Witchcraft'}`
    ).join('\n');

    const choice = prompt(`🧙 Choose a weaver:\n\n${list}\n\nEnter the number:`, '1');
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= allPatrons.length) {
        showToast('Invalid selection.', 'error');
        return;
    }

    const selected = allPatrons[idx];
    char.patron = selected.patronId;
    saveCharacter({ patron: selected.patronId });
    showToast(`🧙 Chosen weaver: ${selected.patronName}`, 'success');
    window.witchRefresh();
};

// ─── Refresh ──────────────────────────────────────────────────

window.witchRefresh = function() {
    const container = document.querySelector('.witchcraft-container');
    if (container) {
        renderWitchcraft(container);
    } else {
        const el = document.getElementById('spellcraft-content');
        if (el) {
            import('../index.js').then(module => {
                if (module.renderActiveTabContent) module.renderActiveTabContent();
            });
        }
    }
    showToast('🔄 Hedge magic refreshed.', 'info');
};

// ============================================================
// TOAST WITH HTML (shared)
// ============================================================

function showToastWithHTML(html, type = 'info') {
    const existing = document.querySelector('.custom-toast-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'custom-toast-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = `
        background: var(--bg1); padding: 1.2rem; border-radius: var(--radius);
        max-width: 420px; width: 90%; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 80vh; overflow-y: auto;
    `;
    inner.innerHTML = html + `<br><button class="btn btn-xs btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>`;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    if (!document.getElementById('toast-animation-style')) {
        const style = document.createElement('style');
        style.id = 'toast-animation-style';
        style.textContent = `
            @keyframes toastFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => { if (modal.parentNode) modal.remove(); }, 10000);
}

// ============================================================
// EXPORT – keep single default export
// ============================================================

export default { renderWitchcraft };