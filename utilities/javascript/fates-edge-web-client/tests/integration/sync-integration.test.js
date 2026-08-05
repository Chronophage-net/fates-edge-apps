import { describe, it, assert, assertEqual, assertDeepEqual, sleep, createMockWebSocket } from '../runner.js';
import { SyncManager } from '../../js/core/sync/index.js';
import { getState, loadState, saveState } from '../../js/core/state.js';

// SyncManager.connect() always constructs its own `new WebSocket(url)` and
// wires up onopen/onmessage/onclose/onerror on it directly - it never
// looks at any socket a caller may have pre-assigned to `sync.socket`.
// So to exercise connect()'s real flow (rather than short-circuiting on
// "WebSocket is undefined in this environment"), tests need to install a
// controllable WebSocket constructor on the global before calling
// connect(), and let production code create/open it itself.
class TestWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 0; // CONNECTING
        this.sentRaw = [];
        TestWebSocket.instances.push(this);
        // Simulate the async "connection established" event a real
        // WebSocket would fire.
        queueMicrotask(() => {
            this.readyState = 1; // OPEN
            if (this.onopen) this.onopen();
        });
    }
    send(data) {
        this.sentRaw.push(data);
    }
    close(code, reason) {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose({ code: code || 1000, reason });
    }
    _receive(data) {
        if (this.onmessage) {
            this.onmessage({ data: JSON.stringify(data) });
        }
    }
}
TestWebSocket.CONNECTING = 0;
TestWebSocket.OPEN = 1;
TestWebSocket.CLOSING = 2;
TestWebSocket.CLOSED = 3;
TestWebSocket.instances = [];

describe('SyncManager Integration', () => {

    it('should connect and handshake', async () => {
        const previousWebSocket = globalThis.WebSocket;
        TestWebSocket.instances = [];
        globalThis.WebSocket = TestWebSocket;

        try {
            const sync = new SyncManager();

            // Mock the send method so no real network I/O happens; capture
            // what SyncManager tries to send and simulate the server's
            // handshake_ack coming back over the (fake) socket.
            let sentMessages = [];
            sync.send = (msg) => {
                sentMessages.push(msg);
                if (msg.type === 'handshake') {
                    sync.socket._receive({
                        type: 'handshake_ack',
                        success: true,
                        clientId: 'test-client',
                        versionVector: {},
                        currentState: {},
                        activeClients: []
                    });
                }
            };

            // Connect - production code creates its own TestWebSocket
            // instance here and resolves once onopen fires.
            await sync.connect('ws://localhost:3000', 'TEST123', 'password');

            // Check handshake was sent
            const handshake = sentMessages.find(m => m.type === 'handshake');
            assert(handshake);
            assertEqual(handshake.campaignCode, 'TEST123');
            assertEqual(handshake.clientName, sync.clientName);

            // Wait for handshake ack
            await sleep(20);
            assert(sync.isConnected);
            assertEqual(sync.clientId, 'test-client');

            sync.disconnect();
        } finally {
            globalThis.WebSocket = previousWebSocket;
        }
    });

    it('should broadcast operations', async () => {
        const sync = new SyncManager();
        const mockWs = createMockWebSocket();
        sync.socket = mockWs;
        sync.isConnecting = false;
        sync.isConnected = true;
        sync.clientId = 'test-client';

        // Wire the mock socket's onmessage the way connect() normally
        // would, so `mockWs._receive(...)` actually reaches SyncManager.
        mockWs.onmessage = (event) => sync.handleMessage(JSON.parse(event.data));

        let sentMessages = [];
        sync.send = (msg) => {
            sentMessages.push(msg);
            // Auto-ack operations
            if (msg.type === 'operation') {
                mockWs._receive({
                    type: 'operation_ack',
                    operationId: msg.operation.id,
                    success: true
                });
            }
        };

        const charData = { id: 'char-1', name: 'Test Character' };
        await sync.broadcast({
            type: 'add_character',
            value: charData
        });

        const ops = sentMessages.filter(m => m.type === 'operation');
        assert(ops.length > 0);
        assertEqual(ops[0].operation.type, 'add_character');
        assertDeepEqual(ops[0].operation.value, charData);
    });
    
    it('should apply remote operations', async () => {
        loadState();
        const sync = new SyncManager();
        sync.clientId = 'test-client';
        sync.operationLog = [];
        sync.versionVector = {};
        
        const charData = { id: 'char-2', name: 'Remote Character' };
        
        const message = {
            type: 'operation',
            operation: {
                id: 'op-123',
                clientId: 'remote-client',
                type: 'add_character',
                value: charData,
                timestamp: Date.now()
            }
        };
        
        // Ensure the character doesn't exist yet
        const stateBefore = getState();
        assert(!stateBefore.characters.find(c => c.id === 'char-2'));
        
        // Apply the operation
        sync.handleRemoteOperation(message);
        
        const stateAfter = getState();
        const char = stateAfter.characters.find(c => c.id === 'char-2');
        assert(char);
        assertEqual(char.name, 'Remote Character');
    });
});
