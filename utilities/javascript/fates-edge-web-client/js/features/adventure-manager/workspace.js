import { escHtml } from '@core/utils.js';

export function sceneSummary(adventure) {
    const scenes = (adventure.acts || []).flatMap((act, actIndex) => (act.scenes || []).map((scene, sceneIndex) => ({scene, act, actIndex, sceneIndex})));
    const completed = scenes.filter(({scene}) => scene.completed).length;
    const current = scenes.find(s => s.actIndex === adventure.currentAct && s.sceneIndex === adventure.currentScene);
    return {total:scenes.length, completed, percent:scenes.length ? Math.round(completed / scenes.length * 100) : 0, current};
}

export function renderShelf({adventures, visible, canEdit, search, sort, sorts, status, timers}) {
    const active = adventures.filter(a => a.status === 'active');
    return `<div class="adv-workspace">
        <header class="adv-hero"><div><p class="adv-eyebrow">THE GAME MASTER’S DESK</p><h1>Adventure Manager</h1><p>Prepare the next chapter. Keep the story moving.</p></div>
        ${canEdit ? '<button class="btn btn-gold" id="adv-create-btn">+ New adventure</button>' : '<span class="adv-badge">Read-only</span>'}</header>
        <div class="adv-stats"><div><strong>${adventures.length}</strong><span>In your library</span></div><div><strong>${active.length}</strong><span>In play</span></div><div><strong>${adventures.filter(a=>a.status==='planned').length}</strong><span>Ready to prepare</span></div><div><strong>${adventures.filter(a=>a.status==='completed').length}</strong><span>Stories completed</span></div></div>
        ${active.length ? `<section class="adv-resume"><div><p class="adv-eyebrow">CONTINUE YOUR SESSION</p><h2>${escHtml(active[0].title)}</h2><p>${escHtml(sceneSummary(active[0]).current?.scene.title || 'Open the scene outline to continue.')}</p></div><button class="btn btn-gold" data-open-adventure="${escHtml(active[0].id)}">Open session →</button></section>` : ''}
        <div class="adv-toolbar">${canEdit ? '<button class="btn" id="adv-browse-library-btn">Browse library</button><button class="btn" id="adv-load-file-btn">Import JSON</button><button class="btn" id="adv-crown-gen-btn">Import Crown Spread</button>' : '<span>Only the GM can make changes.</span>'}<button class="btn btn-ghost" id="adv-refresh-btn">Refresh</button></div>
        <section class="adv-library" aria-label="Adventure library"><div class="adv-library-heading"><h2>Your adventures</h2><span>${visible.length} of ${adventures.length}</span></div>
        <div class="adv-filters"><label>Search<input type="text" id="adv-search" placeholder="Title, theme, author…" value="${escHtml(search)}"></label><label>Status<select id="adv-status">${['all','active','planned','completed','archived'].map(s=>`<option value="${s}" ${s===status?'selected':''}>${s==='all'?'All adventures':s[0].toUpperCase()+s.slice(1)}</option>`).join('')}</select></label><label>Sort<select id="adv-sort">${Object.entries(sorts).map(([key,label])=>`<option value="${key}" ${key===sort?'selected':''}>${escHtml(label)}</option>`).join('')}</select></label></div>
        <div class="adv-card-grid">${visible.map(a=>{
            const progress=sceneSummary(a);
            return `<article class="adv-library-card"><div class="adv-card-meta"><span class="adv-badge">${escHtml(a.status || 'planned')}</span><span>Tier ${escHtml(a.tier || 'I')}</span></div><h3>${escHtml(a.title)}</h3><p class="adv-card-description">${escHtml(String(a.description || 'No synopsis yet. Open this adventure to explore its scenes.').slice(0,210))}</p><div class="adv-tags">${(a.themes || []).slice(0,3).map(t=>`<span>${escHtml(t)}</span>`).join('')}</div><div class="adv-card-progress"><span>${progress.completed} / ${progress.total} scenes</span><span>${progress.percent}%</span></div><progress max="100" value="${progress.percent}" aria-label="Scene completion"></progress><div class="adv-card-footer"><span>${(a.acts || []).length} acts · ${escHtml(a.author || 'GM')}</span><button class="btn btn-primary" data-open-adventure="${escHtml(a.id)}">${a.status==='active'?'Continue':'Open adventure'} →</button></div></article>`;
        }).join('') || `<div class="adv-empty"><h3>${adventures.length?'No matching adventures':'Your next story starts here'}</h3><p>${adventures.length?'Try a different search or status.':'Create an adventure, browse the included library, or import a JSON file. Your existing format is supported.'}</p></div>`}</div></section>
        <details class="adv-table-timers"><summary>Shared table timers</summary>${timers}</details>
    </div>`;
}

