# Updated Fate's Edge Toolkit v3.0 — Real-Time Collaboration Design Document

**Version:** 3.0  
**Date:** 2026-07-13  
**Status:** Design Specification  
**Author:** Nicholas A. Gasper  

---

## 1. Executive Summary

Fate's Edge Toolkit is a browser-based TTRPG companion application with a modular JavaScript architecture. This document outlines a comprehensive design for transitioning from the current manual state-sharing mechanism to a real-time collaborative system supporting simultaneous GM and player interactions.

The system will leverage WebSockets for bidirectional communication, implement conflict-free data synchronization, and maintain offline-first capabilities while preserving the existing modular architecture.

---

## 2. Current State Analysis

### 2.1 Existing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Client)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │  Home   │  │  Dice   │  │   VTT   │  │  Wiki   │      │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘      │
│       │            │            │            │            │
│       └────────────┴────────────┴────────────┘            │
│                          │                                 │
│                   ┌──────▼──────┐                          │
│                   │   State     │                          │
│                   │   Store     │                          │
│                   └──────┬──────┘                          │
│                          │                                 │
│                   ┌──────▼──────┐                          │
│                   │ localStorage│                          │
│                   └──────┬──────┘                          │
└──────────────────────────┼─────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ HTTP Server │ (Campaign Sharing)
                    │  (Manual)   │
                    └─────────────┘
```

### 2.2 Current Capabilities

| Feature | Status | Description |
|---------|--------|-------------|
| Local Storage | ✅ Complete | Full state persistence in browser |
| Manual Sync | ✅ Complete | HTTP upload/download via campaign code |
| Password Protection | ✅ Complete | SHA-256 hash gate on initial load |
| Offline Support | ⚠️ Partial | Works offline but changes aren't queued |
| Real-Time Sync | ❌ Missing | No WebSocket or streaming support |
| Conflict Resolution | ❌ Missing | Last-write-wins only on manual sync |
| Presence Detection | ❌ Missing | No awareness of other connected users |

### 2.3 Limitations of Current Approach

1. **Manual Operation**: Users must explicitly upload/download state
2. **Full-State Transfers**: Inefficient for small changes
3. **No Conflict Handling**: Simultaneous edits cause data loss
4. **No User Awareness**: Can't see who else is in the campaign
5. **Single User Model**: Assumes one user is the "source of truth"

---

## 3. Target Architecture

### 3.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    Feature Modules                         │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │    │
│  │  │ Home     │ │ Dice     │ │ VTT      │ │ Wiki     │    │    │
│  │  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤    │    │
│  │  │Characters│ │ Timers   │ │Encounter │ │ Settings │    │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              │                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    Sync Layer                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │    │
│  │  │ Change Queue │  │  Conflict    │  │  Presence    │    │    │
│  │  │  (Offline)   │  │  Resolver    │  │  Manager     │    │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              │                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    State Store                            │    │
│  │  ┌──────────────────────────────────────────────────┐    │    │
│  │  │  Versioned State + LocalStorage Cache           │    │    │
│  │  └──────────────────────────────────────────────────┘    │    │
│  └────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                          ┌─────▼─────┐
                          │ WebSocket │
                          │  (WSS)    │
                          └─────┬─────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                        Server (Node.js)                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  WebSocket Gateway                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │    │
│  │  │  Connection  │  │  Room/Camp   │  │  Broadcast   │    │    │
│  │  │  Manager     │  │  Manager     │  │  Handler     │    │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              │                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                     Data Layer                             │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │    │
│  │  │  Redis/      │  │  Operation   │  │  Conflict    │    │    │
│  │  │  Memory Store│  │  Log (OT)   │  │  Resolution  │    │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Design Principles

1. **Decentralized**: Each client maintains its own state with authoritative server as merge coordinator
2. **Conflict-Free**: Use Operational Transformation (OT) for collaborative editing
3. **Offline-First**: All operations are queued when disconnected
4. **Incremental**: Only sync changes, not full state snapshots
5. **Backward Compatible**: Existing manual sync still works

---

## 4. Core Technical Components

### 4.1 WebSocket Protocol

#### 4.1.1 Connection Handshake

```javascript
// Client → Server
{
  type: 'handshake',
  campaignCode: 'ABC123',
  password: 'hashed_password',
  clientId: 'uuid',
  clientName: 'GM Nick',
  role: 'gm' | 'player',
  version: '3.0.0'
}

// Server → Client
{
  type: 'handshake_ack',
  success: true,
  serverTime: 1234567890,
  currentState: { /* full state for new client */ },
  activeClients: [
    { id: 'uuid1', name: 'GM Nick', role: 'gm' },
    { id: 'uuid2', name: 'Player Alice', role: 'player' }
  ],
  pendingOperations: [ /* operations missed while offline */ ]
}
```

#### 4.1.2 Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `operation` | Bidirectional | An atomic state change (CRUD operation) |
| `sync_request` | Client → Server | Request full state sync |
| `sync_response` | Server → Client | Full state snapshot |
| `ack` | Bidirectional | Acknowledgment with operation ID |
| `presence` | Bidirectional | User status updates |
| `ping/pong` | Bidirectional | Connection health checks |
| `chat_message` | Bidirectional | VTT chat messages |
| `roll_result` | Bidirectional | Dice roll results |
| `cursor_update` | Bidirectional | Real-time cursor positions |

#### 4.1.3 Operation Schema

```typescript
interface Operation {
  id: string;                    // UUID
  clientId: string;              // Origin client
  timestamp: number;             // Server timestamp
  type: OperationType;
  path: string[];                // Path to affected data
  value: any;                    // New value (or delta)
  version: number;               // Version vector
  dependencies: string[];        // Operation IDs this depends on
}

type OperationType = 
  | 'add_character'
  | 'update_character'
  | 'delete_character'
  | 'add_timer'
  | 'tick_timer'
  | 'add_wiki_entry'
  | 'update_wiki_entry'
  | 'add_roll'
  | 'add_chat_message'
  | 'update_settings'
  | 'add_encounter'
  | 'update_encounter';
