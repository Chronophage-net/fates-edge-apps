/**
 * Talent Editor - Character talent management
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';

// Keep track of active modal and event listeners for cleanup
let activeModal = null;
let activeOverlay = null;
let escapeHandler = null;

export function openTalentEditor(characterId, talentIndex = -1) {
    // Close any existing modal first
    closeTalentEditor();

    const state = getState();
    const character = state.characters?.find(c => c.id === characterId);
    if (!character) {
        showToast('Character not found.', 'error');
        return;
    }

    // Ensure talents array exists
    if (!character.talents) {
        character.talents = [];
    }

    const talent = talentIndex >= 0 && talentIndex < character.talents.length 
        ? character.talents[talentIndex] 
        : null;
    const isNew = !talent;

    // Escape handler (stored for cleanup)
    escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeTalentEditor();
        }
    };

    // Create modal
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'talent-editor-modal';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '600px';

    // Use escHtml for all user-generated content to prevent XSS
    const talentName = talent ? escHtml(talent.name) : '';
    const talentDesc = talent ? escHtml(talent.description || '') : '';
    const talentCost = talent?.cost ?? '';
    const talentTier = talent?.tier || 'I';
    const talentPrereq = talent ? escHtml(talent.prereq || '') : '';

    modal.innerHTML = `
        <button class="modal-close" id="talent-editor-close">&times;</button>
        <h2>${isNew ? '➕ Add Talent' : '✏️ Edit Talent'}</h2>
        <form id="talent-editor-form">
            <div class="form-group">
                <label for="talent-name">Talent Name *</label>
                <input type="text" id="talent-name" value="${talentName}" placeholder="e.g., Warrior's Resolve" required />
            </div>
            <div class="form-group">
                <label for="talent-description">Description</label>
                <textarea id="talent-description" rows="4" placeholder="Describe the talent...">${talentDesc}</textarea>
            </div>
            <div class="form-group" style="display:inline-block;width:48%;margin-right:2%;">
                <label for="talent-cost">XP Cost</label>
                <input type="number" id="talent-cost" value="${talentCost}" placeholder="e.g., 5" min="0" />
            </div>
            <div class="form-group" style="display:inline-block;width:48%;">
                <label for="talent-tier">Tier</label>
                <select id="talent-tier">
                    <option value="I" ${talentTier === 'I' ? 'selected' : ''}>I</option>
                    <option value="II" ${talentTier === 'II' ? 'selected' : ''}>II</option>
                    <option value="III" ${talentTier === 'III' ? 'selected' : ''}>III</option>
                </select>
            </div>
            <div class="form-group">
                <label for="talent-prereq">Prerequisites</label>
                <input type="text" id="talent-prereq" value="${talentPrereq}" placeholder="e.g., Body 3, Melee 2" />
            </div>
            <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
                <button type="submit" class="btn btn-gold">💾 Save Talent</button>
                <button type="button" class="btn" id="talent-editor-cancel">Cancel</button>
                ${!isNew ? `<button type="button" class="btn btn-danger" id="talent-editor-delete">🗑️ Delete</button>` : ''}
            </div>
        </form>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Store references for cleanup
    activeOverlay = overlay;
    activeModal = modal;

    // Setup events
    const closeModal = () => closeTalentEditor();

    // Close button
    const closeBtn = document.getElementById('talent-editor-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Cancel button
    const cancelBtn = document.getElementById('talent-editor-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Escape key
    document.addEventListener('keydown', escapeHandler);

    // Delete handler
    const deleteBtn = document.getElementById('talent-editor-delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const name = talent?.name || 'Untitled';
            if (confirm(`Delete talent "${name}"?`)) {
                character.talents.splice(talentIndex, 1);
                saveState();
                closeModal();
                showToast('🗑️ Talent deleted.', 'success');
                document.dispatchEvent(new CustomEvent('character-updated'));
            }
        });
    }

    // Submit handler
    const form = document.getElementById('talent-editor-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

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

            const talentData = {
                name: name,
                description: document.getElementById('talent-description')?.value?.trim() || '',
                cost: parseInt(document.getElementById('talent-cost')?.value) || 0,
                tier: document.getElementById('talent-tier')?.value || 'I',
                prereq: document.getElementById('talent-prereq')?.value?.trim() || ''
            };

            if (isNew) {
                character.talents.push(talentData);
                showToast(`✅ Added talent "${name}"`, 'success');
            } else {
                character.talents[talentIndex] = talentData;
                showToast(`✅ Updated talent "${name}"`, 'success');
            }

            saveState();
            closeModal();
            document.dispatchEvent(new CustomEvent('character-updated'));
        });
    }
}

/**
 * Close the talent editor modal and clean up all listeners
 */
export function closeTalentEditor() {
    // Remove escape key listener
    if (escapeHandler) {
        document.removeEventListener('keydown', escapeHandler);
        escapeHandler = null;
    }

    // Remove modal from DOM
    if (activeOverlay && activeOverlay.parentNode) {
        activeOverlay.parentNode.removeChild(activeOverlay);
    }

    // Clear references
    activeOverlay = null;
    activeModal = null;
}

// Export for use in other modules
export default {
    openTalentEditor,
    closeTalentEditor
};