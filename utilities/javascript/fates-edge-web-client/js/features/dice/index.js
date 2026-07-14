/**
 * Dice feature - Roll dice and view history
 * UI for the Fate's Edge resolution system
 * Uses the core dice engine for all rolling logic
 * Supports deterministic RNG for static sites
 */

// Import from core modules
import { escHtml, safeParseInt } from '../../core/utils.js';
import { addRoll, getState, saveState } from '../../core/state.js';
// Import the core dice engine with deterministic RNG support
import { performRoll, rollDie, getSeed, setSeed, generateSeed } from '../../core/dice.js';

let container = null;


// ============================================================
// RENDER
// ============================================================

export function render(el) {
    console.log('🎲 Dice.render() called');
    
    container = el;
    const seed = getSeed();
    const isDeterministic = !!seed;
    
    container.innerHTML = `
        <h1 class="page-title">🎲 Dice Roller</h1>
        <p class="page-sub">Roll dice with the Fate's Edge resolution system.</p>
        
        <!-- Seed Status -->
        <div class="panel" style="padding:0.3rem 0.8rem;margin-bottom:0.5rem;background:var(--bg3);border-left:3px solid ${isDeterministic ? 'var(--gold)' : 'var(--text3)'};">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                <span style="font-size:0.8rem;color:var(--text2);">
                    ${isDeterministic ? '🎲 Deterministic RNG (seeded)' : '🔀 Cryptographic RNG (random)'}
                    ${isDeterministic ? `<span style="font-size:0.6rem;color:var(--text3);font-family:monospace;">seed: ${seed.substring(0, 8)}...</span>` : ''}
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
    
    return container;
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
            // Save to localStorage for persistence
            try {
                localStorage.setItem('fates-edge-seed', newSeed);
            } catch (e) { /* ignore */ }
            // Re-render to update UI
            render(container);
            showToast('🎲 New seed generated: ' + newSeed.substring(0, 8) + '...');
        });
    }
    
    const seedClear = document.getElementById('seed-clear');
    if (seedClear) {
        seedClear.addEventListener('click', function() {
            if (confirm('Clear the deterministic seed? This will use cryptographic RNG instead.')) {
                setSeed(null);
                try {
                    localStorage.removeItem('fates-edge-seed');
                } catch (e) { /* ignore */ }
                render(container);
                showToast('🧹 Seed cleared. Using cryptographic RNG.');
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
            deterministic: result.deterministic || false,
            seed: result.seed || null
        };
        
        // Add to state
        addRoll(rollData);
        
        // Display result
        displayResult(result);
        renderHistory();
        updateStats();
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
    if (result.deterministic && result.seed) {
        seedInfo = `<div style="font-size:0.6rem;color:var(--text3);margin-top:0.2rem;">🎲 seeded: ${result.seed.substring(0, 8)}...</div>`;
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
                
                return `
                    <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0;border-bottom:1px solid var(--border);font-size:0.85rem;gap:0.5rem;">
                        <div style="display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;">
                            <span style="font-size:0.7rem;color:var(--text3);">${detIndicator}</span>
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
        
        statsEl.innerHTML = `
            <span>📊 ${total} rolls</span>
            <span style="color:var(--green);">✅ ${successes}</span>
            <span style="color:var(--orange);">⏳ ${partials}</span>
            <span style="color:var(--red);">❌ ${misses}</span>
            <span style="color:var(--gold);">✨ ${storyBeats}</span>
            ${deterministic > 0 ? `<span style="color:var(--text3);font-size:0.7rem;">🎲 ${deterministic}</span>` : ''}
        `;
    } catch (error) {
        console.error('Error updating stats:', error);
        statsEl.textContent = '';
    }
}

// ============================================================
// TOAST NOTIFICATION (simple fallback)
// ============================================================

function showToast(message) {
    // Try to use the global toast system if available
    if (window.showToast) {
        window.showToast(message, 'info');
        return;
    }
    
    // Fallback: simple alert-style notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg2);
        color: var(--text);
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
    container = null;
}

// Add these to js/core/dice.js at the bottom, before the exports

// ============================================================
// DETERMINISTIC RNG / SEED MANAGEMENT
// ============================================================

// Xorshift128+ PRNG for deterministic random generation
class Xorshift128 {
    constructor(seed) {
        this.seed = seed || Date.now();
        this.state = this._seedToState(seed);
    }
    
    _seedToState(seed) {
        let s0 = 0;
        let s1 = 0;
        
        if (typeof seed === 'number') {
            s0 = seed;
            s1 = seed + 0x9e3779b97f4a7c15;
        } else if (typeof seed === 'string') {
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                hash = hash & hash;
            }
            s0 = hash;
            s1 = hash + 0x9e3779b97f4a7c15;
        } else {
            s0 = Date.now();
            s1 = Date.now() + 0x9e3779b97f4a7c15;
        }
        