```

### 4.2 Conflict Resolution Strategy

#### 4.2.1 Operational Transformation (OT)

**Why OT over CRDT:**
- Simpler implementation for document-based data
- Easier to reason about with a central server
- Supports ordered operations

**OT Type:** Centralized OT with Client-Server architecture

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│ Client A │────────▶│ Server   │────────▶│ Client B │
│  Op O1   │         │ Transform│         │  Op O1'  │
└──────────┘         └──────────┘         └──────────┘
                            │
                     ┌──────▼──────┐
                     │  Apply to   │
                     │  State Log  │
                     └─────────────┘
```

#### 4.2.2 Conflict Categories

| Category | Example | Resolution |
|----------|---------|------------|
| **Concurrent Writes** | Two GMs change a character's name simultaneously | Server timestamps determine winner; losing change is returned as suggestion |
| **Dependent Writes** | One user deletes a character while another edits it | Operation rejects with `DEPENDENCY_ERROR` |
| **Network Partition** | Client reconnects after disconnect | Queue of operations played back in order |
| **Schema Version Mismatch** | Client running old version | Server rejects and notifies client to refresh |

#### 4.2.3 Merge Strategy by Data Type

| Data Type | Strategy |
|-----------|----------|
| **Characters** | Field-level last-write-wins with merge suggestions |
| **Timers** | Last tick wins; server coordinates |
| **Wiki** | Append-only with versioning; full edit history |
| **Chat** | Append-only; no conflicts |
| **Roll History** | Append-only; no conflicts |
| **Encounter/NPCs** | Field-level merge |
| **Settings** | Client has authority for their own settings; GM can override campaign settings |

### 4.3 State Versioning

#### 4.3.1 Version Vectors

Each client maintains a version vector to track what they've seen:

```javascript
{
  // clientId -> version (last operation ID seen from that client)
  'client-abc': 15,
  'client-def': 32,
  'client-ghi': 7
}
```

#### 4.3.2 Snapshot+Delta Sync

```
Snapshot (Full State) → [Delta] → [Delta] → [Delta] → Current
         ↓               ↓          ↓          ↓
       Version 0      Version 1   Version 2  Version 3
```

**Sync Strategy:**
1. New client connects → receives full snapshot + version vector
2. Existing client reconnects → server sends only missing deltas
3. Periodic full snapshots for reliability (every 50 operations)

### 4.4 Offline Support

#### 4.4.1 Operation Queue

```javascript
class OfflineQueue {
  constructor() {
    this.operations = [];
    this.persistQueue();
  }
  
  async enqueue(op) {
    this.operations.push({
      ...op,
      queuedAt: Date.now(),
      status: 'pending'
    });
    await this.persistQueue();
  }
  
  async flush(socket) {
    const pending = this.operations.filter(o => o.status === 'pending');
    for (const op of pending) {
      try {
        socket.send(JSON.stringify(op));
        op.status = 'sent';
      } catch (e) {
        // Keep in queue for retry
      }
    }
  }
  
  async persistQueue() {
    // Save to IndexedDB or localStorage
    await saveToIndexedDB('offline-queue', this.operations);
  }
}
```

#### 4.4.2 Reconnection Strategy

```javascript
class ReconnectionManager {
  constructor() {
    this.backoffIntervals = [1000, 2000, 5000, 10000, 30000];
    this.attempt = 0;
  }
  
  async reconnect() {
    while (this.attempt < this.backoffIntervals.length) {
      try {
        await this.connect();
        this.attempt = 0;
        return true;
      } catch (e) {
        const delay = this.backoffIntervals[this.attempt];
        await sleep(delay);
        this.attempt++;
      }
    }
    // All reconnection attempts failed
    this.enterOfflineMode();
    return false;
  }
}
```

---

## 5. Server Architecture

### 5.1 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Runtime** | Node.js 20+ | Lightweight, WebSocket native |
| **WS Library** | `ws` | Fast, battle-tested WebSocket implementation |
| **HTTP Server** | Express.js | REST API for manual sync fallback |
| **State Store** | Redis | In-memory store with persistence; fast operation log |
| **Persistence** | SQLite / PostgreSQL | Full state snapshots for recovery |

### 5.2 Server Components

#### 5.2.1 Connection Manager

```javascript
class ConnectionManager {
  constructor() {
    this.connections = new Map(); // clientId -> { ws, metadata, lastSeen }
    this.campaigns = new Map();   // campaignCode -> Set<clientId>
    this.userRoles = new Map();   // clientId -> role
  }
  
  addConnection(clientId, ws, campaignCode, metadata) {
    this.connections.set(clientId, { ws, metadata, lastSeen: Date.now() });
    if (!this.campaigns.has(campaignCode)) {
      this.campaigns.set(campaignCode, new Set());
    }
    this.campaigns.get(campaignCode).add(clientId);
    this.userRoles.set(clientId, metadata.role || 'player');
  }
  
  getCampaignClients(campaignCode) {
    const clientIds = this.campaigns.get(campaignCode) || new Set();
    return Array.from(clientIds).map(id => ({
      id,
      metadata: this.connections.get(id)?.metadata,
      online: this.connections.has(id)
    }));
  }
}
```

#### 5.2.2 Operation Processor

```javascript
class OperationProcessor {
  constructor(store, conflictResolver) {
    this.store = store;
    this.conflictResolver = conflictResolver;
    this.operationLog = [];
  }
  
  async processOperation(operation, clientId) {
    // 1. Validate operation format
    if (!this.validateOperation(operation)) {
      return this.errorResponse('INVALID_OPERATION');
    }
    
    // 2. Check version dependencies
    if (!this.conflictResolver.checkDependencies(operation)) {
      return this.errorResponse('DEPENDENCY_ERROR');
    }
    
    // 3. Apply to state with conflict resolution
    const result = await this.conflictResolver.resolve(operation, this.store);
    
    // 4. Log operation
    this.operationLog.push({
      ...operation,
      serverTimestamp: Date.now(),
      applied: true
    });
    
    // 5. Broadcast to other clients
    this.broadcastToCampaign(operation.campaignCode, operation, clientId);
    
    // 6. Return ACK
    return { success: true, operationId: operation.id };
  }
}
```

#### 5.2.3 Conflict Resolver

