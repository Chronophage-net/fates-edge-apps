/**
 * Offline Queue - Persists operations when disconnected
 * 
 * Stores operations in IndexedDB and replays them when reconnected
 */

const DB_NAME = 'fates-edge-sync';
const DB_VERSION = 1;
const STORE_NAME = 'offline-queue';

export class OfflineQueue {
  constructor() {
    this.db = null;
    this.queue = [];
    this.isPersisted = false;
    this.maxSize = 1000;
    this.init();
  }
  
  /**
   * Initialize IndexedDB
   */
  async init() {
    try {
      this.db = await this.openDatabase();
      this.queue = await this.loadQueue();
      this.isPersisted = true;
    } catch (e) {
      console.warn('IndexedDB not available, using memory queue:', e);
      this.isPersisted = false;
      this.queue = [];
    }
  }
  
  /**
   * Open IndexedDB database
   */
  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('type', 'type');
          store.createIndex('status', 'status');
        }
      };
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }
  
  /**
   * Load queue from IndexedDB
   */
  async loadQueue() {
    if (!this.db) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }
  
  /**
   * Enqueue an operation
   */
  async enqueue(item) {
    // Add to memory queue
    this.queue.push({
      ...item,
      queuedAt: Date.now(),
      status: 'pending'
    });
    
    // Trim queue
    if (this.queue.length > this.maxSize) {
      this.queue.splice(0, this.queue.length - this.maxSize);
    }
    
    // Persist to IndexedDB
    if (this.isPersisted && this.db) {
      try {
        await this.saveToDatabase(item);
      } catch (e) {
        console.warn('Failed to persist offline queue:', e);
      }
    }
  }
  
  /**
   * Save to database
   */
  saveToDatabase(item) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add({
        ...item,
        queuedAt: Date.now(),
        status: 'pending'
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Flush all pending operations
   * @param {Function} sendFn - Function to send each operation
   */
  async flush(sendFn) {
    const pending = this.queue.filter(item => item.status === 'pending');
    
    if (pending.length === 0) return;
    
    console.log(`Flushing ${pending.length} offline operations`);
    
    for (const item of pending) {
      try {
        await sendFn(item);
        item.status = 'sent';
      } catch (e) {
        console.warn('Failed to send offline operation:', e);
        // Keep in queue for retry
      }
    }
    
    // Remove sent items from queue
    this.queue = this.queue.filter(item => item.status !== 'sent');
    
    // Clear from database
    if (this.isPersisted && this.db) {
      await this.clearDatabase();
    }
  }
  
  /**
   * Clear database
   */
  clearDatabase() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get queue size
   */
  size() {
    return this.queue.length;
  }
  
  /**
   * Check if queue has pending items
   */
  hasPending() {
    return this.queue.some(item => item.status === 'pending');
  }
  
  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
    if (this.isPersisted && this.db) {
      this.clearDatabase();
    }
  }
}
