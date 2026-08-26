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
 *
 * NEW (Reactive Soundscape): playAmbience() now accepts an optional
 * `{ transitionDuration }` and crossfades into the new track instead of
 * hard-cutting, when a duration is given. This is what lets the
 * `soundboard-ambience` WS event (fired by the AI GM bot's mood ->
 * trackId profile — see ai-gm-bot's adventure-context.js and
 * process-tags.js's [MOOD "..."] tag) smoothly swap ambience mid-scene
 * instead of jarringly snapping the music. Manual UI clicks (gm-tools'
 * board) still default to an instant switch (transitionDuration
 * omitted/0) — nothing about that existing behavior changes.
 *
 * Crossfade is done with plain <audio>.volume ramping via
 * requestAnimationFrame across two overlapping Audio() elements, not a
 * WebAudio GainNode graph — consistent with the "no WebAudio graph"
 * design note above; a manual volume ramp gets the same audible result
 * for a single ambience loop without pulling in an AudioContext.
 */

import { getState, saveState } from './state.js';
import { generateId } from './utils.js';

let ambienceEl = null;       // the currently-targeted ambience element (fading in, or already steady)
let fadingOutEl = null;      // the previous ambience element, fading out (null once torn down)
let fadeHandle = null;       // requestAnimationFrame handle for an in-progress crossfade
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
 * Attach (or clear, passing null) attribution metadata to a track --
 * used by the "Search Sounds" feature (see
 * js/features/gm-tools/sound-search.js) when a CC-licensed sound that
 * requires attribution is added, so credit can be displayed later without
 * the caller reaching into soundboard state directly.
 */
export function setTrackAttribution(id, attribution) {
    const sb = ensureSoundboardState();
    const track = sb.tracks.find(t => t.id === id);
    if (!track) return false;
    if (attribution) {
        track.attribution = attribution;
    } else {
        delete track.attribution;
    }
    saveState();
    return true;
}

function cancelFade() {
    if (fadeHandle !== null) {
        cancelAnimationFrame(fadeHandle);
        fadeHandle = null;
    }
    // A cancelled fade still needs its outgoing element torn down --
    // otherwise it's left paused-but-not-cleaned-up, silently holding a
    // decoded audio buffer for a track no client control ever stops.
    if (fadingOutEl) {
        fadingOutEl.pause();
        fadingOutEl.src = '';
        fadingOutEl = null;
    }
}

/**
 * Start looping an ambience track. Stops/replaces whatever ambience track (if
 * any) was already playing — only one ambience loop plays at a time, same as
 * every VTT's ambience layer.
 *
 * `transitionDuration` (ms) is optional. When omitted or 0 (or nothing is
 * currently playing to fade from), this is an instant hard-cut switch —
 * identical to this function's original behavior. When given a positive
 * value, the new track fades in from silence while the old one fades out
 * over that duration, then the old element is torn down.
 */
export function playAmbience(id, { transitionDuration = 0 } = {}) {
    const track = getSoundTracks().find(t => t.id === id);
    if (!track) return false;

    const targetVolume = ambienceVolume * (track.volume ?? 1);
    const newEl = new Audio(track.url);
    newEl.loop = true;

    const outgoing = ambienceEl;

    if (!transitionDuration || transitionDuration <= 0 || !outgoing) {
        // Instant switch -- same behavior as before crossfade existed.
        cancelFade();
        if (outgoing) {
            outgoing.pause();
            outgoing.src = '';
        }
        newEl.volume = targetVolume;
        currentAmbienceId = id;
        ambienceEl = newEl;
        newEl.play().catch(err => {
            console.warn('[Soundboard] Ambience playback blocked or failed:', err?.message);
        });
        return true;
    }

    // Crossfade: any fade already in flight gets cut short (its outgoing
    // element torn down) so we never end up ramping three overlapping
    // tracks at once.
    cancelFade();
    fadingOutEl = outgoing;
    const outgoingStartVolume = outgoing.volume;

    newEl.volume = 0;
    currentAmbienceId = id;
    ambienceEl = newEl;
    newEl.play().catch(err => {
        console.warn('[Soundboard] Ambience playback blocked or failed:', err?.message);
    });

    const startedAt = performance.now();
    const step = (now) => {
        const elapsed = now - startedAt;
        const t = Math.min(1, elapsed / transitionDuration);
        newEl.volume = targetVolume * t;
        outgoing.volume = outgoingStartVolume * (1 - t);
        if (t < 1) {
            fadeHandle = requestAnimationFrame(step);
        } else {
            outgoing.pause();
            outgoing.src = '';
            if (fadingOutEl === outgoing) fadingOutEl = null;
            fadeHandle = null;
        }
    };
    fadeHandle = requestAnimationFrame(step);
    return true;
}

export function stopAmbience() {
    cancelFade();
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
    // Only rescales the steady (non-fading) element -- nudging volume
    // mid-crossfade would fight the ramp's own math and produce an
    // audible glitch, and the ramp already converges on the correct
    // ambienceVolume-scaled target by its final frame regardless.
    //
    // FIX: this used to set ambienceEl.volume = ambienceVolume directly,
    // ignoring the current track's own per-track `volume` multiplier --
    // so calling this while a track with e.g. volume: 0.5 was playing
    // would audibly jump it louder than playAmbience() had originally
    // set it to. Re-derive from the actual current track instead.
    if (ambienceEl && fadeHandle === null) {
        const track = getSoundTracks().find(t => t.id === currentAmbienceId);
        ambienceEl.volume = ambienceVolume * (track?.volume ?? 1);
    }
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
    setTrackAttribution,
    playAmbience,
    stopAmbience,
    getCurrentAmbienceId,
    setAmbienceVolume,
    setSfxVolume,
    playSfx,
};
