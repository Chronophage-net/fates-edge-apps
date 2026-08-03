/**
 * Combat Tracker - Advanced initiative and timer tracking
 * Integrated with Factions, Rivals, Followers, Assets, Patrons, and Bestiary
 * ✅ Supports TL 1-10, Class I-X, sb_spends
 * ✅ Shared GM Story Beat bank with bestiary.js
 * ✅ Keyboard shortcuts: Space = next turn, R = reset timer
 * ✅ Cleaner UI with creature-specific SB moves
 * ✅ Import from Bestiary via searchable modal
 * ✅ Armor auto‑conversion (Essentials §2.4 & §A.7)
 * ✅ Weapon range rules: melee vs ranged vs Reach-tagged weapons
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';
import { loadBestiaryData, getCreatureDescription } from './bestiary.js';
import { isConnectedToServer, sendEvent } from '../../core/websocket.js';
import { logToSession, addVTTEvent } from '../gm-tools/index.js';
import { getMyStoredRole } from '../../core/feature-toggles.js';

/**
 * Range bands are the GM's call, not a shared table anyone at the table can
 * nudge — mirrors the rest of the app's GM-only gating (see feature-toggles.js:
 * role restrictions only apply in a connected multiplayer session; solo/local
 * play has no GM/player distinction, so it's always allowed there).
 */
function canSetRange() {
    return !isConnectedToServer() || getMyStoredRole() === 'gm';
}

let modal = null;
let currentEncounterId = null;
let combatants = [];
let round = 0;
let activeIndex = 0;
let timerSegments = 0;
let timerMax = 6;
let timerName = 'Combat Timer';
let combatLog = [];
let keyHandler = null;

let rangeMap = {};
let rangeGridOpen = false;

// ============================================================
// SHARED GM STORY BEAT BANK (same key as bestiary.js)
// ============================================================

const SB_BANK_KEY = 'fates-edge-gm-sb-bank';
let gmStoryBeats = 0;

function loadSBBank() {
    try {
        const stored = localStorage.getItem(SB_BANK_KEY);
        gmStoryBeats = stored ? Math.max(0, parseInt(stored, 10)) : 0;
    } catch (_) {
        gmStoryBeats = 0;
    }
}

function saveSBBank() {
    try { localStorage.setItem(SB_BANK_KEY, String(gmStoryBeats)); } catch (_) {}
}

function adjustSB(delta) {
    gmStoryBeats = Math.max(0, gmStoryBeats + delta);
    saveSBBank();
    const input = document.getElementById('sb-bank-input');
    if (input) input.value = gmStoryBeats;
}

function spendSB(cost, label) {
    if (gmStoryBeats < cost) {
        showToast(`Need ${cost} SB; only ${gmStoryBeats} available.`, 'warning');
        return false;
    }
    gmStoryBeats -= cost;
    saveSBBank();
    const input = document.getElementById('sb-bank-input');
    if (input) input.value = gmStoryBeats;
    try {
        logToSession(`💥 SB spent (${cost}): ${label}`, 'danger');
        addVTTEvent('sb_spent', { cost, label });
    } catch (e) { /* ignore */ }
    showToast(`Spent ${cost} SB — ${label}`, 'success');
    return true;
}

const DEFAULT_SB_MOVES = [
    { cost: 1, name: 'Minor complication', effect: 'Tick a timer +1, leave a trace, make a noise, or introduce a small distraction.' },
    { cost: 2, name: 'Moderate complication', effect: 'Alarm raised, worsen Position, lesser foe appears, or damage an asset.' },
    { cost: 3, name: 'Major complication', effect: 'Reinforcements arrive, the scene shifts, an asset breaks, or a bond is tested.' }
];

function formatSBMove(move, label) {
    const cost = parseInt(move.cost, 10) || 1;
    return `
        <div class="sb-move-card" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:0.45rem 0.6rem;font-size:0.78rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">
                <strong style="color:var(--text);">${escHtml(move.name)}</strong>
                <button class="btn btn-xs btn-danger sb-spend-btn" data-cost="${cost}" data-label="${attr(label || move.name)}" style="font-size:0.65rem;">
                    ${cost} SB
                </button>
            </div>
            ${move.source ? `<div style="font-size:0.65rem;color:var(--text3);margin:0.1rem 0;">${escHtml(move.source)}</div>` : ''}
            <div style="color:var(--text2);margin-top:0.15rem;">${escHtml(move.effect)}</div>
        </div>
    `;
}