```javascript
class ConflictResolver {
  constructor() {
    this.resolutionStrategies = {
      add_character: this.mergeCharacterAdd.bind(this),
      update_character: this.mergeCharacterUpdate.bind(this),
      tick_timer: this.mergeTimerTick.bind(this),
      // ...
    };
  }
  
  checkDependencies(operation) {
    // Check that all dependencies exist in log
    return operation.dependencies.every(depId => 
      this.operationLog.some(log => log.id === depId)
    );
  }
  
  async resolve(operation, store) {
    const strategy = this.resolutionStrategies[operation.type];
    if (!strategy) {
      return this.defaultMerge(operation, store);
    }
    return await strategy(operation, store);
  }
  
  mergeCharacterAdd(operation, store) {
    // Check if character already exists (conflict)
    const existing = store.characters.find(c => c.id === operation.value.id);
    if (existing) {
      // Return a suggestion with a conflict warning
      return {
        accepted: false,
        conflict: true,
        message: 'Character already exists',
        suggestion: existing,
        operation: operation
      };
    }
    return { accepted: true, operation };
  }
  
  mergeCharacterUpdate(operation, store) {
    const existing = store.characters.find(c => c.id === operation.path[0]);
    if (!existing) {
      return { accepted: false, conflict: false, message: 'Character not found' };
    }
    
    // Field-level merge
    Object.keys(operation.value).forEach(field => {
      if (field === 'skills') {
        // Deep merge skills object
        existing.skills = { ...existing.skills, ...operation.value.skills };
      } else {
        existing[field] = operation.value[field];
      }
    });
    
    return { accepted: true, operation, result: existing };
  }
}
```

### 5.3 Redis Data Model

```javascript
// Campaign state
campaign:{code}:state → { /* full state JSON */ }

// Operation log (sorted set by timestamp)
campaign:{code}:operations → [operation1, operation2, ...]

// Client presence
campaign:{code}:clients → Set of clientIds

// Client metadata
client:{id}:metadata → { name, role, lastSeen }
client:{id}:campaign → campaignCode

// Version vectors per client
client:{id}:version → { /* version vector */ }
```

### 5.4 Server REST API (Fallback)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/campaigns` | POST | Create/sync campaign via HTTP |
| `/campaigns/:code` | GET | Get full campaign state |
| `/campaigns/:code` | DELETE | Delete campaign |
| `/campaigns/:code/operations` | GET | Get operation log since version |
| `/campaigns/:code/check` | GET | Check if campaign exists |
| `/health` | GET | Server health check |

---

## 6. Client Integration

### 6.1 New Core Module: `js/core/sync.js`

```javascript
import { getState, mergeState, saveState } from './state.js';
import { showToast } from '../components/Toast.js';

class SyncManager {
  constructor() {
    this.socket = null;
    this.campaignCode = null;
    this.clientId = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.offlineQueue = [];
    this.operationIdCounter = 0;
    this.versionVector = {};
    this.subscribers = [];
    this.serverUrl = null;
  }
  
  connect(serverUrl, campaignCode, password) {
    // Normalize URL
    const wsUrl = serverUrl.replace(/^http/, 'ws') + `/${campaignCode}`;
    this.serverUrl = serverUrl;
    this.campaignCode = campaignCode;
    
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        // Send handshake
        this.send({
          type: 'handshake',
          campaignCode,
          password,
          clientName: this.getClientName(),
          role: this.getClientRole()
        });
        resolve();
      };
      
      this.socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };
      
      this.socket.onclose = () => {
        this.isConnected = false;
        this.handleReconnect();
        reject(new Error('Connection closed'));
      };
      
      this.socket.onerror = (error) => {
        reject(error);
      };
    });
  }
  
  handleMessage(message) {
    switch (message.type) {
      case 'handshake_ack':
        this.handleHandshakeAck(message);
        break;
      case 'operation':
        this.handleOperation(message);
        break;
      case 'sync_response':
        this.handleSyncResponse(message);
        break;
      case 'presence':
        this.handlePresence(message);
        break;
      case 'chat_message':
        this.handleChatMessage(message);
        break;
      case 'roll_result':
        this.handleRollResult(message);
        break;
      case 'error':
        this.handleError(message);
        break;
    }
  }
  
  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      this.offlineQueue.push(message);
      showToast('Offline: changes will sync when reconnected', 'warning');
    }
  }
  
  broadcast(operation) {
    operation.id = this.generateOperationId();
    operation.clientId = this.clientId;
    operation.timestamp = Date.now();
    operation.version = this.versionVector;
    
    this.send({
      type: 'operation',
      operation
    });
    
    // Optimistically apply locally
    this.applyOperation(operation);
  }
  
  applyOperation(operation) {
    import('./state.js').then(module => {
      switch (operation.type) {
        case 'add_character':
          module.addCharacter(operation.value);
          break;
        case 'update_character':
          module.updateCharacter(operation.path[0], operation.value);
          break;
        case 'delete_character':
          module.deleteCharacter(operation.path[0]);
          break;
        case 'add_timer':
          module.addTimer(operation.value);
          break;
        case 'tick_timer':
          module.tickTimer(operation.path[0]);
          break;
        case 'add_wiki_entry':
          module.addWikiEntry(operation.value);
          break;
        case 'update_wiki_entry':
          module.updateWikiEntry(operation.path[0], operation.value);
          break;
        case 'add_chat_message':
          module.addChatMessage(operation.value);
          break;
        case 'add_roll':
          module.addRollResult(operation.value);
          break;
        case 'add_encounter':
          module.addEncounter(operation.value);
          break;
        case 'update_encounter':
          module.updateEncounter(operation.path[0], operation.value);
          break;
        // Add more operation types as needed
        default:
          console.warn('Unknown operation type:', operation.type);
      }
      // Update version vector
      this.versionVector[operation.clientId] = operation.id;
      module.saveState();
    });
  }
  
  handleHandshakeAck(message) {
    this.clientId = message.clientId;
    // Merge remote state
    mergeState(message.currentState, message.versionVector);
    // Set presence
    this.updatePresenceList(message.activeClients);
    // Replay any pending operations
    this.offlineQueue = [];
    showToast(`Connected to campaign ${this.campaignCode}`, 'success');
  }
  
  handleOperation(message) {
    const operation = message.operation;
    // Check if we've already applied this operation
    if (this.versionVector[operation.clientId] >= operation.id) {
      return; // Already applied
    }
    // Apply remote operation
    this.applyOperation(operation);
  }
  
  updatePresenceList(clients) {
    document.dispatchEvent(new CustomEvent('presence_update', {
      detail: { clients }
    }));
  }
  
  getClientName() {
    return localStorage.getItem('fates-edge-client-name') || 'Anonymous';
  }
  
  getClientRole() {
    return localStorage.getItem('fates-edge-client-role') || 'player';
  }
  
  generateOperationId() {
    return ++this.operationIdCounter;
  }
  
  async handleReconnect() {
    if (this.reconnectAttempts > 5) {
      showToast('Unable to reconnect. Please try again.', 'error');
      return;
    }
    
    const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    setTimeout(() => {
      this.connect(this.serverUrl, this.campaignCode)
        .then(() => {
          // Replay offline queue
          this.offlineQueue.forEach(msg => this.send(msg));
          this.offlineQueue = [];
          showToast('Reconnected to campaign!', 'success');
        })
        .catch(() => {
          this.handleReconnect();
        });
    }, backoff);
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.campaignCode = null;
    this.clientId = null;
    showToast('Disconnected from campaign', 'info');
  }
  
  // Subscribe to sync events
  subscribe(eventType, callback) {
    this.subscribers.push({ eventType, callback });
  }
  
  // Get current connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      campaignCode: this.campaignCode,
      clientId: this.clientId,
      offlineQueueSize: this.offlineQueue.length
    };
  }
}

// Export singleton
export const syncManager = new SyncManager();
```

