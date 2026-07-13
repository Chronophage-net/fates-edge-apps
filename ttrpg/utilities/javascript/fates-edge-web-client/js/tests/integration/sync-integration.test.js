import { describe, it, assert, assertEqual, assertDeepEqual, sleep, createMockWebSocket } from '../runner.js';
import { SyncManager } from '../../core/sync/index.js';
import { getState, loadState, saveState } from '../../core/state.js';

describe('SyncManager Integration', () => {
    
    it('should connect and handshake', async () => {
        const sync = new SyncManager();
        const mockWs = createMockWebSocket();
        
        // Override socket creation
        sync.socket = mockWs;
        sync.isConnecting = true;
        
        // Mock the send method
        let sentMessages = [];
        sync.send = (msg) => {
            sentMessages.push(msg);
            if (msg.type === 'handshake') {
                mockWs._receive({
                    type: 'handshake_ack',
                    success: true,
                    clientId: 'test-client',
                    versionVector: {},
                    currentState: {},
                    activeClients: []
                });
            }
        };
        
        // Connect
        await sync.connect('ws://localhost:3000', 'TEST123', 'password');
        
        // Check handshake was sent
        const handshake = sentMessages.find(m => m.type === 'handshake');
        assert(handshake);
        assertEqual(handshake.campaignCode, 'TEST123');
        assertEqual(handshake.clientName, sync.clientName);
        
        // Wait for handshake ack
        await sleep(100);
        assert(sync.isConnected);
        assertEqual(sync.clientId, 'test-client');
    });
    
    it('should broadcast operations', async () => {
        const sync = new SyncManager();
        const mockWs = createMockWebSocket();
        sync.socket = mockWs;
        sync.isConnecting = true;
        sync.clientId = 'test-client';
        
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