function attr(val) {
    return escHtml(String(val ?? '')).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function tlToMaxHarm(tl) {
    return Math.max(1, (parseInt(tl, 10) || 2) + 2);
}

// Range bands are narrative distance between two combatants, GM-set (see
// canSetRange() above). Each band is defined by what can reach across it:
//   Close  — knife/grapple distance, well within arm's reach.
//   Medium — striking distance of a one-handed weapon.
//   Reach  — striking distance of a two-handed (Reach-tagged) weapon.
//   Far    — beyond melee range entirely; missile-weapon distance.
//   Absent — beyond missile range; functionally gone, requires a scene change.
// (Internal key for Medium stays 'near' for backward compatibility with saved
// encounters/rangeMap entries and setTrackerRangeByName() callers — only the
// label/description changed.)
const RANGE_BANDS = [
    { key: 'close',  label: 'Close',  short: 'C', color: 'var(--red)',    desc: "Knife/grapple distance — well within arm's reach." },
    { key: 'near',   label: 'Medium', short: 'M', color: 'var(--gold)',   desc: 'Striking distance of a one-handed weapon.' },
    { key: 'reach',  label: 'Reach',  short: 'R', color: 'var(--orange)', desc: 'Striking distance of a two-handed weapon — the gap a Reach-tagged weapon (spear, polearm) can still close.' },
    { key: 'far',    label: 'Far',    short: 'F', color: 'var(--blue)',   desc: 'Beyond melee range — missile-weapon distance.' },
    { key: 'absent', label: 'Absent', short: 'A', color: 'var(--text3)',  desc: 'Beyond missile range — functionally gone; requires a scene change.' }
];
const DEFAULT_RANGE = 'near';

// ============================================================
// ARMOR CONVERSION (Essentials §2.4 & §A.7)
// ============================================================

/**
 * Convert Harm to Fatigue based on armor type.
 * @param {number} harm - Incoming harm (integer)
 * @param {string} armorType - 'none', 'light', 'medium', 'heavy'
 * @returns {{ harm: number, fatigue: number }} Remaining Harm and Fatigue applied
 */
function applyArmorConversion(harm, armorType) {
    if (typeof harm !== 'number' || harm < 0) harm = 0;
    const type = (armorType || 'none').toLowerCase();
    switch (type) {
        case 'light':
            // 1→1 Fatigue (min 1/hit)
            return { harm: Math.max(0, harm - 1), fatigue: Math.min(harm, 1) };
        case 'medium':
            // 2→1 Fatigue (min 1/hit)
            return { harm: Math.max(0, harm - 2), fatigue: Math.min(Math.ceil(harm / 2), 1) };
        case 'heavy':
            // 3→2 Fatigue (min 1/hit)
            return { harm: Math.max(0, harm - 3), fatigue: Math.min(Math.ceil(harm / 2), 2) };
        case 'none':
        default:
            return { harm, fatigue: 0 };
    }
}

// ============================================================
// WEAPON RANGE RULES
// ============================================================
//
// Weapon weight class (Light/Medium/Heavy/Ranged — Player's Guide §3.12.1-
// 3.12.3, matches editor.js's WEAPON_CLASSES and core/talent-effects.js's
// RANGE_BONUS_TABLE exactly) is the single axis that determines which range
// bands a combatant can actually threaten, and at what dice bonus/penalty.
// Duplicated here (rather than imported from talent-effects.js) to avoid a
// circular import — this module is itself imported by gm-tools/index.js,
// which talent-effects.js's callers sit behind.
//   - Light:  Close +2d, Near +1d. Blocked beyond Near (fast/short weapon).
//   - Medium: Close +1d, Near +2d. Blocked beyond Near.
//   - Heavy:  Close -1d, Near +3d, Reach +0d (real reach — halberd,
//     greatsword). Blocked at Far/Absent.
//   - Ranged: Close -2d (the book's "Ranged in Close = Desperate", as a dice
//     proxy), Near +2d, Reach +2d, Far +1d. Blocked only at Absent.
// Reach/Absent don't exist in the book — they're this GM's own extended-band
// house rule on top of the RAW 3-band Close/Near/Far.
//
// Combatants with no weaponClass set (older saved encounters, imported
// Factions/abstract entries, etc.) are left unflagged rather than guessed at.
//
// This is a GM-facing indicator, not a hard lock on the damage button — the
// table still makes the final call — but it makes "wait, can that dagger even
// reach them?" visible at a glance.

const WEAPON_CLASS_RANGE_BONUS = {
    light:  { close:  2, near:  1, reach: -3, far: -3, absent: -3 },
    medium: { close:  1, near:  2, reach: -3, far: -3, absent: -3 },
    heavy:  { close: -1, near:  3, reach:  0, far: -3, absent: -3 },
    ranged: { close: -2, near:  2, reach:  2, far:  1, absent: -3 },
};
const WEAPON_CLASS_GLYPH = { light: '🗡️', medium: '⚔️', heavy: '🔨', ranged: '🏹' };
const WEAPON_CLASS_LABEL = { light: 'Light', medium: 'Medium', heavy: 'Heavy', ranged: 'Ranged' };

/**
 * Best-effort migration for combatants/adversary records saved before this
 * weapon-class rework (which used a 'melee'|'ranged' weaponType + reach
 * boolean instead of Light/Medium/Heavy/Ranged). Prefers an explicit
 * weaponClass if present; otherwise guesses from the old fields so existing
 * saved encounters don't just go blank.
 */
function deriveWeaponClass(source) {
    if (!source) return undefined;
    if (WEAPON_CLASS_LABEL[source.weaponClass]) return source.weaponClass;
    if (source.weaponType === 'ranged') return 'ranged';
    if (source.weaponType === 'melee') return source.reach ? 'heavy' : 'medium';
    return undefined;
}

function getWeaponRangeStatus(combatant, bandKey) {
    const cls = combatant.weaponClass;
    const table = WEAPON_CLASS_RANGE_BONUS[cls];
    if (!table || table[bandKey] === undefined) return 'ok'; // unknown/untracked weapon class — don't flag anything
    const bonus = table[bandKey];
    if (bonus <= -3) return 'blocked';
    if (bonus < 0) return 'penalty';
    return 'ok';
}

function weaponTypeLabel(combatant) {
    const cls = combatant.weaponClass;
    return WEAPON_CLASS_LABEL[cls] ? `${WEAPON_CLASS_GLYPH[cls]} ${WEAPON_CLASS_LABEL[cls]}` : '❔ Weapon not set';
}

function weaponToggleGlyph(combatant) {
    const cls = combatant.weaponClass;
    return WEAPON_CLASS_GLYPH[cls] || '❔';
}

function weaponRangeNote(status, combatant, bandLabel) {
    if (status === 'blocked') return `${weaponTypeLabel(combatant)} can't attack at ${bandLabel} range`;
    if (status === 'penalty') return `${weaponTypeLabel(combatant)} attacks at a penalty at ${bandLabel} range`;
    return '';
}

// ============================================================
// RANGE TRACKING HELPERS
// ============================================================

function rangePairKey(idA, idB) { return [idA, idB].sort().join('::'); }

function getRangeBand(idA, idB) {
    if (idA === idB) return null;
    return rangeMap[rangePairKey(idA, idB)] || DEFAULT_RANGE;
}

function setRangeBand(idA, idB, bandKey) {
    if (idA === idB) return;
    rangeMap[rangePairKey(idA, idB)] = bandKey;
}

function cycleRangeBand(idA, idB) {
    const current = getRangeBand(idA, idB);
    const idx = RANGE_BANDS.findIndex(b => b.key === current);
    const next = RANGE_BANDS[(idx + 1) % RANGE_BANDS.length];
    setRangeBand(idA, idB, next.key);
}

function getRangeBandInfo(bandKey) {
    return RANGE_BANDS.find(b => b.key === bandKey) || RANGE_BANDS[1];
}

function initRangeForNewCombatant(newCombatant) {
    combatants.forEach(other => {
        if (other.id === newCombatant.id) return;
        if (other.type === newCombatant.type) return;
        const key = rangePairKey(newCombatant.id, other.id);
        if (!(key in rangeMap)) rangeMap[key] = DEFAULT_RANGE;
    });
}

function initRangeForAllCombatants() {
    for (let i = 0; i < combatants.length; i++) {
        for (let j = i + 1; j < combatants.length; j++) {
            const a = combatants[i], b = combatants[j];
            if (a.type === b.type) continue;
            const key = rangePairKey(a.id, b.id);
            if (!(key in rangeMap)) rangeMap[key] = DEFAULT_RANGE;
        }
    }
}

function clearRangeForCombatant(id) {
    Object.keys(rangeMap).forEach(key => {
        if (key.split('::').includes(id)) delete rangeMap[key];
    });
}

function buildRangeGridHtml() {
    const players = combatants.filter(c => c.type === 'player');
    const adversaries = combatants.filter(c => c.type === 'adversary');
    const gmOnly = !canSetRange();

    let bodyHtml;
    if (players.length === 0 || adversaries.length === 0) {
        bodyHtml = `
            <div style="color:var(--text3);padding:1rem;text-align:center;font-size:0.85rem;">
                Add at least one 👤 Player and one 👾 Adversary to track ranges between them.
            </div>`;
    } else {
        const headerCells = adversaries.map(a => `
            <th style="padding:0.4rem 0.5rem;font-size:0.75rem;color:var(--text2);font-weight:600;white-space:nowrap;">
                ${escHtml(a.name)}
            </th>`).join('');

        const rows = players.map(p => {
            const cells = adversaries.map(a => {
                const band = getRangeBand(p.id, a.id);
                const info = getRangeBandInfo(band);
                const pStatus = getWeaponRangeStatus(p, band);
                const aStatus = getWeaponRangeStatus(a, band);
                const worst = (pStatus === 'blocked' || aStatus === 'blocked') ? 'blocked'
                    : (pStatus === 'penalty' || aStatus === 'penalty') ? 'penalty' : 'ok';
                const notes = [
                    weaponRangeNote(pStatus, p, info.label),
                    weaponRangeNote(aStatus, a, info.label)
                ].filter(Boolean).join('; ');
                const glyph = worst === 'blocked' ? '🚫 ' : worst === 'penalty' ? '⚠️ ' : '';
                const border = worst === 'blocked' ? '2px dashed var(--red)'
                    : worst === 'penalty' ? '2px dashed var(--orange)' : 'none';
                const rangeTitle = `${escHtml(p.name)} ↔ ${escHtml(a.name)}: ${info.label} — ${info.desc}` +
                    (gmOnly ? ' (only the GM can change ranges)' : ' (click to cycle)') +
                    (notes ? ` — ${escHtml(notes)}` : '');
                return `
                    <td style="padding:0.3rem 0.4rem;text-align:center;">
                        <button class="range-cell" data-a="${attr(p.id)}" data-b="${attr(a.id)}" ${gmOnly ? 'disabled' : ''}
                            title="${rangeTitle}"
                            style="
                                min-width:64px; font-size:0.75rem; font-weight:700; color:white;
                                background:${info.color}; border:${border}; border-radius:8px;
                                padding:0.3rem 0.5rem; transition:transform 0.15s ease;
                                ${gmOnly ? 'cursor:default;opacity:0.7;' : 'cursor:pointer;'}
                            ">${gmOnly ? '🔒 ' : ''}${glyph}${info.label}</button>
                    </td>`;
            }).join('');
            return `
                <tr>
                    <th style="padding:0.4rem 0.6rem;text-align:right;font-size:0.8rem;color:var(--text);white-space:nowrap;">
                        ${escHtml(p.name)}
                    </th>
                    ${cells}
                </tr>`;
        }).join('');

        bodyHtml = `
            <div style="overflow-x:auto;">
                <table style="border-collapse:collapse;width:100%;">
                    <thead><tr><th></th>${headerCells}</tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }

    const legend = RANGE_BANDS.map(b => `
        <span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.7rem;color:var(--text2);margin-right:0.9rem;">
            <span style="width:10px;height:10px;border-radius:3px;background:${b.color};display:inline-block;"></span>
            <strong style="color:var(--text);">${b.label}</strong> — ${b.desc}
        </span>`).join('');

    return `
        <div style="
            background: var(--bg3); border-radius: 12px; padding: 0.9rem 1rem;
            margin-bottom: 1.25rem; border: 1px solid var(--border);
        ">
            <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.6rem;">
                📏 Range Grid — ${gmOnly ? 'GM sets ranges; players see them read-only' : 'click any cell to cycle'} Close → Medium → Reach → Far → Absent
            </div>
            ${bodyHtml}
            <div style="margin-top:0.7rem;padding-top:0.6rem;border-top:1px solid var(--border);">
                ${legend}
            </div>
            <div style="margin-top:0.5rem;font-size:0.7rem;color:var(--text2);">
                🚫 = a combatant's weapon can't act at that range · ⚠️ = attacks there at a penalty ·
                click a combatant's ${escHtml('⚔️/🏹')} chip in the list to change their weapon.
            </div>
        </div>`;
}

// ============================================================
// INTEGRATION HELPERS
// ============================================================

function getLinkedFaction(name) {
    const state = getState();
    if (!state.factions) return null;
    const factions = state.factions.factions || [];
    return factions.find(f =>
        f.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(f.name.toLowerCase())
    );
}

function getLinkedPatron(name) {
    const state = getState();
    if (!state.patrons) return null;
    const patrons = state.patrons.cosmic || [];
    return patrons.find(p =>
        p.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(p.name.toLowerCase())
    );
}

function getLinkedFollower(name) {
    const state = getState();
    if (!state.factions) return null;
    const followers = state.factions.followers || [];
    return followers.find(f =>
        f.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(f.name.toLowerCase())
    );
}

function getLinkedAsset(name) {
    const state = getState();
    if (!state.factions) return null;
    const assets = state.factions.assets || [];
    return assets.find(a =>
        a.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(a.name.toLowerCase())
    );
}

function getLinkedRival(name) {
    const state = getState();
    if (!state.rivals) return null;
    const rivals = state.rivals || [];
    return rivals.find(r =>
        r.name?.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(r.name?.toLowerCase() || '')
    );
}

// ============================================================
// MAIN FUNCTIONS
// ============================================================

export async function openTracker(encounterId) {
    const state = getState();
    const encounter = state.encounters?.find(e => String(e.id) === String(encounterId));
    if (!encounter) {
        showToast('Encounter not found.', 'error');
        return;
    }

    currentEncounterId = encounterId;
    const bestiaryCreatures = await loadBestiaryData();

    combatants = (encounter.adversaries || []).map(a => {
        const creature = bestiaryCreatures.find(c =>
            (c.name || '').toLowerCase() === (a.name || '').toLowerCase()
        );
        const tl = a.tl !== undefined ? a.tl : (creature?.tl !== undefined ? creature.tl : 2);
        const cls = a.class || creature?.class || '';
        const category = a.category || creature?.category || '';
        const sbSpends = a.sb_spends?.length ? a.sb_spends : (creature?.sb_spends || []);
        const body = a.body || (creature ? getCreatureDescription(creature) : '');
        const stats = a.stats || creature?.stats || {};
        const weaponClass = deriveWeaponClass(a) || deriveWeaponClass(creature);

        return {
            id: 'combat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            name: a.name || 'Adversary',
            initiative: Math.floor(Math.random() * 20) + 1,
            harm: 0,
            fatigue: 0,                         // NEW
            armorType: a.armorType || 'none',   // NEW
            weaponClass,                         // 'light' | 'medium' | 'heavy' | 'ranged' | undefined (untracked)
            maxHarm: tlToMaxHarm(tl),
            status: 'active',
            notes: body || '',
            type: 'adversary',
            tl,
            class: cls,
            category,
            sbSpends,
            stats,
            linkedFaction: getLinkedFaction(a.name),
            linkedPatron: getLinkedPatron(a.name),
            linkedFollower: getLinkedFollower(a.name),
            linkedAsset: getLinkedAsset(a.name),
            linkedRival: getLinkedRival(a.name)
        };
    });

    round = 0;
    activeIndex = 0;
    timerSegments = 0;
    timerMax = 6;
    timerName = 'Combat Timer';
    combatLog = [];
    rangeMap = {};
    rangeGridOpen = false;
    initRangeForAllCombatants();

    renderTracker();
}

// ============================================================
// VTT COMBAT STATUS BROADCAST
// ============================================================

function broadcastCombatStatus() {
    if (!isConnectedToServer()) return;
    if (!combatants.length) return;

    const active = combatants[activeIndex] || null;
    const encounter = (getState().encounters || []).find(e => String(e.id) === String(currentEncounterId));

    try {
        sendEvent({
            type: 'combat-status-update',
            combat: {
                encounterId: currentEncounterId,
                encounterTitle: encounter ? encounter.title : null,
                round,
                activeName: active ? active.name : null,
                activeType: active ? active.type : null,
                timerName,
                timerSegments,
                timerMax,
                activeCount: combatants.filter(c => c.status === 'active').length,
                defeatedCount: combatants.filter(c => c.status === 'defeated').length
            }
        });
    } catch (e) { /* ignore */ }
}

// ============================================================
// RENDER TRACKER
// ============================================================

function renderTracker() {
    if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
    }
    loadSBBank();

    modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;
        z-index: 1000; padding: 1rem; backdrop-filter: blur(12px);
        animation: fadeIn 0.3s ease;
    `;

    const focusCombatant = combatants[activeIndex] || null;

    const combatantsHtml = combatants.map((c, i) => {
        const isActive = i === activeIndex && c.status === 'active';
        const isDefeated = c.status === 'defeated';
        const harmPercent = (c.harm / c.maxHarm) * 100;
        const hasLinks = c.linkedFaction || c.linkedPatron || c.linkedFollower || c.linkedAsset || c.linkedRival;

        // ─── Armor & fatigue display ──────────────────────────────
        let armorLabel = '';
        if (c.armorType && c.armorType !== 'none') {
            armorLabel = `<span style="font-size:0.6rem;background:rgba(100,180,255,0.15);color:var(--accent);padding:0.05rem 0.35rem;border-radius:10px;flex-shrink:0;">🛡️ ${escHtml(c.armorType)}</span>`;
        }
        let fatigueLabel = '';
        if (c.fatigue > 0) {
            fatigueLabel = `<span style="font-size:0.6rem;background:rgba(255,200,0,0.15);color:var(--gold);padding:0.05rem 0.35rem;border-radius:10px;flex-shrink:0;">💤 ${c.fatigue}</span>`;
        }

        // ─── Weapon class toggle (Light / Medium / Heavy / Ranged) ────
        const weaponLabel = `<button class="combat-weapon-toggle" data-index="${i}" title="${attr(weaponTypeLabel(c))} — click to change"
            style="font-size:0.6rem;background:rgba(212,175,55,0.12);color:var(--text2);border:1px solid var(--border);padding:0.05rem 0.35rem;border-radius:10px;flex-shrink:0;cursor:pointer;">${weaponToggleGlyph(c)}</button>`;

        let rangeChip = '';
        if (focusCombatant && focusCombatant.id !== c.id && focusCombatant.type !== c.type) {
            const band = getRangeBand(c.id, focusCombatant.id);
            const info = getRangeBandInfo(band);
            const status = getWeaponRangeStatus(c, band);
            const note = weaponRangeNote(status, c, info.label);
            const glyph = status === 'blocked' ? '🚫' : status === 'penalty' ? '⚠️' : '📏';
            const outline = status === 'blocked' ? 'outline:2px solid var(--red);outline-offset:1px;'
                : status === 'penalty' ? 'outline:2px solid var(--orange);outline-offset:1px;' : '';
            const chipGmOnly = !canSetRange();
            const chipTitle = `Range to ${escHtml(focusCombatant.name)}: ${info.label} — ${info.desc}` +
                (chipGmOnly ? ' (only the GM can change ranges)' : ' (click to cycle)') +
                (note ? ` — ${escHtml(note)}` : '');
            rangeChip = `<span class="range-chip" data-a="${attr(c.id)}" data-b="${attr(focusCombatant.id)}" data-gm-only="${chipGmOnly}"
                title="${chipTitle}"
                style="font-size:0.65rem; font-weight:700; color:white; background:${info.color};
                       padding:0.05rem 0.4rem; border-radius:10px; flex-shrink:0; ${outline}
                       ${chipGmOnly ? 'cursor:default;opacity:0.75;' : 'cursor:pointer;'}">
                ${chipGmOnly ? '🔒 ' : ''}${glyph} ${info.label}
            </span>`;
        }

        let linkBadges = '';
        if (c.linkedFaction) linkBadges += `<span class="badge faction-badge">🏛️</span>`;
        if (c.linkedPatron) linkBadges += `<span class="badge patron-badge">🌟</span>`;
        if (c.linkedFollower) linkBadges += `<span class="badge follower-badge">👤</span>`;
        if (c.linkedAsset) linkBadges += `<span class="badge asset-badge">📦</span>`;
        if (c.linkedRival) linkBadges += `<span class="badge rival-badge">⚔️</span>`;

        return `
            <div class="combatant-entry ${isActive ? 'active' : ''} ${isDefeated ? 'defeated' : ''}" data-index="${i}"
                 style="
                display: flex; align-items: center; gap: 0.75rem;
                padding: 0.75rem 1rem;
                background: ${isActive ? 'rgba(212,175,55,0.12)' : isDefeated ? 'var(--bg3)' : 'var(--bg2)'};
                border-radius: 10px; margin-bottom: 0.5rem; font-size: 0.9rem;
                border: 2px solid ${isActive ? 'var(--gold)' : isDefeated ? 'var(--border)' : 'var(--border)'};
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                transform: ${isActive ? 'scale(1.02)' : 'scale(1)'};
                box-shadow: ${isActive ? '0 0 30px rgba(212,175,55,0.1)' : 'none'};
                ${isDefeated ? 'opacity: 0.6;' : ''}
                cursor: pointer;
            ">
                <div class="combatant-number" style="
                    width: 32px; height: 32px; border-radius: 50%;
                    background: ${c.type === 'player' ? 'var(--blue)' : c.type === 'adversary' ? 'var(--red)' : 'var(--bg4)'};
                    display: flex; align-items: center; justify-content: center;
                    font-weight: bold; font-size: 0.7rem; color: white;
                    ${isActive ? 'box-shadow: 0 0 20px rgba(212,175,55,0.3);' : ''}
                ">
                    ${i + 1}
                </div>

                <div style="flex: 1; min-width: 0;">
                    <div style="
                        display: flex; align-items: center; justify-content: space-between;
                        margin-bottom: 0.25rem; gap: 0.5rem;
                    ">
                        <div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;min-width:0;">
                            <span style="
                                font-weight: 600; color: ${isActive ? 'var(--gold)' : isDefeated ? 'var(--text3)' : 'var(--text)'};
                                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                                transition: color 0.3s ease;
                            ">${escHtml(c.name)}</span>
                            ${c.tl !== undefined ? `<span class="creature-tag" style="font-size:0.62rem;background:rgba(255,100,100,0.15);color:var(--red);padding:0.05rem 0.35rem;border-radius:10px;flex-shrink:0;">TL${c.tl}</span>` : ''}
                            ${c.class ? `<span class="creature-tag" style="font-size:0.62rem;background:rgba(100,180,255,0.15);color:var(--accent);padding:0.05rem 0.35rem;border-radius:10px;flex-shrink:0;">Class ${escHtml(c.class)}</span>` : ''}
                            ${c.category ? `<span class="badge badge-${getCategoryBadgeColor(c.category)}" style="font-size:0.55rem;flex-shrink:0;">${escHtml(c.category)}</span>` : ''}
                            ${armorLabel}
                            ${fatigueLabel}
                            ${weaponLabel}
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.3rem; flex-shrink: 0;">
                            ${linkBadges}
                            ${rangeChip}
                            <span style="font-size: 0.7rem; color: var(--text3);">Init ${c.initiative}</span>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="flex: 1; height: 6px; background: var(--bg4); border-radius: 4px; overflow: hidden;">
                            <div class="harm-bar" style="
                                width: ${harmPercent}%; height: 100%;
                                background: ${harmPercent > 66 ? 'var(--red)' : harmPercent > 33 ? 'var(--orange)' : 'var(--green)'};
                                border-radius: 4px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                            "></div>
                        </div>
                        <span style="font-size: 0.75rem; color: var(--text2); min-width: 40px; text-align: right;">
                            ${c.harm}/${c.maxHarm}
                        </span>
                    </div>
                </div>

                <div style="display: flex; gap: 0.25rem; flex-shrink: 0;">
                    <button class="btn btn-xs btn-ghost combat-damage-btn" data-index="${i}" title="Deal damage" style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: var(--red);">💥</button>
                    <button class="btn btn-xs btn-ghost combat-heal-btn" data-index="${i}" title="Heal" style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: var(--green);">💚</button>
                    <button class="btn btn-xs btn-ghost combat-toggle-btn" data-index="${i}" title="Toggle active" style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: ${c.status === 'active' ? 'var(--green)' : 'var(--text3)'};">${c.status === 'active' ? '●' : '○'}</button>
                    <button class="btn btn-xs btn-ghost combat-remove-btn" data-index="${i}" title="Remove" style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: var(--red);">✕</button>
                </div>
            </div>
        `;
    }).join('');

    const logHtml = combatLog.slice(-5).reverse().map(entry => `
        <div style="
            padding: 0.25rem 0.5rem; font-size: 0.8rem;
            color: ${entry.type === 'damage' ? 'var(--red)' : entry.type === 'heal' ? 'var(--green)' : entry.type === 'turn' ? 'var(--gold)' : 'var(--text2)'};
            border-bottom: 1px solid var(--border);
        ">
            <span style="color: var(--text3);">[${entry.time}]</span> ${escHtml(entry.message)}
        </div>
    `).join('');

    const defaultMovesHtml = DEFAULT_SB_MOVES.map(m => formatSBMove(m, m.name)).join('');

    const creatureMoves = combatants
        .filter(c => c.type === 'adversary' && c.sbSpends?.length)
        .flatMap(c => (c.sbSpends || []).map(m => ({ ...m, source: c.name })));
    const creatureMovesHtml = creatureMoves.length
        ? creatureMoves.map(m => formatSBMove(m, `${m.source}: ${m.name}`)).join('')
        : '<div style="font-size:0.8rem;color:var(--text3);padding:0.3rem 0;">No creature-specific SB moves in this fight. Use the default moves above.</div>';

    modal.innerHTML = `
        <div class="combat-modal" style="
            background: var(--bg2); padding: 1.75rem; border-radius: 16px;
            max-width: 900px; width: 100%; max-height: 95vh; overflow-y: auto;
            border: 1px solid var(--border); box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.25rem;">
                <div>
                    <h2 style="margin:0;color:var(--gold);font-size:1.7rem;display:flex;align-items:center;gap:0.5rem;">
                        ⚔️ Combat Tracker
                    </h2>
                    <div style="color:var(--text2);font-size:0.85rem;margin-top:0.25rem;">
                        ${combatants.length} combatants · Round ${round} · ${combatants.filter(c => c.status === 'active').length} active
                        <span style="margin-left:0.5rem;font-size:0.7rem;color:var(--text3);">[Space: next · R: reset timer]</span>
                    </div>
                </div>
                <button id="combat-close" style="
                    background: var(--bg3); border: 1px solid var(--border);
                    color: var(--text2); font-size: 1.25rem; cursor: pointer;
                    width: 36px; height: 36px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                ">✕</button>
            </div>

            <!-- Stats Grid -->
            <div style="
                display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                gap: 0.75rem; background: var(--bg3); padding: 1rem; border-radius: 12px;
                margin-bottom: 1.25rem; border: 1px solid var(--border);
            ">
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase;">Round</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--gold);">${round}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase;">Active</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--green);">${combatants.filter(c => c.status === 'active').length}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase;">Defeated</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--red);">${combatants.filter(c => c.status === 'defeated').length}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase;">Linked</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--purple);">
                        ${combatants.filter(c => c.linkedFaction || c.linkedPatron || c.linkedFollower || c.linkedAsset || c.linkedRival).length}
                    </div>
                </div>
            </div>

            <!-- Timer -->
            <div style="
                background: var(--bg3); padding: 1rem; border-radius: 12px;
                margin-bottom: 1.25rem; border: 1px solid var(--border);
            ">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;margin-bottom:0.75rem;">
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <span style="font-size:1.25rem;">⏱️</span>
                        <div>
                            <div style="font-weight:600;font-size:1rem;transition:color 0.3s ease;">${escHtml(timerName)}</div>
                            <div style="font-size:0.8rem;color:var(--text2);">${timerSegments} of ${timerMax} segments</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn btn-sm btn-primary" id="combat-timer-tick" style="padding:0.4rem 0.75rem;font-size:0.85rem;">+1 Segment</button>
                        <button class="btn btn-sm btn-ghost" id="combat-timer-reset" style="padding:0.4rem 0.75rem;font-size:0.85rem;">↺ Reset</button>
                        <button class="btn btn-sm btn-ghost" id="combat-timer-rename" style="padding:0.4rem 0.75rem;font-size:0.85rem;">✏️</button>
                    </div>
                </div>
                <div class="timer-track" style="width:100%;height:12px;background:var(--bg4);border-radius:6px;overflow:hidden;position:relative;">
                    <div class="timer-fill" style="
                        width: ${(timerSegments / timerMax) * 100}%; height: 100%;
                        background: ${timerSegments >= timerMax ? 'var(--red)' : 'var(--gold)'};
                        border-radius: 6px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                        ${timerSegments > 0 ? 'box-shadow: 0 0 20px rgba(212,175,55,0.2);' : ''}
                    "></div>
                </div>
                ${timerSegments >= timerMax ? `
                    <div style="color:var(--red);font-size:0.85rem;margin-top:0.5rem;animation:pulse 1.5s infinite;">
                        ⚠️ Timer Complete!
                    </div>
                ` : ''}
            </div>

            <!-- Combatants -->
            <div style="margin-bottom: 1.25rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;margin-bottom:0.75rem;">
                    <h3 style="margin:0;color:var(--gold);">👾 Combatants</h3>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                        <button class="btn btn-sm btn-primary" id="combat-add-combatant" style="padding:0.4rem 0.75rem;font-size:0.85rem;">+ Adversary</button>
                        <button class="btn btn-sm btn-ghost" id="combat-add-player" style="padding:0.4rem 0.75rem;font-size:0.85rem;">👤 Player</button>
                        <button class="btn btn-sm btn-ghost" id="combat-import-factions" style="padding:0.4rem 0.75rem;font-size:0.85rem;">🏛️ Import</button>
                        <button class="btn btn-sm btn-ghost" id="combat-import-bestiary" style="padding:0.4rem 0.75rem;font-size:0.85rem;">📖 Bestiary</button>
                        <button class="btn btn-sm btn-ghost" id="combat-sort" style="padding:0.4rem 0.75rem;font-size:0.85rem;">🔄 Sort</button>
                        <button class="btn btn-sm ${rangeGridOpen ? 'btn-gold' : 'btn-ghost'}" id="combat-toggle-ranges" style="padding:0.4rem 0.75rem;font-size:0.85rem;">📏 Ranges</button>
                    </div>
                </div>
                <div id="combatant-list" style="max-height: 380px; overflow-y: auto; padding-right: 0.5rem;">
                    ${combatantsHtml || '<div style="color:var(--text3);padding:2rem;text-align:center;">No combatants. Add some to begin!</div>'}
                </div>
            </div>

            <!-- Story Beats Panel -->
            <div style="background:var(--bg3);padding:1rem;border-radius:12px;margin-bottom:1.25rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.6rem;">
                    <h3 style="margin:0;color:var(--danger);">⚡ Story Beats</h3>
                    <div style="display:flex;align-items:center;gap:0.3rem;">
                        <span style="font-size:0.8rem;color:var(--text2);">Bank:</span>
                        <button class="btn btn-xs btn-ghost sb-minus" style="font-weight:bold;">−</button>
                        <input type="number" id="sb-bank-input" value="${gmStoryBeats}" min="0" style="width:55px;text-align:center;font-size:0.8rem;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.15rem;" />
                        <button class="btn btn-xs btn-ghost sb-plus" style="font-weight:bold;">+</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.4rem;">
                    ${defaultMovesHtml}
                    ${creatureMovesHtml}
                </div>
            </div>

            <!-- Range Grid -->
            ${rangeGridOpen ? buildRangeGridHtml() : ''}

            <!-- Combat Log -->
            ${combatLog.length > 0 ? `
            <div style="background:var(--bg3);border-radius:12px;padding:0.75rem;margin-bottom:1.25rem;border:1px solid var(--border);max-height:140px;overflow-y:auto;">
                <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">📜 Combat Log</div>
                ${logHtml}
            </div>
            ` : ''}

            <!-- Controls -->
            <div style="display:flex;flex-wrap:wrap;gap:0.75rem;border-top:1px solid var(--border);padding-top:1.25rem;">
                <button class="btn btn-primary" id="combat-next" style="flex:1;min-width:100px;padding:0.6rem;">⏭️ Next Turn</button>
                <button class="btn btn-ghost" id="combat-end-round" style="flex:1;min-width:100px;padding:0.6rem;">🔚 End Round</button>
                <button class="btn btn-ghost" id="combat-clear-log" style="flex:0 0 auto;padding:0.6rem;">🗑️ Log</button>
                <button class="btn btn-danger" id="combat-close-tracker" style="flex:1;min-width:100px;padding:0.6rem;">✖️ Close</button>
            </div>
        </div>

        <style>
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
            .combatant-entry { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            .combatant-entry:hover:not(.defeated) { background: var(--bg4) !important; transform: translateX(4px); }
            .combatant-entry.active { border-color: var(--gold) !important; background: rgba(212,175,55,0.1) !important; }
            .combatant-entry.defeated .combatant-number { background: var(--bg4) !important; }
            #combatant-list::-webkit-scrollbar { width: 6px; }
            #combatant-list::-webkit-scrollbar-track { background: var(--bg3); border-radius: 3px; }
            #combatant-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
            #combatant-list::-webkit-scrollbar-thumb:hover { background: var(--text3); }
            .badge { display: inline-block; padding: 0.05rem 0.35rem; border-radius: 10px; font-size: 0.62rem; font-weight: 600; color: white; line-height: 1.4; }
            .faction-badge { background: var(--gold); }
            .patron-badge { background: var(--purple); }
            .follower-badge { background: var(--green); }
            .asset-badge { background: var(--blue); }
            .rival-badge { background: var(--red); }
            .btn { transition: all 0.2s ease; }
            .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
            .btn:active { transform: scale(0.96); }
        </style>
    `;
    document.body.appendChild(modal);

    // EVENT LISTENERS
    modal.querySelector('#combat-close')?.addEventListener('click', closeTracker);
    modal.querySelector('#combat-close-tracker')?.addEventListener('click', closeTracker);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeTracker(); });

    modal.querySelector('#combat-timer-tick')?.addEventListener('click', () => {
        timerSegments = Math.min(timerSegments + 1, timerMax);
        addLog('info', `Timer advanced to ${timerSegments}/${timerMax}`);
        renderTracker();
        showToast(`⏱️ Timer advanced to ${timerSegments}/${timerMax}`, 'info');
    });

    modal.querySelector('#combat-timer-reset')?.addEventListener('click', () => {
        timerSegments = 0;
        addLog('info', 'Timer reset');
        renderTracker();
        showToast('⏱️ Timer reset', 'info');
    });

    modal.querySelector('#combat-timer-rename')?.addEventListener('click', () => {
        const newName = prompt('Enter timer name:', timerName);
        if (newName) {
            timerName = newName;
            addLog('info', `Timer renamed to "${timerName}"`);
            renderTracker();
        }
    });

    modal.querySelector('#combat-add-combatant')?.addEventListener('click', addCombatant);
    modal.querySelector('#combat-add-player')?.addEventListener('click', addPlayer);
    modal.querySelector('#combat-import-factions')?.addEventListener('click', importFromFactions);
    modal.querySelector('#combat-import-bestiary')?.addEventListener('click', importFromBestiary);
    modal.querySelector('#combat-sort')?.addEventListener('click', sortCombatants);
    modal.querySelector('#combat-toggle-ranges')?.addEventListener('click', () => {
        rangeGridOpen = !rangeGridOpen;
        renderTracker();
    });

    modal.querySelectorAll('.range-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canSetRange()) {
                showToast('Only the GM can change ranges.', 'warning');
                return;
            }
            cycleRangeBand(chip.dataset.a, chip.dataset.b);
            renderTracker();
        });
    });
    modal.querySelectorAll('.range-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canSetRange()) {
                showToast('Only the GM can change ranges.', 'warning');
                return;
            }
            cycleRangeBand(cell.dataset.a, cell.dataset.b);
            renderTracker();
        });
    });

    modal.querySelector('#combat-next')?.addEventListener('click', nextCombatant);
    modal.querySelector('#combat-end-round')?.addEventListener('click', endRound);
    modal.querySelector('#combat-clear-log')?.addEventListener('click', () => {
        combatLog = [];
        renderTracker();
        showToast('🧹 Combat log cleared', 'info');
    });

    // SB bank controls
    modal.querySelector('.sb-minus')?.addEventListener('click', () => adjustSB(-1));
    modal.querySelector('.sb-plus')?.addEventListener('click', () => adjustSB(1));
    modal.querySelector('#sb-bank-input')?.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        gmStoryBeats = isNaN(val) ? 0 : Math.max(0, val);
        saveSBBank();
    });
    modal.querySelectorAll('.sb-spend-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cost = parseInt(btn.dataset.cost, 10);
            const label = btn.dataset.label;
            spendSB(cost, label);
        });
    });

    // Focus / selection
    modal.querySelectorAll('.combatant-entry').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            const idx = parseInt(el.dataset.index);
            if (!isNaN(idx) && idx >= 0 && idx < combatants.length && combatants[idx].status === 'active') {
                activeIndex = idx;
                renderTracker();
                addLog('info', `Focused on ${combatants[idx].name}`);
                showToast(`🎯 Focused on ${combatants[idx].name}`, 'info');
            }
        });
    });

    // Combatant actions
    modal.querySelectorAll('.combat-damage-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); damageCombatant(parseInt(btn.dataset.index)); });
    });
    modal.querySelectorAll('.combat-heal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); healCombatant(parseInt(btn.dataset.index)); });
    });
    modal.querySelectorAll('.combat-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); toggleCombatant(parseInt(btn.dataset.index)); });
    });
    modal.querySelectorAll('.combat-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); removeCombatant(parseInt(btn.dataset.index)); });
    });
    modal.querySelectorAll('.combat-weapon-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); cycleWeaponType(parseInt(btn.dataset.index)); });
    });

    // Keyboard shortcuts
    if (keyHandler) {
        document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
    }
    keyHandler = (e) => {
        if (!modal || !modal.parentNode) {
            document.removeEventListener('keydown', keyHandler);
            keyHandler = null;
            return;
        }
        if (e.key === ' ' && !e.target.matches('input, textarea, select')) {
            e.preventDefault();
            modal.querySelector('#combat-next')?.click();
        }
        if ((e.key === 'r' || e.key === 'R') && !e.target.matches('input, textarea, select')) {
            e.preventDefault();
            modal.querySelector('#combat-timer-reset')?.click();
        }
    };
    document.addEventListener('keydown', keyHandler);

    broadcastCombatStatus();
}

