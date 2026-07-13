/**
 * Combat Tracker - Simple initiative and timer tracking
 */

import { getState, saveState } from '../../core/state.js';
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

/**
 * Open combat tracker for an encounter
 */
export function openTracker(encounterId) {
    const state = getState();
    const encounter = state.encounters?.find(e => String(e.id) === String(encounterId));
    if (!encounter) {
        showToast('Encounter not found.', 'error');
        return;
    }
    
    currentEncounterId = encounterId;
    
    // Initialize combatants from encounter
    combatants = (encounter.adversaries || []).map(a => ({
        id: 'combat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        name: a.name || 'Adversary',
        initiative: Math.floor(Math.random() * 20) + 1,
        harm: 0,
        maxHarm: a.body?.includes('Harm:') ? parseInt(a.body.match(/Harm:\s*(\d+)/)?.[1] || '3') : 3,
        status: 'active',
        notes: a.body || '',
        type: 'adversary'
    }));
    
    // Add players if any
    // For simplicity, we'll let the user add them manually
    
    round = 0;
    activeIndex = 0;
    timerSegments = 0;
    timerMax = 6;
    timerName = 'Combat Timer';
    isTimerRunning = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    renderTracker();
}

function renderTracker() {
    // Build modal
    modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;
        z-index: 1000; padding: 1rem; backdrop-filter: blur(3px);
    `;
    
    const combatantsHtml = combatants.map((c, i) => {
        const isActive = i === activeIndex;
        const isPlayer = c.name.includes('🧙');
        const isDefeated = c.status === 'defeated';
        const harmPercent = (c.harm / c.maxHarm) * 100;
        
        return `
            <div style="
                display: flex; align-items: center; gap: 0.75rem; 
                padding: 0.75rem; background: ${isActive ? 'rgba(201,168,76,0.15)' : 'var(--bg3)'};
                border-radius: 8px; margin-bottom: 0.5rem; font-size: 0.9rem;
                border: 1px solid ${isActive ? 'var(--gold)' : 'var(--border)'};
                transition: all 0.2s ease;
                ${isDefeated ? 'opacity: 0.6;' : ''}
            ">
                <div style="
                    width: 28px; height: 28px; border-radius: 50%; 
                    background: ${isPlayer ? 'var(--blue)' : 'var(--red)'};
                    display: flex; align-items: center; justify-content: center;
                    font-weight: bold; font-size: 0.7rem; color: white;
                ">
                    ${i + 1}
                </div>
                
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        display: flex; align-items: center; justify-content: space-between;
                        margin-bottom: 0.25rem;
                    ">
                        <span style="
                            font-weight: 600; color: ${isActive ? 'var(--gold)' : 'var(--text)'};
                            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                        ">${escHtml(c.name)}</span>
                        <span style="font-size: 0.75rem; color: var(--text2);">.Init ${c.initiative}</span>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="flex: 1; height: 6px; background: var(--bg4); border-radius: 3px; overflow: hidden;">
                            <div style="
                                width: ${harmPercent}%; height: 100%; 
                                background: ${harmPercent > 66 ? 'var(--red)' : harmPercent > 33 ? 'var(--orange)' : 'var(--green)'};
                                border-radius: 3px; transition: width 0.3s ease;
                            "></div>
                        </div>
                        <span style="font-size: 0.75rem; color: var(--text2); min-width: 40px;">
                            ${c.harm}/${c.maxHarm}
                        </span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 0.25rem;">
                    <button class="btn btn-xs btn-ghost combat-damage-btn" data-index="${i}" 
                            style="padding: 0.25rem; font-size: 0.8rem; color: var(--red);">💥</button>
                    <button class="btn btn-xs btn-ghost combat-heal-btn" data-index="${i}" 
                            style="padding: 0.25rem; font-size: 0.8rem; color: var(--green);">💚</button>
                    <button class="btn btn-xs btn-ghost combat-toggle-btn" data-index="${i}" 
                            style="padding: 0.25rem; font-size: 0.8rem; color: ${c.status === 'active' ? 'var(--green)' : 'var(--text3)'};">${c.status === 'active' ? '●' : '○'}</button>
                    <button class="btn btn-xs btn-ghost combat-remove-btn" data-index="${i}" 
                            style="padding: 0.25rem; font-size: 0.8rem; color: var(--red);">✕</button>
                </div>
            </div>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div style="
            background: var(--bg2); padding: 1.75rem; border-radius: 12px; 
            max-width: 750px; width: 100%; max-height: 95vh; overflow-y: auto; 
            border: 1px solid var(--border); box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                <div>
                    <h2 style="margin:0;color:var(--gold);font-size:1.8rem;display:flex;align-items:center;gap:0.5rem;">
                        ⚔️ Combat Tracker
                    </h2>
                    <div style="color:var(--text2);font-size:0.9rem;margin-top:0.25rem;">
                        ${combatants.length} combatants · Round ${round}
                    </div>
                </div>
                <button id="combat-close" style="
                    background: var(--bg3); border: 1px solid var(--border); 
                    color: var(--text2); font-size: 1.25rem; cursor: pointer;
                    width: 36px; height: 36px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                ">✕</button>
            </div>
            
            <div style="
                display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
                background: var(--bg3); padding: 1rem; border-radius: 8px;
                margin-bottom: 1.25rem; border: 1px solid var(--border);
            ">
                <div style="text-align: center;">
                    <div style="font-size: 0.8rem; color: var(--text3); margin-bottom: 0.25rem;">ROUND</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--gold);">${round}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.8rem; color: var(--text3); margin-bottom: 0.25rem;">ACTIVE</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--green);">
                        ${combatants.filter(c => c.status === 'active').length}
                    </div>
                </div>
            </div>
            
            <!-- Timer -->
            <div style="
                background: var(--bg3); padding: 1rem; border-radius: 8px;
                margin-bottom: 1.25rem; border: 1px solid var(--border);
            ">
                <div style="
                    display: flex; align-items: center; justify-content: space-between;
                    flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;
                ">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.25rem;">⏱️</span>
                        <div>
                            <div style="font-weight: 600; font-size: 1rem;">${escHtml(timerName)}</div>
                            <div style="font-size: 0.8rem; color: var(--text2);">
                                ${timerSegments} of ${timerMax} segments
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm btn-primary" id="combat-timer-tick" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem;">
                            +1 Segment
                        </button>
                        <button class="btn btn-sm btn-ghost" id="combat-timer-reset" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem;">
                            ↺ Reset
                        </button>
                    </div>
                </div>
                <div style="
                    width: 100%; height: 12px; background: var(--bg4); 
                    border-radius: 6px; overflow: hidden; position: relative;
                ">
                    <div style="
                        width: ${(timerSegments / timerMax) * 100}%; height: 100%;
                        background: ${timerSegments >= timerMax ? 'var(--red)' : 'var(--gold)'};
                        border-radius: 6px; transition: width 0.5s ease;
                        position: relative;
                    ">
                        ${timerSegments > 0 ? `
                            <div style="
                                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2));
                                animation: pulse 2s infinite;
                            "></div>
                        ` : ''}
                    </div>
                </div>
                ${timerSegments >= timerMax ? `
                    <div style="
                        color: var(--red); font-size: 0.85rem; margin-top: 0.5rem;
                        display: flex; align-items: center; gap: 0.25rem;
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
                    </h3>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm btn-primary" id="combat-add-combatant" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem;">
                            + Adversary
                        </button>
                        <button class="btn btn-sm btn-ghost" id="combat-add-player" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem;">
                            👤 Player
                        </button>
                        <button class="btn btn-sm btn-ghost" id="combat-sort" 
                                style="padding: 0.4rem 0.75rem; font-size: 0.85rem;">
                            🔄 Sort
                        </button>
                    </div>
                </div>
                <div id="combatant-list" style="max-height: 350px; overflow-y: auto; padding-right: 0.5rem;">
                    ${combatantsHtml || '<div style="color:var(--text3);padding:1rem;text-align:center;">No combatants. Add some to begin!</div>'}
                </div>
            </div>
            
            <!-- Controls -->
            <div style="
                display: flex; flex-wrap: wrap; gap: 0.75rem; 
                border-top: 1px solid var(--border); padding-top: 1.25rem;
            ">
                <button class="btn btn-primary" id="combat-next" 
                        style="flex: 1; min-width: 120px; padding: 0.6rem;">
                    ⏭️ Next Turn
                </button>
                <button class="btn btn-ghost" id="combat-end-round" 
                        style="flex: 1; min-width: 120px; padding: 0.6rem;">
                    🔚 End Round
                </button>
                <button class="btn btn-danger" id="combat-close-tracker" 
                        style="flex: 1; min-width: 120px; padding: 0.6rem;">
                    ✖️ Close Combat
                </button>
            </div>
        </div>
        
        <style>
            @keyframes pulse {
                0% { opacity: 0.3; }
                50% { opacity: 0.6; }
                100% { opacity: 0.3; }
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
        </style>
    `;
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('#combat-close')?.addEventListener('click', closeTracker);
    modal.querySelector('#combat-close-tracker')?.addEventListener('click', closeTracker);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeTracker(); });
    
    modal.querySelector('#combat-timer-tick')?.addEventListener('click', () => {
        timerSegments = Math.min(timerSegments + 1, timerMax);
        renderTracker();
        showToast(`⏱️ Timer advanced to ${timerSegments}/${timerMax}`, 'info');
    });
    
    modal.querySelector('#combat-timer-reset')?.addEventListener('click', () => {
        timerSegments = 0;
        renderTracker();
        showToast('⏱️ Timer reset', 'info');
    });
    
    modal.querySelector('#combat-add-combatant')?.addEventListener('click', addCombatant);
    modal.querySelector('#combat-add-player')?.addEventListener('click', addPlayer);
    modal.querySelector('#combat-sort')?.addEventListener('click', sortCombatants);
    modal.querySelector('#combat-next')?.addEventListener('click', nextCombatant);
    modal.querySelector('#combat-end-round')?.addEventListener('click', endRound);
    
    // Combatant actions
    modal.querySelectorAll('.combat-damage-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.index);
            damageCombatant(idx);
        });
    });
    modal.querySelectorAll('.combat-heal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.index);
            healCombatant(idx);
        });
    });
    modal.querySelectorAll('.combat-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.index);
            toggleCombatant(idx);
        });
    });
    modal.querySelectorAll('.combat-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.index);
            removeCombatant(idx);
        });
    });
}

