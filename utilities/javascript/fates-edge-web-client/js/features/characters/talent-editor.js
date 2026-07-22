/**
 * Talent Editor - Character talent management
 * UPDATED: Now follows Fate's Edge Player's Guide rules
 * - Talent tiers: Minor (2–3 XP), Major (4–6 XP), Prestige (7–10 XP), Epic (11+ XP)
 * - Activation types: Passive, Active, Reactive
 * - Talent categories from the guide (General, Combat, Magic, Healer, etc.)
 * - Use limits (once/scene, once/session, once/arc, passive)
 * - XP cost validation against selected tier
 * - Prerequisites field with guide-style format
 * - Effect summary for mechanical description
 * - Source tracking (Guide, Wiki, Custom)
 * - Stacking rules display
 * - Supports both global catalog and character-specific editing
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml, safeParseInt, clamp } from '../../core/utils.js';

// ============================================================
// GAME CONSTANTS (from Player's Guide)
// ============================================================

const TALENT_TIERS = [
    { 
        id: 'minor', 
        label: 'Minor', 
        xpRange: '2–3 XP', 
        min: 2, 
        max: 3,
        color: '#4caf50',
        desc: 'Small situational bonus, often once per scene. Passive talents provide a constant +1 die or similar edge.',
        examples: 'Keen Senses (+1d perception), Silver Tongue (+1d persuasion), Second Wind (clear 1 Fatigue once/scene)'
    },
    { 
        id: 'major', 
        label: 'Major', 
        xpRange: '4–6 XP', 
        min: 4, 
        max: 6,
        color: '#ffc107',
        desc: 'Strong upgrade, permanent effect in a niche. Often defines your character\'s signature move.',
        examples: 'Weapon Mastery (+2d with chosen weapon), Spellcraft (free casting access), Command Presence (+1d leadership)'
    },
    { 
        id: 'prestige', 
        label: 'Prestige', 
        xpRange: '7–10 XP', 
        min: 7, 
        max: 10,
        color: '#e91e63',
        desc: 'Campaign-defining ability that breaks fundamental limits. Often has significant prerequisites.',
        examples: 'Backstab (+1 Harm from stealth), Arcane Dominance (overpower weaker spells), Ghost Heist (crime leaves no evidence)'
    },
    { 
        id: 'epic', 
        label: 'Epic', 
        xpRange: '11+ XP', 
        min: 11, 
        max: 999,
        color: '#9c27b0',
        desc: 'Legendary ability that shapes the story. Reserved for high-tier characters.',
        examples: 'Untouchable Form (convert 2 Harm to Fatigue), Absolute Witness (all deceptions fail within Near)'
    }
];

const ACTIVATION_TYPES = [
    { id: 'passive', label: 'Passive', desc: 'Always on; no action required. Stacks with other passive talents.', icon: '🔄' },
    { id: 'active', label: 'Active', desc: 'Requires an action or scene focus to use. Only one active talent at a time.', icon: '⚡' },
    { id: 'reactive', label: 'Reactive', desc: 'Triggers automatically on a condition. Only one reactive talent per trigger.', icon: '🔁' }
];

const TALENT_CATEGORIES = [
    { id: 'general', label: 'General', desc: 'Universal benefits usable by any character' },
    { id: 'combat', label: 'Combat', desc: 'Melee, ranged, defense, and battlefield tactics' },
    { id: 'magic-access', label: 'Magic Access', desc: 'Grants access to a magic path (Spellcraft, Codex, Symbol, etc.)' },
    { id: 'free-caster', label: 'Free Caster', desc: 'Enhancements for free casting (TAGS system)' },
    { id: 'healer', label: 'Healer', desc: 'Healing, recovery, and condition removal' },
    { id: 'ranger-tracker', label: 'Ranger / Tracker', desc: 'Wilderness, tracking, survival, and scouting' },
    { id: 'artificer-crafter', label: 'Artificer / Crafter', desc: 'Building, repairing, and creating items' },
    { id: 'rogue-thief', label: 'Rogue / Thief', desc: 'Stealth, theft, infiltration, and criminal skills' },
    { id: 'monk-unarmed', label: 'Monk / Unarmed', desc: 'Unarmed combat, meditation, and physical discipline' },
    { id: 'cantor-performer', label: 'Cantor / Performer', desc: 'Songs, performance, and social inspiration' },
    { id: 'follower-asset', label: 'Follower & Asset', desc: 'Recruitment, management, and delegation' },
    { id: 'defense', label: 'Defense', desc: 'Guarding, shielding, and damage mitigation' },
    { id: 'movement', label: 'Movement', desc: 'Charge, skirmish, mounted combat, and mobility' },
    { id: 'social', label: 'Social', desc: 'Persuasion, deception, networking, and influence' },
    { id: 'investigation', label: 'Investigation', desc: 'Research, deduction, and information gathering' },
    { id: 'other', label: 'Other', desc: 'Doesn\'t fit standard categories' }
];

const USE_LIMITS = [
    { id: 'passive', label: 'Passive (always on)', desc: 'No limit — always active' },
    { id: 'once-scene', label: 'Once per scene', desc: 'Resets at scene end' },
    { id: 'once-session', label: 'Once per session', desc: 'Resets after downtime' },
    { id: 'once-arc', label: 'Once per arc', desc: 'Resets at major story milestones' },
    { id: 'once-campaign', label: 'Once per campaign', desc: 'One-time use — never refreshes' },
    { id: 'unlimited', label: 'Unlimited', desc: 'Can be used at any time, no limit' },
    { id: 'custom', label: 'Custom', desc: 'Special timing defined in description' }
];

const SOURCES = [
    { id: 'guide', label: 'Player\'s Guide', desc: 'Official talent from the Fate\'s Edge Player\'s Guide' },
    { id: 'wiki', label: 'Wiki Clone', desc: 'Cloned from a wiki entry' },
    { id: 'custom', label: 'Custom', desc: 'Created by the GM or player' },
    { id: 'homebrew', label: 'Homebrew', desc: 'Community-created or modified' }
];

const STACKING_RULES = `Only one activated talent can be active at a time (for abilities that require a decision or action). 
Passive talents (e.g., +1 die to perception) are always active and stack. 
Active talents that require an action or reaction cannot be used simultaneously — choose which one to activate when the trigger occurs.`;

const REFRESH_RULES = `Per scene uses refresh at scene end. 
Per session uses refresh after downtime. 
Some talents allow spending Boons to push effects further.`;

// ============================================================
// STATE
// ============================================================

let activeModal = null;
let activeOverlay = null;
let escapeHandler = null;
let currentEditMode = null; // 'catalog' or 'character'
let currentEditContext = null; // { talentId } or { characterId, talentIndex }

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Open the talent editor for a global catalog talent (called by characters module)
 * @param {string} talentId - The talent ID from state.talents
 */
