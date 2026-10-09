import { escHtml as esc } from '@core/utils.js';
import { projectsFor, TIERS, KINDS } from './projects.js';
import { FLAWS, getCraftedItems, getAttunedItems, getCraftingLog, getIngredients, availableXp, canForage } from './state.js';
import { renderAttunedItem } from './render.js';

const options = (entries, value) => entries.map(([id, label]) => `<option value="${esc(id)}" ${String(value) === String(id) ? 'selected' : ''}>${esc(label)}</option>`).join('');
const field = (label, control) => `<label class="bench-field"><span>${label}</span>${control}</label>`;
const select = (name, entries, value) => `<select name="${name}">${options(entries, value)}</select>`;
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function renderWorkshop(char, recipes, ui) {
    const projects = projectsFor(char);
    const active = projects.filter(p => p.status !== 'complete' && !p.shelved);
    const completed = projects.filter(p => p.status === 'complete');
    const shelved = projects.filter(p => p.status !== 'complete' && p.shelved);
    const draft = ui.projectDraft || {};
    const kind = draft.kind || 'provision';
    return `<section class="bench-workspace">
        <header class="bench-intro"><div><p class="bench-eyebrow">THE BENCH · ${esc(char.name)}</p><h2>Make something worth a story.</h2><p>Declare the work. Set the stakes. Let the making leave its mark.</p></div>
        <div class="bench-stats"><span><strong>${active.length}</strong>on the bench</span><span><strong>${availableXp(char)}</strong>XP available</span><span><strong>${num(char.obligation || 0)}</strong>Obligation</span></div></header>
        <div class="bench-layout ${active.length ? 'bench-has-projects' : ''}"><div>
        <section class="bench-section"><div class="bench-section-heading"><h3>On the bench</h3><span>${active.length ? 'One roll = one action or scene' : 'Your next project starts here'}</span></div>
        ${active.length ? active.map(p => renderProject(p, char)).join('') : `<div class="bench-empty"><span aria-hidden="true">⚒</span><h3>A clear bench, a new possibility.</h3><p>Start with a one-use Provision, a lasting mundane Work, or an enchanted Wonder. Agree its effect and ambition with your GM.</p></div>`}</section>
        <details class="bench-reference"><summary>Shelved projects · ${shelved.length}</summary>${shelved.map(p => `<div data-project="${esc(p.id)}"><p><strong>${esc(p.name)}</strong> · progress and Flaws preserved</p><button class="btn btn-secondary" data-bench-action="resume">Return to bench</button></div>`).join('') || '<p>Set aside a project without losing its work.</p>'}</details>
        <details class="bench-reference"><summary>Completed projects · ${completed.length}</summary>${completed.map(p => `<p><strong>${esc(p.name)}</strong> · ${esc(KINDS[p.kind])} · ${num(p.cost)} XP / ${num(p.obligation)} Obligation</p>`).join('') || '<p>Finished projects will stay here as a record.</p>'}</details>
        <details class="bench-reference"><summary>Bench journal · latest 10 entries</summary>${getCraftingLog(char).map(log => `<p>${esc(log.name)} <small>${esc(new Date(log.timestamp).toLocaleString())}</small></p>`).join('') || '<p>Your rolls, choices, and finished pieces will appear here.</p>'}</details>
        </div><aside>
        <details class="bench-new" ${!active.length || Object.keys(draft).length ? 'open' : ''}><summary>Start a new project</summary><p class="bench-eyebrow">A NEW UNDERTAKING</p><h3>What are you making?</h3>
        <form id="bench-create">
        ${field('Kind', select('kind', Object.entries(KINDS).filter(([k]) => k !== 'repair'), kind))}
        <p class="bench-muted">${kind === 'provision' ? 'One use. One successful roll. No XP or Obligation.' : kind === 'work' ? 'A lasting mundane item. Skill and time, not XP.' : 'An enchanted item. Pay XP and mark Obligation on completion.'}</p>
        ${field('Project name', `<input name="name" required maxlength="100" value="${esc(draft.name || '')}" placeholder="e.g. Lantern of the lost tide">`)}
        ${field('Agreed effect', `<textarea name="effect" maxlength="2000" rows="2" placeholder="What can it do? Agree limits with your GM.">${esc(draft.effect || '')}</textarea>`)}
        ${field('Materials & workshop notes', `<textarea name="materials" maxlength="1000" rows="2" placeholder="Right tools, a quiet forge, borrowed silver…">${esc(draft.materials || '')}</textarea>`)}
        <div class="bench-fields">${field('DV · ambition', select('dv', [[2,'2 · Familiar'],[3,'3 · New'],[4,'4 · At the edge'],[5,'5 · Unprecedented'],[6,'6'],[7,'7'],[8,'8'],[9,'9'],[10,'10']], draft.dv || 3))}
        ${kind !== 'provision' ? field('Timer · GM agrees', select('timer', (kind === 'wonder' ? [6,8,10] : [4,6]).map(n => [n,`${n} segments`]), draft.timer)) : ''}</div>
        ${kind === 'wonder' ? field('Tier · XP / Obligation', select('tier', Object.entries(TIERS).map(([tier,cost]) => [tier,`${tier} · ${cost} XP / ${cost/2} Obligation`]), draft.tier)) : ''}
        <button class="btn btn-gold" type="submit">Start project</button></form></details>
        <details class="bench-reference"><summary>Recipe inspirations</summary><p>No ingredient arithmetic or recipe XP fees. These are one-use Provisions; agree their effects with your GM.</p>
        ${field('Choose an inspiration', `<select id="bench-recipe"><option value="">Choose a recipe…</option>${options(Object.values(recipes).map(r => [r.id,r.name]), '')}</select>`)}<button class="btn btn-secondary" type="button" data-bench-action="recipe">Use in new project</button></details>
        <details class="bench-reference"><summary>At-the-table rules</summary><p><strong>Craft</strong> for Provision / Work; <strong>Arcana</strong> for Wonder. Choose the Attribute that fits your approach.</p><p><strong>Position, not bonus dice:</strong> right stuff Dominant, adequate Controlled, rushed or improvised Desperate.</p><p><strong>Success:</strong> 2 segments. <strong>Partial:</strong> 1 clean or 2 with a named Flaw, +1 Boon. <strong>Miss:</strong> no progress, +2 Boons.</p><p>A Provision partial either finishes with a Flaw or stays unfinished for a later action. Boons cap at 5. Record Story Beats with the GM; this bench does not update a campaign SB pool.</p><p>Gather once per downtime for one project. The GM’s faction downtime turn resets gathering and processes upkeep.</p><p><a href="/data/docs/players-guide/Players-_-Guide-_-11-_-Downtime.html#crafting" target="_blank" rel="noopener">Player’s procedure ↗</a> · <a href="/data/docs/gm-guide/GM-_-Guide-_-09-_-Downtime.html#crafting-bench" target="_blank" rel="noopener">GM’s procedure ↗</a></p></details>
        </aside></div></section>`;
}

