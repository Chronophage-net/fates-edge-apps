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
 * - 🎥 Session Recap & Save (voice recording, VTT events, export)
 */

import { getState, addArchive, clearRollHistory, clearChatHistory, saveState } from '../../core/state.js';
import { clamp, escHtml } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { 
    getSelectedRegion, 
    getRegionNames, 
    quickDraw, 
    quickCrownSpread,
    setSelectedRegion,
    onRegionChange,
    getRegionData
} from '../decks/index.js';

// Import media module
import { 
    initMediaModule, 
    startRecording as mediaStartRecording, 
    stopRecording as mediaStopRecording,
    isCurrentlyRecording,
    getRecordingStatus
} from '../../core/media.js';

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


// ============================================================
// CHECK CONNECTED STATUS
// ============================================================

// Add this function to check room status via your sync manager
function isViewOnlyMode() {
    if (window.__syncManager && window.__syncManager.isConnected) {
        try {
            const status = window.__syncManager.getStatus();
            const myRole = status.role; // 'gm' or 'player'
            
            // If I am a player, check if a GM is online
            if (myRole === 'player') {
                const clients = status.onlineClients || [];
                const hasGM = clients.some(client => client.role === 'gm' && client.id !== status.clientId);
                return hasGM;
            }
        } catch (e) {
            console.warn('Could not get sync status for view-only check:', e);
        }
    }
    return false;
}

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

