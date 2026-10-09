import { escHtml } from '../../core/utils.js';

export function mergePatronLibrary(bundled, saved = []) {
    const local = saved.filter(p => p.source === 'local');
    const ids = new Set(local.map(p => p.id));
    return [...bundled.filter(p => !ids.has(p.id)), ...local];
}

export function patronText(value) {
    if (value == null) return '';
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value)) return value.map(patronText).join(' ');
    return Object.values(value).map(patronText).join(' ');
}

export function filterPatrons(patrons, query = '', path = '', savedOnly = false, favorites = []) {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return patrons.filter(p => terms.every(term => patronText(p).toLowerCase().includes(term))
        && (!path || (path === 'rites' ? p.rites?.length : path === 'witchcraft' ? p.witchcraft : p.monastic_tradition))
        && (!savedOnly || favorites.includes(String(p.id)))).sort((a,b) => {
            const score = p => terms.filter(term => String(p.name || p.title || '').toLowerCase().includes(term)).length;
            return score(b) - score(a);
        });
}

export function patronCards(patrons, favorites = [], obligation = {}, kind = 'cosmic') {
    if (!patrons.length) return '<div class="patron-library-empty"><h3>No matching powers</h3><p>Try fewer words, another tradition, or clear the filters.</p></div>';
    return patrons.map(p => {
        const id = escHtml(String(p.id));
        const name = escHtml(p.name || p.title || 'Unnamed');
        const summary = patronText(p.subtitle || p.domain || p.type || '');
        const fullDescription = patronText(p.lore?.description || p.description || p.lore || '');
        const description = fullDescription.length > 240 ? fullDescription.slice(0,237) + '…' : fullDescription;
        const saved = favorites.includes(String(p.id));
        const capabilities = [p.rites?.length ? `${p.rites.length} rites` : '', p.witchcraft ? 'Witchcraft' : '', p.monastic_tradition ? 'Monastic tradition' : '', p.location || '', p.orders?.length ? `${p.orders.length} orders` : ''].filter(Boolean);
        return `<article class="patron-library-card"><div class="patron-card-kicker">${escHtml(kind === 'cosmic' ? 'Cosmic power' : kind === 'terrestrial' ? 'Worldly patron' : 'Faith & orders')}</div><h3>${name}</h3><p class="patron-card-subtitle">${escHtml(summary)}</p><p class="patron-card-description">${escHtml(description)}</p><div class="patron-card-tags">${capabilities.map(x => `<span>${escHtml(x)}</span>`).join('')}</div>${kind === 'cosmic' ? `<p class="patron-card-obligation">Tracked Obligation: ${Number(obligation[p.id]) || 0}</p>` : ''}<footer><button class="btn btn-gold btn-sm" data-patron-action="open" data-id="${id}">Explore ${name}</button><button class="btn btn-sm" data-patron-action="favorite" data-id="${id}" aria-pressed="${saved}" aria-label="${saved ? 'Unsave' : 'Save'} ${name}">${saved ? '★ Saved' : '☆ Save'}</button></footer></article>`;
    }).join('');
}
