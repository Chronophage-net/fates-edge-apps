import { describe, it, assert, assertEqual, sleep, createMockWebSocket } from '../runner.js';

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
