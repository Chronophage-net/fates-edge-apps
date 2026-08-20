/**
 * Media Module - Centralized audio/video recording management
 * Handles MediaRecorder lifecycle, file downloads, WebSocket broadcast,
 * and exports an SRT manifest of in-app events (deck draws, timers,
 * scene changes, etc. -- see logRecordingEvent()'s call sites) for video
 * editors. Shows a global overlay when any connected client is recording.
 *
 * PACKAGING (this pass): the recording (.webm, video+audio) and its event
 * SRT used to download as two separate files a moment apart -- easy to
 * lose track of which SRT belongs to which recording once you've got a
 * folder of both. handleRecordingStop() now bundles them into a single
 * .zip (recording + events.srt + a small session-info.txt) via the
 * JSZip global already loaded by index.html (used the same way
 * core/pack-manager.js already uses it) -- one download, unambiguously
 * paired. Falls back to the old two-separate-files behavior if JSZip
 * somehow isn't available (e.g. the CDN script was blocked), so this
 * never blocks a recording from being saved at all.
 *
 * TRANSCRIPTION (this pass): this module does NOT do speech-to-text --
 * that's a real, hard problem (accuracy, language support, diarization)
 * and out of scope to build/host here. What it DOES do is optionally
 * feed the browser's own built-in SpeechRecognition API (Chrome/Edge;
 * see isLiveTranscriptionSupported()) into the exact same event log the
 * click/deck/timer events already use -- each recognized phrase becomes
 * a `speech` event, timestamped and included in the SRT like everything
 * else. It's best-effort (whatever your OS/browser's own recognizer
 * gives you, no editing/correction pass) and OFF by default -- opt in
 * per-recording via startRecording(userName, { liveTranscription: true })
 * or the checkbox in GM Tools' Session Recap panel. For a real
 * transcript, see the "Transcription" section of this repo's README --
 * the honest answer for real accuracy is running the exported audio
 * through an existing open-source/hosted speech-to-text tool
 * (e.g. whisper.cpp, faster-whisper, or a cloud STT API) after the fact,
 * which is a much better fit for that job than anything we'd hand-roll
 * here.
 */

import { getSyncManager } from './sync/index.js';
import { showToast } from '../components/Toast.js';
// NEW: the recording-status overlay below is a visual-only pulsing badge
// (position:fixed, pointer-events:none, no ARIA) -- a screen-reader user
// has no way to discover that a recording is in progress, or that it has
// stopped, unless something else tells them. announce() posts the same
// information to the sr-only live region so that gap doesn't require a
// second visual UI just to be accessible.
import { announce } from './a11y-announce.js';

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
let speechRecognizer = null; // NEW: live-transcription (see module doc comment above)
let liveTranscriptionRequested = false;

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

    // NEW: was already showing (e.g. a second client started recording
    // while the first was still going) -- don't re-announce, the first
    // announcement already told screen-reader users a recording is live.
    const wasAlreadyShowing = overlayElement.style.display === 'flex';

    const textEl = document.getElementById('media-recording-text');
    const isSelf = userId === currentUserId;
    if (textEl) {
        if (isSelf) {
            textEl.textContent = '🔴 You are recording';
        } else {
            textEl.textContent = `🔴 ${userName} is recording`;
        }
    }

    overlayElement.style.display = 'flex';
    startOverlayTimer();

    if (!wasAlreadyShowing) {
        announce(isSelf ? 'Recording started.' : `${userName} started recording.`);
    }
}

function hideOverlay() {
    // NEW: only announce a stop if the overlay was actually visible --
    // hideOverlay() is called defensively from several places (e.g. on
    // cleanup) even when nothing was recording, and announcing "Recording
    // stopped" then would be confusing noise.
    const wasShowing = !!overlayElement && overlayElement.style.display === 'flex';

    if (overlayElement) {
        overlayElement.style.display = 'none';
    }
    if (overlayTimer) {
        clearInterval(overlayTimer);
        overlayTimer = null;
    }
    const timerEl = document.getElementById('media-recording-timer');
    if (timerEl) timerEl.textContent = '00:00';

    if (wasShowing) {
        announce('Recording stopped.');
    }
}

