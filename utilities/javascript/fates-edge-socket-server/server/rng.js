/**
 * Per-room, seedable PRNG (xorshift128) for reproducible deck shuffles.
 *
 * BEFORE this file existed, every shuffle in server/deck.js called the
 * global, unseedable Math.random() directly (see shuffleArray()/buildDeck()
 * there -- "deterministic shuffle (not used for server, but kept for
 * parity)" was previously just a dead comment; there was no seeding
 * anywhere on the server side, deterministic or otherwise, and no way to
 * reproduce a given room's draw sequence at all).
 *
 * This module gives each ROOM its own independent, reproducible sequence:
 * two rooms seeded identically draw the exact same cards in the exact same
 * order, and neither room's draws affect the other's, because each room
 * carries its own PRNG state rather than everyone sharing one process-wide
 * generator. That's the "Option B" tradeoff from the architecture note --
 * costs one small object on room.data, and unlocks reproducible draws for
 * tournament play, bug repro ("replay room ABCD's exact deck with seed
 * 12345"), and testing.
 *
 * State lives at room.data.deckSeed (the human-facing seed, any string/
 * number) and room.data.deckRngState (the four 32-bit xorshift128 words
 * derived from it, mutated in place on every draw) -- both under
 * room.data, matching adventure.js's own room.data.adventure convention
 * rather than inventing a new place to hang per-room state.
 */

'use strict';

/**
 * Hash an arbitrary seed (string or number) into four nonzero 32-bit
 * words -- xorshift128 is undefined for an all-zero state, so each word
 * falls back to a small nonzero constant if the hash happens to produce
 * exactly zero (astronomically unlikely, but cheap to guard against).
 * Not cryptographic -- this only needs to be a good *scrambler* from a
 * human-typed seed into well-distributed starting state, not secure.
 */
function hashSeedToState(seed) {
    const str = String(seed);
    let h1 = 0x9e3779b9;
    let h2 = 0x243f6a88;
    let h3 = 0xb7e15162 | 0;
    let h4 = 0x85ebca6b | 0;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 2654435761);
        h2 = Math.imul(h2 ^ c, 2246822519);
        h3 = Math.imul(h3 ^ c, 3266489917);
        h4 = Math.imul(h4 ^ c, 668265263);
    }
    return {
        x: (h1 >>> 0) || 1,
        y: (h2 >>> 0) || 2,
        z: (h3 >>> 0) || 3,
        w: (h4 >>> 0) || 4,
    };
}

/** Advance a { x, y, z, w } state object in place one step, returning a float in [0, 1). */
function nextFloat(state) {
    let { x, y, z, w } = state;
    const t = (x ^ (x << 11)) >>> 0;
    x = y; y = z; z = w;
    w = ((w ^ (w >>> 19)) ^ (t ^ (t >>> 8))) >>> 0;
    state.x = x; state.y = y; state.z = z; state.w = w;
    return w / 4294967296;
}

/** A fresh, unpredictable seed for rooms that never explicitly set one -- still fine to use Math.random() here, since it's a ONE-TIME initialization, not the per-draw generator itself. */
function generateRandomSeed() {
    return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
}

/**
 * Ensure room.data.deckSeed/deckRngState exist (auto-generating a random
 * seed the first time a room draws, so existing rooms behave exactly as
 * before -- unpredictable draws -- unless a seed is explicitly set), and
 * return a `rng()` function bound to THIS room's own state. Every call to
 * the returned function advances that room's state and only that room's
 * state -- pass it into deck.buildDeck(rng)/deck.shuffleArray(arr, rng)
 * instead of letting those functions fall back to Math.random().
 */
function getRoomRng(room) {
    if (!room.data) room.data = {};
    if (!room.data.deckSeed) {
        room.data.deckSeed = generateRandomSeed();
    }
    if (!room.data.deckRngState) {
        room.data.deckRngState = hashSeedToState(room.data.deckSeed);
    }
    return () => nextFloat(room.data.deckRngState);
}

/**
 * Explicitly (re)seed a room's deck RNG -- e.g. a GM setting a known seed
 * for reproducible draws. Resets deckRngState from scratch so the new
 * seed's sequence starts fresh from position zero; does NOT touch
 * room.deck itself (callers that want the reseed to also take effect
 * immediately should rebuild the deck with deck.buildDeck(getRoomRng(room))
 * right after calling this).
 */
function setRoomSeed(room, seed) {
    if (!room.data) room.data = {};
    room.data.deckSeed = String(seed);
    room.data.deckRngState = hashSeedToState(room.data.deckSeed);
}

/** Read-only peek at a room's current seed (auto-generating+persisting one if absent), for a "what seed is this room on?" API response. */
function getRoomSeed(room) {
    if (!room.data) room.data = {};
    if (!room.data.deckSeed) {
        room.data.deckSeed = generateRandomSeed();
        room.data.deckRngState = hashSeedToState(room.data.deckSeed);
    }
    return room.data.deckSeed;
}

module.exports = {
    getRoomRng,
    setRoomSeed,
    getRoomSeed,
    generateRandomSeed,
    // exported mainly for unit tests -- exercise the hash/step functions
    // directly without needing a fake room object.
    hashSeedToState,
    nextFloat,
};
