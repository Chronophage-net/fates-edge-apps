/**
 * Operation Types and Validation
 */

export const OPERATION_TYPES = {
  ADD_CHARACTER: 'add_character',
  UPDATE_CHARACTER: 'update_character',
  DELETE_CHARACTER: 'delete_character',
  ADD_TIMER: 'add_timer',
  TICK_TIMER: 'tick_timer',
  DELETE_TIMER: 'delete_timer',
  ADD_WIKI_ENTRY: 'add_wiki_entry',
  UPDATE_WIKI_ENTRY: 'update_wiki_entry',
  DELETE_WIKI_ENTRY: 'delete_wiki_entry',
  ADD_CHAT_MESSAGE: 'add_chat_message',
  ADD_ROLL: 'add_roll',
  ADD_ENCOUNTER: 'add_encounter',
  UPDATE_ENCOUNTER: 'update_encounter',
  DELETE_ENCOUNTER: 'delete_encounter',
  ADD_NPC: 'add_npc',
  UPDATE_NPC: 'update_npc',
  DELETE_NPC: 'delete_npc',
  UPDATE_SETTINGS: 'update_settings'
};

/**
 * Validate an operation
 */
export function validateOperation(operation) {
    if (!operation || typeof operation !== 'object') {
        return false;
    }
    
    if (!operation.type || typeof operation.type !== 'string') {
        return false;
    }
    
    // Validate required fields for each operation type
    switch (operation.type) {
        case OPERATION_TYPES.ADD_CHARACTER:
            return operation.value && typeof operation.value === 'object' && operation.value.id;
            
        case OPERATION_TYPES.UPDATE_CHARACTER:
            return Array.isArray(operation.path) && operation.path.length > 0 && operation.value;
            
        case OPERATION_TYPES.DELETE_CHARACTER:
            return Array.isArray(operation.path) && operation.path.length > 0;
            
        case OPERATION_TYPES.ADD_TIMER:
            return operation.value && typeof operation.value === 'object' && operation.value.id;
            
        case OPERATION_TYPES.TICK_TIMER:
            return Array.isArray(operation.path) && operation.path.length > 0;
            
        case OPERATION_TYPES.DELETE_TIMER:
            return Array.isArray(operation.path) && operation.path.length > 0;
            
        case OPERATION_TYPES.ADD_WIKI_ENTRY:
            return operation.value && typeof operation.value === 'object' && operation.value.id;
            
        case OPERATION_TYPES.UPDATE_WIKI_ENTRY:
            return Array.isArray(operation.path) && operation.path.length > 0 && operation.value;
            
        case OPERATION_TYPES.DELETE_WIKI_ENTRY:
            return Array.isArray(operation.path) && operation.path.length > 0;
            
        case OPERATION_TYPES.ADD_CHAT_MESSAGE:
            return operation.value && typeof operation.value === 'object' && operation.value.id;
            
        case OPERATION_TYPES.ADD_ROLL:
            return operation.value && typeof operation.value === 'object' && operation.value.id;
            
        case OPERATION_TYPES.ADD_ENCOUNTER:
            return operation.value && typeof operation.value === 'object' && operation.value.id;
            
        case OPERATION_TYPES.UPDATE_ENCOUNTER:
            return Array.isArray(operation.path) && operation.path.length > 0 && operation.value;
            
        case OPERATION_TYPES.DELETE_ENCOUNTER:
            return Array.isArray(operation.path) && operation.path.length > 0;
            
        case OPERATION_TYPES.ADD_NPC:
            return operation.value && typeof operation.value === 'object' && operation.value.id;
            
        case OPERATION_TYPES.UPDATE_NPC:
            return Array.isArray(operation.path) && operation.path.length > 0 && operation.value;
            
        case OPERATION_TYPES.DELETE_NPC:
            return Array.isArray(operation.path) && operation.path.length > 0;
            
        case OPERATION_TYPES.UPDATE_SETTINGS:
            return operation.value && typeof operation.value === 'object';
            
        default:
            // Allow custom operations but require basic structure
            return true;
    }
}