        return { s0: BigInt(s0), s1: BigInt(s1) };
    }
    
    random() {
        let s0 = this.state.s0;
        let s1 = this.state.s1;
        
        let x = s1;
        let y = s0;
        
        x = x ^ (x << BigInt(23));
        x = x ^ (x >> BigInt(17));
        x = x ^ (y ^ (y >> BigInt(26)));
        
        this.state.s0 = y;
        this.state.s1 = x;
        
        const result = Number((x + y) & BigInt(0xFFFFFFFFFFFFFFFF)) / 18446744073709551616;
        return result;
    }
    
    randomInt(min, max) {
        return Math.floor(this.random() * (max - min)) + min;
    }
    
    randomIntInclusive(min, max) {
        return Math.floor(this.random() * (max - min + 1)) + min;
    }
}

// Seed state
let _seed = null;
let _prng = null;

// Load seed from localStorage on module load
try {
    const stored = localStorage.getItem('fates-edge-seed');
    if (stored) {
        _seed = stored;
        _prng = new Xorshift128(stored);
    }
} catch (e) { /* ignore */ }

// Also check for window seed (set by build script)
if (!_seed && typeof window !== 'undefined' && window.__RANDOM_SEED) {
    _seed = window.__RANDOM_SEED;
    _prng = new Xorshift128(_seed);
    try {
        localStorage.setItem('fates-edge-seed', _seed);
    } catch (e) { /* ignore */ }
}

/**
 * Get the current deterministic seed
 * @returns {string|null} Current seed or null if not set
 */
export function getSeed() {
    return _seed;
}

/**
 * Set the deterministic seed
 * @param {string|null} seed - New seed value, or null to disable deterministic mode
 * @returns {boolean} Success
 */
export function setSeed(seed) {
    _seed = seed;
    if (seed) {
        _prng = new Xorshift128(seed);
        try {
            localStorage.setItem('fates-edge-seed', seed);
        } catch (e) { /* ignore */ }
    } else {
        _prng = null;
        try {
            localStorage.removeItem('fates-edge-seed');
        } catch (e) { /* ignore */ }
    }
    return true;
}

/**
 * Generate a new random seed
 * @returns {string} New seed value
 */
export function generateSeed() {
    let newSeed;
    try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            const array = new Uint32Array(4);
            window.crypto.getRandomValues(array);
            newSeed = array.reduce((acc, val) => acc + val.toString(16).padStart(8, '0'), '');
        } else if (typeof crypto !== 'undefined' && crypto.randomBytes) {
            const buffer = crypto.randomBytes(32);
            newSeed = buffer.toString('hex');
        } else {
            newSeed = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        }
    } catch (e) {
        newSeed = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }
    return newSeed;
}

/**
 * Get a random number using deterministic PRNG if seeded, otherwise crypto/Math.random
 * @returns {number} Random number between 0 and 1
 */
export function getRandom() {
    if (_prng) {
        return _prng.random();
    }
    // Fallback to crypto or Math.random
    try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            return array[0] / 4294967296;
        }
    } catch (e) { /* ignore */ }
    return Math.random();
}

/**
 * Get a random integer using deterministic PRNG if seeded
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Random integer
 */
export function getRandomInt(min, max) {
    if (_prng) {
        return _prng.randomInt(min, max);
    }
    return Math.floor(getRandom() * (max - min)) + min;
}

/**
 * Get a random integer inclusive using deterministic PRNG if seeded
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer
 */
export function getRandomIntInclusive(min, max) {
    if (_prng) {
        return _prng.randomIntInclusive(min, max);
    }
    return Math.floor(getRandom() * (max - min + 1)) + min;
}

// Override the default rollDie to use deterministic RNG if seeded
const _originalRollDie = rollDie;

/**
 * Roll a single die with deterministic RNG support
 * @param {number} sides - Number of sides on the die
 * @returns {number} Roll result
 */
export function rollDieDeterministic(sides) {
    if (sides < 1) {
        throw new Error('Die must have at least 1 side');
    }
    if (_prng) {
        return _prng.randomInt(1, sides + 1);
    }
    return _originalRollDie(sides);
}

// Re-export rollDie with deterministic support
// This replaces the original rollDie with the deterministic version
const originalRollDie = rollDie;
rollDie = rollDieDeterministic;
// ============================================================
// EXPORT DEFAULT
// ============================================================

export default {
    render,
    init,
    destroy,
};