### 6.2 Feature Module Adaptation

#### Example: Characters Module

```javascript
// js/features/characters/index.js
import { syncManager } from '../../core/sync.js';
import { getState, addCharacter, updateCharacter, deleteCharacter, saveState } from '../../core/state.js';

// Track sync subscriptions
let syncSubscriptions = [];

// Modified add character with sync
export function addCharacterHandler(data) {
  const char = {
    id: generateId(),
    ...data,
    _syncVersion: Date.now()
  };
  
  // Add locally
  addCharacter(char);
  
  // Broadcast to others
  syncManager.broadcast({
    type: 'add_character',
    value: char
  });
  
  renderCharList();
  showToast(`Character ${char.name} added.`, 'success');
}

export function updateCharacterHandler(id, data) {
  // Update locally
  updateCharacter(id, data);
  
  // Broadcast to others
  syncManager.broadcast({
    type: 'update_character',
    path: [id],
    value: data
  });
  
  renderCharList();
}

export function deleteCharacterHandler(id) {
  const char = getCharacter(id);
  if (!char) return;
  
  // Delete locally
  deleteCharacter(id);
  
  // Broadcast to others
  syncManager.broadcast({
    type: 'delete_character',
    path: [id]
  });
  
  renderCharList();
  showToast(`Character ${char.name} deleted.`, 'info');
}

// Setup sync listeners
export function setupSyncListeners() {
  // Clean up old listeners
  syncSubscriptions.forEach(sub => {
    // Remove subscription if we had a way
  });
  syncSubscriptions = [];
  
  // Listen for remote operations
  const addSub = syncManager.subscribe('add_character', (operation) => {
    const state = getState();
    if (!state.characters.find(c => c.id === operation.value.id)) {
      state.characters.push(operation.value);
      saveState();
      renderCharList();
      showToast(`Remote: ${operation.value.name} added`, 'info');
    }
  });
  syncSubscriptions.push(addSub);
  
  const updateSub = syncManager.subscribe('update_character', (operation) => {
    const state = getState();
    const idx = state.characters.findIndex(c => c.id === operation.path[0]);
    if (idx >= 0) {
      state.characters[idx] = { ...state.characters[idx], ...operation.value };
      saveState();
      renderCharList();
    }
  });
  syncSubscriptions.push(updateSub);
  
  const deleteSub = syncManager.subscribe('delete_character', (operation) => {
    const state = getState();
    const idx = state.characters.findIndex(c => c.id === operation.path[0]);
    if (idx >= 0) {
      const deleted = state.characters[idx];
      state.characters.splice(idx, 1);
      saveState();
      renderCharList();
      showToast(`Remote: ${deleted.name} deleted`, 'info');
    }
  });
  syncSubscriptions.push(deleteSub);
}

// Modify the module's render function
export function render(el) {
  container = el;
  // ... existing render code ...
  
  // Setup sync listeners
  setupSyncListeners();
  
  // ... rest of render ...
}

// Clean up when module is destroyed
export function destroy() {
  // Clean up sync subscriptions
  syncSubscriptions.forEach(sub => {
    // Remove subscription if we had a way
  });
  syncSubscriptions = [];
}
```

### 6.3 State Merge Strategy