function closeTracker() {
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
        type: 'adversary'
    });
    sortCombatants();
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
        type: 'player'
    });
    sortCombatants();
    renderTracker();
    showToast(`👤 Added player ${name}`, 'success');
}

function sortCombatants() {
    combatants.sort((a, b) => b.initiative - a.initiative);
    activeIndex = 0;
    showToast('🔄 Combatants sorted by initiative', 'info');
}

function nextCombatant() {
    const active = combatants.filter(c => c.status === 'active');
    if (active.length === 0) {
        showToast('No active combatants.', 'info');
        return;
    }
    
    // Find current active combatant
    const currentIndex = combatants.findIndex(c => c.status === 'active' && combatants.indexOf(c) === activeIndex);
    
    // Find next active combatant
    let nextIndex = (activeIndex + 1) % combatants.length;
    let attempts = 0;
    
    while (attempts < combatants.length) {
        if (combatants[nextIndex].status === 'active') {
            activeIndex = nextIndex;
            renderTracker();
            showToast(`⏭️ ${combatants[activeIndex].name}'s turn`, 'info');
            return;
        }
        nextIndex = (nextIndex + 1) % combatants.length;
        attempts++;
    }
    
    // If we get here, wrap to next round
    endRound();
}

function endRound() {
    round++;
    // Reset to first active combatant
    let firstActive = combatants.findIndex(c => c.status === 'active');
    if (firstActive !== -1) {
        activeIndex = firstActive;
    }
    renderTracker();
    showToast(`🔚 Round ${round} begins`, 'info');
    
    // Tick timer automatically
    timerSegments = Math.min(timerSegments + 1, timerMax);
    if (timerSegments >= timerMax) {
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
            showToast(`💀 ${combatant.name} is defeated!`, 'error');
        } else {
            showToast(`💥 ${combatant.name} takes ${amount} harm`, 'warning');
        }
        renderTracker();
    }
}

function healCombatant(idx) {
    const amount = parseInt(prompt('Heal amount:', '1') || '1');
    if (idx >= 0 && idx < combatants.length) {
        const combatant = combatants[idx];
        const oldHarm = combatant.harm;
        combatant.harm = Math.max(combatant.harm - amount, 0);
        
        if (combatant.status === 'defeated' && combatant.harm < combatant.maxHarm) {
            combatant.status = 'active';
            showToast(`💚 ${combatant.name} revived!`, 'success');
        } else if (oldHarm > combatant.harm) {
            showToast(`💚 ${combatant.name} healed for ${amount}`, 'success');
        }
        renderTracker();
    }
}

function toggleCombatant(idx) {
    if (idx >= 0 && idx < combatants.length) {
        const combatant = combatants[idx];
        combatant.status = combatant.status === 'active' ? 'inactive' : 'active';
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
            renderTracker();
            showToast(`🗑️ Removed ${name}`, 'info');
        }
    }
}

export default { openTracker };
