import { describe, it, assert, assertEqual, assertDeepEqual } from '../runner.js';
import { ConflictResolver } from '../../core/sync/conflict.js';

describe('ConflictResolver', () => {
    
    it('should resolve conflicting character updates with field merge', () => {
        const resolver = new ConflictResolver();
        const state = {
            characters: [{ id: 'char-1', name: 'Thorn', body: 3, wits: 2 }]
        };
        
        const op1 = {
            type: 'update_character',
            path: ['char-1'],
            value: { body: 4 },
            timestamp: 1000,
            clientId: 'client-a'
        };
        
        const op2 = {
            type: 'update_character',
            path: ['char-1'],
            value: { wits: 3 },
            timestamp: 2000,
            clientId: 'client-b'
        };
        
        const result = resolver.resolve(op1, op2, state);
        assert(result);
        assert(result.winner);
        assertEqual(result.winner.body, 4);
        assertEqual(result.winner.wits, 3);
        assertEqual(result.strategy, 'field_level_merge_with_conflicts');
    });
    
    it('should handle last-write-wins for same field conflicts', () => {
        const resolver = new ConflictResolver();
        const state = {
            characters: [{ id: 'char-1', name: 'Thorn' }]
        };
        
        const op1 = {
            type: 'update_character',
            path: ['char-1'],
            value: { name: 'Alice' },
            timestamp: 1000,
            clientId: 'client-a'
        };
        
        const op2 = {
            type: 'update_character',
            path: ['char-1'],
            value: { name: 'Bob' },
            timestamp: 2000,
            clientId: 'client-b'
        };
        
        const result = resolver.resolve(op1, op2, state);
        assert(result);
        assertEqual(result.winner.name, 'Bob'); // Last write wins
        assert(result.conflict);
        assertDeepEqual(result.conflictFields, ['name']);
    });
    
    it('should handle character deletion conflicts', () => {
        const resolver = new ConflictResolver();
        const state = {
            characters: [{ id: 'char-1', name: 'Thorn' }]
        };
        
        const op1 = {
            type: 'delete_character',
            path: ['char-1'],
            timestamp: 1000,
            clientId: 'client-a'
        };
        
        const op2 = {
            type: 'update_character',
            path: ['char-1'],
            value: { body: 4 },
            timestamp: 2000,
            clientId: 'client-b'
        };
        
        const result = resolver.resolve(op1, op2, state);
        assert(result);
        assertEqual(result.strategy, 'delete_wins');
        assert(!result.conflict);
    });
    
    it('should handle timer tick conflicts', () => {
        const resolver = new ConflictResolver();
        const state = {
            timers: [{ id: 'timer-1', name: 'Test', segments: 5, current: 0 }]
        };
        
        const op1 = {
            type: 'tick_timer',
            path: ['timer-1'],
            value: { count: 1 },
            timestamp: 1000
        };
        
        const op2 = {
            type: 'tick_timer',
            path: ['timer-1'],
            value: { count: 1 },
            timestamp: 2000
        };
        
        const result = resolver.resolve(op1, op2, state);
        assert(result);
        assertEqual(result.appliedTicks, 2);
        assertEqual(result.winner.current, 2);
    });
});
