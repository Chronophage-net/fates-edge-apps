import { describe, it, assert, assertEqual } from '../runner.js';
import { filterPatrons, patronCards, mergePatronLibrary } from '../../js/features/patrons/library.js';
import { renderDeckWorkspace, renderJournal } from '../../js/features/decks/workspace.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const patrons=[{id:'road',name:'The Traveler',lore:{description:'Shelter on the road'},rites:[{name:'Wayfinding'}]}, {id:'forge',title:'Forge',witchcraft:{name:'Ember'},monastic_tradition:{name:'Iron'}}];
const deckSource=readFileSync(new URL('../../js/features/decks/index.js',import.meta.url),'utf8');
const patronSource=readFileSync(new URL('../../js/features/patrons/index.js',import.meta.url),'utf8');
describe('Patrons and Decks workspaces', () => {
    it('searches nested patron lore and mechanics with combined filters', () => {
        assertEqual(filterPatrons(patrons,'road wayfinding','rites').length,1);
        assertEqual(filterPatrons(patrons,'','witchcraft',true,['forge'])[0].id,'forge');
        assertEqual(filterPatrons(patrons,'','monastic').length,1);
        assertEqual(filterPatrons(patrons,'absent').length,0);
    });
    it('prioritizes name matches without sorting the saved collection', () => {
        const entries=[{id:'b',name:'B',description:'Traveler'},...patrons];
        assertEqual(filterPatrons(entries,'traveler')[0].id,'road');
        assertEqual(entries[0].id,'b');
    });
    it('preserves local custom entries and overrides when bundled data refreshes', () => {
        const custom={...patrons[0],source:'local',name:'My Traveler',rites:[{name:'Custom rite'}]};
        const result=mergePatronLibrary(patrons,[custom,{id:'new',name:'New',source:'local'}]);
        assertEqual(result.length,3); assertEqual(result.find(p=>p.id==='road').name,'My Traveler');
        assertEqual(patrons[0].name,'The Traveler');
    });
    it('renders keyboard-operable cards and escapes imported identifiers and text', () => {
        const html=patronCards([{id:'" onclick="bad',name:'<img src=x>',description:'<script>bad</script>'}]);
        assert(!html.includes('<img')); assert(!html.includes('<script>'));
        assert(html.includes('data-id="&quot; onclick=&quot;bad"')); assert(html.includes('<button'));
    });
    it('isolates patron tracking by character and clamps values', () => {
        const start=patronSource.indexOf('export function setPatronObligation('), end=patronSource.indexOf('export function addPatronObligation(',start);
        const state={obligation:{legacy:{road:4}}}; let saves=0;
        const set=vm.runInNewContext(patronSource.slice(start,end).replace('export ','')+';setPatronObligation;',{state,savePatronData:()=>saves++});
        set('hero','road',3); assertEqual(state.obligation.hero.road,3); assertEqual(state.obligation.legacy.road,4);
        set('hero','road',-1); assertEqual(state.obligation.hero.road,0);
        set('hero','road',NaN); assertEqual(state.obligation.hero.road,0); assertEqual(saves,2);
    });
    it('preserves custom metadata in the form editor and binds the library once', () => {
        assert(patronSource.includes('...entry, id: entry.id'));
        assert(patronSource.includes('updated.lore = {...entry.lore, description}'));
        assert(patronSource.includes('container._patronLibraryBound'));
        assert(!patronSource.includes('delete saved.patrons.cosmic'));
    });
    it('omits draw, shuffle and random-seed controls for players', () => {
        const html=renderDeckWorkspace(['Acasia'],false);
        for(const id of ['deck-draw-btn','deck-reshuffle-btn','deck-seed-regenerate','deck-history-clear-btn']) assert(!html.includes(`id="${id}"`));
        assert(html.includes('deck-region-select')); assert(html.includes('deck-history'));
    });
    it('escapes region names and seeds in the draw workspace', () => {
        const html=renderDeckWorkspace(['<img src=x>'],true,'<script>');
        assert(!html.includes('<img')); assert(!html.includes('<script>'));
        assert(html.includes('does not automatically spend Story Beats'));
    });
    it('filters and escapes journal content and displays the newest reading first', () => {
        const entries=[{region:'Acasia',cards:'King',synthesis:'<script>x</script>',time:'old'}, {region:'Ykrul',cards:'Ace',synthesis:'Snow',time:'new'}];
        const html=renderJournal(entries);
        assert(html.indexOf('new')<html.indexOf('old')); assert(!html.includes('<script>'));
        assert(!renderJournal(entries,'acasia king').includes('Ykrul'));
        assert(renderJournal(entries,'missing').includes('No matching'));
        assertEqual(entries[0].time,'old');
    });
    it('does not silently reshuffle or erase history when navigating', () => {
        assert(deckSource.includes('if (!deckBuilt) buildDeck();'));
        const destroy=deckSource.slice(deckSource.indexOf('export function destroy()'),deckSource.indexOf('export function attachEvents()'));
        assert(!destroy.includes('deck = []')); assert(!destroy.includes('deckHistory = []'));
        assert(deckSource.includes('getState().deckJournal = deckHistory'));
    });
    it('keeps Crown synthesis independent of mounted screen controls', () => {
        const start=deckSource.indexOf('function synthesiseCrownSpread(');
        const end=deckSource.indexOf('// REGION CHANGE HANDLER',start);
        const source=deckSource.slice(start,end);
        assert(!source.includes('timerEl'));
        assert(!source.includes('document.'));
    });
    it('prevents overlapping draw clicks and unlocks controls after completion', async () => {
        const start=deckSource.indexOf('export async function drawConsequence()'),end=deckSource.indexOf('async function performConsequenceDraw()',start);
        let finish, runs=0; const button={disabled:false,isConnected:true};
        const run=vm.runInNewContext(deckSource.slice(start,end).replace('export ','')+';drawConsequence;',{drawBusy:false,document:{getElementById:()=>button},performConsequenceDraw:()=>{runs++;return new Promise(resolve=>finish=resolve);}});
        const first=run(); await run(); assertEqual(runs,1); assert(button.disabled);
        finish(); await first; assert(!button.disabled);
    });
    it('unlocks the draw button after a failed draw', async () => {
        const start=deckSource.indexOf('export async function drawConsequence()'),end=deckSource.indexOf('async function performConsequenceDraw()',start);
        const button={disabled:false,isConnected:true};
        const run=vm.runInNewContext(deckSource.slice(start,end).replace('export ','')+';drawConsequence;',{drawBusy:false,document:{getElementById:()=>button},performConsequenceDraw:async()=>{throw new Error('test failure');}});
        let failed=false;
        try { await run(); } catch { failed=true; }
        assert(failed); assert(!button.disabled);
    });
});
