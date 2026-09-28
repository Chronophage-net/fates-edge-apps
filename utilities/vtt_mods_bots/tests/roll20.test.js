const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function sandbox() {
    const events = {}, sent = [], state = {};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../fates-edge-roll20/api/fates-edge-api.js'),'utf8'), {
        state, on: (event, fn) => events[event] = fn, log() {}, sendChat: (...args) => sent.push(args),
        randomInteger: max => max, playerIsGM: id => id === 'gm', getObj: () => null, getAttrByName: () => 0
    });
    events.ready();
    return {state,sent,command(content, playerid='gm') {events['chat:message']({type:'api',content:'!fates-edge '+content,playerid});}};
}
test('Roll20 runs with only sandbox APIs; local deck draws without replacement', () => {
    const s=sandbox();s.command('shuffle');assert.equal(s.state.FatesEdge.deck.length,54);
    s.command('draw 5');assert.equal(s.state.FatesEdge.deck.length,49);assert.equal(new Set(s.state.FatesEdge.history[0]).size,5);
    s.command('draw 999');assert.equal(s.state.FatesEdge.deck.length,49);
    s.command('shuffle','player');assert.equal(s.state.FatesEdge.deck.length,49);
    s.command('connect');assert.match(s.sent.at(-1)[1],/unavailable/);
});
test('Roll20 timers clamp progress and reject prototype keys', () => {
    const s=sandbox();s.command('timer add doom 4');s.command('timer tick doom 10');assert.equal(s.state.FatesEdge.timers.doom.current,4);
    s.command('timer add __proto__ 4');assert.equal(Object.keys(s.state.FatesEdge.timers).length,1);
    s.command('timer tick doom -10');assert.equal(s.state.FatesEdge.timers.doom.current,0);
});
test('Roll20 sheet contains native roll buttons and no executable browser scripts', () => {
    const dir=path.join(__dirname,'../fates-edge-roll20/character-sheet');
    const html=fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(f=>f.endsWith('.html'))),'utf8');
    assert.doesNotMatch(html,/<script|onclick\s*=/i);assert.match(html,/type="roll"/);
});
