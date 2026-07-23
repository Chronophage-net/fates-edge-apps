/**
 * Summoning – Bound Spirits and Leash Management
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml, generateId } from '../../../core/utils.js';
import { showToast } from '../../../components/Toast.js';

export function renderSummoning(el) {
  const char = getCharacterData();
  if (!char || char.magicPath !== 'summoner') {
    el.innerHTML = `<p style="color:var(--text3);">Summoning interface is only for Summoners.</p>`;
    return;
  }

  const spirits = char.boundSpirits || [];
  const leashMax = char.leashMax || 4;

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h3 style="margin:0;">👁️ Bound Spirits</h3>
      <button class="btn btn-sm btn-primary" id="add-spirit-btn">+ Bind Spirit</button>
    </div>
    <div style="margin-top:0.5rem;display:flex;flex-direction:column;gap:0.4rem;">
  `;

  if (spirits.length === 0) {
    html += `<p style="color:var(--text3);font-size:0.9rem;">No spirits bound.</p>`;
  } else {
    spirits.forEach(spirit => {
      const leashPct = Math.min(100, ((spirit.currentLeash || 0) / (spirit.leashMax || leashMax)) * 100);
      html += `
        <div style="padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg3);">
          <div style="display:flex;justify-content:space-between;">
            <strong>${escHtml(spirit.name)}</strong>
            <div>
              <span style="font-size:0.7rem;color:var(--text3);">Leash ${spirit.currentLeash || 0}/${spirit.leashMax || leashMax}</span>
              <button class="btn btn-xs btn-ghost spirit-edit" data-id="${spirit.id}" style="margin-left:0.3rem;">✏️</button>
              <button class="btn btn-xs btn-ghost spirit-release" data-id="${spirit.id}" style="color:var(--red);">🔓</button>
            </div>
          </div>
          <div style="width:100%;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;margin:0.2rem 0;">
            <div style="width:${leashPct}%;height:100%;background:${leashPct > 80 ? 'var(--red)' : 'var(--gold)'};border-radius:2px;"></div>
          </div>
          <div style="font-size:0.8rem;color:var(--text2);">${escHtml(spirit.nature || 'Spirit')}</div>
          <div style="font-size:0.75rem;color:var(--text3);">Services: ${escHtml((spirit.services || []).join(', '))}</div>
          <div style="font-size:0.75rem;color:var(--text3);">Price: ${escHtml(spirit.price || 'None')}</div>
        </div>
      `;
    });
  }

  html += `</div>`;
  el.innerHTML = html;

  el.querySelector('#add-spirit-btn')?.addEventListener('click', addSpirit);
  el.querySelectorAll('.spirit-edit').forEach(btn => {
    btn.addEventListener('click', () => editSpirit(btn.dataset.id));
  });
  el.querySelectorAll('.spirit-release').forEach(btn => {
    btn.addEventListener('click', () => releaseSpirit(btn.dataset.id));
  });
}

function addSpirit() {
  const char = getCharacterData();
  if (!char) return;

  const name = prompt('Spirit name:');
  if (!name) return;
  const nature = prompt('Nature (e.g., Indigenous, Ancestral):') || 'Unknown';
  const services = prompt('Services (comma-separated):') || '';
  const price = prompt('Price (what you pay):') || 'None';

  const newSpirit = {
    id: generateId('spirit_'),
    name: name,
    nature: nature,
    services: services.split(',').map(s => s.trim()).filter(Boolean),
    price: price,
    leashMax: 4,
    currentLeash: 0
  };

  if (!char.boundSpirits) char.boundSpirits = [];
  char.boundSpirits.push(newSpirit);
  saveCharacter({ boundSpirits: char.boundSpirits });
  showToast(`Spirit "${name}" bound.`, 'success');
}

function editSpirit(id) {
  const char = getCharacterData();
  if (!char) return;
  const spirit = char.boundSpirits.find(s => s.id === id);
  if (!spirit) return showToast('Spirit not found.', 'error');

  const name = prompt('Spirit name:', spirit.name);
  if (name === null) return;
  const nature = prompt('Nature:', spirit.nature) || 'Unknown';
  const services = prompt('Services (comma-separated):', (spirit.services || []).join(', ')) || '';
  const price = prompt('Price:', spirit.price) || 'None';
  const leashMax = safeParseInt(prompt('Leash max:', spirit.leashMax || 4), 4);

  spirit.name = name;
  spirit.nature = nature;
  spirit.services = services.split(',').map(s => s.trim()).filter(Boolean);
  spirit.price = price;
  spirit.leashMax = leashMax;

  saveCharacter({ boundSpirits: char.boundSpirits });
  showToast('Spirit updated.', 'success');
}

function releaseSpirit(id) {
  const char = getCharacterData();
  if (!char) return;
  if (!confirm('Release this spirit? (This may have consequences)')) return;
  char.boundSpirits = char.boundSpirits.filter(s => s.id !== id);
  saveCharacter({ boundSpirits: char.boundSpirits });
  showToast('Spirit released.', 'warning');
}