// ============================================================
// CLOSE TRACKER
// ============================================================

function closeTracker() {
    if (keyHandler) {
        document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
    }
    if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
    }
    modal = null;

    if (isConnectedToServer()) {
        try { sendEvent({ type: 'combat-status-update', combat: null }); } catch (e) { /* ignore */ }
    }

    currentEncounterId = null;
}

// ============================================================
// COMBATANT MANAGEMENT
// ============================================================

function addLog(type, message) {
    const time = new Date().toLocaleTimeString();
    combatLog.push({ type, message, time });
    if (combatLog.length > 50) combatLog.shift();
}

function promptWeaponClass(defaultClass) {
    const typePrompt = (prompt('Weapon class: light, medium, heavy, or ranged', defaultClass || 'medium') || defaultClass || 'medium').toLowerCase();
    return WEAPON_CLASS_LABEL[typePrompt] ? typePrompt : 'medium';
}

function addCombatant() {
    const name = prompt('Enter adversary name:');
    if (!name) return;
    const initiative = parseInt(prompt('Enter initiative (1-20):', Math.floor(Math.random() * 20) + 1) || '10');
    const harm = parseInt(prompt('Max Harm (1-20):', '3') || '3');
    const armorPrompt = prompt('Armor type: none, light, medium, heavy (default: none)', 'none') || 'none';
    const armorType = ['none', 'light', 'medium', 'heavy'].includes(armorPrompt) ? armorPrompt : 'none';
    const weaponClass = promptWeaponClass('medium');

    const newAdversary = {
        id: 'combat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        name,
        initiative: Math.min(Math.max(initiative, 1), 20),
        harm: 0,
        fatigue: 0,
        armorType: armorType,
        weaponClass,
        maxHarm: Math.min(Math.max(harm, 1), 20),
        status: 'active',
        notes: '',
        type: 'adversary',
        linkedFaction: getLinkedFaction(name),
        linkedPatron: getLinkedPatron(name),
        linkedFollower: getLinkedFollower(name),
        linkedAsset: getLinkedAsset(name),
        linkedRival: getLinkedRival(name)
    };
    combatants.push(newAdversary);
    initRangeForNewCombatant(newAdversary);
    sortCombatants();
    addLog('info', `Added adversary: ${name}`);
    renderTracker();
    showToast(`👾 Added ${name}`, 'success');
}

