/**
 * Combat Tracker - Advanced initiative and timer tracking
 * Integrated with Factions, Rivals, Followers, Assets, and Patrons
 * ✅ Keyboard shortcuts: Space = next turn, R = reset timer
 * ✅ Cleaner UI with better feedback
 */

import { getState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';

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
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    renderTracker();
}

// ============================================================
// RENDER TRACKER
// ============================================================

function renderTracker() {
    // Build modal
    modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;
        z-index: 1000; padding: 1rem; backdrop-filter: blur(12px);
        animation: fadeIn 0.3s ease;
    `;
    
    const combatantsHtml = combatants.map((c, i) => {
        const isActive = i === activeIndex && c.status === 'active';
        const isDefeated = c.status === 'defeated';
        const harmPercent = (c.harm / c.maxHarm) * 100;
        const hasLinks = c.linkedFaction || c.linkedPatron || c.linkedFollower || c.linkedAsset || c.linkedRival;
        
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
                        <button class="btn btn-sm btn-ghost" id="combat-sort" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem; transition: all 0.2s ease;">
                            🔄 Sort
                        </button>
                    </div>
                </div>
                <div id="combatant-list" style="max-height: 350px; overflow-y: auto; padding-right: 0.5rem;">
                    ${combatantsHtml || '<div style="color:var(--text3);padding:2rem;text-align:center;">No combatants. Add some to begin!</div>'}
                </div>
            </div>
            
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
    modal.querySelector('#combat-sort')?.addEventListener('click', sortCombatants);
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
        // Space to advance turn (only if not typing in input/textarea/select)
        if (e.key === ' ' && !e.target.matches('input, textarea, select')) {
            e.preventDefault();
            const nextBtn = modal.querySelector('#combat-next');
            if (nextBtn) nextBtn.click();
        }
        // R to reset timer
        if (e.key === 'r' && !e.target.matches('input, textarea, select')) {
            e.preventDefault();
            const resetBtn = modal.querySelector('#combat-timer-reset');
            if (resetBtn) resetBtn.click();
        }
    };
    document.addEventListener('keydown', keyHandler);
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
    
    combatants.push({
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
    });
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
    
    combatants.push({
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
    });
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
    combatants.push({
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
    });
    sortCombatants();
    addLog('info', `Imported faction: ${faction.name}`);
    renderTracker();
    showToast(`🏛️ Imported ${faction.name} as combatant`, 'success');
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
            combatants.splice(idx, 1);
            if (activeIndex >= combatants.length) activeIndex = Math.max(0, combatants.length - 1);
            addLog('info', `Removed ${name}`);
            renderTracker();
            showToast(`🗑️ Removed ${name}`, 'info');
        }
    }
}

// ============================================================
// EXPORTS
// ============================================================

export default { openTracker };