/**
 * Dice feature - Roll dice and view history
 * UI for the Fate's Edge resolution system
 * Uses the core dice engine for all rolling logic
 * Supports deterministic RNG for static sites
 * Supports WebSocket sync for multiplayer
 */

// Import from core modules
import { escHtml, safeParseInt } from '../../core/utils.js';
import { addRoll, getState, saveState } from '../../core/state.js';
// Import the core dice engine
import { performRoll, rollDie } from '../../core/dice.js';
// Import seed management from crypto (if it exists)
// Fallback to local seed management if crypto doesn't have it
import { 
    getSeed as cryptoGetSeed, 
    setSeed as cryptoSetSeed,
    generateSeed as cryptoGenerateSeed 
} from '../../core/crypto.js' assert { onError: 'ignore' };
// Import WebSocket for sync
import { isConnectedToServer, onEvent, offEvent, sendMessage as sendWSMessage } from '../../core/websocket.js';

let container = null;
let wsListeners = new Map();

// ============================================================
// SEED MANAGEMENT (fallback if crypto.js doesn't have it)
// ============================================================

// Try to use crypto functions, or use local fallback
let _seed = null;

function getSeed() {
    // Try crypto module first
    if (typeof cryptoGetSeed !== 'undefined' && cryptoGetSeed) {
        return cryptoGetSeed();
    }
    // Fallback: use localStorage or return null
    try {
        if (_seed) return _seed;
        const stored = localStorage.getItem('fates-edge-seed');
        if (stored) {
            _seed = stored;
            return _seed;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function setSeed(seed) {
    // Try crypto module first
    if (typeof cryptoSetSeed !== 'undefined' && cryptoSetSeed) {
        return cryptoSetSeed(seed);
    }
    // Fallback: store locally
    _seed = seed;
    try {
        if (seed) {
            localStorage.setItem('fates-edge-seed', seed);
        } else {
            localStorage.removeItem('fates-edge-seed');
        }
    } catch (e) { /* ignore */ }
    return true;
}

function generateSeed() {
    // Try crypto module first
    if (typeof cryptoGenerateSeed !== 'undefined' && cryptoGenerateSeed) {
        return cryptoGenerateSeed();
    }
    // Fallback: generate a random seed
    try {
        if (window && window.crypto && window.crypto.getRandomValues) {
            const array = new Uint32Array(4);
            window.crypto.getRandomValues(array);
            return array.reduce((acc, val) => acc + val.toString(16).padStart(8, '0'), '');
        }
    } catch (e) { /* ignore */ }
    // Final fallback
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ============================================================
// TOAST NOTIFICATION (simple fallback)
// ============================================================

function showToast(message, type = 'info') {
    // Try to use the global toast system if available
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }
    
    // Fallback: simple alert-style notification
    const colors = {
        info: 'var(--text)',
        success: 'var(--green)',
        error: 'var(--red)',
        warning: 'var(--orange)'
    };
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg2);
        color: ${colors[type] || colors.info};
        padding: 0.8rem 1.5rem;
        border-radius: var(--radius);
        border: 1px solid var(--border);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 9999;
        font-size: 0.9rem;
        max-width: 90%;
        animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 3000);
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    console.log('🎲 Dice.render() called');
    
    container = el;
    const seed = getSeed();
    const isDeterministic = !!seed;
    const isConnected = isConnectedToServer();
    
    container.innerHTML = `
        <h1 class="page-title">🎲 Dice Roller</h1>
        <p class="page-sub">Roll dice with the Fate's Edge resolution system.</p>
        
        <!-- Connection & Seed Status -->
        <div class="panel" style="padding:0.3rem 0.8rem;margin-bottom:0.5rem;background:var(--bg3);border-left:3px solid ${isConnected ? 'var(--green)' : 'var(--text3)'};">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                <span style="font-size:0.8rem;color:var(--text2);">
                    ${isConnected ? '🟢 Connected to server' : '📡 Local mode'}
                    ${isDeterministic ? ` 🎲 Deterministic (seed: ${seed.substring(0, 8)}...)` : ' 🔀 Cryptographic RNG'}
                </span>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-ghost" id="seed-regenerate" title="Regenerate seed">🔄 New Seed</button>
                    <button class="btn btn-xs btn-ghost" id="seed-clear" title="Clear seed (use crypto)">🧹 Clear Seed</button>
                </div>
            </div>
        </div>
        
        <div class="panel">
            <div class="form-row">
                <div class="field small">
                    <label>Attribute</label>
                    <select id="roll-attr">
                        <option value="1">1</option>
                        <option value="2" selected>2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                    </select>
                </div>
                <div class="field small">
                    <label>Skill</label>
                    <select id="roll-skill">
                        <option value="0">0</option>
                        <option value="1" selected>1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                    </select>
                </div>
                <div class="field small">
                    <label>DV</label>
                    <select id="roll-dv">
                        <option value="2">2</option>
                        <option value="3" selected>3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                        <option value="6">6</option>
                    </select>
                </div>
                <div class="field small">
                    <label>Position</label>
                    <select id="roll-position">
                        <option value="controlled" selected>Controlled</option>
                        <option value="dominant">Dominant</option>
                        <option value="desperate">Desperate</option>
                    </select>
                </div>
                <div class="field small">
                    <label>Boons</label>
                    <select id="roll-boons">
                        <option value="0" selected>0</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                    </select>
                </div>
            </div>
            
            <!-- Quick Roll Presets -->
            <div class="preset-rolls" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.5rem;">
                <button class="btn btn-sm btn-ghost" data-roll-preset="combat">⚔️ Combat (3+2, DV3)</button>
                <button class="btn btn-sm btn-ghost" data-roll-preset="stealth">👤 Stealth (2+3, DV4)</button>
                <button class="btn btn-sm btn-ghost" data-roll-preset="social">💬 Social (2+2, DV3)</button>
                <button class="btn btn-sm btn-ghost" data-roll-preset="magic">🔮 Magic (1+4, DV5)</button>
                <button class="btn btn-sm btn-ghost" data-roll-preset="desperate">🔥 Desperate (2+2, DV4, Desperate)</button>
                <button class="btn btn-sm btn-ghost" data-roll-preset="deterministic">🎲 Deterministic Demo</button>
            </div>
            
            <div class="flex">
                <button class="btn btn-gold" id="roll-btn">🎲 Roll</button>
                <button class="btn btn-sm" id="roll-clear-history">🗑️ Clear History</button>
                <button class="btn btn-sm" id="roll-export-history">📤 Export</button>
            </div>
        </div>
        
        <div id="roll-result" class="panel" style="display:none;"></div>
        
        <div class="panel">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                <h3 style="margin:0;">📜 Roll History</h3>
                <div id="roll-stats" style="font-size:0.8rem;color:var(--text2);"></div>
            </div>
            <div id="roll-history" style="max-height:300px;overflow-y:auto;margin-top:0.5rem;">
                <span class="text-muted">No rolls yet.</span>
            </div>
        </div>
    `;
    
    attachEvents();
    renderHistory();
    updateStats();
    setupWebSocketSync();
    
    return container;
}

// ============================================================
// WEBSOCKET SYNC
// ============================================================

function setupWebSocketSync() {
    cleanupWebSocketListeners();
    
    if (!isConnectedToServer()) {
        console.log('[Dice] Not connected to server, local mode only');
        return;
    }
    
    // Listen for roll results from other clients
    const rollHandler = (data) => {
        if (!data) return;
        console.log('[Dice] Received roll from server:', data);
        
        // Add to history with remote flag
        const rollData = {
            ...data,
            id: data.id || `remote_${Date.now()}`,
            timestamp: data.timestamp || new Date().toISOString(),
            remote: true,
            sender: data.sender || 'Remote'
        };
        
        addRoll(rollData);
        renderHistory();
        updateStats();
        
        // Show notification
        showToast(`🎲 ${data.sender || 'Remote'} rolled: ${data.outcome || 'Dice'}`, 'info');
    };
    
    // Try to register with WebSocket event system
    try {
        onEvent('roll-result', rollHandler);
        wsListeners.set('roll-result', rollHandler);
        console.log('[Dice] WebSocket sync enabled');
    } catch (e) {
        console.warn('[Dice] Could not setup WebSocket sync:', e);
    }
}

function cleanupWebSocketListeners() {
    for (const [event, handler] of wsListeners) {
        try {
            offEvent(event, handler);
        } catch (e) {
            console.debug('[Dice] Error removing listener:', e);
        }
    }
    wsListeners.clear();
}

// ============================================================
// EVENTS
// ============================================================

function attachEvents() {
    // Roll button
    const rollBtn = document.getElementById('roll-btn');
    if (rollBtn) {
        const newBtn = rollBtn.cloneNode(true);
        rollBtn.parentNode.replaceChild(newBtn, rollBtn);
        newBtn.addEventListener('click', handleRoll);
    }
    
    // Clear button
    const clearBtn = document.getElementById('roll-clear-history');
    if (clearBtn) {
        const newBtn = clearBtn.cloneNode(true);
        clearBtn.parentNode.replaceChild(newBtn, clearBtn);
        newBtn.addEventListener('click', clearHistory);
    }
    
    // Export button
    const exportBtn = document.getElementById('roll-export-history');
    if (exportBtn) {
        const newBtn = exportBtn.cloneNode(true);
        exportBtn.parentNode.replaceChild(newBtn, exportBtn);
        newBtn.addEventListener('click', exportHistory);
    }
    
    // Preset buttons
    document.querySelectorAll('[data-roll-preset]').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function() {
            const preset = this.dataset.rollPreset;
            applyPreset(preset);
        });
    });
    
    // Seed controls
    const seedRegenerate = document.getElementById('seed-regenerate');
    if (seedRegenerate) {
        seedRegenerate.addEventListener('click', function() {
            const newSeed = generateSeed();
            setSeed(newSeed);
            // Re-render to update UI
            render(container);
            showToast('🎲 New seed generated: ' + newSeed.substring(0, 8) + '...', 'success');
        });
    }
    
    const seedClear = document.getElementById('seed-clear');
    if (seedClear) {
        seedClear.addEventListener('click', function() {
            if (confirm('Clear the deterministic seed? This will use cryptographic RNG instead.')) {
                setSeed(null);
                render(container);
                showToast('🧹 Seed cleared. Using cryptographic RNG.', 'info');
            }
        });
    }
    
    // Enter key support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && container && container.contains(e.target)) {
            const rollBtn = document.getElementById('roll-btn');
            if (rollBtn) rollBtn.click();
        }
    });
}

