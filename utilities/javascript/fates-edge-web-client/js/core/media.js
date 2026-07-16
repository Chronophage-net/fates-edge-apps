/**
 * Media Module - Centralized audio/video recording management
 * Handles MediaRecorder lifecycle, file downloads, WebSocket broadcast,
 * and exports an SRT manifest for video editors.
 * Shows a global overlay when any connected client is recording.
 */

import { getSyncManager } from './sync/index.js';
import { showToast } from '../components/Toast.js';

// ============================================================
// STATE
// ============================================================

let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordingStartTime = null;
let recordingEvents = []; // For manifest/transcript generation
let recordingUserId = null; 
let overlayElement = null;
let overlayTimer = null;
let activeRecordings = {}; 
let currentUserId = null;

// ============================================================
// OVERLAY MANAGEMENT
// ============================================================

const OVERLAY_TIMEOUT = 60000; 

function createOverlay() {
    if (overlayElement) return;
    
    overlayElement = document.createElement('div');
    overlayElement.id = 'media-recording-overlay';
    overlayElement.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9999;
        background: rgba(180, 0, 0, 0.9);
        color: #fff;
        padding: 8px 16px;
        border-radius: 8px;
        font-family: var(--font, system-ui);
        font-size: 14px;
        font-weight: 600;
        display: none;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.2);
        backdrop-filter: blur(4px);
        pointer-events: none;
        animation: pulse-recording 1.5s ease-in-out infinite;
    `;
    
    if (!document.getElementById('media-recording-styles')) {
        const style = document.createElement('style');
        style.id = 'media-recording-styles';
        style.textContent = `
            @keyframes pulse-recording {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.7; transform: scale(1.02); }
            }
        `;
        document.head.appendChild(style);
    }
    
    overlayElement.innerHTML = `
        <span style="font-size:18px;">🔴</span>
        <span id="media-recording-text">Recording...</span>
        <span id="media-recording-timer" style="font-size:12px;font-weight:400;opacity:0.8;">00:00</span>
    `;
    
    document.body.appendChild(overlayElement);
}

function showOverlay(userId, userName = 'Someone') {
    createOverlay();
    if (!overlayElement) return;
    
    const textEl = document.getElementById('media-recording-text');
    if (textEl) {
        if (userId === currentUserId) {
            textEl.textContent = '🔴 You are recording';
        } else {
            textEl.textContent = `🔴 ${userName} is recording`;
        }
    }
    
    overlayElement.style.display = 'flex';
    startOverlayTimer();
}

function hideOverlay() {
    if (overlayElement) {
        overlayElement.style.display = 'none';
    }
    if (overlayTimer) {
        clearInterval(overlayTimer);
        overlayTimer = null;
    }
    const timerEl = document.getElementById('media-recording-timer');
    if (timerEl) timerEl.textContent = '00:00';
}

function startOverlayTimer() {
    if (overlayTimer) clearInterval(overlayTimer);
    const startTime = Date.now();
    overlayTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        const timerEl = document.getElementById('media-recording-timer');
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

// ============================================================
// WEBSOCKET BROADCAST
// ============================================================

let syncManager = null;

async function getSync() {
    if (!syncManager) {
        try {
            syncManager = await getSyncManager();
        } catch (e) {
            console.warn('[Media] Sync manager not available:', e);
        }
    }
    return syncManager;
}

function broadcastRecordingStatus(action, userId, userName) {
    getSync().then(sync => {
        if (sync && sync.isConnected && sync.send) {
            sync.send({
                type: 'media_recording',
                action: action,
                userId: userId || sync.userId || 'unknown',
                userName: userName || 'Player',
                timestamp: Date.now()
            });
        }
    }).catch(() => {});
}

function handleMediaBroadcast(message) {
    if (message.type !== 'media_recording') return;
    
    const { action, userId, userName, timestamp } = message;
    
    if (userId === currentUserId) return;
    
    if (action === 'start') {
        if (!activeRecordings[userId]) {
            activeRecordings[userId] = { timestamp, name: userName || 'Someone' };
        }
        showOverlay(userId, activeRecordings[userId].name);
        
        setTimeout(() => {
            if (activeRecordings[userId] && activeRecordings[userId].timestamp === timestamp) {
                delete activeRecordings[userId];
                if (Object.keys(activeRecordings).length === 0) {
                    hideOverlay();
                } else {
                    const nextUserId = Object.keys(activeRecordings)[0];
                    const next = activeRecordings[nextUserId];
                    showOverlay(nextUserId, next.name);
                }
            }
        }, OVERLAY_TIMEOUT);
        
    } else if (action === 'stop') {
        delete activeRecordings[userId];
        if (Object.keys(activeRecordings).length === 0) {
            hideOverlay();
        } else {
            const nextUserId = Object.keys(activeRecordings)[0];
            const next = activeRecordings[nextUserId];
            showOverlay(nextUserId, next.name);
        }
    }
}

// ============================================================
// EVENT LOGGING & MANIFEST GENERATION
// ============================================================

/**
 * Log an event during an active recording for the post-production manifest
 * @param {string} eventType - e.g., 'scene_change', 'chat_message', 'highlight'
 * @param {string} text - The text to display in the manifest/subtitle
 */
export function logRecordingEvent(eventType = 'event', text = '') {
    if (!isRecording || !recordingStartTime) return;
    
    const offsetMs = Date.now() - recordingStartTime;
    recordingEvents.push({
        timeMs: offsetMs,
        type: eventType,
        text: text
    });
}

/**
 * Generate and download an SRT subtitle file synced with the recording.
 * This is the "manifest" for video editors. They can drop this into Premiere/Resolve.
 */
function generateAndDownloadManifest() {
    if (recordingEvents.length === 0) return;

    // Convert milliseconds to SRT time format: HH:MM:SS,mmm
    const msToSrtTime = (ms) => {
        const date = new Date(ms);
        const hh = String(date.getUTCHours()).padStart(2, '0');
        const mm = String(date.getUTCMinutes()).padStart(2, '0');
        const ss = String(date.getUTCSeconds()).padStart(2, '0');
        const mmm = String(date.getUTCMilliseconds()).padStart(3, '0');
        return `${hh}:${mm}:${ss},${mmm}`;
    };

    let srtContent = '';
    recordingEvents.forEach((event, index) => {
        const startTime = msToSrtTime(event.timeMs);
        // Make the subtitle last for 2 seconds, or until the next event if sooner
        const nextEvent = recordingEvents[index + 1];
        const endOffset = nextEvent ? Math.min(event.timeMs + 2000, nextEvent.timeMs) : event.timeMs + 2000;
        const endTime = msToSrtTime(endOffset);

        srtContent += `${index + 1}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `[${event.type.toUpperCase()}] ${event.text}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `recording_manifest_${timestamp}.srt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// PUBLIC API