export function openEditor(talentId) {
    openCatalogEditor(talentId);
}

/**
 * Open the talent editor for a character's talent
 * @param {string} characterId - Character ID
 * @param {number} talentIndex - Index in character.talents array (-1 for new)
 */
export function openTalentEditor(characterId, talentIndex = -1) {
    openCharacterEditor(characterId, talentIndex);
}

// ============================================================
// CATALOG EDITOR
// ============================================================

function openCatalogEditor(talentId) {
    closeTalentEditor();

    const state = getState();
    if (!state.talents) state.talents = [];

    let talent = null;
    let talentIndex = -1;
    
    if (talentId) {
        talent = state.talents.find((t, i) => {
            if (String(t.id) === String(talentId)) {
                talentIndex = i;
                return true;
            }
            return false;
        });
    }
    
    const isNew = !talent;
    
    if (isNew) {
        talent = {
            id: generateId('talent_'),
            name: 'New Talent',
            cost: 2,
            tier: 'minor',
            activation: 'passive',
            category: 'general',
            useLimit: 'passive',
            description: '',
            prerequisites: '',
            effect: '',
            source: 'custom'
        };
    }

    currentEditMode = 'catalog';
    currentEditContext = { talentId: talent.id, talentIndex };
    
    showEditorModal(talent, isNew, 'catalog');
}

// ============================================================
// CHARACTER EDITOR
// ============================================================

