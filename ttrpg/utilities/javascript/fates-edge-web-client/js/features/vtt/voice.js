/**
 * Voice Chat Integration for VTT
 * Pure state manager for voice clients and WebRTC signaling.
 * UI updates are handled by the VTT module.
 */

import { VoiceChat } from '../../components/VoiceChat.js';
import { onEvent, sendEvent, getSocketId, isConnectedToServer } from '../../core/websocket.js';
import { showToast } from '../../components/Toast.js';

let voiceChat = null;
let voiceClients = new Map(); // clientId -> { name, stream, speaking }
let isInitialized = false;
let activityCleanup = null;
let _clientChangeCallback = null;
let _lastClientInfo = new Map();

function notifyClientsChanged() {
  if (!_clientChangeCallback) return;
  const clientsInfo = Array.from(voiceClients.entries()).map(([id, client]) => ({
    id,
    name: client.name || 'Player',
    speaking: client.speaking || false,
    connectionState: client.connectionState || 'idle'
  }));
  // Check if changed to avoid unnecessary updates
  let changed = false;
  if (clientsInfo.length !== _lastClientInfo.size) changed = true;
  else {
    for (const info of clientsInfo) {
      const prev = _lastClientInfo.get(info.id);
      if (!prev || prev.speaking !== info.speaking || prev.connectionState !== info.connectionState) {
        changed = true;
        break;
      }
    }
  }
  if (changed) {
    _lastClientInfo = new Map(clientsInfo.map(info => [info.id, info]));
    _clientChangeCallback(clientsInfo);
  }
}

export function onVoiceClientsChanged(callback) {
  _clientChangeCallback = callback;
}
/**
 * Initialize voice chat
 */
export async function initVoice() {
    if (isInitialized) {
        return true;
    }
    
    if (!isConnectedToServer()) {
        showToast('Connect to a server first before starting voice.', 'error');
        return false;
    }
    
    voiceChat = new VoiceChat();
    const success = await voiceChat.init();
    if (!success) return false;
    
    isInitialized = true;
    
    // Set up WebSocket event handlers
    setupVoiceEvents();
    
    // Notify room
    sendEvent({ type: 'voice-enabled', enabled: true });
    
    // Register activity listener (if needed)
    if (voiceChat.onActivity) {
        activityCleanup = voiceChat.onActivity((activity) => {
            // Activity can be used for UI if needed
        });
    }
    
    showToast('🎤 Voice chat ready!', 'success');
    return true;
}

/**
 * Setup voice event handlers
 */
function setupVoiceEvents() {
    // WebRTC signaling - Offer
    onEvent('voice-offer', async (data) => {
        const { from, offer } = data;
        if (from === getSocketId()) return;
        
        if (!isInitialized || !voiceChat) {
            showToast('Voice not initialized. Start voice first.', 'warning');
            return;
        }
        
        try {
            const pc = voiceChat.createPeerConnection(
                from,
                onRemoteTrack,
                onIceCandidate,
                onConnectionStateChange
            );
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            sendEvent({
                type: 'voice-answer',
                from: getSocketId(),
                to: from,
                answer: answer
            });
        } catch (err) {
            console.error('Voice answer error:', err);
        }
    });
    
    // WebRTC signaling - Answer
    onEvent('voice-answer', async (data) => {
        const { from, answer } = data;
        if (from === getSocketId()) return;
        
        if (!isInitialized || !voiceChat) return;
        
        try {
            const pc = voiceChat.getPeerConnection(from);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            }
        } catch (err) {
            console.error('Voice answer processing error:', err);
        }
    });
    
    // WebRTC signaling - ICE Candidate
    onEvent('voice-ice-candidate', async (data) => {
        const { from, candidate } = data;
        if (from === getSocketId()) return;
        
        if (!isInitialized || !voiceChat) return;
        
        try {
            const pc = voiceChat.getPeerConnection(from);
            if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (err) {
            console.error('ICE candidate error:', err);
        }
    });
    
    // Voice status updates (remote client enables/disables voice)
    onEvent('voice-status', (data) => {
        const { clientId, enabled, name } = data;
        if (enabled) {
            // If we don't have this client yet, add with default name
            if (!voiceClients.has(clientId)) {
                voiceClients.set(clientId, { 
                    name: name || 'Player',
                    speaking: false 
                });
            } else {
                // Update name if provided
                const client = voiceClients.get(clientId);
                if (name) client.name = name;
            }
        } else {
            voiceClients.delete(clientId);
            // Cleanup peer connection
            if (voiceChat) {
                voiceChat.cleanupPeerConnection(clientId);
            }
        }
    });
    
    // Client left – cleanup voice for that client
    onEvent('client-left', (clientId) => {
        voiceClients.delete(clientId);
        if (voiceChat) {
            voiceChat.cleanupPeerConnection(clientId);
        }
    });
}

