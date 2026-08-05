import { describe, it, assert, assertEqual } from '../runner.js';
import * as ws from '../../js/core/websocket.js';

/**
 * Regression coverage for a real bug found in js/features/vtt/voice.js:
 *
 * 1. Voice signaling (voice-offer/answer/ice-candidate/status) used to be
 *    sent through the generic sendEvent(), which wraps the payload as a
 *    Socket.io event literally named "event". The server's Socket.io
 *    handler (socketio-handlers.js) never listens for an "event" name --
 *    it listens for the specific names ('voice-offer', 'voice-answer', ...)
 *    directly -- so under Socket.io transport every voice signal was
 *    silently dropped. The dedicated sendVoiceOffer/sendVoiceAnswer/
 *    sendVoiceICECandidate/sendVoiceStatus helpers emit the correctly
 *    named Socket.io event AND fall back to a well-formed plain-WS message,
 *    so they work under both transports.
 *
 * 2. The 'voice-status' broadcasts used to omit `clientId` entirely. Every
 *    receiving client's status handler does
 *    `if (!clientId || clientId === getSocketId()) return;` -- so with no
 *    clientId, the broadcast was always a silent no-op and peers never
 *    learned this client had voice enabled.
 *
 * These tests exercise the transport-level helpers directly (the fix
 * point), and a source-level guard on voice.js so the bug can't silently
 * come back.
 */
describe('Voice signaling transport', () => {
    it('exports dedicated, transport-aware send functions for every voice signal type', () => {
        assert(typeof ws.sendVoiceOffer === 'function', 'sendVoiceOffer should be exported');
        assert(typeof ws.sendVoiceAnswer === 'function', 'sendVoiceAnswer should be exported');
        assert(typeof ws.sendVoiceICECandidate === 'function', 'sendVoiceICECandidate should be exported');
        assert(typeof ws.sendVoiceStatus === 'function', 'sendVoiceStatus should be exported');
    });

    it('sendVoiceOffer/Answer/ICECandidate/Status all send a well-formed plain-WS message when not connected', () => {
        // With no active connection, sendWSMessage() returns false rather
        // than throwing -- these should never throw regardless of
        // connection/transport state.
        assertEqual(ws.sendVoiceOffer({ from: 'a', to: 'b', offer: {} }), false);
        assertEqual(ws.sendVoiceAnswer({ from: 'a', to: 'b', answer: {} }), false);
        assertEqual(ws.sendVoiceICECandidate({ from: 'a', to: 'b', candidate: {} }), false);
        assertEqual(ws.sendVoiceStatus({ clientId: 'a', enabled: true, name: 'Player' }), false);
    });
});

describe('Voice feature source guard (regression)', () => {
    it('voice.js no longer routes voice signaling through the generic sendEvent()', async () => {
        const { readFileSync } = await import('node:fs');
        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const voiceJsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../js/features/vtt/voice.js');
        const src = readFileSync(voiceJsPath, 'utf8');

        assert(!/sendEvent\(/.test(src), 'voice.js should not call the generic sendEvent() for voice signaling (it is dropped under Socket.io transport)');
        assert(/sendVoiceOffer\(/.test(src), 'voice.js should call sendVoiceOffer()');
        assert(/sendVoiceAnswer\(/.test(src), 'voice.js should call sendVoiceAnswer()');
        assert(/sendVoiceICECandidate\(/.test(src), 'voice.js should call sendVoiceICECandidate()');
        assert(/sendVoiceStatus\(/.test(src), 'voice.js should call sendVoiceStatus()');
    });

    it('every voice-status broadcast includes clientId so peers can identify the sender', async () => {
        const { readFileSync } = await import('node:fs');
        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const voiceJsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../js/features/vtt/voice.js');
        const src = readFileSync(voiceJsPath, 'utf8');

        // Find each sendVoiceStatus({...}) call block and confirm it sets clientId.
        const calls = src.match(/sendVoiceStatus\(\{[^}]*\}\)/gs) || [];
        assert(calls.length >= 2, 'expected at least an enable and a disable sendVoiceStatus() call');
        for (const call of calls) {
            assert(/clientId\s*:/.test(call), `sendVoiceStatus() call missing clientId: ${call}`);
        }
    });
});
