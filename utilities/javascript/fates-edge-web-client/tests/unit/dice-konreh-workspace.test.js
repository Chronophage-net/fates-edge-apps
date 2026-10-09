import { describe, it, assert, assertEqual } from '../runner.js';
import { poolSummary } from '../../js/features/dice/workspace.js';
import { readFileSync } from 'node:fs';
const dice=readFileSync(new URL('../../js/features/dice/index.js',import.meta.url),'utf8');
const game=readFileSync(new URL('../../js/features/kon-reh/index.js',import.meta.url),'utf8');
describe('Dice and Konreh workspaces',()=>{
    it('previews the dice pool including boons and the 12-die cap',()=>{
        assertEqual(poolSummary({attr:'2',skill:'1',boons:'0',dv:'3',position:'controlled'}),'3 dice · DV 3 · controlled');
        assertEqual(poolSummary({attr:'5',skill:'5',boons:'5',dv:'6',position:'desperate'}),'12 dice · DV 6 · desperate · pool capped at 12');
    });
    it('presets only prepare controls and never schedule a roll',()=>{
        const preset=dice.slice(dice.indexOf('function applyPreset'),dice.indexOf('function handleRoll'));
        assert(!preset.includes('setTimeout')); assert(!preset.includes('.click()')); assert(preset.includes('dice-preset-change'));
    });
    it('avoids global Enter listeners and retains the latest roll',()=>{
        assert(!dice.includes("document.addEventListener('keydown'"));
        assert(dice.includes('if (lastResult) displayResult(lastResult)'));
        assert(dice.includes('lastResult = result'));
    });
    it('escapes remote sender and reroll text in history',()=>{
        assert(dice.includes('${escHtml(sender)}'));
        assert(dice.includes('${escHtml(rerollDisplay)}'));
    });
    it('shares rule and turn guards between canvas and square controls',()=>{
        const handler=game.slice(game.indexOf('function activateSquare'),game.indexOf('// ---- UI event handlers ----'));
        assert(handler.includes('game.pendingReforge')); assert(handler.includes('game.turn !== localPlayer'));
        assert(handler.includes('activateSquare(square.x,square.y)'));
        assert(handler.includes('activateSquare(Number(squareX.value),Number(squareY.value))'));
        assert(handler.includes('game.getValidMoves(piece.id)'));
    });
    it('cleans up computer timers, animation and injected styles on close',()=>{
        const close=game.slice(game.indexOf('const closeKonrehModal ='),game.indexOf("const content = document.createElement('div');",game.indexOf('const closeKonrehModal =')));
        assert(close.includes('clearTimeout(aiTimer)')); assert(close.includes('stopCoachAnimation()')); assert(close.includes('style.remove()'));
        assert(game.includes('if (disposed || !modal.isConnected) return'));
    });
});