// ============================================================
// PRESETS
// ============================================================

function applyPreset(preset) {
    const presets = {
        combat: { attr: 3, skill: 2, dv: 3, position: 'controlled', boons: 0 },
        stealth: { attr: 2, skill: 3, dv: 4, position: 'controlled', boons: 0 },
        social: { attr: 2, skill: 2, dv: 3, position: 'controlled', boons: 0 },
        magic: { attr: 1, skill: 4, dv: 5, position: 'controlled', boons: 0 },
        desperate: { attr: 2, skill: 2, dv: 4, position: 'desperate', boons: 0 },
        deterministic: { attr: 3, skill: 3, dv: 4, position: 'controlled', boons: 1 }
    };
    
    const p = presets[preset];
    if (!p) return;
    
    document.getElementById('roll-attr').value = p.attr;
    document.getElementById('roll-skill').value = p.skill;
    document.getElementById('roll-dv').value = p.dv;
    document.getElementById('roll-position').value = p.position;
    document.getElementById('roll-boons').value = p.boons;
    
    // Auto-roll after a brief delay
    setTimeout(() => {
        const rollBtn = document.getElementById('roll-btn');
        if (rollBtn) rollBtn.click();
    }, 100);
}

// ============================================================
// ROLL HANDLING
// ============================================================