function openCharacterEditor(characterId, talentIndex) {
    closeTalentEditor();

    const state = getState();
    const character = state.characters?.find(c => c.id === characterId);
    if (!character) {
        showToast('Character not found.', 'error');
        return;
    }

    if (!character.talents) character.talents = [];

    const talent = talentIndex >= 0 && talentIndex < character.talents.length 
        ? character.talents[talentIndex] 
        : null;
    const isNew = !talent;
    
    const defaultTalent = {
        name: '',
        cost: 2,
        tier: 'minor',
        activation: 'passive',
        category: 'general',
        useLimit: 'passive',
        description: '',
        prerequisites: '',
        effect: '',
        source: 'custom'
    };

    currentEditMode = 'character';
    currentEditContext = { characterId, talentIndex };
    
    showEditorModal(talent || defaultTalent, isNew, 'character');
}

// ============================================================
// MODAL DISPLAY
// ============================================================

function showEditorModal(talent, isNew, mode) {
    escapeHandler = (e) => {
        if (e.key === 'Escape') closeTalentEditor();
    };

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'talent-editor-modal';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '700px';

    const tierOptions = TALENT_TIERS.map(t => 
        `<option value="${t.id}" ${talent.tier === t.id ? 'selected' : ''}>${t.label} (${t.xpRange})</option>`
    ).join('');

    const activationOptions = ACTIVATION_TYPES.map(a => 
        `<option value="${a.id}" ${talent.activation === a.id ? 'selected' : ''}>${a.icon} ${a.label} — ${a.desc}</option>`
    ).join('');

    const categoryOptions = TALENT_CATEGORIES.map(c => 
        `<option value="${c.id}" ${talent.category === c.id ? 'selected' : ''}>${c.label} — ${c.desc}</option>`
    ).join('');

    const useLimitOptions = USE_LIMITS.map(u => 
        `<option value="${u.id}" ${talent.useLimit === u.id ? 'selected' : ''}>${u.label} — ${u.desc}</option>`
    ).join('');

    const sourceOptions = SOURCES.map(s => 
        `<option value="${s.id}" ${(talent.source || 'custom') === s.id ? 'selected' : ''}>${s.label}</option>`
    ).join('');

    const tierInfo = TALENT_TIERS.find(t => t.id === (talent.tier || 'minor')) || TALENT_TIERS[0];

    modal.innerHTML = `
        <button class="modal-close" id="talent-editor-close">&times;</button>
        <h2>${isNew ? '➕ Add Talent' : '✏️ Edit Talent'}</h2>
        
        <!-- Guide Reference -->
        <details style="margin-bottom:0.8rem;">
            <summary style="cursor:pointer;font-size:0.85rem;color:var(--text2);">📖 Talent Rules Reference</summary>
            <div style="padding:0.5rem;font-size:0.8rem;color:var(--text3);background:var(--bg2);border-radius:6px;margin-top:0.3rem;">
                <p><strong>Talent Tiers:</strong></p>
                ${TALENT_TIERS.map(t => 
                    `<span style="color:${t.color};">● ${t.label} (${t.xpRange})</span> — ${t.desc}<br>`
                ).join('')}
                <br>
                <p><strong>Activation Types:</strong></p>
                ${ACTIVATION_TYPES.map(a => 
                    `<strong>${a.icon} ${a.label}:</strong> ${a.desc}<br>`
                ).join('')}
                <br>
                <p><strong>Stacking:</strong> ${STACKING_RULES}</p>
                <p><strong>Refresh:</strong> ${REFRESH_RULES}</p>
                <p><strong>Cost Reminder:</strong> Starting XP is 32 (max 36 with Bonds/Complications). Spend all XP — cannot bank starting XP.</p>
            </div>
        </details>
        
        <form id="talent-editor-form">
            <!-- Name -->
            <div class="form-group">
                <label for="talent-name">Talent Name *</label>
                <input type="text" id="talent-name" value="${escHtml(talent.name || '')}" placeholder="e.g., Keen Senses, Weapon Mastery, Backstab" required autofocus />
            </div>
            
            <!-- XP Cost and Tier -->
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <div class="form-group" style="flex:1;min-width:100px;">
                    <label for="talent-cost">XP Cost</label>
                    <input type="number" id="talent-cost" value="${talent.cost ?? 2}" min="2" max="50" 
                        style="font-size:1.1rem;font-weight:600;color:var(--gold);" 
                        title="XP cost. Minor: 2-3, Major: 4-6, Prestige: 7-10, Epic: 11+" />
                    <div id="talent-cost-validation" style="font-size:0.75rem;margin-top:0.2rem;color:var(--green);">
                        ✓ Within ${tierInfo.label} range (${tierInfo.xpRange})
                    </div>
                </div>
                <div class="form-group" style="flex:1;min-width:140px;">
                    <label for="talent-tier">Talent Tier</label>
                    <select id="talent-tier" style="font-weight:600;">${tierOptions}</select>
                    <div id="talent-tier-info" style="font-size:0.75rem;margin-top:0.2rem;color:${tierInfo.color};">
                        ${escHtml(tierInfo.desc)}
                    </div>
                </div>
            </div>
            
            <!-- Tier Examples -->
            <div id="talent-tier-examples" style="font-size:0.75rem;color:var(--text3);padding:0.3rem 0.5rem;background:var(--bg2);border-radius:4px;margin:0.3rem 0;border-left:3px solid ${tierInfo.color};">
                <strong>Examples:</strong> ${escHtml(tierInfo.examples)}
            </div>
            
            <!-- Activation and Use Limit -->
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <div class="form-group" style="flex:1;min-width:150px;">
                    <label for="talent-activation">Activation Type</label>
                    <select id="talent-activation">${activationOptions}</select>
                </div>
                <div class="form-group" style="flex:1;min-width:150px;">
                    <label for="talent-use-limit">Use Limit</label>
                    <select id="talent-use-limit">${useLimitOptions}</select>
                </div>
            </div>
            
            <!-- Category and Source -->
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <div class="form-group" style="flex:1;min-width:150px;">
                    <label for="talent-category">Category</label>
                    <select id="talent-category">${categoryOptions}</select>
                </div>
                <div class="form-group" style="flex:1;min-width:120px;">
                    <label for="talent-source">Source</label>
                    <select id="talent-source">${sourceOptions}</select>
                </div>
            </div>
            
            <!-- Prerequisites -->
            <div class="form-group">
                <label for="talent-prereq">Prerequisites</label>
                <input type="text" id="talent-prereq" value="${escHtml(talent.prerequisites || talent.prereq || '')}" 
                    placeholder="e.g., Melee 2+, Body 3+ | Requires: Spellcraft | Requires: Familiar or Patron's Symbol" />
                <div style="font-size:0.75rem;color:var(--text3);margin-top:0.2rem;">
                    Format: Attribute rating (e.g., "Body 3+"), Skill rating (e.g., "Melee 2+"), 
                    Talent required (e.g., "Requires: Spellcraft"), or Tier (e.g., "Requires: Tier II").
                </div>
            </div>
            
            <!-- Effect Summary -->
            <div class="form-group">
                <label for="talent-effect">Effect Summary (mechanical)</label>
                <input type="text" id="talent-effect" value="${escHtml(talent.effect || '')}" 
                    placeholder="e.g., +1 die to perception checks | Convert 1 Harm to Fatigue once/scene | +2 dice with chosen weapon" />
                <div style="font-size:0.75rem;color:var(--text3);margin-top:0.2rem;">
                    Brief mechanical effect for quick reference on character sheets.
                </div>
            </div>
            
            <!-- Description -->
            <div class="form-group">
                <label for="talent-description">Full Description</label>
                <textarea id="talent-description" rows="4" 
                    placeholder="Describe the talent in detail — how it works, when to use it, what happens on activation...">${escHtml(talent.description || '')}</textarea>
            </div>
            
            <!-- Stacking Notice -->
            <div style="font-size:0.75rem;color:var(--text3);padding:0.3rem 0.5rem;background:rgba(255,193,7,0.08);border-radius:4px;border-left:2px solid var(--gold);margin-bottom:0.5rem;">
                <strong>Stacking:</strong> ${STACKING_RULES}
            </div>
            
            <!-- Buttons -->
            <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
                <button type="submit" class="btn btn-gold">💾 Save Talent</button>
                <button type="button" class="btn" id="talent-editor-cancel">Cancel</button>
                ${!isNew ? `<button type="button" class="btn btn-danger" id="talent-editor-delete">🗑️ Delete</button>` : ''}
            </div>
        </form>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    activeOverlay = overlay;
    activeModal = modal;

    // Setup events
    const closeModal = () => closeTalentEditor();

    document.getElementById('talent-editor-close')?.addEventListener('click', closeModal);
    document.getElementById('talent-editor-cancel')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', escapeHandler);

    // Delete handler
    const deleteBtn = document.getElementById('talent-editor-delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const name = talent?.name || 'Untitled';
            if (confirm(`Delete talent "${name}"? This cannot be undone.`)) {
                deleteTalent(talent, mode);
                closeModal();
            }
        });
    }

    // Tier change handler - update cost validation and info
    const tierSelect = document.getElementById('talent-tier');
    if (tierSelect) {
        tierSelect.addEventListener('change', () => {
            updateTierInfo();
            validateCostAgainstTier();
        });
    }

    // Cost change handler - validate against tier
    const costInput = document.getElementById('talent-cost');
    if (costInput) {
        costInput.addEventListener('input', validateCostAgainstTier);
        costInput.addEventListener('change', validateCostAgainstTier);
    }

    // Form submit
    const form = document.getElementById('talent-editor-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            saveTalent(talent, isNew, mode);
        });
    }
}

// ============================================================
// TIER / COST VALIDATION
// ============================================================

function updateTierInfo() {
    const tierId = document.getElementById('talent-tier')?.value || 'minor';
    const tier = TALENT_TIERS.find(t => t.id === tierId) || TALENT_TIERS[0];
    
    const infoEl = document.getElementById('talent-tier-info');
    if (infoEl) {
        infoEl.textContent = tier.desc;
        infoEl.style.color = tier.color;
    }
    
    const examplesEl = document.getElementById('talent-tier-examples');
    if (examplesEl) {
        examplesEl.innerHTML = `<strong>Examples:</strong> ${escHtml(tier.examples)}`;
        examplesEl.style.borderLeftColor = tier.color;
    }
    
    // Auto-adjust cost if outside new tier range
    const costInput = document.getElementById('talent-cost');
    if (costInput) {
        const currentCost = safeParseInt(costInput.value, 0);
        if (currentCost < tier.min || currentCost > tier.max) {
            costInput.value = tier.min;
        }
    }
}

function validateCostAgainstTier() {
    const tierId = document.getElementById('talent-tier')?.value || 'minor';
    const tier = TALENT_TIERS.find(t => t.id === tierId) || TALENT_TIERS[0];
    const cost = safeParseInt(document.getElementById('talent-cost')?.value, 0);
    
    const validationEl = document.getElementById('talent-cost-validation');
    if (!validationEl) return;
    
    if (cost < tier.min || cost > tier.max) {
        validationEl.innerHTML = `⚠ Cost ${cost} is outside ${tier.label} range (${tier.xpRange}). GM may allow custom costs.`;
        validationEl.style.color = 'var(--orange)';
    } else {
        validationEl.innerHTML = `✓ Within ${tier.label} range (${tier.xpRange})`;
        validationEl.style.color = 'var(--green)';
    }
}

// ============================================================
// SAVE / DELETE
// ============================================================

function saveTalent(originalTalent, isNew, mode) {
    const nameInput = document.getElementById('talent-name');
    const name = nameInput?.value?.trim() || '';
    
    if (!name) {
        showToast('Please enter a talent name.', 'error');
        if (nameInput) {
            nameInput.style.borderColor = 'var(--red)';
            nameInput.focus();
            setTimeout(() => nameInput.style.borderColor = '', 3000);
        }
        return;
    }
    
    const tierId = document.getElementById('talent-tier')?.value || 'minor';
    const tier = TALENT_TIERS.find(t => t.id === tierId) || TALENT_TIERS[0];
    const cost = safeParseInt(document.getElementById('talent-cost')?.value, tier.min);
    
    // Validate cost against tier
    if (cost < tier.min || cost > tier.max) {
        const proceed = confirm(
            `XP cost ${cost} doesn't match ${tier.label} tier (${tier.xpRange}).\n\n` +
            `Save anyway? (GM may allow custom costs.)`
        );
        if (!proceed) return;
    }
    
    const talentData = {
        name: name,
        description: document.getElementById('talent-description')?.value?.trim() || '',
        cost: cost,
        tier: tierId,
        activation: document.getElementById('talent-activation')?.value || 'passive',
        category: document.getElementById('talent-category')?.value || 'general',
        useLimit: document.getElementById('talent-use-limit')?.value || 'passive',
        source: document.getElementById('talent-source')?.value || 'custom',
        prerequisites: document.getElementById('talent-prereq')?.value?.trim() || '',
        effect: document.getElementById('talent-effect')?.value?.trim() || ''
    };
    
    // Preserve ID if editing
    if (originalTalent.id) talentData.id = originalTalent.id;
    if (originalTalent.source === 'wiki-clone') talentData.source = 'wiki-clone';
    if (originalTalent.clonedFrom) talentData.clonedFrom = originalTalent.clonedFrom;
    if (originalTalent.createdAt) talentData.createdAt = originalTalent.createdAt;
    if (isNew && !talentData.createdAt) talentData.createdAt = new Date().toISOString();
    
    const state = getState();
    
    if (mode === 'catalog') {
        // Save to global catalog
        if (!state.talents) state.talents = [];
        
        if (isNew) {
            talentData.id = talentData.id || generateId('talent_');
            state.talents.push(talentData);
            showToast(`✅ Added talent "${name}" (${tier.label}, ${cost} XP) to catalog`, 'success');
        } else {
            const idx = currentEditContext.talentIndex;
            if (idx >= 0 && idx < state.talents.length) {
                state.talents[idx] = { ...state.talents[idx], ...talentData };
                showToast(`✅ Updated talent "${name}" (${tier.label}, ${cost} XP)`, 'success');
            }
        }
    } else if (mode === 'character') {
        // Save to character
        const character = state.characters?.find(c => c.id === currentEditContext.characterId);
        if (!character) {
            showToast('Character not found.', 'error');
            return;
        }
        
        if (!character.talents) character.talents = [];
        const talentIndex = currentEditContext.talentIndex;
        
        if (isNew || talentIndex < 0) {
            character.talents.push(talentData);
            showToast(`✅ Added talent "${name}" (${tier.label}, ${cost} XP) to ${character.name}`, 'success');
        } else {
            character.talents[talentIndex] = { ...character.talents[talentIndex], ...talentData };
            showToast(`✅ Updated talent "${name}" on ${character.name}`, 'success');
        }
    }
    
    saveState();
    closeTalentEditor();
    document.dispatchEvent(new CustomEvent('character-updated'));
    document.dispatchEvent(new CustomEvent('talent-updated'));
}

