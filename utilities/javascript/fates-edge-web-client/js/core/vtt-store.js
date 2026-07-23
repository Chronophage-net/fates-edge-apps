/**
 * Reactive store for VTT state.
 * All state mutations go through this store, and UI components subscribe to slices.
 * 
 * v2 – Added character selection and avatar support.
 */

class VTTStore {
  constructor() {
    this.state = {
      chatMessages: [],
      characters: [],
      timers: [],
      voiceClients: [],        // { id, name, speaking, connectionState }
      presence: [],            // derived from characters + connection
      connectionStatus: 'local', // 'local' | 'connected'
      selectedCharacterId: null, // [VTT SELECTION] ID of the currently selected character
    };
    this.subscribers = new Map(); // key -> Set of callbacks
    this._nextId = 1;
  }

  /**
   * Subscribe to a state slice.
   * @param {string} key - one of the state keys
   * @param {function} callback - receives current value immediately and on every change
   * @returns {function} unsubscribe function
   */
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);
    // Immediately call with current value
    callback(this.state[key]);
    return () => {
      const set = this.subscribers.get(key);
      if (set) set.delete(callback);
    };
  }

  /**
   * Update one or more state keys.
   * @param {object} updates - partial state object
   */
  setState(updates) {
    const changedKeys = [];
    for (const [key, value] of Object.entries(updates)) {
      if (this.state[key] !== value) {
        this.state[key] = value;
        changedKeys.push(key);
      }
    }
    // Notify subscribers
    for (const key of changedKeys) {
      if (this.subscribers.has(key)) {
        const callbacks = this.subscribers.get(key);
        callbacks.forEach(cb => cb(this.state[key]));
      }
    }
  }

  // ----- Convenience methods -----

  addChatMessage(msg) {
    const messages = [...this.state.chatMessages, msg];
    this.setState({ chatMessages: messages });
  }

  clearChat() {
    this.setState({ chatMessages: [] });
  }

  updateCharacters(chars) {
    this.setState({ characters: chars });
    // Also update presence (derived)
    this._updatePresence();
  }

  updateTimers(timers) {
    this.setState({ timers: timers });
  }

  updateVoiceClients(clients) {
    this.setState({ voiceClients: clients });
  }

  setConnectionStatus(status) {
    this.setState({ connectionStatus: status });
    this._updatePresence();
  }

  // ----- [VTT SELECTION] Character selection -----

  /**
   * Select a character by ID.
   * @param {string|null} id - character ID, or null to deselect
   */
  selectCharacter(id) {
    const chars = this.state.characters || [];
    if (id !== null && !chars.some(c => c.id === id)) {
      console.warn('[VTTStore] Character not found:', id);
      return;
    }
    this.setState({ selectedCharacterId: id });
    // Dispatch a custom event for other parts of the UI to react
    const selectedChar = id ? chars.find(c => c.id === id) : null;
    document.dispatchEvent(new CustomEvent('characterSelected', {
      detail: { character: selectedChar, id }
    }));
  }

  /**
   * Get the currently selected character object, or null if none.
   */
  getSelectedCharacter() {
    const id = this.state.selectedCharacterId;
    if (!id) return null;
    const chars = this.state.characters || [];
    return chars.find(c => c.id === id) || null;
  }

  /**
   * Get the selected character ID, or null.
   */
  getSelectedCharacterId() {
    return this.state.selectedCharacterId;
  }

  // Internal: derive presence from characters + connection status
  _updatePresence() {
    const chars = this.state.characters || [];
    const connected = this.state.connectionStatus === 'connected';
    const presence = chars
      .filter(c => c.vtt !== false)
      .map(c => ({
        id: c.id || c.name,
        name: c.name || 'Unnamed',
        online: connected,
        tier: c.tier || 'Player',
        avatar: c.avatar || null, // [VTT SELECTION] Include avatar
      }));
    this.setState({ presence });
  }
}

export const vttStore = new VTTStore();