function addPlayer() {
    const name = prompt('Enter player name:');
    if (!name) return;
    const initiative = parseInt(prompt('Enter initiative (1-20):', Math.floor(Math.random() * 20) + 1) || '10');
    const harm = parseInt(prompt('Max Harm (1-20):', '4') || '4');
    const armorPrompt = prompt('Armor type: none, light, medium, heavy (default: none)', 'none') || 'none';
    const armorType = ['none', 'light', 'medium', 'heavy'].includes(armorPrompt) ? armorPrompt : 'none';
    const weaponClass = promptWeaponClass('medium');

    const newPlayer = {
        id: 'combat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        name: `👤 ${name}`,
        initiative: Math.min(Math.max(initiative, 1), 20),
        harm: 0,
        fatigue: 0,
        armorType: armorType,
        weaponClass,
        maxHarm: Math.min(Math.max(harm, 1), 20),
        status: 'active',
        notes: 'Player character',
        type: 'player'
    };
    combatants.push(newPlayer);
    initRangeForNewCombatant(newPlayer);
    sortCombatants();
    addLog('info', `Added player: ${name}`);
    renderTracker();
    showToast(`👤 Added player ${name}`, 'success');
}

function importFromFactions() {
    const state = getState();
    if (!state.factions) {
        showToast('No factions data found.', 'warning');
        return;
    }
    const factions = state.factions.factions || [];
    if (factions.length === 0) {
        showToast('No factions to import from.', 'warning');
        return;
    }
    const options = factions.map((f, i) => `${i+1}. ${f.name}`).join('\n');
    const choice = prompt(`Select a faction to import as a combatant:\n${options}\n\nEnter number:`);
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= factions.length) {
        showToast('Invalid selection', 'error');
        return;
    }
    const faction = factions[idx];
    const newFactionCombatant = {
        id: 'combat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        name: faction.name,
        initiative: Math.floor(Math.random() * 20) + 5 + (faction.standing || 0),
        harm: 0,
        fatigue: 0,
        armorType: 'none',
        // weaponClass intentionally left unset — a Faction is an abstract force,
        // not a single combatant with a weapon, so we don't flag range issues for it.
        maxHarm: 4 + Math.abs(faction.standing || 0),
        status: 'active',
        notes: `Faction: ${faction.agenda || 'No agenda'}`,
        type: 'adversary',
        linkedFaction: faction
    };
    combatants.push(newFactionCombatant);
    initRangeForNewCombatant(newFactionCombatant);
    sortCombatants();
    addLog('info', `Imported faction: ${faction.name}`);
    renderTracker();
    showToast(`🏛️ Imported ${faction.name}`, 'success');
}