function deleteTalent(talent, mode) {
    const state = getState();
    
    if (mode === 'catalog') {
        if (!state.talents) return;
        const idx = currentEditContext.talentIndex;
        if (idx >= 0 && idx < state.talents.length) {
            state.talents.splice(idx, 1);
            saveState();
            showToast(`🗑️ Talent "${talent.name}" deleted from catalog.`, 'success');
            document.dispatchEvent(new CustomEvent('character-updated'));
            document.dispatchEvent(new CustomEvent('talent-updated'));
        }
    } else if (mode === 'character') {
        const character = state.characters?.find(c => c.id === currentEditContext.characterId);
        if (!character || !character.talents) return;
        const talentIndex = currentEditContext.talentIndex;
        if (talentIndex >= 0 && talentIndex < character.talents.length) {
            character.talents.splice(talentIndex, 1);
            saveState();
            showToast(`🗑️ Talent "${talent.name}" removed from ${character.name}.`, 'success');
            document.dispatchEvent(new CustomEvent('character-updated'));
        }
    }
}

// ============================================================
// CLEANUP
// ============================================================

export function closeTalentEditor() {
    if (escapeHandler) {
        document.removeEventListener('keydown', escapeHandler);
        escapeHandler = null;
    }

    if (activeOverlay && activeOverlay.parentNode) {
        activeOverlay.parentNode.removeChild(activeOverlay);
    }

    activeOverlay = null;
    activeModal = null;
    currentEditMode = null;
    currentEditContext = null;
}

// ============================================================
// UTILITY
// ============================================================

function generateId(prefix = 'talent_') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ============================================================
// EXPORTS
// ============================================================

export default {
    openEditor,
    openTalentEditor,
    closeTalentEditor,
    // Constants for external use
    TALENT_TIERS,
    ACTIVATION_TYPES,
    TALENT_CATEGORIES,
    USE_LIMITS
};