/**
 * Handle remote track from peer
 */
function onRemoteTrack(clientId, stream) {
    const existing = voiceClients.get(clientId) || { name: 'Player' };
    voiceClients.set(clientId, {
        ...existing,
        stream: stream,
        speaking: false
    });
    
    // Auto-play audio with volume control
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.volume = 0.8;
    
    // Detect speaking on remote stream
    detectSpeaking(clientId, stream);
}

/**
 * Detect speaking on remote stream
 */
function detectSpeaking(clientId, stream) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        function checkSpeaking() {
            if (!voiceClients.has(clientId)) return;
            
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const avg = sum / (dataArray.length * 255);
            const isSpeaking = avg > 0.05;
            
            const client = voiceClients.get(clientId);
            if (client) {
                client.speaking = isSpeaking;
            }
            
            requestAnimationFrame(checkSpeaking);
        }
        
        checkSpeaking();
    } catch (err) {
        console.warn('Speaking detection not available:', err);
    }
}

/**
 * Handle ICE candidate from peer
 */
function onIceCandidate(clientId, candidate) {
    sendEvent({
        type: 'voice-ice-candidate',
        from: getSocketId(),
        to: clientId,
        candidate: candidate
    });
}

/**
 * Handle connection state change
 */
function onConnectionStateChange(clientId, state) {
    const client = voiceClients.get(clientId);
    if (client) {
        client.connectionState = state;
    }
}

/**
 * Initiate voice connection to a client
 */
export async function initiateVoiceCall(targetClientId) {
    if (!isInitialized || !voiceChat) {
        showToast('Voice not initialized.', 'error');
        return;
    }
    
    try {
        const pc = voiceChat.createPeerConnection(
            targetClientId,
            onRemoteTrack,
            onIceCandidate,
            onConnectionStateChange
        );
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        sendEvent({
            type: 'voice-offer',
            from: getSocketId(),
            to: targetClientId,
            offer: offer
        });
    } catch (err) {
        console.error('Voice call init error:', err);
        showToast('Failed to start voice call.', 'error');
    }
}

/**
 * Toggle mute
 */
export function toggleMute() {
    if (!isInitialized || !voiceChat) {
        showToast('Voice not initialized.', 'error');
        return false;
    }
    const muted = voiceChat.toggleMute();
    return muted;
}

/**
 * Get voice status
 */
export function getVoiceStatus() {
    if (!isInitialized || !voiceChat) {
        return { enabled: false, muted: true, activity: 0 };
    }
    return {
        enabled: voiceChat.isEnabledState(),
        muted: voiceChat.isMutedState(),
        activity: voiceChat.getVoiceActivity ? voiceChat.getVoiceActivity() : 0
    };
}

/**
 * Get active voice clients (list of client IDs)
 */
export function getActiveVoiceClients() {
    return Array.from(voiceClients.keys());
}

/**
 * Get voice client info
 */
export function getVoiceClient(clientId) {
    return voiceClients.get(clientId) || null;
}

/**
 * Cleanup voice
 */
export function cleanupVoice() {
    if (voiceChat) {
        voiceChat.cleanup();
        voiceChat = null;
    }
    if (activityCleanup) {
        activityCleanup();
        activityCleanup = null;
    }
    voiceClients.clear();
    isInitialized = false;
    showToast('Voice stopped.', 'info');
}