async function importFromBestiary() {
    const creatures = await loadBestiaryData();
    if (!creatures || creatures.length === 0) {
        showToast('Bestiary not loaded yet.', 'error');
        return;
    }

    const searchModal = document.createElement('div');
    searchModal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.7);
        display: flex; align-items: center; justify-content: center;
        z-index: 2000; backdrop-filter: blur(8px);
    `;
    searchModal.innerHTML = `
        <div style="background: var(--bg-panel); padding: 1.5rem; border-radius: 12px;
                    max-width: 520px; width: 100%; max-height: 80vh; overflow-y: auto;">
            <h3 style="margin-top:0;">📖 Import from Bestiary</h3>
            <input type="text" id="bestiary-import-search" placeholder="Search creatures..."
                   style="width:100%; padding:0.4rem; margin-bottom:0.5rem;">
            <div id="bestiary-import-list" style="max-height:300px; overflow-y:auto;"></div>
            <button id="bestiary-import-close" class="btn btn-sm btn-ghost"
                    style="margin-top:0.5rem;">Cancel</button>
        </div>
    `;
    document.body.appendChild(searchModal);

    const searchInput = searchModal.querySelector('#bestiary-import-search');
    const listContainer = searchModal.querySelector('#bestiary-import-list');
    const closeBtn = searchModal.querySelector('#bestiary-import-close');

    function renderList(filter = '') {
        const term = filter.toLowerCase().trim();
        const filtered = creatures.filter(c =>
            (c.name || '').toLowerCase().includes(term) ||
            (getCreatureDescription(c) || '').toLowerCase().includes(term)
        );
        if (filtered.length === 0) {
            listContainer.innerHTML = '<div style="color:var(--text3);padding:1rem;">No creatures found.</div>';
            return;
        }
        listContainer.innerHTML = filtered.map(c => `
            <div class="bestiary-import-item" data-name="${attr(c.name)}"
                 style="padding:0.5rem; border-bottom:1px solid var(--border); cursor:pointer;
                        display:flex; justify-content:space-between; align-items:center;flex-wrap:wrap;gap:0.4rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                    <strong style="font-size:0.9rem;">${escHtml(c.name)}</strong>
                    ${c.tl !== undefined ? `<span style="font-size:0.65rem;color:var(--red);">TL${c.tl}</span>` : ''}
                    ${c.class ? `<span style="font-size:0.65rem;color:var(--accent);">Class ${escHtml(c.class)}</span>` : ''}
                    ${c.category ? `<span class="badge badge-${getCategoryBadgeColor(c.category)}" style="font-size:0.6rem;color:white;">${escHtml(c.category)}</span>` : ''}
                </div>
                <span style="font-size:0.75rem;color:var(--text3);max-width:220px;overflow:hidden;text-overflow:ellipsis;">
                    ${escHtml((getCreatureDescription(c) || '').slice(0, 60))}${((getCreatureDescription(c) || '').length > 60 ? '…' : '')}
                </span>
            </div>
        `).join('');

        listContainer.querySelectorAll('.bestiary-import-item').forEach(item => {
            item.addEventListener('click', () => {
                const name = item.dataset.name;
                const entry = creatures.find(e => e.name === name);
                if (!entry) return;

                const state = getState();
                const encounter = state.encounters?.find(e => String(e.id) === String(currentEncounterId));
                if (encounter) {
                    if (!encounter.adversaries) encounter.adversaries = [];
                    const exists = encounter.adversaries.some(a => a.name.toLowerCase() === name.toLowerCase());
                    if (!exists) {
                        encounter.adversaries.push({
                            name: entry.name,
                            body: getCreatureDescription(entry) || '',
                            tl: entry.tl,
                            class: entry.class || '',
                            category: entry.category || '',
                            stats: entry.stats || {},
                            sb_spends: entry.sb_spends || [],
                            armorType: 'none',  // default armor
                            weaponClass: deriveWeaponClass(entry)
                        });
                        saveState();
                    }
                }

                const newCombatant = {
                    id: 'combat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                    name: entry.name || 'Adversary',
                    initiative: Math.floor(Math.random() * 20) + 1,
                    harm: 0,
                    fatigue: 0,
                    armorType: 'none',
                    // Only set if the bestiary entry actually specifies it — otherwise
                    // leave untracked rather than guessing a weight class for a monster.
                    weaponClass: deriveWeaponClass(entry),
                    maxHarm: tlToMaxHarm(entry.tl),
                    status: 'active',
                    notes: getCreatureDescription(entry) || '',
                    type: 'adversary',
                    tl: entry.tl,
                    class: entry.class || '',
                    category: entry.category || '',
                    sbSpends: entry.sb_spends || [],
                    stats: entry.stats || {},
                    linkedFaction: getLinkedFaction(entry.name),
                    linkedPatron: getLinkedPatron(entry.name),
                    linkedFollower: getLinkedFollower(entry.name),
                    linkedAsset: getLinkedAsset(entry.name),
                    linkedRival: getLinkedRival(entry.name)
                };
                combatants.push(newCombatant);
                initRangeForNewCombatant(newCombatant);
                sortCombatants();
                addLog('info', `Imported bestiary creature: ${entry.name}`);
                renderTracker();
                showToast(`📖 Imported ${entry.name}`, 'success');
                searchModal.remove();
            });
        });
    }

    searchInput.addEventListener('input', (e) => renderList(e.target.value));
    closeBtn.addEventListener('click', () => searchModal.remove());
    searchModal.addEventListener('click', (e) => { if (e.target === searchModal) searchModal.remove(); });

    renderList('');
}

function sortCombatants() {
    combatants.sort((a, b) => {
        if (a.status === 'defeated' && b.status !== 'defeated') return 1;
        if (a.status !== 'defeated' && b.status === 'defeated') return -1;
        return b.initiative - a.initiative;
    });
    activeIndex = 0;
    addLog('info', 'Sorted combatants by initiative');
    renderTracker();
    showToast('🔄 Combatants sorted by initiative', 'info');
}

function nextCombatant() {
    const active = combatants.filter(c => c.status === 'active');
    if (active.length === 0) {
        showToast('No active combatants.', 'info');
        return;
    }
    let nextIndex = (activeIndex + 1) % combatants.length;
    let attempts = 0;
    while (attempts < combatants.length) {
        if (combatants[nextIndex].status === 'active') {
            activeIndex = nextIndex;
            addLog('turn', `${combatants[activeIndex].name}'s turn`);
            renderTracker();
            showToast(`⏭️ ${combatants[activeIndex].name}'s turn`, 'info');
            return;
        }
        nextIndex = (nextIndex + 1) % combatants.length;
        attempts++;
    }
    endRound();
}

