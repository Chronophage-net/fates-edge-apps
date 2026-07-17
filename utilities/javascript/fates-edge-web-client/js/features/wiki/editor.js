/**
 * Wiki Editor – Markdown editor for wiki entries
 * Provides a modal editor for creating and editing wiki entries.
 * FIXED: Removed unused sanitizeHtml import.
 */

import { getState, addWikiEntry, updateWikiEntry, saveState } from '../../core/state.js';
import { escHtml } from '../../core/utils.js';  // only escHtml needed
import { showToast } from '../../components/Toast.js';

let modalOverlay = null;
let currentEntryId = null;
let editorInstance = null;

// ============================================================
// OPEN EDITOR
// ============================================================

export function openEditor(id) {
    const state = getState();
    const entries = state.wikiEntries || [];
    let entry = null;
    let isNew = false;

    if (id) {
        entry = entries.find(e => String(e.id) === String(id));
    }

    if (!entry) {
        // New entry
        isNew = true;
        entry = {
            id: 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            title: '',
            category: 'lore',
            body: '',
            tags: [],
            cost: null,
            slot: '',
            source: 'local'
        };
    }

    currentEntryId = isNew ? null : id;
    createEditorModal(entry, isNew);
}

// ============================================================
// CREATE EDITOR MODAL
// ============================================================

