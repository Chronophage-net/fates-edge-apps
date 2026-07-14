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
    notes: ''
};

// ============================================================
// LOAD/SAVE
// ============================================================

function loadCampaignData() {
    const saved = getState();
    if (saved.campaign) {
        whiteboardData = saved.campaign.whiteboard || { notes: [], drawings: [], stickyNotes: [] };
        kanbanData = saved.campaign.kanban || { columns: { todo: { title: '📋 To Do', items: [] }, doing: { title: '🔄 Doing', items: [] }, done: { title: '✅ Done', items: [] }, blocked: { title: '🚫 Blocked', items: [] } } };
        campaignState = saved.campaign.state || { activeThreats: [], opportunities: [], campaignTimers: [], notes: '' };
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
// KANBAN VIEW
// ============================================================

function renderKanbanView() {
    const columns = kanbanData.columns;
    
    return `
        <div class="kanban-view">
            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">📋 Campaign Kanban</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addKanbanItem()">+ Add Item</button>
                </div>
                <div class="kanban-board">
                    ${Object.entries(columns).map(([key, col]) => `
                        <div class="kanban-column" data-column="${key}">
                            <div class="kanban-column-header">${col.title}</div>
                            <div class="kanban-column-items">
                                ${col.items.length === 0 ? '<p class="text-muted" style="font-size:0.8rem;padding:0.5rem;">Empty</p>' : ''}
                                ${col.items.map((item, idx) => `
                                    <div class="kanban-item" data-column="${key}" data-index="${idx}">
                                        <div class="kanban-item-title">${escHtml(item.title)}</div>
                                        ${item.description ? `<div class="kanban-item-desc">${escHtml(item.description)}</div>` : ''}
                                        <div class="kanban-item-actions">
                                            ${item.timer ? `<span class="kanban-timer">⏱️ ${item.timer}</span>` : ''}
                                            ${item.encounter ? `<span class="kanban-encounter">⚔️ ${item.encounter}</span>` : ''}
                                            <button class="btn btn-xs btn-ghost" onclick="window.moveKanbanItem('${key}', ${idx}, -1)">←</button>
                                            <button class="btn btn-xs btn-ghost" onclick="window.moveKanbanItem('${key}', ${idx}, 1)">→</button>
                                            <button class="btn btn-xs btn-danger" onclick="window.removeKanbanItem('${key}', ${idx})">✕</button>
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
        <div class="whiteboard-view">
            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">✏️ Campaign Whiteboard</h3>
                    <div class="whiteboard-actions">
                        <button class="btn btn-sm btn-primary" onclick="window.addWhiteboardNote()">+ Note</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.addWhiteboardSticky()">📌 Sticky</button>
                        <button class="btn btn-sm btn-danger" onclick="window.clearWhiteboard()">🗑️ Clear</button>
                    </div>
                </div>
                <div class="whiteboard-grid">
                    ${whiteboardData.notes.map((note, idx) => `
                        <div class="whiteboard-note">
                            <div class="whiteboard-note-content">${escHtml(note)}</div>
                            <button class="btn btn-xs btn-danger" onclick="window.removeWhiteboardNote(${idx})">✕</button>
                        </div>
                    `).join('')}
                    ${whiteboardData.stickyNotes.map((sticky, idx) => `
                        <div class="whiteboard-sticky" style="background:${sticky.color || '#ffd700'};">
                            <div class="whiteboard-sticky-title">${escHtml(sticky.title || 'Note')}</div>
                            <div class="whiteboard-sticky-content">${escHtml(sticky.content || '')}</div>
                            <button class="btn btn-xs btn-danger" onclick="window.removeWhiteboardSticky(${idx})">✕</button>
                        </div>
                    `).join('')}
                    ${whiteboardData.notes.length === 0 && whiteboardData.stickyNotes.length === 0 ? '<p class="text-muted">Whiteboard is empty. Add notes or stickies!</p>' : ''}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// CAMPAIGN VIEW
// ============================================================

function renderCampaignView() {
    const threats = campaignState.activeThreats || [];
    const opportunities = campaignState.opportunities || [];
    const timers = campaignState.campaignTimers || [];

    return `
        <div class="campaign-view">
            <!-- Campaign Notes -->
            <div class="panel">
                <h3 class="panel-title">📝 Campaign Notes</h3>
                <textarea id="campaign-notes" rows="4" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.75rem;color:var(--text);font-family:var(--font);">
                    ${escHtml(campaignState.notes || '')}
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
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    document.querySelectorAll('.scene-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.scene-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const view = tab.dataset.view;
            const container = document.getElementById('scene-view-container');
            if (container) {
                container.innerHTML = renderView(view);
                attachEvents();
            }
        });
    });
}

// ============================================================
// WINDOW EXPOSURES (for onclick handlers)
// ============================================================

// Scene actions
window.sceneEndTrimBoons = sceneEndTrimBoons;
window.resetAllTimers = resetAllTimers;
window.newSession = newSession;

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
        const container = document.getElementById('scene-view-container');
        if (container) {
            container.innerHTML = renderView(activeTab);
            attachEvents();
        }
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
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('kanban');
        attachEvents();
    }
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
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('kanban');
        attachEvents();
    }
    showToast(`📋 Moved to ${targetCol}`, 'success');
};

