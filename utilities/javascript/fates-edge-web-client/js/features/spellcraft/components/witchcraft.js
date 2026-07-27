/**
 * Witchcraft – The Hedge and the Threshold
 *
 * Data-driven: weaver data is loaded from patron JSON files via the patrons feature.
 * Each patron can have a "witchcraft" property that defines hedge gifts, signature rites, etc.
 *
 * "The hedge is what keeps the wolves from the flock. I am the one who tends the hedge."
 * – The Gray Wanderer
 *
 * Witchcraft is a practice, not just a path. Any character can learn Hedge Gifts,
 * but those who walk the Witch path gain deeper access to the Weave's hidden grammar.
 * This component provides:
 * - Hedge Gifts (no roll, limited scope)
 * - Quick Workings (single action, roll required)
 * - Full Rituals (extended, lasting effects)
 * - Price tracking (Shadow, Shame, Identity Strain)
 * - Promise Timers (debts and obligations)
 * - Crafting (potions, charms, and alchemy)
 * - Weaver selection (patron-specific traditions)
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml, generateId, safeParseInt } from '../../../core/utils.js';
import { showToast } from '../../../components/Toast.js';
import { getState } from '../../../core/state.js';

// ============================================================
// CONSTANTS – Universal Hedge Gifts (not patron-specific)
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

// ============================================================
// CRAFTING RECIPES (Universal)
// ============================================================

const CRAFTING_RECIPES = {
    'healing-poultice': {
        id: 'healing-poultice',
        name: 'Healing Poultice',
        description: 'A balm of herbs and salves that speeds recovery.',
        effect: 'Remove 1 Fatigue from a touched ally (or self) when applied during a short rest.',
        materials: ['Herbs (1 Supply)', 'Clean cloth', 'Time (1 hour)'],
        skill: 'medicine',
        dv: 2,
        xpCost: 1,
        tier: 'minor'
    },
    'antidote': {
        id: 'antidote',
        name: 'Antidote',
        description: 'A bitter draught that neutralises common poisons.',
        effect: 'Remove one Poisoned Condition from a willing creature.',
        materials: ['Specific herb (rare)', 'Distilled water', 'Charcoal'],
        skill: 'medicine',
        dv: 3,
        xpCost: 2,
        tier: 'minor'
    },
    'sleep-draught': {
        id: 'sleep-draught',
        name: 'Sleep Draught',
        description: 'A sweet syrup that induces deep, dreamless sleep.',
        effect: 'Target must test Spirit+Resolve (DV 3) or fall asleep for 1 hour. Wakes if harmed.',
        materials: ['Valerian root', 'Honey', 'Moonwater'],
        skill: 'craft',
        dv: 3,
        xpCost: 1,
        tier: 'minor'
    },
    'ward-salt': {
        id: 'ward-salt',
        name: 'Ward Salt',
        description: 'Salt blessed and ground with protective herbs.',
        effect: 'Pour a line; spirits and undead must test Spirit+Resolve (DV 4) to cross.',
        materials: ['Salt (1 Supply)', 'Blessed ash', 'Iron filings'],
        skill: 'lore',
        dv: 3,
        xpCost: 2,
        tier: 'minor'
    },
    'truth-serum': {
        id: 'truth-serum',
        name: 'Truth Serum',
        description: 'A clear liquid that loosens the tongue.',
        effect: 'Target must test Spirit+Resolve (DV 4) or speak only truth for one exchange.',
        materials: ['Nightshade (carefully prepared)', 'Pure water', 'A drop of the target\'s blood'],
        skill: 'craft',
        dv: 4,
        xpCost: 3,
        tier: 'standard'
    },
    'moon-tea': {
        id: 'moon-tea',
        name: 'Moon Tea',
        description: 'A calming infusion that sharpens dreams and intuition.',
        effect: 'Drinker gains +1 die on the next Wits or Spirit roll within 1 hour.',
        materials: ['Chamomile', 'Moonwort', 'Honey'],
        skill: 'craft',
        dv: 2,
        xpCost: 1,
        tier: 'minor'
    },
    'fire-powder': {
        id: 'fire-powder',
        name: 'Fire Powder',
        description: 'A volatile powder that ignites on contact with air.',
        effect: 'When thrown, creates a small fire (Harm 2, Area) in Close range. One use.',
        materials: ['Sulphur', 'Charcoal', 'Saltpetre'],
        skill: 'craft',
        dv: 4,
        xpCost: 3,
        tier: 'standard'
    },
    'blessed-oil': {
        id: 'blessed-oil',
        name: 'Blessed Oil',
        description: 'Oil consecrated to a Patron or Threshold.',
        effect: 'Anoint a weapon or threshold; it counts as [WARD] or [BLESSED] for one scene.',
        materials: ['Olive oil', 'Incense', 'A prayer or rite'],
        skill: 'lore',
        dv: 3,
        xpCost: 2,
        tier: 'standard'
    }
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
// HELPER FUNCTIONS
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
// MAIN RENDER
// ============================================================

export function renderWitchcraft(el) {
    const char = getCharacterData();
    if (!char || char.magicPath !== 'witch') {
        el.innerHTML = `
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🧹</div>
                <p>Witchcraft is only available to characters with the Witch magic path.</p>
                <p style="font-size:0.85rem;">Select a character with the Witch path to view their hedge magic.</p>
                <p style="font-size:0.75rem;color:var(--text2);">(Characters with Hedge Gifts can still craft items using the Crafting section.)</p>
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

    const identityThreshold = prices.identityStrain >= 4;

    el.innerHTML = `
        <div class="witchcraft-container" style="display:flex;flex-direction:column;gap:0.8rem;">
            <!-- Header -->
            <div class="witchcraft-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:1px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.2rem;">🧹</span>
                    <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Witchcraft</span>
                    <span style="font-size:0.7rem;color:var(--text3);">${witchcraftData ? witchcraftData.patron.name : 'No Weaver'}</span>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" onclick="window.witchQuickWork()">⚡ Quick Work</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.witchFullRitual()">🕯️ Full Ritual</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.witchCraftItem()">🔧 Craft</button>
                    <button class="btn btn-sm btn-ghost" onclick="window.witchRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- Price Tracks -->
            <div class="witchcraft-prices" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.3rem;background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;${identityThreshold ? 'border:2px solid var(--red);' : ''}">
                <div>
                    <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
                        <span>🌑 Shadow</span>
                        <span>${prices.shadow}</span>
                    </div>
                    <div style="width:100%;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;">
                        <div style="width:${Math.min(100, prices.shadow * 20)}%;height:100%;background:var(--purple);"></div>
                    </div>
                    <div style="font-size:0.6rem;color:var(--text3);">Clears when tells manifest</div>
                </div>
                <div>
                    <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
                        <span>😞 Shame</span>
                        <span>${prices.shame}</span>
                    </div>
                    <div style="width:100%;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;">
                        <div style="width:${Math.min(100, prices.shame * 20)}%;height:100%;background:var(--red);"></div>
                    </div>
                    <div style="font-size:0.6rem;color:var(--text3);">Removed by confession</div>
                </div>
                <div>
                    <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
                        <span>🌀 Identity Strain</span>
                        <span>${prices.identityStrain}</span>
                    </div>
                    <div style="width:100%;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;">
                        <div style="width:${Math.min(100, prices.identityStrain * 20)}%;height:100%;background:${identityThreshold ? 'var(--red)' : 'var(--gold)'};"></div>
                    </div>
                    ${identityThreshold ? `<div style="font-size:0.6rem;color:var(--red);">⚠️ Threshold reached! Risk losing something.</div>` : `<div style="font-size:0.6rem;color:var(--text3);">Threshold at 4 – lose something</div>`}
                </div>
                <div style="display:flex;gap:0.3rem;align-items:center;justify-content:flex-end;">
                    <button class="btn btn-xs btn-ghost" onclick="window.witchClearPrices()">✕ Clear All</button>
                </div>
            </div>

            <!-- Weaver Display -->
            ${witchcraftData ? renderWeaver(witchcraftData, char) : renderNoWeaver(allPatrons)}

            <!-- Hedge Gifts -->
            <div class="witchcraft-gifts" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🌿 Hedge Gifts</span>
                    <button class="btn btn-xs btn-secondary" onclick="window.witchAddGift()">+ Add Gift</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.2rem;">
                    ${gifts.length === 0 ? `<div style="font-size:0.75rem;color:var(--text3);text-align:center;">No hedge gifts learned. Add one from your weaver or the universal list.</div>` : ''}
                    ${gifts.map(g => renderGiftItem(g, char)).join('')}
                </div>
            </div>

            <!-- Promise Timers -->
            <div class="witchcraft-timers" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">⏳ Promise Timers</span>
                    <button class="btn btn-xs btn-secondary" onclick="window.witchAddTimer()">+ Add Timer</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.2rem;">
                    ${timers.length === 0 ? `<div style="font-size:0.75rem;color:var(--text3);text-align:center;">No active promises.</div>` : ''}
                    ${timers.map(t => renderTimerItem(t, char)).join('')}
                </div>
            </div>

            <!-- Crafting -->
            <div class="witchcraft-crafting" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🔧 Crafted Items</span>
                    <button class="btn btn-xs btn-secondary" onclick="window.witchCraftItem()">+ Craft</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.2rem;">
                    ${crafted.length === 0 ? `<div style="font-size:0.75rem;color:var(--text3);text-align:center;">No crafted items.</div>` : ''}
                    ${crafted.map(c => renderCraftedItem(c, char)).join('')}
                </div>
            </div>

            <!-- Full Rituals -->
            <div class="witchcraft-rituals" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🕯️ Full Rituals</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${rituals.length} performed</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.2rem;max-height:120px;overflow-y:auto;">
                    ${rituals.length === 0 ? `<div style="font-size:0.75rem;color:var(--text3);text-align:center;">No rituals performed.</div>` : ''}
                    ${rituals.slice(-5).reverse().map(r => renderRitualItem(r, char)).join('')}
                </div>
            </div>

            <!-- Quick Reference -->
            <div class="witchcraft-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.2rem;font-size:0.65rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.4rem;">
                <div>🌑 <strong>Shadow:</strong> Spiritual residue; GM gains SB</div>
                <div>😞 <strong>Shame:</strong> Internal consequence; gain Condition</div>
                <div>🌀 <strong>Identity Strain:</strong> Loss of self; requires ritual</div>
                <div>⏳ <strong>Timer:</strong> When full, price comes due</div>
                <div>🔧 <strong>Crafting:</strong> Use recipes to create items</div>
                <div>🕯️ <strong>Ritual:</strong> 5 steps: Threshold → Witness → Will → Price → Exchange</div>
            </div>
        </div>
    `;
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
        <div class="witchcraft-weaver" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid ${color};">
            <div style="display:flex;align-items:center;gap:0.3rem;">
                <span style="font-size:1.2rem;">${icon}</span>
                <span style="font-weight:600;font-size:0.95rem;">${name}</span>
                <span style="font-size:0.7rem;color:var(--text3);">${description}</span>
                ${witchcraftData.religion ? `<span style="font-size:0.6rem;color:var(--text3);">⛪ ${witchcraftData.religion}</span>` : ''}
            </div>
            ${wc.lore ? `<div style="font-size:0.8rem;color:var(--text2);margin:0.2rem 0;">${wc.lore}</div>` : ''}
            <div style="font-size:0.8rem;color:var(--text2);margin:0.2rem 0;">
                <strong>Signature Rite:</strong> ${signatureRite}
            </div>
            ${hedgeGifts.length > 0 ? `
                <div style="display:flex;gap:0.3rem;font-size:0.7rem;color:var(--text3);flex-wrap:wrap;">
                    ${hedgeGifts.map(g => `<span>🌿 ${g.name}</span>`).join(' · ')}
                </div>
            ` : ''}
            ${wc.quote ? `<blockquote style="margin:0.2rem 0;padding:0.2rem 0.5rem;font-size:0.75rem;color:var(--text3);border-left:2px solid ${color};">"${wc.quote}"</blockquote>` : ''}
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
            <div style="font-size:0.75rem;text-align:left;max-height:100px;overflow-y:auto;padding:0.2rem;background:var(--bg3);border-radius:var(--radius);margin:0.2rem 0;">
                ${list || 'No patrons with witchcraft found. Check your patron JSON files.'}
            </div>
            <button class="btn btn-sm btn-primary" onclick="window.witchChooseWeaver()">Choose Weaver</button>
        </div>
    `;
}

function renderGiftItem(gift, char) {
    return `
        <div class="gift-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.8rem;">
            <div>
                <span style="font-weight:600;">${escHtml(gift.name)}</span>
                <span style="font-size:0.65rem;color:var(--text3);">${gift.effect}</span>
                ${gift.limit ? `<span style="font-size:0.6rem;color:var(--text2);">(${gift.limit})</span>` : ''}
            </div>
            <button class="btn btn-xs btn-ghost" onclick="window.witchRemoveGift('${gift.id || gift.name}')" style="color:var(--red);">✕</button>
        </div>
    `;
}

function renderTimerItem(timer, char) {
    const pct = Math.min(100, (timer.current || 0) / (timer.segments || 4) * 100);
    return `
        <div class="timer-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.8rem;">
            <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;">
                    <span style="font-weight:600;">${escHtml(timer.name)}</span>
                    <span style="font-size:0.65rem;color:var(--text3);">${timer.current || 0}/${timer.segments || 4}</span>
                </div>
                <div style="width:100%;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${pct > 80 ? 'var(--red)' : 'var(--gold)'};"></div>
                </div>
                ${timer.description ? `<div style="font-size:0.65rem;color:var(--text2);">${escHtml(timer.description)}</div>` : ''}
            </div>
            <div style="display:flex;gap:0.2rem;">
                <button class="btn btn-xs btn-secondary" onclick="window.witchTickTimer('${timer.id}')">+</button>
                <button class="btn btn-xs btn-ghost" onclick="window.witchRemoveTimer('${timer.id}')" style="color:var(--red);">✕</button>
            </div>
        </div>
    `;
}

function renderCraftedItem(item, char) {
    return `
        <div class="crafted-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.8rem;">
            <div>
                <span style="font-weight:600;">${escHtml(item.name)}</span>
                <span style="font-size:0.65rem;color:var(--text3);">${item.effect}</span>
                ${item.uses ? `<span style="font-size:0.6rem;color:var(--text2);">(${item.uses} uses)</span>` : ''}
            </div>
            <button class="btn btn-xs btn-ghost" onclick="window.witchUseCraftedItem('${item.id}')" style="color:var(--gold);">Use</button>
            <button class="btn btn-xs btn-ghost" onclick="window.witchRemoveCraftedItem('${item.id}')" style="color:var(--red);">✕</button>
        </div>
    `;
}

function renderRitualItem(ritual, char) {
    return `
        <div class="ritual-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
            <div>
                <span style="font-weight:600;">${escHtml(ritual.name)}</span>
                <span style="font-size:0.6rem;color:var(--text3);">${ritual.result || 'Pending'}</span>
                ${ritual.effect ? `<span style="font-size:0.6rem;color:var(--text2);">— ${escHtml(ritual.effect)}</span>` : ''}
            </div>
            <span style="font-size:0.55rem;color:var(--text3);">${ritual.date || ''}</span>
        </div>
    `;
}

// ============================================================
// QUICK WORKING
// ============================================================

window.witchQuickWork = function() {
    const char = getCharacterData();
    if (!char) return;

    // Step 1: Name the Threshold
    const threshold = prompt('Name the threshold (door, tide line, wound, vow, breath):', 'door');
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
        outcome = 'Clean Success';
        priceType = 'none';
    } else if (result.successes >= dv && result.ones > 0) {
        outcome = 'Success with SB';
        priceType = 'shadow';
        sbCount = result.ones;
    } else if (result.successes > 0 && result.successes < dv) {
        outcome = 'Partial Success';
        priceType = 'shame';
        sbCount = result.ones;
        boons = 1;
    } else {
        outcome = 'Miss';
        priceType = 'identity';
        sbCount = result.ones || 1;
        boons = 2;
    }

    // Apply price
    const prices = getPriceTracks(char);
    let priceApplied = false;
    if (priceType === 'shadow') {
        prices.shadow += 1;
        priceApplied = true;
        showToast('🌑 Marked 1 Shadow (GM gains SB)', 'info');
    } else if (priceType === 'shame') {
        prices.shame += 1;
        priceApplied = true;
        showToast('😞 Marked 1 Shame (gain a Condition)', 'warning');
    } else if (priceType === 'identity') {
        prices.identityStrain += 1;
        priceApplied = true;
        showToast('🌀 Marked 1 Identity Strain (risk losing self)', 'error');
        if (prices.identityStrain >= 4) {
            showToast('⚠️ Identity Strain threshold reached! You risk losing something of yourself.', 'error');
        }
    }

    if (priceApplied) {
        saveCharacter({ witch: { prices } });
    }

    // Build result message
    const outcomeColor = outcome === 'Clean Success' ? 'var(--green)' :
                         outcome === 'Success with SB' ? 'var(--gold)' :
                         outcome === 'Partial Success' ? 'var(--orange)' : 'var(--red)';

    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.4rem;max-width:400px;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">⚡ Quick Working</div>
            <div style="font-size:0.85rem;color:var(--text2);">Threshold: <strong>${escHtml(threshold)}</strong> · Layer: <strong>${escHtml(layer)}</strong> · Tag: <strong>${escHtml(tag)}</strong></div>
            <div style="font-size:0.8rem;color:var(--text3);">Position: ${isDesperate ? 'Desperate' : 'Controlled'} · Pool: ${pool}d (Wits ${wits} + Lore ${lore}) · DV: ${dv}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${result.successes}</strong> successes, ${result.ones} ones</div>
            <div style="font-size:1rem;font-weight:600;color:${outcomeColor};">${outcome}</div>
            ${priceApplied ? `<div style="color:var(--red);font-size:0.85rem;">Price: ${priceType} (${prices[priceType]})</div>` : '<div style="color:var(--green);">No price.</div>'}
            ${sbCount > 0 ? `<div style="color:var(--text3);font-size:0.8rem;">GM gains ${sbCount} SB</div>` : ''}
            ${boons > 0 ? `<div style="color:var(--gold);font-size:0.8rem;">+${boons} Boons</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `;

    showToastWithHTML(msg, outcome === 'Clean Success' ? 'success' : 'info');
    window.witchRefresh();
};

// ============================================================
// FULL RITUAL
// ============================================================

window.witchFullRitual = function() {
    const char = getCharacterData();
    if (!char) return;

    // Step 1: Identify the Threshold
    const threshold = prompt('Step 1: Identify the Threshold (door, crossroads, grave, hearth):', 'Crossroads');
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

    let outcome, priceApplied = false, boons = 0, sbCount = 0;
    if (result.successes >= dv && result.ones === 0) {
        outcome = 'Success';
        priceApplied = true;
        showToast('✅ Ritual successful!', 'success');
    } else if (result.successes >= dv && result.ones > 0) {
        outcome = 'Success with Echo';
        priceApplied = true;
        sbCount = result.ones;
        showToast('⚠️ Ritual successful, but an echo remains.', 'warning');
    } else if (result.successes > 0 && result.successes < dv) {
        outcome = 'Partial Success';
        priceApplied = true;
        boons = 1;
        showToast('⚠️ Ritual partial. The effect is weakened.', 'warning');
    } else {
        outcome = 'Failure';
        sbCount = result.ones || 1;
        boons = 2;
        showToast('❌ Ritual failed. The threshold rejects you.', 'error');
    }

    // Apply price
    if (priceApplied) {
        const prices = getPriceTracks(char);
        prices.identityStrain += 1;
        saveCharacter({ witch: { prices } });
        if (prices.identityStrain >= 4) {
            showToast('⚠️ Identity Strain threshold reached! You risk losing something of yourself.', 'error');
        }
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
        result: outcome,
        date: new Date().toLocaleDateString()
    });
    saveCharacter({ witch: { rituals } });

    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.4rem;max-width:400px;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">🕯️ Full Ritual</div>
            <div style="font-size:0.85rem;color:var(--text2);">
                <div><strong>Threshold:</strong> ${escHtml(threshold)}</div>
                <div><strong>Witness:</strong> ${escHtml(witness)}</div>
                <div><strong>Will:</strong> ${escHtml(will)}</div>
                <div><strong>Price:</strong> ${escHtml(price)}</div>
            </div>
            <div style="font-size:0.8rem;color:var(--text3);">Pool: ${pool}d (Spirit ${spirit} + Lore ${lore}) · DV: ${dv}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${result.successes}</strong> successes</div>
            <div style="font-size:1rem;font-weight:600;color:${outcome === 'Success' ? 'var(--green)' : outcome === 'Success with Echo' ? 'var(--gold)' : 'var(--orange)'};">${outcome}</div>
            ${priceApplied ? `<div style="color:var(--red);font-size:0.85rem;">Identity Strain +1</div>` : ''}
            ${sbCount > 0 ? `<div style="color:var(--text3);font-size:0.8rem;">GM gains ${sbCount} SB</div>` : ''}
            ${boons > 0 ? `<div style="color:var(--gold);font-size:0.8rem;">+${boons} Boons</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `;

    showToastWithHTML(msg, 'info');
    window.witchRefresh();
};

// ============================================================
// CRAFTING
// ============================================================

window.witchCraftItem = function() {
    const char = getCharacterData();
    if (!char) return;

    // Show available recipes
    const recipeList = Object.values(CRAFTING_RECIPES);
    const recipeOptions = recipeList.map((r, i) =>
        `${i+1}. ${r.name} – ${r.effect} (DV ${r.dv}, ${r.xpCost} XP, ${r.tier})`
    ).join('\n');

    const choice = prompt(`Available recipes:\n\n${recipeOptions}\n\nEnter the number of the recipe:`, '1');
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
        outcome = 'Success';
        success = true;
        showToast(`✅ Crafted "${recipe.name}" successfully!`, 'success');
    } else if (result.successes > 0 && result.successes < dv) {
        outcome = 'Partial';
        boons = 1;
        showToast(`⚠️ Partial success. The item is imperfect.`, 'warning');
    } else {
        outcome = 'Failure';
        sbCount = result.ones || 1;
        boons = 2;
        showToast(`❌ Crafting failed. Materials consumed.`, 'error');
    }

    // Deduct XP if successful (or partial)
    if (success || outcome === 'Partial') {
        const xpCost = recipe.xpCost;
        const totalXp = char.totalXp || 0;
        const spent = char.xpSpent || 0;
        const available = totalXp - spent;
        if (available < xpCost) {
            showToast(`Not enough XP. Need ${xpCost}, have ${available} available.`, 'error');
            return;
        }
        char.xpSpent = spent + xpCost;
        saveCharacter({ xpSpent: char.xpSpent });
    }

    // Add to crafted items if successful
    if (success || outcome === 'Partial') {
        const crafted = getCraftedItems(char);
        const quality = outcome === 'Success' ? 'standard' : 'flawed';
        crafted.push({
            id: generateId('crafted_'),
            name: recipe.name,
            effect: recipe.effect,
            quality: quality,
            uses: recipe.tier === 'standard' ? 2 : 1,
            recipe: recipe.id,
            createdAt: Date.now()
        });
        saveCharacter({ witch: { crafted } });
    }

    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.4rem;max-width:400px;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">🔧 Crafting: ${escHtml(recipe.name)}</div>
            <div style="font-size:0.85rem;color:var(--text2);">${escHtml(recipe.description)}</div>
            <div style="font-size:0.8rem;color:var(--text3);">Skill: ${recipe.skill} · Pool: ${pool}d (${attr} ${attrValue} + ${recipe.skill} ${skillLevel}) · DV: ${dv}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${result.successes}</strong> successes</div>
            <div style="font-size:1rem;font-weight:600;color:${success ? 'var(--green)' : outcome === 'Partial' ? 'var(--orange)' : 'var(--red)'};">${outcome}</div>
            ${success || outcome === 'Partial' ? `<div style="color:var(--text3);font-size:0.8rem;">Cost: ${recipe.xpCost} XP</div>` : ''}
            ${boons > 0 ? `<div style="color:var(--gold);font-size:0.8rem;">+${boons} Boons</div>` : ''}
            ${sbCount > 0 ? `<div style="color:var(--text3);font-size:0.8rem;">GM gains ${sbCount} SB</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
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

    // Apply effect (narrative - GM will adjudicate)
    showToast(`🧪 Used "${item.name}": ${item.effect}`, 'success');

    // Reduce uses
    item.uses = (item.uses || 1) - 1;
    if (item.uses <= 0) {
        window.witchRemoveCraftedItem(itemId);
    } else {
        saveCharacter({ witch: { crafted } });
        window.witchRefresh();
    }
};

window.witchRemoveCraftedItem = function(itemId) {
    const char = getCharacterData();
    if (!char) return;
    let crafted = getCraftedItems(char);
    crafted = crafted.filter(c => c.id !== itemId);
    saveCharacter({ witch: { crafted } });
    showToast('Item removed.', 'info');
    window.witchRefresh();
};

// ============================================================
// HEDGE GIFTS
// ============================================================

window.witchAddGift = function() {
    const char = getCharacterData();
    if (!char) return;

    const patronData = char.patron ? findPatronWitchcraft(char.patron) : null;
    const patronGifts = patronData?.witchcraft?.hedge_gifts || [];
    const available = [...UNIVERSAL_HEDGE_GIFTS, ...patronGifts];
    const list = available.map((g, i) => `${i+1}. ${g.name} – ${g.effect} (${g.limit || 'No limit'})`).join('\n');

    const choice = prompt(`Available hedge gifts:\n\n${list}\n\nEnter the number of the gift to learn:`, '1');
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= available.length) {
        showToast('Invalid selection.', 'error');
        return;
    }

    const selected = available[idx];
    const gifts = getHedgeGifts(char);
    if (gifts.some(g => g.name === selected.name)) {
        showToast('Already learned this gift.', 'warning');
        return;
    }

    gifts.push({ ...selected, id: generateId('gift_') });
    saveCharacter({ witch: { hedgeGifts: gifts } });
    showToast(`🌿 Learned "${selected.name}"`, 'success');
    window.witchRefresh();
};

window.witchRemoveGift = function(giftId) {
    const char = getCharacterData();
    if (!char) return;
    let gifts = getHedgeGifts(char);
    gifts = gifts.filter(g => g.id !== giftId && g.name !== giftId);
    saveCharacter({ witch: { hedgeGifts: gifts } });
    showToast('Removed gift.', 'info');
    window.witchRefresh();
};

// ============================================================
// PROMISE TIMERS
// ============================================================

window.witchAddTimer = function() {
    const char = getCharacterData();
    if (!char) return;

    const name = prompt('Promise name:', 'Debt to the Web');
    if (!name) return;
    const segments = safeParseInt(prompt('Segments (default 4):', '4'), 4);
    const description = prompt('Description (when due):', 'Price comes due') || '';

    const timers = getPromiseTimers(char);
    timers.push({
        id: generateId('timer_'),
        name,
        segments,
        current: 0,
        description,
        createdAt: Date.now()
    });
    saveCharacter({ witch: { promiseTimers: timers } });
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
    saveCharacter({ witch: { promiseTimers: timers } });
    window.witchRefresh();
};

window.witchRemoveTimer = function(timerId) {
    const char = getCharacterData();
    if (!char) return;
    let timers = getPromiseTimers(char);
    timers = timers.filter(t => t.id !== timerId);
    saveCharacter({ witch: { promiseTimers: timers } });
    showToast('Timer removed.', 'info');
    window.witchRefresh();
};

// ============================================================
// PRICE MANAGEMENT
// ============================================================

window.witchClearPrices = function() {
    const char = getCharacterData();
    if (!char) return;
    if (!confirm('Clear all price tracks (Shadow, Shame, Identity Strain)?')) return;
    const prices = getPriceTracks(char);
    prices.shadow = 0;
    prices.shame = 0;
    prices.identityStrain = 0;
    saveCharacter({ witch: { prices } });
    showToast('Prices cleared.', 'info');
    window.witchRefresh();
};

// ============================================================
// WEAVER SELECTION
// ============================================================

window.witchChooseWeaver = function() {
    const char = getCharacterData();
    if (!char) return;

    const allPatrons = getAllWitchcraftPatrons();
    if (allPatrons.length === 0) {
        showToast('No patrons with witchcraft found. Check your patron JSON files.', 'error');
        return;
    }

    const list = allPatrons.map((p, i) =>
        `${i+1}. ${p.patronIcon} ${p.patronName} – ${p.witchcraft.name || 'Witchcraft'}`
    ).join('\n');

    const choice = prompt(`Choose a weaver:\n\n${list}\n\nEnter the number:`, '1');
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= allPatrons.length) {
        showToast('Invalid selection.', 'error');
        return;
    }

    const selected = allPatrons[idx];
    char.patron = selected.patronId;
    saveCharacter({ patron: selected.patronId });
    showToast(`🧙 Chosen weaver: ${selected.patronName} (${selected.witchcraft.name || 'Witchcraft'})`, 'success');
    window.witchRefresh();
};

// ============================================================
// REFRESH
// ============================================================

window.witchRefresh = function() {
    const el = document.getElementById('witchcraft-container')?.parentElement;
    if (el) renderWitchcraft(el);
    else {
        const container = document.querySelector('.witchcraft-container');
        if (container) renderWitchcraft(container);
    }
    showToast('🔄 Witchcraft refreshed.', 'info');
};

// ============================================================
// TOAST WITH HTML
// ============================================================

function showToastWithHTML(html, type = 'info') {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 9999;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = `
        background: var(--bg1); padding: 1.5rem; border-radius: var(--radius);
        max-width: 450px; width: 90%; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 80vh; overflow-y: auto;
    `;
    inner.innerHTML = html + `<br><button class="btn btn-sm btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>`;
    modal.appendChild(inner);
    document.body.appendChild(modal);
    setTimeout(() => { if (modal.parentNode) modal.remove(); }, 8000);
}

// ============================================================
// EXPORT
// ============================================================

export default { renderWitchcraft };