function handleRoll() {
    try {
        // Get form values
        const attrEl = document.getElementById('roll-attr');
        const skillEl = document.getElementById('roll-skill');
        const dvEl = document.getElementById('roll-dv');
        const positionEl = document.getElementById('roll-position');
        const boonsEl = document.getElementById('roll-boons');
        
        if (!attrEl || !skillEl || !dvEl || !positionEl || !boonsEl) {
            console.error('Form elements not found');
            return;
        }
        
        const attr = safeParseInt(attrEl.value, 2);
        const skill = safeParseInt(skillEl.value, 1);
        const dv = safeParseInt(dvEl.value, 3);
        const position = positionEl.value;
        const boons = safeParseInt(boonsEl.value, 0);
        
        if (isNaN(attr) || isNaN(skill) || isNaN(dv) || isNaN(boons)) {
            showError('Invalid input values. Please check your selections.');
            return;
        }
        
        console.log('Rolling with:', { attr, skill, dv, position, boons });
        
        // Use the core performRoll function
        const result = performRoll(attr, skill, dv, position, boons);
        
        if (!result || typeof result !== 'object') {
            console.error('Invalid result from performRoll:', result);
            showError('Failed to perform roll. Please try again.');
            return;
        }
        
        // Build roll data for history with seed info
        const rollData = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            attr,
            skill,
            dv,
            position,
            boons,
            pool: result.pool,
            dice: result.dice,
            initialDice: result.initialDice,
            successes: result.successes,
            storyBeats: result.storyBeats,
            outcome: result.outcome,
            resultText: result.resultText,
            outcomeClass: result.outcomeClass,
            reRolls: result.reRolls,
            reRolledDice: result.reRolledDice,
            rerollSuccesses: result.rerollSuccesses,
            rerollStoryBeats: result.rerollStoryBeats,
            deterministic: !!getSeed(),
            seed: getSeed(),
            sender: 'You'
        };
        
        // Add to state
        addRoll(rollData);
        
        // Display result
        displayResult(result);
        renderHistory();
        updateStats();
        
        // Broadcast via WebSocket if connected
        if (isConnectedToServer()) {
            try {
                sendWSMessage('roll-result', rollData);
            } catch (e) {
                console.warn('[Dice] Could not broadcast roll:', e);
            }
        }
    } catch (error) {
        console.error('Error during roll:', error);
        showError(error.message || 'An unexpected error occurred during the roll.');
    }
}

