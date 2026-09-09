import { describe, it, assert, assertEqual } from '../runner.js';
import { parseManagedConnection } from '../../js/core/managed-connection.js';
import { connectManagedRoom, disconnectWebSocket, isWSConnected, sendWSMessage, onWSEvent, offWSEvent } from '../../js/core/websocket.js';

function bundle(changes = {}) {
    const claims = { room_id: '11111111-1111-1111-1111-111111111111', server_id: '22222222-2222-2222-2222-222222222222', room_code: 'ABC1234567', placement_version: 1, role: 'player', exp: Math.floor(Date.now()/1000)+600, ...changes };
    return {room_id: claims.room_id, server_id: claims.server_id, placement_version: claims.placement_version,
        socket_url: 'wss://node.example/', room_token: `e30.${btoa(JSON.stringify(claims)).replace(/=/g,'')}.c2ln`};
}
function rejects(input) { try { parseManagedConnection(input); return false; } catch { return true; } }

describe('Managed room connections', () => {
    it('validates expiry, room placement and endpoints before exposing a credential to a socket', () => {
        assertEqual(parseManagedConnection(bundle()).roomCode,'ABC1234567');
        assert(rejects(bundle({exp:1})), 'expired grants rejected');
        assert(rejects({...bundle(),server_id:'different'}), 'mismatched node rejected');
        assert(rejects({...bundle(),socket_url:'ws://remote.example/'}), 'remote cleartext rejected');
        assert(rejects({...bundle(),socket_url:'wss://node.example/?roomToken=secret'}), 'query credentials rejected');
        assert(rejects({...bundle(),socket_url:'wss://user:pass@node.example/'}), 'URL credentials rejected');
        assert(rejects('fe_live_private-key'), 'API keys rejected');
    });
    it('waits for the assigned node acknowledgement and never stores or URL-encodes the token', async () => {
        const Original = globalThis.WebSocket;
        let client, states=0;
        const stateListener = () => states++;
        class FakeWebSocket {
            static OPEN=1;
            constructor(url) { this.url=url;this.readyState=1;this.sent=[];client=this; }
            send(value) { this.sent.push(JSON.parse(value)); }
            close() { this.readyState=3; }
        }
        globalThis.WebSocket=FakeWebSocket;
        onWSEvent('room-state',stateListener);
        try {
            const grant=bundle();
            const pending=connectManagedRoom(grant,'Reader');
            client.onopen();
            assert(!isWSConnected(),'transport open is not authorization');
            assertEqual(sendWSMessage({type:'state-updated',state:{privateNote:'pending'}}),false,'game data waits for acknowledgement');
            assertEqual(client.sent.length,1,'only the handshake has been sent');
            assert(!client.url.includes(grant.room_token),'no token in URL');
            assertEqual(client.sent[0].roomToken,grant.room_token);
            client.onmessage({data:JSON.stringify({type:'room-state',room:'ABC1234567'})});
            assertEqual(states,0,'initial state waits for verified placement');
            client.onmessage({data:JSON.stringify({type:'handshake_ack',success:true,room_id:'11111111-1111-1111-1111-111111111111',serverId:'22222222-2222-2222-2222-222222222222',placementVersion:1,clientId:'member',clientRole:'player'})});
            assertEqual((await pending).role,'player');
            assertEqual(states,1);
            assert(isWSConnected());
            assert(!JSON.stringify(localStorage).includes(grant.room_token),'credential never persisted');
        } finally { disconnectWebSocket();offWSEvent('room-state',stateListener);globalThis.WebSocket=Original; }
    });
    it('rejects wrong-node acknowledgements without releasing the initial state', async () => {
        const Original=globalThis.WebSocket;let client;
        class FakeWebSocket { static OPEN=1;constructor(url){this.url=url;this.readyState=1;client=this;}send(){}close(){this.readyState=3;} }
        globalThis.WebSocket=FakeWebSocket;
        try {
            const pending=connectManagedRoom(bundle());
            client.onopen();
            client.onmessage({data:JSON.stringify({type:'handshake_ack',success:true,room_id:'11111111-1111-1111-1111-111111111111',serverId:'wrong',placementVersion:1})});
            let denied=false;try{await pending;}catch{denied=true;}
            assert(denied);assert(!isWSConnected());
        } finally {disconnectWebSocket();globalThis.WebSocket=Original;}
    });
});