function endRound() {
    round++;
    const firstActive = combatants.findIndex(c => c.status === 'active');
    if (firstActive !== -1) activeIndex = firstActive;
    addLog('info', `Round ${round} begins`);
    timerSegments = Math.min(timerSegments + 1, timerMax);
    renderTracker();
    showToast(`🔚 Round ${round} begins`, 'info');
    if (timerSegments >= timerMax) {
        addLog('warning', 'Timer completed!');
        showToast('⏱️ Timer completed!', 'warning');
    }
}

// ─── UPDATED damageCombatant with Armor Conversion ──────────────

function damageCombatant(idx) {
    const amount = parseInt(prompt('Damage amount:', '1') || '1');
    if (isNaN(amount) || amount < 1) {
        showToast('Invalid damage amount.', 'error');
        return;
    }
    if (idx >= 0 && idx < combatants.length) {
        const c = combatants[idx];
        // Apply armor conversion
        const armorType = c.armorType || 'none';
        const converted = applyArmorConversion(amount, armorType);
        // Apply fatigue first (if any)
        if (converted.fatigue > 0) {
            c.fatigue = (c.fatigue || 0) + converted.fatigue;
            addLog('damage', `${c.name} gains ${converted.fatigue} Fatigue from armor (${armorType})`);
        }
        // Apply remaining harm
        if (converted.harm > 0) {
            c.harm = Math.min(c.harm + converted.harm, c.maxHarm);
            addLog('damage', `${c.name} takes ${converted.harm} harm (${c.harm}/${c.maxHarm})`);
            if (c.harm >= c.maxHarm && c.status !== 'defeated') {
                c.status = 'defeated';
                addLog('damage', `${c.name} is defeated!`);
                showToast(`💀 ${c.name} is defeated!`, 'error');
            } else {
                showToast(`💥 ${c.name} takes ${converted.harm} harm (${c.harm}/${c.maxHarm})`, 'warning');
            }
        } else if (converted.fatigue > 0) {
            showToast(`🛡️ ${c.name} absorbs harm, gains ${converted.fatigue} Fatigue`, 'info');
        } else {
            showToast(`🛡️ ${c.name}'s armor completely absorbs the damage.`, 'info');
        }
        renderTracker();
    }
}