function renderProject(p, char) {
    const last = p.lastRoll;
    return `<article class="bench-project" data-project="${esc(p.id)}"><div class="bench-section-heading"><div><p class="bench-eyebrow">${esc(KINDS[p.kind])} · DV ${num(p.dv)} · ${esc(p.skill)}</p><h3>${esc(p.name)}</h3></div><span class="bench-badge">${p.status === 'ready' ? 'Ready to finish' : p.pendingPartial ? 'Choose your outcome' : 'In progress'}</span></div>
    <p>${esc(p.effect || 'An effect agreed at the table.')}</p>
    ${p.timer ? `<div class="bench-progress"><progress max="${num(p.timer)}" value="${num(p.progress)}" aria-label="${esc(p.name)} progress"></progress><strong>${num(p.progress)} / ${num(p.timer)}</strong></div>` : '<p class="bench-muted">One successful roll · one use · no XP</p>'}
    ${p.cost ? `<p class="bench-cost">On completion: ${num(p.cost)} XP + ${num(p.obligation)} Obligation. Attunement is a separate quiet scene.</p>` : ''}
    ${p.materials ? `<p class="bench-materials">${esc(p.materials)}</p>` : ''}
    ${p.gathered ? '<p class="bench-good">✓ Right materials gathered for this project · Dominant unless the fiction changes</p>' : ''}
    ${p.flaws.map(f => `<p class="bench-flaw"><strong>${esc(f.name)}</strong> — ${esc(f.effect)}</p>`).join('')}
    ${last ? `<div class="bench-result" role="status"><strong>Last roll: ${esc(last.outcome)}</strong> · ${num(last.successes)} successes · ${num(last.storyBeats)} SB to bank · +${num(last.boons)} Boons${last.dice?.length ? `<br>Dice: ${esc(last.dice.join(' · '))}` : ''}<br><small>${esc(last.attribute || '')} + ${esc(p.skill)} · ${esc(last.position || 'controlled')}</small></div>` : ''}
    ${p.pendingPartial ? `<div class="bench-choice"><h4>A compromise, or a complication?</h4><button class="btn btn-secondary" data-bench-action="partial-clean">${p.kind === 'provision' ? 'Leave unfinished · retry later' : 'Take 1 clean segment'}</button>
    ${field('Name a new Flaw', select('flaw', FLAWS.filter(f => !p.flaws.some(existing => existing.id === f.id)).map(f => [f.id,`${f.name} — ${f.effect}`])))}<button class="btn btn-gold" data-bench-action="partial-flaw" ${p.flaws.length >= FLAWS.length ? 'disabled' : ''}>${p.kind === 'provision' ? 'Finish with this Flaw' : 'Take 2 segments + Flaw'}</button></div>` : p.status === 'ready' ? `<p>The making is done. ${availableXp(char) < p.cost ? 'Your progress is safe; return when you can pay the XP.' : 'Claim the result when the table is ready.'}</p><button class="btn btn-gold" data-bench-action="finish" ${availableXp(char) < p.cost ? 'disabled' : ''}>${p.kind === 'repair' ? 'Complete repair' : `Finish & claim${p.cost ? ` · ${num(p.cost)} XP` : ''}`}</button>` : `<form class="bench-roll">
    <div class="bench-fields">${field('Approach', select('attribute', [['wits','Wits · plan'],['body','Body · forge'],['spirit','Spirit · coax'],['presence','Presence · direct']],'wits'))}
    ${field('Position', select('position', [['dominant','Dominant'],['controlled','Controlled'],['desperate','Desperate']],p.gathered ? 'dominant' : 'controlled'))}
    ${field('Talent / situational dice', '<input name="bonus" type="number" min="-10" max="10" value="0">')}</div>
    <button class="btn btn-gold" type="submit">Roll ${esc(p.skill)} · spend an action</button>
    <details><summary>Use dice rolled at the table</summary><p>Apply Position and talent effects at the table, then enter the final totals.</p><div class="bench-fields">${field('Successes', '<input name="successes" type="number" min="0" max="100" value="0">')}${field('Story Beats', '<input name="storyBeats" type="number" min="0" max="100" value="0">')}</div><button class="btn btn-secondary" type="submit" name="manual" value="yes">Record table roll</button></details></form>
    ${!p.gathered ? `<details class="bench-gather"><summary>Gather materials for this project</summary><p>Once per downtime · Wits + Lore or Endurance. A success establishes Dominant for this project.</p>${p.lastGathering ? `<p>Last gathering: ${esc(p.lastGathering.outcome)} · ${num(p.lastGathering.successes)} successes · ${num(p.lastGathering.storyBeats)} SB to bank.</p>` : ''}<form class="bench-gather-form"><div class="bench-fields">${field('Where', select('skill',[['lore','Settlement / archive · Lore'],['endurance','Wild · Endurance']]))}${field('Rarity',select('dv',[[2,'Common · DV 2'],[3,'Uncommon · DV 3'],[4,'Rare · DV 4'],[5,'Unique · DV 5']]))}${field('Position',select('position',[['controlled','Controlled'],['dominant','Dominant'],['desperate','Desperate']]))}</div><button class="btn btn-secondary" type="submit" ${canForage(char) ? '' : 'disabled'}>${canForage(char) ? 'Roll gathering' : 'Already gathered this downtime'}</button></form></details>` : ''}`}
    <details><summary>Project notes &amp; management</summary><form class="bench-notes">${field('Materials & workshop notes', `<textarea name="materials" maxlength="1000" rows="3">${esc(p.materials || '')}</textarea>`)}<button class="btn btn-secondary" type="submit">Save notes</button></form><button class="btn btn-ghost" data-bench-action="shelve">Set aside · keep progress</button></details>
    </article>`;
}