```javascript
// js/core/state.js - New merge function

let pendingConflicts = [];

export function mergeState(remoteState, version) {
  // 1. Create a conflict set
  const conflicts = [];
  
  // 2. Merge characters
  if (remoteState.characters) {
    remoteState.characters.forEach(remoteChar => {
      const localChar = state.characters.find(c => c.id === remoteChar.id);
      if (localChar) {
        // Check if local version is newer
        if (localChar._syncVersion > (remoteChar._syncVersion || 0)) {
          conflicts.push({
            type: 'character',
            id: remoteChar.id,
            local: localChar,
            remote: remoteChar,
            resolution: 'pending'
          });
        } else {
          // Remote is newer or same version
          const idx = state.characters.indexOf(localChar);
          state.characters[idx] = remoteChar;
        }
      } else {
        // New character from remote
        state.characters.push(remoteChar);
      }
    });
  }
  
  // 3. Merge timers
  if (remoteState.timers) {
    remoteState.timers.forEach(remoteTimer => {
      const localTimer = state.timers.find(t => t.id === remoteTimer.id);
      if (localTimer) {
        // Timers: most recent tick wins
        if (remoteTimer.lastTick > (localTimer.lastTick || 0)) {
          const idx = state.timers.indexOf(localTimer);
          state.timers[idx] = remoteTimer;
        }
      } else {
        state.timers.push(remoteTimer);
      }
    });
  }
  
  // 4. Merge wiki entries
  if (remoteState.wikiEntries) {
    remoteState.wikiEntries.forEach(remoteEntry => {
      const localEntry = state.wikiEntries.find(w => w.id === remoteEntry.id);
      if (localEntry) {
        // Wiki: use latest edit
        if (remoteEntry.lastEdited > (localEntry.lastEdited || 0)) {
          const idx = state.wikiEntries.indexOf(localEntry);
          state.wikiEntries[idx] = remoteEntry;
        }
      } else {
        state.wikiEntries.push(remoteEntry);
      }
    });
  }
  
  // 5. Merge chat (append-only)
  if (remoteState.chatHistory) {
    // Only add messages we don't have
    const localIds = new Set(state.chatHistory.map(m => m.id));
    remoteState.chatHistory.forEach(msg => {
      if (!localIds.has(msg.id)) {
        state.chatHistory.push(msg);
      }
    });
    // Keep chat history under limit
    if (state.chatHistory.length > 200) {
      state.chatHistory = state.chatHistory.slice(-200);
    }
  }
  
  // 6. Handle conflicts (show to user for resolution)
  if (conflicts.length > 0) {
    pendingConflicts = conflicts;
    document.dispatchEvent(new CustomEvent('syncConflict', {
      detail: { conflicts }
    }));
  }
  
  // 7. Update version
  state._version = version;
  state._lastSync = Date.now();
  saveState();
}

// Resolve conflicts
export function resolveConflict(conflictId, choice) {
  const conflict = pendingConflicts.find(c => c.id === conflictId);
  if (!conflict) return;
  
  switch (choice) {
    case 'local':
      // Keep local version
      break;
    case 'remote':
      // Use remote version
      const idx = state.characters.indexOf(conflict.local);
      state.characters[idx] = conflict.remote;
      break;
    case 'merge':
      // Deep merge
      const merged = { ...conflict.local, ...conflict.remote };
      merged._syncVersion = Math.max(
        conflict.local._syncVersion || 0,
        conflict.remote._syncVersion || 0
      ) + 1;
      const mergeIdx = state.characters.indexOf(conflict.local);
      state.characters[mergeIdx] = merged;
      break;
  }
  
  // Remove resolved conflict
  pendingConflicts = pendingConflicts.filter(c => c.id !== conflictId);
  saveState();
}

export function getPendingConflicts() {
  return pendingConflicts;
}
```

### 6.4 UI Indicators

#### Connection Status Component

```javascript
// js/components/ConnectionStatus.js
export function createConnectionStatus() {
  const div = document.createElement('div');
  div.className = 'connection-status';
  div.innerHTML = `
    <span class="status-icon">●</span>
    <span class="status-label">Disconnected</span>
    <span class="campaign-code"></span>
  `;
  
  const icon = div.querySelector('.status-icon');
  const label = div.querySelector('.status-label');
  const code = div.querySelector('.campaign-code');
  
  // Listen to sync events
  document.addEventListener('presence_update', (e) => {
    const connected = e.detail.clients && e.detail.clients.length > 0;
    icon.style.color = connected ? 'var(--green)' : 'var(--red)';
    label.textContent = connected ? 'Connected' : 'Disconnected';
  });
  
  // Update via sync manager status
  function updateStatus() {
    import('../../core/sync.js').then(module => {
      const status = module.syncManager.getStatus();
      icon.style.color = status.isConnected ? 'var(--green)' : 'var(--red)';
      label.textContent = status.isConnected ? 'Connected' : 'Disconnected';
      code.textContent = status.campaignCode || '';
    });
  }
  
  // Update status periodically
  setInterval(updateStatus, 5000);
  updateStatus();
  
  return div;
}
```

---

## 7. User Experience Design

### 7.1 UI Changes

#### Settings Panel Additions

```
┌─────────────────────────────────────────────────────────────┐
│ 🌐 Live Campaign                                         │
├─────────────────────────────────────────────────────────────┤
│  Server URL: [http://localhost:3000  ]                    │
│  Campaign Code: [ABC123    ] [Connect] [Disconnect]       │
│                                                           │
│  ● Connected · 3 players online                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  GM Nick (you)            🟢 5 mins ago            │   │
│  │  Player Alice             🟢 2 mins ago            │   │
│  │  Player Bob               🟡 15 mins ago           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                           │
│  ⚙️ Sync Settings:                                        │
│  [x] Auto-sync changes                                    │
│  [x] Show presence indicators                             │
│  [ ] Share dice rolls with all players                    │
└─────────────────────────────────────────────────────────────┘
```

#### Presence Indicators

```
┌──────────────────────────────────────────────────────────┐
│ 📊 Dashboard                                            │
├──────────────────────────────────────────────────────────┤
│  Active Players (3)                                     │
│  ● GM Nick  ● Player Alice  ● Player Bob               │
│                                                         │
│  Recently Changed:                                      │
│  🟢 Alice just updated character "Thorn"               │
│  🟢 Bob just rolled 3 successes on lockpick             │
└──────────────────────────────────────────────────────────┘
```

#### Conflict Resolution Dialog

```
┌──────────────────────────────────────────────────────────┐
│ ⚠️ Sync Conflict Detected                               │
├──────────────────────────────────────────────────────────┤
│  Character "Thorn" was edited by two GMs.               │
│                                                         │
│  ┌───────────────┐  ┌───────────────┐                  │
│  │  Your version │  │  Remote       │                  │
│  │  Body: 4      │  │  Body: 3     │                  │
│  │  Wits: 3      │  │  Wits: 4     │                  │
│  └───────────────┘  └───────────────┘                  │
│                                                         │
│  [Keep Yours] [Use Remote] [Merge Both]                 │
└──────────────────────────────────────────────────────────┘
```

### 7.2 User Roles and Permissions

| Role | Can Create/Edit | Can Delete | Can Kick | Can Change Settings |
|------|-----------------|------------|----------|---------------------|
| **GM** | ✅ Everything | ✅ Everything | ✅ Yes | ✅ Yes |
| **Player** | ✅ Own characters | ✅ Own characters | ❌ No | ❌ No |
| **Observer** | ❌ Read only | ❌ No | ❌ No | ❌ No |