window.removeKanbanItem = function(column, index) {
    if (!confirm('Remove this item?')) return;
    const item = kanbanData.columns[column].items[index];
    kanbanData.columns[column].items.splice(index, 1);
    saveCampaignData();
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('kanban');
        attachEvents();
    }
    showToast(`🗑️ Removed "${item.title}"`, 'info');
};

// Whiteboard actions
window.addWhiteboardNote = function() {
    const note = prompt('Enter note:');
    if (!note) return;
    whiteboardData.notes.push(note);
    saveCampaignData();
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('whiteboard');
        attachEvents();
    }
    showToast('📝 Note added', 'success');
};

window.addWhiteboardSticky = function() {
    const title = prompt('Enter sticky title:') || 'Note';
    const content = prompt('Enter content:') || '';
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#dda0dd'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    whiteboardData.stickyNotes.push({ title, content, color });
    saveCampaignData();
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('whiteboard');
        attachEvents();
    }
    showToast('📌 Sticky added', 'success');
};

window.removeWhiteboardNote = function(index) {
    whiteboardData.notes.splice(index, 1);
    saveCampaignData();
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('whiteboard');
        attachEvents();
    }
};

window.removeWhiteboardSticky = function(index) {
    whiteboardData.stickyNotes.splice(index, 1);
    saveCampaignData();
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('whiteboard');
        attachEvents();
    }
};

window.clearWhiteboard = function() {
    if (!confirm('Clear all whiteboard content?')) return;
    whiteboardData.notes = [];
    whiteboardData.stickyNotes = [];
    whiteboardData.drawings = [];
    saveCampaignData();
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('whiteboard');
        attachEvents();
    }
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
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('campaign');
        attachEvents();
    }
    showToast(`⚠️ Added threat: ${name}`, 'success');
};

window.removeCampaignThreat = function(index) {
    const threat = campaignState.activeThreats[index];
    if (!confirm(`Remove threat "${threat.name}"?`)) return;
    campaignState.activeThreats.splice(index, 1);
    saveCampaignData();
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('campaign');
        attachEvents();
    }
};

window.addCampaignOpportunity = function() {
    const name = prompt('Enter opportunity name:');
    if (!name) return;
    const description = prompt('Description:') || '';
    campaignState.opportunities.push({ name, description });
    saveCampaignData();
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('campaign');
        attachEvents();
    }
    showToast(`🌟 Added opportunity: ${name}`, 'success');
};

window.removeCampaignOpportunity = function(index) {
    const opp = campaignState.opportunities[index];
    if (!confirm(`Remove opportunity "${opp.name}"?`)) return;
    campaignState.opportunities.splice(index, 1);
    saveCampaignData();
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('campaign');
        attachEvents();
    }
};

window.addCampaignTimer = function() {
    const name = prompt('Enter timer name:');
    if (!name) return;
    const segments = parseInt(prompt('Segments:', '6') || '6');
    campaignState.campaignTimers.push({ name, segments, current: 0 });
    saveCampaignData();
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('campaign');
        attachEvents();
    }
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
        const container = document.getElementById('scene-view-container');
        if (container) {
            container.innerHTML = renderView('campaign');
            attachEvents();
        }
    }
};

window.removeCampaignTimer = function(index) {
    const timer = campaignState.campaignTimers[index];
    if (!confirm(`Remove timer "${timer.name}"?`)) return;
    campaignState.campaignTimers.splice(index, 1);
    saveCampaignData();
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView('campaign');
        attachEvents();
    }
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
    const container = document.getElementById('scene-view-container');
    if (container) {
        container.innerHTML = renderView(activeTab);
        attachEvents();
    }
}

export function destroy() {
    container = null;
    saveCampaignData();
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