export function renderCollection(char) {
    const items = getCraftedItems(char), attuned = getAttunedItems(char);
    return `<section class="bench-workspace"><header class="bench-intro"><div><p class="bench-eyebrow">THE THINGS YOU MADE</p><h2>Every piece has a history.</h2><p>Use Provisions, keep your Works, and care for the Wonders you borrow.</p></div></header>
    <section class="bench-section"><h3>Attunement & upkeep · ${attuned.length} / 3</h3><p class="bench-muted">A quiet scene to attune or release. Neglected items give no benefit; Compromised items require a restoration quest.</p>${attuned.map(renderAttunedItem).join('') || '<p>No attuned items.</p>'}</section>
    <div class="bench-collection">${items.map(item => `<article class="bench-project" data-item="${esc(item.id)}"><p class="bench-eyebrow">${esc(KINDS[item.kind] || 'Legacy item · preserved')}</p><h3>${esc(item.name)}</h3><p>${esc(item.effect || '')}</p>
    ${(item.flaws || (item.flaw ? [item.flaw] : [])).map(f => `<div class="bench-flaw"><strong>${esc(f.name)}</strong> — ${esc(f.effect || '')}${item.kind && item.kind !== 'provision' ? `<button class="btn btn-secondary" data-bench-action="repair" data-flaw="${esc(f.id)}">Start Flaw repair · DV 4 / Timer 4</button>` : ''}</div>`).join('')}
    ${item.kind === 'wonder' ? `<button class="btn btn-secondary" data-bench-action="attune">${attuned.some(a => a.id === item.id) ? 'Release' : 'Attune'} · quiet scene</button>` : item.kind === 'work' ? '<p class="bench-good">Lasting mundane work · no upkeep</p>' : `<p>${num(item.uses || 1)} use(s) remaining</p><button class="btn btn-gold" data-use-crafted="${esc(item.id)}">Use one</button>`}</article>`).join('') || '<div class="bench-empty"><h3>Nothing finished yet.</h3><p>Claim a finished project at the bench to add it here.</p></div>'}</div>
    ${getIngredients(char).length ? `<details class="bench-reference"><summary>Existing material notes · preserved</summary><p>These establish what is to hand, not a shopping ledger.</p><p>${getIngredients(char).map(esc).join(' · ')}</p></details>` : ''}</section>`;
}