### 7.3 Real-Time Feedback

| Action | UI Feedback |
|--------|-------------|
| Another user joins | Toast notification + presence update |
| Another user edits | Flash on affected UI element |
| Conflict detected | Modal dialog with merge options |
| Connection lost | Banner warning + offline indicator |
| Reconnected | Toast notification + sync progress |

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1-2)

| Task | Description | Priority |
|------|-------------|----------|
| Server setup | Node.js + Express + ws library | Critical |
| Connection manager | Client tracking, rooms, handshakes | Critical |
| Operation log | Store operations in Redis | Critical |
| Basic sync | Full-state sync on connect | High |

### Phase 2: Operation Sync (Week 3-4)

| Task | Description | Priority |
|------|-------------|----------|
| Operation definitions | Define all operation types | Critical |
| Conflict resolver | Basic last-write-wins | High |
| Broadcast logic | Send operations to all clients | Critical |
| Version vectors | Track client versions | High |

### Phase 3: Offline Support (Week 5-6)

| Task | Description | Priority |
|------|-------------|----------|
| Offline queue | Store operations when disconnected | High |
| Reconnection | Auto-reconnect with backoff | High |
| IndexedDB | Persist offline queue | High |
| Operation replay | Play back queued operations | High |

### Phase 4: UI & UX (Week 7-8)

| Task | Description | Priority |
|------|-------------|----------|
| Connection status | Widget in sidebar | High |
| Presence indicators | Show online users | Medium |
| Conflict UI | Modal for resolving conflicts | Medium |
| Notifications | Toast for remote changes | High |

### Phase 5: Polish & Production (Week 9-10)

| Task | Description | Priority |
|------|-------------|----------|
| HTTPS/WSS | SSL certificates | Critical |
| Rate limiting | Prevent abuse | High |
| Monitoring | Logging, metrics | Medium |
| Documentation | User and developer docs | Medium |
| Testing | Load testing, edge cases | High |

---

## 9. Deployment Architecture

### 9.1 Production Setup

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                            │
└─────────────────────────────────────────────────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │   Load Balancer     │
                   │  (nginx/HAProxy)   │
                   └──────────┬──────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
       ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
       │  Server 1   │ │  Server 2   │ │  Server 3   │
       │  (Node.js)  │ │  (Node.js)  │ │  (Node.js)  │
       └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
                   ┌──────────▼──────────┐
                   │     Redis Cluster   │
                   └──────────┬──────────┘
                              │
                   ┌──────────▼──────────┐
                   │    PostgreSQL       │
                   │   (State Snapshots) │
                   └─────────────────────┘
```

### 9.2 Scaling Considerations

| Aspect | Strategy |
|--------|----------|
| **Connections** | Horizontal scaling with sticky sessions |
| **State** | Redis for ephemeral state, PostgreSQL for persistence |
| **Broadcast** | Redis Pub/Sub for cross-server messages |
| **Offline Queue** | Client-side IndexedDB |
| **Rate Limiting** | Per-IP and per-campaign limits |

### 9.3 Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000
WS_PORT=3001

# Database
REDIS_URL=redis://localhost:6379
POSTGRES_URL=postgres://user:pass@localhost:5432/fatesedge

# Security
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=https://yourdomain.com

# Campaign Settings
MAX_CLIENTS_PER_CAMPAIGN=10
MAX_STATE_SIZE_MB=5
CAMPAIGN_EXPIRY_DAYS=30
```

---

## 10. Security Considerations

### 10.1 Authentication & Authorization

| Layer | Method |
|-------|--------|
| **Connection** | Password hash matching (same as toolkit) |
| **Session** | JWT token after handshake |
| **Messages** | Each operation includes client ID |
| **Campaign Access** | Only clients with campaign code can join |

### 10.2 Data Protection

| Concern | Solution |
|---------|----------|
| **In Transit** | WSS (WebSocket Secure) |
| **At Rest** | Redis/PostgreSQL with encryption at rest |
| **Validation** | Server-side schema validation of all operations |
| **Rate Limiting** | Prevent flooding/DDOS |

### 10.3 Operation Validation

```javascript
function validateOperation(op) {
  // 1. Check signature (if using JWT)
  // 2. Validate schema
  // 3. Check path exists
  // 4. Validate value types
  // 5. Check dependencies exist
  // 6. Verify client has permission
  return true; // or throw
}
```

---

## 11. Performance Targets

| Metric | Target |
|--------|--------|
| **Latency** | < 100ms for operation roundtrip |
| **Throughput** | 1000 concurrent connections per server |
| **Sync Speed** | < 2s for full state sync |
| **Operation Size** | < 10KB per operation |
| **Client State** | < 5MB for full campaign |
| **Reconnection** | < 3s after network recovery |

---

## 12. Monitoring & Observability

### 12.1 Metrics to Track

| Category | Metrics |
|----------|---------|
| **Connections** | Active connections, connection rate, disconnections |
| **Operations** | Operation rate, latency, conflict rate |
| **Users** | Active campaigns, users per campaign |
| **Performance** | Memory usage, CPU, Redis latency |
| **Errors** | Rejection rate, timeout rate, exception rate |

### 12.2 Logging Schema

```javascript
{
  timestamp: '2026-07-09T10:00:00Z',
  level: 'info' | 'warn' | 'error',
  source: 'connection_manager' | 'operation_processor' | 'conflict_resolver',
  campaignCode: 'ABC123',
  clientId: 'uuid',
  operationId: 'op-123',
  message: 'Operation processed successfully',
  metadata: { /* additional context */ }
}
```

---

## 13. Testing Strategy

### 13.1 Unit Tests

```javascript
// Example test for conflict resolver
describe('ConflictResolver', () => {
  test('should handle concurrent character edits', async () => {
    const resolver = new ConflictResolver();
    const op1 = { type: 'update_character', path: ['char1'], value: { name: 'Alice' } };
    const op2 = { type: 'update_character', path: ['char1'], value: { name: 'Bob' } };
    
    const result = await resolver.resolve(op1, op2);
    expect(result.accepted).toBe(true);
    expect(result.result.name).toBe('Bob'); // Last write wins
  });
});
```