// NEW: how often (in seconds) the sr-only live region gets an elapsed-time
// update while recording. Every second (matching the visible timer) would
// bury a screen-reader user in "one, two, three..." -- 30s gives blind
// users an occasional, unobtrusive confirmation that the recording is
// still going without turning the announcer into a stopwatch.
const RECORDING_ANNOUNCE_INTERVAL_SEC = 30;

function startOverlayTimer() {
    if (overlayTimer) clearInterval(overlayTimer);
    const startTime = Date.now();
    overlayTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        const timerEl = document.getElementById('media-recording-timer');
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
        if (elapsed > 0 && elapsed % RECORDING_ANNOUNCE_INTERVAL_SEC === 0) {
            announce(`Still recording — ${mins}:${secs} elapsed.`);
        }
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

// ============================================================
// LIVE TRANSCRIPTION (optional, best-effort) -- see this file's header
// doc comment's "TRANSCRIPTION" section for the full rationale.
// ============================================================

/**
 * Whether the browser's own SpeechRecognition API is available at all --
 * check this before offering the live-transcription checkbox in the UI.
 * Chrome/Edge (webkitSpeechRecognition) support it; Firefox/Safari
 * generally don't as of this writing.
 */
export function isLiveTranscriptionSupported() {
    return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Start feeding the browser's built-in speech recognizer into the SAME
 * event log deck draws/timers/etc. already use -- each finalized phrase
 * becomes a `speech` event via logRecordingEvent(), so it shows up in the
 * SRT export as a `[SPEECH]` line, timestamped like everything else. No
 * server round-trip, no new dependency -- purely whatever the OS/browser's
 * own recognizer produces. `continuous` + auto-restart-on-end keeps it
 * running for the length of the recording (the browser API stops itself
 * periodically on its own); a transient recognition error just logs a
 * warning and lets the next `onend`-triggered restart try again rather
 * than killing the whole recording.
 */
function startLiveTranscription() {
    if (!isLiveTranscriptionSupported()) {
        showToast('Live transcription isn\'t supported in this browser (try Chrome/Edge). Recording continues without it.', 'warning');
        return;
    }
    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
        speechRecognizer = new SpeechRecognitionImpl();
        speechRecognizer.continuous = true;
        speechRecognizer.interimResults = false;
        speechRecognizer.lang = (navigator.language || 'en-US');

        speechRecognizer.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    const transcript = (result[0]?.transcript || '').trim();
                    if (transcript) logRecordingEvent('speech', transcript);
                }
            }
        };
        speechRecognizer.onerror = (event) => {
            console.warn('[Media] Live transcription error (continuing recording):', event.error);
        };
        speechRecognizer.onend = () => {
            // The browser API stops itself periodically (silence, internal
            // limits) even in `continuous` mode -- auto-restart as long as
            // we're still recording and transcription is still requested.
            if (isRecording && liveTranscriptionRequested) {
                try { speechRecognizer.start(); } catch (e) { /* already starting/stopping -- ignore */ }
            }
        };
        speechRecognizer.start();
    } catch (e) {
        console.warn('[Media] Failed to start live transcription:', e);
        showToast('Could not start live transcription. Recording continues without it.', 'warning');
    }
}

function stopLiveTranscription() {
    liveTranscriptionRequested = false;
    if (speechRecognizer) {
        try { speechRecognizer.onend = null; speechRecognizer.stop(); } catch (e) { /* ignore */ }
        speechRecognizer = null;
    }
}

/**
 * Build the SRT subtitle text synced with the recording -- the "manifest"
 * for video editors (drop it into Premiere/Resolve/etc. as a subtitle
 * track). Split out from the old generateAndDownloadManifest() so both
 * the zip-bundle path and the standalone-file fallback can share it.
 * Returns '' if there's nothing to log yet.
 */
