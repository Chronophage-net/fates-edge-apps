import { describe, it, assert, assertEqual, assertDeepEqual, assertTrue } from '../runner.js';
import { 
    OPERATION_TYPES, 
    validateOperation, 
    createOperation,
    createAddCharacterOperation,
    createUpdateCharacterOperation,
    createDeleteCharacterOperation
} from '../../core/sync/operations.js';

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
    
    it('should reject invalid operation type', () => {
        const op = {
            type: 'invalid_type',
            value: {}
        };
        assert(!validateOperation(op));
    });
    
    it('should create an add_character operation', () => {
        const char = { id: 'char-1', name: 'Thorn' };
        const op = createAddCharacterOperation(char);
        assertEqual(op.type, OPERATION_TYPES.ADD_CHARACTER);
        assertDeepEqual(op.value, char);
        assertTrue(op.timestamp > 0);
    });
    
    it('should create an update_character operation', () => {
        const op = createUpdateCharacterOperation('char-1', { name: 'New Name' });
        assertEqual(op.type, OPERATION_TYPES.UPDATE_CHARACTER);
        assertDeepEqual(op.path, ['char-1']);
        assertDeepEqual(op.value, { name: 'New Name' });
    });
    
    it('should create a delete_character operation', () => {
        const op = createDeleteCharacterOperation('char-1');
        assertEqual(op.type, OPERATION_TYPES.DELETE_CHARACTER);
        assertDeepEqual(op.path, ['char-1']);
    });
});
