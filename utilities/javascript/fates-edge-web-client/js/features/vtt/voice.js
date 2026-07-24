/**
 * Voice Chat Integration for VTT
 * Pure state manager for voice clients and WebRTC signaling.
 * UI updates are handled by the VTT module.
 * Updated for unified WebSocket module.
 */

import { initMediaModule } from '../../core/media.js';
import { getState } from '../../core/state.js';
import { VoiceChat } from '../../components/VoiceChat.js';
import { onEvent, sendEvent, getSocketId, isConnectedToServer, onWSEvent, offWSEvent } from '../../core/websocket.js';
import { showToast } from '../../components/Toast.js';

// ============================================================
// STATE
// ============================================================

let voiceChat = null;
let voiceClients = new Map(); // clientId -> { name, stream, speaking, connectionState }
let isInitialized = false;
let activityCleanup = null;
let _clientChangeCallback = null;
let _lastClientInfo = new Map();
let wsEventListeners = [];
let speakingDetectors = new Map();
let audioContexts = new Map(); // clientId -> AudioContext, so detectSpeaking()'s contexts can actually be closed

/**
 * Stop a client's speaking detector AND close its AudioContext.
 * Every place that used to do speakingDetectors.delete(clientId) alone left
 * the associated AudioContext running forever -- browsers cap the number of
 * concurrently-open AudioContexts, so repeated voice connect/disconnect
 * cycles would eventually start failing silently.
 */
function stopSpeakingDetector(clientId) {
    if (speakingDetectors.has(clientId)) {
        cancelAnimationFrame(speakingDetectors.get(clientId));
        speakingDetectors.delete(clientId);
    }
    if (audioContexts.has(clientId)) {
        const ctx = audioContexts.get(clientId);
        try { ctx.close(); } catch (e) { /* ignore */ }
        audioContexts.delete(clientId);
    }
}

// ============================================================
// CLIENT CHANGE NOTIFICATION
// ============================================================

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
    if (clientsInfo.length !== _lastClientInfo.size) {
        changed = true;
    } else {
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

// ============================================================
// MEDIA MODULE INITIALIZATION
// ============================================================

async function initializeMediaModule() {
    try {
        const state = getState();
        const userId = state.sessionId || 'voice-' + Date.now().toString(36);
        initMediaModule(userId);
        console.log('[Voice] Media module initialized');
    } catch (e) {
        console.warn('[Voice] Could not initialize media module:', e);
    }
}

// ============================================================
// VOICE INITIALIZATION
// ============================================================

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

    try {
        // Initialize media module for session recording
        await initializeMediaModule();

        voiceChat = new VoiceChat();
        const success = await voiceChat.init();
        if (!success) {
            showToast('Failed to initialize voice chat.', 'error');
            return false;
        }

        isInitialized = true;

        // Set up WebSocket event handlers
        setupVoiceEvents();

        // Notify room
        sendEvent({
            type: 'voice-status',
            enabled: true,
            name: localStorage.getItem('fates-edge-client-name') || 'Player'
        });

        // Register activity listener (if available)
        if (voiceChat.onActivity) {
            activityCleanup = voiceChat.onActivity((activity) => {
                // Activity can be used for UI if needed
            });
        }

        showToast('🎤 Voice chat ready!', 'success');
        return true;
    } catch (err) {
        console.error('[Voice] Init error:', err);
        showToast('Failed to initialize voice: ' + err.message, 'error');
        return false;
    }
}

// ============================================================
// VOICE EVENT HANDLERS
// ============================================================

/**
 * Setup voice event handlers using unified WebSocket module
 */
