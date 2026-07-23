/**
 * Spellbook – custom spells (including TAGS combinations)
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml, generateId, safeParseInt } from '../../../core/utils.js';
import { showToast } from '../../../components/Toast.js';

export function renderSpellbook(el) {
  const char = getCharacterData();
  if (!char) {
    el.innerHTML = `<p style="color:var(--text3);">Select a character.</p>`;
    return;
  }

  const spells = char.spellbook || [];

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h3 style="margin:0;">📚 Spellbook</h3>
      <button class="btn btn-sm btn-primary" id="add-spell-btn">+ Add Spell</button>
    </div>
    <div style="margin-top:0.5rem;display:flex;flex-direction:column;gap:0.4rem;">
  `;

  if (spells.length === 0) {
    html += `<p style="color:var(--text3);font-size:0.9rem;">No custom spells yet.</p>`;
  } else {
    spells.forEach(spell => {
      const tagsDisplay = spell.tags ? spell.tags.join(' ') : '';
      html += `
        <div style="padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg3);">
          <div style="display:flex;justify-content:space-between;">
            <strong>${escHtml(spell.name)}</strong>
            <div>
              <span style="font-size:0.7rem;color:var(--text3);">DV ${spell.dv || 0}</span>
              <button class="btn btn-xs btn-ghost spell-edit" data-id="${spell.id}" style="margin-left:0.3rem;">✏️</button>
              <button class="btn btn-xs btn-ghost spell-delete" data-id="${spell.id}" style="color:var(--red);">✕</button>
            </div>
          </div>
          ${spell.tags ? `<div style="font-size:0.7rem;color:var(--text3);">${tagsDisplay}</div>` : ''}
          <div style="font-size:0.85rem;color:var(--text2);">${escHtml(spell.effect || spell.description || '')}</div>
          ${spell.cost ? `<div style="font-size:0.7rem;color:var(--text3);">Cost: ${JSON.stringify(spell.cost)}</div>` : ''}
        </div>
      `;
    });
  }

  html += `</div>`;
  el.innerHTML = html;

  // Attach events for add/edit/delete
  el.querySelector('#add-spell-btn')?.addEventListener('click', () => addSpell());
  el.querySelectorAll('.spell-edit').forEach(btn => {
    btn.addEventListener('click', () => editSpell(btn.dataset.id));
  });
  el.querySelectorAll('.spell-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteSpell(btn.dataset.id));
  });
}

function addSpell() {
  const char = getCharacterData();
  if (!char) return;

  const name = prompt('Spell name:');
  if (!name) return;
  const description = prompt('Description / Effect:') || '';
  const tagsInput = prompt('Tags (space-separated, e.g., FIRE STRIKE AREA):') || '';
  const tags = tagsInput.trim() ? tagsInput.split(/\s+/) : [];
  const dv = safeParseInt(prompt('DV (difficulty):') || 0, 0);

  const newSpell = {
    id: generateId('spell_'),
    name: name,
    description: description,
    tags: tags,
    dv: dv,
    cost: {},
    source: 'custom'
  };

  if (!char.spellbook) char.spellbook = [];
  char.spellbook.push(newSpell);
  saveCharacter({ spellbook: char.spellbook });
  showToast(`Spell "${name}" added.`, 'success');
}

function editSpell(id) {
  const char = getCharacterData();
  if (!char) return;
  const spell = char.spellbook.find(s => s.id === id);
  if (!spell) return showToast('Spell not found.', 'error');

  const name = prompt('Spell name:', spell.name);
  if (name === null) return;
  const description = prompt('Description:', spell.description || '') || '';
  const tagsInput = prompt('Tags (space-separated):', (spell.tags || []).join(' ')) || '';
  const tags = tagsInput.trim() ? tagsInput.split(/\s+/) : [];
  const dv = safeParseInt(prompt('DV:', spell.dv || 0), 0);

  spell.name = name;
  spell.description = description;
  spell.tags = tags;
  spell.dv = dv;
  saveCharacter({ spellbook: char.spellbook });
  showToast('Spell updated.', 'success');
}

function deleteSpell(id) {
  const char = getCharacterData();
  if (!char) return;
  if (!confirm('Delete this spell?')) return;
  char.spellbook = char.spellbook.filter(s => s.id !== id);
  saveCharacter({ spellbook: char.spellbook });
  showToast('Spell deleted.', 'success');
}
