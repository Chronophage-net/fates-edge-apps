/**
 * GM Tools Module - Advanced Campaign Management
 * 
 * Features:
 * - Scene management (Boons, timers, session archiving)
 * - Campaign Whiteboard (notes, drawings, sticky notes)
 * - Campaign Kanban Board (To Do, Doing, Done, Blocked)
 * - Encounter & Timer Integration
 * - Deck of Consequences / Crown Spread Integration
 * - Campaign Dashboard with active threats and opportunities
 * - Travel Planner (Cartomancy-based journey generation)
 * - Quick-Generate Panel (NPC, Location, Rumor)
 * - Session Log / Recap (automatic event logging)
 * - Tag Injector (scene tags affecting Position/DV)
 * - Ace Effects Integration (special effects on Ace draws)
 * - 🎥 Session Recording (screen+mic capture -> .zip bundle with a synced
 *   event SRT, optional best-effort live transcription) and a separate
 *   Session Log Export (JSON dump of the text log/VTT events)
 * - 🔄 Automation: auto-tick timers on Partial/Miss, auto-increment SB Bank
 *
 * ── NEW: Adventure Manager cross-links ───────────────────────────────
 * - Scene view now surfaces whatever adventure is currently `status:
 *   'active'` (title/act/scene), with Complete Scene / Start Encounter
 *   buttons right there — no more tab-switching to see where you are.
 * - Quick Generate NPCs/Locations/Rumors can be saved straight into the
 *   active adventure with one click, instead of being throwaway flavor.
 * - A Crown Spread drawn here can be turned into a full adventure
 *   template on the spot (reuses Adventure Manager's own parser via a
 *   dynamic import — no logic duplicated).
 * - Encounters started from an adventure scene now show which
 *   adventure/scene they came from in the Active Encounters list.
 * All cross-feature calls use dynamic import() (not a static import),
 * since Adventure Manager already imports logToSession/addVTTEvent from
 * *this* file — a static import the other way would be circular.
 */

import { getState, addArchive, clearRollHistory, clearChatHistory, saveState, getStableClientId } from '@core/state.js';
import { resetTalentCharges } from '@core/talent-effects.js';
import {
    getSoundTracks, addSoundTrack, removeSoundTrack,
    playAmbience, stopAmbience, getCurrentAmbienceId, playSfx
} from '@core/soundboard.js';
import { getGmState, updateGmState } from '@core/state.js';
import { clamp, escHtml } from '@core/utils.js';
import { showToast } from '@components/Toast.js';
import { isFeatureVisible, getFeatureAccess } from '@core/feature-toggles.js';
import { 
    getSelectedRegion, 
    getRegionNames, 
    quickDraw, 
    quickCrownSpread,
    setSelectedRegion,
    onRegionChange,
    getRegionData,
    ensureRegionsReady
} from '@features/decks/index.js';
import { isConnectedToServer } from '@core/websocket.js';

// Import media module
import {
    initMediaModule,
    startRecording as mediaStartRecording,
    stopRecording as mediaStopRecording,
    isCurrentlyRecording,
    getRecordingStatus,
    isLiveTranscriptionSupported
} from '@core/media.js';

// ============================================================
// STATE
// ============================================================

let container = null;
let activeTab = 'scene';
let moduleCache = {};          // caches kanban, whiteboard, travel
let whiteboardData = {
    notes: [],
    drawings: [],
    stickyNotes: []
};
let kanbanData = {
    columns: {
        todo: { title: '📋 To Do', items: [] },
        doing: { title: '🔄 Doing', items: [] },
        done: { title: '✅ Done', items: [] },
        blocked: { title: '🚫 Blocked', items: [] }
    }
};
let campaignState = {
    activeThreats: [],
    opportunities: [],
    campaignTimers: [],
    notes: '',
    sessionLog: [],
    sceneTags: [],
    vttEvents: []
};

// 👇 NEW: last Quick Generate result, so "Save to Adventure" has
// something concrete to persist (rather than re-parsing rendered HTML).
let lastQuickGenResult = null; // { type: 'npc'|'location'|'rumor', data }

// 👇 NEW: last Crown Spread drawn from this tab, so "Build Adventure
// from this Reading" doesn't need to re-draw or guess at Decks' history.
let lastCrownSpreadReading = null; // { synthesis, cardNames, region }

// ============================================================
// LOAD/SAVE
// ============================================================

function loadCampaignData() {
    const saved = getState();
    if (saved.campaign) {
        whiteboardData = saved.campaign.whiteboard || { notes: [], drawings: [], stickyNotes: [] };
        kanbanData = saved.campaign.kanban || { columns: { todo: { title: '📋 To Do', items: [] }, doing: { title: '🔄 Doing', items: [] }, done: { title: '✅ Done', items: [] }, blocked: { title: '🚫 Blocked', items: [] } } };
        campaignState = saved.campaign.state || { activeThreats: [], opportunities: [], campaignTimers: [], notes: '', sessionLog: [], sceneTags: [], vttEvents: [] };
    }
}

function saveCampaignData() {
    const saved = getState();
    if (!saved.campaign) saved.campaign = {};
    saved.campaign.whiteboard = whiteboardData;
    saved.campaign.kanban = kanbanData;
    saved.campaign.state = campaignState;
    saveState();
}

// ============================================================
// SESSION LOG & VTT EVENTS
// ============================================================

function logToSession(message, type = 'info') {
    const state = getState();
    if (!state.campaign) state.campaign = {};
    if (!state.campaign.state) state.campaign.state = {};
    if (!state.campaign.state.sessionLog) state.campaign.state.sessionLog = [];
    
    state.campaign.state.sessionLog.push({
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString(),
        message: message,
        type: type
    });
    saveState();
    
    if (activeTab === 'campaign' || activeTab === 'session') {
        refreshView();
    }
}

function addVTTEvent(type, data = {}) {
    const state = getState();
    if (!state.campaign) state.campaign = {};
    if (!state.campaign.state) state.campaign.state = {};
    if (!state.campaign.state.vttEvents) state.campaign.state.vttEvents = [];
    
    const event = { timestamp: new Date().toISOString(), type, data };
    state.campaign.state.vttEvents.push(event);
    saveState();
    return event;
}

// ============================================================
// 👇 NEW: ADVENTURE MANAGER CROSS-LINKS
// ============================================================

// "The" active adventure, for cross-linking purposes, is whichever one
// has status 'active' — NOT Adventure Manager's own activeAdventureId
// (that just tracks whichever adventure is currently open in ITS UI,
// which may be none if that tab hasn't been visited this session).
// Reading state.adventures directly here is safe and read-only; no
// import of Adventure Manager needed just to look at data it already
// persists to shared state.
function getRunningAdventure() {
    const state = getState();
    return (state.adventures || []).find(a => a.status === 'active') || null;
}

function renderCurrentAdventurePanel() {
    const adventure = getRunningAdventure();
    if (!adventure) {
        return `
            <div class="panel">
                <h3 class="panel-title">📖 Current Adventure</h3>
                <p class="text-muted mt-1">No adventure is currently active. Start one from Adventure Manager.</p>
                <button class="btn btn-sm btn-secondary mt-1" onclick="window.openAdventureManager()">📖 Open Adventure Manager</button>
            </div>
        `;
    }

    const act = adventure.acts?.[adventure.currentAct];
    const scene = act?.scenes?.[adventure.currentScene];
    const sceneCount = adventure.acts?.reduce((acc, a) => acc + (a.scenes?.length || 0), 0) || 0;
    const completedScenes = adventure.acts?.reduce((acc, a) => acc + (a.scenes?.filter(s => s.completed).length || 0), 0) || 0;

    return `
        <div class="panel" style="border-left: 4px solid var(--gold);">
            <div class="flex-between">
                <h3 class="panel-title">📖 ${escHtml(adventure.title)}</h3>
                <span class="text-xs text-muted">${completedScenes}/${sceneCount} scenes</span>
            </div>
            ${act && scene ? `
                <div class="text-sm mt-1"><span class="text-muted">Act:</span> ${escHtml(act.title)}</div>
                <div class="text-sm"><span class="text-muted">Scene:</span> ${escHtml(scene.title)}</div>
                <div class="flex gap-1 mt-2 flex-wrap">
                    <button class="btn btn-sm btn-danger" onclick="window.gmStartSceneEncounter()">⚔️ ${scene.encounterId ? 'Resume' : 'Start'} Encounter</button>
                    ${!scene.completed ? `<button class="btn btn-sm btn-primary" onclick="window.gmCompleteScene()">✓ Complete Scene</button>` : `<span class="badge badge-gold">✅ Scene Complete</span>`}
                    <button class="btn btn-sm btn-secondary" onclick="window.openAdventureManager()">📖 Full Details</button>
                </div>
            ` : `
                <p class="text-muted mt-1">This adventure has no scenes defined yet.</p>
                <button class="btn btn-sm btn-secondary mt-1" onclick="window.openAdventureManager()">📖 Open Adventure Manager</button>
            `}
        </div>
    `;
}

