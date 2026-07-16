/**
 * Sync Module - Real-time collaboration foundation
 * 
 * This module provides WebSocket-based synchronization for the Fate's Edge Toolkit.
 * It handles connection management, operation broadcasting, offline queuing,
 * and presence tracking.
 */

import { getState, saveState, mergeState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { OfflineQueue } from './offline-queue.js';
import { PresenceManager } from './presence.js';
import { validateOperation } from './operations.js';

// ============================================================
// Utility: Safe localStorage access
// ============================================================

const hasLocalStorage = typeof localStorage !== 'undefined';

function safeGetItem(key, defaultValue = null) {
  try {
    if (hasLocalStorage) {
      return localStorage.getItem(key) || defaultValue;
    }
  } catch (e) {
    // localStorage not available in test environment
  }
  return defaultValue;
}

function safeSetItem(key, value) {
  try {
    if (hasLocalStorage) {
      localStorage.setItem(key, value);
    }
  } catch (e) {
    // localStorage not available in test environment
  }
}

function safeRemoveItem(key) {
  try {
    if (hasLocalStorage) {
      localStorage.removeItem(key);
    }
  } catch (e) {
    // localStorage not available in test environment
  }
}

// ============================================================
// Utility: Safe DOM access
// ============================================================

const hasDocument = typeof document !== 'undefined';
const hasWindow = typeof window !== 'undefined';

function safeDispatchEvent(eventName, detail = {}) {
  try {
    if (hasDocument) {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
  } catch (e) {
    // DOM not available in test environment
  }
}

function safeAddEventListener(target, event, handler) {
  try {
    if (target) {
      target.addEventListener(event, handler);
    }
  } catch (e) {
    // Target not available in test environment
  }
}

function safeRemoveEventListener(target, event, handler) {
  try {
    if (target) {
      target.removeEventListener(event, handler);
    }
  } catch (e) {
    // Target not available in test environment
  }
}

// ============================================================
// ConflictResolver - Handles operation conflict resolution
// ============================================================

export class ConflictResolver {
  constructor() {
    // Use arrow functions to avoid binding issues
    this.strategies = {
      'add_character': (op1, op2, state) => this.mergeCharacterAdd(op1, op2, state),
      'update_character': (op1, op2, state) => this.mergeCharacterUpdate(op1, op2, state),
      'delete_character': (op1, op2, state) => this.mergeCharacterDelete(op1, op2, state),
      'add_timer': (op1, op2, state) => this.mergeTimerAdd(op1, op2, state),
      'tick_timer': (op1, op2, state) => this.mergeTimerTick(op1, op2, state),
      'delete_timer': (op1, op2, state) => this.mergeTimerDelete(op1, op2, state),
      'add_wiki_entry': (op1, op2, state) => this.mergeWikiAdd(op1, op2, state),
      'update_wiki_entry': (op1, op2, state) => this.mergeWikiUpdate(op1, op2, state),
      'delete_wiki_entry': (op1, op2, state) => this.mergeWikiDelete(op1, op2, state),
      'add_encounter': (op1, op2, state) => this.mergeEncounterAdd(op1, op2, state),
      'update_encounter': (op1, op2, state) => this.mergeEncounterUpdate(op1, op2, state),
      'delete_encounter': (op1, op2, state) => this.mergeEncounterDelete(op1, op2, state),
      'add_npc': (op1, op2, state) => this.mergeNpcAdd(op1, op2, state),
      'update_npc': (op1, op2, state) => this.mergeNpcUpdate(op1, op2, state),
      'delete_npc': (op1, op2, state) => this.mergeNpcDelete(op1, op2, state),
      'update_settings': (op1, op2, state) => this.mergeSettingsUpdate(op1, op2, state),
    };
  }

  /**
   * Resolve conflicts between two operations
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
    if (op1.value.id !== op2.value.id) {
      return { winner: op1, strategy: 'no_conflict', conflict: false };
    }

    const existing = state.characters.find(c => c.id === op1.value.id);
    if (existing) {
      return {
        winner: existing,
        strategy: 'character_already_exists',
        conflict: true,
        suggestion: 'Use update instead of add'
      };
    }

    return {
      winner: {
        ...op1.value,
        ...op2.value,
        _syncVersion: Math.max(
          op1.value._syncVersion || 0,
          op2.value._syncVersion || 0
        ) + 1
      },
      strategy: 'merge_character_add',
      conflict: false
    };
  }

  mergeCharacterUpdate(op1, op2, state) {
    return this.mergeEntityUpdate(op1, op2, state, 'characters', 'character_not_found');
  }

  mergeCharacterDelete(op1, op2, state) {
    return this.mergeDelete(op1, state, 'characters', 'character');
  }

  // ============================================================
  // Timer Merge Methods
  // ============================================================

  mergeTimerAdd(op1, op2, state) {
    if (op1.value.id !== op2.value.id) {
      return { winner: op1, strategy: 'no_conflict', conflict: false };
    }

    const existing = state.timers.find(t => t.id === op1.value.id);
    if (existing) {
      return {
        winner: existing,
        strategy: 'timer_already_exists',
        conflict: true,
        suggestion: 'Use update instead of add'
      };
    }

    return {
      winner: {
        ...op1.value,
        ...op2.value,
        _syncVersion: Math.max(
          op1.value._syncVersion || 0,
          op2.value._syncVersion || 0
        ) + 1
      },
      strategy: 'merge_timer_add',
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
    return this.mergeDelete(op1, state, 'timers', 'timer');
  }

  // ============================================================
  // Wiki Merge Methods (FIXED: wiki → wikiEntries)
  // ============================================================

  mergeWikiAdd(op1, op2, state) {
    if (op1.value.id !== op2.value.id) {
      return { winner: op1, strategy: 'no_conflict', conflict: false };
    }

    const existing = state.wikiEntries.find(w => w.id === op1.value.id);
    if (existing) {
      return {
        winner: existing,
        strategy: 'wiki_entry_already_exists',
        conflict: true,
        suggestion: 'Use update instead of add'
      };
    }

    return {
      winner: {
        ...op1.value,
        ...op2.value,
        _syncVersion: Math.max(
          op1.value._syncVersion || 0,
          op2.value._syncVersion || 0
        ) + 1
      },
      strategy: 'merge_wiki_add',
      conflict: false
    };
  }

  mergeWikiUpdate(op1, op2, state) {
    return this.mergeEntityUpdate(op1, op2, state, 'wikiEntries', 'wiki_entry_not_found');
  }

  mergeWikiDelete(op1, op2, state) {
    return this.mergeDelete(op1, state, 'wikiEntries', 'wiki_entry');
  }

  // ============================================================
  // Encounter Merge Methods
  // ============================================================

  mergeEncounterAdd(op1, op2, state) {
    if (op1.value.id !== op2.value.id) {
      return { winner: op1, strategy: 'no_conflict', conflict: false };
    }

    const existing = state.encounters.find(e => e.id === op1.value.id);
    if (existing) {
      return {
        winner: existing,
        strategy: 'encounter_already_exists',
        conflict: true,
        suggestion: 'Use update instead of add'
      };
    }

    return {
      winner: {
        ...op1.value,
        ...op2.value,
        _syncVersion: Math.max(
          op1.value._syncVersion || 0,
          op2.value._syncVersion || 0
        ) + 1
      },
      strategy: 'merge_encounter_add',
      conflict: false
    };
  }

  mergeEncounterUpdate(op1, op2, state) {
    return this.mergeEntityUpdate(op1, op2, state, 'encounters', 'encounter_not_found');
  }

  mergeEncounterDelete(op1, op2, state) {
    return this.mergeDelete(op1, state, 'encounters', 'encounter');
  }

  // ============================================================
  // NPC Merge Methods
  // ============================================================

  mergeNpcAdd(op1, op2, state) {
    if (op1.value.id !== op2.value.id) {
      return { winner: op1, strategy: 'no_conflict', conflict: false };
    }

    const existing = state.npcs.find(n => n.id === op1.value.id);
    if (existing) {
      return {
        winner: existing,
        strategy: 'npc_already_exists',
        conflict: true,
        suggestion: 'Use update instead of add'
      };
    }

    return {
      winner: {
        ...op1.value,
        ...op2.value,
        _syncVersion: Math.max(
          op1.value._syncVersion || 0,
          op2.value._syncVersion || 0
        ) + 1
      },
      strategy: 'merge_npc_add',
      conflict: false
    };
  }

  mergeNpcUpdate(op1, op2, state) {
    return this.mergeEntityUpdate(op1, op2, state, 'npcs', 'npc_not_found');
  }

  mergeNpcDelete(op1, op2, state) {
    return this.mergeDelete(op1, state, 'npcs', 'npc');
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
      conflictFields,
      suggestion: hasConflict ? 'Review conflicting settings' : null
    };
  }

  // ============================================================
  // Generic Helper Methods
  // ============================================================

  /**
   * Generic entity update merge
   */
  mergeEntityUpdate(op1, op2, state, collection, notFoundStrategy) {
    const entityId = op1.path[0];
    const existing = state[collection].find(e => e.id === entityId);

    if (!existing) {
      return {
        winner: null,
        strategy: notFoundStrategy,
        conflict: true,
        suggestion: 'Entity no longer exists'
      };
    }

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
          
          // Last write wins for simple fields
          if (typeof fields1[field] !== 'object' || fields1[field] === null) {
            merged[field] = op1.timestamp > op2.timestamp ? fields1[field] : fields2[field];
          } else if (typeof fields1[field] === 'object' && typeof fields2[field] === 'object' && fields1[field] !== null && fields2[field] !== null) {
            // Deep merge for objects (not arrays)
            if (Array.isArray(fields1[field]) && Array.isArray(fields2[field])) {
              // For arrays, merge with deduplication by id if possible
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
      conflictFields,
      suggestion: hasConflict ? 'Review conflicting fields' : null
    };
  }

  /**
   * Generic delete merge
   */
  mergeDelete(op, state, collection, entityType) {
    const entityId = op.path[0];
    const existing = state[collection].find(e => e.id === entityId);

    if (!existing) {
      return {
        winner: null,
        strategy: 'already_deleted',
        conflict: false
      };
    }

    return {
      winner: null,
      strategy: 'delete_wins',
      conflict: false
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

// ============================================================
// SyncManager - Main synchronization class
// ============================================================

export class SyncManager {
  constructor(config = {}) {
    // Connection state
    this.socket = null;
    this.serverUrl = null;
    this.campaignCode = null;
    this.clientId = null;
    this.clientName = config.name || this.getDefaultName();
    this.clientEmail = config.email || safeGetItem('fates-edge-client-email', '');
    this.clientRole = config.role || this.getDefaultRole();
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
    this.reconnectDelay = 1000;
    this.lastPassword = null;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    
    // Operation tracking
    this.operationIdCounter = 0;
    this.versionVector = {};
    this.pendingOperations = new Map();
    this.subscribers = new Map();
    this.operationLog = [];
    this.maxLogSize = 1000;
    this.operationTimeout = config.operationTimeout || 5000;
    
    // Modules
    this.offlineQueue = new OfflineQueue();
    this.presence = new PresenceManager();
    this.conflictResolver = new ConflictResolver();
    
    // Event listeners
    this.eventListeners = new Map();
    
    // DOM event handlers (for cleanup)
    this._domEventHandlers = [];
    
    // Bind methods
    this.handleMessage = this.handleMessage.bind(this);
    this.handleReconnect = this.handleReconnect.bind(this);
    this.sendHeartbeat = this.sendHeartbeat.bind(this);
    
    // Setup offline detection (only in browser environment)
    if (hasWindow) {
      this.setupOfflineDetection();
    }
  }

  // ============================================================
  // Connection Management
  // ============================================================

  /**
   * Connect to the sync server
   */
  connect(serverUrl, campaignCode, password, options = {}) {
    if (this.isConnected || this.isConnecting) {
      console.warn('Already connected or connecting');
      return Promise.resolve();
    }

    this.serverUrl = serverUrl;
    this.campaignCode = campaignCode.toUpperCase();
    this.clientName = options.name || this.clientName;
    this.clientEmail = options.email || this.clientEmail;
    this.clientRole = options.role || this.clientRole;
    this.lastPassword = password || '';
    this.isConnecting = true;

    const wsUrl = this.buildWebSocketUrl(serverUrl, campaignCode);

    return new Promise((resolve, reject) => {
      try {
        // Check if WebSocket is available (not in test environment)
        if (typeof WebSocket === 'undefined') {
          console.warn('WebSocket not available in this environment');
          this.isConnecting = false;
          resolve();
          return;
        }

        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
          this.isConnecting = false;
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          this.sendHandshake(password);
          this.startHeartbeat();
          
          this.notifyListeners('connection_change', this.getConnectionStatus());
          this._showToast('Connected to campaign server!', 'success');
          resolve();
        };
        
        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.warn('Failed to parse WebSocket message:', e);
          }
        };
        
        this.socket.onclose = (event) => {
          this.isConnected = false;
          this.isConnecting = false;
          this.socket = null;
          this.stopHeartbeat();
          
          this.notifyListeners('connection_change', {
            ...this.getConnectionStatus(),
            reason: event.reason || 'Connection closed'
          });
          
          this._showToast('Disconnected from server. Reconnecting...', 'warning');
          this.handleReconnect();
        };
        
        this.socket.onerror = (error) => {
          this.isConnecting = false;
          this.isConnected = false;
          console.error('WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };
        
      } catch (e) {
        this.isConnecting = false;
        this.isConnected = false;
        reject(e);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close(1000, 'Disconnected by user');
      this.socket = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.campaignCode = null;
    this.clientId = null;
    
    this.notifyListeners('connection_change', this.getConnectionStatus());
    this._showToast('Disconnected from campaign.', 'info');
  }

  /**
   * Build WebSocket URL from server URL and campaign code
   */
  buildWebSocketUrl(serverUrl, campaignCode) {
    let wsUrl = serverUrl.replace(/^http/, 'ws');
    wsUrl = wsUrl.replace(/\/$/, '');
    return `${wsUrl}/campaign/${campaignCode}`;
  }

  /**
   * Send handshake message
   */
  sendHandshake(password) {
    this.send({
      type: 'handshake',
      campaignCode: this.campaignCode,
      password: password || '',
      clientId: this.clientId,
      clientName: this.clientName,
      clientEmail: this.clientEmail,
      role: this.clientRole,
      version: '3.0.0',
      timestamp: Date.now()
    });
  }

  // ============================================================
  // Heartbeat Management
  // ============================================================

  startHeartbeat() {
    this.stopHeartbeat();
    if (typeof setInterval !== 'undefined') {
      this.heartbeatInterval = setInterval(this.sendHeartbeat, 30000);
    }
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  sendHeartbeat() {
    this.send({ type: 'ping', timestamp: Date.now() });
  }

  // ============================================================
  // Operation Broadcasting
  // ============================================================

  /**
   * Broadcast an operation to all connected clients
   */
  broadcast(operation) {
    return new Promise((resolve, reject) => {
      if (!validateOperation(operation)) {
        reject(new Error('Invalid operation'));
        return;
      }

      const opId = this.generateOperationId();
      const fullOperation = {
        ...operation,
        id: opId,
        clientId: this.clientId,
        clientName: this.clientName,
        clientEmail: this.clientEmail,
        role: this.clientRole,
        timestamp: Date.now(),
        version: { ...this.versionVector }
      };

      this.pendingOperations.set(opId, { resolve, reject, timestamp: Date.now() });

      // Send to server
      this.send({
        type: 'operation',
        operation: fullOperation
      });

      // Apply optimistically locally
      this.applyOperation(fullOperation);

      // Set timeout for operation acknowledgment
      if (typeof setTimeout !== 'undefined') {
        setTimeout(() => {
          if (this.pendingOperations.has(opId)) {
            const pending = this.pendingOperations.get(opId);
            if (pending) {
              this.offlineQueue.enqueue(fullOperation);
              pending.reject(new Error('Operation timeout'));
            }
            this.pendingOperations.delete(opId);
          }
        }, this.operationTimeout);
      }
    });
  }

  /**
   * Send a message through the WebSocket
   */
  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      this.offlineQueue.enqueue(message);
      console.debug('Offline: message queued', message.type);
    }
  }

  // ============================================================
  // Message Handling
  // ============================================================

  handleMessage(message) {
    const handlers = {
      'handshake_ack': this.handleHandshakeAck.bind(this),
      'operation': this.handleRemoteOperation.bind(this),
      'operation_ack': this.handleOperationAck.bind(this),
      'sync_response': this.handleSyncResponse.bind(this),
      'presence': this.handlePresenceUpdate.bind(this),
      'state_updated': this.handleStateUpdate.bind(this),
      'error': this.handleError.bind(this),
      'pong': () => { /* Heartbeat response */ },
    };

    const handler = handlers[message.type];
    if (handler) {
      handler(message);
    } else {
      console.debug('Unknown message type:', message.type);
    }
  }

  handleHandshakeAck(message) {
    if (message.success) {
      this.clientId = message.clientId || this.clientId;
      this.versionVector = message.versionVector || {};

      if (message.currentState) {
        mergeState(message.currentState, message.versionVector);
      }

      this.offlineQueue.flush((op) => {
        this.send(op);
      });

      if (message.activeClients) {
        this.presence.updateClients(message.activeClients);
        this.notifyListeners('presence_update', {
          clients: message.activeClients
        });
      }

      this.notifyListeners('sync_ready', {
        clientId: this.clientId,
        version: this.versionVector,
        state: getState()
      });

      this._showToast('Sync ready!', 'success');
    } else {
      this._showToast('Failed to join campaign: ' + (message.reason || 'Unknown error'), 'error');
    }
  }

  handleRemoteOperation(message) {
    const operation = message.operation;

    // Skip our own operations
    if (operation.clientId === this.clientId) {
      return;
    }

    // Deduplicate
    if (this.operationLog.some(op => op.id === operation.id)) {
      return;
    }

    if (!validateOperation(operation)) {
      console.warn('Invalid remote operation:', operation);
      return;
    }

    const applied = this.applyOperation(operation, true);

    if (applied) {
      this.operationLog.push(operation);
      if (this.operationLog.length > this.maxLogSize) {
        this.operationLog.shift();
      }

      this.versionVector[operation.clientId] = operation.id;

      this.send({
        type: 'operation_ack',
        operationId: operation.id,
        success: true
      });

      this.notifyListeners(operation.type, operation);
      this.notifyListeners('operation_applied', operation);
    }
  }

  handleOperationAck(message) {
    const pending = this.pendingOperations.get(message.operationId);
    if (pending) {
      if (message.success) {
        pending.resolve(message);
      } else {
        pending.reject(new Error(message.reason || 'Operation failed'));
      }
      this.pendingOperations.delete(message.operationId);
    }
  }

  handleSyncResponse(message) {
    if (message.state) {
      mergeState(message.state, message.versionVector);
      this.versionVector = message.versionVector || {};
      this.notifyListeners('sync_complete', {
        state: message.state,
        version: this.versionVector
      });
      this._showToast('Full sync complete.', 'success');
    }
  }

  handlePresenceUpdate(message) {
    if (message.clients) {
      this.presence.updateClients(message.clients);
      this.notifyListeners('presence_update', {
        clients: message.clients,
        changes: message.changes
      });
    }
  }

  handleStateUpdate(message) {
    if (message.state) {
      mergeState(message.state, message.versionVector);
      this.versionVector = message.versionVector || {};
      this.notifyListeners('state_updated', {
        state: message.state,
        version: this.versionVector,
        changes: message.changes
      });
    }
  }

  handleError(message) {
    console.error('Server error:', message.error, message.details);
    this._showToast('Server error: ' + message.error, 'error');

    const errorMessages = {
      'CAMPAIGN_NOT_FOUND': 'Campaign not found. Check your campaign code.',
      'AUTH_FAILED': 'Authentication failed. Check your password.',
      'CAMPAIGN_FULL': 'Campaign is full. Try again later.',
      'VERSION_MISMATCH': 'Your version is out of date. Please refresh the page.'
    };

    const userMessage = errorMessages[message.code];
    if (userMessage) {
      this._showToast(userMessage, 'error');
    }
  }

  // ============================================================
  // Toast Helper (safe for test environment)
  // ============================================================

  _showToast(message, type = 'info') {
    try {
      if (typeof showToast === 'function') {
        showToast(message, type);
      } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
      }
    } catch (e) {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // ============================================================
  // Operation Application
  // ============================================================

  applyOperation(operation, isRemote = false) {
    try {
      const state = getState();
      const appliers = this.getOperationAppliers();
      const applier = appliers[operation.type];
      
      if (applier) {
        const result = applier.call(this, state, operation);
        if (result) {
          saveState();
          this.triggerReRender(operation.type);
        }
        return result;
      }
      
      console.debug('Unknown operation type:', operation.type);
      return false;
      
    } catch (e) {
      console.error('Failed to apply operation:', e);
      return false;
    }
  }

  getOperationAppliers() {
    return {
      'add_character': (state, op) => this._addEntity(state, 'characters', op),
      'update_character': (state, op) => this._updateEntity(state, 'characters', op),
      'delete_character': (state, op) => this._deleteEntity(state, 'characters', op),
      'add_timer': (state, op) => this._addEntity(state, 'timers', op),
      'tick_timer': (state, op) => this._tickTimer(state, op),
      'delete_timer': (state, op) => this._deleteEntity(state, 'timers', op),
      'add_wiki_entry': (state, op) => this._addEntity(state, 'wikiEntries', op),
      'update_wiki_entry': (state, op) => this._updateEntity(state, 'wikiEntries', op),
      'delete_wiki_entry': (state, op) => this._deleteEntity(state, 'wikiEntries', op),
      'add_chat_message': (state, op) => this._addChatMessage(state, op),
      'add_roll': (state, op) => this._addRoll(state, op),
      'add_encounter': (state, op) => this._addEntity(state, 'encounters', op),
      'update_encounter': (state, op) => this._updateEntity(state, 'encounters', op),
      'delete_encounter': (state, op) => this._deleteEntity(state, 'encounters', op),
      'add_npc': (state, op) => this._addEntity(state, 'npcs', op),
      'update_npc': (state, op) => this._updateEntity(state, 'npcs', op),
      'delete_npc': (state, op) => this._deleteEntity(state, 'npcs', op),
      'update_settings': (state, op) => this._updateSettings(state, op),
    };
  }

  // ============================================================
  // Entity Operation Helpers
  // ============================================================

  _addEntity(state, collection, op) {
    if (!state[collection].find(e => e.id === op.value.id)) {
      state[collection].push(op.value);
      return true;
    }
    return false;
  }

  _updateEntity(state, collection, op) {
    const idx = state[collection].findIndex(e => e.id === op.path[0]);
    if (idx >= 0) {
      state[collection][idx] = {
        ...state[collection][idx],
        ...op.value,
        _syncVersion: op.id
      };
      return true;
    }
    return false;
  }

  _deleteEntity(state, collection, op) {
    const idx = state[collection].findIndex(e => e.id === op.path[0]);
    if (idx >= 0) {
      state[collection].splice(idx, 1);
      return true;
    }
    return false;
  }

  _tickTimer(state, op) {
    const idx = state.timers.findIndex(t => t.id === op.path[0]);
    if (idx >= 0) {
      state.timers[idx].current = Math.min(
        state.timers[idx].current + 1,
        state.timers[idx].segments
      );
      return true;
    }
    return false;
  }

  // FIXED: chatHistory → chatMessages
  _addChatMessage(state, op) {
    if (!state.chatMessages) {
      state.chatMessages = [];
    }
    if (!state.chatMessages.some(m => m.id === op.value.id)) {
      state.chatMessages.push(op.value);
      // Keep chat manageable
      if (state.chatMessages.length > 200) {
        state.chatMessages = state.chatMessages.slice(-200);
      }
      return true;
    }
    return false;
  }

  // FIXED: rollHistory → diceHistory
  _addRoll(state, op) {
    if (!state.diceHistory) {
      state.diceHistory = [];
    }
    if (!state.diceHistory.some(r => r.id === op.value.id)) {
      state.diceHistory.push(op.value);
      // Keep history manageable
      if (state.diceHistory.length > 100) {
        state.diceHistory = state.diceHistory.slice(-100);
      }
      return true;
    }
    return false;
  }

  _updateSettings(state, op) {
    if (!state.settings) state.settings = {};
    Object.assign(state.settings, op.value);
    return true;
  }

  // ============================================================
  // Event Management
  // ============================================================

  triggerReRender(operationType) {
    const eventMap = {
      'add_character': 'characters_changed',
      'update_character': 'characters_changed',
      'delete_character': 'characters_changed',
      'add_timer': 'timers_changed',
      'tick_timer': 'timers_changed',
      'delete_timer': 'timers_changed',
      'add_wiki_entry': 'wiki_changed',
      'update_wiki_entry': 'wiki_changed',
      'delete_wiki_entry': 'wiki_changed',
      'add_chat_message': 'chat_updated',
      'add_roll': 'dice_history_changed',
      'add_encounter': 'encounters_changed',
      'update_encounter': 'encounters_changed',
      'delete_encounter': 'encounters_changed',
      'add_npc': 'npcs_changed',
      'update_npc': 'npcs_changed',
      'delete_npc': 'npcs_changed',
      'update_settings': 'settings_changed'
    };

    const eventName = eventMap[operationType];
    if (eventName) {
      safeDispatchEvent(eventName, { type: operationType, source: 'sync' });
    }
  }

  subscribe(operationType, callback) {
    if (!this.subscribers.has(operationType)) {
      this.subscribers.set(operationType, new Set());
    }
    this.subscribers.get(operationType).add(callback);
    return () => this.unsubscribe(operationType, callback);
  }

  unsubscribe(operationType, callback) {
    if (this.subscribers.has(operationType)) {
      this.subscribers.get(operationType).delete(callback);
    }
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  notifyListeners(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.warn('Listener error:', e);
        }
      });
    }
  }

  // ============================================================
  // Reconnection
  // ============================================================

  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._showToast('Unable to reconnect after multiple attempts. Please refresh.', 'error');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    if (typeof setTimeout !== 'undefined') {
      setTimeout(() => {
        if (!this.isConnected && this.campaignCode) {
          this.connect(this.serverUrl, this.campaignCode, this.lastPassword, {
            name: this.clientName,
            email: this.clientEmail,
            role: this.clientRole
          })
            .then(() => {
              this.offlineQueue.flush((op) => this.send(op));
              this._showToast('Reconnected to campaign!', 'success');
            })
            .catch(() => this.handleReconnect());
        }
      }, delay);
    }
  }

  // ============================================================
  // Offline Detection
  // ============================================================

  setupOfflineDetection() {
    if (!hasWindow) return;

    const handleOnline = () => {
      if (!this.isConnected && this.campaignCode) {
        this.handleReconnect();
      }
    };

    const handleOffline = () => {
      this._showToast('You are offline. Changes will be queued.', 'warning');
    };

    safeAddEventListener(window, 'online', handleOnline);
    safeAddEventListener(window, 'offline', handleOffline);
    this._domEventHandlers.push({ event: 'online', handler: handleOnline });
    this._domEventHandlers.push({ event: 'offline', handler: handleOffline });
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  requestFullSync() {
    this.send({
      type: 'sync_request',
      clientId: this.clientId,
      version: this.versionVector
    });
  }

  generateOperationId() {
    return `${this.clientId || 'unknown'}-${++this.operationIdCounter}-${Date.now().toString(36)}`;
  }

  getDefaultName() {
    const saved = safeGetItem('fates-edge-client-name');
    if (saved) return saved;

    const names = ['GM', 'Player', 'Traveler', 'Adventurer', 'Dice Master', 'Storyteller'];
    const random = names[Math.floor(Math.random() * names.length)];
    const name = random + '-' + Math.floor(Math.random() * 1000);
    safeSetItem('fates-edge-client-name', name);
    return name;
  }

  getDefaultRole() {
    try {
      const state = getState();
      return state.characters?.some(c => c.role === 'gm') ? 'player' : 'gm';
    } catch (e) {
      return 'player';
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      campaignCode: this.campaignCode,
      clientId: this.clientId,
      clientName: this.clientName,
      clientEmail: this.clientEmail,
      role: this.clientRole,
      onlineClients: this.presence.getOnlineClients(),
      operationCount: this.operationLog.length,
      pendingOperations: this.pendingOperations.size,
      offlineQueueSize: this.offlineQueue.size()
    };
  }

  setName(name) {
    this.clientName = name;
    safeSetItem('fates-edge-client-name', name);
    this.send({
      type: 'presence',
      action: 'update',
      clientId: this.clientId,
      name: name,
      email: this.clientEmail
    });
  }

  setEmail(email) {
    this.clientEmail = email;
    safeSetItem('fates-edge-client-email', email);
    this.send({
      type: 'presence',
      action: 'update',
      clientId: this.clientId,
      name: this.clientName,
      email: email
    });
  }

  getEmail() {
    return this.clientEmail || safeGetItem('fates-edge-client-email', '');
  }

  // ============================================================
  // Cleanup
  // ============================================================

  destroy() {
    this.disconnect();
    
    // Remove DOM event listeners
    this._domEventHandlers.forEach(({ event, handler }) => {
      safeRemoveEventListener(window, event, handler);
    });
    this._domEventHandlers = [];
    
    // Clear all listeners
    this.eventListeners.clear();
    this.subscribers.clear();
    this.pendingOperations.clear();
    this.operationLog = [];
    
    console.log('SyncManager destroyed');
  }
}

// ============================================================
// Export
// ============================================================

// Export singleton instance (safe for test environment)
let syncManagerInstance = null;

export function getSyncManager() {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager();
  }
  return syncManagerInstance;
}

// For backward compatibility
export const syncManager = getSyncManager();

// Export for direct use
export default syncManager;