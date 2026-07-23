/**
 * Trackers – Obligation, Corruption, Leash, Mental Strain, etc.
 */

import { getCharacterData } from '../index.js';
import { escHtml } from '../../../core/utils.js';

export function renderTrackers(el) {
  const char = getCharacterData();
  if (!char) {
    el.innerHTML = `<p style="color:var(--text3);">No character selected.</p>`;
    return;
  }

  const path = char.magicPath || 'none';
  const body = char.body || 1;
  const spirit = char.spirit || 1;
  const presence = char.presence || 1;
  const obligation = char.obligation || 0;
  const corruption = char.corruption || 0;
  const corruptionMax = char.corruptionMax || spirit;
  const leash = char.leash || 0;
  const mentalStrain = char.mentalStrain || 0;
  const mentalStrainMax = char.mentalStrainMax || spirit;
  const shadow = char.shadow || 0;
  const shame = char.shame || 0;
  const identityStrain = char.identityStrain || 0;

  let html = `
    <h3 style="margin:0;">📊 Character Tracks</h3>
    <div style="display:flex;flex-wrap:wrap;gap:0.8rem;margin-top:0.3rem;">
  `;

  // Obligation – if Runekeeper or Invoker
  if (path === 'runekeeper' || path === 'invoker') {
    const maxObligation = (spirit + presence) || 1;
    const pct = Math.min(100, (obligation / maxObligation) * 100);
    html += `
      <div style="flex:1;min-width:100px;">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
          <span>⛓️ Obligation</span>
          <span>${obligation}/${maxObligation}</span>
        </div>
        <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${pct > 80 ? 'var(--red)' : pct > 60 ? 'var(--orange)' : 'var(--gold)'};border-radius:3px;"></div>
        </div>
      </div>
    `;
  }

  // Corruption – Cantor
  if (path === 'cantor') {
    const pct = Math.min(100, (corruption / corruptionMax) * 100);
    html += `
      <div style="flex:1;min-width:100px;">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
          <span>🎵 Corruption</span>
          <span>${corruption}/${corruptionMax}</span>
        </div>
        <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${pct > 80 ? 'var(--purple)' : 'var(--blue)'};border-radius:3px;"></div>
        </div>
      </div>
    `;
  }

  // Leash – Summoner
  if (path === 'summoner') {
    const leashMax = char.leashMax || 4; // default
    const pct = Math.min(100, (leash / leashMax) * 100);
    html += `
      <div style="flex:1;min-width:100px;">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
          <span>👁️ Leash</span>
          <span>${leash}/${leashMax}</span>
        </div>
        <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${pct > 80 ? 'var(--red)' : 'var(--gold)'};border-radius:3px;"></div>
        </div>
      </div>
    `;
  }

  // Mental Strain – Psion
  if (path === 'psion') {
    const pct = Math.min(100, (mentalStrain / mentalStrainMax) * 100);
    html += `
      <div style="flex:1;min-width:100px;">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
          <span>🧠 Mental Strain</span>
          <span>${mentalStrain}/${mentalStrainMax}</span>
        </div>
        <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${pct > 80 ? 'var(--red)' : 'var(--blue)'};border-radius:3px;"></div>
        </div>
      </div>
    `;
  }

  // Witch – Shadow/Shame/Identity
  if (path === 'witch') {
    html += `
      <div style="flex:1;min-width:100px;">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
          <span>🌑 Shadow</span>
          <span>${shadow}</span>
        </div>
        <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
          <div style="width:${Math.min(100, shadow * 20)}%;height:100%;background:var(--purple);border-radius:3px;"></div>
        </div>
      </div>
      <div style="flex:1;min-width:100px;">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
          <span>😞 Shame</span>
          <span>${shame}</span>
        </div>
        <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
          <div style="width:${Math.min(100, shame * 20)}%;height:100%;background:var(--red);border-radius:3px;"></div>
        </div>
      </div>
      <div style="flex:1;min-width:100px;">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
          <span>🌀 Identity Strain</span>
          <span>${identityStrain}</span>
        </div>
        <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
          <div style="width:${Math.min(100, identityStrain * 20)}%;height:100%;background:var(--gold);border-radius:3px;"></div>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  el.innerHTML = html;
}
