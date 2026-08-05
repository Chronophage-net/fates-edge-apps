import { describe, it, assert, assertEqual } from '../runner.js';
import { VoiceChat } from '../../js/components/VoiceChat.js';
import { fetchTurnIceServers } from '../../js/core/turn.js';
import { isConnectedToServer } from '../../js/core/websocket.js';

describe('VoiceChat ICE server configuration', () => {
    it('defaults to STUN-only when no extra ICE servers are given', () => {
        const chat = new VoiceChat();
        assert(chat.configuration.iceServers.length >= 3, 'should keep the default STUN servers');
        assert(chat.configuration.iceServers.every(s => s.urls.startsWith('stun:')), 'defaults should all be STUN');
    });

    it('appends extra (TURN) ICE servers after the default STUN servers', () => {
        const stunCount = new VoiceChat().configuration.iceServers.length;
        const turnServers = [
            { urls: 'turn:turn.example.com:3478', username: '123:alice', credential: 'abc==' },
            { urls: 'turns:turn.example.com:5349', username: '123:alice', credential: 'abc==' }
        ];
        const chat = new VoiceChat(turnServers);

        assertEqual(chat.configuration.iceServers.length, stunCount + 2);
        const turnEntries = chat.configuration.iceServers.filter(s => s.urls.startsWith('turn'));
        assertEqual(turnEntries.length, 2);
        assert(turnEntries.some(s => s.credential === 'abc=='), 'TURN credential should be preserved');
    });

    it('ignores a non-array extraIceServers argument instead of throwing', () => {
        const chat = new VoiceChat(null);
        assert(Array.isArray(chat.configuration.iceServers));
        assert(chat.configuration.iceServers.length > 0);
    });
});

describe('fetchTurnIceServers()', () => {
    it('resolves to [] (never throws) when not connected to a server', async () => {
        assertEqual(isConnectedToServer(), false, 'test environment should start disconnected');
        const servers = await fetchTurnIceServers();
        assert(Array.isArray(servers));
        assertEqual(servers.length, 0);
    });
});
