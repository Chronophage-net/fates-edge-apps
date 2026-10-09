import { escHtml as esc } from '@core/utils.js';
import { getObjectiveType } from '@core/objective-types.js';

export function filterEncounters(encounters, query = '', status = 'all') {
    const term = query.trim().toLowerCase();
    return encounters.filter(e => (status === 'archived' ? e.archived : !e.archived && (status === 'all' || (e.status || 'draft') === status)))
        .filter(e => [e.title, e.body, e.location, ...(e.adversaries || []).map(a => a.name)].join(' ').toLowerCase().includes(term))
        .sort((a, b) => (({ active: 0, draft: 1, resolved: 2 })[a.status || 'draft'] ?? 3) - (({ active: 0, draft: 1, resolved: 2 })[b.status || 'draft'] ?? 3) || (b.created || 0) - (a.created || 0));
}

export function cloneEncounter(encounter, id) {
    const copy = JSON.parse(JSON.stringify(encounter));
    delete copy.trackerSession;
    return { ...copy, id, title: `${encounter.title || 'Encounter'} — copy`, status: 'draft', archived: false, aftermath: '', created: Date.now() };
}

export function snapshotSession(session) {
    return JSON.parse(JSON.stringify({ ...session, version: 1, savedAt: Date.now() }));
}

export function canResume(session) {
    return session?.version === 1 && Array.isArray(session.combatants) && Array.isArray(session.obstacles)
        && Number.isInteger(session.round) && session.round >= 0 && ['players', 'adversaries'].includes(session.turnPhase)
        && Number.isFinite(session.timerSegments) && Number.isFinite(session.timerMax) && session.timerMax > 0;
}

export function parseTrackAmount(value) {
    if (value == null || String(value).trim() === '') return null;
    const amount = Number(value);
    return Number.isSafeInteger(amount) && amount > 0 && amount <= 999 ? amount : null;
}

const button = (action, label, id = '', style = 'btn-secondary') => `<button class="btn ${style}" data-enc-action="${action}" data-id="${esc(id)}">${label}</button>`;
const field = (label, control) => `<label class="enc-field"><span>${label}</span>${control}</label>`;

export function renderShell(encounters, ui, canEdit) {
    const live = encounters.filter(e => !e.archived && e.status === 'active').length;
    return `<section class="enc-workspace"><header class="enc-hero"><div><p class="enc-kicker">SCENES WITH SOMETHING AT STAKE</p><h1>Encounters</h1><p>Prepare the pressure. Run the moment. Remember what changed.</p></div><div class="enc-hero-actions"><span><strong>${live}</strong> active · ${encounters.filter(e => !e.archived).length} in your library</span>${canEdit ? button('new', '+ New encounter', '', 'btn-gold') : '<span class="enc-chip">Read-only reference</span>'}</div></header>
    <nav class="enc-tabs" aria-label="Encounter workspace">${[['library','Encounter library'],['bestiary','Bestiary']].map(([id,label]) => `<button class="btn ${ui.view === id ? 'btn-gold' : 'btn-ghost'}" data-enc-action="view" data-id="${id}" aria-pressed="${ui.view === id}">${label}</button>`).join('')}</nav>
    ${ui.view === 'library' ? `<div class="enc-tools">${field('Search encounters', `<input id="encounter-search" type="search" value="${esc(ui.search)}" placeholder="Title, location, or adversary…">`)}${field('Status', `<select id="encounter-status">${['all','active','draft','resolved','archived'].map(s => `<option value="${s}" ${s === ui.status ? 'selected' : ''}>${s === 'all' ? 'All current encounters' : s}</option>`).join('')}</select>`)}</div><div id="encounter-list"></div>` : `<div class="enc-tools">${field('Search bestiary', `<input type="search" id="bestiary-search" value="${esc(ui.bestiarySearch)}" placeholder="Creature, description, category…">`)}${field('Threat level', `<select id="bestiary-filter-tl"><option value="all">All threat levels</option>${Array.from({length:10},(_,i) => `<option value="${i+1}" ${String(i+1) === ui.tl ? 'selected' : ''}>TL ${i+1}</option>`).join('')}</select>`)}</div>
    ${canEdit ? field('Add creatures to this encounter', `<select id="encounter-target"><option value="">Choose a draft encounter…</option>${encounters.filter(e => !e.archived && !e.trackerSession && e.status !== 'resolved').map(e => `<option value="${esc(e.id)}" ${String(e.id) === ui.targetId ? 'selected' : ''}>${esc(e.title)}</option>`).join('')}</select>`) : ''}<p class="enc-muted">${canEdit ? 'Choose a target before adding. For a running encounter, import creatures inside its tracker.' : 'Browse creature details. Only the GM can change encounters.'}</p><div id="bestiary-list" class="enc-card-grid"></div>`}</section>`;
}

