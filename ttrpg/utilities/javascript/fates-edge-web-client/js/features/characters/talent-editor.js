/**
 * Talent Editor - Character talent management
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';

export function openTalentEditor(characterId, talentIndex = -1) {
    const state = getState();
    const character = state.characters?.find(c => c.id === characterId);
    if (!character) {
        showToast('Character not found.', 'error');
        return;
    }

    const talent = talentIndex >= 0 ? character.talents[talentIndex] : null;
    const isNew = !talent;

    // Create modal for talent editing
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'talent-editor-modal';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '600px';

    modal.innerHTML = `
        <button class="close" id="talent-editor-close">&times;</button>
        <h2>${isNew ? '➕ Add Talent' : '✏️ Edit Talent'}</h2>
        <form id="talent-editor-form">
            <div class="form-group">
                <label for="talent-name">Talent Name *</label>
                <input type="text" id="talent-name" value="${talent?.name || ''}" placeholder="e.g., Warrior's Resolve" required />
            </div>
            <div class="form-group">
                <label for="talent-description">Description</label>
                <textarea id="talent-description" rows="4" placeholder="Describe the talent...">${talent?.description || ''}</textarea>
            </div>
            <div class="form-group" style="display:inline-block;width:48%;margin-right:2%;">
                <label for="talent-cost">XP Cost</label>
                <input type="number" id="talent-cost" value="${talent?.cost || ''}" placeholder="e.g., 5" min="0" />
            </div>
            <div class="form-group" style="display:inline-block;width:48%;">
                <label for="talent-tier">Tier</label>
                <select id="talent-tier">
                    <option value="I" ${talent?.tier === 'I' ? 'selected' : ''}>I</option>
                    <option value="II" ${talent?.tier === 'II' ? 'selected' : ''}>II</option>
                    <option value="III" ${talent?.tier === 'III' ? 'selected' : ''}>III</option>
                </select>
            </div>
            <div class="form-group">
                <label for="talent-prereq">Prerequisites</label>
                <input type="text" id="talent-prereq" value="${talent?.prereq || ''}" placeholder="e.g., Body 3, Melee 2" />
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

    // Setup events
    const closeModal = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    document.getElementById('talent-editor-close').addEventListener('click', closeModal);
    document.getElementById('talent-editor-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Delete handler
    const deleteBtn = document.getElementById('talent-editor-delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Delete talent "${talent?.name || 'Untitled'}"?`)) {
                character.talents.splice(talentIndex, 1);
                saveState();
                closeModal();
                showToast('🗑️ Talent deleted.', 'success');
                // Refresh character view
                document.dispatchEvent(new CustomEvent('character-updated'));
            }
        });
    }

    // Submit handler
    document.getElementById('talent-editor-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('talent-name').value.trim();
        if (!name) {
            showToast('Please enter a talent name.', 'error');
            return;
        }

        const talentData = {
            name: name,
            description: document.getElementById('talent-description').value.trim(),
            cost: parseInt(document.getElementById('talent-cost').value) || 0,
            tier: document.getElementById('talent-tier').value,
            prereq: document.getElementById('talent-prereq').value.trim()
        };

        if (isNew) {
            if (!character.talents) character.talents = [];
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

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// Export for use in other modules
export default {
    openTalentEditor
};