### 13.2 Integration Tests

```javascript
// Example WebSocket integration test
describe('WebSocket Integration', () => {
  test('should sync state between two clients', async () => {
    const client1 = await connectToCampaign('TEST123');
    const client2 = await connectToCampaign('TEST123');
    
    // Client 1 creates a character
    await client1.send({ type: 'add_character', value: { name: 'Thorn' } });
    
    // Client 2 should receive it
    const message = await client2.waitForMessage('operation');
    expect(message.value.name).toBe('Thorn');
  });
});
```

### 13.3 Load Testing

| Scenario | Target | Tool |
|----------|--------|------|
| **Connection** | 1000 concurrent connections | Artillery |
| **Operation** | 100 ops/sec per campaign | k6 |
| **Reconnection** | 500 clients reconnecting | Custom script |

---

## 14. Rollback & Migration Plan

### 14.1 Schema Versioning

```javascript
const MIGRATIONS = [
  {
    version: 1,
    up: (state) => { /* initial state */ },
    down: (state) => { /* revert */ }
  },
  {
    version: 2,
    up: (state) => { /* add new field */ },
    down: (state) => { /* remove field */ }
  }
];
```

### 14.2 Backward Compatibility

| Scenario | Strategy |
|----------|----------|
| **Old client connects** | Server sends minimum supported version |
| **Version mismatch** | Redirect to reload page |
| **Manual sync still works** | HTTP fallback remains |
| **Data migration** | Automatic migration on load |

---

## 15. Glossary

| Term | Definition |
|------|------------|
| **CRDT** | Conflict-Free Replicated Data Type - a data structure that naturally merges |
| **OT** | Operational Transformation - algorithm for collaborative editing |
| **Version Vector** | Data structure tracking operations seen by each client |
| **Campaign** | A group of users sharing state via a code |
| **Presence** | Awareness of other users being online |
| **Conflict** | Two users modifying the same data simultaneously |

---

## 16. Next Steps

### Immediate Actions
1. ✅ Review and approve this design document
2. ✅ Set up development server with WebSocket support
3. ✅ Implement Phase 1 (Foundation)
4. 🔜 Schedule weekly progress reviews

### Future Enhancements
1. **Voice/Video integration** - WebRTC for live sessions
2. **Whiteboard** - Shared drawing/mapping canvas
3. **PDF Export** - Collaborative PDF generation
4. **Version History** - Time-travel through campaign state
5. **Mobile Companion App** - iOS/Android native app

---

## 17. References

