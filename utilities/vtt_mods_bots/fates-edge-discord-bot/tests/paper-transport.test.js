const { test } = require('node:test');
const assert = require('node:assert/strict');
const VTTClient = require('../utils/websocket');
function client(send) {
    const vtt = new VTTClient({ serverUrl: 'ws://test', roomCode: 'ROOM' });
    vtt.connected = true;
    vtt.clientId = 'bot';
    vtt.ws = { readyState: 1, send: message => send(JSON.parse(message), vtt) };
    return vtt;
}
const operation = { type: 'add_character', value: { id: 'char', name: 'Test' } };

test('sends the existing operation envelope and accepts only matching receipts', async () => {
    const vtt = client((message, peer) => {
        assert.equal(message.type, 'operation');
        assert.equal(message.operation.clientId, 'bot');
        assert.equal(message.operation.value.id, 'char');
        peer._handleMessage({ type: 'operation_ack', operationId: 'wrong', success: true });
        peer._handleMessage({ type: 'operation_ack', operationId: message.operation.id, success: true });
    });
    await vtt.sendPaperOperation(operation, 30);
    assert.equal(vtt.listenerCount('operationAck'), 0);
    assert.equal(vtt.listenerCount('disconnected'), 0);
});

test('timeout does not queue an uncertain import for later replay', async () => {
    const vtt = client(() => {});
    await assert.rejects(vtt.sendPaperOperation(operation, 5), /acknowledged/);
    assert.equal(vtt.pendingMessages.length, 0);
    assert.equal(vtt.listenerCount('operationAck'), 0);
});

test('disconnect, send failure and negative receipts fail and clean up', async () => {
    for (const send of [
        (_message, peer) => peer.emit('disconnected'),
        () => { throw new Error('send failed'); },
        (message, peer) => peer._handleMessage({ type: 'operation_ack', operationId: message.operation.id, success: false })
    ]) {
        const vtt = client(send);
        await assert.rejects(vtt.sendPaperOperation(operation, 30));
        assert.equal(vtt.listenerCount('operationAck'), 0);
        assert.equal(vtt.pendingMessages.length, 0);
    }
});

test('offline imports are rejected without entering the reconnect queue', async () => {
    const vtt = client(() => { throw new Error('must not send'); });
    vtt.connected = false;
    await assert.rejects(vtt.sendPaperOperation(operation, 30), /not ready/);
    assert.equal(vtt.pendingMessages.length, 0);
});