function showError(message) {
    const resultEl = document.getElementById('roll-result');
    if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = `
            <div style="text-align:center;padding:0.5rem;color:var(--red);">
                <div style="font-weight:bold;">❌ Error</div>
                <div style="font-size:0.9rem;color:var(--text2);">${escHtml(String(message))}</div>
            </div>
        `;
    }
}

// ============================================================
// DISPLAY
// ============================================================

function displayResult(result) {
    const resultEl = document.getElementById('roll-result');
    if (!resultEl) return;
    
    const outcomeColors = {
        'clean-success': 'var(--green)',
        'success-with-sb': 'var(--gold)',
        'partial': 'var(--orange)',
        'miss': 'var(--red)'
    };
    
    const color = outcomeColors[result.outcomeClass] || 'var(--text)';
    
    // Determine boon text
    let boonText = '';
    if (result.outcomeClass === 'partial') {
        boonText = ' (+1 Boon)';
    } else if (result.outcomeClass === 'miss') {
        boonText = ' (+2 Boons)';
    }
    
    // Format dice display
    const diceDisplay = result.dice && Array.isArray(result.dice) 
        ? result.dice.join(', ') 
        : '';
    
    // Format reroll display
    let rerollDisplay = '';
    if (result.reRolls > 0 && result.reRolledDice && Array.isArray(result.reRolledDice)) {
        rerollDisplay = `(rerolled: ${result.reRolledDice.map(r => `${r.old}→${r.new}`).join(', ')})`;
    }
    
    // Show seed info for deterministic rolls
    let seedInfo = '';
    const seed = getSeed();
    if (seed) {
        seedInfo = `<div style="font-size:0.6rem;color:var(--text3);margin-top:0.2rem;">🎲 seeded: ${seed.substring(0, 8)}...</div>`;
    }
    
    // Animate the result
    resultEl.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    resultEl.style.transform = 'scale(0.95)';
    resultEl.style.opacity = '0.7';
    
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
        <div style="text-align:center;padding:0.5rem;">
            <div style="font-size:2rem;font-weight:bold;color:${color};">
                ${escHtml(result.resultText || 'Unknown')}${boonText}
            </div>
            <div style="font-size:0.9rem;color:var(--text2);margin-top:0.3rem;">
                Pool: ${result.pool || 0} | Successes: ${result.successes || 0} | DV: ${result.dv || 0} | Story Beats: ${result.storyBeats || 0}
            </div>
            <div style="font-size:0.8rem;color:var(--text3);margin-top:0.2rem;">
                Dice: [${escHtml(diceDisplay)}] ${escHtml(rerollDisplay)}
            </div>
            <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">
                ${escHtml(result.position || 'controlled')} position${result.boons > 0 ? ` +${result.boons} boons` : ''}
            </div>
            ${result.storyBeats > 0 ? `<div style="font-size:0.8rem;color:var(--gold);margin-top:0.2rem;">✨ ${result.storyBeats} Story Beat${result.storyBeats > 1 ? 's' : ''} for the GM</div>` : ''}
            ${seedInfo}
        </div>
    `;
    
    // Animate back
    setTimeout(() => {
        resultEl.style.transform = 'scale(1)';
        resultEl.style.opacity = '1';
    }, 100);
}

// ============================================================
// HISTORY
// ============================================================

function renderHistory() {
    const historyEl = document.getElementById('roll-history');
    if (!historyEl) return;
    
    try {
        const state = getState();
        const history = state.diceHistory || [];
        
        if (history.length === 0) {
            historyEl.innerHTML = '<span class="text-muted">No rolls yet.</span>';
            return;
        }
        
        const html = history.slice(0, 20).map((roll, index) => {
            try {
                const time = roll.timestamp ? new Date(roll.timestamp).toLocaleTimeString() : '--:--:--';
                
                // Determine outcome color
                let outcomeColor = 'var(--text2)';
                if (roll.outcomeClass === 'clean-success' || roll.outcomeClass === 'success-with-sb') {
                    outcomeColor = 'var(--green)';
                } else if (roll.outcomeClass === 'partial') {
                    outcomeColor = 'var(--orange)';
                } else if (roll.outcomeClass === 'miss') {
                    outcomeColor = 'var(--red)';
                }
                
                // Format dice
                const diceDisplay = roll.dice && Array.isArray(roll.dice) 
                    ? roll.dice.join(',') 
                    : '';
                
                // Format re-rolls
                let rerollDisplay = '';
                if (roll.reRolls > 0 && roll.reRolledDice && Array.isArray(roll.reRolledDice)) {
                    rerollDisplay = ` ↻${roll.reRolledDice.map(r => `${r.old}→${r.new}`).join(', ')}`;
                }
                
                // Position icon
                const posIcons = {
                    dominant: '👑',
                    controlled: '⚖️',
                    desperate: '🔥'
                };
                const posIcon = posIcons[roll.position] || '';
                
                // Deterministic indicator
                const detIndicator = roll.deterministic ? '🎲' : '🔀';
                const sender = roll.remote ? `🌐 ${roll.sender || 'Remote'}` : detIndicator;
                
                return `
                    <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0;border-bottom:1px solid var(--border);font-size:0.85rem;gap:0.5rem;">
                        <div style="display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;">
                            <span style="font-size:0.7rem;color:var(--text3);">${sender}</span>
                            <span style="font-weight:500;">${roll.attr || 0}+${roll.skill || 0}</span>
                            <span class="text-muted" style="font-size:0.75rem;">vs DV${roll.dv || 0}</span>
                            <span style="font-size:0.75rem;">${posIcon}</span>
                            <span style="color:${outcomeColor};font-weight:500;">${escHtml(String(roll.resultText || roll.outcome || 'Unknown'))}</span>
                            ${roll.storyBeats > 0 ? ` <span style="color:var(--gold);font-weight:500;">✨${roll.storyBeats}</span>` : ''}
                        </div>
                        <div style="font-size:0.7rem;color:var(--text3);text-align:right;flex-shrink:0;">
                            <span style="background:var(--bg3);padding:0.05rem 0.4rem;border-radius:8px;">[${escHtml(diceDisplay)}]</span>
                            ${rerollDisplay}
                            <span class="text-muted" style="margin-left:0.3rem;">${time}</span>
                        </div>
                    </div>
                `;
            } catch (err) {
                console.error('Error rendering history item:', err);
                return '';
            }
        }).filter(html => html !== '').join('');
        
        historyEl.innerHTML = html || '<span class="text-muted">No rolls yet.</span>';
        
        // Scroll to bottom
        historyEl.scrollTop = historyEl.scrollHeight;
    } catch (error) {
        console.error('Error rendering history:', error);
        historyEl.innerHTML = '<span class="text-muted">Error loading history.</span>';
    }
}

// ============================================================
// STATS
// ============================================================

function updateStats() {
    const statsEl = document.getElementById('roll-stats');
    if (!statsEl) return;
    
    try {
        const state = getState();
        const history = state.diceHistory || [];
        const total = history.length;
        
        if (total === 0) {
            statsEl.textContent = '';
            return;
        }
        
        const successes = history.filter(r => 
            r.outcomeClass === 'clean-success' || r.outcomeClass === 'success-with-sb'
        ).length;
        const partials = history.filter(r => r.outcomeClass === 'partial').length;
        const misses = history.filter(r => r.outcomeClass === 'miss').length;
        const storyBeats = history.reduce((sum, r) => sum + (r.storyBeats || 0), 0);
        const deterministic = history.filter(r => r.deterministic).length;
        const remote = history.filter(r => r.remote).length;
        
        statsEl.innerHTML = `
            <span>📊 ${total} rolls</span>
            <span style="color:var(--green);">✅ ${successes}</span>
            <span style="color:var(--orange);">⏳ ${partials}</span>
            <span style="color:var(--red);">❌ ${misses}</span>
            <span style="color:var(--gold);">✨ ${storyBeats}</span>
            ${deterministic > 0 ? `<span style="color:var(--text3);font-size:0.7rem;">🎲 ${deterministic}</span>` : ''}
            ${remote > 0 ? `<span style="color:var(--text3);font-size:0.7rem;">🌐 ${remote}</span>` : ''}
        `;
    } catch (error) {
        console.error('Error updating stats:', error);
        statsEl.textContent = '';
    }
}

// ============================================================
// HISTORY MANAGEMENT
// ============================================================

function clearHistory() {
    if (confirm('Clear all roll history?')) {
        try {
            const state = getState();
            state.diceHistory = [];
            saveState();
            renderHistory();
            updateStats();
            const resultEl = document.getElementById('roll-result');
            if (resultEl) resultEl.style.display = 'none';
        } catch (error) {
            console.error('Error clearing history:', error);
            alert('Failed to clear history. Please try again.');
        }
    }
}

function exportHistory() {
    try {
        const state = getState();
        const history = state.diceHistory || [];
        
        if (history.length === 0) {
            alert('No roll history to export.');
            return;
        }
        
        // Format for export
        const data = JSON.stringify(history, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dice-history-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting history:', error);
        alert('Failed to export history. Please try again.');
    }
}

// ============================================================
// INITIALIZATION
// ============================================================

export function init(el) {
    // Try to load seed from localStorage on init
    try {
        const storedSeed = localStorage.getItem('fates-edge-seed');
        if (storedSeed) {
            setSeed(storedSeed);
        }
    } catch (e) { /* ignore */ }
    
    return render(el);
}

export function destroy() {
    cleanupWebSocketListeners();
    container = null;
}

// ============================================================
// EXPORT DEFAULT
// ============================================================

export default {
    render,
    init,
    destroy,
    getSeed,
    setSeed,
    generateSeed
};