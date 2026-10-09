import { describe, it, assert, assertEqual, sleep, createMockWebSocket } from '../runner.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the production dispatchers with transport/DOM dependencies stubbed.
// This catches missing named delivery, not merely missing event-name strings.
const source = readFileSync(new URL('../../js/core/websocket.js', import.meta.url), 'utf8');
const plainDispatcher = source.slice(source.indexOf('function handleWebSocketMessage(data)'), source.indexOf('export function sendWSMessage'));
const ioDispatcher = source.slice(source.indexOf('function setupSocketIOListeners()'), source.indexOf('export function', source.indexOf('function setupSocketIOListeners()')));

describe('AI-GM browser event delivery', () => {
    for (const transport of ['websocket', 'socketio']) {
        it(`${transport} delivers narration, proposals and scene state exactly once to named subscribers`, () => {
            const received = [], listeners = new Map();
            const context = {
                pendingCallbacks: new Map(),
                triggerEvent: (event, data) => received.push({ event, data }),
                socket: { on: (event, fn) => listeners.set(event, fn) },
                document: { dispatchEvent() {} },
                CustomEvent: class {},
            };
            const dispatch = transport === 'websocket'
                ? vm.runInNewContext(plainDispatcher + ';handleWebSocketMessage;', context)
                : (vm.runInNewContext(ioDispatcher + ';setupSocketIOListeners();', context), data => {
                    assert(listeners.has(data.type), `Missing Socket.IO listener: ${data.type}`);
                    listeners.get(data.type)(data);
                });
            for (const event of ['tts-audio', 'soundboard-ambience', 'assistant-suggestion-created',
                'assistant-suggestion-resolved', 'scene-status-update', 'combat-status-update', 'sync-state']) {
                const data = { type: event, id: 'proposal-1', outcome: 'approved', status: 'active' };
                dispatch(data);
                assertEqual(received.length, 1, `${event} delivered exactly once`);
                assertEqual(received[0].event, event);
                assert(received[0].data === data, 'payload preserved');
                received.length = 0;
            }
        });
    }
});

describe('WebSocket Integration', () => {
    
    it('should handle connection lifecycle', async () => {
        const ws = createMockWebSocket();
        let openCalled = false;
        let closeCalled = false;
        
        ws.onopen = () => { openCalled = true; };
        ws.onclose = () => { closeCalled = true; };
        
        ws._open();
        assert(openCalled);
        assertEqual(ws.readyState, 1);
        
        ws._close(1000, 'Normal close');
        assert(closeCalled);
    });
    
    it('should send and receive messages', async () => {
        const ws = createMockWebSocket();
        let received = [];
        
        ws.onmessage = (event) => {
            received.push(JSON.parse(event.data));
        };
        
        ws._open();
        
        ws.send(JSON.stringify({ type: 'test', data: 'hello' }));
        ws._receive({ type: 'response', data: 'world' });
        
        assertEqual(received.length, 1);
        assertEqual(received[0].type, 'response');
        assertEqual(received[0].data, 'world');
    });
});
