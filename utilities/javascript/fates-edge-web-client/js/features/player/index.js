import { t } from '../../core/i18n.js';
import { getCharacters, getCharacter } from '../../core/state.js';
import { escHtml } from '../../core/utils.js';
import { isConnectedToServer, getRoomCode } from '../../core/websocket.js';

export function render(el) {
    const chars = getCharacters();
    let selected;
    try { selected = localStorage.getItem('fates-edge-player-character'); } catch {}
    const char = chars.find(c => c.id === selected) || chars[0];
    el.innerHTML = `<div class="player-home">
        <p class="player-eyebrow">FATE’S EDGE · ${escHtml(t('player.edition'))}</p>
        <h1>${escHtml(t('player.ready'))}</h1>
        <p>${escHtml(t('player.intro'))}</p>
        <section class="panel"><h2>${escHtml(t('player.connection'))}</h2>
        <p>${escHtml(isConnectedToServer() ? `${t('player.connected')} · ${getRoomCode() || ''}` : t('player.offline'))}</p>
        <a class="btn" href="#settings">${escHtml(t('player.join'))}</a></section>
        <section class="panel"><h2>${escHtml(t('player.character'))}</h2>
        ${chars.length ? `<label for="player-character">${escHtml(t('player.choose'))}</label>
        <select id="player-character">${chars.map(c => `<option value="${escHtml(c.id)}" ${c.id === char?.id ? 'selected' : ''}>${escHtml(c.name || t('player.unnamed'))}</option>`).join('')}</select>
        <div id="player-summary"></div>
        <button class="btn btn-gold" id="player-edit">${escHtml(t('player.openSheet'))}</button>` : `<p>${escHtml(t('player.empty'))}</p>`}
        <a class="btn" href="#characters">${escHtml(t('player.manage'))}</a></section>
        <div class="player-shortcuts">
        ${[['dice', 'roll'], ['vtt', 'table'], ['docs', 'rules'], ['settings', 'settings']].map(([route,key]) => `<a class="panel" href="#${route}">${escHtml(t(`player.${key}`))} <span aria-hidden="true">→</span></a>`).join('')}
        </div>
        <a href="?view=full#home">${escHtml(t('player.full'))}</a>
        </div>`;
    const select = el.querySelector('#player-character');
    const summarize = () => {
        const c = getCharacter(select.value);
        if (!c) return;
        el.querySelector('#player-summary').innerHTML = `<h3>${escHtml(c.name || t('player.unnamed'))}</h3><dl class="player-stats">${['body','wits','spirit','presence','fatigue','boons'].map(key => `<div><dt>${escHtml(t(`player.${key}`))}</dt><dd>${escHtml(String(c[key] ?? 0))}</dd></div>`).join('')}</dl>`;
    };
    if (select) {
        summarize();
        select.addEventListener('change', () => {
            try { localStorage.setItem('fates-edge-player-character', select.value); } catch {}
            summarize();
        });
        el.querySelector('#player-edit').addEventListener('click', async () => {
            const { openEditor } = await import('../characters/editor.js');
            await openEditor(select.value);
        });
    }
}
