import { vttStore } from '../../core/vtt-store.js';
import { isConnectedToServer, sendChatMessage, syncState, onEvent, offEvent } from '../../core/websocket.js';
// ... other imports

let container = null;
let wsListeners = new Map();
let voiceUpdateInterval = null;

function setupWebSocketSync() {
  if (!isConnectedToServer()) return;
  // Listen for remote messages
  onEvent('chat-message', (msg) => {
    vttStore.addChatMessage({ ...msg, local: false, sent: true });
    // Notification sound if needed
  });
  // When remote state changes (e.g., another player updated party)
  onEvent('state-updated', (data) => {
    vttStore.setState({
      characters: data.characters || [],
      timers: data.timers || [],
      // ...
    });
  });
  // ...
}

export function render(el) {
  container = el;
  setContainer(el);
  // Build HTML (same template)
  el.innerHTML = `...`;  // using the same layout as before

  // Initialize subscriptions (each attaches once)
  renderChat();
  renderVTTChars();
  renderVTTTimers();
  renderLocalPresence();
  populateChatRecipients();
  updateMessageCount(); // optional, can be derived from store

  // If connected, sync and set up WS listeners
  if (isConnectedToServer()) {
    setupWebSocketSync();
    syncState(vttStore.getState()); // push current state to server
  }

  // Voice UI – update from store
  const voiceUnsubscribe = vttStore.subscribe('voiceClients', updateVoiceUI);
  // Also set up periodic voice client refresh from the voice module
  // (voice module should call vttStore.updateVoiceClients() when list changes)

  // ... attach DOM events
}

export function sendMessage(text, sender, recipient = 'all', metadata = {}) {
  const msg = {
    text, sender, recipient,
    whisper: recipient !== 'all',
    time: new Date().toLocaleTimeString(),
    timestamp: Date.now(),
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
    local: !isConnectedToServer(),
    sent: false,
    ...metadata
  };
  vttStore.addChatMessage(msg);
  if (isConnectedToServer()) {
    sendChatMessage(msg);
  }
}

// Similarly, roll() updates store and possibly sends via WS.
