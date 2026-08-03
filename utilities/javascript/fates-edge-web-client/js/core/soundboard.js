/**
 * Soundboard — scene ambience loop + one-shot SFX board.
 *
 * Deliberately built on the plain HTML5 Audio API (new Audio(url)) rather than
 * Tone.js or any other CDN dependency — one <audio> element loops the current
 * ambience track, and one-shot SFX just spin up a short-lived Audio() each.
 * No WebAudio graph, no external script tag to add to index.html, so this
 * can't fail to load the way a CDN-dependent library could.
 *
 * Sound entries are just {id, name, url, type: 'ambience'|'sfx', volume} — the
 * `url` can point at anything the browser can play (a hosted mp3/ogg, or a
 * user-supplied link). Saved to state.soundboard.tracks so it persists and
 * syncs like everything else in this app.
 */

import { getState, saveState } from './state.js';
import { generateId } from './utils.js';

let ambienceEl = null;
let currentAmbienceId = null;
let ambienceVolume = 0.5;
let sfxVolume = 0.8;

function ensureSoundboardState() {
    const state = getState();
    if (!state.soundboard || typeof state.soundboard !== 'object') {
        state.soundboard = { tracks: [] };
    }
    if (!Array.isArray(state.soundboard.tracks)) {
        state.soundboard.tracks = [];
    }
    return state.soundboard;
}

export function getSoundTracks() {
    return ensureSoundboardState().tracks;
}

export function addSoundTrack({ name, url, type = 'sfx', volume = 1 }) {
    if (!name || !url) return null;
    const sb = ensureSoundboardState();
    const track = { id: generateId('sound_'), name: name.trim(), url: url.trim(), type, volume: Math.min(1, Math.max(0, volume)) };
    sb.tracks.push(track);
    saveState();
    return track;
}

export function removeSoundTrack(id) {
    const sb = ensureSoundboardState();
    sb.tracks = sb.tracks.filter(t => t.id !== id);
    if (currentAmbienceId === id) stopAmbience();
    saveState();
    return true;
}

/**
 * Start looping an ambience track. Stops/replaces whatever ambience track (if
 * any) was already playing — only one ambience loop plays at a time, same as
 * every VTT's ambience layer.
 */
export function playAmbience(id) {
    const track = getSoundTracks().find(t => t.id === id);
    if (!track) return false;

    if (ambienceEl) {
        ambienceEl.pause();
        ambienceEl.src = '';
    }
    ambienceEl = new Audio(track.url);
    ambienceEl.loop = true;
    ambienceEl.volume = ambienceVolume * (track.volume ?? 1);
    currentAmbienceId = id;
    ambienceEl.play().catch(err => {
        console.warn('[Soundboard] Ambience playback blocked or failed:', err?.message);
    });
    return true;
}

export function stopAmbience() {
    if (ambienceEl) {
        ambienceEl.pause();
        ambienceEl.src = '';
        ambienceEl = null;
    }
    currentAmbienceId = null;
}

export function getCurrentAmbienceId() {
    return currentAmbienceId;
}

export function setAmbienceVolume(vol) {
    ambienceVolume = Math.min(1, Math.max(0, vol));
    if (ambienceEl) ambienceEl.volume = ambienceVolume;
}

export function setSfxVolume(vol) {
    sfxVolume = Math.min(1, Math.max(0, vol));
}

/**
 * Fire a one-shot sound effect. Multiple SFX can overlap (each gets its own
 * Audio() instance) — that's normal for a soundboard (e.g. two quick sword clangs).
 */
export function playSfx(id) {
    const track = getSoundTracks().find(t => t.id === id);
    if (!track) return false;
    try {
        const audio = new Audio(track.url);
        audio.volume = sfxVolume * (track.volume ?? 1);
        audio.play().catch(err => {
            console.warn('[Soundboard] SFX playback blocked or failed:', err?.message);
        });
    } catch (err) {
        console.warn('[Soundboard] Failed to play SFX:', err?.message);
        return false;
    }
    return true;
}

export default {
    getSoundTracks,
    addSoundTrack,
    removeSoundTrack,
    playAmbience,
    stopAmbience,
    getCurrentAmbienceId,
    setAmbienceVolume,
    setSfxVolume,
    playSfx,
};
