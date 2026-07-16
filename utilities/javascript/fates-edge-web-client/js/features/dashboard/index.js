/**
 * Dashboard feature module - Comprehensive Campaign Dashboard
 * 
 * Integrates: Characters, Timers, Encounters, Factions, Patrons, 
 * Followers, Assets, Scene Tools, VTT, and Campaign Status
 */

import { getState, saveState } from '../../core/state.js';
import { escHtml } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { getSelectedRegion, getRegionNames, quickDraw, quickCrownSpread, setSelectedRegion, registerRegionChange } from '../decks/index.js';

let container = null;
let refreshInterval = null;

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    
    const selectedRegion = getSelectedRegion() || 'Acasia';
    const regionNames = getRegionNames();
    const regions = regionNames.length > 0 ? regionNames : ['Acasia'];
    
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

            <!-- Quick Actions with Region Selector -->
            <div class="panel" id="dash-actions-panel">
                <div class="panel-header">
                    <h3 class="panel-title">⚡ Quick Actions</h3>
                    <div class="panel-actions">
                        <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                    </div>
                </div>
                
                <!-- Region Selector Bar -->
                <div class="quick-actions-region-bar" style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;padding:0.4rem 0.8rem;margin-bottom:0.5rem;background:var(--bg3);border-radius:var(--radius);border-left:3px solid var(--gold);">
                    <span style="font-size:0.8rem;color:var(--text2);">📍 Region:</span>
                    <select id="dashboard-region-select" style="background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.15rem 0.4rem;font-size:0.8rem;min-width:100px;">
                        ${regions.map(name => `
                            <option value="${name}" ${name === selectedRegion ? 'selected' : ''}>${name}</option>
                        `).join('')}
                    </select>
                    <span style="font-size:0.65rem;color:var(--text3);" id="dashboard-region-indicator">📍 ${selectedRegion}</span>
                    <div style="display:flex;gap:0.2rem;flex-wrap:wrap;margin-left:auto;">
                        <button class="btn btn-xs btn-gold quick-draw-btn" data-count="1">🃏 1</button>
                        <button class="btn btn-xs btn-gold quick-draw-btn" data-count="2">🃏 2</button>
                        <button class="btn btn-xs btn-gold quick-draw-btn" data-count="3">🃏 3</button>
                        <button class="btn btn-xs btn-primary quick-crown-btn">👑 Crown</button>
                    </div>
                </div>
                
                <!-- Quick Action Buttons -->
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
        </div>
    `;
    
    // Inject dashboard styles
    injectDashboardStyles();
    
    update();
    startAutoRefresh();
    attachEvents();
    attachQuickActionsEvents();
}

// ============================================================
// INJECT STYLES
// ============================================================

function injectDashboardStyles() {
    const styleId = 'dashboard-modern-styles';
    if (document.getElementById(styleId)) return;
    
    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
        /* Dashboard Modern Layout */
        .dashboard-modern-layout {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            padding: 0.5rem 0;
        }
        
        .dashboard-header {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: var(--bg2);
            border-radius: var(--radius);
            border: 1px solid var(--border);
        }
        
        .dashboard-status-bar {
            display: flex;
            gap: 0.8rem;
            font-size: 0.7rem;
            color: var(--text2);
            background: var(--bg3);
            padding: 0.2rem 0.8rem;
            border-radius: 20px;
        }
        
        .dashboard-status-bar .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
        }
        
        .dashboard-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 0.8rem;
        }
        
        .stat-card {
            background: var(--bg2);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 0.8rem 0.6rem;
            text-align: center;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }
        
        .stat-card::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--gold), var(--accent), var(--gold));
            opacity: 0.3;
        }
        
        .stat-card:hover {
            transform: translateY(-2px);
            border-color: var(--gold);
            box-shadow: 0 4px 20px rgba(212,175,55,0.15);
        }
        
        .stat-icon {
            display: block;
            font-size: 1.8rem;
            margin-bottom: 0.2rem;
        }
        
        .stat-value {
            display: block;
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--gold);
            line-height: 1.2;
        }
        
        .stat-label {
            display: block;
            font-size: 0.7rem;
            color: var(--text2);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-top: 0.15rem;
        }
        
        .stat-sub {
            display: block;
            font-size: 0.6rem;
            color: var(--text3);
            margin-top: 0.1rem;
        }
        
        .dashboard-main-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }
        
        @media (max-width: 768px) {
            .dashboard-main-grid {
                grid-template-columns: 1fr;
            }
        }
        
        .panel {
            background: var(--bg2);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 0.8rem 1rem;
        }
        
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        
        .panel-title {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text);
        }
        
        .panel-actions {
            display: flex;
            gap: 0.3rem;
        }
        
        .quick-actions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 0.4rem;
            margin: 0.5rem 0 0.2rem;
        }
        
        .quick-action-btn {
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 0.4rem 0.6rem;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            color: var(--text);
            font-family: var(--font);
        }
        
        .quick-action-btn:hover {
            border-color: var(--gold);
            background: var(--bg4);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .qa-icon {
            font-size: 1.4rem;
            line-height: 1.2;
        }
        
        .qa-label {
            font-size: 0.75rem;
            font-weight: 600;
            margin: 0.1rem 0;
        }
        
        .qa-desc {
            font-size: 0.6rem;
            color: var(--text2);
        }
        
        /* Dashboard items */
        .dashboard-char-item, .dashboard-timer-item, .dashboard-encounter-item,
        .dashboard-faction-item, .dashboard-patron-item {
            padding: 0.3rem 0.4rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 0.2rem 0.5rem;
            cursor: pointer;
            transition: background 0.15s;
        }
        
        .dashboard-char-item:hover, .dashboard-encounter-item:hover,
        .dashboard-faction-item:hover, .dashboard-patron-item:hover {
            background: var(--bg3);
        }
        
        .char-info, .encounter-info, .faction-info, .patron-info {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            flex-wrap: wrap;
        }
        
        .char-name, .encounter-name, .faction-name, .patron-name {
            font-weight: 500;
            color: var(--text);
        }
        
        .char-detail, .encounter-location, .patron-domain {
            font-size: 0.7rem;
            color: var(--text2);
        }
        
        .char-stats, .encounter-detail {
            display: flex;
            gap: 0.4rem;
            align-items: center;
        }
        
        .char-stat {
            font-size: 0.7rem;
            padding: 0.05rem 0.3rem;
            border-radius: 12px;
            background: var(--bg3);
            color: var(--text2);
        }
        
        .char-stat.boon-high { color: var(--gold); }
        .char-stat.boon-mid { color: #8ac49a; }
        .char-stat.boon-low { color: var(--text3); }
        .char-stat.fatigue-high { color: var(--red); }
        .char-stat.fatigue-mid { color: var(--orange); }
        .char-stat.fatigue-low { color: var(--text3); }
        .char-stat.harm { color: var(--red); }
        .char-stat.vtt { color: var(--green); }
        
        .timer-info {
            display: flex;
            justify-content: space-between;
            width: 100%;
        }
        
        .timer-name {
            font-weight: 500;
            color: var(--text);
            font-size: 0.85rem;
        }
        
        .timer-progress-text {
            font-size: 0.7rem;
            color: var(--text2);
        }
        
        .timer-bar-track {
            width: 100%;
            height: 4px;
            background: var(--bg4);
            border-radius: 2px;
            overflow: hidden;
            margin: 0.15rem 0;
        }
        
        .timer-bar-fill {
            height: 100%;
            background: var(--gold);
            border-radius: 2px;
            transition: width 0.3s ease;
        }
        
        .timer-bar-fill.urgent {
            background: var(--red);
            animation: pulse-urgent 1s ease-in-out infinite;
        }
        
        @keyframes pulse-urgent {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .timer-actions {
            display: flex;
            gap: 0.2rem;
        }
        
        .encounter-status {
            font-size: 0.6rem;
            text-transform: uppercase;
            padding: 0.05rem 0.5rem;
            border-radius: 12px;
            font-weight: 600;
        }
        
        .encounter-status.active { background: var(--green); color: #fff; }
        .encounter-status.resolved { background: var(--gold); color: #1a1a2e; }
        .encounter-status.failed { background: var(--red); color: #fff; }
        
        .faction-standing {
            font-size: 0.6rem;
            text-transform: uppercase;
            padding: 0.05rem 0.5rem;
            border-radius: 12px;
            background: var(--bg4);
        }
        
        .faction-agenda {
            font-size: 0.7rem;
            color: var(--text2);
            flex: 1 1 100%;
            margin-top: 0.1rem;
        }
        
        .faction-timer-mini {
            font-size: 0.6rem;
            color: var(--text3);
            display: flex;
            align-items: center;
            gap: 0.4rem;
        }
        
        .timer-bar-track.mini {
            width: 60px;
            height: 3px;
        }
        
        .dash-followers-list, .dash-assets-list {
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
        }
        
        .dash-follower-item, .dash-asset-item {
            display: flex;
            gap: 0.4rem;
            font-size: 0.8rem;
            align-items: center;
            padding: 0.1rem 0.2rem;
        }
        
        .follower-name, .asset-name {
            font-weight: 500;
        }
        
        .follower-cap, .asset-tier {
            background: var(--bg4);
            padding: 0.05rem 0.4rem;
            border-radius: 10px;
            font-size: 0.6rem;
            color: var(--text2);
        }
        
        .follower-state, .asset-status {
            font-size: 0.6rem;
        }
    `;
    document.head.appendChild(styles);
}

