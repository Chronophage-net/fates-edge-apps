/**
 * Witchcraft – The Hedge and the Threshold
 * 
 * Data-driven: weaver data is loaded from patron JSON files via the patrons feature.
 * Each patron can have a "witchcraft" property that defines hedge gifts, signature rites, etc.
 *
 * "The hedge is what keeps the wolves from the flock. I am the one who tends the hedge."
 * – The Gray Wanderer
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
    { id: 'knot-of-favor', name: 'Knot of Favor', effect: 'Tie a knot; you and allies gain +1 die to one type of roll for the scene.', limit: 'Once per scene' }
];

// ============================================================
// WITCHCRAFT LOOKUP
// ============================================================

/**
 * Get a patron's witchcraft data from their JSON.
 * Checks the patron's "witchcraft" property.
 */
function getWitchcraftFromPatron(patronData) {
    if (!patronData) return null;
    return patronData.witchcraft || null;
}

/**
 * Look up a patron's witchcraft data by patron ID.
 * Searches cosmic patrons, then terrestrial patrons, then religions.
 */
function findPatronWitchcraft(patronId) {
    const state = getState();
    
    // Check cosmic patrons
    if (state.patrons?.cosmic) {
        const patron = state.patrons.cosmic.find(p => p.id === patronId);
        if (patron && patron.witchcraft) {
            return { patron, witchcraft: patron.witchcraft };
        }
    }
    
    // Check terrestrial patrons
    if (state.patrons?.terrestrial) {
        const patron = state.patrons.terrestrial.find(p => p.id === patronId);
        if (patron && patron.witchcraft) {
            return { patron, witchcraft: patron.witchcraft };
        }
    }
    
    // Check religions (their orders)
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

/**
 * Get all available witchcraft traditions from all loaded patrons.
 * Returns an array of { patronId, patronName, patronIcon, witchcraft, source }
 */
function getAllWitchcraftPatrons() {
    const state = getState();
    const results = [];
    
    // Check cosmic patrons
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
    
    // Check terrestrial patrons
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
    
    // Check religions (their orders)
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
    for (let i = 0; i < pool; i++) {
        const roll = Math.floor(Math.random() * 10) + 1;
        if (roll >= 6) successes++;
        if (roll === 10) successes++;
    }
    return successes;
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
    const allPatrons = getAllWitchcraftPatrons();

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
                    <button class="btn btn-sm btn-ghost" onclick="window.witchRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- Price Tracks -->
            <div class="witchcraft-prices" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.3rem;background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
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
                        <div style="width:${Math.min(100, prices.identityStrain * 20)}%;height:100%;background:var(--gold);"></div>
                    </div>
                    <div style="font-size:0.6rem;color:var(--text3);">Threshold at 4 – lose something</div>
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

            <!-- Quick Reference -->
            <div class="witchcraft-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.2rem;font-size:0.65rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.4rem;">
                <div>🌑 <strong>Shadow:</strong> Spiritual residue; GM gains SB</div>
                <div>😞 <strong>Shame:</strong> Internal consequence; gain Condition</div>
                <div>🌀 <strong>Identity Strain:</strong> Loss of self; requires ritual</div>
                <div>⏳ <strong>Timer:</strong> When full, price comes due</div>
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

// ============================================================
// QUICK WORKING
// ============================================================

window.witchQuickWork = function() {
    const char = getCharacterData();
    if (!char) return;

    const threshold = prompt('Name the threshold (door, tide line, wound, vow, breath):', 'door');
    if (!threshold) return;

    const layer = prompt('Choose a layer: Echo (past), Veil (present), Flow (future direction)', 'Veil');
    if (!['Echo', 'Veil', 'Flow'].includes(layer)) {
        showToast('Invalid layer. Choose Echo, Veil, or Flow.', 'error');
        return;
    }

    const tag = prompt('Choose a single Tag (e.g., BIND, LIGHT, SILENCE, BURNING, etc.)', 'BIND');
    if (!tag) return;

    const pos = prompt('Position: Controlled (you have time) or Desperate (threatened)', 'Controlled');
    const isDesperate = pos.toLowerCase() === 'desperate';

    const wits = char.wits || 1;
    const lore = char.skills?.lore || 0;
    const pool = wits + lore;
    const dv = 3;
    const successes = rollDice(pool);

    let outcome, priceType, sbCount = 0;
    if (successes >= dv && rollDice(1) !== 1) {
        outcome = 'Clean Success';
        priceType = 'none';
    } else if (successes >= dv) {
        outcome = 'Success with SB';
        priceType = 'shadow';
        sbCount = 1;
    } else if (successes > 0 && successes < dv) {
        outcome = 'Partial Success';
        priceType = 'shame';
        sbCount = 1;
    } else {
        outcome = 'Miss';
        priceType = 'identity';
        sbCount = 2;
    }

    const prices = getPriceTracks(char);
    if (priceType === 'shadow') {
        prices.shadow += 1;
        showToast('🌑 Marked 1 Shadow (GM gains SB)', 'info');
    } else if (priceType === 'shame') {
        prices.shame += 1;
        showToast('😞 Marked 1 Shame (gain a Condition)', 'warning');
    } else if (priceType === 'identity') {
        prices.identityStrain += 1;
        showToast('🌀 Marked 1 Identity Strain (risk losing self)', 'error');
    }

    saveCharacter({ witch: { prices } });

    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div><strong>Quick Working</strong></div>
            <div>Threshold: ${escHtml(threshold)} · Layer: ${escHtml(layer)} · Tag: ${escHtml(tag)}</div>
            <div>Position: ${isDesperate ? 'Desperate' : 'Controlled'} · Pool: ${pool}d (Wits ${wits} + Lore ${lore})</div>
            <div>Rolled: ${successes} successes, DV ${dv}</div>
            <div><strong>Outcome:</strong> ${outcome}</div>
            ${priceType !== 'none' ? `<div style="color:var(--red);">Price: ${priceType} (${prices[priceType]})</div>` : '<div style="color:var(--green);">No price.</div>'}
            ${sbCount > 0 ? `<div style="color:var(--text3);">GM gains ${sbCount} SB</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `;

    showToastWithHTML(msg, outcome === 'Clean Success' ? 'success' : 'info');
};

// ============================================================
// FULL RITUAL
// ============================================================

window.witchFullRitual = function() {
    const char = getCharacterData();
    if (!char) return;

    const name = prompt('Ritual name:', 'Unravel the Wound');
    if (!name) return;
    const effect = prompt('Desired effect:', 'Restore 1 level of Harm');
    if (!effect) return;
    const dv = safeParseInt(prompt('Difficulty (DV 3-6):', '4'), 4);
    const price = prompt('Price (memory, name, lock of hair, promise, blood):', 'Memory of a childhood injury');

    const spirit = char.spirit || 1;
    const lore = char.skills?.lore || 0;
    const pool = spirit + lore;
    const successes = rollDice(pool);

    let result, priceApplied = false;
    if (successes >= dv) {
        result = 'Success';
        priceApplied = true;
        showToast('✅ Ritual successful!', 'success');
    } else if (successes > 0 && successes < dv) {
        result = 'Partial Success';
        priceApplied = true;
        showToast('⚠️ Ritual partial. Price is still due.', 'warning');
    } else {
        result = 'Miss';
        showToast('❌ Ritual failed. No effect.', 'error');
    }

    if (priceApplied) {
        const prices = getPriceTracks(char);
        prices.identityStrain += 1;
        saveCharacter({ witch: { prices } });
        showToast('🌀 Marked 1 Identity Strain', 'warning');
    }

    const rituals = getFullRituals(char);
    rituals.push({
        id: generateId('ritual_'),
        name,
        effect,
        dv,
        price,
        result,
        date: new Date().toLocaleDateString()
    });
    saveCharacter({ witch: { rituals } });

    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div><strong>${escHtml(name)}</strong> (DV ${dv})</div>
            <div>Effect: ${escHtml(effect)}</div>
            <div>Price: ${escHtml(price)}</div>
            <div>Pool: ${pool}d (Spirit ${spirit} + Lore ${lore})</div>
            <div>Rolled: ${successes} successes</div>
            <div><strong>Result:</strong> ${result}</div>
            ${priceApplied ? `<div style="color:var(--red);">Identity Strain +1</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `;

    showToastWithHTML(msg, 'info');
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
    const list = available.map((g, i) => `${i+1}. ${g.name} – ${g.effect}`).join('\n');

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
        max-width: 400px; width: 90%; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
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