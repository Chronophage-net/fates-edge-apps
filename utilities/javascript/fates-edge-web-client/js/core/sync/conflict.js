export class ConflictResolver {
  constructor() {
    this.strategies = {
      'add_character': this.mergeCharacterAdd.bind(this),
      'update_character': this.mergeCharacterUpdate.bind(this),
      'delete_character': this.mergeCharacterDelete.bind(this),
      'add_timer': this.mergeTimerAdd.bind(this),
      'tick_timer': this.mergeTimerTick.bind(this),
      'delete_timer': this.mergeTimerDelete.bind(this),
      'add_wiki_entry': this.mergeWikiAdd.bind(this),
      'update_wiki_entry': this.mergeWikiUpdate.bind(this),
      'delete_wiki_entry': this.mergeWikiDelete.bind(this),
      'add_encounter': this.mergeEncounterAdd.bind(this),
      'update_encounter': this.mergeEncounterUpdate.bind(this),
      'delete_encounter': this.mergeEncounterDelete.bind(this),
      'add_npc': this.mergeNpcAdd.bind(this),
      'update_npc': this.mergeNpcUpdate.bind(this),
      'delete_npc': this.mergeNpcDelete.bind(this),
      'update_settings': this.mergeSettingsUpdate.bind(this),
    };
  }
  
  // ... (keep existing methods)
  
  /**
   * Merge timer deletion conflicts
   */
  mergeTimerDelete(op1, op2, state) {
    const timerId = op1.path[0];
    const existing = state.timers.find(t => t.id === timerId);
    
    if (!existing) {
      return {
        winner: null,
        strategy: 'already_deleted',
        conflict: false
      };
    }
    
    // Delete wins
    return {
      winner: null,
      strategy: 'delete_wins',
      conflict: false
    };
  }
  
  /**
   * Merge wiki deletion conflicts
   */
  mergeWikiDelete(op1, op2, state) {
    const entryId = op1.path[0];
    const existing = state.wiki.find(w => w.id === entryId);
    
    if (!existing) {
      return {
        winner: null,
        strategy: 'already_deleted',
        conflict: false
      };
    }
    
    // Delete wins
    return {
      winner: null,
      strategy: 'delete_wins',
      conflict: false
    };
  }
  
  /**
   * Merge encounter addition conflicts
   */
  mergeEncounterAdd(op1, op2, state) {
    if (op1.value.id === op2.value.id) {
      const existing = state.encounters.find(e => e.id === op1.value.id);
      if (existing) {
        return {
          winner: existing,
          strategy: 'encounter_already_exists',
          conflict: true,
          suggestion: 'Use update instead of add'
        };
      }
      
      // Merge encounters
      const merged = {
        ...op1.value,
        ...op2.value,
        _syncVersion: Math.max(
          op1.value._syncVersion || 0,
          op2.value._syncVersion || 0
        ) + 1
      };
      
      return {
        winner: merged,
        strategy: 'merge_encounter_add',
        conflict: false
      };
    }
    
    return {
      winner: op1,
      strategy: 'no_conflict',
      conflict: false
    };
  }
  
  /**
   * Merge encounter update conflicts
   */
  mergeEncounterUpdate(op1, op2, state) {
    const encId = op1.path[0];
    const existing = state.encounters.find(e => e.id === encId);
    
    if (!existing) {
      return {
        winner: null,
        strategy: 'encounter_not_found',
        conflict: true,
        suggestion: 'Encounter no longer exists'
      };
    }
    
    // Field-level merge
    const merged = { ...existing };
    let hasConflict = false;
    const conflictFields = [];
    
    // Merge fields from both operations
    const fields1 = op1.value || {};
    const fields2 = op2.value || {};
    const allFields = new Set([...Object.keys(fields1), ...Object.keys(fields2)]);
    
    for (const field of allFields) {
      if (field in fields1 && field in fields2) {
        // Both operations modify the same field
        if (JSON.stringify(fields1[field]) !== JSON.stringify(fields2[field])) {
          hasConflict = true;
          conflictFields.push(field);
          
          // For simple fields, last write wins
          if (typeof fields1[field] !== 'object') {
            merged[field] = op1.timestamp > op2.timestamp ? fields1[field] : fields2[field];
          } else {
            // For complex fields, deep merge
            if (typeof fields1[field] === 'object' && typeof fields2[field] === 'object') {
              merged[field] = { ...fields1[field], ...fields2[field] };
            } else {
              merged[field] = op1.timestamp > op2.timestamp ? fields1[field] : fields2[field];
            }
          }
        } else {
          // Same value - no conflict
          merged[field] = fields1[field];
        }
      } else if (field in fields1) {
        merged[field] = fields1[field];
      } else {
        merged[field] = fields2[field];
      }
    }
    
    return {
      winner: merged,
      strategy: hasConflict ? 'field_level_merge_with_conflicts' : 'field_level_merge',
      conflict: hasConflict,
      conflictFields: conflictFields,
      suggestion: hasConflict ? 'Review conflicting fields' : null
    };
  }
  
  /**
   * Merge encounter deletion conflicts
   */
  mergeEncounterDelete(op1, op2, state) {
    const encId = op1.path[0];
    const existing = state.encounters.find(e => e.id === encId);
    
    if (!existing) {
      return {
        winner: null,
        strategy: 'already_deleted',
        conflict: false
      };
    }
    
    // Delete wins
    return {
      winner: null,
      strategy: 'delete_wins',
      conflict: false
    };
  }
  
  /**
   * Merge NPC addition conflicts
   */
  mergeNpcAdd(op1, op2, state) {
    if (op1.value.id === op2.value.id) {
      const existing = state.npcs.find(n => n.id === op1.value.id);
      if (existing) {
        return {
          winner: existing,
          strategy: 'npc_already_exists',
          conflict: true,
          suggestion: 'Use update instead of add'
        };
      }
      
      // Merge NPCs
      const merged = {
        ...op1.value,
        ...op2.value,
        _syncVersion: Math.max(
          op1.value._syncVersion || 0,
          op2.value._syncVersion || 0
        ) + 1
      };
      
      return {
        winner: merged,
        strategy: 'merge_npc_add',
        conflict: false
      };
    }
    
    return {
      winner: op1,
      strategy: 'no_conflict',
      conflict: false
    };
  }
  
  /**
   * Merge NPC update conflicts
   */
  mergeNpcUpdate(op1, op2, state) {
    const npcId = op1.path[0];
    const existing = state.npcs.find(n => n.id === npcId);
    
    if (!existing) {
      return {
        winner: null,
        strategy: 'npc_not_found',
        conflict: true,
        suggestion: 'NPC no longer exists'
      };
    }
    
    // Field-level merge (similar to character update)
    const merged = { ...existing };
    let hasConflict = false;
    const conflictFields = [];
    
    // Merge fields from both operations
    const fields1 = op1.value || {};
    const fields2 = op2.value || {};
    const allFields = new Set([...Object.keys(fields1), ...Object.keys(fields2)]);
    
    for (const field of allFields) {
      if (field in fields1 && field in fields2) {
        // Both operations modify the same field
        if (JSON.stringify(fields1[field]) !== JSON.stringify(fields2[field])) {
          hasConflict = true;
          conflictFields.push(field);
          
          // For simple fields, last write wins
          if (typeof fields1[field] !== 'object') {
            merged[field] = op1.timestamp > op2.timestamp ? fields1[field] : fields2[field];
          } else {
            // For complex fields, deep merge
            if (typeof fields1[field] === 'object' && typeof fields2[field] === 'object') {
              merged[field] = { ...fields1[field], ...fields2[field] };
            } else {
              merged[field] = op1.timestamp > op2.timestamp ? fields1[field] : fields2[field];
            }
          }
        } else {
          // Same value - no conflict
          merged[field] = fields1[field];
        }
      } else if (field in fields1) {
        merged[field] = fields1[field];
      } else {
        merged[field] = fields2[field];
      }
    }
    
    return {
      winner: merged,
      strategy: hasConflict ? 'field_level_merge_with_conflicts' : 'field_level_merge',
      conflict: hasConflict,
      conflictFields: conflictFields,
      suggestion: hasConflict ? 'Review conflicting fields' : null
    };
  }
  
  /**
   * Merge NPC deletion conflicts
   */
  mergeNpcDelete(op1, op2, state) {
    const npcId = op1.path[0];
    const existing = state.npcs.find(n => n.id === npcId);
    
    if (!existing) {
      return {
        winner: null,
        strategy: 'already_deleted',
        conflict: false
      };
    }
    
    // Delete wins
    return {
      winner: null,
      strategy: 'delete_wins',
      conflict: false
    };
  }
  
  /**
   * Merge settings update conflicts
   */
  mergeSettingsUpdate(op1, op2, state) {
    const merged = { ...state.settings };
    let hasConflict = false;
    const conflictFields = [];
    
    // Merge fields from both operations
    const fields1 = op1.value || {};
    const fields2 = op2.value || {};
    const allFields = new Set([...Object.keys(fields1), ...Object.keys(fields2)]);
    
    for (const field of allFields) {
      if (field in fields1 && field in fields2) {
        // Both operations modify the same field
        if (JSON.stringify(fields1[field]) !== JSON.stringify(fields2[field])) {
          hasConflict = true;
          conflictFields.push(field);
          
          // Last write wins for settings
          merged[field] = op1.timestamp > op2.timestamp ? fields1[field] : fields2[field];
        } else {
          // Same value - no conflict
          merged[field] = fields1[field];
        }
      } else if (field in fields1) {
        merged[field] = fields1[field];
      } else {
        merged[field] = fields2[field];
      }
    }
    
    return {
      winner: merged,
      strategy: hasConflict ? 'settings_merge_with_conflicts' : 'settings_merge',
      conflict: hasConflict,
      conflictFields: conflictFields,
      suggestion: hasConflict ? 'Review conflicting settings' : null
    };
  }
}
