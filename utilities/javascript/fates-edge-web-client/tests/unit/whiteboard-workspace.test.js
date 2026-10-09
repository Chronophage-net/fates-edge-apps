import { describe, it, assert, assertEqual } from '../runner.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { TOOL_HELP } from '../../js/features/whiteboard/modules/workspace.js';
const source=name=>readFileSync(new URL(`../../js/features/whiteboard/modules/${name}.js`,import.meta.url),'utf8');
describe('Whiteboard workspace',()=>{
    it('provides named tools and specific guidance for drawing and fog',()=>{
        for(const tool of ['pen','eraser','select','line','rectangle','circle','arrow','polygon','ruler','ping','fog-reveal','fog-hide','fog-wall','fog-light']) {
            assert(TOOL_HELP[tool][0]); assert(TOOL_HELP[tool][1].length>15);
        }
    });
    it('undo restores cleared drawings, notes, combat tokens and fog; redo reapplies',()=>{
        const state={activeSheetId:'one',drawings:[{id:'d',points:[{x:1,y:2}]}],notes:[{id:'n',content:'note'}],images:[],characterTokens:[],gridCombat:{tokens:[{id:'t'}],fogOfWar:{walls:[{x1:1}],revealed:['1,2']}}};
        const js=source('undo').replace(/^import .*;\n/gm,'').replaceAll('export ','');
        let saves=0;
        const api=vm.runInNewContext(js+';({pushUndoSnapshot,undo,redo});',{state,saveWhiteboardData:()=>saves++,restoreDrawings(){},renderOverlay(){},updateStats(){},showToast(){},i18nText(){}});
        api.pushUndoSnapshot(); state.drawings=[]; state.notes=[]; state.gridCombat.tokens=[]; state.gridCombat.fogOfWar.walls=[];
        api.undo(); assertEqual(state.drawings.length,1); assertEqual(state.notes[0].content,'note'); assertEqual(state.gridCombat.tokens.length,1); assertEqual(state.gridCombat.fogOfWar.walls.length,1);
        api.redo(); assertEqual(state.notes.length,0); assertEqual(state.gridCombat.tokens.length,0); assertEqual(saves,2);
        state.activeSheetId='two'; api.undo(); assertEqual(saves,2);
    });
    it('retains the active sheet and ignores null entries in incoming sync',()=>{
        const js=source('persistence');
        const snippet=js.slice(js.indexOf('function isValidDrawing'),js.indexOf('function applyIncomingWhiteboard'));
        const sanitize=vm.runInNewContext(snippet+';sanitizeIncomingWhiteboard;');
        const result=sanitize({activeSheetId:'two',sheets:[null,{id:'two',name:'Second',notes:[{id:'n',content:'hi',x:2,y:3},null]}]});
        assertEqual(result.activeSheetId,'two'); assertEqual(result.sheets.length,1); assertEqual(result.sheets[0].notes.length,1);
    });
    it('guards both sync update routes against rebroadcast loops',()=>{
        const js=source('persistence');
        for(const name of ['updateHandler','syncStateHandler']) {
            const start=js.indexOf(`const ${name} =`),end=js.indexOf('\n    };',start);
            const handler=js.slice(start,end);
            assert(handler.includes('isSyncing = true')); assert(handler.includes('finally { isSyncing = false; }'));
        }
        assert(!js.includes('function renderPingMarker'));
    });
    it('uses captured pointer input and scoped keyboard listeners',()=>{
        const js=source('ui');
        assert(js.includes("canvasEl.addEventListener('pointercancel', finish)"));
        assert(js.includes('canvasEl.setPointerCapture(e.pointerId)'));
        assert(js.includes('eventController?.abort()'));
        assert(js.includes("e.target.closest?.('input, textarea, select"));
        assert(!js.includes("canvasEl.addEventListener('touchstart'"));
    });
    it('escapes overlay IDs and uses pointer dragging instead of mouse-only handlers',()=>{
        const js=source('renderer');
        assert(js.includes('escHtml(JSON.stringify(String(note.id)))'));
        assert(js.includes('src="${escHtml(img.data)}"'));
        assert(!js.includes('onmousedown=')); assert(js.includes('onpointerdown='));
    });
});