// ============================================================
// QUICK ACTIONS EVENTS
// ============================================================

function attachQuickActionsEvents() {
    // Region selector
    const regionSelect = document.getElementById('dashboard-region-select');
    if (regionSelect) {
        regionSelect.addEventListener('change', async (e) => {
            try {
                await setSelectedRegion(e.target.value);
                const indicator = document.getElementById('dashboard-region-indicator');
                if (indicator) indicator.textContent = `📍 ${e.target.value}`;
                showToast(`Region set to ${e.target.value}`, 'info');
            } catch (err) {
                console.warn('Region select error:', err);
                showToast('Could not change region', 'error');
            }
        });
    }
    
    // Register for region changes from other parts of the app
    registerRegionChange((regionName, regionData) => {
        const indicator = document.getElementById('dashboard-region-indicator');
        if (indicator) indicator.textContent = `📍 ${regionName}`;
        const select = document.getElementById('dashboard-region-select');
        if (select) select.value = regionName;
    });
    
    // Quick draw buttons - show result in modal
    document.querySelectorAll('.quick-draw-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const count = parseInt(e.target.dataset.count, 10);
            try {
                const result = await quickDraw(count);
                if (result) {
                    showDrawResultModal(result);
                }
            } catch (err) {
                console.warn('Draw error:', err);
                showToast('Could not draw cards', 'error');
            }
        });
    });
    
    // Crown spread button - show result in modal
    const crownBtn = document.querySelector('.quick-crown-btn');
    if (crownBtn) {
        crownBtn.addEventListener('click', async () => {
            try {
                const result = await quickCrownSpread();
                if (result) {
                    showCrownSpreadModal(result);
                }
            } catch (err) {
                console.warn('Crown spread error:', err);
                showToast('Could not perform Crown Spread', 'error');
            }
        });
    }
}

