/**
 * Dashboard feature module - Comprehensive Campaign Dashboard
 * 
 * Integrates: Characters, Timers, Encounters, Factions, Patrons, 
 * Followers, Assets, Scene Tools, VTT, and Campaign Status
 */

import { getState, saveState } from '../../core/state.js';
import { escHtml } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';

let container = null;
let refreshInterval = null;

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    
    container.innerHTML = `
        <div class="dashboard-modern-layout">
            <!-- Header -->
            <header class="dashboard-header">
                <h1 class="page-title">📊 Campaign Dashboard</h1>
                <p class="page-sub">Quick overview of your campaign state and tools.</p>
                <div class="dashboard-status-bar">
                    <span class="status-badge" id="dash-status">● Live</span>
                    <span class="status-badge" id="dash-sync-status">● Local</span>
                    <span class="status-badge" id="dash-timestamp">Updated: ${new Date().toLocaleTimeString()}</span>
                </div>
            </header>

            <!-- Stats Grid -->
            <div class="dashboard-stats-grid" id="dash-stats">
                ${renderStats()}
            </div>

            <!-- Main Grid -->
            <div class="dashboard-main-grid">
                <!-- Left Column -->
                <div class="dashboard-left">
                    <!-- Characters -->
                    <div class="panel" id="dash-characters-panel">
                        <div class="panel-header">
                            <h3 class="panel-title">👤 Characters</h3>
                            <div class="panel-actions">
                                <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                                <button class="btn btn-sm btn-primary" onclick="window.openCharacterBuilder()">+ New</button>
                            </div>
                        </div>
                        <div id="dash-chars"><span class="text-muted">Loading…</span></div>
                    </div>

                    <!-- Active Timers -->
                    <div class="panel" id="dash-timers-panel">
                        <div class="panel-header">
                            <h3 class="panel-title">⏱️ Active Timers</h3>
                            <div class="panel-actions">
                                <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                                <button class="btn btn-sm btn-primary" onclick="window.addTimerFromDash()">+ Add</button>
                            </div>
                        </div>
                        <div id="dash-timers"><span class="text-muted">No active timers.</span></div>
                    </div>

                    <!-- Active Encounters -->
                    <div class="panel" id="dash-encounters-panel">
                        <div class="panel-header">
                            <h3 class="panel-title">⚔️ Active Encounters</h3>
                            <div class="panel-actions">
                                <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                                <button class="btn btn-sm btn-primary" onclick="window.addEncounterFromDash()">+ Add</button>
                            </div>
                        </div>
                        <div id="dash-encounters"><span class="text-muted">No active encounters.</span></div>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="dashboard-right">
                    <!-- Factions -->
                    <div class="panel" id="dash-factions-panel">
                        <div class="panel-header">
                            <h3 class="panel-title">🏛️ Factions</h3>
                            <div class="panel-actions">
                                <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                                <button class="btn btn-sm btn-primary" onclick="window.openFactions()">View All</button>
                            </div>
                        </div>
                        <div id="dash-factions"><span class="text-muted">No factions tracked.</span></div>
                    </div>

                    <!-- Patrons -->
                    <div class="panel" id="dash-patrons-panel">
                        <div class="panel-header">
                            <h3 class="panel-title">🌟 Patrons</h3>
                            <div class="panel-actions">
                                <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                                <button class="btn btn-sm btn-primary" onclick="window.openPatrons()">View All</button>
                            </div>
                        </div>
                        <div id="dash-patrons"><span class="text-muted">No patrons loaded.</span></div>
                    </div>

                    <!-- Followers & Assets -->
                    <div class="panel" id="dash-followers-assets-panel">
                        <div class="panel-header">
                            <h3 class="panel-title">👤 Followers & 📦 Assets</h3>
                            <div class="panel-actions">
                                <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                                <button class="btn btn-sm btn-primary" onclick="window.openFactions()">Manage</button>
                            </div>
                        </div>
                        <div id="dash-followers-assets"><span class="text-muted">No followers or assets.</span></div>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="panel" id="dash-actions-panel">
                <div class="panel-header">
                    <h3 class="panel-title">⚡ Quick Actions</h3>
                    <div class="panel-actions">
                        <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                    </div>
                </div>
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
                        <span class="qa-label">Kanban</span>
                        <span class="qa-desc">Campaign board</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.openWhiteboard()">
                        <span class="qa-icon">✏️</span>
                        <span class="qa-label">Whiteboard</span>
                        <span class="qa-desc">Visual planning</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.drawConsequence()">
                        <span class="qa-icon">🃏</span>
                        <span class="qa-label">Draw Consequence</span>
                        <span class="qa-desc">Deck of Consequences</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.openCrownSpread()">
                        <span class="qa-icon">👑</span>
                        <span class="qa-label">Crown Spread</span>
                        <span class="qa-desc">Campaign planning</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    update();
    startAutoRefresh();
    attachEvents();
}

// ============================================================
// STATS
// ============================================================

function renderStats() {
    const state = getState();
    const characters = state.characters || [];
    const timers = state.timers || [];
    const encounters = state.encounters || [];
    const factions = state.factions?.factions || [];
    const patrons = state.patrons?.cosmic || [];
    const followers = state.factions?.followers || [];
    const assets = state.factions?.assets || [];
    
    const activeTimers = timers.filter(t => t.current < t.segments);
    const completedTimers = timers.filter(t => t.current >= t.segments);
    
    return `
        <div class="stat-card">
            <span class="stat-icon">👤</span>
            <span class="stat-value">${characters.length}</span>
            <span class="stat-label">Characters</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">⏱️</span>
            <span class="stat-value">${activeTimers.length}</span>
            <span class="stat-label">Active Timers</span>
            <span class="stat-sub">${completedTimers.length} completed</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">⚔️</span>
            <span class="stat-value">${encounters.length}</span>
            <span class="stat-label">Encounters</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">🏛️</span>
            <span class="stat-value">${factions.length}</span>
            <span class="stat-label">Factions</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">🌟</span>
            <span class="stat-value">${patrons.length}</span>
            <span class="stat-label">Patrons</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">👤</span>
            <span class="stat-value">${followers.length}</span>
            <span class="stat-label">Followers</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">📦</span>
            <span class="stat-value">${assets.length}</span>
            <span class="stat-label">Assets</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">📊</span>
            <span class="stat-value">${state.rollHistory?.length || 0}</span>
            <span class="stat-label">Rolls</span>
            <span class="stat-sub">${state.chatHistory?.length || 0} chat</span>
        </div>
    `;
}

// ============================================================
// UPDATE
// ============================================================

export function update() {
    updateCharacters();
    updateTimers();
    updateEncounters();
    updateFactions();
    updatePatrons();
    updateFollowersAssets();
    updateStats();
}

function updateCharacters() {
    const state = getState();
    const el = document.getElementById('dash-chars');
    if (!el) return;
    
    const chars = state.characters || [];
    if (chars.length === 0) {
        el.innerHTML = '<span class="text-muted">No characters yet. Create one in the Character Builder!</span>';
        return;
    }
    
    el.innerHTML = chars.map(c => {
        const boons = c.boons || 0;
        const fatigue = c.fatigue || 0;
        const harm = c.harm || 0;
        const boonClass = boons >= 3 ? 'boon-high' : boons >= 1 ? 'boon-mid' : 'boon-low';
        const fatigueClass = fatigue >= 3 ? 'fatigue-high' : fatigue >= 1 ? 'fatigue-mid' : 'fatigue-low';
        
        return `
            <div class="dashboard-char-item" onclick="window.openCharacter('${c.id}')">
                <div class="char-info">
                    <span class="char-name">${escHtml(c.name || 'Unnamed')}</span>
                    <span class="char-detail">${escHtml(c.heritage || '')} · Tier ${c.tier || 'I'}</span>
                </div>
                <div class="char-stats">
                    <span class="char-stat boon ${boonClass}" title="Boons">🪙 ${boons}</span>
                    <span class="char-stat fatigue ${fatigueClass}" title="Fatigue">⚡ ${fatigue}</span>
                    <span class="char-stat harm" title="Harm">❤️ ${harm}</span>
                    ${c.vtt ? '<span class="char-stat vtt" title="VTT Connected">🟢</span>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

function updateTimers() {
    const state = getState();
    const el = document.getElementById('dash-timers');
    if (!el) return;
    
    const timers = state.timers || [];
    const active = timers.filter(t => t.current < t.segments);
    
    if (active.length === 0) {
        const completed = timers.filter(t => t.current >= t.segments);
        el.innerHTML = `<span class="text-muted">No active timers.${completed.length > 0 ? ` ${completed.length} completed.` : ''}</span>`;
        return;
    }
    
    el.innerHTML = active.map(t => {
        const pct = (t.current / t.segments) * 100;
        const isUrgent = pct >= 80;
        return `
            <div class="dashboard-timer-item">
                <div class="timer-info">
                    <span class="timer-name">${escHtml(t.name)}</span>
                    <span class="timer-progress-text">${t.current}/${t.segments}</span>
                </div>
                <div class="timer-bar-track">
                    <div class="timer-bar-fill ${isUrgent ? 'urgent' : ''}" style="width:${pct}%;"></div>
                </div>
                <div class="timer-actions">
                    <button class="btn btn-xs btn-ghost" onclick="window.tickTimer('${t.id}')">+1</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.completeTimer('${t.id}')">✓</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateEncounters() {
    const state = getState();
    const el = document.getElementById('dash-encounters');
    if (!el) return;
    
    const encounters = state.encounters || [];
    if (encounters.length === 0) {
        el.innerHTML = '<span class="text-muted">No active encounters. Create one in the Encounters module!</span>';
        return;
    }
    
    el.innerHTML = encounters.slice(0, 5).map(e => {
        const status = e.status || 'active';
        const statusClass = status === 'active' ? 'active' : status === 'resolved' ? 'resolved' : 'failed';
        const adversaryCount = e.adversaries?.length || 0;
        
        return `
            <div class="dashboard-encounter-item" onclick="window.openEncounter('${e.id}')">
                <div class="encounter-info">
                    <span class="encounter-name">${escHtml(e.name)}</span>
                    <span class="encounter-status ${statusClass}">${status}</span>
                </div>
                <div class="encounter-detail">
                    <span class="encounter-adversaries">👾 ${adversaryCount} adversaries</span>
                    ${e.location ? `<span class="encounter-location">📍 ${escHtml(e.location)}</span>` : ''}
                </div>
                <div class="encounter-actions">
                    <button class="btn btn-xs btn-primary" onclick="event.stopPropagation();window.openCombatTrackerForEncounter('${e.id}')">⚔️ Track</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateFactions() {
    const state = getState();
    const el = document.getElementById('dash-factions');
    if (!el) return;
    
    const factions = state.factions?.factions || [];
    if (factions.length === 0) {
        el.innerHTML = '<span class="text-muted">No factions tracked. Add some in the Factions module!</span>';
        return;
    }
    
    el.innerHTML = factions.slice(0, 4).map(f => {
        const standing = f.standing || 0;
        const standingLabel = standing >= 2 ? 'ally' : standing >= 1 ? 'friendly' : standing >= 0 ? 'neutral' : standing >= -1 ? 'unfriendly' : 'hostile';
        const standingColor = standing >= 2 ? 'var(--green)' : standing >= 1 ? '#8ac49a' : standing >= 0 ? 'var(--text2)' : standing >= -1 ? 'var(--orange)' : 'var(--red)';
        
        return `
            <div class="dashboard-faction-item" onclick="window.openFactionDetail('${f.id}')">
                <div class="faction-info">
                    <span class="faction-icon">${f.icon || '🏛️'}</span>
                    <span class="faction-name">${escHtml(f.name)}</span>
                    <span class="faction-standing" style="color:${standingColor};">${standingLabel}</span>
                </div>
                <div class="faction-agenda">${escHtml(f.agenda || 'No agenda')}</div>
                <div class="faction-timer-mini">
                    ⏱️ ${f.agendaTimer?.current || 0}/${f.agendaTimer?.segments || 6}
                    <div class="timer-bar-track mini">
                        <div class="timer-bar-fill" style="width:${((f.agendaTimer?.current || 0) / (f.agendaTimer?.segments || 6)) * 100}%;"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updatePatrons() {
    const state = getState();
    const el = document.getElementById('dash-patrons');
    if (!el) return;
    
    const patrons = state.patrons?.cosmic || [];
    if (patrons.length === 0) {
        el.innerHTML = '<span class="text-muted">No patrons loaded. Add some in the Patrons module!</span>';
        return;
    }
    
    el.innerHTML = patrons.slice(0, 4).map(p => {
        const ritesCount = p.rites?.length || 0;
        const rivalsCount = p.rivals?.length || 0;
        
        return `
            <div class="dashboard-patron-item" onclick="window.openPatronDetail('${p.id}')">
                <div class="patron-info">
                    <span class="patron-icon">${p.icon || '🌟'}</span>
                    <span class="patron-name">${escHtml(p.name)}</span>
                    <span class="patron-domain">${escHtml(p.domain || '')}</span>
                </div>
                <div class="patron-detail">
                    <span class="patron-rites">🔮 ${ritesCount} rites</span>
                    ${rivalsCount > 0 ? `<span class="patron-rivals">⚔️ ${rivalsCount} rivals</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function updateFollowersAssets() {
    const state = getState();
    const el = document.getElementById('dash-followers-assets');
    if (!el) return;
    
    const followers = state.factions?.followers || [];
    const assets = state.factions?.assets || [];
    
    if (followers.length === 0 && assets.length === 0) {
        el.innerHTML = '<span class="text-muted">No followers or assets tracked. Manage them in the Factions module!</span>';
        return;
    }
    
    let html = '';
    
    if (followers.length > 0) {
        html += `<div class="dash-followers-list">`;
        followers.slice(0, 3).forEach(f => {
            const loyalty = f.loyalty || 'faithful';
            const fitness = f.fitness || 'ready';
            const loyaltyEmoji = loyalty === 'faithful' ? '💚' : loyalty === 'strained' ? '⚠️' : '💔';
            const fitnessEmoji = fitness === 'ready' ? '✅' : fitness === 'hurt' ? '🩹' : '❌';
            
            html += `
                <div class="dash-follower-item">
                    <span class="follower-name">${escHtml(f.name)}</span>
                    <span class="follower-cap">Cap ${f.cap || 1}</span>
                    <span class="follower-state">${loyaltyEmoji} ${loyalty}</span>
                    <span class="follower-state">${fitnessEmoji} ${fitness}</span>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    if (assets.length > 0) {
        html += `<div class="dash-assets-list">`;
        assets.slice(0, 3).forEach(a => {
            const status = a.status || 'maintained';
            const statusEmoji = status === 'maintained' ? '✅' : status === 'neglected' ? '⚠️' : '❌';
            
            html += `
                <div class="dash-asset-item">
                    <span class="asset-name">${escHtml(a.name)}</span>
                    <span class="asset-tier">${a.tier || 'Minor'}</span>
                    <span class="asset-status">${statusEmoji} ${status}</span>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    el.innerHTML = html;
}

function updateStats() {
    const el = document.getElementById('dash-stats');
    if (el) {
        el.innerHTML = renderStats();
    }
}

// ============================================================
// AUTO REFRESH
// ============================================================

function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(() => {
        update();
    }, 30000); // Refresh every 30 seconds
}

// ============================================================
// WINDOW EXPOSURES
// ============================================================

window.dashboardRefresh = function() {
    update();
    showToast('🔄 Dashboard refreshed', 'info');
};

window.openCharacter = function(id) {
    document.querySelector('.sidebar-nav .nav-item[data-tab="characters"]')?.click();
    setTimeout(() => {
        import('../characters/index.js').then(module => {
            if (module.openEditor) {
                module.openEditor(id);
            }
        });
    }, 200);
};

window.openCharacterBuilder = function() {
    document.querySelector('.sidebar-nav .nav-item[data-tab="characters"]')?.click();
    setTimeout(() => {
        import('../characters/index.js').then(module => {
            if (module.openEditor) {
                module.openEditor(null);
            }
        });
    }, 200);
};

window.openFactions = function() {
    document.querySelector('.sidebar-nav .nav-item[data-tab="factions"]')?.click();
};

window.openPatrons = function() {
    document.querySelector('.sidebar-nav .nav-item[data-tab="patrons"]')?.click();
};

window.openFactionDetail = function(id) {
    document.querySelector('.sidebar-nav .nav-item[data-tab="factions"]')?.click();
    setTimeout(() => {
        import('../factions/index.js').then(module => {
            if (window.viewFaction) {
                window.viewFaction(id);
            }
        });
    }, 200);
};

window.openPatronDetail = function(id) {
    document.querySelector('.sidebar-nav .nav-item[data-tab="patrons"]')?.click();
    setTimeout(() => {
        import('../patrons/index.js').then(module => {
            if (window.viewPatron) {
                window.viewPatron(id);
            }
        });
    }, 200);
};

window.openEncounter = function(id) {
    document.querySelector('.sidebar-nav .nav-item[data-tab="encounters"]')?.click();
    setTimeout(() => {
        import('../encounters/index.js').then(module => {
            if (module.openEditor) {
                module.openEditor(id);
            }
        });
    }, 200);
};

window.addTimerFromDash = function() {
    import('../timers/index.js').then(module => {
        if (module.openTimerEditor) {
            module.openTimerEditor(null);
        }
    }).catch(() => {
        showToast('Timer module not available', 'error');
    });
};

window.addEncounterFromDash = function() {
    import('../encounters/index.js').then(module => {
        if (module.openEncounterEditor) {
            module.openEncounterEditor(null);
        }
    }).catch(() => {
        showToast('Encounter module not available', 'error');
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
        update();
    }
};

window.completeTimer = function(id) {
    const state = getState();
    const timer = state.timers.find(t => t.id === id);
    if (timer) {
        timer.current = timer.segments;
        saveState();
        showToast(`⏱️ Timer "${timer.name}" completed!`, 'success');
        update();
    }
};

window.openCombatTracker = function() {
    import('../encounters/combat.js').then(module => {
        if (module.default?.openTracker) {
            module.default.openTracker(null);
        }
    }).catch(() => {
        showToast('Combat tracker not available', 'error');
    });
};

window.openCombatTrackerForEncounter = function(id) {
    import('../encounters/combat.js').then(module => {
        if (module.default?.openTracker) {
            module.default.openTracker(id);
        }
    }).catch(() => {
        showToast('Combat tracker not available', 'error');
    });
};

window.openKanban = function() {
    document.querySelector('.sidebar-nav .nav-item[data-tab="scene-tools"]')?.click();
    setTimeout(() => {
        const container = document.getElementById('scene-view-container');
        if (container) {
            const kanbanTab = container.parentElement?.querySelector('.scene-tab[data-view="kanban"]');
            if (kanbanTab) kanbanTab.click();
        }
    }, 200);
};

window.openWhiteboard = function() {
    document.querySelector('.sidebar-nav .nav-item[data-tab="scene-tools"]')?.click();
    setTimeout(() => {
        const container = document.getElementById('scene-view-container');
        if (container) {
            const whiteboardTab = container.parentElement?.querySelector('.scene-tab[data-view="whiteboard"]');
            if (whiteboardTab) whiteboardTab.click();
        }
    }, 200);
};

window.sceneEndTrimBoons = function() {
    import('./scene-tools.js').then(module => {
        module.sceneEndTrimBoons();
        update();
    });
};

window.resetAllTimers = function() {
    import('./scene-tools.js').then(module => {
        module.resetAllTimers();
        update();
    });
};

window.newSession = function() {
    import('./scene-tools.js').then(module => {
        module.newSession();
        update();
    });
};

// In dashboard/index.js, update the drawConsequence function:

window.drawConsequence = function() {
    import('../decks/index.js').then(module => {
        // Try both default and named exports
        if (module.drawConsequence) {
            module.drawConsequence(1);
        } else if (module.default?.drawConsequence) {
            module.default.drawConsequence(1);
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

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    // Any additional event listeners can go here
}

// ============================================================
// LIFECYCLE METHODS
// ============================================================

export function onActivate() {
    console.log('[Dashboard] Activated');
    update();
    startAutoRefresh();
}

export function onDeactivate() {
    console.log('[Dashboard] Deactivated');
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

export function refresh() {
    update();
}

export function destroy() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    container = null;
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
    update
};