const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startTestServer, connect } = require('../../javascript/fates-edge-socket-server/tests/support/live-server');
const WebSocket = require('../fates-edge-discord-bot/node_modules/ws');
const source = fs.readFileSync(path.join(__dirname,'../foundry_fates-edge-bridge/scripts/bridge.js'),'utf8');
async function setup(settings = {}) {
    const messages = [];
    const user = {id:'foundry-gm',name:'Foundry GM',isGM:true,active:true};
    global.game = {user, users: Object.assign([user],{activeGM:user}), settings:{get:(_,key)=>settings[key]},journal:[]};
    global.Hooks = {call(){},on(){}};
    global.document = {getElementById:()=>null};
    global.ui = {notifications:{info(){},warn(){},error(){}}};
    global.ChatMessage = {create: async data => {messages.push(data);return data;}};
    global.WebSocket = WebSocket; global.window = global;
    const {FatesEdgeBridge: bridge} = await import('data:text/javascript;base64,'+Buffer.from(source+'\n//'+Math.random()+'\n//# sourceURL=foundry-bridge-test.js').toString('base64'));
    return {bridge,messages};
}
async function until(predicate) {
    const end=Date.now()+5000;
    while (!predicate()) {if(Date.now()>end) throw Error('Timed out waiting for bridge');await new Promise(r=>setTimeout(r,10));}
}
test('Foundry uses ws URL correctly and exchanges chat with actual server', {timeout:20000}, async t=>{
    const server=await startTestServer();t.after(()=>server.close());
    const peer=await connect(server);await peer.join();
    const {bridge,messages}=await setup({serverUrl:`ws://127.0.0.1:${server.port}/?existing=1`,roomCode:'LIVE',syncChat:true});
    t.after(()=>bridge.disconnect());bridge.connect();assert.equal(bridge.connected,false);
    await until(()=>bridge.connected);assert.ok(bridge.clientId);assert.equal(bridge.roomCode,'LIVE');
    assert.equal(bridge.sendChatMessage('from foundry'),true);
    assert.equal((await peer.wait('chat-message')).message.text,'from foundry');
    peer.send('chat-message',{message:{text:'<img src=x onerror=alert(1)>',sender:'Web'}});
    await until(()=>messages.some(m=>m.content.includes('&lt;img')));
    const imported=messages.find(m=>m.content.includes('&lt;img'));
    assert.equal(imported.flags['fates-edge-bridge'].imported,true);
    assert.doesNotMatch(imported.content,/<img/);
    bridge.hookDiceRoll({formula:'2d10',total:14});
    const roll=await peer.wait('roll-result');assert.equal(roll.result,14);assert.equal(roll.expr,'2d10');
});
test('Foundry prevents duplicate public imports and feedback; private chat stays private',async()=>{
    const {bridge,messages}=await setup({syncChat:true,syncRolls:true});
    game.users.activeGM={id:'other-gm'};
    bridge._handleChatMessage({message:{text:'public',sender:'Web'}});assert.equal(messages.length,0);
    bridge._handleChatMessage({message:{text:'private',sender:'Web',whisper:true}});
    assert.deepEqual(messages[0].whisper,['foundry-gm']);
    let sent=0;bridge._send=()=>{sent++;return true;};
    bridge.hookChatMessage({author:game.user,content:'public',flags:{'fates-edge-bridge':{imported:true}}});
    bridge.hookChatMessage({author:{id:'other'},content:'public'});
    bridge.hookChatMessage({author:game.user,content:'secret',blind:true});assert.equal(sent,0);
    bridge.hookChatMessage({author:game.user,content:'my message'});assert.equal(sent,1);
});
test('Foundry evaluates requested rolls locally instead of asking relay to evaluate',async()=>{
    const {bridge}=await setup();let payload;
    global.Roll=class {constructor(expr){this.formula=expr;this.total=12;}async evaluate(){return this;}};
    bridge.connected=true;bridge._send=(type,data)=>{payload={type,...data};return true;};
    assert.equal(await bridge.sendRoll('2d10'),true);assert.equal(payload.type,'roll-result');assert.equal(payload.result,12);
});
