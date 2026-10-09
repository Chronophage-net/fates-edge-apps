/** Encounter library, scene preparation, explicit Bestiary targets, and aftermath. */
import { getState, saveState } from '@core/state.js';
import { generateId } from '@core/utils.js';
import { showToast } from '@components/Toast.js';
import { getMyStoredRole, isGmLikeRole } from '@core/feature-toggles.js';
import { isConnectedToServer } from '@core/websocket.js';
import { loadBestiaryData, loadWikiData, getCreatureDescription, showCreatureDetail } from './bestiary.js';
import { openTracker, closeTracker } from './combat.js';
import { closeEditor } from './editor.js';
import { renderShell, renderLibrary, renderScene, renderCreatures, cloneEncounter } from './workspace.js';

let container = null;
let bestiaryData = [];
let loadVersion = 0;
const ui = { view: 'library', selectedId: null, search: '', status: 'all', bestiarySearch: '', tl: 'all', targetId: '', drafts: {} };
const isGM = () => !isConnectedToServer() || isGmLikeRole(getMyStoredRole());
const encounters = () => getState().encounters || [];
const findEncounter = id => encounters().find(e => String(e.id) === String(id));

export async function render(el) {
    container = el;
    const version = ++loadVersion;
    draw();
    try {
        bestiaryData = await loadBestiaryData();
        await loadWikiData();
        if (version === loadVersion && container && ui.view === 'bestiary') renderBestiary();
    } catch (error) { console.warn('[Encounters] Bestiary unavailable', error); }
}

function draw() {
    if (!container) return;
    const selected = ui.selectedId == null ? null : findEncounter(ui.selectedId);
    container.innerHTML = selected
        ? renderScene({ ...selected, aftermath: ui.drafts[selected.id] ?? selected.aftermath }, isGM())
        : renderShell(encounters(), ui, isGM());
    if (!selected) { renderList(); renderBestiary(); }
    attachEvents();
}

// Called by the editor and tracker when returning to this workspace.
export function renderEncounters() { draw(); }
function renderList() {
    const list = container?.querySelector('#encounter-list');
    if (list) list.innerHTML = renderLibrary(encounters(), ui, isGM());
}
function renderBestiary() {
    const list = container?.querySelector('#bestiary-list');
    if (!list) return;
    const query = ui.bestiarySearch.trim().toLowerCase();
    const visible = bestiaryData.filter(e => [e.name, e.category, getCreatureDescription(e)].join(' ').toLowerCase().includes(query))
        .filter(e => ui.tl === 'all' || String(e.tl) === ui.tl)
        .map(e => ({ ...e, description: getCreatureDescription(e) }));
    const target = findEncounter(ui.targetId);
    list.innerHTML = renderCreatures(visible, isGM(), !!target && !target.archived && !target.trackerSession && target.status !== 'resolved');
}

export async function openEncounterEditor(id) {
    if (!isGM()) return showToast('Only the GM can edit encounters.', 'error');
    ui.selectedId = id;
    const editor = await import('./editor.js');
    if (!isGM()) return;
    editor.openEditor(id);
}

function openCombatTracker(id) {
    if (!isGM()) return showToast('Only the GM can run encounters.', 'error');
    ui.selectedId = id;
    openTracker(id).catch(error => showToast('Could not open tracker: ' + error.message, 'error'));
}

export function attachEvents() {
    const root = container?.querySelector('.enc-workspace');
    if (!root || root.dataset.bound) return;
    root.dataset.bound = 'true';
    root.addEventListener('input', event => {
        if (event.target.id === 'encounter-search') { ui.search = event.target.value; renderList(); }
        if (event.target.id === 'bestiary-search') { ui.bestiarySearch = event.target.value; renderBestiary(); }
        if (event.target.name === 'aftermath') ui.drafts[event.target.closest('form').dataset.id] = event.target.value;
    });
    root.addEventListener('change', event => {
        if (event.target.id === 'encounter-status') { ui.status = event.target.value; renderList(); }
        if (event.target.id === 'bestiary-filter-tl') { ui.tl = event.target.value; renderBestiary(); }
        if (event.target.id === 'encounter-target') { ui.targetId = event.target.value; renderBestiary(); }
    });
    root.addEventListener('submit', event => {
        if (event.target.id !== 'enc-aftermath') return;
        event.preventDefault();
        if (!isGM()) return;
        const encounter = findEncounter(event.target.dataset.id);
        if (!encounter) return;
        encounter.aftermath = String(new FormData(event.target).get('aftermath') || '').trim().slice(0,12000);
        if (event.submitter?.name === 'resolve') encounter.status = 'resolved';
        delete ui.drafts[encounter.id];
        saveState(); draw(); showToast(event.submitter?.name === 'resolve' ? 'Encounter resolved. Session and notes preserved.' : 'Aftermath saved.', 'success');
    });
    root.addEventListener('click', event => {
        const button = event.target.closest('[data-enc-action]');
        if (!button || button.disabled) return;
        const { encAction: action, id } = button.dataset;
        if (action === 'view') { ui.view = id; ui.selectedId = null; draw(); return; }
        if (action === 'back') { ui.selectedId = null; ui.view = 'library'; draw(); return; }
        if (action === 'open') { ui.selectedId = id; draw(); return; }
        if (action === 'creature') {
            const creature = bestiaryData.find(e => e.name === id);
            if (creature) showCreatureDetail(creature, { readOnly: true });
            return;
        }
        // Recheck permissions at action time, not just while rendering controls.
        if (!isGM()) return showToast('Only the GM can change encounters.', 'error');
        if (action === 'new') return openEncounterEditor(null);
        if (action === 'edit') return openEncounterEditor(id);
        if (action === 'track') return openCombatTracker(id);
        if (action === 'add-creature') {
            const target = findEncounter(ui.targetId), creature = bestiaryData.find(e => e.name === id);
            if (!target || !creature || target.archived || target.trackerSession || target.status === 'resolved') return showToast('Choose a draft target. Running encounters accept imports in their tracker.', 'warning');
            (target.adversaries ||= []).push({ ...JSON.parse(JSON.stringify(creature)), body: getCreatureDescription(creature) });
            saveState(); showToast(`${creature.name} added to ${target.title}.`, 'success'); return;
        }
        const encounter = findEncounter(id); if (!encounter) return;
        if (action === 'clone') {
            const copy = cloneEncounter(encounter, `enc_${generateId(20)}`);
            getState().encounters.push(copy); ui.selectedId = copy.id;
        }
        if (action === 'archive') encounter.archived = !encounter.archived;
        if (action === 'reopen') encounter.status = encounter.trackerSession ? 'active' : 'draft';
        saveState(); draw();
    });
}

export function destroy() { container = null; loadVersion++; closeEditor(); closeTracker(); }
export function onActivate() {
    for (const [key, open] of [['fe-pending-combat-tracker',openCombatTracker],['fe-pending-encounter-editor',openEncounterEditor]]) {
        const id = sessionStorage.getItem(key);
        if (id) { sessionStorage.removeItem(key); open(id); }
    }
}
export default { render, destroy, attachEvents, onActivate };
