/**
 * Scene Tools Module - Advanced Campaign Management
 * 
 * Features:
 * - Scene management (Boons, timers, session archiving)
 * - Campaign Whiteboard (notes, drawings, sticky notes)
 * - Campaign Kanban Board (To Do, Doing, Done, Blocked)
 * - Encounter & Timer Integration
 * - Deck of Consequences / Crown Spread Integration
 * - Campaign Dashboard with active threats and opportunities
 */

import { getState, addArchive, clearRollHistory, clearChatHistory, saveState } from '../../core/state.js';
import { clamp, escHtml } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';

// ============================================================
// STATE
// ============================================================

let container = null;
let activeTab = 'scene';
let moduleCache = {};

// ============================================================
// LOAD/SAVE
// ============================================================

function loadCampaignData() {
    const saved = getState();
    if (saved.campaign) {
        // Individual modules handle their own data loading
    }
}

function saveCampaignData() {
    // Individual modules save their own data
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    loadCampaignData();

    container.innerHTML = `
        <div class="scene-tools-modern-layout">
            <!-- Header -->
            <header class="scene-tools-header">
                <h1 class="scene-tools-title">🎯 Scene Tools</h1>
                <p class="scene-tools-subtitle">Manage scenes, campaign tracking, whiteboard, and Kanban board.</p>
            </header>

            <!-- Navigation Tabs -->
            <div class="scene-tools-tabs">
                <button class="scene-tab active" data-view="scene">🎬 Scene</button>
                <button class="scene-tab" data-view="kanban">📋 Kanban</button>
                <button class="scene-tab" data-view="whiteboard">✏️ Whiteboard</button>
                <button class="scene-tab" data-view="campaign">🏛️ Campaign</button>
                <button class="scene-tab" data-view="consequences">🃏 Consequences</button>
            </div>

            <!-- View Container -->
            <div id="scene-view-container" class="scene-view-container">
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

    return `
        <div class="scene-view">
            <!-- Quick Actions -->
            <div class="panel">
                <h3 class="panel-title">⚡ Quick Actions</h3>
                <div class="quick-actions-grid">
                    <button class="quick-action-btn" onclick="window.sceneEndTrimBoons()">
                        <span class="qa-icon">✂️</span>
                        <span class="qa-label">Trim Boons</span>
                        <span class="qa-desc">Set all Boons to 2</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.resetAllTimers()">
                        <span class="qa-icon">⏱️</span>
                        <span class="qa-label">Reset Timers</span>
                        <span class="qa-desc">Zero all timers</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.newSession()">
                        <span class="qa-icon">📦</span>
                        <span class="qa-label">New Session</span>
                        <span class="qa-desc">Archive and reset</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.openCombatTracker()">
                        <span class="qa-icon">⚔️</span>
                        <span class="qa-label">Combat Tracker</span>
                        <span class="qa-desc">Open combat tracker</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.openKanban()">
                        <span class="qa-icon">📋</span>
                        <span class="qa-label">Kanban Board</span>
                        <span class="qa-desc">Campaign progress tracker</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.openWhiteboard()">
                        <span class="qa-icon">✏️</span>
                        <span class="qa-label">Whiteboard</span>
                        <span class="qa-desc">Visual planning canvas</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.openCrownSpread()">
                        <span class="qa-icon">👑</span>
                        <span class="qa-label">Crown Spread</span>
                        <span class="qa-desc">Campaign planning</span>
                    </button>
                </div>
            </div>

            <!-- Active Timers -->
            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">⏱️ Active Timers</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addTimerFromScene()">+ Add Timer</button>
                </div>
                ${activeTimers.length === 0 ? '<p class="text-muted">No active timers.</p>' : `
                    <div class="timer-list">
                        ${activeTimers.map(t => `
                            <div class="timer-item">
                                <span class="timer-name">${escHtml(t.name)}</span>
                                <div class="timer-progress">
                                    <div class="timer-bar" style="width:${(t.current / t.segments) * 100}%;"></div>
                                    <span class="timer-text">${t.current}/${t.segments}</span>
                                </div>
                                <button class="btn btn-xs btn-ghost" onclick="window.tickTimer('${t.id}')">+1</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <!-- Active Encounters -->
            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">⚔️ Active Encounters</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addEncounterFromScene()">+ Add Encounter</button>
                </div>
                ${activeEncounters.length === 0 ? '<p class="text-muted">No active encounters.</p>' : `
                    <div class="encounter-list">
                        ${activeEncounters.map(e => `
                            <div class="encounter-item">
                                <span class="encounter-name">${escHtml(e.name)}</span>
                                <span class="encounter-status ${e.status || 'active'}">${e.status || 'active'}</span>
                                <button class="btn btn-xs btn-primary" onclick="window.openEncounterTracker('${e.id}')">⚔️ Track</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <!-- Character Summary -->
            <div class="panel">
                <h3 class="panel-title">👤 Characters</h3>
                <div class="character-summary-grid">
                    ${characters.map(c => `
                        <div class="character-summary-item">
                            <span class="char-name">${escHtml(c.name)}</span>
                            <span class="char-boons">🪙 ${c.boons || 0}</span>
                            <span class="char-fatigue">⚡ ${c.fatigue || 0}</span>
                        </div>
                    `).join('')}
                    ${characters.length === 0 ? '<p class="text-muted">No characters loaded.</p>' : ''}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// KANBAN VIEW - Loads the Kanban module
// ============================================================

function renderKanbanView() {
    return `
        <div class="kanban-loader">
            <div class="panel">
                <h3 class="panel-title">📋 Loading Kanban Board...</h3>
                <div class="text-muted" style="text-align:center;padding:2rem;">
                    <div style="font-size:2rem;margin-bottom:0.5rem;">⏳</div>
                    <p>Loading campaign board...</p>
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// WHITEBOARD VIEW - Loads the Whiteboard module
// ============================================================

function renderWhiteboardView() {
    return `
        <div class="whiteboard-loader">
            <div class="panel">
                <h3 class="panel-title">✏️ Loading Whiteboard...</h3>
                <div class="text-muted" style="text-align:center;padding:2rem;">
                    <div style="font-size:2rem;margin-bottom:0.5rem;">⏳</div>
                    <p>Loading whiteboard...</p>
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// CAMPAIGN VIEW
// ============================================================

function renderCampaignView() {
    // Load from state
    const saved = getState();
    const campaign = saved.campaign?.state || { activeThreats: [], opportunities: [], campaignTimers: [], notes: '' };
    const threats = campaign.activeThreats || [];
    const opportunities = campaign.opportunities || [];
    const timers = campaign.campaignTimers || [];

    return `
        <div class="campaign-view">
            <!-- Campaign Notes -->
            <div class="panel">
                <h3 class="panel-title">📝 Campaign Notes</h3>
                <textarea id="campaign-notes" rows="4" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.75rem;color:var(--text);font-family:var(--font);">
                    ${escHtml(campaign.notes || '')}
                </textarea>
                <button class="btn btn-sm btn-primary mt-1" onclick="window.saveCampaignNotes()">💾 Save Notes</button>
            </div>

            <!-- Active Threats -->
            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">⚠️ Active Threats</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addCampaignThreat()">+ Add Threat</button>
                </div>
                ${threats.length === 0 ? '<p class="text-muted">No active threats.</p>' : `
                    <div class="threat-list">
                        ${threats.map((t, idx) => `
                            <div class="threat-item" style="border-left:4px solid ${t.severity === 'high' ? 'var(--red)' : t.severity === 'medium' ? 'var(--orange)' : 'var(--gold)'};">
                                <div class="threat-header">
                                    <span class="threat-name">${escHtml(t.name)}</span>
                                    <span class="threat-severity ${t.severity || 'medium'}">${t.severity || 'medium'}</span>
                                    <button class="btn btn-xs btn-danger" onclick="window.removeCampaignThreat(${idx})">✕</button>
                                </div>
                                ${t.description ? `<div class="threat-desc">${escHtml(t.description)}</div>` : ''}
                                ${t.timer ? `<div class="threat-timer">⏱️ ${t.timer}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <!-- Opportunities -->
            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">🌟 Opportunities</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addCampaignOpportunity()">+ Add Opportunity</button>
                </div>
                ${opportunities.length === 0 ? '<p class="text-muted">No opportunities tracked.</p>' : `
                    <div class="opportunity-list">
                        ${opportunities.map((o, idx) => `
                            <div class="opportunity-item">
                                <span class="opportunity-name">${escHtml(o.name)}</span>
                                ${o.description ? `<span class="opportunity-desc">${escHtml(o.description)}</span>` : ''}
                                <button class="btn btn-xs btn-danger" onclick="window.removeCampaignOpportunity(${idx})">✕</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <!-- Campaign Timers -->
            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">⏱️ Campaign Timers</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addCampaignTimer()">+ Add Timer</button>
                </div>
                ${timers.length === 0 ? '<p class="text-muted">No campaign timers.</p>' : `
                    <div class="campaign-timer-list">
                        ${timers.map((t, idx) => `
                            <div class="campaign-timer-item">
                                <span class="timer-name">${escHtml(t.name)}</span>
                                <div class="timer-progress">
                                    <div class="timer-bar" style="width:${(t.current / t.segments) * 100}%;"></div>
                                    <span class="timer-text">${t.current}/${t.segments}</span>
                                </div>
                                <button class="btn btn-xs btn-primary" onclick="window.tickCampaignTimer(${idx})">+1</button>
                                <button class="btn btn-xs btn-danger" onclick="window.removeCampaignTimer(${idx})">✕</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        </div>
    `;
}

// ============================================================
// CONSEQUENCES VIEW (Deck Integration)
// ============================================================

function renderConsequencesView() {
    return `
        <div class="consequences-view">
            <div class="panel">
                <h3 class="panel-title">🃏 Deck of Consequences</h3>
                <p class="text-muted">Draw cards from the Deck of Consequences or use the Crown Spread for campaign planning.</p>
                
                <div class="consequences-actions" style="display:flex;flex-wrap:wrap;gap:0.75rem;margin:1rem 0;">
                    <button class="btn btn-gold" onclick="window.drawConsequence(1)">🃏 Draw 1</button>
                    <button class="btn btn-gold" onclick="window.drawConsequence(2)">🃏 Draw 2</button>
                    <button class="btn btn-gold" onclick="window.drawConsequence(3)">🃏 Draw 3</button>
                    <button class="btn btn-primary" onclick="window.openCrownSpread()">👑 Crown Spread</button>
                    <button class="btn btn-secondary" onclick="window.shuffleDeck()">🔀 Shuffle</button>
                </div>
                
                <div id="consequence-result" style="background:var(--bg3);border-radius:var(--radius);padding:1rem;min-height:80px;border:1px solid var(--border);">
                    <p class="text-muted">Draw cards to see a consequence.</p>
                </div>
                
                <div id="crown-spread-result" style="margin-top:1rem;display:none;background:var(--bg3);border-radius:var(--radius);padding:1rem;border:2px solid var(--gold);">
                    <h4 style="color:var(--gold);">👑 Crown Spread</h4>
                    <div id="crown-spread-cards" style="display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center;padding:0.5rem;"></div>
                    <div id="crown-spread-interpretation" style="margin-top:0.5rem;color:var(--text2);"></div>
                </div>
            </div>
            
            <div class="panel">
                <h3 class="panel-title">📋 Quick Reference</h3>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.5rem;">
                    <div style="background:var(--bg3);padding:0.5rem;border-radius:var(--radius);border-left:3px solid var(--gold);">
                        <strong style="color:var(--gold);">1 SB</strong>
                        <div style="font-size:0.85rem;color:var(--text2);">Minor pressure, noise, tick timer +1</div>
                    </div>
                    <div style="background:var(--bg3);padding:0.5rem;border-radius:var(--radius);border-left:3px solid var(--orange);">
                        <strong style="color:var(--orange);">2 SB</strong>
                        <div style="font-size:0.85rem;color:var(--text2);">Moderate setback, alarm, lesser foe</div>
                    </div>
                    <div style="background:var(--bg3);padding:0.5rem;border-radius:var(--radius);border-left:3px solid var(--red);">
                        <strong style="color:var(--red);">3 SB</strong>
                        <div style="font-size:0.85rem;color:var(--text2);">Serious trouble, reinforcements, gear breaks</div>
                    </div>
                    <div style="background:var(--bg3);padding:0.5rem;border-radius:var(--radius);border-left:3px solid var(--purple);">
                        <strong style="color:var(--purple);">4+ SB</strong>
                        <div style="font-size:0.85rem;color:var(--text2);">Major turn, trap, authority arrives</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// MODULE LOADERS
// ============================================================

let moduleCache = {};

async function loadKanbanModule(containerEl) {
    try {
        if (moduleCache.kanban) {
            moduleCache.kanban.render(containerEl);
            return;
        }
        const module = await import('../kanban/index.js');
        moduleCache.kanban = module;
        module.render(containerEl);
    } catch (e) {
        console.error('Failed to load Kanban module:', e);
        containerEl.innerHTML = `
            <div class="panel">
                <h3 class="panel-title">📋 Kanban Board</h3>
                <p class="text-muted">Campaign and scene progress tracker.</p>
                <p class="text-muted" style="color:var(--red);">Error loading Kanban: ${e.message}</p>
                <button class="btn btn-sm btn-primary mt-1" onclick="window.loadKanban()">🔄 Retry</button>
            </div>
        `;
    }
}

async function loadWhiteboardModule(containerEl) {
    try {
        if (moduleCache.whiteboard) {
            moduleCache.whiteboard.render(containerEl);
            return;
        }
        const module = await import('../whiteboard/index.js');
        moduleCache.whiteboard = module;
        module.render(containerEl);
    } catch (e) {
        console.error('Failed to load Whiteboard module:', e);
        containerEl.innerHTML = `
            <div class="panel">
                <h3 class="panel-title">✏️ Whiteboard</h3>
                <p class="text-muted">Campaign whiteboard with drawing and notes.</p>
                <p class="text-muted" style="color:var(--red);">Error loading Whiteboard: ${e.message}</p>
                <button class="btn btn-sm btn-primary mt-1" onclick="window.loadWhiteboard()">🔄 Retry</button>
            </div>
        `;
    }
}

// Window exposures for retry
window.loadKanban = function() {
    const containerEl = document.getElementById('scene-view-container');
    if (containerEl) {
        loadKanbanModule(containerEl);
    }
};

window.loadWhiteboard = function() {
    const containerEl = document.getElementById('scene-view-container');
    if (containerEl) {
        loadWhiteboardModule(containerEl);
    }
};

// ============================================================
// WINDOW EXPOSURES (for onclick handlers)
// ============================================================

// Scene actions
window.sceneEndTrimBoons = sceneEndTrimBoons;
window.resetAllTimers = resetAllTimers;
window.newSession = newSession;

// Loaders
window.loadKanban = function() {
    const containerEl = document.getElementById('scene-view-container');
    if (containerEl) {
        loadKanbanModule(containerEl);
    }
};

window.loadWhiteboard = function() {
    const containerEl = document.getElementById('scene-view-container');
    if (containerEl) {
        loadWhiteboardModule(containerEl);
    }
};

window.openKanban = function() {
    const tab = document.querySelector('.scene-tab[data-view="kanban"]');
    if (tab) tab.click();
};

window.openWhiteboard = function() {
    const tab = document.querySelector('.scene-tab[data-view="whiteboard"]');
    if (tab) tab.click();
};

window.openCombatTracker = function() {
    import('../encounters/combat.js').then(module => {
        if (module.default?.openTracker) {
            module.default.openTracker(null);
        } else if (module.openTracker) {
            module.openTracker(null);
        } else {
            showToast('Combat tracker not available', 'error');
        }
    }).catch(() => {
        showToast('Combat tracker not available', 'error');
    });
};

window.addTimerFromScene = function() {
    import('../timers/index.js').then(module => {
        if (module.openTimerEditor) {
            module.openTimerEditor(null);
        } else {
            showToast('Timer module not available', 'error');
        }
    }).catch(() => {
        showToast('Timer module not available', 'error');
    });
};

window.addEncounterFromScene = function() {
    import('../encounters/index.js').then(module => {
        if (module.openEncounterEditor) {
            module.openEncounterEditor(null);
        } else {
            showToast('Encounter module not available', 'error');
        }
    }).catch(() => {
        showToast('Encounter module not available', 'error');
    });
};

window.openEncounterTracker = function(id) {
    import('../encounters/combat.js').then(module => {
        if (module.default?.openTracker) {
            module.default.openTracker(id);
        } else if (module.openTracker) {
            module.openTracker(id);
        } else {
            showToast('Combat tracker not available', 'error');
        }
    }).catch(() => {
        showToast('Combat tracker not available', 'error');
    });
};

window.tickTimer = function(id) {
    const state = getState();
    const timer = state.timers.find(t => t.id === id);
    if (timer) {
        timer.current = Math.min(timer.current + 1, timer.segments);
        saveState();
        if (timer.current >= timer.segments) {
            showToast(`⏱️ Timer "${timer.name}" completed!`, 'warning');
        }
        refreshView();
    }
};

// Kanban actions
window.addKanbanItem = function() {
    const title = prompt('Enter item title:');
    if (!title) return;
    const description = prompt('Enter description (optional):') || '';
    const column = prompt('Select column (todo/doing/done/blocked):', 'todo') || 'todo';
    if (!kanbanData.columns[column]) {
        showToast('Invalid column', 'error');
        return;
    }
    kanbanData.columns[column].items.push({ title, description, timer: null, encounter: null });
    saveCampaignData();
    refreshView();
    showToast(`📋 Added "${title}" to ${column}`, 'success');
};

window.moveKanbanItem = function(column, index, direction) {
    const cols = ['todo', 'doing', 'done', 'blocked'];
    const currentIdx = cols.indexOf(column);
    const newIdx = currentIdx + direction;
    if (newIdx < 0 || newIdx >= cols.length) {
        showToast('Cannot move further', 'warning');
        return;
    }
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
    const item = kanbanData.columns[column].items[index];
    kanbanData.columns[column].items.splice(index, 1);
    saveCampaignData();
    refreshView();
    showToast(`🗑️ Removed "${item.title}"`, 'info');
};

// Whiteboard actions
window.addWhiteboardNote = function() {
    const note = prompt('Enter note:');
    if (!note) return;
    whiteboardData.notes.push(note);
    saveCampaignData();
    refreshView();
    showToast('📝 Note added', 'success');
};

window.addWhiteboardSticky = function() {
    const title = prompt('Enter sticky title:') || 'Note';
    const content = prompt('Enter content:') || '';
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#dda0dd'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    whiteboardData.stickyNotes.push({ title, content, color });
    saveCampaignData();
    refreshView();
    showToast('📌 Sticky added', 'success');
};

window.removeWhiteboardNote = function(index) {
    whiteboardData.notes.splice(index, 1);
    saveCampaignData();
    refreshView();
};

window.removeWhiteboardSticky = function(index) {
    whiteboardData.stickyNotes.splice(index, 1);
    saveCampaignData();
    refreshView();
};

window.clearWhiteboard = function() {
    if (!confirm('Clear all whiteboard content?')) return;
    whiteboardData.notes = [];
    whiteboardData.stickyNotes = [];
    whiteboardData.drawings = [];
    saveCampaignData();
    refreshView();
    showToast('🧹 Whiteboard cleared', 'info');
};

// Campaign actions
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
    campaignState.activeThreats.push({ name, severity, description, timer: null });
    saveCampaignData();
    refreshView();
    showToast(`⚠️ Added threat: ${name}`, 'success');
};

window.removeCampaignThreat = function(index) {
    const threat = campaignState.activeThreats[index];
    if (!confirm(`Remove threat "${threat.name}"?`)) return;
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
    const opp = campaignState.opportunities[index];
    if (!confirm(`Remove opportunity "${opp.name}"?`)) return;
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
        if (timer.current >= timer.segments) {
            showToast(`⏱️ Campaign timer "${timer.name}" completed!`, 'warning');
        }
        refreshView();
    }
};

window.removeCampaignTimer = function(index) {
    const timer = campaignState.campaignTimers[index];
    if (!confirm(`Remove timer "${timer.name}"?`)) return;
    campaignState.campaignTimers.splice(index, 1);
    saveCampaignData();
    refreshView();
};

// Deck of Consequences / Crown Spread
window.drawConsequence = function(count = 1) {
    import('../decks/index.js').then(module => {
        if (module.drawConsequence) {
            module.drawConsequence(count);
        } else if (module.default?.drawConsequence) {
            module.default.drawConsequence(count);
        } else {
            showToast('Deck module not available', 'error');
        }
    }).catch(() => {
        showToast('Deck module not available', 'error');
    });
};

window.openCrownSpread = function() {
    import('../decks/index.js').then(module => {
        if (module.openCrownSpread) {
            module.openCrownSpread();
        } else if (module.default?.openCrownSpread) {
            module.default.openCrownSpread();
        } else {
            showToast('Crown Spread not available', 'error');
        }
    }).catch(() => {
        showToast('Crown Spread not available', 'error');
    });
};

window.shuffleDeck = function() {
    import('../decks/index.js').then(module => {
        if (module.resetDeck) {
            module.resetDeck();
            showToast('🔀 Deck shuffled', 'success');
        } else if (module.default?.resetDeck) {
            module.default.resetDeck();
            showToast('🔀 Deck shuffled', 'success');
        } else {
            showToast('Deck module not available', 'error');
        }
    }).catch(() => {
        showToast('Deck module not available', 'error');
    });
};

// ============================================================
// CORE FUNCTIONS (exported)
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
    if (trimmed > 0) {
        showToast(`Scene end: trimmed ${trimmed} excess Boons.`, 'success');
    } else {
        showToast('Scene end: all Boons already at 2 or below.', 'info');
    }
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
    if ((state.rollHistory || []).length === 0 && (state.chatHistory || []).length === 0) {
        showToast('No data to archive.', 'info');
        return;
    }
    
    const label = prompt('Session label:', `Session ${state.sessionId || 1}`) || `Session ${state.sessionId || 1}`;
    
    const archive = {
        id: Date.now(),
        timestamp: Date.now(),
        rollHistory: [...(state.rollHistory || [])],
        chatHistory: [...(state.chatHistory || [])],
        label: label
    };
    
    addArchive(archive);
    clearRollHistory();
    clearChatHistory();
    showToast('New session started; previous archived.', 'success');
}

// ============================================================
// VIEW MANAGEMENT
// ============================================================

function refreshView() {
    const containerEl = document.getElementById('scene-view-container');
    if (!containerEl) return;
    
    if (activeTab === 'kanban') {
        loadKanbanModule(containerEl);
    } else if (activeTab === 'whiteboard') {
        loadWhiteboardModule(containerEl);
    } else {
        containerEl.innerHTML = renderView(activeTab);
        attachEvents();
    }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    document.querySelectorAll('.scene-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            document.querySelectorAll('.scene-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const view = tab.dataset.view;
            const containerEl = document.getElementById('scene-view-container');
            
            if (!containerEl) return;
            
            activeTab = view;
            
            if (view === 'kanban') {
                await loadKanbanModule(containerEl);
            } else if (view === 'whiteboard') {
                await loadWhiteboardModule(containerEl);
            } else {
                containerEl.innerHTML = renderView(view);
                // Re-attach events for the new content
                attachEvents();
            }
        });
    });
}

// ============================================================
// LIFECYCLE METHODS
// ============================================================

export function onActivate() {
    console.log('[SceneTools] Activated');
    loadCampaignData();
}

export function onDeactivate() {
    console.log('[SceneTools] Deactivated');
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

// ============================================================
// EXPORTS
// ============================================================

export default {
    render,
    destroy,
    onActivate,
    onDeactivate,
    refresh,
    sceneEndTrimBoons,
    resetAllTimers,
    newSession
};