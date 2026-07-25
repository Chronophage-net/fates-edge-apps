/**
 * Combat Tracker - Advanced initiative and timer tracking
 * Integrated with Factions, Rivals, Followers, Assets, Patrons, and Bestiary
 * ✅ Keyboard shortcuts: Space = next turn, R = reset timer
 * ✅ Cleaner UI with better feedback
 * ✅ Import from Bestiary via searchable modal
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';
import { loadBestiaryData, getCreatureDescription } from './bestiary.js'; // 👈 Integration import
import { isConnectedToServer, sendEvent } from '../../core/websocket.js'; // 👈 NEW: combat-status broadcast to VTT

let modal = null;
let currentEncounterId = null;
let combatants = [];
let round = 0;
let activeIndex = 0;
let timerSegments = 0;
let timerMax = 6;
let timerName = 'Combat Timer';
let isTimerRunning = false;
let timerInterval = null;
let combatLog = [];
let keyHandler = null;  // Store for cleanup

// 👇 NEW: Range tracking (relative, narrative distance per PC/Adversary pair)
let rangeMap = {};          // { "pairKey": "close" | "near" | "far" | "absent" }
let rangeGridOpen = false;  // whether the full range-grid panel is expanded

// Order matters: index is used to cycle forward/back through bands.
const RANGE_BANDS = [
    { key: 'close',  label: 'Close',  short: 'C', color: 'var(--red)',    desc: "Arm's length, grappling distance." },
    { key: 'near',   label: 'Near',   short: 'N', color: 'var(--gold)',   desc: 'Same room or immediate area.' },
    { key: 'far',    label: 'Far',    short: 'F', color: 'var(--blue)',   desc: 'Visible but not immediately reachable.' },
    { key: 'absent', label: 'Absent', short: 'A', color: 'var(--text3)',  desc: 'Off-screen; requires a scene change.' }
];
const DEFAULT_RANGE = 'near';

// ============================================================
// RANGE TRACKING HELPERS
// ============================================================

// Pair key is order-independent so range(A,B) === range(B,A)
function rangePairKey(idA, idB) {
    return [idA, idB].sort().join('::');
}

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

// When a new combatant joins, default its range to every existing
// combatant of the opposite type (player <-> adversary) to "Near".
// Same-type pairs (player-player, adversary-adversary) aren't tracked –
// range bands in Fate's Edge matter for who's threatening whom, not
// for allies standing near each other.
function initRangeForNewCombatant(newCombatant) {
    combatants.forEach(other => {
        if (other.id === newCombatant.id) return;
        if (other.type === newCombatant.type) return;
        const key = rangePairKey(newCombatant.id, other.id);
        if (!(key in rangeMap)) rangeMap[key] = DEFAULT_RANGE;
    });
}

// Rebuild the default cross-type pairings for the whole current
// combatants list (used right after openTracker populates it).
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

// Builds the full PC × Adversary range matrix panel.
function buildRangeGridHtml() {
    const players = combatants.filter(c => c.type === 'player');
    const adversaries = combatants.filter(c => c.type === 'adversary');

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
                return `
                    <td style="padding:0.3rem 0.4rem;text-align:center;">
                        <button class="range-cell" data-a="${p.id}" data-b="${a.id}"
                            title="${escHtml(p.name)} ↔ ${escHtml(a.name)}: ${info.label} — ${info.desc} (click to cycle)"
                            style="
                                min-width:64px; font-size:0.75rem; font-weight:700; color:white;
                                background:${info.color}; border:none; border-radius:8px;
                                padding:0.3rem 0.5rem; cursor:pointer; transition:transform 0.15s ease;
                            ">${info.label}</button>
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
                    <thead>
                        <tr>
                            <th></th>
                            ${headerCells}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
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
                📏 Range Grid — click any cell to cycle Close → Near → Far → Absent
            </div>
            ${bodyHtml}
            <div style="margin-top:0.7rem;padding-top:0.6rem;border-top:1px solid var(--border);">
                ${legend}
            </div>
        </div>`;
}

// ============================================================
// INTEGRATION HELPERS
// ============================================================

function getLinkedFaction(combatantName) {
    const state = getState();
    if (!state.factions) return null;
    const factions = state.factions.factions || [];
    return factions.find(f => 
        f.name.toLowerCase().includes(combatantName.toLowerCase()) ||
        combatantName.toLowerCase().includes(f.name.toLowerCase())
    );
}

function getLinkedPatron(combatantName) {
    const state = getState();
    if (!state.patrons) return null;
    const patrons = state.patrons.cosmic || [];
    return patrons.find(p => 
        p.name.toLowerCase().includes(combatantName.toLowerCase()) ||
        combatantName.toLowerCase().includes(p.name.toLowerCase())
    );
}

function getLinkedFollower(combatantName) {
    const state = getState();
    if (!state.factions) return null;
    const followers = state.factions.followers || [];
    return followers.find(f => 
        f.name.toLowerCase().includes(combatantName.toLowerCase()) ||
        combatantName.toLowerCase().includes(f.name.toLowerCase())
    );
}

function getLinkedAsset(combatantName) {
    const state = getState();
    if (!state.factions) return null;
    const assets = state.factions.assets || [];
    return assets.find(a => 
        a.name.toLowerCase().includes(combatantName.toLowerCase()) ||
        combatantName.toLowerCase().includes(a.name.toLowerCase())
    );
}

function getLinkedRival(combatantName) {
    const state = getState();
    if (!state.rivals) return null;
    const rivals = state.rivals || [];
    return rivals.find(r => 
        r.name?.toLowerCase().includes(combatantName.toLowerCase()) ||
        combatantName.toLowerCase().includes(r.name?.toLowerCase() || '')
    );
}

// ============================================================
// MAIN FUNCTIONS
// ============================================================

export function openTracker(encounterId) {
    const state = getState();
    const encounter = state.encounters?.find(e => String(e.id) === String(encounterId));
    if (!encounter) {
        showToast('Encounter not found.', 'error');
        return;
    }
    
    currentEncounterId = encounterId;
    
    if (encounter?.adversaries) {
        combatants = (encounter.adversaries || []).map(a => ({
            id: 'combat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: a.name || 'Adversary',
            initiative: Math.floor(Math.random() * 20) + 1,
            harm: 0,
            maxHarm: a.harm || 3,
            status: 'active',
            notes: a.description || a.body || '',
            type: 'adversary',
            linkedFaction: getLinkedFaction(a.name),
            linkedPatron: getLinkedPatron(a.name),
            linkedFollower: getLinkedFollower(a.name),
            linkedAsset: getLinkedAsset(a.name),
            linkedRival: getLinkedRival(a.name)
        }));
    } else {
        combatants = [];
    }
    
    round = 0;
    activeIndex = 0;
    timerSegments = 0;
    timerMax = 6;
    timerName = 'Combat Timer';
    isTimerRunning = false;
    combatLog = [];

    // 👇 NEW: fresh range map for this combat, defaulted to Near for
    // every PC/Adversary pair (players are added separately via "+ Player").
    rangeMap = {};
    rangeGridOpen = false;
    initRangeForAllCombatants();
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    renderTracker();
}

// ============================================================
// VTT COMBAT STATUS BROADCAST (NEW)
// ============================================================

/**
 * Pushes a lightweight, player-safe snapshot of combat state over the
 * WebSocket so the VTT's "Live Table" view can show round/turn/timer
 * info without giving players GM-only access to the Tracker itself.
 *
 * Deliberately excludes per-combatant harm values and other tactical
 * secrets — only round number, whose turn it is, and the shared combat
 * timer (which is meant to be player-visible tension, like a countdown
 * clock) go out. Piggybacks on renderTracker(), which already runs
 * after every state-changing action, so no extra call sites are needed
 * for the common cases (damage, heal, next turn, timer tick, etc.).
 */
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
                defeatedCount: combatants.filter(c => c.status === 'defeated').length,
            }
        });
    } catch (e) { /* ignore */ }
}

