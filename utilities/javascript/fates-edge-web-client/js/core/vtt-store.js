/**
 * Reactive store for VTT state.
 * All state mutations go through this store, and UI components subscribe to slices.
 *
 * v2 – Added character selection and avatar support.
 * v3 – "Remote enabled": a client can drive more than one character at once
 *      (up to MAX_CONTROLLED_CHARACTERS), not just a single selection.
 */

// Mirrors server/security.js's MAX_CONTROLLED_CHARACTERS. Kept as a client-
// side constant too so the UI can stop a 7th selection locally instead of
// letting the server silently drop it after the fact.
export const MAX_CONTROLLED_CHARACTERS = 6;

class VTTStore {
  constructor() {
    this.state = {
      chatMessages: [],
      characters: [],
      timers: [],
      voiceClients: [],
      presence: [],
      connectionStatus: 'local',
      // `selectedCharacterId` stays the single "active sheet" -- the
      // character whose detail panel/tracker math is shown right now.
      // `selectedCharacterIds` is the broader "which characters is this
      // client claiming/driving" set used by Remote mode; when Remote is
      // off the two are always kept in lockstep (0 or 1 entries).
      selectedCharacterId: null,
      selectedCharacterIds: [],
      remoteEnabled: false,
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

  /** Patches an already-added chat message in place by id (e.g. an
   * Assistant GM suggestion card moving from 'pending' to 'approved' when
   * assistant-suggestion-resolved arrives -- see vtt-connected.js). A
   * no-op if the id isn't found (message scrolled out of maxChatMessages,
   * or belongs to a different session), since the underlying suggestion
   * itself is still correctly resolved server-side either way -- this
   * only affects how a past chat card displays it. */
  updateChatMessage(id, patch) {
    if (!id) return;
    let found = false;
    const messages = this.state.chatMessages.map(m => {
      if (m && m.id === id) { found = true; return { ...m, ...patch }; }
      return m;
    });
    if (found) this.setState({ chatMessages: messages });
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

  /**
   * Single-select: replaces whatever was selected before (Remote mode
   * off). Also resets `selectedCharacterIds` to match, so the two stay in
   * lockstep whenever the caller isn't using multi-select.
   */
  selectCharacter(id) {
    const chars = this.state.characters || [];
    if (id !== null && !chars.some(c => c.id === id)) {
      console.warn('[VTTStore] Character not found:', id);
      return;
    }
    this.setState({ selectedCharacterId: id, selectedCharacterIds: id ? [id] : [] });
    const selectedChar = id ? chars.find(c => c.id === id) : null;
    document.dispatchEvent(new CustomEvent('characterSelected', {
      detail: { character: selectedChar, id }
    }));
  }

  setRemoteEnabled(enabled) {
    this.setState({ remoteEnabled: !!enabled });
    if (!enabled) {
      // Dropping back to single-select: keep only the current "active"
      // character (if any) instead of leaving a stale multi-selection
      // the single-select UI can't represent.
      const first = this.state.selectedCharacterIds[0] || null;
      this.selectCharacter(first);
    }
  }

  isRemoteEnabled() {
    return !!this.state.remoteEnabled;
  }

  /**
   * Multi-select toggle for Remote mode: adds/removes `id` from
   * `selectedCharacterIds`, capped at MAX_CONTROLLED_CHARACTERS. The
   * first entry in the set is also treated as the "active" character
   * (selectedCharacterId) for anything that only knows about a single
   * selection (detail panel, combat tracker range math, etc.).
   * Returns false (and leaves state unchanged) if the cap would be
   * exceeded, so the caller can surface that to the user.
   */
  toggleCharacterSelection(id) {
    const chars = this.state.characters || [];
    if (!chars.some(c => c.id === id)) {
      console.warn('[VTTStore] Character not found:', id);
      return false;
    }
    const current = this.state.selectedCharacterIds || [];
    let next;
    if (current.includes(id)) {
      next = current.filter(cid => cid !== id);
    } else {
      if (current.length >= MAX_CONTROLLED_CHARACTERS) return false;
      next = [...current, id];
    }
    this.setState({ selectedCharacterIds: next, selectedCharacterId: next[0] || null });
    document.dispatchEvent(new CustomEvent('characterSelected', {
      detail: { character: next[0] ? chars.find(c => c.id === next[0]) : null, id: next[0] || null }
    }));
    return true;
  }

  /**
   * Replace the full selection set at once (e.g. syncing from a
   * server-broadcast presence update, where we already know the exact
   * final set rather than one toggle at a time). Deduped and capped at
   * MAX_CONTROLLED_CHARACTERS, silently dropping anything past the cap
   * rather than throwing -- the server is the source of truth for
   * enforcement, this is just keeping the local view in sync with it.
   */
  setSelectedCharacterIds(ids) {
    const chars = this.state.characters || [];
    const deduped = [...new Set((ids || []).filter(id => chars.some(c => c.id === id)))].slice(0, MAX_CONTROLLED_CHARACTERS);
    this.setState({ selectedCharacterIds: deduped, selectedCharacterId: deduped[0] || null });
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

  /** All characters this client currently has selected (Remote mode). */
  getSelectedCharacters() {
    const ids = this.state.selectedCharacterIds || [];
    const chars = this.state.characters || [];
    return ids.map(id => chars.find(c => c.id === id)).filter(Boolean);
  }

  getSelectedCharacterIds() {
    return this.state.selectedCharacterIds || [];
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
