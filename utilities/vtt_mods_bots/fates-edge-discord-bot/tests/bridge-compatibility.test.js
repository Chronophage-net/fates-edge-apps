const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const VTTClient = require('../utils/websocket');
const { startTestServer, connect } = require('../../../javascript/fates-edge-socket-server/tests/support/live-server');
const { publicChat } = require('../utils/chat-relay');
const { accessError } = require('../utils/interaction-access');
const { rollDice } = require('../commands/roll');
test('all slash commands serialize and have unique names and valid option ordering', () => {
    const commands = require('../scripts/register-commands').loadCommands();
    assert.ok(commands.some(c => c.name === 'roll'));
    assert.equal(new Set(commands.map(c => c.name)).size, commands.length);
    function check(options = []) {
        let optional = false;
        for (const option of options) {
            if (option.type > 2) { assert.ok(!optional || !option.required, 'required options must come first'); optional ||= !option.required; }
            check(option.options);
        }
    }
    commands.forEach(c => check(c.options));
});
test('shared credentials restricted to operators in configured guild', () => {
    const config = { discord: { guildId: 'home' } };
    assert.ok(accessError({ guildId: 'away' }, config));
    assert.ok(accessError({ guildId: 'home', memberPermissions: { has: () => false } }, config));
    assert.equal(accessError({ guildId: 'home', memberPermissions: { has: () => true } }, config), null);
});
test('public chat excludes whispers and echoes, bounds length and disables mentions', () => {
    for (const extra of [{whisper:true}, {privateOnly:true}, {recipient:'gm'}, {senderClientId:'self'}])
        assert.equal(publicChat({ message: {text:'secret', ...extra} }, 'self'), null);
    const payload = publicChat({ message: { text: '@everyone'+'x'.repeat(3000), sender:'Player' } }, 'self');
    assert.equal(payload.content.length, 2000); assert.deepEqual(payload.allowedMentions.parse, []);
});
test('local dice enforce bounds and include modifiers', () => {
    const result = rollDice('100d2-3');
    assert.equal(result.rolls.length, 100); assert.ok(result.total >= 97 && result.total <= 197);
    for (const expression of ['0d6','101d6','1d1','1d999','2d6;attack','999999d6']) assert.throws(() => rollDice(expression));
});
test('Discord joins real server before announcing connected and sends chat', { timeout: 20000 }, async t => {
    const server = await startTestServer(); t.after(() => server.close());
    const peer = await connect(server); await peer.join();
    const bot = new VTTClient({ serverUrl: `ws://127.0.0.1:${server.port}/?existing=1`, roomCode: 'LIVE', botName: 'Discord Test' });
    t.after(() => bot.disconnect());
    assert.equal(bot.send('chat-message', { message: {text:'offline'} }), false);
    const ready = once(bot, 'connected'); bot.connect(); assert.equal(bot.connected, false); await ready;
    assert.ok(bot.clientId); assert.equal(bot.pendingMessages.length, 0);
    assert.equal(bot.send('chat-message', {message:{text:'from discord',sender:'Discord Test'}}), true);
    assert.equal((await peer.wait('chat-message')).message.text, 'from discord');
    const incoming = once(bot, 'chat-message'); peer.send('chat-message', {message:{text:'from web',sender:'Web'}});
    assert.equal((await incoming)[0].message.text, 'from web');
    const promoted = once(bot, 'gmRoleUpdate'); bot.requestGM(); await promoted;
    const timer = once(bot, 'adhocTimerState'); bot.createAdhocTimer('Discord clock', 4, 'integration test');
    assert.ok((await timer)[0].timers.some(item => item.name === 'Discord clock'));
    const deck = once(bot, 'deckDrawn'); bot.drawCards(1); assert.equal((await deck)[0].cards.length, 1);
    bot.disconnect(); assert.equal(bot.connected, false); assert.equal(bot.reconnectTimer, null);
});
test('wrong room passwords never report ready or retry; valid passwords join', { timeout: 20000 }, async t => {
    const server=await startTestServer();t.after(()=>server.close());
    const gm=await connect(server);await gm.join('LIVE',{role:'gm'});
    gm.send('set_room_password',{password:'private-room-password'});await gm.wait('set_room_password_ack');
    const config={serverUrl:`ws://127.0.0.1:${server.port}`,roomCode:'LIVE'};
    const rejected=new VTTClient({...config,password:'wrong'});t.after(()=>rejected.disconnect());
    let ready=false;rejected.on('connected',()=>ready=true);
    const error=once(rejected,'error');rejected.connect();
    const closed=new Promise(resolve=>rejected.ws.once('close',resolve));
    assert.match((await error)[0].message,/password/i);await closed;
    assert.equal(ready,false);assert.equal(rejected.connected,false);assert.equal(rejected.reconnectTimer,null);
    const allowed=new VTTClient({...config,password:'private-room-password'});t.after(()=>allowed.disconnect());
    const admitted=once(allowed,'connected');allowed.connect();await admitted;assert.equal(allowed.connected,true);
});