function generateSrtContent() {
    if (recordingEvents.length === 0) return '';

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

    return srtContent;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Package the just-finished recording (.webm) and its event SRT into ONE
 * .zip download instead of two separate files -- see the "PACKAGING"
 * section of this file's header doc comment for why. Uses the JSZip
 * global already loaded by index.html (same one core/pack-manager.js
 * uses for pack import/export) rather than adding a new dependency.
 * Falls back to downloading the two files separately (old behavior) if
 * JSZip isn't available for any reason, so a blocked CDN script can
 * never cost the user their recording.
 */
async function downloadRecordingBundle(videoBlob, srtContent, timestamp) {
    const videoName = `recording_${timestamp}.webm`;
    const srtName = `recording_events_${timestamp}.srt`;

    if (typeof JSZip === 'undefined') {
        console.warn('[Media] JSZip not available -- falling back to separate video/SRT downloads.');
        downloadBlob(videoBlob, videoName);
        if (srtContent) downloadBlob(new Blob([srtContent], { type: 'text/plain' }), srtName);
        return;
    }

    try {
        const zip = new JSZip();
        zip.file(videoName, videoBlob);
        if (srtContent) zip.file(srtName, srtContent);
        zip.file('session-info.txt', buildSessionInfoText(timestamp));

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, `session_recording_${timestamp}.zip`);
    } catch (e) {
        console.warn('[Media] Failed to build zip bundle, falling back to separate downloads:', e);
        downloadBlob(videoBlob, videoName);
        if (srtContent) downloadBlob(new Blob([srtContent], { type: 'text/plain' }), srtName);
    }
}

/** Small human-readable readme dropped inside the zip bundle so a video editor opening the folder later knows what they're looking at and how the SRT lines up. */
function buildSessionInfoText(timestamp) {
    const durationSec = recordingStartTime ? Math.round((Date.now() - recordingStartTime) / 1000) : 0;
    const lines = [
        `Fate's Edge session recording`,
        `Captured: ${new Date().toISOString()}`,
        `Duration: ~${durationSec}s`,
        `Events logged: ${recordingEvents.length}`,
        '',
        `recording_${timestamp}.webm  -- screen + mic capture (video/audio)`,
        `recording_events_${timestamp}.srt -- event subtitle track (deck draws, timers, scene changes, etc.` +
            (liveTranscriptionRequested ? ', plus best-effort live speech-to-text' : '') +
            `) -- import as a subtitle/caption track in Premiere, DaVinci Resolve, etc.`,
        '',
        'This SRT is generated from in-app EVENTS, not full audio transcription. For a real speech',
        'transcript of the audio track, run it through an existing speech-to-text tool after the fact',
        '(e.g. whisper.cpp / faster-whisper locally, or a cloud STT API) -- see this repo\'s README',
        '"Transcription" section for pointers. If live transcription was enabled for this recording,',
        'best-effort speech events are already interleaved into the SRT above as `[SPEECH]` lines.',
    ];
    return lines.join('\n');
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
export async function startRecording(userName = 'Player', { liveTranscription = false } = {}) {
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

        // NEW: optional best-effort live transcription -- see this file's
        // header doc comment ("TRANSCRIPTION") for what this is and isn't.
        liveTranscriptionRequested = !!liveTranscription;
        if (liveTranscriptionRequested) {
            startLiveTranscription();
        }

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

    stopLiveTranscription(); // NEW: no-op if it was never started

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

async function handleRecordingStop() {
    if (recordedChunks.length === 0) {
        showToast('No video captured.', 'warning');
        return;
    }

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const srtContent = generateSrtContent();

    // NEW: one .zip download (recording.webm + events.srt + session-info.txt)
    // instead of two separate files landing a moment apart -- see this
    // file's "PACKAGING" header doc comment.
    await downloadRecordingBundle(blob, srtContent, timestamp);

    recordedChunks = [];
    recordingEvents = [];

    showToast('💾 Session recording bundle saved (.zip: video + SRT).', 'success');
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
        stopLiveTranscription();
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
    isLiveTranscriptionSupported,
    destroy: destroyMediaModule,
    _handleBroadcast: handleMediaBroadcast,
    _broadcastStatus: broadcastRecordingStatus
};