function healCombatant(idx) {
    const amount = parseInt(prompt('Heal amount:', '1') || '1');
    if (idx >= 0 && idx < combatants.length) {
        const c = combatants[idx];
        c.harm = Math.max(c.harm - amount, 0);
        if (c.status === 'defeated' && c.harm < c.maxHarm) {
            c.status = 'active';
            addLog('heal', `${c.name} revived!`);
            showToast(`💚 ${c.name} revived!`, 'success');
        } else {
            addLog('heal', `${c.name} healed for ${amount} (${c.harm}/${c.maxHarm})`);
            showToast(`💚 ${c.name} healed for ${amount}`, 'success');
        }
        renderTracker();
    }
}

function toggleCombatant(idx) {
    if (idx >= 0 && idx < combatants.length) {
        const c = combatants[idx];
        c.status = c.status === 'active' ? 'inactive' : 'active';
        addLog('info', `${c.name} ${c.status === 'active' ? 'activated' : 'deactivated'}`);
        showToast(`${c.name} ${c.status === 'active' ? 'activated' : 'deactivated'}`, 'info');
        renderTracker();
    }
}

// Cycle a combatant's weapon: unset/other → Light → Medium → Heavy → Ranged → Light → ...
const WEAPON_CLASS_CYCLE = ['light', 'medium', 'heavy', 'ranged'];
function cycleWeaponType(idx) {
    if (idx < 0 || idx >= combatants.length) return;
    const c = combatants[idx];
    const currentPos = WEAPON_CLASS_CYCLE.indexOf(c.weaponClass);
    c.weaponClass = WEAPON_CLASS_CYCLE[(currentPos + 1) % WEAPON_CLASS_CYCLE.length];
    addLog('info', `${c.name} switched to ${weaponTypeLabel(c)}`);
    renderTracker();
}