export function logToSession(message, type = 'info') {
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

export function addVTTEvent(type, data = {}) {
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
// TAG INJECTOR
// ============================================================

export function getSceneTags() {
    return getState().campaign?.state?.sceneTags || [];
}

export function addSceneTag(tag) {
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

export function removeSceneTag(tag) {
    const state = getState();
    if (!state.campaign?.state?.sceneTags) return false;
    state.campaign.state.sceneTags = state.campaign.state.sceneTags.filter(t => t !== tag);
    saveState();
    refreshView();
    logToSession(`🏷️ Tag removed: [${tag}]`, 'info');
    return true;
}

export function clearSceneTags() {
    const state = getState();
    if (!state.campaign?.state?.sceneTags) return;
    state.campaign.state.sceneTags = [];
    saveState();
    refreshView();
    logToSession('🏷️ All tags cleared.', 'info');
    showToast('All tags cleared.', 'info');
}

export function getTagEffects() {
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
        </div>
    `;
}

function renderRumor(rumor) {
    return `
        <div class="flex flex-col gap-1">
            <div class="text-sm italic">“${rumor.text}”</div>
            <div class="text-xs text-muted">Region: ${rumor.region}</div>
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
// RENDER
// ============================================================

export function render(el) {
    container = el;
    loadCampaignData();

    const state = getState();
    const userId = state.sessionId || 'local-' + Date.now().toString(36);
    initMediaModule(userId);

    container.innerHTML = `
        <div class="gm-tools-modern-layout flex flex-col gap-2">
            <header class="gm-tools-header">
                <h1 class="page-title">⚙️ GM Tools</h1>
                <p class="page-sub">Manage scenes, campaign tracking, whiteboard, Kanban board, and journey planning.</p>
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
}

function renderView(view) {
    activeTab = view;
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
// SCENE VIEW
// ============================================================

function renderSceneView() {
    const state = getState();
    const activeTimers = state.timers || [];
    const activeEncounters = state.encounters || [];
    const characters = state.characters || [];
    const tagEffects = getTagEffects();

    return `
        <div class="flex flex-col gap-2">
            <div class="panel">
                <h3 class="panel-title">⚡ Quick Actions</h3>
                <div class="grid-2 mt-1">
                    <button class="btn btn-secondary" onclick="window.sceneEndTrimBoons()">✂️ Trim Boons</button>
                    <button class="btn btn-secondary" onclick="window.resetAllTimers()">⏱️ Reset Timers</button>
                    <button class="btn btn-secondary" onclick="window.newSession()">📦 New Session</button>
                    <button class="btn btn-secondary" onclick="window.openCombatTracker()">⚔️ Combat Tracker</button>
                    <button class="btn btn-secondary" onclick="window.openKanban()">📋 Kanban Board</button>
                    <button class="btn btn-secondary" onclick="window.openWhiteboard()">✏️ Whiteboard</button>
                    <button class="btn btn-secondary" onclick="window.openCrownSpread()">👑 Crown Spread</button>
                    <button class="btn btn-secondary" onclick="window.openTravelPlanner()">🗺️ Travel Planner</button>
                </div>
            </div>

            <div class="panel">
                <h3 class="panel-title">⚡ Quick Generate</h3>
                <div class="flex gap-1 flex-center flex-wrap mt-1">
                    <button class="btn btn-sm btn-gold" id="gen-npc-btn">👤 NPC</button>
                    <button class="btn btn-sm btn-gold" id="gen-location-btn">📍 Location</button>
                    <button class="btn btn-sm btn-gold" id="gen-rumor-btn">📜 Rumor</button>
                    <span class="text-muted text-sm mx-auto">Uses current region's deck</span>
                </div>
                <div id="quick-gen-result" class="mt-1 panel" style="background:var(--bg3); border-left: 3px solid var(--border);">
                    <span class="text-muted text-sm">Generate an NPC, Location, or Rumor.</span>
                </div>
            </div>

            <div class="panel">
                <h3 class="panel-title">🏷️ Scene Tags</h3>
                <div class="flex gap-1 flex-center flex-wrap mt-1">
                    <input type="text" id="scene-tag-input" placeholder="e.g., WARD, FIRE, DARK" class="flex-1" style="min-width: 120px;" />
                    <button class="btn btn-sm btn-primary" id="scene-tag-add-btn">+ Add Tag</button>
                    <button class="btn btn-sm btn-secondary" id="scene-tag-clear-btn">Clear All</button>
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
                    <button class="btn btn-sm btn-primary" onclick="window.addTimerFromScene()">+ Add Timer</button>
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
                                <button class="btn btn-xs btn-ghost" onclick="window.tickTimer('${t.id}')">+1</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">⚔️ Active Encounters</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addEncounterFromScene()">+ Add Encounter</button>
                </div>
                ${activeEncounters.length === 0 ? '<p class="text-muted mt-1">No active encounters.</p>' : `
                    <div class="flex flex-col gap-1 mt-1">
                        ${activeEncounters.map(e => `
                            <div class="flex gap-1 flex-center">
                                <span class="flex-1 text-sm">${escHtml(e.name)}</span>
                                <span class="badge badge-red">${e.status || 'active'}</span>
                                <button class="btn btn-xs btn-primary" onclick="window.openEncounterTracker('${e.id}')">⚔️ Track</button>
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
                    <button class="btn btn-sm btn-primary" onclick="window.addKanbanItem()">+ Add Item</button>
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
                                            <button class="btn btn-xs btn-ghost" onclick="window.moveKanbanItem('${key}', ${idx}, -1)">←</button>
                                            <button class="btn btn-xs btn-ghost" onclick="window.moveKanbanItem('${key}', ${idx}, 1)">→</button>
                                            <button class="btn btn-xs btn-danger ml-auto" onclick="window.removeKanbanItem('${key}', ${idx})">✕</button>
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
                <h3 class="panel-title">🎙️ Session Recap & Save</h3>
                <p class="text-muted text-sm">Capture your session with voice recording, VTT event logging, and export a bundle.</p>
                
                <div class="flex gap-1 flex-wrap mt-2">
                    <button class="btn btn-primary" id="session-record-btn" ${recordingStatus.isRecording ? 'style="display:none;"' : ''}>🎤 Record</button>
                    <button class="btn btn-danger" id="session-stop-btn" ${!recordingStatus.isRecording ? 'style="display:none;"' : ''}>⏹️ Stop</button>
                    <button class="btn btn-secondary" id="session-export-btn">📦 Export Bundle</button>
                    <button class="btn btn-secondary" id="session-clear-btn">🧹 Clear Session</button>
                </div>
                <div id="session-recording-status" class="text-sm text-muted mt-1">
                    ${recordingStatus.isRecording ? `🔴 Recording... (${Math.floor(recordingStatus.duration)}s)` : 'Not recording'}
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
    showToast('Session bundle exported.', 'success');
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
        const module = await import('../kanban/index.js');
        moduleCache.kanban = module;
        module.render(containerEl);
    } catch (e) {
        containerEl.innerHTML = `<div class="panel"><h3 class="panel-title">📋 Kanban Board</h3><p class="text-muted" style="color:var(--red);">Error loading: ${e.message}</p><button class="btn btn-sm btn-primary mt-1" onclick="window.loadKanban()">🔄 Retry</button></div>`;
    }
}

async function loadWhiteboardModule(containerEl) {
    try {
        if (moduleCache.whiteboard) return moduleCache.whiteboard.render(containerEl);
        const module = await import('../whiteboard/index.js');
        moduleCache.whiteboard = module;
        module.render(containerEl);
    } catch (e) {
        containerEl.innerHTML = `<div class="panel"><h3 class="panel-title">✏️ Whiteboard</h3><p class="text-muted" style="color:var(--red);">Error loading: ${e.message}</p><button class="btn btn-sm btn-primary mt-1" onclick="window.loadWhiteboard()">🔄 Retry</button></div>`;
    }
}

async function loadTravelPlannerModule(containerEl) {
    try {
        if (moduleCache.travel && moduleCache.travel.render) return moduleCache.travel.render(containerEl);
        const module = await import('../travel-planner/index.js');
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

function attachConsequencesEvents() {
    const regionSelect = document.getElementById('scene-consequences-region-select');
    if (regionSelect) {
        regionSelect.addEventListener('change', async (e) => {
            try {
                await setSelectedRegion(e.target.value);
                showToast(`Region set to ${e.target.value}`, 'info');
            } catch (err) {
                showToast('Could not change region', 'error');
            }
        });
    }
    
    onRegionChange((regionName) => {
        const select = document.getElementById('scene-consequences-region-select');
        if (select) select.value = regionName;
    });
}

// ============================================================
// WINDOW EXPOSURES
// ============================================================

window.sceneEndTrimBoons = sceneEndTrimBoons;
window.resetAllTimers = resetAllTimers;
window.newSession = newSession;

window.openKanban = function() { document.querySelector('.gm-tab[data-view="kanban"]')?.click(); };
window.openWhiteboard = function() { document.querySelector('.gm-tab[data-view="whiteboard"]')?.click(); };
window.openTravelPlanner = function() { document.querySelector('.gm-tab[data-view="travel"]')?.click(); };
window.loadTravelPlanner = function() { loadTravelPlannerModule(document.getElementById('gm-view-container')); };
window.loadKanban = function() { loadKanbanModule(document.getElementById('gm-view-container')); };
window.loadWhiteboard = function() { loadWhiteboardModule(document.getElementById('gm-view-container')); };

window.openCombatTracker = function() {
    import('../encounters/combat.js').then(module => {
        if (module.default?.openTracker) module.default.openTracker(null);
        else if (module.openTracker) module.openTracker(null);
        else showToast('Combat tracker not available', 'error');
    }).catch(() => showToast('Combat tracker not available', 'error'));
};

window.addTimerFromScene = function() {
    import('../timers/index.js').then(module => {
        if (module.openTimerEditor) module.openTimerEditor(null);
        else showToast('Timer module not available', 'error');
    }).catch(() => showToast('Timer module not available', 'error'));
};

window.addEncounterFromScene = function() {
    import('../encounters/index.js').then(module => {
        if (module.openEncounterEditor) module.openEncounterEditor(null);
        else showToast('Encounter module not available', 'error');
    }).catch(() => showToast('Encounter module not available', 'error'));
};

window.openEncounterTracker = function(id) {
    import('../encounters/combat.js').then(module => {
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

window.addKanbanItem = function() {
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

window.moveKanbanItem = function(column, index, direction) {
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

window.removeKanbanItem = function(column, index) {
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
            }
        }
    } catch (err) {
        showToast('Could not perform Crown Spread', 'error');
    }
};

window.shuffleDeck = function() {
    import('../decks/index.js').then(module => {
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

export function sceneEndTrimBoons() {
    const state = getState();
    let trimmed = 0;
    (state.characters || []).forEach(c => {
        const before = c.boons || 0;
        c.boons = clamp(c.boons || 0, 0, 2);
        if (before > c.boons) trimmed += (before - c.boons);
    });
    saveState();
    if (trimmed > 0) showToast(`Scene end: trimmed ${trimmed} excess Boons.`, 'success');
    else showToast('Scene end: all Boons already at 2 or below.', 'info');
}

export function resetAllTimers() {
    if (!confirm('Reset every timer to zero segments?')) return;
    const state = getState();
    (state.timers || []).forEach(t => t.current = 0);
    saveState();
    showToast('All timers reset.', 'success');
}

export function newSession() {
    const state = getState();
    if ((state.rollHistory || []).length === 0 && (state.chatHistory || []).length === 0) return showToast('No data to archive.', 'info');
    
    const label = prompt('Session label:', `Session ${state.sessionId || 1}`) || `Session ${state.sessionId || 1}`;
    addArchive({ id: Date.now(), timestamp: Date.now(), rollHistory: [...(state.rollHistory || [])], chatHistory: [...(state.chatHistory || [])], label });
    clearRollHistory();
    clearChatHistory();
    showToast('New session started; previous archived.', 'success');
}

// ============================================================
// VIEW MANAGEMENT & EVENT LISTENERS
// ============================================================

function refreshView() {
    const containerEl = document.getElementById('gm-view-container');
    if (!containerEl) return;
    
    if (activeTab === 'kanban') loadKanbanModule(containerEl);
    else if (activeTab === 'whiteboard') loadWhiteboardModule(containerEl);
    else if (activeTab === 'travel') loadTravelPlannerModule(containerEl);
    else {
        containerEl.innerHTML = renderView(activeTab);
        attachEvents();
        if (activeTab === 'consequences') attachConsequencesEvents();
        if (activeTab === 'session') attachSessionEvents();
    }
}

export function attachEvents() {
    document.querySelectorAll('.gm-tab').forEach(tab => {
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
            }
        });
    });
    
    if (activeTab === 'consequences') attachConsequencesEvents();
    if (activeTab === 'session') attachSessionEvents();
    
    document.getElementById('gen-npc-btn')?.addEventListener('click', generateQuickNPC);
    document.getElementById('gen-location-btn')?.addEventListener('click', generateQuickLocation);
    document.getElementById('gen-rumor-btn')?.addEventListener('click', generateQuickRumor);
    document.getElementById('scene-tag-add-btn')?.addEventListener('click', window.addSceneTag);
    document.getElementById('scene-tag-clear-btn')?.addEventListener('click', window.clearSceneTags);
    
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

function attachSessionEvents() {
    document.getElementById('session-record-btn')?.addEventListener('click', async () => {
        const state = getState();
        const userName = state.characters?.[0]?.name || 'Player';
        await mediaStartRecording(userName);
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
    
    if (recordBtn) recordBtn.style.display = status.isRecording ? 'none' : 'inline-block';
    if (stopBtn) stopBtn.style.display = status.isRecording ? 'inline-block' : 'none';
    if (statusEl) statusEl.textContent = status.isRecording ? `🔴 Recording... (${status.duration}s)` : 'Not recording';
}

// ============================================================
// LIFECYCLE
// ============================================================

export function onActivate() {
    loadCampaignData();
    if (activeTab === 'consequences') setTimeout(attachConsequencesEvents, 100);
    if (activeTab === 'session') setTimeout(attachSessionEvents, 100);
}

export function onDeactivate() {
    saveCampaignData();
}

export function refresh() {
    loadCampaignData();
    refreshView();
}

export function destroy() {
    container = null;
    saveCampaignData();
    moduleCache = {};
}

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
    getTagEffects
};