/**
 * Rites / Songs / Arts renderer
 */

import { getCharacterData, getPatronRites } from '../index.js';
import { escHtml } from '../../../core/utils.js';
import { showToast } from '../../../components/Toast.js';

export function renderRites(el) {
  const char = getCharacterData();
  if (!char) {
    el.innerHTML = `<p style="color:var(--text3);">Select a character.</p>`;
    return;
  }

  const path = char.magicPath || 'none';
  const patronName = char.patron;

  if (path === 'none' || path === 'free-caster') {
    el.innerHTML = `<p style="color:var(--text3);">This character has no Patron‑based magic.</p>`;
    return;
  }

  // For Runekeeper, Invoker, Cantor, Witch, Summoner – we use patron rites
  const rites = getPatronRites(patronName);
  if (!rites || rites.length === 0) {
    el.innerHTML = `<p style="color:var(--text3);">No rites found for ${patronName || 'this patron'}.</p>`;
    return;
  }

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h3 style="margin:0;">${path.charAt(0).toUpperCase() + path.slice(1)} Rites</h3>
      <span style="font-size:0.8rem;color:var(--text3);">Patron: ${escHtml(patronName)}</span>
    </div>
    <div style="margin-top:0.5rem;display:flex;flex-direction:column;gap:0.3rem;">
  `;

  rites.forEach(rite => {
    const costText = rite.obligation ? `${rite.obligation} Obligation` : `${rite.cost} XP`;
    html += `
      <div style="padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg3);">
        <div style="display:flex;justify-content:space-between;">
          <strong>${escHtml(rite.name)}</strong>
          <span style="color:var(--gold);font-size:0.8rem;">${costText}</span>
        </div>
        <div style="font-size:0.85rem;color:var(--text2);">${escHtml(rite.effect)}</div>
        <div style="font-size:0.7rem;color:var(--text3);">${rite.type || 'Rite'}</div>
      </div>
    `;
  });

  html += `</div>`;
  el.innerHTML = html;
}
