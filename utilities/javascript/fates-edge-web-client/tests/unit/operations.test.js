import { describe, it, assert, assertEqual, assertDeepEqual, assertTrue } from '../runner.js';
import {
    OPERATION_TYPES,
    validateOperation
} from '../../js/core/sync/operations.js';

// Note: operations.js does not export operation-factory helpers
// (createAddCharacterOperation, etc.) - these tests build operations as
// plain objects, matching how production code (e.g. SyncManager.broadcast)
// constructs them.

describe('Operations', () => {
    
    it('should validate a valid add_character operation', () => {
        const op = {
            type: OPERATION_TYPES.ADD_CHARACTER,
            value: { id: 'char-1', name: 'Test' }
        };
        assertTrue(validateOperation(op));
    });
    
    it('should reject invalid add_character operation missing id', () => {
        const op = {
            type: OPERATION_TYPES.ADD_CHARACTER,
            value: { name: 'Test' }
        };
        assert(!validateOperation(op));
    });
    
    it('should allow forward-compatible/unknown operation types with a valid shape', () => {
        // validateOperation()'s default case intentionally allows unknown
        // types through (see operations.js: "Allow custom operations but
        // require basic structure") so older clients don't hard-reject
        // operations introduced by newer ones. Only missing/non-string
        // `type` is rejected outright - see the next test.
        const op = {
            type: 'some_future_operation_type',
            value: {}
        };
        assertTrue(validateOperation(op));
    });

    it('should reject an operation with no type', () => {
        const op = { value: {} };
        assert(!validateOperation(op));
    });
    
    it('should validate an add_character operation shape', () => {
        const char = { id: 'char-1', name: 'Thorn' };
        const op = { type: OPERATION_TYPES.ADD_CHARACTER, value: char, timestamp: Date.now() };
        assertEqual(op.type, OPERATION_TYPES.ADD_CHARACTER);
        assertDeepEqual(op.value, char);
        assertTrue(op.timestamp > 0);
        assertTrue(validateOperation(op));
    });

    it('should validate an update_character operation shape', () => {
        const op = { type: OPERATION_TYPES.UPDATE_CHARACTER, path: ['char-1'], value: { name: 'New Name' } };
        assertEqual(op.type, OPERATION_TYPES.UPDATE_CHARACTER);
        assertDeepEqual(op.path, ['char-1']);
        assertDeepEqual(op.value, { name: 'New Name' });
        assertTrue(validateOperation(op));
    });

    it('should validate a delete_character operation shape', () => {
        const op = { type: OPERATION_TYPES.DELETE_CHARACTER, path: ['char-1'] };
        assertEqual(op.type, OPERATION_TYPES.DELETE_CHARACTER);
        assertDeepEqual(op.path, ['char-1']);
        assertTrue(validateOperation(op));
    });
});