function removeCombatant(idx) {
    if (idx >= 0 && idx < combatants.length) {
        if (confirm(`Remove ${combatants[idx].name}?`)) {
            const name = combatants[idx].name;
            const removedId = combatants[idx].id;
            combatants.splice(idx, 1);
            clearRangeForCombatant(removedId);
            if (activeIndex >= combatants.length) activeIndex = Math.max(0, combatants.length - 1);
            addLog('info', `Removed ${name}`);
            renderTracker();
            showToast(`🗑️ Removed ${name}`, 'info');
        }
    }
}

function getCategoryBadgeColor(category) {
    const map = {
        'beast': 'green', 'undead': 'red', 'humanoid': 'blue', 'fiend': 'purple',
        'construct': 'gold', 'plant': 'green', 'dragon': 'red', 'elemental': 'blue',
        'celestial': 'gold', 'abomination': 'purple'
    };
    return map[(category || '').toLowerCase()] || 'gold';
}

// ============================================================
// EXTERNAL API
// ============================================================

export function isTrackerOpen(encounterId) {
    return !!modal && String(currentEncounterId) === String(encounterId);
}

export function getLiveCombatants() {
    return combatants.map(c => ({
        id: c.id, name: c.name, type: c.type, status: c.status,
        harm: c.harm, maxHarm: c.maxHarm, fatigue: c.fatigue || 0, armorType: c.armorType || 'none',
        initiative: c.initiative, weaponClass: c.weaponClass
    }));
}

/**
 * Snapshot of the tracker's live in-memory state for read-only display
 * elsewhere (e.g. the VTT sidebar's mini combat tracker card). The tracker
 * itself is a single module-level session — as long as the SPA page hasn't
 * been reloaded, this stays queryable even after the GM closes the modal, so
 * a player can glance at initiative order and their range without the
 * Encounters tab open. Returns combatants sorted by initiative (desc), with
 * the active-turn combatant's id flagged.
 */
export function getTrackerState() {
    const sorted = [...combatants].sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
    const activeCombatant = combatants[activeIndex] || null;
    return {
        encounterId: currentEncounterId,
        isModalOpen: !!modal,
        round,
        activeCombatantId: activeCombatant?.id || null,
        combatants: sorted.map(c => ({
            id: c.id, name: c.name, type: c.type, status: c.status,
            harm: c.harm, maxHarm: c.maxHarm, fatigue: c.fatigue || 0, armorType: c.armorType || 'none',
            initiative: c.initiative, weaponClass: c.weaponClass
        }))
    };
}

/**
 * Range band between two combatants by id (see rangeMap/getRangeBand above).
 * Exposed read-only for the VTT mini tracker's "range to you" chip.
 */
export function getRangeBandBetween(idA, idB) {
    return getRangeBand(idA, idB);
}

// getRangeBandInfo(bandKey) — label/short/color lookup for a band key — is
// already defined above (used internally); exported here too so external
// callers (VTT mini tracker) don't need to duplicate RANGE_BANDS.
export { getRangeBandInfo };

export function setTrackerRangeByName(nameA, nameB, bandKey) {
    if (!modal) return false;
    const a = combatants.find(c => (c.name || '').toLowerCase() === (nameA || '').toLowerCase());
    const b = combatants.find(c => (c.name || '').toLowerCase() === (nameB || '').toLowerCase());
    if (!a || !b) return false;
    setRangeBand(a.id, b.id, bandKey);
    renderTracker();
    return true;
}

// ============================================================
// EXPORTS
// ============================================================

export default { openTracker };