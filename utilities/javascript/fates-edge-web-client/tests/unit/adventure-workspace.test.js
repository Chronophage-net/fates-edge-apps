import { describe, it, assert, assertEqual } from '../runner.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../js/features/adventure-manager/workspace.js',import.meta.url),'utf8').replace(/^import .*;\n/m,'').replaceAll('export function','function');
const escHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const {sceneSummary,renderShelf,renderSession}=vm.runInNewContext(`${source}; ({sceneSummary,renderShelf,renderSession});`,{escHtml});
const adventure={id:'qa',title:'Harbor',status:'active',currentAct:0,currentScene:1,acts:[{title:'Act one',scenes:[{title:'Arrival',completed:true},{title:'The tide'}]}]};
describe('Adventure workspace',()=>{
    it('computes progress and the exact current scene without changing data',()=>{
        const before=JSON.stringify(adventure);
        const result=sceneSummary(adventure);
        assertEqual(result.percent,50); assertEqual(result.completed,1); assertEqual(result.total,2);
        assertEqual(result.current.scene.title,'The tide'); assertEqual(JSON.stringify(adventure),before);
    });
    it('handles empty and legacy adventures',()=>{
        assertEqual(sceneSummary({}).percent,0);
        assertEqual(sceneSummary({acts:[{}]}).total,0);
        assertEqual(sceneSummary({...adventure,currentScene:99}).current,undefined);
    });
    it('escapes imported content and renders keyboard-accessible open buttons',()=>{
        const item={...adventure,title:'<img onerror="bad">',id:'" onclick="bad'};
        const html=renderShelf({adventures:[item],visible:[item],canEdit:true,search:'"',sort:'status',sorts:{status:'Status'},status:'all',timers:''});
        assert(!html.includes('<img')); assert(html.includes('&lt;img'));
        assert(html.includes('data-open-adventure="&quot; onclick=&quot;bad"'));
        assert(html.includes('id="adv-status"')); assert(html.includes('id="adv-load-file-btn"'));
    });
    it('keeps import controls out of read-only libraries',()=>{
        const html=renderShelf({adventures:[],visible:[],canEdit:false,search:'',sort:'status',sorts:{},status:'all',timers:''});
        assert(!html.includes('id="adv-create-btn"')); assert(!html.includes('id="adv-load-file-btn"'));
        assert(html.includes('Your next story starts here'));
    });
    it('provides three labeled panels and only permits active-session actions for GMs',()=>{
        const props={adventure,canEdit:true,description:'',acts:'',timers:'',npcs:'',locations:'',factions:'',bestiary:'',hints:'',notes:'',actions:'',currentDescription:''};
        assert(renderSession(props).includes('data-adventure-complete'));
        assert(!renderSession({...props,canEdit:false}).includes('data-adventure-complete'));
        assert(!renderSession({...props,adventure:{...adventure,status:'planned'}}).includes('data-adventure-complete'));
        for(const tab of ['run','reference','notes']) assert(renderSession(props).includes(`aria-labelledby="adv-tab-${tab}"`));
    });
});

describe('Adventure progression guards',()=>{
    const main=readFileSync(new URL('../../js/features/adventure-manager/index.js',import.meta.url),'utf8');
    const fn=main.slice(main.indexOf('function completeScene('),main.indexOf('function advanceTimer('));
    function setup(data,gm=true){
        let saves=0;
        const complete=vm.runInNewContext(`${fn}; completeScene;`,{isGM:()=>gm,showToast(){},i18nText(){},adventures:[data],getAdventure:()=>data,logAdventureEvent(){},saveAdventuresToState(){saves++;},broadcastSceneStatus(){}});
        return {complete,saves:()=>saves};
    }
    it('advances once and rejects a stale duplicate click',()=>{
        const data=JSON.parse(JSON.stringify({...adventure,currentScene:0}));data.acts[0].scenes[0].completed=false;
        const run=setup(data);run.complete('qa',0,0);run.complete('qa',0,0);
        assertEqual(data.currentScene,1);assertEqual(run.saves(),1);
    });
    it('does not complete a planned adventure or accept player mutations',()=>{
        for(const [status,gm] of [['planned',true],['active',false]]) {
            const data=JSON.parse(JSON.stringify({...adventure,status}));
            const run=setup(data,gm);assertEqual(run.complete('qa',0,1),null);assertEqual(run.saves(),0);
        }
    });
    it('marks the final scene and adventure complete',()=>{
        const data=JSON.parse(JSON.stringify(adventure));const run=setup(data);run.complete('qa',0,1);
        assertEqual(data.status,'completed');assertEqual(sceneSummary(data).percent,100);assert(!!data.completedAt);
    });
});