### Documentation
- [WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455)
- [Operational Transformation](https://en.wikipedia.org/wiki/Operational_transformation)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

### Similar Tools
- [Foundry VTT](https://foundryvtt.com/) - Self-hosted VTT
- [Owlbear Rodeo](https://www.owlbear.rodeo/) - Lightweight VTT
- [Roll20](https://roll20.net/) - Commercial VTT
- [D&D Beyond](https://www.dndbeyond.com/) - Character management

### Libraries
- `ws` - WebSocket implementation
- `uWebSockets.js` - High-performance alternative
- `socket.io` - Higher-level WebSocket abstraction
- `Yjs` - CRDT-based collaboration framework

---

## 18. Appendix A: Operation Types Reference

```javascript
// Character Operations
{
  type: 'add_character',
  value: { /* full character object */ }
}

{
  type: 'update_character',
  path: ['characterId'],
  value: { /* partial update */ }
}

{
  type: 'delete_character',
  path: ['characterId']
}

// Timer Operations
{
  type: 'add_timer',
  value: { /* timer object */ }
}

{
  type: 'tick_timer',
  path: ['timerId']
}

// Wiki Operations
{
  type: 'add_wiki_entry',
  value: { /* wiki entry */ }
}

{
  type: 'update_wiki_entry',
  path: ['entryId'],
  value: { /* partial update */ }
}

// VTT Operations
{
  type: 'chat_message',
  value: { sender, text, timestamp }
}

{
  type: 'roll_result',
  value: { /* roll result object */ }
}

// Encounter Operations
{
  type: 'add_encounter',
  value: { /* encounter object */ }
}

{
  type: 'update_encounter',
  path: ['encounterId'],
  value: { /* partial update */ }
}

// Settings Operations
{
  type: 'update_settings',
  path: ['settingPath'],
  value: { /* new value */ }
}
```

---

## 19. Appendix B: Message Flow Examples

### Connection Flow

```
Client → Server: { type: 'handshake', campaignCode, password, clientName }
Server → Client: { type: 'handshake_ack', success: true, state, clients }

Client → Server: { type: 'operation', operation: { type: 'add_character', value } }
Server → Client: { type: 'operation_ack', id: 'op-123', success: true }

Server → All Clients: { type: 'operation', operation: { type: 'add_character', value } }
```

### Conflict Flow

```
Client A → Server: { type: 'operation', operation: { type: 'update_character', path: ['c1'], value: { name: 'Alice' } } }
Client B → Server: { type: 'operation', operation: { type: 'update_character', path: ['c1'], value: { name: 'Bob' } } }

Server: Conflict detected
Server → Client A: { type: 'conflict', operationId: 'op-456', suggestion: { name: 'Bob' } }
Server → Client B: { type: 'operation_ack', operationId: 'op-789', success: true }
Server → All Clients: { type: 'operation', operation: { type: 'update_character', path: ['c1'], value: { name: 'Bob' } } }
```

### Offline Flow

```
Client A → Server: { operation }
Client A: Disconnects
Client A: { operation } → (queued offline)
Client A: Reconnects
Client A → Server: { handshake }
Server → Client A: { pendingOperations: [ operation ] }
Server → All Clients: { operation }
```

---

## 20. Appendix C: Development Setup

### Local Development

```bash
# Clone repository
git clone https://github.com/yourusername/fates-edge-toolkit.git
cd fates-edge-toolkit

# Install dependencies
npm install

# Start Redis (using Docker)
docker run -d -p 6379:6379 redis

# Start PostgreSQL (using Docker)
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres

# Run server
npm run server

# Run client (Vite)
npm run dev

# Run tests
npm test

# Run load tests
npm run test:load
```

### Environment Setup

```bash
# .env file
NODE_ENV=development
PORT=3000
WS_PORT=3001
REDIS_URL=redis://localhost:6379
POSTGRES_URL=postgres://postgres:password@localhost:5432/fatesedge
JWT_SECRET=dev_secret_key
CORS_ORIGIN=http://localhost:5173
```

---

## 21. Appendix D: Real-Time Collaboration Examples

### 21.1 Scenario: Two GMs Editing Characters

```
Time 0: Client A and Client B both have state with character "Thorn" (Body: 3, Wits: 2)

Time 1: Client A edits Thorn's Body to 4
  → Operation: { type: 'update_character', path: ['thorn'], value: { body: 4 } }
  → Server receives, applies, broadcasts

Time 2: Client B edits Thorn's Wits to 3
  → Operation: { type: 'update_character', path: ['thorn'], value: { wits: 3 } }
  → Server receives, applies (no conflict since different fields), broadcasts

Time 3: Both clients receive both operations
  → Client A: Body: 4, Wits: 3
  → Client B: Body: 4, Wits: 3
  → No conflict, both are in sync
```

### 21.2 Scenario: Conflict Resolution

```
Time 0: Client A and Client B both have character "Thorn" (Body: 3)

Time 1: Client A edits Thorn's Body to 4
  → Operation: { type: 'update_character', path: ['thorn'], value: { body: 4 } }
  → Server receives, applies, broadcasts

Time 2: Client B edits Thorn's Body to 5 (before receiving Client A's change)
  → Operation: { type: 'update_character', path: ['thorn'], value: { body: 5 } }
  → Server receives, detects conflict (same field, different values)
  → Server resolves: Last-write-wins (Client B's change is newer)
  → Server broadcasts Client B's change
  → Server sends conflict notification to Client A

Time 3: Client A receives conflict notification
  → UI shows conflict dialog: "Thorn's Body was changed by Client B from 4 to 5"
  → Options: [Keep Yours (4)] [Use Remote (5)] [Merge (Use 5)]
  → Client A chooses to keep theirs (4) → sends override
  → Server receives override, applies, broadcasts
  → Both clients now have Thorn with Body: 4
```

---

## 22. Quick Wins & Easy Features

Based on the current architecture and your existing WebSocket server, here are features that can be implemented quickly and easily:

### 22.1 Immediate Implementation Opportunities

#### 1. **Basic Presence Detection** (1-2 days)
- Show who's online in a campaign
- Display connection status in UI
- Simple "user joined/left" notifications

#### 2. **Real-Time Chat** (2-3 days)
- Send/receive chat messages via WebSocket
- Show message history
- User avatars/identifiers

#### 3. **Dice Roll Broadcasting** (1-2 days)
- Broadcast dice rolls to all connected clients
- Show roll history in chat
- Visual dice roll animations

#### 4. **Character Sheet Sync** (3-5 days)
- Sync character changes in real-time
- Show "user is typing" indicators
- Basic conflict detection for same-field edits

#### 5. **Timer Sync** (2-3 days)
- Shared timers that tick for all users
- Visual timer progress bars
- Timer completion notifications

### 22.2 Medium-Effort Features (1-2 weeks)

#### 6. **Campaign Management UI**
- Create/join campaigns via UI (not just manual codes)
- Campaign password management
- User role assignment (GM/Player/Observer)

#### 7. **Enhanced State Sync**
- Incremental state updates (not full sync)
- Version tracking for conflict detection
- Offline queue for disconnected users

#### 8. **VTT Integration**
- Sync encounter/NPC changes
- Shared initiative tracker
- Real-time map/token updates

#### 9. **Wiki Collaboration**
- Real-time wiki editing
- Edit conflict resolution
- Version history for wiki entries

### 22.3 Implementation Strategy

#### Phase 1: Foundation (Week 1)
1. Basic WebSocket connection management
2. Presence detection and UI indicators
3. Simple chat functionality
4. Connection status widget

#### Phase 2: Core Features (Week 2-3)
1. Character sheet sync with basic conflict detection
2. Dice roll broadcasting
3. Timer synchronization
4. Campaign management UI

#### Phase 3: Enhancement (Week 4-5)
1. Offline support with operation queue
2. Enhanced conflict resolution UI
3. VTT integration
4. Wiki collaboration features

### 22.4 Technical Approach for Quick Wins

#### WebSocket Client Connection
```javascript
// Simple connection setup
const socket = new WebSocket('ws://localhost:3000/campaign/ABC123');

socket.onopen = () => {
  // Authenticate with API key
  socket.send(JSON.stringify({
    type: 'authenticate',
    apiKey: localStorage.getItem('apiKey')
  }));
  
  // Join campaign
  socket.send(JSON.stringify({
    type: 'join-room',
    roomCode: 'ABC123',
    clientData: {
      name: localStorage.getItem('userName') || 'Player',
      role: 'player'
    }
  }));
};

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  switch (message.type) {
    case 'chat-message':
      displayChatMessage(message);
      break;
    case 'roll-result':
      displayRollResult(message);
      break;
    case 'presence':
      updatePresenceList(message.clients);
      break;
  }
};
```

#### Basic Chat Implementation
```javascript
// Send chat message
function sendChatMessage(text) {
  socket.send(JSON.stringify({
    type: 'chat-message',
    message: {
      text: text,
      sender: localStorage.getItem('userName'),
      timestamp: Date.now()
    }
  }));
}

// Display chat message
function displayChatMessage(msg) {
  const chatContainer = document.getElementById('chat-messages');
  const messageEl = document.createElement('div');
  messageEl.className = 'chat-message';
  messageEl.innerHTML = `
    <span class="sender">${msg.sender}</span>
    <span class="text">${msg.text}</span>
    <span class="time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
  `;
  chatContainer.appendChild(messageEl);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
```

These quick wins will provide immediate value to users while building the foundation for more advanced collaborative features.

---

**Document Version:** 1.1  
**Last Updated:** 2026-07-13  
**Approved By:** [ ]  

---

*"Fortune favors the bold, but the wise know when to fold." — Captain Livia Vex*