// 👇 NEW: GM-only "Secrets & Factions" panel for whichever adventure is
// currently active. Surfaces adventure.knowledge[] (the GM truth behind
// each secret, plus its reveal condition) and adventure.factions[] right
// where a GM running a live session is already looking — the Scene tab —
// instead of requiring a tab-switch into Adventure Manager's detail view.
// This is GM Tools' own view, so no extra role gate is needed here beyond
// what already gates the tab itself.
function renderAdventureIntelPanel(adventure) {
    if (!adventure) return '';
    const knowledge = Array.isArray(adventure.knowledge) ? adventure.knowledge : [];
    const factions = Array.isArray(adventure.factions) ? adventure.factions : [];
    if (knowledge.length === 0 && factions.length === 0) return '';

    const knowledgeHtml = knowledge.length ? `
        <div class="panel" style="border-left:2px solid var(--red);">
            <h4 style="margin:0;font-size:0.85rem;">🔒 Secrets (GM Only)</h4>
            <div style="max-height:220px;overflow-y:auto;margin-top:0.2rem;">
                ${knowledge.map(k => `
                    <div style="font-size:0.7rem;padding:0.25rem 0;border-bottom:1px solid var(--border);">
                        <div class="flex-between">
                            <span style="color:var(--gold);font-weight:600;">${escHtml(k.subject || 'Unknown')}</span>
                            <span class="${k.revealed ? 'badge badge-green' : 'badge'}" style="cursor:pointer;font-size:0.6rem;" onclick="window.gmToggleKnowledgeRevealed('${escHtml(k.id || '')}')" title="Click to mark ${k.revealed ? 'hidden' : 'revealed'}">${k.revealed ? '👁️ Revealed' : '🙈 Hidden'}</span>
                        </div>
                        <div style="color:var(--text2);font-size:0.68rem;margin-top:0.1rem;">${escHtml(k.gm || '')}</div>
                        ${k.revealCondition ? `<div style="color:var(--text3);font-size:0.62rem;margin-top:0.1rem;">⤷ Reveals when: ${escHtml(k.revealCondition)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    const factionsHtml = factions.length ? `
        <div class="panel" style="border-left:2px solid var(--purple);">
            <h4 style="margin:0;font-size:0.85rem;">🏛️ Factions</h4>
            <div style="max-height:160px;overflow-y:auto;margin-top:0.2rem;">
                ${factions.map(f => `
                    <div style="font-size:0.7rem;padding:0.2rem 0;border-bottom:1px solid var(--border);">
                        <span style="font-weight:600;">${escHtml(f.name || 'Unnamed')}</span>
                        ${f.goals ? `<div style="color:var(--text2);font-size:0.65rem;">🎯 ${escHtml(f.goals)}</div>` : ''}
                        ${f.relationship ? `<div style="color:var(--text3);font-size:0.6rem;">🤝 ${escHtml(f.relationship)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    return `${knowledgeHtml}${factionsHtml}`;
}

window.gmToggleKnowledgeRevealed = async function(knowledgeId) {
    const adventure = getRunningAdventure();
    if (!adventure || !Array.isArray(adventure.knowledge)) return;
    const entry = adventure.knowledge.find(k => k.id === knowledgeId);
    if (!entry) return;
    entry.revealed = !entry.revealed;
    try {
        const advModule = await import('@features/adventure-manager/index.js');
        advModule.loadAdventuresFromState();
        advModule.saveAdventuresToState();
    } catch (e) {
        console.error('[GM Tools] Could not persist knowledge reveal:', e);
    }
    logToSession(`${entry.revealed ? '👁️' : '🙈'} Secret "${entry.subject || knowledgeId}" marked ${entry.revealed ? 'revealed' : 'hidden'} (${adventure.title})`, 'info');
    refreshView();
};

// ============================================================
// TAG INJECTOR
// ============================================================

function getSceneTags() {
    return getState().campaign?.state?.sceneTags || [];
}

function addSceneTag(tag) {
    tag = tag.toUpperCase().trim();
    if (!tag) {
        showToast('Please enter a tag name.', 'warning');
        return false;
    }
    const state = getState();
    if (!state.campaign) state.campaign = {};
    if (!state.campaign.state) state.campaign.state = {};
    if (!state.campaign.state.sceneTags) state.campaign.state.sceneTags = [];
    if (state.campaign.state.sceneTags.includes(tag)) {
        showToast(`Tag [${tag}] already active.`, 'warning');
        return false;
    }
    state.campaign.state.sceneTags.push(tag);
    saveState();
    refreshView();
    logToSession(`🏷️ Tag applied: [${tag}]`, 'info');
    showToast(`Tag [${tag}] applied.`, 'success');
    return true;
}

function removeSceneTag(tag) {
    const state = getState();
    if (!state.campaign?.state?.sceneTags) return false;
    state.campaign.state.sceneTags = state.campaign.state.sceneTags.filter(t => t !== tag);
    saveState();
    refreshView();
    logToSession(`🏷️ Tag removed: [${tag}]`, 'info');
    return true;
}

function clearSceneTags() {
    const state = getState();
    if (!state.campaign?.state?.sceneTags) return;
    state.campaign.state.sceneTags = [];
    saveState();
    refreshView();
    logToSession('🏷️ All tags cleared.', 'info');
    showToast('All tags cleared.', 'info');
}

function getTagEffects() {
    const tags = getSceneTags();
    let dvMod = 0;
    let posMod = 0;
    tags.forEach(tag => {
        switch(tag) {
            case 'WARD': dvMod += 1; break;
            case 'FIRE': posMod -= 1; break;
            case 'DARK': posMod -= 1; break;
            case 'LIGHT': posMod += 1; break;
            case 'COLD': posMod -= 1; break;
            case 'NOISY': posMod -= 1; break;
            case 'SILENT': posMod += 1; break;
            case 'CROWDED': posMod -= 1; break;
            case 'WIND': posMod += 1; break;
            case 'WET': posMod -= 1; break;
            case 'DRY': posMod += 1; break;
            case 'UNSTABLE': posMod -= 1; break;
            default: break;
        }
    });
    return { dvMod, posMod, activeTags: tags };
}

// ============================================================
// QUICK GENERATE
// ============================================================

const REGION_NAMES = {
    acasia: { first: ['Alboin', 'Authari', 'Liutprand', 'Desiderius'], surnames: ['da Ponte', 'del Ferro', 'di Rocca'], epithets: ['the Stiff', 'Bridge-Born', 'Ash-Finger'] },
    ecktoria: { first: ['Valerius', 'Jackson', 'Lucius', 'Tiberius'], surnames: ['de Urbe', 'Aquilinus', 'Lateranus'], epithets: ['the Iron', 'Flame-Touched', 'Bread-Counter'] },
    vhasia: { first: ['Valdais', 'Wymund', 'Renaud', 'Corin'], surnames: ['de la Marche', "l'Ever", 'de Lence'], epithets: ['the Unwed', 'Bell-Sworn', 'Ash-Banner'] }
    // Abbreviated for brevity, same as original file
};

function getNamesForRegion(region) {
    const key = region?.toLowerCase() || 'acasia';
    return REGION_NAMES[key] || REGION_NAMES.acasia;
}

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomName(region) {
    const names = getNamesForRegion(region);
    return {
        name: getRandomItem(names.first),
        surname: getRandomItem(names.surnames),
        epithet: getRandomItem(names.epithets)
    };
}

function getCardMeaningFromRegion(suit, rank, regionData) {
    const arr = regionData[suit];
    if (!arr || arr.length === 0) return `A complication of ${suit} arises.`;
    const seed = suit + rank;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    return arr[Math.abs(hash) % arr.length];
}

async function generateQuickNPC() {
    const region = getSelectedRegion() || 'Acasia';
    const data = getRegionData();
    if (!data) return showToast('No region data loaded.', 'error');
    
    try {
        const result = await quickDraw(2);
        if (!result) return;
        const cards = result.cards;
        const motivation = cards[0] ? getCardMeaningFromRegion(cards[0].suit, cards[0].rank, data) : 'A matter of loyalty arises.';
        const complication = cards[1] ? getCardMeaningFromRegion(cards[1].suit, cards[1].rank, data) : 'No complication.';
        const names = generateRandomName(region);
        lastQuickGenResult = {
            type: 'npc',
            data: {
                name: `${names.name} ${names.surname}`,
                role: names.epithet,
                motivation: `${motivation} Complication: ${complication}`
            }
        };
        displayQuickGenResult(renderNPC({ ...names, motivation, complication }));
        logToSession(`👤 Generated NPC: ${names.name} "${names.epithet}"`, 'success');
    } catch (err) {
        showToast('Error generating NPC.', 'error');
    }
}

async function generateQuickLocation() {
    const region = getSelectedRegion() || 'Acasia';
    const data = getRegionData();
    if (!data) return showToast('No region data loaded.', 'error');
    
    try {
        const result = await quickDraw(2);
        if (!result) return;
        const cards = result.cards;
        const place = cards[0] ? getCardMeaningFromRegion(cards[0].suit, cards[0].rank, data) : 'A place of significance.';
        const leverage = cards[1] ? getCardMeaningFromRegion(cards[1].suit, cards[1].rank, data) : 'A hidden opportunity.';
        const name = place.length > 30 ? place.substring(0, 30) + '...' : place;
        lastQuickGenResult = {
            type: 'location',
            data: {
                name,
                description: `${place} Leverage: ${leverage}`
            }
        };
        displayQuickGenResult(renderLocation({ name, place, leverage, region }));
        logToSession(`📍 Generated Location: ${name}`, 'success');
    } catch (err) {
        showToast('Error generating location.', 'error');
    }
}

async function generateQuickRumor() {
    const region = getSelectedRegion() || 'Acasia';
    const data = getRegionData();
    if (!data) return showToast('No region data loaded.', 'error');
    
    try {
        const result = await quickDraw(1);
        if (!result) return;
        const card = result.cards[0];
        const meaning = card ? getCardMeaningFromRegion(card.suit, card.rank, data) : 'A rumor is circulating.';
        lastQuickGenResult = {
            type: 'rumor',
            data: { text: meaning, region }
        };
        displayQuickGenResult(renderRumor({ text: meaning, region }));
        logToSession(`📜 Generated Rumor: ${meaning.substring(0, 50)}...`, 'info');
    } catch (err) {
        showToast('Error generating rumor.', 'error');
    }
}

function renderNPC(npc) {
    return `
        <div class="flex flex-col gap-1">
            <strong class="text-gold">${npc.name} ${npc.surname}</strong>
            <em class="text-muted">“${npc.epithet}”</em>
            <div class="text-sm mt-1"><span class="text-muted">🎯 Motivation:</span> ${npc.motivation}</div>
            <div class="text-sm"><span class="text-muted">⚡ Complication:</span> ${npc.complication}</div>
            <button class="btn btn-xs btn-primary mt-1" style="align-self:flex-start;" onclick="window.gmSaveQuickGenToAdventure()">📌 Save to Adventure</button>
        </div>
    `;
}

function renderLocation(loc) {
    return `
        <div class="flex flex-col gap-1">
            <strong class="text-gold">📍 ${loc.name}</strong>
            <div class="text-sm text-muted">Region: ${loc.region}</div>
            <div class="text-sm mt-1"><span class="text-muted">Place:</span> ${loc.place}</div>
            <div class="text-sm"><span class="text-muted">Leverage:</span> ${loc.leverage}</div>
            <button class="btn btn-xs btn-primary mt-1" style="align-self:flex-start;" onclick="window.gmSaveQuickGenToAdventure()">📌 Save to Adventure</button>
        </div>
    `;
}

function renderRumor(rumor) {
    return `
        <div class="flex flex-col gap-1">
            <div class="text-sm italic">“${rumor.text}”</div>
            <div class="text-xs text-muted">Region: ${rumor.region}</div>
            <button class="btn btn-xs btn-primary mt-1" style="align-self:flex-start;" onclick="window.gmSaveQuickGenToAdventure()">📌 Save to Adventure Notes</button>
        </div>
    `;
}

function displayQuickGenResult(html) {
    const el = document.getElementById('quick-gen-result');
    if (el) {
        el.innerHTML = html;
        el.style.borderLeftColor = 'var(--gold)';
    }
}

// ============================================================
// AUTOMATION: AUTO-TICK & SB BANK
// ============================================================

// Get the active adventure's timers (stored in state.timers and linked via timerIds)
function getActiveAdventureTimers() {
    const adventure = getRunningAdventure();
    if (!adventure || !adventure.timerIds || adventure.timerIds.length === 0) return [];
    const state = getState();
    const timers = state.timers || [];
    return timers.filter(t => adventure.timerIds.includes(t.id));
}

// Tick the timers of the active adventure by the given amount
function tickActiveSceneTimer(adventureId, amount = 1) {
    const adventure = getRunningAdventure();
    if (!adventure) {
        console.warn('[GM Tools] No active adventure to tick timers.');
        return false;
    }
    if (adventure.id !== adventureId) {
        // In case we get an adventureId from the event, but the active adventure may have changed
        // We'll still use the active one, but log a warning.
        console.warn('[GM Tools] Tick requested for adventure ' + adventureId + ' but active is ' + adventure.id);
    }
    const timers = getActiveAdventureTimers();
    if (timers.length === 0) {
        console.warn('[GM Tools] No timers linked to active adventure.');
        return false;
    }
    let ticked = false;
    timers.forEach(timer => {
        const before = timer.current;
        timer.current = Math.min(timer.current + amount, timer.segments);
        if (timer.current !== before) {
            ticked = true;
            // Update the timer in state
            const state = getState();
            const idx = state.timers.findIndex(t => t.id === timer.id);
            if (idx !== -1) state.timers[idx] = timer;
            saveState();
            // Check completion
            if (timer.current >= timer.segments) {
                showToast(`⏱️ Timer "${timer.name}" completed!`, 'warning');
                logToSession(`⏱️ Timer "${timer.name}" completed!`, 'warning');
                // Optionally, dispatch an event for the adventure manager to handle scene transitions
                document.dispatchEvent(new CustomEvent('timer-completed', { detail: { timerId: timer.id, adventureId: adventure.id } }));
            }
        }
    });
    if (ticked) {
        // Refresh the view to update progress bars
        refreshView();
        // Also show a toast for the tick
        showToast(`⏱️ Timers ticked (${amount}) for "${adventure.title}"`, 'info');
    }
    return ticked;
}

// Handle "timer-tick-request" events
function onTimerTickRequest(event) {
    const gmState = getGmState();
    if (!gmState.autoTickTimers) return; // Auto-tick disabled

    const { adventureId, amount = 1 } = event.detail || {};
    const activeAdventure = getRunningAdventure();
    if (!activeAdventure) {
        console.warn('[GM Tools] Timer tick requested but no active adventure.');
        return;
    }
    // Use the provided adventureId or fallback to active adventure id
    const targetId = adventureId || activeAdventure.id;
    tickActiveSceneTimer(targetId, amount);
}

// Handle "sb-generated" events
function onSbGenerated(event) {
    const { count = 1 } = event.detail || {};
    const gmState = getGmState();
    const newTotal = (gmState.sbBank || 0) + count;
    updateGmState({ sbBank: newTotal });
    showToast(`🎲 Story Beat +${count} (Total: ${newTotal})`, 'info');
    logToSession(`🎲 Story Beat +${count} (Bank: ${newTotal})`, 'success');
}

// Set up event listeners (call once)
function initAutomationListeners() {
    document.addEventListener('timer-tick-request', onTimerTickRequest);
    document.addEventListener('sb-generated', onSbGenerated);
    console.log('[GM Tools] Automation listeners initialized.');
}

// ============================================================
// RENDER
// ============================================================

function render(el) {
    container = el;
    loadCampaignData();

    // BUGFIX: was `state.sessionId || 'local-' + Date.now().toString(36)`,
    // which minted a fresh random id every time this render() ran (i.e.
    // every visit to GM Tools) since state.sessionId was never actually
    // assigned. See getStableClientId() in core/state.js for why that
    // desynced the recording HUD's start/stop tracking and could leave it
    // stuck showing "Someone is recording" after navigating away and back.
    const userId = getStableClientId();
    initMediaModule(userId);

    // Init automation listeners (only once)
    if (!window.__gmAutomationInitialized) {
        initAutomationListeners();
        window.__gmAutomationInitialized = true;
    }

    // ─── Use feature-toggles for view-only detection ──────────────
    const { accessible, reason } = getFeatureAccess('gm-tools');
    const isViewOnly = !accessible;

    container.innerHTML = `
        <div class="gm-tools-modern-layout flex flex-col gap-2">
            <header class="gm-tools-header">
                <h1 class="page-title">⚙️ GM Tools</h1>
                <p class="page-sub">Manage scenes, campaign tracking, whiteboard, Kanban board, and journey planning.</p>
                ${isViewOnly ? `<div class="text-muted text-sm" style="color:var(--gold);">👁️ View-only mode: ${reason === 'gm-only' ? 'Only the GM can access these tools.' : 'You have hidden this feature from your sidebar.'}</div>` : ''}
                <div class="flex gap-1 flex-center flex-wrap mt-1">
                    <span class="text-sm text-muted">📍 Region:</span>
                    <select id="gm-region-select" aria-label="Region for deck draws and quick generation" style="max-width:220px;" ${isViewOnly ? 'disabled' : ''}>
                        <option value="">Loading regions…</option>
                    </select>
                    <span class="text-muted text-xs">Shared with the Deck of Consequences.</span>
                </div>
            </header>

            <div class="flex gap-1 flex-center flex-wrap" style="border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                <button class="btn btn-sm btn-gold gm-tab active" data-view="scene">🎬 Scene</button>
                <button class="btn btn-sm btn-secondary gm-tab" data-view="kanban">📋 Kanban</button>
                <button class="btn btn-sm btn-secondary gm-tab" data-view="whiteboard">✏️ Whiteboard</button>
                <button class="btn btn-sm btn-secondary gm-tab" data-view="campaign">🏛️ Campaign</button>
                <button class="btn btn-sm btn-secondary gm-tab" data-view="consequences">🃏 Consequences</button>
                <button class="btn btn-sm btn-secondary gm-tab" data-view="travel">🗺️ Travel</button>
                <button class="btn btn-sm btn-secondary gm-tab" data-view="session">🎥 Session</button>
            </div>

            <div id="gm-view-container" class="flex flex-col gap-2">
                ${renderView('scene')}
            </div>
        </div>
    `;

    attachEvents();
    // Region discovery is async and must not block the first paint: the
    // header select renders as "Loading regions…" and is filled in when
    // this resolves. Doing it here (rather than only on the Consequences
    // tab) is the point — Quick Generate on the Scene tab needs a region
    // too, and used to get whatever null fell back to.
    initRegionControls();
}

function renderView(view) {
    activeTab = view;
    // Reload data when switching views
    loadCampaignData();
    switch(view) {
        case 'scene': return renderSceneView();
        case 'kanban': return renderKanbanView();
        case 'whiteboard': return renderWhiteboardView();
        case 'campaign': return renderCampaignView();
        case 'consequences': return renderConsequencesView();
        case 'travel': return renderTravelView();
        case 'session': return renderSessionView();
        default: return renderSceneView();
    }
}

// ============================================================
// SAFETY TOOLS
// ============================================================

function getCampaignSafety() {
    const state = getState();
    if (!state.campaign) state.campaign = {};
    if (!state.campaign.safety) state.campaign.safety = { lines: '', veils: '', sessionZero: {} };
    return state.campaign.safety;
}

function saveCampaignSafety(updates) {
    const state = getState();
    if (!state.campaign) state.campaign = {};
    if (!state.campaign.safety) state.campaign.safety = { lines: '', veils: '', sessionZero: {} };
    Object.assign(state.campaign.safety, updates);
    saveState();
    refreshView();
}

function renderSafetyToolsPanel() {
    const safety = getCampaignSafety();
    return `
        <div class="panel">
            <h3 class="panel-title">🛡️ Safety Tools</h3>
            <p class="text-muted text-sm">Set your group's safety boundaries. These will be shown when the X‑Card is called.</p>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.5rem;">
                <div>
                    <label style="font-size:0.8rem;font-weight:600;">Lines (never to appear)</label>
                    <textarea id="safety-lines" rows="2" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;font-size:0.8rem;">${escHtml(safety.lines || '')}</textarea>
                    <span class="text-muted text-xs">Things that are absolutely off-limits.</span>
                </div>
                <div>
                    <label style="font-size:0.8rem;font-weight:600;">Veils (fade to black)</label>
                    <textarea id="safety-veils" rows="2" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;font-size:0.8rem;">${escHtml(safety.veils || '')}</textarea>
                    <span class="text-muted text-xs">Things that can happen off-screen.</span>
                </div>
            </div>

            <button class="btn btn-sm btn-primary mt-1" id="safety-save-btn">💾 Save Safety Settings</button>

            <details style="margin-top:0.5rem;">
                <summary style="cursor:pointer;font-size:0.8rem;color:var(--text2);">📋 Session Zero Checklist</summary>
                <div style="padding:0.5rem 0.3rem;font-size:0.8rem;">
                    ${renderSessionZeroChecklist(safety.sessionZero || {})}
                </div>
            </details>
        </div>
    `;
}

function renderSessionZeroChecklist(sessionZero) {
    const fields = [
        { id: 'tone', label: 'Tone of the campaign', placeholder: 'e.g., heroic, grim, mysterious' },
        { id: 'length', label: 'Campaign length', placeholder: 'e.g., one-shot, 6 sessions, ongoing' },
        { id: 'characterHooks', label: 'Character hooks', placeholder: 'What themes are you excited to explore?' },
    ];
    return fields.map(f => `
        <div style="margin-bottom:0.3rem;">
            <label style="font-size:0.75rem;">${escHtml(f.label)}</label>
            <input type="text" id="sz-${f.id}" value="${escHtml(sessionZero[f.id] || '')}" placeholder="${escHtml(f.placeholder)}" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.2rem 0.4rem;font-size:0.8rem;" />
        </div>
    `).join('') + `
        <div style="margin-bottom:0.3rem;">
            <label class="inline-check" style="font-size:0.75rem;">
                <input type="checkbox" id="sz-consent" ${sessionZero.consent ? 'checked' : ''} />
                I have discussed consent with the group.
            </label>
        </div>
        <button class="btn btn-xs btn-secondary" id="sz-save-btn">Save Session Zero</button>
    `;
}
// ============================================================
// SOUNDBOARD (ambience loop + one-shot SFX)
// ============================================================

function renderSoundboardPanel(isViewOnly) {
    const tracks = getSoundTracks();
    const ambienceTracks = tracks.filter(t => t.type === 'ambience');
    const sfxTracks = tracks.filter(t => t.type === 'sfx');
    const currentAmbienceId = getCurrentAmbienceId();

    const ambienceOptions = ambienceTracks.map(t =>
        `<option value="${t.id}" ${t.id === currentAmbienceId ? 'selected' : ''}>${escHtml(t.name)}</option>`
    ).join('');

    const sfxButtons = sfxTracks.map(t => {
        const attrTitle = t.attribution ? ` \u2014 attribution: ${escHtml(t.attribution.author)} (${escHtml(t.attribution.license)})` : '';
        return `
        <span style="display:inline-flex;align-items:center;gap:0.2rem;background:var(--bg3);border:1px solid var(--border);border-radius:999px;padding:0.2rem 0.3rem 0.2rem 0.6rem;font-size:0.78rem;">
            <button type="button" class="btn-sound-sfx" data-id="${t.id}" style="background:none;border:none;color:var(--text);cursor:pointer;font-size:0.78rem;padding:0;" ${isViewOnly ? 'disabled' : ''} title="${escHtml(t.name)}${attrTitle}">🔊 ${escHtml(t.name)}${t.attribution ? ' ⚠' : ''}</button>
            <button type="button" class="btn-sound-remove" data-id="${t.id}" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:0.72rem;padding:0 0.2rem;" ${isViewOnly ? 'disabled' : ''} title="Remove">✕</button>
        </span>
    `;
    }).join('');

    return `
        <div class="panel">
            <h3 class="panel-title">🔊 Soundboard</h3>
            <div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.3rem;">
                <div>
                    <label style="font-size:0.75rem;color:var(--text2);">Ambience (loops)</label>
                    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;margin-top:0.2rem;">
                        <select id="sb-ambience-select" style="flex:1;min-width:140px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.2rem 0.4rem;font-size:0.8rem;" ${isViewOnly ? 'disabled' : ''}>
                            <option value="">${ambienceTracks.length ? '— choose ambience —' : 'No ambience tracks yet'}</option>
                            ${ambienceOptions}
                        </select>
                        <button class="btn btn-xs btn-secondary" id="sb-ambience-play" ${isViewOnly ? 'disabled' : ''}>▶ Play</button>
                        <button class="btn btn-xs btn-secondary" id="sb-ambience-stop" ${isViewOnly || !currentAmbienceId ? 'disabled' : ''}>⏹ Stop</button>
                    </div>
                    ${(() => {
                        const playing = ambienceTracks.find(t => t.id === currentAmbienceId);
                        if (!playing?.attribution) return '';
                        const a = playing.attribution;
                        return `<div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">⚠ Attribution: <a href="${a.url}" target="_blank" rel="noopener noreferrer" style="color:var(--text2);">${escHtml(a.author)}</a> &middot; ${escHtml(a.license)}</div>`;
                    })()}
                </div>
                <div>
                    <label style="font-size:0.75rem;color:var(--text2);">SFX (one-shot)</label>
                    <div id="sb-sfx-list" style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.2rem;">
                        ${sfxButtons || '<span style="font-size:0.75rem;color:var(--text3);">No SFX yet.</span>'}
                    </div>
                </div>
                <div class="flex" style="gap:0.4rem;">
                    <button class="btn btn-xs btn-secondary" id="sb-add-sound-btn" ${isViewOnly ? 'disabled' : ''}>+ Add Sound</button>
                    <button class="btn btn-xs btn-gold" id="sb-search-sound-btn" ${isViewOnly ? 'disabled' : ''}>🔎 Search Sounds</button>
                </div>
            </div>
        </div>
    `;
}

function handleOpenSoundSearch() {
    import('./sound-search.js').then(module => {
        module.openSoundSearchModal({ onChange: refreshView });
    }).catch(err => {
        console.error('Failed to load sound search:', err);
        showToast('Sound search not available.', 'error');
    });
}

function handleAddSound() {
    const name = prompt('Sound name (e.g. "Tavern murmur", "Sword clash"):');
    if (!name || !name.trim()) return;
    const url = prompt('Audio URL (mp3/ogg/wav link):');
    if (!url || !url.trim()) return;
    const isAmbience = confirm('Is this a looping AMBIENCE track?\n\nOK = Ambience (loops)\nCancel = one-shot SFX');
    addSoundTrack({ name: name.trim(), url: url.trim(), type: isAmbience ? 'ambience' : 'sfx' });
    showToast(`🔊 Added "${name.trim()}" to the soundboard.`, 'success');
    refreshView();
}

function attachSoundboardEvents() {
    document.getElementById('sb-add-sound-btn')?.addEventListener('click', handleAddSound);
    document.getElementById('sb-search-sound-btn')?.addEventListener('click', handleOpenSoundSearch);

    document.getElementById('sb-ambience-play')?.addEventListener('click', () => {
        const id = document.getElementById('sb-ambience-select')?.value;
        if (!id) { showToast('Choose an ambience track first.', 'warning'); return; }
        playAmbience(id);
        refreshView();
    });
    document.getElementById('sb-ambience-stop')?.addEventListener('click', () => {
        stopAmbience();
        refreshView();
    });

    document.querySelectorAll('.btn-sound-sfx').forEach(btn => {
        btn.addEventListener('click', () => playSfx(btn.dataset.id));
    });
    document.querySelectorAll('.btn-sound-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            removeSoundTrack(btn.dataset.id);
            refreshView();
        });
    });
}

// ============================================================
// SCENE VIEW
// ============================================================

function renderSceneView() {
    const state = getState();
    const activeTimers = state.timers || [];
    const activeEncounters = state.encounters || [];
    const characters = state.characters || [];
    const tagEffects = getTagEffects();
    const gmState = getGmState();
    const autoTick = gmState.autoTickTimers || false;
    const { accessible } = getFeatureAccess('gm-tools');
    const isViewOnly = !accessible;

    return `
        <div class="flex flex-col gap-2">
            ${renderCurrentAdventurePanel()}
            ${renderAdventureIntelPanel(getRunningAdventure())}

            <div class="panel">
                <h3 class="panel-title">⚙️ GM Settings</h3>
                <div class="flex gap-1 flex-center flex-wrap mt-1">
                    <label class="inline-check" style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                        <input type="checkbox" id="auto-tick-toggle" ${autoTick ? 'checked' : ''} ${isViewOnly ? 'disabled' : ''} />
                        <span>Auto-tick active timers on Partial/Miss</span>
                    </label>
                    <span class="text-muted text-xs">(Story Beats auto‑increment the SB Bank)</span>
                </div>
            </div>
            ${renderSafetyToolsPanel()}
            <div class="panel">
                <h3 class="panel-title">⚡ Quick Actions</h3>
                <div class="grid-2 mt-1">
                    <button class="btn btn-secondary" onclick="window.sceneEndTrimBoons()" ${isViewOnly ? 'disabled' : ''}>✂️ Trim Boons</button>
                    <button class="btn btn-secondary" onclick="window.resetAllTimers()" ${isViewOnly ? 'disabled' : ''}>⏱️ Reset Timers</button>
                    <button class="btn btn-secondary" onclick="window.newSession()" ${isViewOnly ? 'disabled' : ''}>📦 New Session</button>
                    <button class="btn btn-secondary" onclick="window.openCombatTracker()" ${isViewOnly ? 'disabled' : ''}>⚔️ Combat Tracker</button>
                    <button class="btn btn-secondary" onclick="window.openKanban()">📋 Kanban Board</button>
                    <button class="btn btn-secondary" onclick="window.openWhiteboard()">✏️ Whiteboard</button>
                    <button class="btn btn-secondary" onclick="window.openCrownSpread()">👑 Crown Spread</button>
                    <button class="btn btn-secondary" onclick="window.openTravelPlanner()">🗺️ Travel Planner</button>
                </div>
            </div>

            ${renderSoundboardPanel(isViewOnly)}

            <div class="panel">
                <h3 class="panel-title">⚡ Quick Generate</h3>
                <div class="flex gap-1 flex-center flex-wrap mt-1">
                    <button class="btn btn-sm btn-gold" id="gen-npc-btn" ${isViewOnly ? 'disabled' : ''}>👤 NPC</button>
                    <button class="btn btn-sm btn-gold" id="gen-location-btn" ${isViewOnly ? 'disabled' : ''}>📍 Location</button>
                    <button class="btn btn-sm btn-gold" id="gen-rumor-btn" ${isViewOnly ? 'disabled' : ''}>📜 Rumor</button>
                    <span class="text-muted text-sm mx-auto">Uses the region selected above</span>
                </div>
                <div id="quick-gen-result" class="mt-1 panel" style="background:var(--bg3); border-left: 3px solid var(--border);">
                    <span class="text-muted text-sm">Generate an NPC, Location, or Rumor.</span>
                </div>
            </div>

            <div class="panel">
                <h3 class="panel-title">🏷️ Scene Tags</h3>
                <div class="flex gap-1 flex-center flex-wrap mt-1">
                    <input type="text" id="scene-tag-input" placeholder="e.g., WARD, FIRE, DARK" class="flex-1" style="min-width: 120px;" ${isViewOnly ? 'disabled' : ''} />
                    <button class="btn btn-sm btn-primary" id="scene-tag-add-btn" ${isViewOnly ? 'disabled' : ''}>+ Add Tag</button>
                    <button class="btn btn-sm btn-secondary" id="scene-tag-clear-btn" ${isViewOnly ? 'disabled' : ''}>Clear All</button>
                </div>
                <div id="scene-tag-container" class="flex gap-1 flex-wrap mt-1">
                    ${tagEffects.activeTags.length === 0 ? '<span class="text-muted text-sm">No tags active.</span>' : ''}
                    ${tagEffects.activeTags.map(tag => `
                        <span class="badge badge-gold flex gap-1 flex-center">[${tag}] <span class="gm-tag-remove" data-tag="${tag}" style="cursor:pointer;color:var(--red);font-size:0.7rem;">✕</span></span>
                    `).join('')}
                </div>
                ${tagEffects.activeTags.length > 0 ? `
                    <div class="text-xs text-muted mt-1 flex gap-1 flex-wrap">
                        ${tagEffects.dvMod !== 0 ? `<span class="badge badge-red">DV ${tagEffects.dvMod > 0 ? '+' : ''}${tagEffects.dvMod}</span>` : ''}
                        ${tagEffects.posMod !== 0 ? `<span class="badge badge-blue">Pos ${tagEffects.posMod > 0 ? '+' : ''}${tagEffects.posMod}</span>` : ''}
                    </div>
                ` : ''}
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">⏱️ Active Timers</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addTimerFromScene()" ${isViewOnly ? 'disabled' : ''}>+ Add Timer</button>
                </div>
                ${activeTimers.length === 0 ? '<p class="text-muted mt-1">No active timers.</p>' : `
                    <div class="flex flex-col gap-1 mt-1">
                        ${activeTimers.map(t => `
                            <div class="flex gap-1 flex-center">
                                <span class="flex-1 text-sm">${escHtml(t.name)}</span>
                                <div class="timer-progress flex-1" style="background:var(--bg3); border-radius:var(--radius); height:8px; overflow:hidden;">
                                    <div style="width:${(t.current / t.segments) * 100}%; height:100%; background:var(--gold);"></div>
                                </div>
                                <span class="text-xs text-muted">${t.current}/${t.segments}</span>
                                <button class="btn btn-xs btn-ghost" onclick="window.tickTimer('${t.id}')" ${isViewOnly ? 'disabled' : ''}>+1</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">⚔️ Active Encounters</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addEncounterFromScene()" ${isViewOnly ? 'disabled' : ''}>+ Add Encounter</button>
                </div>
                ${activeEncounters.length === 0 ? '<p class="text-muted mt-1">No active encounters.</p>' : `
                    <div class="flex flex-col gap-1 mt-1">
                        ${activeEncounters.map(e => `
                            <div class="flex gap-1 flex-center">
                                <span class="flex-1 text-sm">${escHtml(e.name)}</span>
                                ${e.fromAdventureTitle ? `<span class="badge badge-purple" title="From scene: ${escHtml(e.fromSceneTitle || '')}">📖 ${escHtml(e.fromAdventureTitle)}</span>` : ''}
                                <span class="badge badge-red">${e.status || 'active'}</span>
                                <button class="btn btn-xs btn-primary" onclick="window.openEncounterTracker('${e.id}')" ${isViewOnly ? 'disabled' : ''}>⚔️ Track</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <div class="panel">
                <h3 class="panel-title">👤 Characters</h3>
                <div class="flex flex-wrap gap-1 mt-1">
                    ${characters.map(c => `
                        <div class="panel flex gap-1 flex-center" style="padding: 0.3rem 0.6rem; background: var(--bg3);">
                            <span class="text-sm">${escHtml(c.name)}</span>
                            <span class="badge badge-gold">🪙 ${c.boons || 0}</span>
                            <span class="badge badge-purple">⚡ ${c.fatigue || 0}</span>
                        </div>
                    `).join('')}
                    ${characters.length === 0 ? '<p class="text-muted">No characters loaded.</p>' : ''}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// KANBAN VIEW
// ============================================================

function renderKanbanView() {
    const columns = kanbanData.columns;
    return `
        <div class="kanban-view">
            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">📋 Campaign Kanban</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.gmAddKanbanItem()">+ Add Item</button>
                </div>
                <div class="grid-2 mt-1">
                    ${Object.entries(columns).map(([key, col]) => `
                        <div class="panel" data-column="${key}" style="background:var(--bg3); min-height: 150px;">
                            <div class="panel-title text-sm">${col.title}</div>
                            <div class="flex flex-col gap-1 mt-1">
                                ${col.items.length === 0 ? '<p class="text-muted text-xs">Empty</p>' : ''}
                                ${col.items.map((item, idx) => `
                                    <div class="panel" data-column="${key}" data-index="${idx}" style="padding: 0.5rem; background: var(--bg2); border-left: 3px solid var(--gold);">
                                        <div class="text-sm font-bold">${escHtml(item.title)}</div>
                                        ${item.description ? `<div class="text-xs text-muted mt-1">${escHtml(item.description)}</div>` : ''}
                                        <div class="flex gap-1 mt-1 flex-center">
                                            <button class="btn btn-xs btn-ghost" onclick="window.gmMoveKanbanItem('${key}', ${idx}, -1)">←</button>
                                            <button class="btn btn-xs btn-ghost" onclick="window.gmMoveKanbanItem('${key}', ${idx}, 1)">→</button>
                                            <button class="btn btn-xs btn-danger ml-auto" onclick="window.gmRemoveKanbanItem('${key}', ${idx})">✕</button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// WHITEBOARD VIEW
// ============================================================

function renderWhiteboardView() {
    return `
        <div class="panel flex-center" style="min-height: 200px;">
            <div class="text-center">
                <div style="font-size:2rem;margin-bottom:0.5rem;">⏳</div>
                <p class="text-muted">Loading whiteboard...</p>
            </div>
        </div>
    `;
}

// ============================================================
// CAMPAIGN VIEW
// ============================================================

function renderCampaignView() {
    const saved = getState();
    const campaign = saved.campaign?.state || { activeThreats: [], opportunities: [], campaignTimers: [], notes: '', sessionLog: [] };
    const threats = campaign.activeThreats || [];
    const opportunities = campaign.opportunities || [];
    const timers = campaign.campaignTimers || [];
    const sessionLog = campaign.sessionLog || [];

    return `
        <div class="flex flex-col gap-2">
            <div class="panel">
                <h3 class="panel-title">📝 Campaign Notes</h3>
                <textarea id="campaign-notes" rows="4" class="mt-1">${escHtml(campaign.notes || '')}</textarea>
                <button class="btn btn-sm btn-primary mt-1" onclick="window.saveCampaignNotes()">💾 Save Notes</button>
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">⚠️ Active Threats</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addCampaignThreat()">+ Add Threat</button>
                </div>
                ${threats.length === 0 ? '<p class="text-muted mt-1">No active threats.</p>' : `
                    <div class="flex flex-col gap-1 mt-1">
                        ${threats.map((t, idx) => `
                            <div class="panel" style="padding: 0.5rem; background: var(--bg3); border-left: 4px solid ${t.severity === 'high' ? 'var(--red)' : t.severity === 'medium' ? 'var(--orange)' : 'var(--gold)'};">
                                <div class="flex gap-1 flex-center">
                                    <span class="text-sm flex-1">${escHtml(t.name)}</span>
                                    <span class="badge ${t.severity === 'high' ? 'badge-red' : 'badge-gold'}">${t.severity || 'medium'}</span>
                                    <button class="btn btn-xs btn-danger" onclick="window.removeCampaignThreat(${idx})">✕</button>
                                </div>
                                ${t.description ? `<div class="text-xs text-muted mt-1">${escHtml(t.description)}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">🌟 Opportunities</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addCampaignOpportunity()">+ Add Opportunity</button>
                </div>
                ${opportunities.length === 0 ? '<p class="text-muted mt-1">No opportunities tracked.</p>' : `
                    <div class="flex flex-col gap-1 mt-1">
                        ${opportunities.map((o, idx) => `
                            <div class="flex gap-1 flex-center panel" style="padding: 0.5rem; background: var(--bg3); border-left: 4px solid var(--green);">
                                <span class="text-sm flex-1">${escHtml(o.name)}</span>
                                <button class="btn btn-xs btn-danger" onclick="window.removeCampaignOpportunity(${idx})">✕</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">⏱️ Campaign Timers</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addCampaignTimer()">+ Add Timer</button>
                </div>
                ${timers.length === 0 ? '<p class="text-muted mt-1">No campaign timers.</p>' : `
                    <div class="flex flex-col gap-1 mt-1">
                        ${timers.map((t, idx) => `
                            <div class="flex gap-1 flex-center">
                                <span class="text-sm flex-1">${escHtml(t.name)}</span>
                                <span class="text-xs text-muted">${t.current}/${t.segments}</span>
                                <button class="btn btn-xs btn-primary" onclick="window.tickCampaignTimer(${idx})">+1</button>
                                <button class="btn btn-xs btn-danger" onclick="window.removeCampaignTimer(${idx})">✕</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">📋 Session Log</h3>
                    <div class="flex gap-1">
                        <button class="btn btn-sm btn-secondary" onclick="window.copySessionLog()">📋 Copy</button>
                        <button class="btn btn-sm btn-danger" onclick="window.clearSessionLog()">🗑️ Clear</button>
                    </div>
                </div>
                <div id="session-log-container" class="mt-1 panel" style="max-height:250px; overflow-y:auto; background:var(--bg2); padding: 0.5rem; font-family: var(--font-mono); font-size: 0.85rem;">
                    ${sessionLog.length === 0 ? '<span class="text-muted text-sm">No events logged yet.</span>' : 
                        sessionLog.map(entry => `
                            <div style="padding:0.2rem 0;border-bottom:1px solid var(--border);display:flex;gap:0.5rem;">
                                <span class="text-muted" style="white-space:nowrap;">[${entry.time}]</span>
                                <span style="color:${entry.type === 'success' ? 'var(--green)' : entry.type === 'warning' ? 'var(--orange)' : entry.type === 'danger' ? 'var(--red)' : 'var(--text)'};">${entry.message}</span>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// CONSEQUENCES VIEW
// ============================================================

function renderConsequencesView() {
    const regionNames = getRegionNames() || ['Acasia'];
    const selectedRegion = getSelectedRegion() || 'Acasia';
    
    return `
        <div class="flex flex-col gap-2">
            <div class="panel">
                <h3 class="panel-title">🃏 Deck of Consequences</h3>
                <p class="text-muted text-sm">Draw cards from the Deck of Consequences or use the Crown Spread.</p>
                
                <div class="flex gap-1 flex-center flex-wrap mt-1 panel" style="background:var(--bg3); border-left: 3px solid var(--gold);">
                    <span class="text-sm text-muted">📍 Region:</span>
                    <select id="scene-consequences-region-select" class="flex-1" style="max-width: 200px;">
                        ${regionNames.map(name => `<option value="${name}" ${name === selectedRegion ? 'selected' : ''}>${name}</option>`).join('')}
                    </select>
                </div>
                
                <div class="flex gap-1 flex-wrap mt-2">
                    <button class="btn btn-sm btn-gold" onclick="window.quickDrawConsequence(1)">🃏 Draw 1</button>
                    <button class="btn btn-sm btn-gold" onclick="window.quickDrawConsequence(2)">🃏 Draw 2</button>
                    <button class="btn btn-sm btn-gold" onclick="window.quickDrawConsequence(3)">🃏 Draw 3</button>
                    <button class="btn btn-sm btn-primary" onclick="window.quickCrownSpreadFromScene()">👑 Crown Spread</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.shuffleDeck()">🔀 Shuffle</button>
                </div>
                
                <div id="consequence-result" class="mt-2 panel" style="min-height:80px; background:var(--bg3);">
                    <p class="text-muted text-sm">Draw cards to see a consequence.</p>
                </div>
                
                <div id="crown-spread-result" style="margin-top:1rem;display:none;" class="panel" style="border: 2px solid var(--gold);">
                    <h4 class="text-gold">👑 Crown Spread</h4>
                    <div id="crown-spread-cards" class="flex gap-1 flex-wrap flex-center mt-1"></div>
                    <div id="crown-spread-interpretation" class="text-muted mt-1 text-sm"></div>
                </div>
            </div>
            
            <div class="panel">
                <h3 class="panel-title">📋 Quick Reference</h3>
                <div class="grid-2 mt-1">
                    <div class="panel" style="background:var(--bg3); border-left: 3px solid var(--gold);">
                        <strong class="text-gold">1 SB</strong>
                        <div class="text-sm text-muted mt-1">Minor pressure, noise, tick timer +1</div>
                    </div>
                    <div class="panel" style="background:var(--bg3); border-left: 3px solid var(--orange);">
                        <strong style="color:var(--orange);">2 SB</strong>
                        <div class="text-sm text-muted mt-1">Moderate setback, alarm, lesser foe</div>
                    </div>
                    <div class="panel" style="background:var(--bg3); border-left: 3px solid var(--red);">
                        <strong style="color:var(--red);">3 SB</strong>
                        <div class="text-sm text-muted mt-1">Serious trouble, reinforcements, gear breaks</div>
                    </div>
                    <div class="panel" style="background:var(--bg3); border-left: 3px solid var(--purple);">
                        <strong style="color:var(--purple);">4+ SB</strong>
                        <div class="text-sm text-muted mt-1">Major turn, trap, authority arrives</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// TRAVEL VIEW
// ============================================================

function renderTravelView() {
    return `
        <div class="panel flex-center" style="min-height: 200px;">
            <div class="text-center">
                <div style="font-size:2rem;margin-bottom:0.5rem;">⏳</div>
                <p class="text-muted">Loading travel planner...</p>
                <button class="btn btn-sm btn-primary mt-2" onclick="window.loadTravelPlanner()">🔄 Load</button>
            </div>
        </div>
    `;
}

// ============================================================
// SESSION VIEW
// ============================================================

function renderSessionView() {
    const saved = getState();
    const campaign = saved.campaign?.state || { sessionLog: [], vttEvents: [] };
    const sessionLog = campaign.sessionLog || [];
    const vttEvents = campaign.vttEvents || [];
    const recordingStatus = getRecordingStatus();
    
    return `
        <div class="flex flex-col gap-2">
            <div class="panel">
                <h3 class="panel-title">🎙️ Session Recording</h3>
                <p class="text-muted text-sm">Records screen + mic as a .webm, and logs in-app events (deck draws, timers, scene changes, etc.) to a synced SRT subtitle track. Stopping the recording downloads BOTH as one .zip bundle -- drop the SRT into Premiere/Resolve/etc. as a subtitle track.</p>

                <div class="flex gap-1 flex-wrap mt-2">
                    <button class="btn btn-primary" id="session-record-btn" aria-label="Start screen and audio recording" ${recordingStatus.isRecording ? 'style="display:none;"' : ''}>🎤 Record</button>
                    <button class="btn btn-danger" id="session-stop-btn" aria-label="Stop recording" ${!recordingStatus.isRecording ? 'style="display:none;"' : ''}>⏹️ Stop</button>
                    <button class="btn btn-secondary" id="session-clear-btn">🧹 Clear Session Log</button>
                </div>
                <label class="text-sm text-muted mt-1" style="display:flex;align-items:center;gap:0.4rem;${recordingStatus.isRecording ? 'opacity:0.5;pointer-events:none;' : ''}" title="${isLiveTranscriptionSupported() ? 'Adds best-effort speech-to-text lines to the SRT using your browser\'s built-in speech recognition. Not a substitute for a real transcription tool -- see the README.' : 'Not supported in this browser -- try Chrome or Edge.'}">
                    <input type="checkbox" id="session-live-transcription" ${isLiveTranscriptionSupported() ? '' : 'disabled'} />
                    🗣️ Live transcription (experimental, best-effort -- see README)
                </label>
                <div id="session-recording-status" class="text-sm text-muted mt-1">
                    ${recordingStatus.isRecording ? `🔴 Recording... (${Math.floor(recordingStatus.duration)}s)` : 'Not recording'}
                </div>

                <h4 class="mt-2" style="font-size:0.9rem;">📦 Session Log Export</h4>
                <p class="text-muted text-sm">Separately, export the text session log + VTT event history (not the video/SRT above) as JSON -- useful for your own records or tooling, independent of whether you recorded anything.</p>
                <div class="flex gap-1 flex-wrap mt-1">
                    <button class="btn btn-secondary" id="session-export-btn">📦 Export Session Log (JSON)</button>
                </div>
            </div>
            
            <div class="panel">
                <h3 class="panel-title">📋 Session Log</h3>
                <div id="session-log-display" class="mt-1 panel" style="max-height:200px; overflow-y:auto; background:var(--bg2); padding: 0.5rem; font-family: var(--font-mono); font-size: 0.85rem;">
                    ${sessionLog.length === 0 ? '<span class="text-muted text-sm">No events logged yet.</span>' : 
                        sessionLog.map(entry => `
                            <div style="padding:0.2rem 0;border-bottom:1px solid var(--border);display:flex;gap:0.5rem;">
                                <span class="text-muted" style="white-space:nowrap;">[${entry.time}]</span>
                                <span style="color:${entry.type === 'success' ? 'var(--green)' : entry.type === 'warning' ? 'var(--orange)' : entry.type === 'danger' ? 'var(--red)' : 'var(--text)'};">${entry.message}</span>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
            
            <div class="panel">
                <h3 class="panel-title">🎬 VTT Events</h3>
                <div id="vtt-events-display" class="mt-1 panel" style="max-height:150px; overflow-y:auto; background:var(--bg2); padding: 0.5rem; font-family: var(--font-mono); font-size: 0.85rem;">
                    ${vttEvents.length === 0 ? '<span class="text-muted text-sm">No VTT events captured.</span>' : 
                        vttEvents.slice().reverse().map(evt => `
                            <div style="padding:0.2rem 0;border-bottom:1px solid var(--border);display:flex;gap:0.5rem;">
                                <span class="text-muted" style="white-space:nowrap;">[${new Date(evt.timestamp).toLocaleTimeString()}]</span>
                                <span style="color:var(--text);">${evt.type}</span>
                                ${evt.data ? `<span class="text-muted">${JSON.stringify(evt.data).substring(0, 60)}</span>` : ''}
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// EXPORT SESSION BUNDLE
// ============================================================

function exportSessionBundle() {
    const saved = getState();
    const campaign = saved.campaign?.state || { sessionLog: [], vttEvents: [] };
    
    const bundle = {
        sessionId: saved.sessionId || 'unknown',
        startTime: campaign.sessionLog.length > 0 ? campaign.sessionLog[0].timestamp : new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: campaign.sessionLog.length > 0 ? (Date.now() - new Date(campaign.sessionLog[0].timestamp).getTime()) / 1000 : 0,
        log: campaign.sessionLog,
        vttEvents: campaign.vttEvents,
        metadata: {
            campaign: saved.campaign?.name || 'Unknown Campaign',
            players: (saved.characters || []).map(c => c.name).filter(Boolean)
        }
    };
    
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Session log exported (JSON).', 'success');
    logToSession('📦 Session bundle exported.', 'success');
}

function clearSessionData() {
    if (!confirm('Clear the session log and VTT events? This does not affect recordings.')) return;
    const state = getState();
    if (state.campaign?.state) {
        state.campaign.state.sessionLog = [];
        state.campaign.state.vttEvents = [];
        saveState();
        refreshView();
        showToast('Session data cleared.', 'info');
    }
}

// ============================================================
// MODULE LOADERS
// ============================================================

async function loadKanbanModule(containerEl) {
    try {
        if (moduleCache.kanban) return moduleCache.kanban.render(containerEl);
        const module = await import('@features/kanban/index.js');
        moduleCache.kanban = module;
        module.render(containerEl);
    } catch (e) {
        containerEl.innerHTML = `<div class="panel"><h3 class="panel-title">📋 Kanban Board</h3><p class="text-muted" style="color:var(--red);">Error loading: ${e.message}</p><button class="btn btn-sm btn-primary mt-1" onclick="window.loadKanban()">🔄 Retry</button></div>`;
    }
}

async function loadWhiteboardModule(containerEl) {
    try {
        if (moduleCache.whiteboard) return moduleCache.whiteboard.render(containerEl);
        const module = await import('@features/whiteboard/index.js');
        moduleCache.whiteboard = module;
        module.render(containerEl);
    } catch (e) {
        containerEl.innerHTML = `<div class="panel"><h3 class="panel-title">✏️ Whiteboard</h3><p class="text-muted" style="color:var(--red);">Error loading: ${e.message}</p><button class="btn btn-sm btn-primary mt-1" onclick="window.loadWhiteboard()">🔄 Retry</button></div>`;
    }
}

async function loadTravelPlannerModule(containerEl) {
    try {
        if (moduleCache.travel && moduleCache.travel.render) return moduleCache.travel.render(containerEl);
        const module = await import('@features/travel-planner/index.js');
        moduleCache.travel = module;
        if (module.render) module.render(containerEl);
        else if (module.default?.render) module.default.render(containerEl);
        else containerEl.innerHTML = `<div class="panel"><h3 class="panel-title">🗺️ Travel Planner</h3><p class="text-muted">Render function not found.</p></div>`;
    } catch (e) {
        containerEl.innerHTML = `<div class="panel"><h3 class="panel-title">🗺️ Travel Planner</h3><p class="text-muted" style="color:var(--red);">Error loading: ${e.message}</p><button class="btn btn-sm btn-primary mt-1" onclick="window.loadTravelPlanner()">🔄 Retry</button></div>`;
    }
}

// ============================================================
// CONSEQUENCES VIEW EVENTS
// ============================================================

// ============================================================
// REGION
// ============================================================
//
// GM Tools does not own a region — it consumes the one the Deck of
// Consequences owns, via decks/index.js. It has its own <select> (in the
// header, so it is visible from every tab, not just Consequences) but
// that select is a VIEW of shared state, not a second copy of it.
//
// Three things were wrong before:
//
//  1. Region discovery only ran inside decks' render(). A GM who opened
//     GM Tools without first visiting Decks got getRegionNames() === []
//     and getSelectedRegion() === null, so every quick-draw fell back to
//     the string 'Acasia' and then failed on "No region data loaded."
//     ensureRegionsReady() now performs that discovery from either side.
//
//  2. setSelectedRegion() only loaded the new region's DATA if decks'
//     own <select> happened to be in the document. Changing the region
//     from GM Tools therefore moved the name and left regionData on the
//     previous region — cards drawn from GM Tools were read against the
//     wrong region's meanings, silently.
//
//  3. The only selector lived on the Consequences tab, while Quick
//     Generate (Scene tab) drew on the region too and merely asserted
//     "Uses current region's deck" with no way to see or set it.

/** Fill every region <select> GM Tools has rendered and select `current`. */
function paintRegionSelects(names, current) {
    const options = names.length
        ? names.map(n => `<option value="${escHtml(n)}"${n === current ? ' selected' : ''}>${escHtml(n)}</option>`).join('')
        : '<option value="">No regions found</option>';
    for (const id of ['gm-region-select', 'scene-consequences-region-select']) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.innerHTML = options;
        if (current) el.value = current;
    }
}

async function chooseRegion(name) {
    if (!name) return;
    try {
        const ok = await setSelectedRegion(name);
        if (!ok) return showToast(`Region "${name}" is not available.`, 'error');
        showToast(`Region set to ${name}`, 'info');
    } catch (err) {
        showToast('Could not change region', 'error');
    }
}

/** Subscriber kept as a module-level reference so registerRegionChange's
 *  de-duplication can recognise it across repeated tab renders. */
function syncRegionSelects(regionName) {
    for (const id of ['gm-region-select', 'scene-consequences-region-select']) {
        const el = document.getElementById(id);
        if (el && regionName) el.value = regionName;
    }
}

async function initRegionControls() {
    onRegionChange(syncRegionSelects);
    let names = [];
    try {
        names = await ensureRegionsReady();
    } catch (err) {
        console.warn('[GMTools] Region discovery failed', err);
    }
    paintRegionSelects(names, getSelectedRegion());

    for (const id of ['gm-region-select', 'scene-consequences-region-select']) {
        const el = document.getElementById(id);
        if (!el || el.dataset.regionBound === '1') continue;
        el.dataset.regionBound = '1';
        el.addEventListener('change', e => chooseRegion(e.target.value));
    }
}

function attachConsequencesEvents() {
    // The selector on this tab is repainted and rebound by the shared
    // region wiring, so it stays in step with the header's.
    initRegionControls();
}

// ============================================================
// WINDOW EXPOSURES
// ============================================================

window.sceneEndTrimBoons = sceneEndTrimBoons;
window.resetAllTimers = resetAllTimers;
window.newSession = newSession;

// ─── Robust tab loaders: directly load the module into the container ───
window.openKanban = function() {
    const containerEl = document.getElementById('gm-view-container');
    if (!containerEl) return;
    activeTab = 'kanban';
    loadKanbanModule(containerEl).then(() => {
        document.querySelectorAll('.gm-tab').forEach(t => t.classList.replace('btn-gold', 'btn-secondary'));
        document.querySelector('.gm-tab[data-view="kanban"]')?.classList.replace('btn-secondary', 'btn-gold');
    });
};

window.openWhiteboard = function() {
    const containerEl = document.getElementById('gm-view-container');
    if (!containerEl) return;
    activeTab = 'whiteboard';
    loadWhiteboardModule(containerEl).then(() => {
        document.querySelectorAll('.gm-tab').forEach(t => t.classList.replace('btn-gold', 'btn-secondary'));
        document.querySelector('.gm-tab[data-view="whiteboard"]')?.classList.replace('btn-secondary', 'btn-gold');
    });
};

window.openTravelPlanner = function() {
    const containerEl = document.getElementById('gm-view-container');
    if (!containerEl) return;
    activeTab = 'travel';
    loadTravelPlannerModule(containerEl).then(() => {
        document.querySelectorAll('.gm-tab').forEach(t => t.classList.replace('btn-gold', 'btn-secondary'));
        document.querySelector('.gm-tab[data-view="travel"]')?.classList.replace('btn-secondary', 'btn-gold');
    });
};

// Legacy loader functions (kept for backward compatibility)
window.loadTravelPlanner = function() { window.openTravelPlanner(); };
window.loadKanban = function() { window.openKanban(); };
window.loadWhiteboard = function() { window.openWhiteboard(); };

// 👇 NEW: jump to the Adventure Manager tab — same hash-navigation
// pattern already used elsewhere in this app (e.g. "Open Whiteboard"
// from the VTT).
window.openAdventureManager = function() {
    window.location.hash = 'adventure-manager';
};

// 👇 NEW: Complete the current scene of whichever adventure is
// status:'active', straight from the Scene tab. Delegates to Adventure
// Manager's own completeScene() (dynamic import — see file header for
// why this can't be a static import) so logging/broadcast/persistence
// all happen through the one real implementation.
window.gmCompleteScene = async function() {
    const adventure = getRunningAdventure();
    if (!adventure) return;
    try {
        const advModule = await import('@features/adventure-manager/index.js');
        // Ensure the adventure manager's cache is synced
        advModule.loadAdventuresFromState();
        const result = advModule.completeScene(adventure.id, adventure.currentAct, adventure.currentScene);
        if (result) showToast('✅ Scene completed!', 'success');
        refreshView();
    } catch (e) {
        console.error('[GM Tools] Could not complete scene:', e);
        showToast('Adventure Manager not available.', 'error');
    }
};

// 👇 NEW: start/resume the Combat Tracker for the current scene of
// whichever adventure is active, via Adventure Manager's own bridge.
window.gmStartSceneEncounter = async function() {
    const adventure = getRunningAdventure();
    if (!adventure) return;
    try {
        const advModule = await import('@features/adventure-manager/index.js');
        advModule.loadAdventuresFromState();
        await advModule.startSceneEncounter(adventure.id, adventure.currentAct, adventure.currentScene);
    } catch (e) {
        console.error('[GM Tools] Could not start scene encounter:', e);
        showToast('Adventure Manager not available.', 'error');
    }
};

// 👇 NEW: persist a Quick Generate result into whichever adventure is
// currently active, instead of it staying throwaway flavor text.
window.gmSaveQuickGenToAdventure = async function() {
    if (!lastQuickGenResult) return;
    const adventure = getRunningAdventure();
    if (!adventure) {
        showToast('No active adventure to save to — start one in Adventure Manager first.', 'warning');
        return;
    }
    try {
        const advModule = await import('@features/adventure-manager/index.js');
        advModule.loadAdventuresFromState();
        const { type, data } = lastQuickGenResult;
        if (type === 'npc') {
            const npcs = [...(adventure.npcs || []), { id: 'npc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data }];
            advModule.updateAdventure(adventure.id, { npcs });
            showToast(`👤 Saved "${data.name}" to "${adventure.title}"`, 'success');
        } else if (type === 'location') {
            const locations = [...(adventure.locations || []), { id: 'loc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data }];
            advModule.updateAdventure(adventure.id, { locations });
            showToast(`📍 Saved "${data.name}" to "${adventure.title}"`, 'success');
        } else if (type === 'rumor') {
            const notes = `${adventure.notes || ''}\n\nRumor (${data.region}): ${data.text}`.trim();
            advModule.updateAdventure(adventure.id, { notes });
            showToast(`📜 Saved rumor to "${adventure.title}" notes`, 'success');
        }
    } catch (e) {
        console.error('[GM Tools] Could not save quick-gen result to adventure:', e);
        showToast('Adventure Manager not available.', 'error');
    }
};

// 👇 NEW: turn a Crown Spread just drawn here into a full adventure
// template, reusing Adventure Manager's own parser/builder so the exact
// same logic (per-position scenes, NPC/Location extraction, timer from
// the highest card) runs regardless of which tab the reading started in.
window.gmBuildAdventureFromCrownSpread = async function() {
    if (!lastCrownSpreadReading) return;
    try {
        const advModule = await import('@features/adventure-manager/index.js');
        const adventure = advModule.createAdventureFromCrownSpreadReading(lastCrownSpreadReading);
        if (adventure) {
            showToast(`👑 Built "${adventure.title}" — opening Adventure Manager…`, 'success');
            window.location.hash = 'adventure-manager';
        }
    } catch (e) {
        console.error('[GM Tools] Could not build adventure from reading:', e);
        showToast('Adventure Manager not available.', 'error');
    }
};

window.openCombatTracker = function() {
    import('@features/encounters/combat.js').then(module => {
        if (module.default?.openTracker) module.default.openTracker(null);
        else if (module.openTracker) module.openTracker(null);
        else showToast('Combat tracker not available', 'error');
    }).catch(() => showToast('Combat tracker not available', 'error'));
};

window.addTimerFromScene = function() {
    import('@features/timers/index.js').then(module => {
        if (module.openTimerEditor) module.openTimerEditor(null);
        else showToast('Timer module not available', 'error');
    }).catch(() => showToast('Timer module not available', 'error'));
};

window.addEncounterFromScene = function() {
    import('@features/encounters/index.js').then(module => {
        if (module.openEncounterEditor) module.openEncounterEditor(null);
        else showToast('Encounter module not available', 'error');
    }).catch(() => showToast('Encounter module not available', 'error'));
};

window.openEncounterTracker = function(id) {
    import('@features/encounters/combat.js').then(module => {
        if (module.default?.openTracker) module.default.openTracker(id);
        else if (module.openTracker) module.openTracker(id);
        else showToast('Combat tracker not available', 'error');
    }).catch(() => showToast('Combat tracker not available', 'error'));
};

window.tickTimer = function(id) {
    const state = getState();
    const timer = state.timers.find(t => t.id === id);
    if (timer) {
        timer.current = Math.min(timer.current + 1, timer.segments);
        saveState();
        if (timer.current >= timer.segments) {
            logToSession(`⏱️ Timer completed: ${timer.name}`, 'warning');
            showToast(`⏱️ Timer "${timer.name}" completed!`, 'warning');
        }
        refreshView();
    }
};

window.completeTimer = function(id) {
    const state = getState();
    const timer = state.timers.find(t => t.id === id);
    if (timer) {
        timer.current = timer.segments;
        saveState();
        logToSession(`⏱️ Timer completed: ${timer.name}`, 'warning');
        showToast(`⏱️ Timer "${timer.name}" completed!`, 'warning');
        refreshView();
    }
};

window.gmAddKanbanItem = function() {
    const title = prompt('Enter item title:');
    if (!title) return;
    const description = prompt('Enter description (optional):') || '';
    const column = prompt('Select column (todo/doing/done/blocked):', 'todo') || 'todo';
    if (!kanbanData.columns[column]) return showToast('Invalid column', 'error');
    kanbanData.columns[column].items.push({ title, description });
    saveCampaignData();
    refreshView();
    showToast(`📋 Added "${title}" to ${column}`, 'success');
};

window.gmMoveKanbanItem = function(column, index, direction) {
    const cols = ['todo', 'doing', 'done', 'blocked'];
    const newIdx = cols.indexOf(column) + direction;
    if (newIdx < 0 || newIdx >= cols.length) return showToast('Cannot move further', 'warning');
    const targetCol = cols[newIdx];
    const item = kanbanData.columns[column].items[index];
    kanbanData.columns[column].items.splice(index, 1);
    kanbanData.columns[targetCol].items.push(item);
    saveCampaignData();
    refreshView();
    showToast(`📋 Moved to ${targetCol}`, 'success');
};

window.gmRemoveKanbanItem = function(column, index) {
    if (!confirm('Remove this item?')) return;
    kanbanData.columns[column].items.splice(index, 1);
    saveCampaignData();
    refreshView();
};

window.saveCampaignNotes = function() {
    const notes = document.getElementById('campaign-notes')?.value;
    if (notes !== undefined) {
        campaignState.notes = notes;
        saveCampaignData();
        showToast('💾 Campaign notes saved', 'success');
    }
};

window.addCampaignThreat = function() {
    const name = prompt('Enter threat name:');
    if (!name) return;
    const severity = prompt('Severity (low/medium/high):', 'medium') || 'medium';
    const description = prompt('Description:') || '';
    campaignState.activeThreats.push({ name, severity, description });
    saveCampaignData();
    refreshView();
    showToast(`⚠️ Added threat: ${name}`, 'success');
};

window.removeCampaignThreat = function(index) {
    if (!confirm(`Remove threat "${campaignState.activeThreats[index].name}"?`)) return;
    campaignState.activeThreats.splice(index, 1);
    saveCampaignData();
    refreshView();
};

window.addCampaignOpportunity = function() {
    const name = prompt('Enter opportunity name:');
    if (!name) return;
    const description = prompt('Description:') || '';
    campaignState.opportunities.push({ name, description });
    saveCampaignData();
    refreshView();
    showToast(`🌟 Added opportunity: ${name}`, 'success');
};

window.removeCampaignOpportunity = function(index) {
    if (!confirm(`Remove opportunity "${campaignState.opportunities[index].name}"?`)) return;
    campaignState.opportunities.splice(index, 1);
    saveCampaignData();
    refreshView();
};

window.addCampaignTimer = function() {
    const name = prompt('Enter timer name:');
    if (!name) return;
    const segments = parseInt(prompt('Segments:', '6') || '6');
    campaignState.campaignTimers.push({ name, segments, current: 0 });
    saveCampaignData();
    refreshView();
    showToast(`⏱️ Added timer: ${name}`, 'success');
};

window.tickCampaignTimer = function(index) {
    const timer = campaignState.campaignTimers[index];
    if (timer) {
        timer.current = Math.min(timer.current + 1, timer.segments);
        saveCampaignData();
        if (timer.current >= timer.segments) showToast(`⏱️ Campaign timer "${timer.name}" completed!`, 'warning');
        refreshView();
    }
};

window.removeCampaignTimer = function(index) {
    if (!confirm(`Remove timer "${campaignState.campaignTimers[index].name}"?`)) return;
    campaignState.campaignTimers.splice(index, 1);
    saveCampaignData();
    refreshView();
};

window.copySessionLog = function() {
    const log = getState().campaign?.state?.sessionLog || [];
    const text = log.map(e => `[${e.time}] ${e.message}`).join('\n');
    if (!text) return showToast('Session log is empty.', 'warning');
    navigator.clipboard.writeText(text).then(() => showToast('Session log copied.', 'success')).catch(() => prompt('Copy the log:', text));
};

window.clearSessionLog = function() {
    if (!confirm('Clear the session log?')) return;
    const state = getState();
    if (state.campaign?.state) {
        state.campaign.state.sessionLog = [];
        saveState();
        refreshView();
        showToast('Session log cleared.', 'info');
    }
};

window.addSceneTag = function() {
    const input = document.getElementById('scene-tag-input');
    if (input && addSceneTag(input.value)) {
        input.value = '';
        input.focus();
    }
};

window.removeSceneTag = removeSceneTag;
window.clearSceneTags = clearSceneTags;
window.generateNPC = generateQuickNPC;
window.generateLocation = generateQuickLocation;
window.generateRumor = generateQuickRumor;
window.exportSessionBundle = exportSessionBundle;
window.clearSessionData = clearSessionData;

window.quickDrawConsequence = async function(count = 1) {
    try {
        const result = await quickDraw(count);
        if (result) {
            const resultEl = document.getElementById('consequence-result');
            if (resultEl) {
                let aceHtml = '';
                const cardsWithAces = result.cards.filter(c => c.rank === 'A' && !c.isJoker);
                if (cardsWithAces.length > 0) {
                    aceHtml = `<div class="mt-1 p-2 badge-gold" style="display:block;">♠️ <strong>Ace Effect triggered!</strong></div>`;
                    logToSession(`♠️ Ace Effect triggered on draw`, 'warning');
                }
                resultEl.innerHTML = `
                    <div class="p-1">
                        <div class="font-bold text-gold mb-1">🃏 ${count} Card${count > 1 ? 's' : ''} Drawn</div>
                        <div class="text-muted mb-1">${result.cardNames}</div>
                        <div class="panel" style="background:var(--bg2); border-left: 3px solid var(--gold); white-space: pre-wrap;">${result.synthesis}</div>
                        ${aceHtml}
                    </div>
                `;
            }
            const crownEl = document.getElementById('crown-spread-result');
            if (crownEl) crownEl.style.display = 'none';
        }
    } catch (err) {
        showToast('Could not draw cards', 'error');
    }
};

window.quickCrownSpreadFromScene = async function() {
    try {
        const result = await quickCrownSpread();
        if (result) {
            // 👇 NEW: stash the reading so "Build Adventure from this
            // Reading" doesn't need to re-draw or dig through history.
            lastCrownSpreadReading = {
                synthesis: result.result.synthesis,
                cardNames: result.cardNames,
                region: getSelectedRegion() || 'Acasia'
            };

            const resultEl = document.getElementById('consequence-result');
            if (resultEl) {
                resultEl.innerHTML = `
                    <div class="p-1">
                        <div class="font-bold text-gold mb-1">👑 Crown Spread</div>
                        <div class="text-muted mb-1">${result.cardNames}</div>
                        <div class="panel" style="background:var(--bg2); border-left: 3px solid var(--gold); white-space: pre-wrap;">${result.result.synthesis}</div>
                    </div>
                `;
            }
            const crownEl = document.getElementById('crown-spread-result');
            if (crownEl) {
                crownEl.style.display = 'block';
                const cardsEl = document.getElementById('crown-spread-cards');
                if (cardsEl) {
                    cardsEl.innerHTML = result.mainCards.map((card, i) => {
                        const positions = ['🌱 Root', '🏔️ Crest', '👑 Crown', '🤝 Left Hand'];
                        const isJoker = card.isJoker || false;
                        return `<div class="panel flex-center flex-col" style="min-width:60px; background:var(--bg3); border: 2px solid ${card.color || 'var(--gold)'};"><div class="text-xs text-muted">${positions[i]}</div><div style="font-size:1.5rem;">${isJoker ? '🃏' : (card.symbol || '♦')}</div><div class="text-xs text-muted">${isJoker ? 'Joker' : card.rankName}</div></div>`;
                    }).join('') + `<div class="panel flex-center flex-col" style="min-width:60px; background:var(--bg4); border: 2px solid var(--gold); box-shadow: 0 0 15px var(--gold-glow);"><div class="text-xs text-gold">🌟 Wild</div><div style="font-size:1.5rem;">🃏</div><div class="text-xs text-gold">Twist</div></div>`;
                }
                // 👇 NEW: one-click path from "just drew this" to "now it's an adventure"
                const interpEl = document.getElementById('crown-spread-interpretation');
                if (interpEl) {
                    interpEl.innerHTML = `<button class="btn btn-sm btn-gold" onclick="window.gmBuildAdventureFromCrownSpread()">📖 Build Adventure from this Reading</button>`;
                }
            }
        }
    } catch (err) {
        showToast('Could not perform Crown Spread', 'error');
    }
};

window.shuffleDeck = function() {
    import('@features/decks/index.js').then(module => {
        if (module.resetDeck || module.default?.resetDeck) {
            (module.resetDeck || module.default.resetDeck)();
            showToast('🔀 Deck shuffled', 'success');
        } else {
            showToast('Deck module not available', 'error');
        }
    }).catch(() => showToast('Deck module not available', 'error'));
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

function sceneEndTrimBoons() {
    const state = getState();
    let trimmed = 0;
    (state.characters || []).forEach(c => {
        const before = c.boons || 0;
        c.boons = clamp(c.boons || 0, 0, 2);
        if (before > c.boons) trimmed += (before - c.boons);
        // Refresh any "once per scene" talent charges (Second Wind, Backstab, etc.)
        c.talentUses = resetTalentCharges(c, 'once-scene');
    });
    saveState();
    if (trimmed > 0) showToast(`Scene end: trimmed ${trimmed} excess Boons, refreshed once/scene talents.`, 'success');
    else showToast('Scene end: Boons already trimmed; refreshed once/scene talents.', 'info');
}

function resetAllTimers() {
    if (!confirm('Reset every timer to zero segments?')) return;
    const state = getState();
    (state.timers || []).forEach(t => t.current = 0);
    saveState();
    showToast('All timers reset.', 'success');
}

function newSession() {
    const state = getState();
    if ((state.rollHistory || []).length === 0 && (state.chatHistory || []).length === 0) return showToast('No data to archive.', 'info');

    const label = prompt('Session label:', `Session ${state.sessionId || 1}`) || `Session ${state.sessionId || 1}`;
    addArchive({ id: Date.now(), timestamp: Date.now(), rollHistory: [...(state.rollHistory || [])], chatHistory: [...(state.chatHistory || [])], label });
    clearRollHistory();
    clearChatHistory();
    // A new session implies every scene within it has also ended.
    (state.characters || []).forEach(c => {
        c.talentUses = resetTalentCharges(c, 'once-session');
        c.talentUses = resetTalentCharges(c, 'once-scene');
    });
    saveState();
    showToast('New session started; previous archived; refreshed once/session (and once/scene) talents.', 'success');
}

// ============================================================
// VIEW MANAGEMENT & EVENT LISTENERS
// ============================================================

function refreshView() {
    const containerEl = document.getElementById('gm-view-container');
    if (!containerEl) return;
    
    loadCampaignData();
    
    if (activeTab === 'kanban') loadKanbanModule(containerEl);
    else if (activeTab === 'whiteboard') loadWhiteboardModule(containerEl);
    else if (activeTab === 'travel') loadTravelPlannerModule(containerEl);
    else {
        containerEl.innerHTML = renderView(activeTab);
        attachEvents();
        if (activeTab === 'consequences') attachConsequencesEvents();
        if (activeTab === 'session') attachSessionEvents();
        if (activeTab === 'scene') attachSoundboardEvents();
    }
}

// attachEvents() runs on the initial render AND after every tab switch
// (the tab handler re-renders the view container and calls it again).
// Anything it binds to an element that OUTLIVES that re-render therefore
// has to be bound once, or the handler count grows with every click —
// the leak that froze the crafting panel. Two kinds here: the .gm-tab
// buttons, which live outside #gm-view-container and survive, and the
// two document-level listeners at the bottom, which survive everything.
let documentLevelEventsBound = false;

function attachEvents() {
    document.querySelectorAll('.gm-tab').forEach(tab => {
        // Per-element, not a module flag: a full render() rebuilds these
        // buttons, and fresh buttons do need binding.
        if (tab.dataset.gmTabBound === '1') return;
        tab.dataset.gmTabBound = '1';
        tab.addEventListener('click', async () => {
            document.querySelectorAll('.gm-tab').forEach(t => t.classList.replace('btn-gold', 'btn-secondary'));
            tab.classList.replace('btn-secondary', 'btn-gold');
            
            const view = tab.dataset.view;
            const containerEl = document.getElementById('gm-view-container');
            if (!containerEl) return;
            
            activeTab = view;
            
            if (view === 'kanban') await loadKanbanModule(containerEl);
            else if (view === 'whiteboard') await loadWhiteboardModule(containerEl);
            else if (view === 'travel') await loadTravelPlannerModule(containerEl);
            else {
                containerEl.innerHTML = renderView(view);
                attachEvents();
                if (view === 'consequences') attachConsequencesEvents();
                if (view === 'session') attachSessionEvents();
                if (view === 'scene') attachSoundboardEvents();
            }
        });
    });
    
    if (activeTab === 'consequences') attachConsequencesEvents();
    if (activeTab === 'session') attachSessionEvents();
    if (activeTab === 'scene') attachSoundboardEvents();

    document.getElementById('gen-npc-btn')?.addEventListener('click', generateQuickNPC);
    document.getElementById('gen-location-btn')?.addEventListener('click', generateQuickLocation);
    document.getElementById('gen-rumor-btn')?.addEventListener('click', generateQuickRumor);
    document.getElementById('scene-tag-add-btn')?.addEventListener('click', window.addSceneTag);
    document.getElementById('scene-tag-clear-btn')?.addEventListener('click', window.clearSceneTags);

    // 👇 NEW: auto-tick toggle
    const autoTickToggle = document.getElementById('auto-tick-toggle');
    if (autoTickToggle) {
        autoTickToggle.addEventListener('change', (e) => {
            updateGmState({ autoTickTimers: e.target.checked });
            showToast(`Auto-tick ${e.target.checked ? 'enabled' : 'disabled'}.`, 'info');
        });
    }
    
    if (!documentLevelEventsBound) {
        documentLevelEventsBound = true;
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && document.activeElement === document.getElementById('scene-tag-input')) {
                window.addSceneTag();
            }
        });

        document.addEventListener('click', (e) => {
            const target = e.target.closest('.gm-tag-remove');
            if (target) window.removeSceneTag(target.dataset.tag);
        });
    }

    // Safety Tools
    document.getElementById('safety-save-btn')?.addEventListener('click', () => {
        const lines = document.getElementById('safety-lines')?.value || '';
        const veils = document.getElementById('safety-veils')?.value || '';
        saveCampaignSafety({ lines, veils });
        showToast('Safety settings saved.', 'success');
    });

    document.getElementById('sz-save-btn')?.addEventListener('click', () => {
        const tone = document.getElementById('sz-tone')?.value || '';
        const length = document.getElementById('sz-length')?.value || '';
        const characterHooks = document.getElementById('sz-characterHooks')?.value || '';
        const consent = document.getElementById('sz-consent')?.checked || false;
        saveCampaignSafety({ sessionZero: { tone, length, characterHooks, consent } });
        showToast('Session Zero saved.', 'success');
    });
}

function attachSessionEvents() {
    document.getElementById('session-record-btn')?.addEventListener('click', async () => {
        const state = getState();
        const userName = state.characters?.[0]?.name || 'Player';
        const liveTranscription = document.getElementById('session-live-transcription')?.checked || false;
        await mediaStartRecording(userName, { liveTranscription });
        updateRecordingUI();
    });
    document.getElementById('session-stop-btn')?.addEventListener('click', () => {
        mediaStopRecording();
        updateRecordingUI();
    });
    document.getElementById('session-export-btn')?.addEventListener('click', exportSessionBundle);
    document.getElementById('session-clear-btn')?.addEventListener('click', clearSessionData);
    
    document.removeEventListener('media-recording-state', handleMediaStateChange);
    document.addEventListener('media-recording-state', handleMediaStateChange);
}

function handleMediaStateChange() {
    updateRecordingUI();
}

function updateRecordingUI() {
    const status = getRecordingStatus();
    const recordBtn = document.getElementById('session-record-btn');
    const stopBtn = document.getElementById('session-stop-btn');
    const statusEl = document.getElementById('session-recording-status');
    const transcriptionLabel = document.getElementById('session-live-transcription')?.closest('label');

    if (recordBtn) recordBtn.style.display = status.isRecording ? 'none' : 'inline-block';
    if (stopBtn) stopBtn.style.display = status.isRecording ? 'inline-block' : 'none';
    if (statusEl) statusEl.textContent = status.isRecording ? `🔴 Recording... (${status.duration}s)` : 'Not recording';
    // The transcription checkbox is read once at recording start -- lock it
    // while a recording is in progress so it can't be flipped mid-recording
    // and silently do nothing.
    if (transcriptionLabel) {
        transcriptionLabel.style.opacity = status.isRecording ? '0.5' : '';
        transcriptionLabel.style.pointerEvents = status.isRecording ? 'none' : '';
    }
}

// ============================================================
// LIFECYCLE
// ============================================================

function onActivate() {
    loadCampaignData();
    if (activeTab === 'consequences') setTimeout(attachConsequencesEvents, 100);
    if (activeTab === 'session') setTimeout(attachSessionEvents, 100);
}

function onDeactivate() {
    saveCampaignData();
}

function refresh() {
    loadCampaignData();
    refreshView();
}

function destroy() {
    container = null;
    saveCampaignData();
    moduleCache = {};
}


export {
    render,
    destroy,
    onActivate,
    onDeactivate,
    refresh,
    logToSession,
    addVTTEvent,
    addSceneTag,
    removeSceneTag,
    clearSceneTags,
    getSceneTags,
    getTagEffects,
    sceneEndTrimBoons,
    resetAllTimers,
    newSession,
    // 👇 NEW exports (optional)
    tickActiveSceneTimer,
    getActiveAdventureTimers
};

// ✅ Default export (re‑exporting the same)
export default {
    render,
    destroy,
    onActivate,
    onDeactivate,
    refresh,
    sceneEndTrimBoons,
    resetAllTimers,
    newSession,
    logToSession,
    addVTTEvent,
    addSceneTag,
    removeSceneTag,
    clearSceneTags,
    getSceneTags,
    getTagEffects,
    tickActiveSceneTimer,
    getActiveAdventureTimers
};