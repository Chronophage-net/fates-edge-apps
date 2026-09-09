import { t } from './i18n.js';

export function choosePlayerMode(search, saved, narrow) {
    const requested = new URLSearchParams(search).get('view');
    if (requested === 'player' || requested === 'full') return requested === 'player';
    if (saved === 'player' || saved === 'full') return saved === 'player';
    return narrow;
}

export function initPlayerMode() {
    let saved;
    try { saved = localStorage.getItem('fates-edge-view'); } catch {}
    const enabled = choosePlayerMode(location.search, saved, matchMedia('(max-width: 700px)').matches);
    document.body.classList.toggle('player-mode', enabled);
    const shell = document.getElementById('app-content');
    const nav = document.createElement('nav');
    nav.className = 'player-nav';
    nav.setAttribute('aria-label', t('player.navigation'));
    nav.dataset.i18nAttr = 'aria-label:player.navigation';
    const routes = [['player', '⌂', 'home'], ['characters', '♙', 'sheet'], ['dice', '⚄', 'dice'], ['vtt', '☏', 'table'], ['docs', '▤', 'rules']];
    for (const [route, icon, key] of routes) {
        const link = document.createElement('a');
        link.href = `#${route}`;
        link.dataset.route = route;
        const symbol = document.createElement('span');
        symbol.textContent = icon;
        symbol.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'player-nav-label';
        label.dataset.i18n = `player.${key}`;
        label.textContent = t(`player.${key}`);
        link.append(symbol, label);
        nav.append(link);
    }
    shell.append(nav);
    const update = () => nav.querySelectorAll('a').forEach(a => {
        if (a.dataset.route === location.hash.slice(1)) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
    });
    window.addEventListener('hashchange', update);
    if (enabled && !location.hash) history.replaceState(null, '', `${location.pathname}${location.search}#player`);
    update();
    const switcher = document.createElement('button');
    switcher.className = 'btn player-mode-switch';
    switcher.dataset.i18n = enabled ? 'player.full' : 'player.mobile';
    switcher.textContent = t(switcher.dataset.i18n);
    switcher.addEventListener('click', () => {
        const next = enabled ? 'full' : 'player';
        try { localStorage.setItem('fates-edge-view', next); } catch {}
        const url = new URL(location.href);
        url.searchParams.set('view', next);
        url.hash = enabled ? 'home' : 'player';
        location.assign(url.href);
    });
    document.querySelector('.sidebar-brand').after(switcher);
}
