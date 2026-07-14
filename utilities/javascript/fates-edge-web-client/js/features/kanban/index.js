// features/kanban/index.js
/**
 * Kanban Board - Campaign & Scene Progress Tracker
 * 
 * Features:
 * - Three active clocks (Campaign, Scene, Situation) per GM Guide
 * - Task/Item tracking with status columns
 * - Timer integration for each card
 * - Drag-and-drop between columns (simple)
 * - Campaign progress visualization
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';

// ============================================================
// CONSTANTS
// ============================================================

const COLUMNS = {
    backlog: { title: '📋 Backlog', icon: '📋', color: '#6a6680' },
    planning: { title: '📝 Planning', icon: '📝', color: '#5a8ab5' },
    active: { title: '🔄 Active', icon: '🔄', color: '#d4af37' },
    blocked: { title: '🚫 Blocked', icon: '🚫', color: '#c45a5a' },
    review: { title: '👀 Review', icon: '👀', color: '#8b6bb5' },
    done: { title: '✅ Done', icon: '✅', color: '#6baa7a' }
};

const CLOCK_TYPES = {
    campaign: { label: 'Campaign', icon: '🏛️', desc: 'Long-term front pressure' },
    scene: { label: 'Scene', icon: '🎬', desc: 'Current scene timer' },
    situation: { label: 'Situation', icon: '⚡', desc: 'Immediate goal pressure' }
};

// ============================================================
// STATE
// ============================================================

let container = null;
let state = {
    items: [],
    clocks: [],
    viewMode: 'kanban' // kanban | clocks | timeline
};

// ============================================================
// LOAD/SAVE
// ============================================================

function loadKanbanData() {
    const saved = getState();
    if (saved.kanban) {
        state.items = saved.kanban.items || [];
        state.clocks = saved.kanban.clocks || [];
    } else {
        // Initialize with example data
        state.items = getDefaultItems();
        state.clocks = getDefaultClocks();
        saveKanbanData();
    }
}

function saveKanbanData() {
    const saved = getState();
    if (!saved.kanban) saved.kanban = {};
    saved.kanban.items = state.items;
    saved.kanban.clocks = state.clocks;
    saveState();
}

function getDefaultItems() {
    return [
        {
            id: 'item-1',
            title: 'Session Zero Prep',
            description: 'Create character sheets, set Lines & Veils, discuss campaign tone',
            column: 'planning',
            priority: 'high',
            timer: { segments: 4, current: 0 },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: ['session-zero', 'prep']
        },
        {
            id: 'item-2',
            title: 'The Crown Spread',
            description: 'Draw cards for campaign arc: Root, Crest, Crown, Left Hand, Wild',
            column: 'active',
            priority: 'high',
            timer: { segments: 6, current: 2 },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: ['crown-spread', 'planning']
        },
        {
            id: 'item-3',
            title: 'Faction Turn',
            description: 'Advance faction agendas and timers',
            column: 'backlog',
            priority: 'medium',
            timer: { segments: 4, current: 0 },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: ['factions', 'turn']
        },
        {
            id: 'item-4',
            title: 'Ritual Completion',
            description: 'Cult ritual timer - needs to be stopped before completion',
            column: 'active',
            priority: 'critical',
            timer: { segments: 6, current: 4 },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: ['timers', 'urgent']
        },
        {
            id: 'item-5',
            title: 'Travel to the Ford',
            description: 'Party is traveling to Valvano Ford - handle encounters',
            column: 'blocked',
            priority: 'medium',
            timer: { segments: 8, current: 3 },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: ['travel', 'encounters'],
            blockReason: 'Weather conditions - waiting for storm to pass'
        },
        {
            id: 'item-6',
            title: 'NPC: Tema\'s Background',
            description: 'Develop Tema\'s backstory and connections to the party',
            column: 'review',
            priority: 'low',
            timer: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: ['npcs', 'lore']
        },
        {
            id: 'item-7',
            title: 'Campaign Notes',
            description: 'Document session summary and update campaign worksheet',
            column: 'done',
            priority: 'low',
            timer: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: ['notes', 'documentation']
        }
    ];
}

function getDefaultClocks() {
    return [
        {
            id: 'clock-1',
            type: 'campaign',
            name: 'Cult Influence',
            segments: 8,
            current: 3,
            description: 'The cult is gaining power in the region',
            visible: true,
            color: '#c45a5a'
        },
        {
            id: 'clock-2',
            type: 'scene',
            name: 'Ritual Completion',
            segments: 6,
            current: 4,
            description: 'The ritual is nearing completion',
            visible: true,
            color: '#d4af37'
        },
        {
            id: 'clock-3',
            type: 'situation',
            name: 'Bridge Collapse',
            segments: 4,
            current: 1,
            description: 'The bridge is unstable and may collapse',
            visible: true,
            color: '#e8a07a'
        }
    ];
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    loadKanbanData();

    container.innerHTML = `
        <div class="kanban-modern-layout">
            <!-- Header -->
            <header class="kanban-header">
                <h1 class="kanban-title">📋 Campaign Board</h1>
                <p class="kanban-subtitle">Track campaign progress, timers, and scene clocks.</p>
            </header>

            <!-- Navigation Tabs -->
            <div class="kanban-tabs">
                <button class="kanban-tab active" data-view="kanban">📋 Board</button>
                <button class="kanban-tab" data-view="clocks">⏱️ Clocks</button>
                <button class="kanban-tab" data-view="timeline">📊 Timeline</button>
            </div>

            <!-- View Container -->
            <div id="kanban-view-container" class="kanban-view-container">
                ${renderView('kanban')}
            </div>

            <!-- Modals -->
            <div id="kanban-modal" class="kanban-modal" style="display:none;"></div>
        </div>
    `;

    attachEvents();
}

function renderView(view) {
    state.viewMode = view;
    switch(view) {
        case 'kanban': return renderKanbanView();
        case 'clocks': return renderClocksView();
        case 'timeline': return renderTimelineView();
        default: return renderKanbanView();
    }
}

// ============================================================
// KANBAN VIEW
// ============================================================

function renderKanbanView() {
    return `
        <div class="kanban-board-view">
            <div class="kanban-toolbar">
                <button class="btn btn-sm btn-primary" onclick="window.addKanbanItem()">➕ Add Item</button>
                <button class="btn btn-sm btn-secondary" onclick="window.refreshKanban()">🔄 Refresh</button>
                <span class="text-muted" style="font-size:0.8rem;">${state.items.length} items</span>
            </div>
            <div class="kanban-board-grid">
                ${Object.entries(COLUMNS).map(([key, col]) => {
                    const items = state.items.filter(i => i.column === key);
                    const totalItems = items.length;
                    const activeItems = items.filter(i => i.priority === 'critical' || i.priority === 'high').length;
                    
                    return `
                        <div class="kanban-col" data-column="${key}">
                            <div class="kanban-col-header" style="border-bottom:3px solid ${col.color};">
                                <span class="col-title">${col.icon} ${col.title}</span>
                                <span class="col-count">${totalItems}</span>
                                ${activeItems > 0 ? `<span class="col-active" style="color:${col.color};">⚡${activeItems}</span>` : ''}
                            </div>
                            <div class="kanban-col-items" data-column="${key}">
                                ${items.length === 0 ? `<div class="kanban-empty">Drop items here</div>` : ''}
                                ${items.map(item => renderCard(item)).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderCard(item) {
    const priorityColor = item.priority === 'critical' ? '#c45a5a' : 
                         item.priority === 'high' ? '#e8a07a' : 
                         item.priority === 'medium' ? '#d4af37' : '#6a6680';
    
    const priorityLabel = item.priority === 'critical' ? '🔥' :
                         item.priority === 'high' ? '⬆' :
                         item.priority === 'medium' ? '➖' : '⬇';
    
    const timerHtml = item.timer ? `
        <div class="card-timer">
            <div class="timer-track">
                <div class="timer-fill" style="width:${(item.timer.current / item.timer.segments) * 100}%;"></div>
            </div>
            <span class="timer-label">${item.timer.current}/${item.timer.segments}</span>
        </div>
    ` : '';

    const tagsHtml = (item.tags || []).slice(0, 3).map(t => 
        `<span class="card-tag">#${escHtml(t)}</span>`
    ).join('');

    const moreTags = (item.tags || []).length > 3 ? 
        `<span class="card-tag more">+${(item.tags || []).length - 3}</span>` : '';

    const blockHtml = item.blockReason ? `
        <div class="card-block-reason">🚫 ${escHtml(item.blockReason)}</div>
    ` : '';

    return `
        <div class="kanban-card" data-id="${item.id}" draggable="true">
            <div class="card-header">
                <span class="card-title">${escHtml(item.title)}</span>
                <span class="card-priority" style="color:${priorityColor};">${priorityLabel}</span>
            </div>
            <div class="card-description">${escHtml(item.description)}</div>
            ${blockHtml}
            ${timerHtml}
            <div class="card-footer">
                <div class="card-tags">${tagsHtml}${moreTags}</div>
                <div class="card-actions">
                    <button class="btn btn-xs btn-ghost" onclick="window.editKanbanItem('${item.id}')">✏️</button>
                    <button class="btn btn-xs btn-danger" onclick="window.deleteKanbanItem('${item.id}')">✕</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// CLOCKS VIEW
// ============================================================

function renderClocksView() {
    return `
        <div class="clocks-view">
            <div class="clocks-toolbar">
                <button class="btn btn-sm btn-primary" onclick="window.addClock()">➕ Add Clock</button>
                <button class="btn btn-sm btn-secondary" onclick="window.refreshKanban()">🔄 Refresh</button>
            </div>
            <div class="clocks-grid">
                ${state.clocks.map(clock => {
                    const clockType = CLOCK_TYPES[clock.type] || CLOCK_TYPES.situation;
                    const pct = (clock.current / clock.segments) * 100;
                    const isUrgent = pct >= 80;
                    const isFull = pct >= 100;
                    
                    return `
                        <div class="clock-card" onclick="window.viewClock('${clock.id}')">
                            <div class="clock-header">
                                <span class="clock-icon">${clockType.icon}</span>
                                <span class="clock-type">${clockType.label}</span>
                                <span class="clock-status ${isFull ? 'full' : isUrgent ? 'urgent' : 'active'}">
                                    ${isFull ? '⚠️ Full' : isUrgent ? '⚡ Urgent' : '⏳ Active'}
                                </span>
                            </div>
                            <div class="clock-name">${escHtml(clock.name)}</div>
                            <div class="clock-description">${escHtml(clock.description || '')}</div>
                            <div class="clock-progress">
                                <div class="clock-track">
                                    <div class="clock-fill ${isUrgent ? 'urgent' : ''}" style="width:${pct}%;"></div>
                                </div>
                                <span class="clock-value">${clock.current}/${clock.segments}</span>
                            </div>
                            <div class="clock-controls">
                                <button class="btn btn-xs btn-primary" onclick="event.stopPropagation();window.tickClock('${clock.id}')">+1</button>
                                <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();window.untickClock('${clock.id}')">-1</button>
                                <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();window.deleteClock('${clock.id}')">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
                ${state.clocks.length === 0 ? '<div class="text-muted" style="padding:2rem;text-align:center;">No clocks created yet. Add one to track campaign pressure.</div>' : ''}
            </div>
        </div>
    `;
}

// ============================================================
// TIMELINE VIEW
// ============================================================

function renderTimelineView() {
    // Group items by column for timeline view
    const columns = Object.keys(COLUMNS);
    const doneItems = state.items.filter(i => i.column === 'done');
    const activeItems = state.items.filter(i => i.column === 'active' || i.column === 'review');
    const backlogItems = state.items.filter(i => i.column === 'backlog' || i.column === 'planning');
    const blockedItems = state.items.filter(i => i.column === 'blocked');
    
    const total = state.items.length;
    const done = doneItems.length;
    const active = activeItems.length;
    const blocked = blockedItems.length;
    const backlog = backlogItems.length;
    
    const donePct = total > 0 ? (done / total) * 100 : 0;
    const activePct = total > 0 ? (active / total) * 100 : 0;
    const blockedPct = total > 0 ? (blocked / total) * 100 : 0;
    const backlogPct = total > 0 ? (backlog / total) * 100 : 0;

    return `
        <div class="timeline-view">
            <div class="timeline-stats">
                <div class="stat-card">
                    <span class="stat-value">${total}</span>
                    <span class="stat-label">Total Items</span>
                </div>
                <div class="stat-card" style="border-left:3px solid var(--green);">
                    <span class="stat-value">${done}</span>
                    <span class="stat-label">Done</span>
                </div>
                <div class="stat-card" style="border-left:3px solid var(--gold);">
                    <span class="stat-value">${active}</span>
                    <span class="stat-label">In Progress</span>
                </div>
                <div class="stat-card" style="border-left:3px solid var(--red);">
                    <span class="stat-value">${blocked}</span>
                    <span class="stat-label">Blocked</span>
                </div>
                <div class="stat-card" style="border-left:3px solid var(--text3);">
                    <span class="stat-value">${backlog}</span>
                    <span class="stat-label">Backlog</span>
                </div>
            </div>

            <div class="timeline-progress">
                <div class="progress-bar">
                    <div class="progress-segment done" style="width:${donePct}%;background:var(--green);" title="Done: ${donePct}%"></div>
                    <div class="progress-segment active" style="width:${activePct}%;background:var(--gold);" title="Active: ${activePct}%"></div>
                    <div class="progress-segment blocked" style="width:${blockedPct}%;background:var(--red);" title="Blocked: ${blockedPct}%"></div>
                    <div class="progress-segment backlog" style="width:${backlogPct}%;background:var(--text3);" title="Backlog: ${backlogPct}%"></div>
                </div>
                <div class="progress-labels">
                    <span>✅ Done (${Math.round(donePct)}%)</span>
                    <span>🔄 Active (${Math.round(activePct)}%)</span>
                    <span>🚫 Blocked (${Math.round(blockedPct)}%)</span>
                    <span>📋 Backlog (${Math.round(backlogPct)}%)</span>
                </div>
            </div>

            <div class="timeline-items">
                <h3 style="color:var(--gold);margin-bottom:0.5rem;">📋 Recent Activity</h3>
                ${state.items.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10).map(item => `
                    <div class="timeline-item" onclick="window.editKanbanItem('${item.id}')">
                        <span class="item-status ${item.column}">${COLUMNS[item.column]?.icon || '📋'}</span>
                        <span class="item-title">${escHtml(item.title)}</span>
                        <span class="item-date">${new Date(item.updatedAt).toLocaleDateString()}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ============================================================
// MODAL / DETAIL VIEWS
// ============================================================

function renderItemDetail(itemId) {
    const item = state.items.find(i => i.id === itemId);
    if (!item) {
        showToast('Item not found', 'error');
        return;
    }

    const modal = document.getElementById('kanban-modal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content item-detail">
            <button class="modal-close" onclick="window.closeKanbanModal()">✕</button>
            <div class="item-detail-header">
                <h2>${escHtml(item.title)}</h2>
                <span class="item-priority" style="color:${item.priority === 'critical' ? 'var(--red)' : item.priority === 'high' ? 'var(--orange)' : 'var(--text3)'};">${item.priority || 'Normal'}</span>
            </div>
            
            <div class="item-detail-body">
                <div class="item-detail-section">
                    <h3>📖 Description</h3>
                    <p>${escHtml(item.description || 'No description.')}</p>
                </div>
                
                <div class="item-detail-section">
                    <h3>📊 Status</h3>
                    <p>Column: ${COLUMNS[item.column]?.title || item.column}</p>
                    <p>Created: ${new Date(item.createdAt).toLocaleString()}</p>
                    <p>Updated: ${new Date(item.updatedAt).toLocaleString()}</p>
                </div>
                
                ${item.timer ? `
                <div class="item-detail-section">
                    <h3>⏱️ Timer</h3>
                    <div class="timer-display">
                        <span>${item.timer.current}/${item.timer.segments}</span>
                        <div class="timer-bar">
                            <div class="timer-bar-fill" style="width:${(item.timer.current / item.timer.segments) * 100}%;"></div>
                        </div>
                    </div>
                    <div class="timer-controls">
                        <button class="btn btn-sm btn-primary" onclick="window.tickItemTimer('${item.id}')">+1</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.resetItemTimer('${item.id}')">⟳ Reset</button>
                    </div>
                </div>
                ` : ''}
                
                ${item.blockReason ? `
                <div class="item-detail-section">
                    <h3>🚫 Blocked Reason</h3>
                    <p>${escHtml(item.blockReason)}</p>
                </div>
                ` : ''}
                
                <div class="item-detail-section">
                    <h3>🏷️ Tags</h3>
                    <div class="tag-list">
                        ${(item.tags || []).map(t => `<span class="tag">#${escHtml(t)}</span>`).join('')}
                        ${(item.tags || []).length === 0 ? '<span class="text-muted">No tags</span>' : ''}
                    </div>
                </div>
            </div>
            
            <div class="item-detail-actions">
                <button class="btn btn-primary" onclick="window.editKanbanItem('${item.id}')">✏️ Edit</button>
                <button class="btn btn-secondary" onclick="window.moveKanbanItem('${item.id}', 'left')">⬅️ Move Left</button>
                <button class="btn btn-secondary" onclick="window.moveKanbanItem('${item.id}', 'right')">➡️ Move Right</button>
                <button class="btn btn-danger" onclick="window.deleteKanbanItem('${item.id}')">🗑️ Delete</button>
                <button class="btn btn-ghost" onclick="window.closeKanbanModal()">Close</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeKanbanModal();
    });
}

function renderClockDetail(clockId) {
    const clock = state.clocks.find(c => c.id === clockId);
    if (!clock) {
        showToast('Clock not found', 'error');
        return;
    }

    const clockType = CLOCK_TYPES[clock.type] || CLOCK_TYPES.situation;
    const pct = (clock.current / clock.segments) * 100;

    const modal = document.getElementById('kanban-modal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content clock-detail">
            <button class="modal-close" onclick="window.closeKanbanModal()">✕</button>
            <div class="clock-detail-header">
                <span class="clock-icon-large">${clockType.icon}</span>
                <div>
                    <h2>${escHtml(clock.name)}</h2>
                    <div class="clock-detail-type">${clockType.label} Clock</div>
                </div>
            </div>
            
            <div class="clock-detail-body">
                <div class="clock-detail-section">
                    <h3>📖 Description</h3>
                    <p>${escHtml(clock.description || 'No description.')}</p>
                </div>
                
                <div class="clock-detail-section">
                    <h3>⏱️ Progress</h3>
                    <div class="clock-progress-large">
                        <div class="clock-track">
                            <div class="clock-fill" style="width:${pct}%;background:${pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--orange)' : 'var(--gold)'};"></div>
                        </div>
                        <span class="clock-value">${clock.current}/${clock.segments}</span>
                    </div>
                    <div class="timer-controls">
                        <button class="btn btn-sm btn-primary" onclick="window.tickClock('${clock.id}')">+1</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.untickClock('${clock.id}')">-1</button>
                        <button class="btn btn-sm btn-warning" onclick="window.resetClock('${clock.id}')">⟳ Reset</button>
                    </div>
                </div>
            </div>
            
            <div class="clock-detail-actions">
                <button class="btn btn-primary" onclick="window.editClock('${clock.id}')">✏️ Edit</button>
                <button class="btn btn-danger" onclick="window.deleteClock('${clock.id}')">🗑️ Delete</button>
                <button class="btn btn-ghost" onclick="window.closeKanbanModal()">Close</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeKanbanModal();
    });
}

// ============================================================
// WINDOW EXPOSURES
// ============================================================

window.closeKanbanModal = function() {
    document.getElementById('kanban-modal').style.display = 'none';
};

window.viewKanbanItem = function(id) {
    renderItemDetail(id);
};

window.viewClock = function(id) {
    renderClockDetail(id);
};

window.addKanbanItem = function() {
    const title = prompt('Enter item title:');
    if (!title) return;
    const description = prompt('Enter description:') || '';
    const column = prompt('Enter column (backlog/planning/active/blocked/review/done):', 'backlog') || 'backlog';
    const priority = prompt('Enter priority (critical/high/medium/low):', 'medium') || 'medium';
    const hasTimer = confirm('Add a timer?');
    let timer = null;
    if (hasTimer) {
        const segments = parseInt(prompt('Timer segments (4,6,8,10):', '4') || '4');
        timer = { segments, current: 0 };
    }

    state.items.push({
        id: 'item-' + Date.now(),
        title,
        description,
        column,
        priority,
        timer,
        tags: prompt('Tags (comma-separated):')?.split(',').map(t => t.trim()).filter(Boolean) || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        blockReason: column === 'blocked' ? prompt('Blocked reason:') || '' : ''
    });
    saveKanbanData();
    refreshView();
    showToast(`📋 Added "${title}"`, 'success');
};

window.editKanbanItem = function(id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    const title = prompt('Enter title:', item.title);
    if (!title) return;
    item.title = title;
    item.description = prompt('Enter description:', item.description) || item.description;
    item.column = prompt('Enter column (backlog/planning/active/blocked/review/done):', item.column) || item.column;
    item.priority = prompt('Enter priority (critical/high/medium/low):', item.priority) || 'medium';
    if (item.column === 'blocked') {
        item.blockReason = prompt('Blocked reason:', item.blockReason) || '';
    }
    item.updatedAt = Date.now();
    saveKanbanData();
    refreshView();
    closeKanbanModal();
    showToast(`✏️ Updated "${title}"`, 'success');
};

window.deleteKanbanItem = function(id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    if (!confirm(`Delete "${item.title}"?`)) return;
    state.items = state.items.filter(i => i.id !== id);
    saveKanbanData();
    refreshView();
    closeKanbanModal();
    showToast(`🗑️ Deleted "${item.title}"`, 'info');
};

window.moveKanbanItem = function(id, direction) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    const columns = ['backlog', 'planning', 'active', 'review', 'done'];
    const currentIdx = columns.indexOf(item.column);
    if (currentIdx === -1) return;
    const newIdx = direction === 'left' ? currentIdx - 1 : currentIdx + 1;
    if (newIdx < 0 || newIdx >= columns.length) {
        showToast('Cannot move further', 'warning');
        return;
    }
    // Skip blocked column - items in blocked stay blocked until unblocked
    const targetCol = columns[newIdx];
    if (targetCol === 'blocked' && direction !== 'left') {
        showToast('Item must be moved to blocked manually with a reason', 'warning');
        return;
    }
    item.column = targetCol;
    item.updatedAt = Date.now();
    if (targetCol === 'blocked' && !item.blockReason) {
        item.blockReason = prompt('Blocked reason:') || 'Blocked';
    }
    if (targetCol !== 'blocked') {
        item.blockReason = '';
    }
    saveKanbanData();
    refreshView();
    closeKanbanModal();
    showToast(`📋 Moved "${item.title}" to ${COLUMNS[targetCol]?.title || targetCol}`, 'success');
};

window.tickItemTimer = function(id) {
    const item = state.items.find(i => i.id === id);
    if (!item || !item.timer) return;
    item.timer.current = Math.min(item.timer.current + 1, item.timer.segments);
    item.updatedAt = Date.now();
    saveKanbanData();
    refreshView();
    if (item.timer.current >= item.timer.segments) {
        showToast(`⏱️ Timer for "${item.title}" completed!`, 'warning');
    }
};

window.resetItemTimer = function(id) {
    const item = state.items.find(i => i.id === id);
    if (!item || !item.timer) return;
    item.timer.current = 0;
    item.updatedAt = Date.now();
    saveKanbanData();
    refreshView();
    closeKanbanModal();
    showToast(`⟳ Timer reset for "${item.title}"`, 'info');
};

// Clock functions
window.addClock = function() {
    const type = prompt('Enter clock type (campaign/scene/situation):', 'situation') || 'situation';
    const name = prompt('Enter clock name:');
    if (!name) return;
    const segments = parseInt(prompt('Segments (4/6/8/10):', '6') || '6');
    const description = prompt('Description:') || '';
    
    state.clocks.push({
        id: 'clock-' + Date.now(),
        type,
        name,
        segments,
        current: 0,
        description,
        visible: true,
        color: type === 'campaign' ? '#c45a5a' : type === 'scene' ? '#d4af37' : '#e8a07a'
    });
    saveKanbanData();
    refreshView();
    showToast(`⏱️ Added "${name}" clock`, 'success');
};

window.editClock = function(id) {
    const clock = state.clocks.find(c => c.id === id);
    if (!clock) return;
    const name = prompt('Enter name:', clock.name);
    if (!name) return;
    clock.name = name;
    clock.type = prompt('Enter type (campaign/scene/situation):', clock.type) || clock.type;
    clock.segments = parseInt(prompt('Segments:', clock.segments) || '6');
    clock.description = prompt('Description:', clock.description) || '';
    saveKanbanData();
    refreshView();
    closeKanbanModal();
    showToast(`✏️ Updated "${name}" clock`, 'success');
};

window.deleteClock = function(id) {
    const clock = state.clocks.find(c => c.id === id);
    if (!clock) return;
    if (!confirm(`Delete clock "${clock.name}"?`)) return;
    state.clocks = state.clocks.filter(c => c.id !== id);
    saveKanbanData();
    refreshView();
    closeKanbanModal();
    showToast(`🗑️ Deleted "${clock.name}" clock`, 'info');
};

window.tickClock = function(id) {
    const clock = state.clocks.find(c => c.id === id);
    if (!clock) return;
    clock.current = Math.min(clock.current + 1, clock.segments);
    saveKanbanData();
    refreshView();
    if (clock.current >= clock.segments) {
        showToast(`⏱️ Clock "${clock.name}" completed!`, 'warning');
    }
};

window.untickClock = function(id) {
    const clock = state.clocks.find(c => c.id === id);
    if (!clock) return;
    clock.current = Math.max(clock.current - 1, 0);
    saveKanbanData();
    refreshView();
};

window.resetClock = function(id) {
    const clock = state.clocks.find(c => c.id === id);
    if (!clock) return;
    clock.current = 0;
    saveKanbanData();
    refreshView();
    closeKanbanModal();
    showToast(`⟳ Clock "${clock.name}" reset`, 'info');
};

window.refreshKanban = function() {
    loadKanbanData();
    refreshView();
    showToast('🔄 Kanban refreshed', 'success');
};

// ============================================================
// VIEW MANAGEMENT
// ============================================================

function refreshView() {
    const container = document.getElementById('kanban-view-container');
    if (container) {
        container.innerHTML = renderView(state.viewMode);
        attachEvents();
    }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    document.querySelectorAll('.kanban-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.kanban-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const view = tab.dataset.view;
            const container = document.getElementById('kanban-view-container');
            if (container) {
                container.innerHTML = renderView(view);
                attachEvents();
            }
        });
    });

    // Drag and drop support
    document.querySelectorAll('.kanban-card[draggable="true"]').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.dataset.id);
            card.style.opacity = '0.5';
        });
        card.addEventListener('dragend', (e) => {
            card.style.opacity = '1';
        });
    });

    document.querySelectorAll('.kanban-col-items').forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.style.background = 'var(--bg4)';
        });
        zone.addEventListener('dragleave', (e) => {
            zone.style.background = '';
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.style.background = '';
            const itemId = e.dataTransfer.getData('text/plain');
            const column = zone.dataset.column;
            const item = state.items.find(i => i.id === itemId);
            if (item && item.column !== column) {
                // Skip blocked column check
                if (column === 'blocked') {
                    const reason = prompt('Blocked reason:') || 'Blocked';
                    item.blockReason = reason;
                } else {
                    item.blockReason = '';
                }
                item.column = column;
                item.updatedAt = Date.now();
                saveKanbanData();
                refreshView();
                showToast(`📋 Moved "${item.title}" to ${COLUMNS[column]?.title || column}`, 'success');
            }
        });
    });
}

// ============================================================
// LIFECYCLE METHODS
// ============================================================

export function onActivate() {
    console.log('[Kanban] Activated');
    loadKanbanData();
}

export function onDeactivate() {
    console.log('[Kanban] Deactivated');
    saveKanbanData();
}

export function refresh() {
    loadKanbanData();
    refreshView();
}

export function destroy() {
    container = null;
    saveKanbanData();
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
    loadKanbanData,
    saveKanbanData
};