export function renderSession({adventure, canEdit, description, acts, timers, npcs, locations, factions, bestiary, hints, notes, actions, currentDescription}) {
    const progress=sceneSummary(adventure);
    const current=progress.current;
    return `<div class="adv-workspace adv-session">
        <button class="btn btn-ghost adv-back" data-adventure-back>← Adventure library</button>
        <header class="adv-hero"><div><p class="adv-eyebrow">${escHtml(adventure.status || 'planned')} · TIER ${escHtml(adventure.tierRange || adventure.tier || 'I')}</p><h1>${escHtml(adventure.title)}</h1><p>${progress.completed} of ${progress.total} scenes complete · ${(adventure.acts || []).length} acts${adventure.sessions ? ` · ${escHtml(String(adventure.sessions))} sessions` : ''}</p></div><details class="adv-management"><summary>Manage adventure</summary><div>${actions}</div></details></header>
        <progress max="100" value="${progress.percent}" aria-label="Adventure completion"></progress>
        <div class="adv-tabs" role="tablist" aria-label="Adventure workspace">${[['run','Run session'],['reference','Reference'],['notes','Session notes']].map(([id,label],i)=>`<button class="btn" role="tab" id="adv-tab-${id}" aria-controls="adv-pane-${id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-adventure-tab="${id}">${label}</button>`).join('')}</div>
        <section id="adv-pane-run" role="tabpanel" aria-labelledby="adv-tab-run"><div class="adv-run-grid"><div>
        <section class="adv-current"><p class="adv-eyebrow">${adventure.status==='completed'?'ADVENTURE COMPLETE':adventure.status==='active'?'AT THE TABLE NOW':'FIRST SCENE / PREVIEW'}</p><h2>${escHtml(adventure.status==='completed'?'The chapter is closed':current?.scene.title || 'No scene selected')}</h2><p class="adv-muted">${escHtml(current?.act.title || 'Add acts and scenes when creating an adventure.')}</p>${adventure.status!=='completed' ? currentDescription : '<p>Review your notes or export this adventure to keep a copy of the story.</p>'}
        <div class="adv-toolbar">${canEdit && adventure.status==='planned'?'<button class="btn btn-gold" data-adventure-start>Start adventure</button>':''}${canEdit && adventure.status==='active' && current && !current.scene.completed?'<button class="btn btn-gold" data-adventure-complete>Complete scene →</button><button class="btn" data-adventure-encounter>Open encounter</button>':''}</div></section>
        <section class="adv-outline"><h2>Scene outline</h2><p class="adv-muted">Expand a scene’s reading notes. Complete the current scene to advance.</p>${acts}</section></div>
        <aside><section class="adv-panel"><h2>Campaign clocks</h2>${timers}</section>${hints}<details class="adv-panel"><summary>Adventure brief</summary>${description || '<p>No synopsis provided.</p>'}<div class="adv-tags">${(adventure.themes || []).map(t=>`<span>${escHtml(t)}</span>`).join('')}</div></details></aside></div></section>
        <section id="adv-pane-reference" role="tabpanel" aria-labelledby="adv-tab-reference" hidden><div class="adv-reference-grid"><section class="adv-panel"><h2>People</h2>${npcs}</section><section class="adv-panel"><h2>Places</h2>${locations}</section><section class="adv-panel"><h2>Factions</h2>${factions}</section><section class="adv-panel"><h2>Bestiary</h2>${bestiary}${canEdit?'<button class="btn" data-adventure-creature>+ Add creature</button>':''}</section></div></section>
        <section id="adv-pane-notes" role="tabpanel" aria-labelledby="adv-tab-notes" hidden><section class="adv-panel"><p class="adv-eyebrow">SESSION RECORD</p><h2>Notes & loose ends</h2><p class="adv-muted">Record decisions, consequences, and what to prepare next. Save notes before leaving the app. These use the adventure’s existing shared notes field.</p>${notes}</section></section>
    </div>`;
}
