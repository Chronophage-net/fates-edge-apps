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
      voiceClients: [],
      presence: [],
      connectionStatus: 'local',
      selectedCharacterId: null,
    };
    this.subscribers = new Map();
    this._nextId = 1;
  }

  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);
    callback(this.state[key]);
    return () => {
      const set = this.subscribers.get(key);
      if (set) set.delete(callback);
    };
  }

  setState(updates) {
    const changedKeys = [];
    for (const [key, value] of Object.entries(updates)) {
      if (this.state[key] !== value) {
        this.state[key] = value;
        changedKeys.push(key);
      }
    }
    for (const key of changedKeys) {
      if (this.subscribers.has(key)) {
        const callbacks = this.subscribers.get(key);
        callbacks.forEach(cb => cb(this.state[key]));
      }
    }
  }

  addChatMessage(msg) {
    const messages = [...this.state.chatMessages, msg];
    this.setState({ chatMessages: messages });
  }

  clearChat() {
    this.setState({ chatMessages: [] });
  }

  updateCharacters(chars) {
    this.setState({ characters: chars });
    // Only fall back to deriving "who's here" from the local character roster
    // when there's no real connection -- once connected, the actual presence
    // list (real clients, real online status) comes from the server via
    // updatePresence() below, and must not be clobbered by this periodic call.
    if (this.state.connectionStatus !== 'connected') {
      this._updatePresence();
    }
  }

  /** Set presence from real data (e.g. the websocket 'presence' event). */
  updatePresence(list) {
    this.setState({ presence: list || [] });
  }

  updateTimers(timers) {
    this.setState({ timers: timers });
  }

  updateVoiceClients(clients) {
    this.setState({ voiceClients: clients });
  }

  setConnectionStatus(status) {
    this.setState({ connectionStatus: status });
    if (status !== 'connected') {
      this._updatePresence();
    }
  }

  selectCharacter(id) {
    const chars = this.state.characters || [];
    if (id !== null && !chars.some(c => c.id === id)) {
      console.warn('[VTTStore] Character not found:', id);
      return;
    }
    this.setState({ selectedCharacterId: id });
    const selectedChar = id ? chars.find(c => c.id === id) : null;
    document.dispatchEvent(new CustomEvent('characterSelected', {
      detail: { character: selectedChar, id }
    }));
  }

  getSelectedCharacter() {
    const id = this.state.selectedCharacterId;
    if (!id) return null;
    const chars = this.state.characters || [];
    return chars.find(c => c.id === id) || null;
  }

  getSelectedCharacterId() {
    return this.state.selectedCharacterId;
  }

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
        avatar: c.avatar || null,
      }));
    this.setState({ presence });
  }
}

export const vttStore = new VTTStore();