// ============================================================
// MODAL HELPERS
// ============================================================

function showDrawResultModal(result) {
    // Remove existing modal if any
    const existing = document.querySelector('.quick-result-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.className = 'quick-result-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
        animation: fadeIn 0.2s ease;
    `;
    
    const cardNames = result.cards.map(c => 
        c.isJoker ? '🃏 Joker' : `${c.rankName} of ${c.suitName}`
    ).join(', ');
    
    modal.innerHTML = `
        <div style="background:var(--bg2);border-radius:var(--radius);padding:1.5rem;max-width:450px;width:90%;border:1px solid var(--border);box-shadow:0 8px 32px rgba(0,0,0,0.4);max-height:80vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">
                <h3 style="margin:0;color:var(--gold);">🃏 Draw ${result.type} Card${result.type > 1 ? 's' : ''}</h3>
                <button onclick="this.closest('.quick-result-modal').remove()" 
                        style="background:var(--bg3);border:1px solid var(--border);color:var(--text2);font-size:1.2rem;cursor:pointer;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;">
                    ✕
                </button>
            </div>
            <div style="font-size:0.85rem;color:var(--text2);margin-bottom:0.5rem;">${cardNames}</div>
            <div style="background:var(--bg3);padding:0.8rem;border-radius:var(--radius);border-left:3px solid var(--gold);font-size:0.9rem;white-space:pre-wrap;color:var(--text);">
                ${result.synthesis}
            </div>
            <button onclick="this.closest('.quick-result-modal').remove()" 
                    style="margin-top:0.8rem;padding:0.3rem 1.2rem;background:var(--gold);color:#1a1a2e;border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;">
                Close
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function showCrownSpreadModal(result) {
    // Remove existing modal if any
    const existing = document.querySelector('.quick-result-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.className = 'quick-result-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
        animation: fadeIn 0.2s ease;
    `;
    
    const positions = ['🌱 Root', '🏔️ Crest', '👑 Crown', '🤝 Left Hand'];
    const positionMeanings = result.result.positions.map((p, i) => 
        `<div style="margin-bottom:0.3rem;"><strong>${positions[i]}:</strong> ${p.meaning}</div>`
    ).join('');
    
    modal.innerHTML = `
        <div style="background:var(--bg2);border-radius:var(--radius);padding:1.5rem;max-width:500px;width:90%;border:1px solid var(--border);box-shadow:0 8px 32px rgba(0,0,0,0.4);max-height:80vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">
                <h3 style="margin:0;color:var(--gold);">👑 Crown Spread</h3>
                <button onclick="this.closest('.quick-result-modal').remove()" 
                        style="background:var(--bg3);border:1px solid var(--border);color:var(--text2);font-size:1.2rem;cursor:pointer;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;">
                    ✕
                </button>
            </div>
            <div style="background:var(--bg3);padding:0.8rem;border-radius:var(--radius);font-size:0.9rem;color:var(--text);">
                ${positionMeanings}
                <div style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid var(--border);">
                    <strong style="color:var(--gold);">🌟 Wildcard:</strong> ${result.result.wildcard}
                </div>
                ${result.result.timer ? `<div style="margin-top:0.3rem;font-size:0.8rem;color:var(--text3);">⏱️ Timer: ${result.result.timer.segments} segments (${result.result.timer.card})</div>` : ''}
            </div>
            <button onclick="this.closest('.quick-result-modal').remove()" 
                    style="margin-top:0.8rem;padding:0.3rem 1.2rem;background:var(--gold);color:#1a1a2e;border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;">
                Close
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
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

// ... (keep all the window.open* functions from the original)
// ... (they are assumed to exist elsewhere)

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