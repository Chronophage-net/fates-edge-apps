/**
 * TAGS Calculator for Free Casters
 */

import { getCharacterData } from '../index.js';
import { showToast } from '../../../components/Toast.js';
import { escHtml, generateId } from '../../../core/utils.js';
import { updateCharacter } from '../../../core/state.js'; // <-- added import

// Import TAGS reference
const TAGS_REFERENCE = {
  'Burning': 1, 'Freezing': 1, 'Storm': 1, 'Stone': 1, 'Wave': 1, 'Wind': 1,
  'Force': 1, 'Area': 1, 'Strike': 1, 'Wall': 1, 'Bind': 1, 'Dispel': 1,
  'Veil': 1, 'Scry': 1, 'Memory': 1, 'Command': 1, 'Fear': 1,
  'HEAL': 1, 'Purify': 1, 'Strengthen': 1, 'Waken': 1, 'Beast': 1,
  'Leap': 2, 'Fold': 2, 'Gate': 2, 'Gravity': 2,
  'Create': 2, 'Summon': 2, 'Transmute': 2, 'Animate': 2,
  'Sense': 1, 'Reveal': 1, 'Light': 1, 'Shadow': 1, 'Silence': 1, 'Protect': 1,
  'Counter': 1, 'Reflect': 2, 'Store': 2, 'Curse': 2, 'Bless': 1
};

export function renderCalculator(el) {
  const char = getCharacterData();
  if (!char || char.magicPath !== 'free-caster') {
    el.innerHTML = `<p style="color:var(--text3);">Free Caster calculator is only available for Free Casters.</p>`;
    return;
  }

  el.innerHTML = `
    <h3 style="margin:0;">⚙️ TAGS Calculator</h3>
    <div style="margin-top:0.5rem;">
      <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.3rem;">
        <input type="text" id="tags-input" placeholder="Enter TAGS (e.g., FIRE STRIKE AREA)" style="flex:1;font-size:0.9rem;" />
        <button class="btn btn-sm btn-primary" id="calc-btn">Calculate</button>
        <button class="btn btn-sm btn-gold" id="save-spell-btn">💾 Save as Spell</button>
      </div>
      <div id="calc-result" style="padding:0.3rem;background:var(--bg3);border-radius:var(--radius);min-height:2rem;font-size:0.9rem;color:var(--text2);">
        Enter tags to calculate DV and Backlash.
      </div>
    </div>
  `;

  el.querySelector('#calc-btn')?.addEventListener('click', calculateTags);
  el.querySelector('#save-spell-btn')?.addEventListener('click', saveAsSpell);
}

function calculateTags() {
  const input = document.getElementById('tags-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) {
    document.getElementById('calc-result').innerHTML = 'Please enter at least one tag.';
    return;
  }

  const tags = raw.split(/\s+/);
  let dv = 1 + tags.length; // base 1 + number of tags
  let totalMod = 0;
  let unknownTags = [];

  tags.forEach(tag => {
    const upper = tag.toUpperCase();
    if (TAGS_REFERENCE[upper] !== undefined) {
      totalMod += TAGS_REFERENCE[upper];
    } else {
      unknownTags.push(upper);
    }
  });

  // Add mod (dangerous tags increase DV)
  dv += totalMod;

  // Backlash risk based on DV
  let risk = 'Low';
  if (dv >= 6) risk = 'High';
  else if (dv >= 4) risk = 'Medium';

  let html = `
    <div><strong>Tags:</strong> ${tags.join(' ')}</div>
    <div><strong>DV:</strong> ${dv}</div>
    <div><strong>Backlash Risk:</strong> <span style="color:${risk === 'High' ? 'var(--red)' : risk === 'Medium' ? 'var(--orange)' : 'var(--green)'};">${risk}</span></div>
    ${unknownTags.length ? `<div style="color:var(--red);">Unknown tags: ${unknownTags.join(' ')}</div>` : ''}
    <div style="font-size:0.75rem;color:var(--text3);margin-top:0.2rem;">Base DV = 1 + number of tags + modifier (dangerous tags add +2).</div>
  `;

  document.getElementById('calc-result').innerHTML = html;
}

async function saveAsSpell() {
  const input = document.getElementById('tags-input');
  const result = document.getElementById('calc-result');
  if (!input || !result) return;

  const tagsRaw = input.value.trim();
  if (!tagsRaw) {
    showToast('Enter some tags first.', 'error');
    return;
  }

  const name = prompt('Spell name:');
  if (!name) return;
  const description = prompt('Effect description:') || '';

  // Compute DV again
  const tags = tagsRaw.split(/\s+/);
  let dv = 1 + tags.length;
  let totalMod = 0;
  tags.forEach(tag => {
    const upper = tag.toUpperCase();
    if (TAGS_REFERENCE[upper] !== undefined) {
      totalMod += TAGS_REFERENCE[upper];
    }
  });
  dv += totalMod;

  // Save to spellbook
  const char = getCharacterData();
  if (!char) return;
  if (!char.spellbook) char.spellbook = [];

  const newSpell = {
    id: generateId('spell_'),
    name: name,
    description: description,
    tags: tags,
    dv: dv,
    cost: {},
    source: 'custom'
  };

  char.spellbook.push(newSpell);
  updateCharacter(char.id, { spellbook: char.spellbook });
  showToast(`Spell "${name}" saved to spellbook.`, 'success');
}