// ============================================================
// RENDER TRACKER
// ============================================================

function renderTracker() {
    // 👇 FIX: renderTracker() is called on every action (damage, heal, sort,
    // timer tick, and now every range click) to refresh the view. It was
    // never removing the previous modal node first, so each action silently
    // stacked a brand-new full-screen modal on top of the last one. Clean up
    // any existing modal before building the new one.
    if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
    }

    // Build modal
    modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;
        z-index: 1000; padding: 1rem; backdrop-filter: blur(12px);
        animation: fadeIn 0.3s ease;
    `;
    
    // 👇 NEW: reference combatant for the "range to active" chip on each row
    const focusCombatant = combatants[activeIndex] || null;

    const combatantsHtml = combatants.map((c, i) => {
        const isActive = i === activeIndex && c.status === 'active';
        const isDefeated = c.status === 'defeated';
        const harmPercent = (c.harm / c.maxHarm) * 100;
        const hasLinks = c.linkedFaction || c.linkedPatron || c.linkedFollower || c.linkedAsset || c.linkedRival;

        // 👇 NEW: range chip showing this combatant's distance to the
        // currently-focused combatant (only meaningful across player/adversary lines)
        let rangeChip = '';
        if (focusCombatant && focusCombatant.id !== c.id && focusCombatant.type !== c.type) {
            const band = getRangeBand(c.id, focusCombatant.id);
            const info = getRangeBandInfo(band);
            rangeChip = `<span class="range-chip" data-a="${c.id}" data-b="${focusCombatant.id}"
                title="Range to ${escHtml(focusCombatant.name)}: ${info.label} — ${info.desc} (click to cycle)"
                style="
                    font-size:0.65rem; font-weight:700; color:white; background:${info.color};
                    padding:0.05rem 0.4rem; border-radius:10px; cursor:pointer; flex-shrink:0;
                    letter-spacing:0.02em;
                ">📏 ${info.label}</span>`;
        }

        let linkBadges = '';
        if (c.linkedFaction) linkBadges += `<span class="badge faction-badge" style="background:${c.linkedFaction.color || 'var(--gold)'};">🏛️</span>`;
        if (c.linkedPatron) linkBadges += `<span class="badge patron-badge" style="background:var(--purple);">🌟</span>`;
        if (c.linkedFollower) linkBadges += `<span class="badge follower-badge" style="background:var(--green);">👤</span>`;
        if (c.linkedAsset) linkBadges += `<span class="badge asset-badge" style="background:var(--blue);">📦</span>`;
        if (c.linkedRival) linkBadges += `<span class="badge rival-badge" style="background:var(--red);">⚔️</span>`;
        
        return `
            <div class="combatant-entry ${isActive ? 'active' : ''} ${isDefeated ? 'defeated' : ''}" 
                 data-index="${i}"
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
                    transition: all 0.3s ease;
                    ${isActive ? 'box-shadow: 0 0 20px rgba(212,175,55,0.3);' : ''}
                ">
                    ${i + 1}
                </div>
                
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        display: flex; align-items: center; justify-content: space-between;
                        margin-bottom: 0.25rem; gap: 0.5rem;
                    ">
                        <span style="
                            font-weight: 600; color: ${isActive ? 'var(--gold)' : isDefeated ? 'var(--text3)' : 'var(--text)'};
                            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                            transition: color 0.3s ease;
                        ">${escHtml(c.name)}</span>
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
                    <button class="btn btn-xs btn-ghost combat-damage-btn" data-index="${i}" 
                            style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: var(--red); border-radius: 6px; transition: all 0.2s ease;"
                            title="Deal damage">💥</button>
                    <button class="btn btn-xs btn-ghost combat-heal-btn" data-index="${i}" 
                            style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: var(--green); border-radius: 6px; transition: all 0.2s ease;"
                            title="Heal">💚</button>
                    <button class="btn btn-xs btn-ghost combat-toggle-btn" data-index="${i}" 
                            style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: ${c.status === 'active' ? 'var(--green)' : 'var(--text3)'}; border-radius: 6px; transition: all 0.2s ease;"
                            title="Toggle active">${c.status === 'active' ? '●' : '○'}</button>
                    <button class="btn btn-xs btn-ghost combat-remove-btn" data-index="${i}" 
                            style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: var(--red); border-radius: 6px; transition: all 0.2s ease;"
                            title="Remove">✕</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Build combat log
    const logHtml = combatLog.slice(-5).reverse().map(entry => `
        <div style="
            padding: 0.25rem 0.5rem; font-size: 0.8rem; 
            color: ${entry.type === 'damage' ? 'var(--red)' : entry.type === 'heal' ? 'var(--green)' : 'var(--text2)'};
            border-bottom: 1px solid var(--border);
            animation: slideIn 0.3s ease;
        ">
            <span style="color: var(--text3);">[${entry.time}]</span>
            ${escHtml(entry.message)}
        </div>
    `).join('');
    
    modal.innerHTML = `
        <div class="combat-modal" style="
            background: var(--bg2); padding: 1.75rem; border-radius: 16px; 
            max-width: 800px; width: 100%; max-height: 95vh; overflow-y: auto; 
            border: 1px solid var(--border); box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            backdrop-filter: blur(16px);
            animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem;">
                <div>
                    <h2 style="margin:0;color:var(--gold);font-size:1.8rem;display:flex;align-items:center;gap:0.5rem;">
                        ⚔️ Combat Tracker
                        <span style="font-size:0.7rem;color:var(--text3);font-weight:400;background:var(--bg3);padding:0.1rem 0.6rem;border-radius:12px;">
                            v2
                        </span>
                    </h2>
                    <div style="color:var(--text2);font-size:0.9rem;margin-top:0.25rem;">
                        ${combatants.length} combatants · Round ${round} · ${combatants.filter(c => c.status === 'active').length} active
                        <span style="margin-left:0.5rem;font-size:0.7rem;color:var(--text3);">[Space: next turn, R: reset timer]</span>
                    </div>
                </div>
                <button id="combat-close" style="
                    background: var(--bg3); border: 1px solid var(--border); 
                    color: var(--text2); font-size: 1.25rem; cursor: pointer;
                    width: 36px; height: 36px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='var(--bg4)'" 
                   onmouseout="this.style.background='var(--bg3)'">✕</button>
            </div>
            
            <!-- Stats Grid -->
            <div style="
                display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                gap: 0.75rem; background: var(--bg3); padding: 1rem; border-radius: 12px;
                margin-bottom: 1.25rem; border: 1px solid var(--border);
            ">
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em;">Round</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--gold); transition: all 0.3s ease;">${round}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em;">Active</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--green); transition: all 0.3s ease;">
                        ${combatants.filter(c => c.status === 'active').length}
                    </div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em;">Defeated</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--red); transition: all 0.3s ease;">
                        ${combatants.filter(c => c.status === 'defeated').length}
                    </div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em;">Linked</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--purple); transition: all 0.3s ease;">
                        ${combatants.filter(c => c.linkedFaction || c.linkedPatron || c.linkedFollower || c.linkedAsset || c.linkedRival).length}
                    </div>
                </div>
            </div>
            
            <!-- Timer -->
            <div style="
                background: var(--bg3); padding: 1rem; border-radius: 12px;
                margin-bottom: 1.25rem; border: 1px solid var(--border);
                transition: all 0.3s ease;
            ">
                <div style="
                    display: flex; align-items: center; justify-content: space-between;
                    flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;
                ">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.25rem;">⏱️</span>
                        <div>
                            <div style="font-weight: 600; font-size: 1rem; transition: color 0.3s ease;">
                                ${escHtml(timerName)}
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text2);">
                                ${timerSegments} of ${timerMax} segments
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm btn-primary" id="combat-timer-tick" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem; transition: all 0.2s ease;">
                            +1 Segment
                        </button>
                        <button class="btn btn-sm btn-ghost" id="combat-timer-reset" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem; transition: all 0.2s ease;">
                            ↺ Reset
                        </button>
                        <button class="btn btn-sm btn-ghost" id="combat-timer-rename" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem; transition: all 0.2s ease;">
                            ✏️
                        </button>
                    </div>
                </div>
                <div class="timer-track" style="
                    width: 100%; height: 12px; background: var(--bg4); 
                    border-radius: 6px; overflow: hidden; position: relative;
                ">
                    <div class="timer-fill" style="
                        width: ${(timerSegments / timerMax) * 100}%; height: 100%;
                        background: ${timerSegments >= timerMax ? 'var(--red)' : 'var(--gold)'};
                        border-radius: 6px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                        position: relative;
                        ${timerSegments > 0 ? 'box-shadow: 0 0 20px rgba(212,175,55,0.2);' : ''}
                    ">
                        ${timerSegments > 0 ? `
                            <div style="
                                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
                                animation: shimmer 2s infinite;
                            "></div>
                        ` : ''}
                    </div>
                </div>
                ${timerSegments >= timerMax ? `
                    <div style="
                        color: var(--red); font-size: 0.85rem; margin-top: 0.5rem;
                        display: flex; align-items: center; gap: 0.25rem;
                        animation: pulse 1.5s infinite;
                    ">
                        ⚠️ Timer Complete!
                    </div>
                ` : ''}
            </div>
            
            <!-- Combatants -->
            <div style="margin-bottom: 1.25rem;">
                <div style="
                    display: flex; align-items: center; justify-content: space-between;
                    flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;
                ">
                    <h3 style="margin: 0; color: var(--gold); display: flex; align-items: center; gap: 0.5rem;">
                        👾 Combatants
                        <span style="font-size:0.7rem;color:var(--text3);font-weight:400;">
                            (click to focus)
                        </span>
                    </h3>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-primary" id="combat-add-combatant" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem; transition: all 0.2s ease;">
                            + Adversary
                        </button>
                        <button class="btn btn-sm btn-ghost" id="combat-add-player" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem; transition: all 0.2s ease;">
                            👤 Player
                        </button>
                        <button class="btn btn-sm btn-ghost" id="combat-import-factions" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem; transition: all 0.2s ease;">
                            🏛️ Import
                        </button>
                        <!-- 👇 NEW: Import from Bestiary -->
                        <button class="btn btn-sm btn-ghost" id="combat-import-bestiary" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem; transition: all 0.2s ease;">
                            📖 Bestiary
                        </button>
                        <button class="btn btn-sm btn-ghost" id="combat-sort" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem; transition: all 0.2s ease;">
                            🔄 Sort
                        </button>
                        <!-- 👇 NEW: Toggle full Range Grid -->
                        <button class="btn btn-sm ${rangeGridOpen ? 'btn-gold' : 'btn-ghost'}" id="combat-toggle-ranges" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem; transition: all 0.2s ease;"
                                title="Show/hide the full PC × Adversary range grid">
                            📏 Ranges
                        </button>
                    </div>
                </div>
                <div id="combatant-list" style="max-height: 350px; overflow-y: auto; padding-right: 0.5rem;">
                    ${combatantsHtml || '<div style="color:var(--text3);padding:2rem;text-align:center;">No combatants. Add some to begin!</div>'}
                </div>
            </div>

            <!-- 👇 NEW: Range Grid panel -->
            ${rangeGridOpen ? buildRangeGridHtml() : ''}
            
            <!-- Combat Log -->
            ${combatLog.length > 0 ? `
            <div style="
                background: var(--bg3); border-radius: 12px; padding: 0.75rem;
                margin-bottom: 1.25rem; border: 1px solid var(--border);
                max-height: 120px; overflow-y: auto;
            ">
                <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">
                    📜 Combat Log
                </div>
                ${logHtml}
            </div>
            ` : ''}
            
            <!-- Controls -->
            <div style="
                display: flex; flex-wrap: wrap; gap: 0.75rem; 
                border-top: 1px solid var(--border); padding-top: 1.25rem;
            ">
                <button class="btn btn-primary" id="combat-next" 
                        style="flex: 1; min-width: 100px; padding: 0.6rem; transition: all 0.2s ease;">
                    ⏭️ Next Turn
                </button>
                <button class="btn btn-ghost" id="combat-end-round" 
                        style="flex: 1; min-width: 100px; padding: 0.6rem; transition: all 0.2s ease;">
                    🔚 End Round
                </button>
                <button class="btn btn-ghost" id="combat-clear-log" 
                        style="flex: 0 0 auto; padding: 0.6rem; transition: all 0.2s ease;">
                    🗑️ Log
                </button>
                <button class="btn btn-danger" id="combat-close-tracker" 
                        style="flex: 1; min-width: 100px; padding: 0.6rem; transition: all 0.2s ease;">
                    ✖️ Close
                </button>
            </div>
        </div>
        
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(30px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes slideIn {
                from { opacity: 0; transform: translateX(-10px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes pulse {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
            }
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            
            .combatant-entry {
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .combatant-entry:hover:not(.defeated) {
                background: var(--bg4) !important;
                transform: translateX(4px);
            }
            .combatant-entry.active {
                border-color: var(--gold) !important;
                background: rgba(212,175,55,0.1) !important;
            }
            .combatant-entry.defeated .combatant-number {
                background: var(--bg4) !important;
            }
            
            #combatant-list::-webkit-scrollbar {
                width: 6px;
            }
            #combatant-list::-webkit-scrollbar-track {
                background: var(--bg3);
                border-radius: 3px;
            }
            #combatant-list::-webkit-scrollbar-thumb {
                background: var(--border);
                border-radius: 3px;
            }
            #combatant-list::-webkit-scrollbar-thumb:hover {
                background: var(--text3);
            }
            
            .badge {
                display: inline-block;
                padding: 0.05rem 0.4rem;
                border-radius: 12px;
                font-size: 0.6rem;
                font-weight: 600;
                color: white;
                line-height: 1.4;
            }
            .faction-badge { background: var(--gold); }
            .patron-badge { background: var(--purple); }
            .follower-badge { background: var(--green); }
            .asset-badge { background: var(--blue); }
            .rival-badge { background: var(--red); }
            
            .btn {
                transition: all 0.2s ease;
            }
            .btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            .btn:active {
                transform: scale(0.96);
            }
        </style>
    `;
    document.body.appendChild(modal);
    
    // ============================================================
    // EVENT LISTENERS
    // ============================================================
    
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
    modal.querySelector('#combat-import-bestiary')?.addEventListener('click', importFromBestiary); // 👈 NEW
    modal.querySelector('#combat-sort')?.addEventListener('click', sortCombatants);
    // 👇 NEW: Range grid toggle + interactive range chips/cells
    modal.querySelector('#combat-toggle-ranges')?.addEventListener('click', () => {
        rangeGridOpen = !rangeGridOpen;
        renderTracker();
    });
    modal.querySelectorAll('.range-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            cycleRangeBand(chip.dataset.a, chip.dataset.b);
            renderTracker();
        });
    });
    modal.querySelectorAll('.range-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
            e.stopPropagation();
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
    
    // Click on combatant to focus
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
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            damageCombatant(idx);
        });
    });
    modal.querySelectorAll('.combat-heal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            healCombatant(idx);
        });
    });
    modal.querySelectorAll('.combat-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            toggleCombatant(idx);
        });
    });
    modal.querySelectorAll('.combat-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            removeCombatant(idx);
        });
    });
    
    // ============================================================
    // KEYBOARD SHORTCUTS
    // ============================================================
    
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
            const nextBtn = modal.querySelector('#combat-next');
            if (nextBtn) nextBtn.click();
        }
        if (e.key === 'r' && !e.target.matches('input, textarea, select')) {
            e.preventDefault();
            const resetBtn = modal.querySelector('#combat-timer-reset');
            if (resetBtn) resetBtn.click();
        }
    };
    document.addEventListener('keydown', keyHandler);

    // 👇 NEW: keep the VTT's live combat-status pill in sync with every
    // tracker refresh (damage, heal, next turn, timer tick, etc.)
    broadcastCombatStatus();
}

// ============================================================
// CLOSE TRACKER (with cleanup)
// ============================================================

function closeTracker() {
    if (keyHandler) {
        document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
    }
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
    }
    modal = null;

    // 👇 NEW: tell the VTT the encounter is no longer active so the
    // combat-status pill disappears instead of showing stale round/turn
    // info after the GM closes the tracker.
    if (isConnectedToServer()) {
        try { sendEvent({ type: 'combat-status-update', combat: null }); } catch (e) { /* ignore */ }
    }

    currentEncounterId = null;
}

// ============================================================
// HELPERS
// ============================================================

function addLog(type, message) {
    const time = new Date().toLocaleTimeString();
    combatLog.push({ type, message, time });
    if (combatLog.length > 50) combatLog.shift();
}

// ============================================================
// COMBATANT MANAGEMENT
// ============================================================

function addCombatant() {
    const name = prompt('Enter adversary name:');
    if (!name) return;
    const initiative = parseInt(prompt('Enter initiative (1-20):', Math.floor(Math.random() * 20) + 1) || '10');
    const harm = parseInt(prompt('Max Harm (1-10):', '3') || '3');
    
    const newAdversary = {
        id: 'combat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        name: name,
        initiative: Math.min(Math.max(initiative, 1), 20),
        harm: 0,
        maxHarm: Math.min(Math.max(harm, 1), 10),
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
    initRangeForNewCombatant(newAdversary); // 👈 NEW: default range to existing players
    sortCombatants();
    addLog('info', `Added adversary: ${name}`);
    renderTracker();
    showToast(`👾 Added ${name}`, 'success');
}

function addPlayer() {
    const name = prompt('Enter player name:');
    if (!name) return;
    const initiative = parseInt(prompt('Enter initiative (1-20):', Math.floor(Math.random() * 20) + 1) || '10');
    const harm = parseInt(prompt('Max Harm (1-10):', '4') || '4');
    
    const newPlayer = {
        id: 'combat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        name: `🧙 ${name}`,
        initiative: Math.min(Math.max(initiative, 1), 20),
        harm: 0,
        maxHarm: Math.min(Math.max(harm, 1), 10),
        status: 'active',
        notes: 'Player character',
        type: 'player',
        linkedFaction: null,
        linkedPatron: null,
        linkedFollower: null,
        linkedAsset: null,
        linkedRival: null
    };
    combatants.push(newPlayer);
    initRangeForNewCombatant(newPlayer); // 👈 NEW: default range to existing adversaries
    sortCombatants();
    addLog('info', `Added player: ${name}`);
    renderTracker();
    showToast(`👤 Added player ${name}`, 'success');
}

function importFromFactions() {
    const state = getState();
    if (!state.factions) {
        showToast('No factions data found. Load some factions first.', 'warning');
        return;
    }
    const factions = state.factions.factions || [];
    if (factions.length === 0) {
        showToast('No factions to import from.', 'warning');
        return;
    }
    const options = factions.map((f, i) => `${i+1}. ${f.name} (${f.standing !== undefined ? 'Standing: ' + f.standing : 'Neutral'})`).join('\n');
    const choice = prompt(`Select a faction to import as a combatant:\n${options}\n\nEnter number:`);
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= factions.length) {
        showToast('Invalid selection', 'error');
        return;
    }
    const faction = factions[idx];
    const newFactionCombatant = {
        id: 'combat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        name: faction.name,
        initiative: Math.floor(Math.random() * 20) + 5 + (faction.standing || 0),
        harm: 0,
        maxHarm: 4 + Math.abs(faction.standing || 0),
        status: 'active',
        notes: `Faction: ${faction.agenda || 'No agenda'}`,
        type: 'adversary',
        linkedFaction: faction,
        linkedPatron: null,
        linkedFollower: null,
        linkedAsset: null,
        linkedRival: null
    };
    combatants.push(newFactionCombatant);
    initRangeForNewCombatant(newFactionCombatant); // 👈 NEW: default range to existing players
    sortCombatants();
    addLog('info', `Imported faction: ${faction.name}`);
    renderTracker();
    showToast(`🏛️ Imported ${faction.name} as combatant`, 'success');
}

// 👇 NEW: Import from Bestiary
async function importFromBestiary() {
    const creatures = await loadBestiaryData();
    if (!creatures || creatures.length === 0) {
        showToast('Bestiary not loaded yet.', 'error');
        return;
    }

    // Create a modal for searching
    const searchModal = document.createElement('div');
    searchModal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.7);
        display: flex; align-items: center; justify-content: center;
        z-index: 2000; backdrop-filter: blur(8px);
    `;
    searchModal.innerHTML = `
        <div style="background: var(--bg-panel); padding: 1.5rem; border-radius: 12px;
                    max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto;">
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
            <div class="bestiary-import-item" data-name="${escHtml(c.name)}" 
                 style="padding:0.4rem; border-bottom:1px solid var(--border); cursor:pointer;
                        display:flex; justify-content:space-between; align-items:center;">
                <span>${escHtml(c.name)}</span>
                <span style="font-size:0.7rem;color:var(--text3);">${c.category || ''}</span>
            </div>
        `).join('');

        listContainer.querySelectorAll('.bestiary-import-item').forEach(item => {
            item.addEventListener('click', () => {
                const name = item.dataset.name;
                const entry = creatures.find(e => e.name === name);
                if (entry) {
                    // Add to current encounter's adversaries
                    const state = getState();
                    const encounter = state.encounters?.find(e => String(e.id) === String(currentEncounterId));
                    if (!encounter) {
                        showToast('No encounter found.', 'error');
                        searchModal.remove();
                        return;
                    }
                    if (!encounter.adversaries) encounter.adversaries = [];
                    const exists = encounter.adversaries.some(a => a.name.toLowerCase() === name.toLowerCase());
                    if (!exists) {
                        encounter.adversaries.push({
                            name: entry.name,
                            body: getCreatureDescription(entry) || '',
                            tier: entry.tier || 2,
                            stats: entry.stats || {}
                        });
                        saveState();
                        showToast(`⚔️ Added "${name}" to combat.`, 'success');
                        // 👇 FIX: previously this rebuilt `combatants` from
                        // encounter.adversaries alone, which silently deleted
                        // every player combatant and reset harm/status for
                        // every adversary already in the fight. Just add the
                        // one new combatant instead, and give it a default
                        // range to everyone already present.
                        const newCombatant = {
                            id: 'combat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                            name: entry.name || 'Adversary',
                            initiative: Math.floor(Math.random() * 20) + 1,
                            harm: 0,
                            maxHarm: entry.harm || 3,
                            status: 'active',
                            notes: getCreatureDescription(entry) || '',
                            type: 'adversary',
                            linkedFaction: getLinkedFaction(entry.name),
                            linkedPatron: getLinkedPatron(entry.name),
                            linkedFollower: getLinkedFollower(entry.name),
                            linkedAsset: getLinkedAsset(entry.name),
                            linkedRival: getLinkedRival(entry.name)
                        };
                        combatants.push(newCombatant);
                        initRangeForNewCombatant(newCombatant);
                        sortCombatants();
                        renderTracker();
                        searchModal.remove();
                    } else {
                        showToast(`"${name}" already in this encounter.`, 'info');
                        searchModal.remove();
                    }
                }
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
    let firstActive = combatants.findIndex(c => c.status === 'active');
    if (firstActive !== -1) {
        activeIndex = firstActive;
    }
    addLog('info', `Round ${round} begins`);
    renderTracker();
    showToast(`🔚 Round ${round} begins`, 'info');
    timerSegments = Math.min(timerSegments + 1, timerMax);
    if (timerSegments >= timerMax) {
        addLog('warning', 'Timer completed!');
        showToast('⏱️ Timer completed!', 'warning');
    }
}

function damageCombatant(idx) {
    const amount = parseInt(prompt('Damage amount:', '1') || '1');
    if (idx >= 0 && idx < combatants.length) {
        const combatant = combatants[idx];
        combatant.harm = Math.min(combatant.harm + amount, combatant.maxHarm);
        if (combatant.harm >= combatant.maxHarm && combatant.status !== 'defeated') {
            combatant.status = 'defeated';
            addLog('damage', `${combatant.name} is defeated!`);
            showToast(`💀 ${combatant.name} is defeated!`, 'error');
        } else {
            addLog('damage', `${combatant.name} takes ${amount} harm (${combatant.harm}/${combatant.maxHarm})`);
            showToast(`💥 ${combatant.name} takes ${amount} harm`, 'warning');
        }
        renderTracker();
    }
}

function healCombatant(idx) {
    const amount = parseInt(prompt('Heal amount:', '1') || '1');
    if (idx >= 0 && idx < combatants.length) {
        const combatant = combatants[idx];
        combatant.harm = Math.max(combatant.harm - amount, 0);
        if (combatant.status === 'defeated' && combatant.harm < combatant.maxHarm) {
            combatant.status = 'active';
            addLog('heal', `${combatant.name} revived!`);
            showToast(`💚 ${combatant.name} revived!`, 'success');
        } else {
            addLog('heal', `${combatant.name} healed for ${amount} (${combatant.harm}/${combatant.maxHarm})`);
            showToast(`💚 ${combatant.name} healed for ${amount}`, 'success');
        }
        renderTracker();
    }
}

function toggleCombatant(idx) {
    if (idx >= 0 && idx < combatants.length) {
        const combatant = combatants[idx];
        combatant.status = combatant.status === 'active' ? 'inactive' : 'active';
        addLog('info', `${combatant.name} ${combatant.status === 'active' ? 'activated' : 'deactivated'}`);
        showToast(`${combatant.name} ${combatant.status === 'active' ? 'activated' : 'deactivated'}`, 'info');
        renderTracker();
    }
}

function removeCombatant(idx) {
    if (idx >= 0 && idx < combatants.length) {
        if (confirm(`Remove ${combatants[idx].name}?`)) {
            const name = combatants[idx].name;
            const removedId = combatants[idx].id;
            combatants.splice(idx, 1);
            clearRangeForCombatant(removedId); // 👈 NEW: drop stale range entries
            if (activeIndex >= combatants.length) activeIndex = Math.max(0, combatants.length - 1);
            addLog('info', `Removed ${name}`);
            renderTracker();
            showToast(`🗑️ Removed ${name}`, 'info');
        }
    }
}

// ============================================================
// EXTERNAL API (for cross-feature integration — e.g. the Whiteboard's
// optional Grid Combat mode syncing token distance into narrative range)
// ============================================================

// True if the tracker modal is currently open, showing this specific encounter.
export function isTrackerOpen(encounterId) {
    return !!modal && String(currentEncounterId) === String(encounterId);
}

// Read-only snapshot of the live combatants (id/name/type/status/harm).
// Lets other features (e.g. the Whiteboard) pull in who's actually in the
// fight right now — including ad-hoc players added via "+ Player", which
// aren't persisted anywhere else — without touching the Tracker's own
// bookkeeping.
export function getLiveCombatants() {
    return combatants.map(c => ({
        id: c.id, name: c.name, type: c.type, status: c.status,
        harm: c.harm, maxHarm: c.maxHarm
    }));
}

// Sets the narrative range band between two combatants, matched by name
// (case-insensitive) against whichever combatants are currently loaded in
// this tracker session. Returns true if both names were found and the
// range was set. No-op (returns false) if the tracker isn't open, or
// either name isn't currently in the fight — there's nothing to attach
// a range to yet. Re-renders the tracker if it's visibly open, so a
// Range Grid / chip left on screen updates live as tokens move.
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

// Default export as before
export default { openTracker };
