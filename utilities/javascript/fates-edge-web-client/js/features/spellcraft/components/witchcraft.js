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
 * - Universal Hedge Gifts (from hardcoded list + patron gifts)
 * - Weaver selection from patron data
 * - Price tracks: Shadow, Shame, Identity Strain
 * - Promise Timers
 * - Full Ritual system
 * - Quick Workings
 * - Magic path detection
 *
 * ────────────────────────────────────────────────────────────────────────
 * CRAFTING HAS MOVED (this pass): the ingredient/recipe "Crafting Bench"
 * that used to live at the bottom of this panel — forage, purchase,
 * combine, craft from recipe, crafted-item inventory, plus the new Codex
 * of magic items/artifacts and attunement/upkeep tracking — is now its
 * own top-level feature at js/features/crafting/index.js, reachable from
 * the sidebar independent of any magic path. It never had anything to do
 * with hedge magic specifically; it was only ever here because this was
 * the first panel open to every character. char.crafting is its state
 * namespace now, entirely separate from char.witch. Nothing in this file
 * reads or writes ingredients/recipes/crafted items anymore.
 * ────────────────────────────────────────────────────────────────────────
 *
 * ────────────────────────────────────────────────────────────────────────
 * BUGFIX NOTE (read this before touching saveCharacter calls below):
 * getWitchState(char) does `if (!char.witch) char.witch = {}` and returns a
 * live reference into the character object, and getPriceTracks/
 * getHedgeGifts/getPromiseTimers/getFullRituals all read and mutate
 * through that same reference. That means char.witch already holds the
 * up-to-date {prices, hedgeGifts, promiseTimers, rituals} object at the
 * moment we call saveCharacter.
 *
 * Calling saveCharacter with only ONE of those sub-keys at a time, e.g.
 * saveCharacter({ witch: { prices } }), would REPLACE char.witch entirely
 * with just { prices } under a normal shallow merge (as elsewhere in this
 * codebase, e.g. cantor.js's saveCharacter({ fatigue, corruption })),
 * silently deleting hedgeGifts/promiseTimers/rituals every time. In
 * practice: add a Hedge Gift, then tick a Promise Timer, and the gift you
 * just added would vanish.
 *
 * Fix: always pass the whole, already-mutated char.witch object, so
 * nothing sibling gets clobbered regardless of merge depth.
 * ────────────────────────────────────────────────────────────────────────
 *
 * ────────────────────────────────────────────────────────────────────────
 * CONSISTENCY PASS (patron loading + dice engine):
 * This file's witchcraft lookups (findPatronWitchcraft / getAllWitchcraft-
 * Patrons) read straight from `getState().patrons`, but this file never
 * actually loaded that data itself — it silently relied on some OTHER
 * panel (Patrons, Cantor, Rites) having been opened first to populate it.
 * This file now calls the same shared `patrons/index.js` loader everyone
 * else uses, at the top of `renderWitchcraft` and before
 * `witchChooseWeaver` runs, so it always has current data regardless of
 * what the player clicked first.
 *
 * Dice rolls use the shared `performRoll()` from `core/dice.js`, whose
 * `storyBeats` field is the Story Beat count — this file doesn't run its
 * own dice math.
 * ────────────────────────────────────────────────────────────────────────
 *
 * ────────────────────────────────────────────────────────────────────────
 * NO NATIVE prompt()/confirm() DIALOGS. Every native browser dialog that
 * used to live in this file (the ritual/quick-work/timer step-by-step
 * prompts, the weaver numbered list, the "clear prices?" confirm) is
 * in-panel UI instead: inline collapsible forms for Quick Work / Full
 * Ritual / new Promise Timers, clickable weaver cards, and a two-step
 * inline confirm for clearing price tracks. Result summaries (roll
 * outcomes) use the existing `showToastWithHTML` styled dialog — that's
 * this app's established non-blocking result-readout pattern (see
 * spellbook.js), not a native dialog, so it's kept for consistency.
 * ────────────────────────────────────────────────────────────────────────
 */

import { t as i18nText } from '@core/i18n.js';
import { getCharacterData, saveCharacter } from '@features/spellcraft/index.js';
import { escHtml, generateId, safeParseInt } from '@core/utils.js';
import { showToast } from '@components/Toast.js';
import { getState, saveState } from '@core/state.js';
import { performRoll } from '@core/dice.js';
import patrons from '@features/patrons/index.js';

const { loadPatronData: ensurePatronDataLoaded } = patrons;

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

// ─── Price Track Thresholds ───────────────────────────────────