export function renderLibrary(encounters, ui, canEdit) {
    const visible = filterEncounters(encounters, ui.search, ui.status);
    if (!visible.length) return `<div class="enc-empty"><span aria-hidden="true">⚔</span><h2>${encounters.length ? 'No encounters match.' : 'Every scene starts with a question.'}</h2><p>${encounters.length ? 'Try a different search or status.' : 'Will they win the argument, stop the ritual, or survive the ambush?'}</p>${canEdit && !encounters.length ? button('new','Build your first encounter','','btn-gold') : ''}</div>`;
    return `<p class="enc-muted" role="status">${visible.length} encounter${visible.length === 1 ? '' : 's'}</p><div class="enc-card-grid">${visible.map(e => {
        const type = getObjectiveType(e.type);
        return `<article class="enc-card"><div class="enc-row"><span class="enc-kicker">${esc(type.icon)} ${esc(type.label)}</span><span class="enc-chip">${esc(e.archived ? 'archived' : e.status || 'draft')}</span></div><h2>${esc(e.title || 'Untitled encounter')}</h2><p class="enc-muted">${esc(e.location || 'Location undecided')} · TL ${esc(e.difficulty || 3)}</p><p class="enc-clamp">${esc(e.stakes || e.body || 'Define what the party wants and what stands in the way.')}</p><div class="enc-card-foot"><span>${(e.adversaries || []).length} adversaries / obstacles${canResume(e.trackerSession) && canEdit ? ` · saved round ${e.trackerSession.round}` : ''}</span>${button('open','Open encounter',e.id,'btn-gold')}</div></article>`;
    }).join('')}</div>`;
}

export function renderScene(e, canEdit) {
    const session = canResume(e.trackerSession) ? e.trackerSession : null;
    const type = getObjectiveType(e.type);
    return `<section class="enc-workspace"><div class="enc-row">${button('back','← Encounter library')}<span class="enc-chip">${esc(e.archived ? 'archived' : e.status || 'draft')}</span></div>
    <header class="enc-hero"><div><p class="enc-kicker">${esc(type.icon)} ${esc(type.label)} · TL ${esc(e.difficulty || 3)}</p><h1>${esc(e.title)}</h1><p>${esc(e.location || 'Location undecided')}</p></div><div class="enc-hero-actions">${canEdit && !e.archived && e.status !== 'resolved' ? button('track',session ? 'Resume encounter' : 'Run encounter',e.id,'btn-gold') : ''}${canEdit ? button('edit','Edit preparation',e.id) : ''}</div></header>
    <div class="enc-scene-grid"><div><article class="enc-section"><h2>The situation</h2><p class="enc-prose">${esc(e.body || 'No scene description yet.')}</p><div class="enc-stakes"><h3>What is at stake?</h3><p class="enc-prose">${esc(e.stakes || 'Agree the objective and the cost of failure before the first roll.')}</p></div></article>
    <article class="enc-section"><div class="enc-row"><h2>Cast & obstacles</h2><span>${(e.adversaries || []).length} prepared</span></div>${(e.adversaries || []).map(a => `<details class="enc-cast"><summary>${esc(a.name)}${a.tl != null ? ` · TL ${esc(a.tl)}` : ''}</summary><p class="enc-prose">${esc(a.body || 'No notes.')}</p></details>`).join('') || '<p class="enc-muted">Add adversaries or obstacles in the editor or from the Bestiary. The tracker can also add players and custom entries.</p>'}</article>
    ${canEdit ? `<article class="enc-section"><h2>Aftermath</h2><p class="enc-muted">Record the outcome, bargains, costs, and threads for next time.</p><form id="enc-aftermath" data-id="${esc(e.id)}">${field('Outcome & follow-up notes', `<textarea name="aftermath" rows="5" maxlength="12000">${esc(e.aftermath || '')}</textarea>`)}<div class="enc-row"><button class="btn btn-secondary" type="submit">Save notes</button>${!e.archived && e.status !== 'resolved' ? '<button class="btn btn-gold" name="resolve" value="yes" type="submit">Save & resolve encounter</button>' : ''}</div></form></article>` : ''}</div>
    <aside><article class="enc-section"><p class="enc-kicker">AT THE TABLE</p><h2>${session && canEdit ? 'Session saved' : 'Ready when you are'}</h2>${session && canEdit ? `<p>Round ${session.round} · ${esc(session.turnPhase)}’ turn</p><p>${session.combatants.length} combatants · ${session.obstacles.length} obstacles</p><p>${esc(session.timerName)} · ${session.timerSegments}/${session.timerMax}</p>` : '<p>Players act together, then adversaries. Obstacles never take a turn. Non-combat objectives use progress clocks.</p>'}<p class="enc-muted">Tracker changes save automatically. Closing the tracker pauses your view; it does not reset the scene or resolve it.</p></article>
    ${canEdit ? `<article class="enc-section"><h2>GM preparation</h2><p class="enc-prose">${esc(e.gmNotes || 'No private notes yet. Add reveals, motives, or escalation ideas in the editor.')}</p></article><details class="enc-section"><summary>Manage encounter</summary><div class="enc-manage">${button('clone','Duplicate as a fresh draft',e.id)}${button('archive',e.archived ? 'Restore to library' : 'Archive · keep all data',e.id)}${e.status === 'resolved' ? button('reopen','Reopen saved session',e.id) : ''}</div></details>` : ''}</aside></div></section>`;
}

export function renderCreatures(entries, canEdit, hasTarget) {
    return entries.length ? entries.slice(0,80).map(entry => `<article class="enc-card"><p class="enc-kicker">${esc(entry.category || 'Adversary')} · TL ${esc(entry.tl ?? '?')}</p><h2>${esc(entry.name)}</h2><p class="enc-clamp">${esc(entry.description || '')}</p><div class="enc-row">${button('creature','Read creature',entry.name)}${canEdit ? `<button class="btn btn-gold" data-enc-action="add-creature" data-id="${esc(entry.name)}" ${hasTarget ? '' : 'disabled'}>Add to selected encounter</button>` : ''}</div></article>`).join('') + (entries.length > 80 ? '<p class="enc-muted">Showing the first 80 matches. Refine your search to narrow the list.</p>' : '') : '<div class="enc-empty"><h2>No creatures match.</h2><p>Try another name or threat level.</p></div>';
}