function setupVoiceEvents() {
    // Clean up any existing listeners
    cleanupVoiceEvents();

    // WebRTC signaling - Offer
    const offerHandler = async (data) => {
        const { from, offer } = data;
        if (from === getSocketId()) return;

        if (!isInitialized || !voiceChat) {
            showToast('Voice not initialized. Start voice first.', 'warning');
            return;
        }

        try {
            // Ensure we have a client entry
            if (!voiceClients.has(from)) {
                voiceClients.set(from, {
                    name: data.name || 'Player',
                    speaking: false,
                    connectionState: 'connecting'
                });
                notifyClientsChanged();
            }

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
            console.error('[Voice] Answer error:', err);
        }
    };
    onWSEvent('voice-offer', offerHandler);
    wsEventListeners.push({ event: 'voice-offer', handler: offerHandler });

    // WebRTC signaling - Answer
    const answerHandler = async (data) => {
        const { from, answer } = data;
        if (from === getSocketId()) return;

        if (!isInitialized || !voiceChat) return;

        try {
            const pc = voiceChat.getPeerConnection(from);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                // Update connection state
                const client = voiceClients.get(from);
                if (client) {
                    client.connectionState = 'connected';
                    notifyClientsChanged();
                }
            }
        } catch (err) {
            console.error('[Voice] Answer processing error:', err);
        }
    };
    onWSEvent('voice-answer', answerHandler);
    wsEventListeners.push({ event: 'voice-answer', handler: answerHandler });

    // WebRTC signaling - ICE Candidate
    const iceHandler = async (data) => {
        const { from, candidate } = data;
        if (from === getSocketId()) return;

        if (!isInitialized || !voiceChat) return;

        try {
            const pc = voiceChat.getPeerConnection(from);
            if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (err) {
            console.error('[Voice] ICE candidate error:', err);
        }
    };
    onWSEvent('voice-ice-candidate', iceHandler);
    wsEventListeners.push({ event: 'voice-ice-candidate', handler: iceHandler });

    // Voice status updates (remote client enables/disables voice)
    const statusHandler = (data) => {
        const { clientId, enabled, name } = data;
        if (!clientId || clientId === getSocketId()) return;

        if (enabled) {
            // If we don't have this client yet, add with default name
            if (!voiceClients.has(clientId)) {
                voiceClients.set(clientId, {
                    name: name || 'Player',
                    speaking: false,
                    connectionState: 'idle'
                });
                notifyClientsChanged();
            } else {
                // Update name if provided
                const client = voiceClients.get(clientId);
                if (name) client.name = name;
                notifyClientsChanged();
            }
        } else {
            voiceClients.delete(clientId);
            // Cleanup peer connection
            if (voiceChat) {
                voiceChat.cleanupPeerConnection(clientId);
            }
            // Cleanup speaking detector (and its AudioContext)
            stopSpeakingDetector(clientId);
            notifyClientsChanged();
        }
    };
    onWSEvent('voice-status', statusHandler);
    wsEventListeners.push({ event: 'voice-status', handler: statusHandler });

    // Client joined – check if they have voice enabled
    const joinedHandler = (data) => {
        // The client will send their own voice-status, so we wait for that
    };
    onWSEvent('client-joined', joinedHandler);
    wsEventListeners.push({ event: 'client-joined', handler: joinedHandler });

    // Client left – cleanup voice for that client
    const leftHandler = (clientId) => {
        if (!clientId) return;
        voiceClients.delete(clientId);
        if (voiceChat) {
            voiceChat.cleanupPeerConnection(clientId);
        }
        stopSpeakingDetector(clientId);
        notifyClientsChanged();
    };
    onWSEvent('client-left', leftHandler);
    wsEventListeners.push({ event: 'client-left', handler: leftHandler });

    // Disconnect – cleanup all voice
    const disconnectHandler = () => {
        cleanupVoice();
    };
    onWSEvent('disconnected', disconnectHandler);
    wsEventListeners.push({ event: 'disconnected', handler: disconnectHandler });
}

function cleanupVoiceEvents() {
    for (const { event, handler } of wsEventListeners) {
        try {
            offWSEvent(event, handler);
        } catch (e) {
            console.debug('[Voice] Error removing listener:', e);
        }
    }
    wsEventListeners = [];
}

// ============================================================
// WEBRTC CALLBACKS
// ============================================================

/**
 * Handle remote track from peer
 */
function onRemoteTrack(clientId, stream) {
    const existing = voiceClients.get(clientId) || { name: 'Player' };
    voiceClients.set(clientId, {
        ...existing,
        stream: stream,
        speaking: false,
        connectionState: 'connected'
    });
    notifyClientsChanged();

    // Auto-play audio with volume control
    try {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.volume = 0.8;
        // Store for cleanup
        if (!voiceChat._audioElements) voiceChat._audioElements = new Map();
        voiceChat._audioElements.set(clientId, audio);
    } catch (err) {
        console.warn('[Voice] Auto-play audio error:', err);
    }

    // Detect speaking on remote stream
    detectSpeaking(clientId, stream);
}