function createEditorModal(entry, isNew) {
    // Remove any existing modal
    removeEditorModal();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'wiki-editor-modal';
    overlay.style.display = 'flex !important';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '800px';
    modal.style.width = '95%';

    const titleText = isNew ? '📝 Create Wiki Entry' : `✏️ Edit: ${entry.title}`;

    modal.innerHTML = `
        <button class="close" id="wiki-editor-close">&times;</button>
        <h2>${titleText}</h2>

        <form id="wiki-editor-form">
            <!-- Title -->
            <div class="form-group">
                <label for="wiki-editor-title">Title *</label>
                <input type="text" id="wiki-editor-title" value="${escHtml(entry.title)}" placeholder="Entry title" required />
            </div>

            <!-- Category -->
            <div class="form-group">
                <label for="wiki-editor-category">Category</label>
                <select id="wiki-editor-category">
                    <option value="rules" ${entry.category === 'rules' ? 'selected' : ''}>📜 Rules</option>
                    <option value="patrons" ${entry.category === 'patrons' ? 'selected' : ''}>👁️ Patrons</option>
                    <option value="regions" ${entry.category === 'regions' ? 'selected' : ''}>🌍 Regions</option>
                    <option value="magic" ${entry.category === 'magic' ? 'selected' : ''}>🔮 Magic</option>
                    <option value="combat" ${entry.category === 'combat' ? 'selected' : ''}>⚔️ Combat</option>
                    <option value="lore" ${entry.category === 'lore' ? 'selected' : ''}>📚 Lore</option>
                    <option value="talents" ${entry.category === 'talents' ? 'selected' : ''}>🧠 Talents</option>
                    <option value="assets" ${entry.category === 'assets' ? 'selected' : ''}>🏛️ Assets</option>
                    <option value="equipment" ${entry.category === 'equipment' ? 'selected' : ''}>⚒️ Equipment</option>
                    <option value="characters" ${entry.category === 'characters' ? 'selected' : ''}>👤 Characters</option>
                    <option value="monsters" ${entry.category === 'monsters' ? 'selected' : ''}>🐉 Monsters</option>
                    <option value="other" ${entry.category === 'other' ? 'selected' : ''}>📌 Other</option>
                </select>
            </div>

            <!-- Tags -->
            <div class="form-group">
                <label for="wiki-editor-tags">Tags (comma separated)</label>
                <input type="text" id="wiki-editor-tags" value="${escHtml((entry.tags || []).join(', '))}" placeholder="e.g., combat, magic, reference" />
            </div>

            <!-- Cost -->
            <div class="form-group" style="display:inline-block;width:48%;margin-right:2%;">
                <label for="wiki-editor-cost">XP Cost</label>
                <input type="number" id="wiki-editor-cost" value="${entry.cost != null ? entry.cost : ''}" placeholder="e.g., 5" min="0" />
            </div>

            <!-- Slot -->
            <div class="form-group" style="display:inline-block;width:48%;">
                <label for="wiki-editor-slot">Slot</label>
                <input type="text" id="wiki-editor-slot" value="${escHtml(entry.slot || '')}" placeholder="e.g., Head, Weapon" />
            </div>

            <!-- Body -->
            <div class="form-group">
                <label for="wiki-editor-body">Content (Markdown supported)</label>
                <div style="display:flex;gap:0.5rem;margin-bottom:0.3rem;">
                    <button type="button" class="btn btn-xs btn-ghost markdown-help-btn" title="Markdown help">ℹ️</button>
                    <span style="font-size:0.7rem;color:var(--text3);">Supports: **bold**, *italic*, # headings, - lists, [links](url)</span>
                </div>
                <textarea id="wiki-editor-body" rows="12" placeholder="Write your wiki content here...">${escHtml(entry.body || '')}</textarea>
            </div>

            <!-- Preview -->
            <div class="form-group">
                <label>
                    <input type="checkbox" id="wiki-editor-preview-toggle" />
                    Show preview
                </label>
                <div id="wiki-editor-preview" style="display:none;background:var(--bg3);padding:1rem;border-radius:var(--radius);margin-top:0.5rem;max-height:300px;overflow-y:auto;">
                    <!-- Preview rendered here -->
                </div>
            </div>

            <!-- Buttons -->
            <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
                <button type="submit" class="btn btn-gold" id="wiki-editor-save">💾 Save Entry</button>
                <button type="button" class="btn btn-danger" id="wiki-editor-delete" style="${isNew ? 'display:none;' : ''}">🗑️ Delete</button>
                <button type="button" class="btn" id="wiki-editor-cancel">Cancel</button>
            </div>
        </form>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    modalOverlay = overlay;

    // Store reference to entry for delete
    if (!isNew) {
        modal.dataset.entryId = entry.id;
    }

    // Setup event listeners
    setupEditorEvents(entry, isNew);
}

// ============================================================
// SETUP EDITOR EVENTS
// ============================================================

function setupEditorEvents(entry, isNew) {
    const form = document.getElementById('wiki-editor-form');
    const closeBtn = document.getElementById('wiki-editor-close');
    const cancelBtn = document.getElementById('wiki-editor-cancel');
    const deleteBtn = document.getElementById('wiki-editor-delete');
    const previewToggle = document.getElementById('wiki-editor-preview-toggle');
    const previewDiv = document.getElementById('wiki-editor-preview');
    const bodyTextarea = document.getElementById('wiki-editor-body');
    const helpBtn = document.querySelector('.markdown-help-btn');

    // Close handlers
    const closeModal = () => removeEditorModal();

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Click outside to close
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // Preview toggle
    previewToggle.addEventListener('change', () => {
        if (previewToggle.checked) {
            previewDiv.style.display = 'block';
            renderPreview(bodyTextarea.value, previewDiv);
        } else {
            previewDiv.style.display = 'none';
        }
    });

    // Live preview update
    bodyTextarea.addEventListener('input', () => {
        if (previewToggle.checked) {
            renderPreview(bodyTextarea.value, previewDiv);
        }
    });

    // Markdown help
    if (helpBtn) {
        helpBtn.addEventListener('click', showMarkdownHelp);
    }

    // Delete
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const id = modalOverlay.querySelector('.modal')?.dataset?.entryId;
            if (id && confirm('Delete this entry?')) {
                const state = getState();
                state.wikiEntries = (state.wikiEntries || []).filter(e => String(e.id) !== String(id));
                saveState();
                removeEditorModal();
                showToast('🗑️ Entry deleted.', 'success');
                // Re-render wiki
                import('./index.js').then(module => {
                    if (module.renderWiki) module.renderWiki();
                });
            }
        });
    }

    // Submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveEntry(isNew);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveEntry(isNew);
        }
    });

    // Focus title
    setTimeout(() => {
        const titleInput = document.getElementById('wiki-editor-title');
        if (titleInput) titleInput.focus();
    }, 100);
}

// ============================================================
// SAVE ENTRY
// ============================================================

function saveEntry(isNew) {
    const titleInput = document.getElementById('wiki-editor-title');
    const categorySelect = document.getElementById('wiki-editor-category');
    const tagsInput = document.getElementById('wiki-editor-tags');
    const costInput = document.getElementById('wiki-editor-cost');
    const slotInput = document.getElementById('wiki-editor-slot');
    const bodyTextarea = document.getElementById('wiki-editor-body');

    const title = titleInput.value.trim();
    if (!title) {
        showToast('Please enter a title.', 'error');
        titleInput.focus();
        return;
    }

    const state = getState();
    const entries = state.wikiEntries || [];

    // Check for duplicate title (only for new entries)
    if (isNew) {
        const exists = entries.some(e => e.title.toLowerCase() === title.toLowerCase());
        if (exists) {
            showToast(`Entry "${title}" already exists.`, 'error');
            titleInput.focus();
            return;
        }
    }

    const entryData = {
        title: title,
        category: categorySelect.value,
        tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
        cost: costInput.value !== '' ? parseInt(costInput.value) : null,
        slot: slotInput.value.trim(),
        body: bodyTextarea.value,
        source: 'local'
    };

    let entryId;
    if (isNew) {
        const newId = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        entryId = newId;
        entryData.id = newId;
        addWikiEntry(entryData);
        showToast(`✅ Created "${title}"`, 'success');
    } else {
        const id = modalOverlay.querySelector('.modal')?.dataset?.entryId;
        if (!id) {
            showToast('Error: Entry ID not found.', 'error');
            return;
        }
        entryId = id;
        updateWikiEntry(id, entryData);
        showToast(`✅ Updated "${title}"`, 'success');
    }

    saveState();
    removeEditorModal();

    // Re-render wiki
    import('./index.js').then(module => {
        if (module.renderWiki) module.renderWiki();
    });
}

// ============================================================
// RENDER PREVIEW
// ============================================================

function renderPreview(text, container) {
    try {
        if (window.marked) {
            let html;
            if (typeof window.marked.parse === 'function') {
                html = window.marked.parse(text);
            } else if (typeof window.marked === 'function') {
                html = window.marked(text);
            }
            container.innerHTML = html || '<em>Empty content</em>';
        } else {
            container.innerHTML = escHtml(text).replace(/\n/g, '<br>');
        }
    } catch (e) {
        container.innerHTML = escHtml(text).replace(/\n/g, '<br>');
    }
}

// ============================================================
// MARKDOWN HELP
// ============================================================

function showMarkdownHelp() {
    const helpHtml = `
        <div style="font-size:0.85rem;line-height:1.6;">
            <h4>Markdown Quick Reference</h4>
            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                <tr><td><code>**bold**</code></td><td><strong>bold</strong></td></tr>
                <tr><td><code>*italic*</code></td><td><em>italic</em></td></tr>
                <tr><td><code># Heading</code></td><td># Heading</td></tr>
                <tr><td><code>- list item</code></td><td>• list item</td></tr>
                <tr><td><code>[text](url)</code></td><td><a href="#">text</a></td></tr>
                <tr><td><code>---</code></td><td>Horizontal rule</td></tr>
                <tr><td><code>> quote</code></td><td>blockquote</td></tr>
            </table>
            <p style="margin-top:0.5rem;">Full markdown support via <code>marked</code> library.</p>
        </div>
    `;

    showToast(helpHtml, 'info', { html: true, duration: 8000 });
}

// ============================================================
// REMOVE EDITOR MODAL
// ============================================================

function removeEditorModal() {
    if (modalOverlay && modalOverlay.parentNode) {
        modalOverlay.parentNode.removeChild(modalOverlay);
        modalOverlay = null;
    }
    currentEntryId = null;
}

// ============================================================
// EXPORTS
// ============================================================

export default {
    openEditor,
    removeEditorModal,
};

// ============================================================
// STYLES (injected once)
// ============================================================

(function injectStyles() {
    if (document.getElementById('wiki-editor-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'wiki-editor-styles';
    styles.textContent = `
        #wiki-editor-modal .form-group {
            margin-bottom: 1rem;
        }
        #wiki-editor-modal .form-group label {
            display: block;
            margin-bottom: 0.25rem;
            font-weight: 500;
            color: var(--text2);
            font-size: 0.9rem;
        }
        #wiki-editor-modal .form-group input,
        #wiki-editor-modal .form-group select,
        #wiki-editor-modal .form-group textarea {
            width: 100%;
            padding: 0.5rem 0.7rem;
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            color: var(--text);
            font-family: var(--font);
            font-size: 0.95rem;
            transition: border-color 0.2s;
        }
        #wiki-editor-modal .form-group input:focus,
        #wiki-editor-modal .form-group select:focus,
        #wiki-editor-modal .form-group textarea:focus {
            outline: none;
            border-color: var(--gold);
            box-shadow: 0 0 0 3px var(--gold-glow);
        }
        #wiki-editor-modal .form-group textarea {
            font-family: var(--font-mono, monospace);
            font-size: 0.9rem;
            line-height: 1.6;
            resize: vertical;
        }
        #wiki-editor-modal .modal {
            max-height: 90vh;
            overflow-y: auto;
        }
        #wiki-editor-modal .modal .close {
            position: sticky;
            float: right;
            top: 0;
            z-index: 10;
        }
        #wiki-editor-modal .btn-xs {
            padding: 0.1rem 0.5rem;
            font-size: 0.7rem;
        }
        #wiki-editor-modal .markdown-help-btn {
            background: var(--bg4);
            border-radius: 50%;
            width: 24px;
            height: 24px;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            border: 1px solid var(--border);
            cursor: pointer;
            color: var(--text2);
        }
        #wiki-editor-modal .markdown-help-btn:hover {
            background: var(--gold);
            color: var(--bg);
        }
        #wiki-editor-preview {
            background: var(--bg3);
            padding: 1rem;
            border-radius: var(--radius-sm);
            max-height: 300px;
            overflow-y: auto;
        }
        #wiki-editor-preview h1, #wiki-editor-preview h2, #wiki-editor-preview h3 {
            color: var(--gold);
        }
        #wiki-editor-preview a {
            color: var(--gold);
            text-decoration: underline;
        }
        #wiki-editor-preview ul, #wiki-editor-preview ol {
            padding-left: 1.5rem;
        }
        #wiki-editor-preview blockquote {
            border-left: 3px solid var(--gold);
            padding-left: 1rem;
            color: var(--text2);
            margin: 0.5rem 0;
        }
    `;
    document.head.appendChild(styles);
})();