// ============================================================

export function initMediaModule(userId = 'local') {
    currentUserId = userId;
    createOverlay();
    hideOverlay();
    
    getSync().then(sync => {
        if (sync && sync.on) {
            if (typeof sync.on === 'function') {
                sync.on('media_recording', handleMediaBroadcast);
            } else if (typeof sync.addEventListener === 'function') {
                sync.addEventListener('media_recording', (e) => handleMediaBroadcast(e.detail || e));
            }
        }
    }).catch(() => {});
}

/**
 * Start recording Screen + Microphone
 */
export async function startRecording(userName = 'Player') {
    if (isRecording) {
        showToast('Already recording.', 'warning');
        return;
    }
    
    try {
        // 1. Get Screen Capture (with system audio if permitted by OS)
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { frameRate: 30 }, 
            audio: true 
        });
        
        // 2. Get Microphone
        let micStream = null;
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (micErr) {
            console.warn('[Media] Mic access denied, proceeding with screen audio only.');
        }
        
        // 3. Combine tracks into one stream
        const combinedStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...screenStream.getAudioTracks(),
            ...(micStream ? micStream.getAudioTracks() : [])
        ]);
        
        // Handle user manually stopping screen share via browser UI
        screenStream.getVideoTracks()[0].onended = () => {
            if (isRecording) stopRecording();
        };

        // 4. Setup MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
            ? 'video/webm;codecs=vp9,opus' 
            : 'video/webm';
            
        mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
        recordedChunks = [];
        recordingEvents = []; // Reset events for new session
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) recordedChunks.push(event.data);
        };
        
        mediaRecorder.onstop = handleRecordingStop;
        
        mediaRecorder.start(1000); // Collect data in 1s chunks for stability
        isRecording = true;
        recordingStartTime = Date.now();
        recordingUserId = currentUserId;
        
        updateUIState(true);
        broadcastRecordingStatus('start', currentUserId, userName);
        showOverlay(currentUserId, userName);
        
        // Log the start event for the manifest
        logRecordingEvent('recording_start', `Recording started by ${userName}`);
        
        showToast('🎥 Screen & Audio recording started.', 'success');
        
    } catch (err) {
        console.error('[Media] Recording error:', err);
        showToast('Screen capture canceled or failed.', 'error');
        throw err;
    }
}

export function stopRecording() {
    if (!isRecording || !mediaRecorder) {
        showToast('No recording in progress.', 'warning');
        return;
    }
    
    if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    
    isRecording = false;
    recordingUserId = null;
    
    // Log the stop event
    logRecordingEvent('recording_stop', 'Recording stopped');
    
    // Stop all tracks across both conceptual streams
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    broadcastRecordingStatus('stop', currentUserId);
    
    if (Object.keys(activeRecordings).length === 0) {
        hideOverlay();
    }
    
    updateUIState(false);
    showToast('⏹️ Recording stopped. Processing files...', 'info');
}

function handleRecordingStop() {
    if (recordedChunks.length === 0) {
        showToast('No video captured.', 'warning');
        return;
    }
    
    // 1. Save Video/Audio File
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `recording_${timestamp}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    
    // 2. Generate Manifest/SRT File for editors
    generateAndDownloadManifest();
    
    recordedChunks = [];
    recordingEvents = [];
    
    showToast('💾 Video and Manifest saved.', 'success');
}

export function isCurrentlyRecording() {
    return isRecording;
}

export function getRecordingStatus() {
    return {
        isRecording: isRecording,
        startTime: recordingStartTime,
        duration: recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0
    };
}

function updateUIState(recording) {
    const event = new CustomEvent('media-recording-state', {
        detail: { isRecording: recording }
    });
    document.dispatchEvent(event);
}

// ============================================================
// CLEANUP
// ============================================================

export function destroyMediaModule() {
    if (isRecording) {
        try {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            mediaRecorder?.stream?.getTracks().forEach(track => track.stop());
        } catch (e) { /* ignore */ }
        isRecording = false;
        recordingUserId = null;
        broadcastRecordingStatus('stop', currentUserId);
    }
    if (overlayElement) {
        overlayElement.remove();
        overlayElement = null;
    }
    if (overlayTimer) {
        clearInterval(overlayTimer);
        overlayTimer = null;
    }
    activeRecordings = {};
    hideOverlay();
}

export default {
    init: initMediaModule,
    startRecording,
    stopRecording,
    isCurrentlyRecording,
    getRecordingStatus,
    logRecordingEvent, // Expose this so scene-tools/chat can log markers!
    destroy: destroyMediaModule,
    _handleBroadcast: handleMediaBroadcast,
    _broadcastStatus: broadcastRecordingStatus
};