/**
 * Detect speaking on remote stream
 */
function detectSpeaking(clientId, stream) {
    try {
        // Clean up any existing detector (and its AudioContext) for this client
        stopSpeakingDetector(clientId);

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContexts.set(clientId, audioContext);
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let lastSpeaking = false;

        function checkSpeaking() {
            if (!voiceClients.has(clientId) || !stream.active) {
                return;
            }

            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const avg = sum / (dataArray.length * 255);
            const isSpeaking = avg > 0.05;

            const client = voiceClients.get(clientId);
            if (client) {
                if (client.speaking !== isSpeaking) {
                    client.speaking = isSpeaking;
                    notifyClientsChanged();
                }
            }

            const frameId = requestAnimationFrame(checkSpeaking);
            speakingDetectors.set(clientId, frameId);
        }

        const frameId = requestAnimationFrame(checkSpeaking);
        speakingDetectors.set(clientId, frameId);
    } catch (err) {
        console.warn('[Voice] Speaking detection not available:', err);
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
        notifyClientsChanged();

        if (state === 'failed' || state === 'disconnected') {
            // Clean up failed connection after a delay
            setTimeout(() => {
                if (voiceClients.has(clientId)) {
                    const c = voiceClients.get(clientId);
                    if (c.connectionState === 'failed' || c.connectionState === 'disconnected') {
                        voiceClients.delete(clientId);
                        if (voiceChat) {
                            voiceChat.cleanupPeerConnection(clientId);
                        }
                        stopSpeakingDetector(clientId);
                        notifyClientsChanged();
                    }
                }
            }, 5000);
        }
    }
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Initiate voice connection to a client
 */
export async function initiateVoiceCall(targetClientId) {
    if (!isInitialized || !voiceChat) {
        showToast('Voice not initialized.', 'error');
        return false;
    }

    if (!targetClientId || targetClientId === getSocketId()) {
        showToast('Invalid client.', 'error');
        return false;
    }

    try {
        // Ensure we have a client entry
        if (!voiceClients.has(targetClientId)) {
            voiceClients.set(targetClientId, {
                name: 'Player',
                speaking: false,
                connectionState: 'connecting'
            });
            notifyClientsChanged();
        }

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
            offer: offer,
            name: localStorage.getItem('fates-edge-client-name') || 'Player'
        });

        return true;
    } catch (err) {
        console.error('[Voice] Call init error:', err);
        showToast('Failed to start voice call.', 'error');
        return false;
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
    showToast(muted ? '🔇 Muted' : '🎙️ Unmuted', muted ? 'warning' : 'info');
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
        enabled: voiceChat.isEnabledState ? voiceChat.isEnabledState() : true,
        muted: voiceChat.isMutedState ? voiceChat.isMutedState() : false,
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
 * Check if voice is initialized
 */
export function isVoiceInitialized() {
    return isInitialized;
}

/**
 * Cleanup voice
 */
export function cleanupVoice() {
    // Clean up speaking detectors and their AudioContexts
    for (const clientId of speakingDetectors.keys()) {
        cancelAnimationFrame(speakingDetectors.get(clientId));
    }
    speakingDetectors.clear();
    for (const ctx of audioContexts.values()) {
        try { ctx.close(); } catch (e) { /* ignore */ }
    }
    audioContexts.clear();

    // Clean up audio elements -- must happen BEFORE voiceChat is nulled below,
    // otherwise this check is always false and the <audio> elements (and the
    // remote streams they hold onto) are never actually released.
    if (voiceChat && voiceChat._audioElements) {
        for (const audio of voiceChat._audioElements.values()) {
            audio.srcObject = null;
            audio.pause();
        }
        voiceChat._audioElements.clear();
    }

    // Clean up voice chat
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
    notifyClientsChanged();

    // Clean up event listeners
    cleanupVoiceEvents();

    // Notify room
    try {
        sendEvent({
            type: 'voice-status',
            enabled: false
        });
    } catch (e) { /* ignore */ }

    showToast('Voice stopped.', 'info');
}

// ============================================================
// EXPORT
// ============================================================

export default {
    initVoice,
    toggleMute,
    getVoiceStatus,
    cleanupVoice,
    getActiveVoiceClients,
    getVoiceClient,
    initiateVoiceCall,
    onVoiceClientsChanged,
    isVoiceInitialized
};
