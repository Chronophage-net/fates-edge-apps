/**
 * Sync Conflict Resolution
 * Handles merging and conflict resolution for operations
 */

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

  /**
   * Resolve conflict between two operations
   */
  resolve(op1, op2, state) {
    const strategy = this.strategies[op1.type];
    if (!strategy) {
      console.warn(`No conflict strategy for operation type: ${op1.type}`);
      return {
        winner: op1,
        strategy: 'fallback',
        conflict: false,
        suggestion: 'Using first operation as default'
      };
    }
    return strategy(op1, op2, state);
  }

  // ============================================================
  // Character Merge Methods
  // ============================================================

  mergeCharacterAdd(op1, op2, state) {
    if (op1.value.id === op2.value.id) {
      const existing = state.characters.find(c => c.id === op1.value.id);
      if (existing) {
        return {
          winner: existing,
          strategy: 'character_already_exists',
          conflict: true,
          suggestion: 'Use update instead of add'
        };
      }

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
        strategy: 'merge_character_add',
        conflict: false
      };
    }

    return {
      winner: op1,
      strategy: 'no_conflict',
      conflict: false
    };
  }

  mergeCharacterUpdate(op1, op2, state) {
    const charId = op1.path[0];
    const existing = state.characters.find(c => c.id === charId);

    if (!existing) {
      return {
        winner: null,
        strategy: 'character_not_found',
        conflict: true,
        suggestion: 'Character no longer exists'
      };
    }

    return this.mergeEntityUpdate(op1, op2, existing);
  }

  mergeCharacterDelete(op1, op2, state) {
    const charId = op1.path[0];
    const existing = state.characters.find(c => c.id === charId);

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

  // ============================================================
  // Timer Merge Methods
  // ============================================================

  mergeTimerAdd(op1, op2, state) {
    if (op1.value.id === op2.value.id) {
      const existing = state.timers.find(t => t.id === op1.value.id);
      if (existing) {
        return {
          winner: existing,
          strategy: 'timer_already_exists',
          conflict: true,
          suggestion: 'Use update instead of add'
        };
      }

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
        strategy: 'merge_timer_add',
        conflict: false
      };
    }

    return {
      winner: op1,
      strategy: 'no_conflict',
      conflict: false
    };
  }

  mergeTimerTick(op1, op2, state) {
    const timerId = op1.path[0];
    const timer = state.timers.find(t => t.id === timerId);

    if (!timer) {
      return {
        winner: null,
        strategy: 'timer_not_found',
        conflict: true,
        suggestion: 'Timer no longer exists'
      };
    }

    // For timer ticks, we want to apply both ticks
    const newValue = Math.min(timer.current + 2, timer.segments);
    return {
      winner: { current: newValue },
      strategy: 'merge_timer_ticks',
      conflict: false
    };
  }

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

  // ============================================================
  // Wiki Entry Merge Methods (FIXED: wiki → wikiEntries)
  // ============================================================

  mergeWikiAdd(op1, op2, state) {
    if (op1.value.id === op2.value.id) {
      const existing = state.wikiEntries.find(w => w.id === op1.value.id);
      if (existing) {
        return {
          winner: existing,
          strategy: 'wiki_entry_already_exists',
          conflict: true,
          suggestion: 'Use update instead of add'
        };
      }

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
        strategy: 'merge_wiki_add',
        conflict: false
      };
    }

    return {
      winner: op1,
      strategy: 'no_conflict',
      conflict: false
    };
  }

  mergeWikiUpdate(op1, op2, state) {
    const entryId = op1.path[0];
    const existing = state.wikiEntries.find(w => w.id === entryId);

    if (!existing) {
      return {
        winner: null,
        strategy: 'wiki_entry_not_found',
        conflict: true,
        suggestion: 'Wiki entry no longer exists'
      };
    }

    return this.mergeEntityUpdate(op1, op2, existing);
  }

  mergeWikiDelete(op1, op2, state) {
    const entryId = op1.path[0];
    const existing = state.wikiEntries.find(w => w.id === entryId);

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

  // ============================================================
  // Encounter Merge Methods
  // ============================================================

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

    return this.mergeEntityUpdate(op1, op2, existing);
  }

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

  // ============================================================
  // NPC Merge Methods
  // ============================================================

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

    return this.mergeEntityUpdate(op1, op2, existing);
  }

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

  // ============================================================
  // Settings Merge Methods
  // ============================================================

  mergeSettingsUpdate(op1, op2, state) {
    const merged = { ...state.settings };
    let hasConflict = false;
    const conflictFields = [];

    const fields1 = op1.value || {};
    const fields2 = op2.value || {};
    const allFields = new Set([...Object.keys(fields1), ...Object.keys(fields2)]);

    for (const field of allFields) {
      if (field in fields1 && field in fields2) {
        if (JSON.stringify(fields1[field]) !== JSON.stringify(fields2[field])) {
          hasConflict = true;
          conflictFields.push(field);
          // Last write wins for settings
          merged[field] = op1.timestamp > op2.timestamp ? fields1[field] : fields2[field];
        } else {
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

  // ============================================================
  // Generic Helper Methods
  // ============================================================

  /**
   * Generic entity update merge
   */
  mergeEntityUpdate(op1, op2, existing) {
    const merged = { ...existing };
    let hasConflict = false;
    const conflictFields = [];

    const fields1 = op1.value || {};
    const fields2 = op2.value || {};
    const allFields = new Set([...Object.keys(fields1), ...Object.keys(fields2)]);

    for (const field of allFields) {
      if (field in fields1 && field in fields2) {
        if (JSON.stringify(fields1[field]) !== JSON.stringify(fields2[field])) {
          hasConflict = true;
          conflictFields.push(field);

          // For simple fields, last write wins
          if (typeof fields1[field] !== 'object' || fields1[field] === null) {
            merged[field] = op1.timestamp > op2.timestamp ? fields1[field] : fields2[field];
          } else if (typeof fields1[field] === 'object' && typeof fields2[field] === 'object' && fields1[field] !== null && fields2[field] !== null) {
            // Deep merge for objects (not arrays)
            if (Array.isArray(fields1[field]) && Array.isArray(fields2[field])) {
              merged[field] = this.mergeArrays(fields1[field], fields2[field]);
            } else {
              merged[field] = { ...fields1[field], ...fields2[field] };
            }
          } else {
            merged[field] = op1.timestamp > op2.timestamp ? fields1[field] : fields2[field];
          }
        } else {
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
   * Merge two arrays with deduplication by id
   */
  mergeArrays(arr1, arr2) {
    if (!Array.isArray(arr1)) return arr2 || [];
    if (!Array.isArray(arr2)) return arr1 || [];

    const merged = [...arr1];
    const ids = new Set(arr1.map(item => item?.id).filter(id => id !== undefined));

    for (const item of arr2) {
      if (!item?.id || !ids.has(item.id)) {
        merged.push(item);
        if (item?.id) ids.add(item.id);
      } else {
        // Update existing item with same id
        const idx = merged.findIndex(existing => existing?.id === item.id);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], ...item };
        }
      }
    }

    return merged;
  }
}