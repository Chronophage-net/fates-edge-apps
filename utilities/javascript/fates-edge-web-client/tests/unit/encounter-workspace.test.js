import { describe, it, assert, assertEqual } from '../runner.js';
import { filterEncounters, cloneEncounter, snapshotSession, canResume, parseTrackAmount, renderShell, renderLibrary, renderScene, renderCreatures } from '../../js/features/encounters/workspace.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const encounter = { id: 'one', title: 'The drowned bell', type: 'heist', status: 'draft', location: 'Harbor', body: 'Steal the bell.', stakes: 'Before the tide returns.', gmNotes: 'Secret patron', adversaries: [{ name: 'Bell keeper', tl: 3, stats: { armor: 1 } }] };
const session = { combatants: [{ id:'a', harm:2 }], obstacles: [{ id:'door', harm:1 }], round:3, turnPhase:'adversaries', timerSegments:4, timerMax:6, timerName:'The tide', rangeMap:{'a::b':'near'}, combatLog:[{message:'A bell rings'}] };
const ui = { search:'', status:'all', view:'library', bestiarySearch:'', tl:'all', targetId:'' };
describe('Encounter workspace', () => {
    it('supports legacy drafts and searches cast and location', () => {
        assertEqual(filterEncounters([{...encounter,status:undefined}], 'keeper', 'draft').length,1);
        assertEqual(filterEncounters([encounter],'harbor').length,1);
        assertEqual(filterEncounters([encounter],'tower').length,0);
    });
    it('keeps archives separate and sorts active scenes first without mutating', () => {
        const data=[encounter,{...encounter,id:'live',status:'active'},{...encounter,id:'arch',archived:true}];
        const before=JSON.stringify(data); assertEqual(filterEncounters(data)[0].id,'live');
        assertEqual(filterEncounters(data,'','archived')[0].id,'arch'); assertEqual(JSON.stringify(data),before);
    });
    it('duplicates preparation but never copies live damage or resolution', () => {
        const source={...encounter,trackerSession:snapshotSession(session),aftermath:'Resolved',archived:true};
        const copy=cloneEncounter(source,'two'); assertEqual(copy.status,'draft'); assert(!copy.trackerSession); assert(!copy.archived); assertEqual(copy.aftermath,'');
        copy.adversaries[0].stats.armor=9; assertEqual(source.adversaries[0].stats.armor,1);
    });
    it('snapshots full tracker state without shared array references', () => {
        const copy=snapshotSession(session); assert(canResume(copy)); copy.combatants[0].harm=3;
        assertEqual(session.combatants[0].harm,2); assertEqual(copy.obstacles[0].harm,1); assertEqual(copy.rangeMap['a::b'],'near');
        assertEqual(copy.combatLog[0].message,'A bell rings'); assertEqual(copy.round,3);
    });
    it('rejects malformed or future-version saved sessions', () => {
        assert(!canResume(null)); assert(!canResume({...snapshotSession(session),version:9}));
        assert(!canResume({...snapshotSession(session),combatants:null})); assert(!canResume({...snapshotSession(session),timerMax:0}));
    });
    it('persists into only the selected encounter and respects the GM guard', () => {
        const source=readFileSync(new URL('../../js/features/encounters/combat.js',import.meta.url),'utf8');
        const start=source.indexOf('function persistTracker()'); const end=source.indexOf('// ============================================================',start);
        const data={encounters:[{id:'one'},{id:'two'}]}; let saves=0; let permitted=true;
        const persist=vm.runInNewContext(source.slice(start,end)+'; persistTracker;', {...session,currentEncounterId:'two',canSetRange:()=>permitted,getState:()=>data,snapshotSession,saveState:()=>saves++});
        persist(); assert(!data.encounters[0].trackerSession); assertEqual(data.encounters[1].trackerSession.round,3); assertEqual(saves,1);
        permitted=false; persist(); assertEqual(saves,1);
    });
    it('cancelling a damage or healing prompt cannot alter a track', () => {
        for(const value of [null,'',' ','0','-2','NaN','1.5','2oops','1000']) assertEqual(parseTrackAmount(value),null);
        assertEqual(parseTrackAmount('2'),2); assertEqual(parseTrackAmount(' 3 '),3);
    });
    it('escapes imported titles, locations, notes and identifiers', () => {
        const hostile={...encounter,id:'" onclick="bad',title:'<img onerror="bad">',location:'<script>x</script>'};
        for(const html of [renderLibrary([hostile],ui,true),renderScene(hostile,true)]) { assert(!html.includes('<img')); assert(!html.includes('<script>')); assert(html.includes('&lt;img')); }
        assert(renderScene(hostile,true).includes('data-id="&quot; onclick=&quot;bad"'));
    });
    it('player reference cannot display private notes, live sessions or GM controls', () => {
        const html=renderScene({...encounter,trackerSession:snapshotSession(session),aftermath:'Private follow-up'},false);
        for(const privateText of ['Secret patron','Private follow-up','data-enc-action="edit"','data-enc-action="track"','id="enc-aftermath"']) assert(!html.includes(privateText));
        assert(renderLibrary([encounter],ui,false).includes('Open encounter'));
    });
    it('requires an explicit bestiary target and omits running encounters', () => {
        const html=renderShell([encounter,{...encounter,id:'live',trackerSession:snapshotSession(session)}],{...ui,view:'bestiary'},true);
        assert(html.includes('value="one"')); assert(!html.includes('value="live"'));
        assert(renderCreatures([{name:'Keeper'}],true,false).includes('disabled'));
        assert(!renderCreatures([{name:'Keeper'}],false,true).includes('add-creature'));
    });
    it('shows resume only for valid saved sessions and respects resolution', () => {
        const saved={...encounter,trackerSession:snapshotSession(session)};
        assert(renderScene(saved,true).includes('Resume encounter'));
        assert(!renderScene({...saved,status:'resolved'},true).includes('data-enc-action="track"'));
        assert(renderScene({...saved,status:'resolved'},true).includes('Reopen saved session'));
    });
    it('editor uses unique IDs and retains adversary metadata when saving', () => {
        const source=readFileSync(new URL('../../js/features/encounters/editor.js',import.meta.url),'utf8');
        assert(!source.includes("generateId('enc_')")); assert(source.includes('baseEncounter.adversaries?.[row.dataset.index]'));
        assert(source.includes('if (!canEdit())')); assert(source.includes('currentEncounter.gmNotes'));
    });
});