const PRICE_THRESHOLDS = {
    shadow: { label: 'Shadow', icon: '🌑', max: 5, warningAt: 3, color: 'var(--purple)' },
    shame: { label: 'Shame', icon: '😞', max: 5, warningAt: 3, color: 'var(--red)' },
    identityStrain: { label: 'Identity Strain', icon: '🌀', max: 5, warningAt: 3, color: 'var(--gold)' }
};

// ============================================================
// CRAFTING UI STATE (transient — not persisted to the character)
// ============================================================
//
// This is a small, hand-rolled "component state" since the rest of the
// app re-renders panels by regenerating innerHTML rather than diffing a
// virtual DOM. All of it is reset whenever the active character changes
// so stale selections/expansions from a previous character can't leak in.

let lastCraftCharId = null;
let craftShowQuickWorkForm = false;
let craftShowRitualForm = false;
let craftShowTimerForm = false;
let craftShowWeaverPicker = false;
let craftConfirmClearPrices = false;

function resetCraftUIStateIfCharChanged(char) {
    if (lastCraftCharId !== char.id) {
        craftShowQuickWorkForm = false;
        craftShowRitualForm = false;
        craftShowTimerForm = false;
        craftShowWeaverPicker = false;
        craftConfirmClearPrices = false;
        lastCraftCharId = char.id;
    }
}

function getWitchcraftMountEl() {
    const existing = document.querySelector('.witchcraft-container');
    return existing ? existing.parentElement : document.getElementById('spellcraft-content');
}

/** Lightweight re-render from current state/UI-state — no data reload. */
async function refreshWitchcraftPanel() {
    const mount = getWitchcraftMountEl();
    if (mount) {
        await renderWitchcraft(mount);
    } else {
        import('@features/spellcraft/index.js').then(module => {
            if (module.renderActiveTabContent) module.renderActiveTabContent();
        });
    }
}

// ============================================================
// WITCHCRAFT LOOKUP
// ============================================================

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

function getTierFromXp(xp) {
    if (xp < 40) return 'I';
    if (xp < 90) return 'II';
    if (xp < 150) return 'III';
    if (xp < 220) return 'IV';
    return 'V';
}

// ─── Magic Paths Reference ─────────────────────────────────────
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
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.4rem;text-align: start;margin-top:0.8rem;">
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

// ============================================================
// MAIN RENDER – Path-aware
// ============================================================

