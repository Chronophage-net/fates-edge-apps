/**
 * AI GM Voice Narration playback (optional).
 *
 * Companion to voice.js, but much simpler: there's no WebRTC peer here,
 * just a one-way 'tts-audio' WebSocket event (base64-encoded audio,
 * broadcast by the socket server exactly like 'chat-message' -- see
 * server/socketio-handlers.js's relayEvents / server/ws-handlers.js's
 * matching case) that this module decodes and plays with the Web Audio
 * API. The AI GM bot is what sends it, when TTS_ENABLED is configured
 * there -- see fates-edge-ai-gm-bot's modules/tts-client.js and its
 * README's "Voice Narration" section for the full picture.
 *
 * Off by default is a UX choice, not a technical one (the bot won't
 * send anything unless *it's* configured for TTS either way): a table
 * that hasn't opted in shouldn't suddenly hear the GM's replies spoken
 * aloud the first time someone enables TTS server-side. Toggle and
 * volume persist per-browser via localStorage, same pattern as the
 * existing voice/notification-sound settings elsewhere in this file
 * tree.
 */

import { onWSEvent, offWSEvent } from '../../core/websocket.js';

const ENABLED_KEY = 'fates-edge-tts-narration-enabled';
const VOLUME_KEY = 'fates-edge-tts-narration-volume';

let audioContext = null;
let gainNode = null;
let currentSource = null;
let listenerRegistered = false;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.gain.value = getNarrationVolume();
        gainNode.connect(audioContext.destination);
    }
    return audioContext;
}

/** Off by default -- see file header note on why. */
export function isNarrationEnabled() {
    return localStorage.getItem(ENABLED_KEY) === 'true';
}

export function setNarrationEnabled(enabled) {
    localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
    if (!enabled) stopNarration();
}

export function getNarrationVolume() {
    const stored = parseFloat(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 0.8;
}

export function setNarrationVolume(vol) {
    const clamped = Math.min(1, Math.max(0, Number(vol) || 0));
    localStorage.setItem(VOLUME_KEY, String(clamped));
    if (gainNode) gainNode.gain.value = clamped;
}

/** Stop whatever narration clip is currently playing (e.g. toggled off mid-speech, or a new one is about to start). */
export function stopNarration() {
    if (currentSource) {
        try { currentSource.stop(); } catch (e) { /* already stopped/ended */ }
        try { currentSource.disconnect(); } catch (e) { /* ignore */ }
        currentSource = null;
    }
}

function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
}

function playAudioBuffer(arrayBuffer, text) {
    const ctx = getAudioContext();
    // Autoplay policy: the AudioContext can only resume from a prior user
    // gesture on the page (connecting to a room, clicking a button, etc.)
    // -- by the time narration audio actually arrives, that gesture has
    // essentially always already happened.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    ctx.decodeAudioData(arrayBuffer.slice(0), (buffer) => {
        stopNarration(); // don't overlap with a still-playing previous line
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNode);
        source.onended = () => {
            if (currentSource === source) currentSource = null;
        };
        source.start(0);
        currentSource = source;
        if (text) console.log(`🔊 [TTS] "${String(text).slice(0, 80)}${text.length > 80 ? '…' : ''}"`);
    }, (err) => {
        console.warn('[TTS] Failed to decode narration audio:', err);
    });
}

function handleTtsAudio(data) {
    if (!isNarrationEnabled()) return;
    const { audio, text } = data || {};
    if (!audio) return;
    try {
        playAudioBuffer(base64ToArrayBuffer(audio), text);
    } catch (e) {
        console.warn('[TTS] Failed to play narration audio:', e);
    }
}

/** Registers the 'tts-audio' listener. Safe to call more than once -- a second call is a no-op until cleanupTtsNarration() runs. */
export function initTtsNarration() {
    if (listenerRegistered) return;
    onWSEvent('tts-audio', handleTtsAudio);
    listenerRegistered = true;
}

export function cleanupTtsNarration() {
    if (listenerRegistered) {
        offWSEvent('tts-audio', handleTtsAudio);
        listenerRegistered = false;
    }
    stopNarration();
}

export default {
    initTtsNarration,
    cleanupTtsNarration,
    isNarrationEnabled,
    setNarrationEnabled,
    getNarrationVolume,
    setNarrationVolume,
    stopNarration
};