export async function renderWitchcraft(el) {
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

    resetCraftUIStateIfCharChanged(char);

    // Ensure patron data is loaded
    await ensurePatronDataLoaded();

    const isWitch = char.magicPath === 'witch';
    const hasCraftOfTheHedge = (char.talents || []).some(t =>
        t.name === 'Craft of the Hedge' || t.id === 'craft-of-the-hedge'
    );
    const hasHedgeAccess = isWitch || hasCraftOfTheHedge
        || (char.hedgeGifts || []).length > 0
        || (char.witch?.hedgeGifts || []).length > 0;

    const patronId = char.patron;
    const witchcraftData = patronId ? findPatronWitchcraft(patronId) : null;
    const prices = getPriceTracks(char);
    const timers = getPromiseTimers(char);
    const gifts = getHedgeGifts(char);
    const rituals = getFullRituals(char);
    const allPatrons = getAllWitchcraftPatrons();

    // Build list of available gifts for dropdown (universal + patron)
    const patronGifts = witchcraftData?.witchcraft?.hedge_gifts || [];
    const availableGifts = [...UNIVERSAL_HEDGE_GIFTS, ...patronGifts];
    const seen = new Set();
    const uniqueGifts = availableGifts.filter(g => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
    });

    const identityThreshold = prices.identityStrain >= 3;

    el.innerHTML = `
        <div class="witchcraft-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="witchcraft-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;background:linear-gradient(135deg, var(--bg2) 0%, var(--bg1) 100%);border-radius:var(--radius) var(--radius) 0 0;padding:0.3rem 0.8rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🧹</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Hedge Magic</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-inline-start:0.3rem;">${isWitch ? 'Witch' : hasHedgeAccess ? 'Hedge-Gifted' : 'Any character'}</span>
                        ${witchcraftData ? `<span style="font-size:0.6rem;color:var(--text3);">· ${witchcraftData.patron.name}</span>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    ${hasHedgeAccess ? `<button class="btn btn-sm btn-primary" onclick="window.witchQuickWork()">${craftShowQuickWorkForm ? '✕ Cancel' : '⚡ Quick Work'}</button>` : ''}
                    <button class="btn btn-sm btn-ghost" onclick="window.witchRefresh()" title="Reloads patron data from disk, bypassing any cached copy" data-i18n-attr="title:feature.spellcraft.components.witchcraft.reloadsPatronDataFromDiskBypassingAny">🔄</button>
                </div>
            </div>

            ${!hasHedgeAccess ? `
                <div style="font-size:0.7rem;color:var(--text3);background:var(--bg2);border:1px dashed var(--border);border-radius:var(--radius);padding:0.4rem 0.6rem;">
                    🌿 Learn the <strong>Craft of the Hedge</strong> talent (or walk the Witch path) to unlock Hedge Gifts, Quick Workings, Full Rituals, and the price tracks.
                    Looking for the ingredient/recipe crafting bench? It moved to its own <strong>Crafting</strong> page in the sidebar — open to every character regardless of path.
                </div>
            ` : ''}

            ${craftShowQuickWorkForm ? renderQuickWorkForm() : ''}

            <!-- ─── Price Tracks (Witches only) ────────────────── -->
            ${isWitch ? renderPriceTracksSection(prices, identityThreshold) : ''}

            <!-- ─── Weaver Display (hedge-access only) ─────────── -->
            ${hasHedgeAccess ? (witchcraftData ? renderWeaver(witchcraftData, char) : renderNoWeaver(allPatrons)) : ''}

            <!-- ─── Hedge Gifts (hedge-access only) ─────────────── -->
            ${hasHedgeAccess ? renderHedgeGiftsSection(gifts, uniqueGifts) : ''}

            <!-- ─── Promise Timers (hedge-access only) ──────────── -->
            ${hasHedgeAccess ? renderPromiseTimersSection(timers) : ''}

            <!-- ─── Full Rituals (Witches only) ─────────────────── -->
            ${isWitch ? renderFullRitualsSection(rituals) : ''}

            <!-- ─── Quick Reference ─────────────────────────────── -->
            ${hasHedgeAccess ? `
                <div class="witchcraft-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.1rem;font-size:0.6rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.15rem 0.3rem;border:1px solid var(--border);">
                    <div>🌿 <strong>Gifts:</strong> No-roll, limited scope</div>
                    <div>⚡ <strong>Quick:</strong> Single action, roll required</div>
                    ${isWitch ? `<div>🕯️ <strong>Ritual:</strong> Extended, lasting effects</div>` : ''}
                    <div>⏳ <strong>Timer:</strong> When full, price comes due</div>
                </div>
            ` : ''}

            ${hasHedgeAccess ? `
                <!-- ─── The Gray Wanderer's Wisdom ──────────────────── -->
                <div class="witchcraft-wisdom" style="background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.5rem;border-inline-start:4px solid var(--gold);font-size:0.7rem;color:var(--text3);font-style:italic;">
                    "${witchcraftData?.witchcraft?.quote || 'The hedge is what keeps the wolves from the flock. I am the one who tends the hedge.'}"
                    <span style="display:block;text-align: end;font-size:0.6rem;color:var(--text2);">— The Gray Wanderer</span>
                </div>
            ` : ''}

        </div>
    `;
}

// ============================================================
// RENDER HELPERS — Hedge-magic-specific sections
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
        <div class="witchcraft-weaver" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-inline-start:4px solid ${color};border:1px solid var(--border);">
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
    return `
        <div class="witchcraft-no-weaver" style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
            <div style="font-size:1.5rem;">🧙</div>
            <p>No weaver selected. Choose a patron who offers witchcraft.</p>
            <button class="btn btn-sm btn-primary" onclick="window.witchChooseWeaver()">${craftShowWeaverPicker ? 'Hide Weavers' : 'Choose Weaver'}</button>
            ${craftShowWeaverPicker ? `
                <div style="display:flex;flex-direction:column;gap:0.2rem;margin-top:0.4rem;text-align: start;max-height:180px;overflow-y:auto;padding:0.2rem;">
                    ${allPatrons.length === 0 ? `
                        <div style="font-size:0.7rem;color:var(--text3);padding:0.3rem;">No patrons with witchcraft found. Check your patron JSON files.</div>
                    ` : allPatrons.map(p => `
                        <button class="btn btn-xs btn-secondary" style="text-align: start;justify-content:flex-start;display:flex;align-items:center;gap:0.3rem;" onclick="window.witchSelectWeaver('${escHtml(p.patronId)}')">
                            <span>${p.patronIcon}</span>
                            <span>${escHtml(p.patronName)}</span>
                            <span style="color:var(--text3);font-size:0.6rem;">— ${escHtml(p.witchcraft.name || 'Witchcraft')}${p.religion ? ` · ${escHtml(p.religion)}` : ''}</span>
                        </button>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function renderGiftItem(gift) {
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

function renderHedgeGiftsSection(gifts, uniqueGifts) {
    return `
        <div class="witchcraft-gifts" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🌿 Hedge Gifts</span>
                <div style="display:flex;gap:0.2rem;align-items:center;">
                    <span style="font-size:0.6rem;color:var(--text3);">${gifts.length} learned</span>
                    <select id="witch-gift-select" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.3rem;max-width:140px;">
                        ${uniqueGifts.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                    </select>
                    <button class="btn btn-xs btn-secondary" onclick="window.witchAddGiftFromSelect()" data-i18n="feature.spellcraft.components.witchcraft.add">+ Add</button>
                </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:200px;overflow-y:auto;">
                ${gifts.length === 0 ? `
                    <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                        No hedge gifts learned. Select a gift from the dropdown and click "Add".
                    </div>
                ` : gifts.map(g => renderGiftItem(g)).join('')}
            </div>
        </div>
    `;
}

function renderTimerItem(timer) {
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

function renderPromiseTimersSection(timers) {
    return `
        <div class="witchcraft-timers" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">⏳ Promise Timers</span>
                <div style="display:flex;gap:0.2rem;align-items:center;">
                    <span style="font-size:0.6rem;color:var(--text3);">${timers.length} active</span>
                    <button class="btn btn-xs btn-secondary" onclick="window.witchAddTimer()">${craftShowTimerForm ? '✕ Cancel' : '+ Add'}</button>
                </div>
            </div>
            ${craftShowTimerForm ? `
                <div class="craft-inline-form" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.4rem;display:flex;flex-direction:column;gap:0.25rem;margin-bottom:0.3rem;border:1px solid var(--border);">
                    <input id="timer-name" type="text" placeholder="Promise name (e.g. Debt to the Web)" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;" / data-i18n-attr="placeholder:feature.spellcraft.components.witchcraft.promiseNameEGDebtToThe">
                    <label style="font-size:0.65rem;color:var(--text3);">Segments
                        <input id="timer-segments" type="number" min="1" value="4" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;margin-top:0.1rem;" />
                    </label>
                    <input id="timer-description" type="text" placeholder="What happens when it's full?" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;" />
                    <div style="display:flex;gap:0.3rem;">
                        <button class="btn btn-xs btn-gold" onclick="window.witchSubmitTimer()" data-i18n="feature.spellcraft.components.witchcraft.create">⏳ Create</button>
                        <button class="btn btn-xs btn-ghost" onclick="window.witchAddTimer()" data-i18n="feature.spellcraft.components.witchcraft.cancel">Cancel</button>
                    </div>
                </div>
            ` : ''}
            <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:150px;overflow-y:auto;">
                ${timers.length === 0 ? `
                    <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                        No active promises. When you make a deal, track it here.
                    </div>
                ` : timers.map(t => renderTimerItem(t)).join('')}
            </div>
        </div>
    `;
}

function renderPriceTracksSection(prices, identityThreshold) {
    return `
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
                ${craftConfirmClearPrices ? `
                    <span style="font-size:0.6rem;color:var(--red);">Clear all?</span>
                    <button class="btn btn-xs btn-danger" onclick="window.witchClearPrices()" data-i18n="feature.spellcraft.components.witchcraft.yes">Yes</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.witchCancelClearPrices()" data-i18n="feature.spellcraft.components.witchcraft.no">No</button>
                ` : `
                    <button class="btn btn-xs btn-ghost" onclick="window.witchClearPrices()" data-i18n="feature.spellcraft.components.witchcraft.clear">✕ Clear</button>
                `}
            </div>
        </div>
    `;
}

function renderQuickWorkForm() {
    return `
        <div class="craft-inline-form" style="background:var(--bg2);border:1px solid var(--gold);border-radius:var(--radius);padding:0.4rem 0.5rem;display:flex;flex-direction:column;gap:0.3rem;">
            <div style="font-weight:600;font-size:0.8rem;color:var(--gold);">⚡ Quick Working</div>
            <label style="font-size:0.7rem;color:var(--text2);">Threshold
                <input id="qw-threshold" type="text" value="door" placeholder="door, tide line, wound, vow, breath..." style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;margin-top:0.1rem;" / data-i18n-attr="placeholder:feature.spellcraft.components.witchcraft.doorTideLineWoundVowBreath">
            </label>
            <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                <label style="font-size:0.7rem;color:var(--text2);flex:1;min-width:140px;">Layer
                    <select id="qw-layer" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;margin-top:0.1rem;">
                        <option value="Echo" data-i18n="feature.spellcraft.components.witchcraft.echoPastMemory">Echo — past memory</option>
                        <option value="Veil" selected data-i18n="feature.spellcraft.components.witchcraft.veilPresentBoundary">Veil — present boundary</option>
                        <option value="Flow" data-i18n="feature.spellcraft.components.witchcraft.flowFutureDirection">Flow — future direction</option>
                    </select>
                </label>
                <label style="font-size:0.7rem;color:var(--text2);flex:1;min-width:120px;">Tag
                    <input id="qw-tag" type="text" value="BIND" placeholder="BIND, LIGHT, SILENCE..." style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;margin-top:0.1rem;" / data-i18n-attr="placeholder:feature.spellcraft.components.witchcraft.bindLIGHTSILENCE">
                </label>
            </div>
            <label style="font-size:0.7rem;color:var(--text2);display:flex;align-items:center;gap:0.35rem;">
                <input type="checkbox" id="qw-desperate" /> Desperate position (threatened — DV 4 instead of 3)
            </label>
            <div style="display:flex;gap:0.3rem;">
                <button class="btn btn-sm btn-gold" onclick="window.witchSubmitQuickWork()" data-i18n="feature.spellcraft.components.witchcraft.workIt">⚡ Work It</button>
                <button class="btn btn-sm btn-ghost" onclick="window.witchQuickWork()" data-i18n="feature.spellcraft.components.witchcraft.cancel">Cancel</button>
            </div>
        </div>
    `;
}

function renderRitualForm() {
    return `
        <div class="craft-inline-form" style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.35rem 0.45rem;display:flex;flex-direction:column;gap:0.25rem;margin-bottom:0.25rem;">
            <input id="ritual-threshold" type="text" placeholder="Threshold (door, crossroads, grave, hearth...)" value="Crossroads" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;" / data-i18n-attr="placeholder:feature.spellcraft.components.witchcraft.thresholdDoorCrossroadsGraveHearth">
            <input id="ritual-witness" type="text" placeholder="Witness (person, spirit, Hollowed...)" value="The Pale Shepherd" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;" / data-i18n-attr="placeholder:feature.spellcraft.components.witchcraft.witnessPersonSpiritHollowed">
            <input id="ritual-will" type="text" placeholder="Will — what do you intend to change?" value="Heal the land" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;" / data-i18n-attr="placeholder:feature.spellcraft.components.witchcraft.willWhatDoYouIntendToChange">
            <input id="ritual-price" type="text" placeholder="Price (memory, name, lock of hair, promise, blood...)" value="Memory of a childhood home" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;" / data-i18n-attr="placeholder:feature.spellcraft.components.witchcraft.priceMemoryNameLockOfHairPromise">
            <label style="font-size:0.7rem;color:var(--text2);">Difficulty
                <select id="ritual-dv" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;margin-top:0.1rem;">
                    <option value="3" data-i18n="feature.spellcraft.components.witchcraft.dv3">DV 3</option>
                    <option value="4" selected data-i18n="feature.spellcraft.components.witchcraft.dv4">DV 4</option>
                    <option value="5" data-i18n="feature.spellcraft.components.witchcraft.dv5">DV 5</option>
                    <option value="6" data-i18n="feature.spellcraft.components.witchcraft.dv6">DV 6</option>
                </select>
            </label>
            <div style="display:flex;gap:0.3rem;">
                <button class="btn btn-sm btn-gold" onclick="window.witchSubmitRitual()" data-i18n="feature.spellcraft.components.witchcraft.performRitual">🕯️ Perform Ritual</button>
                <button class="btn btn-sm btn-ghost" onclick="window.witchFullRitual()" data-i18n="feature.spellcraft.components.witchcraft.cancel">Cancel</button>
            </div>
        </div>
    `;
}

function renderRitualItem(ritual) {
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

function renderFullRitualsSection(rituals) {
    return `
        <div class="witchcraft-rituals" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🕯️ Full Rituals</span>
                <div style="display:flex;gap:0.3rem;align-items:center;">
                    <span style="font-size:0.6rem;color:var(--text3);">${rituals.length} performed</span>
                    <button class="btn btn-xs btn-secondary" onclick="window.witchFullRitual()">${craftShowRitualForm ? '✕ Cancel' : '+ New Ritual'}</button>
                </div>
            </div>
            ${craftShowRitualForm ? renderRitualForm() : ''}
            <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:120px;overflow-y:auto;">
                ${rituals.length === 0 ? `
                    <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                        No rituals performed. Perform a ritual to shape the world.
                    </div>
                ` : rituals.slice(-5).reverse().map(r => renderRitualItem(r)).join('')}
            </div>
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

    const hasCraft = (char.talents || []).some(t =>
        t.name === 'Craft of the Hedge' || t.id === 'craft-of-the-hedge'
    );
    if (!hasCraft && char.magicPath !== 'witch') {
        showToast(i18nText("feature.spellcraft.components.witchcraft.learnTheCraftOfTheHedgeTalent", null, "Learn the \"Craft of the Hedge\" talent first."), 'error');
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
        showToast(i18nText("feature.spellcraft.components.witchcraft.giftNotFound", null, "Gift not found."), 'error');
        return;
    }

    const gifts = getHedgeGifts(char);
    if (gifts.some(g => g.name === selected.name)) {
        showToast(i18nText("feature.spellcraft.components.witchcraft.alreadyLearnedThisGift", null, "Already learned this gift."), 'warning');
        return;
    }

    gifts.push({ ...selected, id: generateId('gift_') });
    saveCharacter({ witch: char.witch });
    showToast(i18nText("feature.spellcraft.components.witchcraft.learnedValue", { value0: selected.name }, "🌿 Learned \"{{value0}}\""), 'success');
    refreshWitchcraftPanel();
};

window.witchRemoveGift = function(giftId) {
    const char = getCharacterData();
    if (!char) return;
    let gifts = getHedgeGifts(char);
    gifts = gifts.filter(g => g.id !== giftId && g.name !== giftId);
    char.witch.hedgeGifts = gifts;
    saveCharacter({ witch: char.witch });
    showToast(i18nText("feature.spellcraft.components.witchcraft.removedGift", null, "Removed gift."), 'info');
    refreshWitchcraftPanel();
};

// ─── Quick Work ───────────────────────────────────────────────

window.witchQuickWork = function() {
    craftShowQuickWorkForm = !craftShowQuickWorkForm;
    refreshWitchcraftPanel();
};

window.witchSubmitQuickWork = function() {
    const char = getCharacterData();
    if (!char) return;

    const threshold = (document.getElementById('qw-threshold')?.value || '').trim() || 'door';
    const layer = document.getElementById('qw-layer')?.value || 'Veil';
    const tag = (document.getElementById('qw-tag')?.value || '').trim() || 'BIND';
    const isDesperate = !!document.getElementById('qw-desperate')?.checked;

    const wits = char.wits || 1;
    const lore = char.skills?.lore || 0;
    const pool = wits + lore;
    const dv = isDesperate ? 4 : 3;
    const result = performRoll(pool, dv);

    let outcome, priceType, sbCount = 0, boons = 0;
    if (result.successes >= dv && result.storyBeats === 0) {
        outcome = '✨ Clean Success';
        priceType = 'none';
    } else if (result.successes >= dv && result.storyBeats > 0) {
        outcome = '⚠️ Success with SB';
        priceType = 'shadow';
        sbCount = result.storyBeats;
    } else if (result.successes > 0 && result.successes < dv) {
        outcome = '⚠️ Partial Success';
        priceType = 'shame';
        sbCount = result.storyBeats;
        boons = 1;
    } else {
        outcome = '💀 Miss';
        priceType = 'identity';
        sbCount = result.storyBeats || 1;
        boons = 2;
    }

    const isWitch = char.magicPath === 'witch';
    let priceApplied = false;
    if (isWitch && priceType !== 'none') {
        const prices = getPriceTracks(char);
        if (priceType === 'shadow') { prices.shadow += 1; priceApplied = true; }
        else if (priceType === 'shame') { prices.shame += 1; priceApplied = true; }
        else if (priceType === 'identity') { prices.identityStrain += 1; priceApplied = true; }
        if (priceApplied) {
            saveCharacter({ witch: char.witch });
            if (prices.identityStrain >= 3) {
                showToast(i18nText("feature.spellcraft.components.witchcraft.identityStrainThresholdReachedRiskLosingSomething", null, "🌀 Identity Strain threshold reached! Risk losing something of yourself."), 'error');
            }
        }
    }

    if (boons > 0) {
        char.boons = (char.boons || 0) + boons;
        if (char.boons > 5) char.boons = 5;
        saveCharacter({ boons: char.boons });
    }

    craftShowQuickWorkForm = false;

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
            <div style="font-size:0.7rem;color:var(--text3);">Roll: ${result.dice.join(', ')}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${result.successes}</strong> successes</div>
            <div style="font-size:1rem;font-weight:600;color:${outcomeColor};">${outcome}</div>
            ${priceApplied ? `<div style="color:var(--red);font-size:0.8rem;">Price: ${priceType} (+1)</div>` : '<div style="color:var(--green);">No price.</div>'}
            ${sbCount > 0 ? `<div style="color:var(--text3);font-size:0.75rem;">📖 GM gains ${sbCount} SB</div>` : ''}
            ${boons > 0 ? `<div style="color:var(--gold);font-size:0.75rem;">⭐ +${boons} Boon${boons > 1 ? 's' : ''}</div>` : ''}
        </div>
    `;

    showToastWithHTML(msg, outcome === '✨ Clean Success' ? 'success' : 'info');
    refreshWitchcraftPanel();
};

// ─── Full Ritual ──────────────────────────────────────────────

window.witchFullRitual = function() {
    const char = getCharacterData();
    if (!char) return;

    if (char.magicPath !== 'witch') {
        showToast(i18nText("feature.spellcraft.components.witchcraft.fullRitualsRequireTheWitchMagicPath", null, "Full rituals require the Witch magic path."), 'error');
        return;
    }

    craftShowRitualForm = !craftShowRitualForm;
    refreshWitchcraftPanel();
};

window.witchSubmitRitual = function() {
    const char = getCharacterData();
    if (!char) return;

    const threshold = (document.getElementById('ritual-threshold')?.value || '').trim() || 'Crossroads';
    const witness = (document.getElementById('ritual-witness')?.value || '').trim() || 'A silent witness';
    const will = (document.getElementById('ritual-will')?.value || '').trim() || 'An unspoken intent';
    const price = (document.getElementById('ritual-price')?.value || '').trim() || 'Something unnamed';
    const dv = safeParseInt(document.getElementById('ritual-dv')?.value, 4);

    const spirit = char.spirit || 1;
    const lore = char.skills?.lore || 0;
    const pool = spirit + lore;
    const result = performRoll(pool, dv);

    let outcome, success = false, boons = 0, sbCount = 0;
    if (result.successes >= dv && result.storyBeats === 0) {
        outcome = '✅ Success';
        success = true;
    } else if (result.successes >= dv && result.storyBeats > 0) {
        outcome = '⚠️ Success with Echo';
        success = true;
        sbCount = result.storyBeats;
    } else if (result.successes > 0 && result.successes < dv) {
        outcome = '⚠️ Partial Success';
        boons = 1;
    } else {
        outcome = '❌ Failure';
        sbCount = result.storyBeats || 1;
        boons = 2;
    }

    const prices = getPriceTracks(char);
    prices.identityStrain += 1;
    saveCharacter({ witch: char.witch });
    if (prices.identityStrain >= 3) {
        showToast(i18nText("feature.spellcraft.components.witchcraft.identityStrainThresholdReachedRiskLosingSomething", null, "🌀 Identity Strain threshold reached! Risk losing something of yourself."), 'error');
    }

    if (boons > 0) {
        char.boons = (char.boons || 0) + boons;
        if (char.boons > 5) char.boons = 5;
        saveCharacter({ boons: char.boons });
    }

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
    craftShowRitualForm = false;

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
            <div style="font-size:0.7rem;color:var(--text3);">Roll: ${result.dice.join(', ')}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${result.successes}</strong> successes</div>
            <div style="font-size:1rem;font-weight:600;color:${outcomeColor};">${outcome}</div>
            <div style="color:var(--red);font-size:0.8rem;">🌀 Identity Strain +1</div>
            ${sbCount > 0 ? `<div style="color:var(--text3);font-size:0.75rem;">📖 GM gains ${sbCount} SB</div>` : ''}
            ${boons > 0 ? `<div style="color:var(--gold);font-size:0.75rem;">⭐ +${boons} Boon${boons > 1 ? 's' : ''}</div>` : ''}
        </div>
    `;

    showToastWithHTML(msg, success ? 'success' : 'info');
    refreshWitchcraftPanel();
};

// ─── Promise Timers ────────────────────────────────────────────

window.witchAddTimer = function() {
    craftShowTimerForm = !craftShowTimerForm;
    refreshWitchcraftPanel();
};

window.witchSubmitTimer = function() {
    const char = getCharacterData();
    if (!char) return;

    const name = (document.getElementById('timer-name')?.value || '').trim();
    if (!name) {
        showToast(i18nText("feature.spellcraft.components.witchcraft.giveThePromiseAName", null, "Give the promise a name."), 'error');
        return;
    }
    const segments = Math.max(1, safeParseInt(document.getElementById('timer-segments')?.value, 4));
    const description = (document.getElementById('timer-description')?.value || '').trim();

    const timers = getPromiseTimers(char);
    timers.push({
        id: generateId('timer_'),
        name,
        segments,
        current: 0,
        description,
        createdAt: Date.now()
    });
    saveCharacter({ witch: char.witch });
    craftShowTimerForm = false;
    showToast(i18nText("feature.spellcraft.components.witchcraft.promiseValueCreated", { value0: name }, "⏳ Promise \"{{value0}}\" created."), 'success');
    refreshWitchcraftPanel();
};

window.witchTickTimer = function(timerId) {
    const char = getCharacterData();
    if (!char) return;
    const timers = getPromiseTimers(char);
    const timer = timers.find(t => t.id === timerId);
    if (!timer) return showToast(i18nText("feature.spellcraft.components.witchcraft.timerNotFound", null, "Timer not found."), 'error');

    timer.current = (timer.current || 0) + 1;
    if (timer.current >= timer.segments) {
        showToast(i18nText("feature.spellcraft.components.witchcraft.valueIsFullThePriceComesDue", { value0: timer.name }, "⏳ \"{{value0}}\" is full! The price comes due."), 'warning');
    }
    saveCharacter({ witch: char.witch });
    refreshWitchcraftPanel();
};

window.witchRemoveTimer = function(timerId) {
    const char = getCharacterData();
    if (!char) return;
    let timers = getPromiseTimers(char);
    timers = timers.filter(t => t.id !== timerId);
    char.witch.promiseTimers = timers;
    saveCharacter({ witch: char.witch });
    showToast(i18nText("feature.spellcraft.components.witchcraft.timerRemoved", null, "Timer removed."), 'info');
    refreshWitchcraftPanel();
};

// ─── Price Management ─────────────────────────────────────────

window.witchClearPrices = function() {
    if (!craftConfirmClearPrices) {
        craftConfirmClearPrices = true;
        refreshWitchcraftPanel();
        return;
    }
    const char = getCharacterData();
    if (!char) return;
    const prices = getPriceTracks(char);
    prices.shadow = 0;
    prices.shame = 0;
    prices.identityStrain = 0;
    saveCharacter({ witch: char.witch });
    craftConfirmClearPrices = false;
    showToast(i18nText("feature.spellcraft.components.witchcraft.pricesCleared", null, "Prices cleared."), 'info');
    refreshWitchcraftPanel();
};

window.witchCancelClearPrices = function() {
    craftConfirmClearPrices = false;
    refreshWitchcraftPanel();
};

// ─── Weaver Selection ─────────────────────────────────────────

window.witchChooseWeaver = function() {
    craftShowWeaverPicker = !craftShowWeaverPicker;
    refreshWitchcraftPanel();
};

window.witchSelectWeaver = function(patronId) {
    const char = getCharacterData();
    if (!char) return;

    char.patron = patronId;
    saveCharacter({ patron: patronId });
    craftShowWeaverPicker = false;

    const selected = getAllWitchcraftPatrons().find(p => p.patronId === patronId);
    showToast(i18nText("feature.spellcraft.components.witchcraft.chosenWeaverValue", { value0: selected ? selected.patronName : patronId }, "🧙 Chosen weaver: {{value0}}"), 'success');
    refreshWitchcraftPanel();
};

// ─── Refresh (forces a real data reload — patron data) ─────────

window.witchRefresh = async function() {
    showToast(i18nText("feature.spellcraft.components.witchcraft.reloadingPatronData", null, "🔄 Reloading patron data…"), 'info');
    await ensurePatronDataLoaded(true);
    await refreshWitchcraftPanel();
    showToast(i18nText("feature.spellcraft.components.witchcraft.hedgeMagicRefreshed", null, "✅ Hedge magic refreshed."), 'success');
};

// ============================================================
// TOAST WITH HTML (shared) — used only for non-blocking result
// summaries (roll outcomes), never for gathering input.
// ============================================================

function showToastWithHTML(html, type = 'info') {
    const existing = document.querySelector('.custom-toast-modal');
    if (existing) existing.remove();

    // A toast-style notice, anchored to a corner — not a full-screen pop-up
    // with a backdrop blocking the rest of the page.
    const modal = document.createElement('div');
    modal.className = 'custom-toast-modal';
    modal.style.cssText = `
        position: fixed; bottom: 1rem; inset-inline-end: 1rem; z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = `
        background: var(--bg1); padding: 1.2rem; border-radius: var(--radius);
        max-width: 420px; width: 90vw; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 60vh; overflow-y: auto;
    `;
    inner.innerHTML = html + `<br><button class="btn btn-xs btn-secondary" onclick="this.closest('.custom-toast-modal').remove()" data-i18n="feature.spellcraft.components.witchcraft.close">Close</button>`;
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
