// features/decks/index.js
/**
 * Decks feature - Deck of Consequences and Crown Spread
 * Supports single draw, multiple draw, and Crown Spread (4+1 wildcard).
 * Loads region data dynamically from /regions/.
 * Supports WebSocket sync for multiplayer draws.
 * Uses deterministic RNG for static/demo deployments.
 */

import { shuffleArray } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { getState, addTimer } from '../../core/state.js';
import { logRecordingEvent } from '../../core/media.js';

// ============================================================
// CONSTANTS
// ============================================================

const SUITS = ['hearts', 'spades', 'clubs', 'diamonds'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOLS = { hearts: '♥', spades: '♠', clubs: '♣', diamonds: '♦' };
const SUIT_COLORS = { hearts: '#c0392b', spades: '#2c3e50', clubs: '#27ae60', diamonds: '#2980b9' };
const SUIT_NAMES = { hearts: 'Hearts', spades: 'Spades', clubs: 'Clubs', diamonds: 'Diamonds' };
const RANK_NAMES = { 
    'A': 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
    '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten',
    'J': 'Jack', 'Q': 'Queen', 'K': 'King'
};

const POKER_RANK = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
const SUIT_ORDER = { 'spades': 4, 'hearts': 3, 'diamonds': 2, 'clubs': 1 };

// Generic twist table for wildcard (extra card)
const DEFAULT_TWISTS = [
    "A sudden storm or environmental shift changes the scene.",
    "An unexpected ally appears with conflicting motives.",
    "A minor curse or blessing from a Patron alters the odds.",
    "A forgotten debt is called in at the worst moment.",
    "The ground beneath you gives way—literal or figurative.",
    "A piece of evidence surfaces that reframes everything.",
    "A rival's plan backfires, creating chaos for everyone.",
    "A moment of clarity reveals a hidden truth.",
];

// Crown Spread positions with interpretive meaning
const CROWN_POSITIONS = [
    { 
        key: 'root', 
        label: 'Root', 
        icon: '🌱', 
        desc: 'The underlying tension or theme of the situation.',
        interpretive: 'What has been growing beneath the surface? What unresolved debt, hidden grudge, or quiet truth has brought you to this moment?'
    },
    { 
        key: 'crest', 
        label: 'Crest', 
        icon: '🏔️', 
        desc: 'A key faction, patron, or influence that will rise.',
        interpretive: 'What power is gathering strength? Who or what will demand your attention—and what will they ask of you?'
    },
    { 
        key: 'crown', 
        label: 'Crown', 
        icon: '👑', 
        desc: 'The climax image or major confrontation.',
        interpretive: 'What is the shape of the storm that awaits? What must you face, and what will it cost to meet it?'
    },
    { 
        key: 'left', 
        label: 'Left Hand', 
        icon: '🤝', 
        desc: 'A bond, ally, or relationship that anchors play.',
        interpretive: 'Who stands with you? What connection will be tested—and what will it take to keep it whole?'
    },
];

// ============================================================
// ACE EFFECTS
// ============================================================

const ACE_EFFECTS = {
    generic: [
        { emoji: '👻', text: 'The Hollow takes notice. A pale figure watches from the corner of your eye.' },
        { emoji: '🔔', text: 'A bell rings without being struck. The ninth chime is silent.' },
        { emoji: '🌫️', text: 'Mist rolls in, carrying whispers of a debt unpaid.' },
        { emoji: '🕯️', text: 'A candle gutters and relights itself, burning blue.' },
        { emoji: '🃏', text: 'The Joker\'s wildcard manifests — the unexpected becomes inevitable.' },
        { emoji: '🌙', text: 'The moon flickers. For a moment, you see two shadows.' },
        { emoji: '⚖️', text: 'A scale appears in the air, weighing something you cannot see.' },
        { emoji: '🕸️', text: 'A spider web glistens in the corner, its threads forming a pattern you almost recognize.' }
    ],
    acasia: [
        { emoji: '🌿', text: 'The Curse stirs. A crossroads behind you now leads to a place you have already been.' },
        { emoji: '🪦', text: 'A broken milestone weeps rust. The empire\'s ghost is counting.' },
        { emoji: '🔥', text: 'A free company’s banner flickers in the distance, its colors changed.' }
    ],
    ecktoria: [
        { emoji: '🏛️', text: 'A statue turns its head to watch you. The marble is warm.' },
        { emoji: '⚜️', text: 'A seal appears on your documents that you did not stamp. The Vigil is watching.' },
        { emoji: '🔥', text: 'The Everflame burns blue. A forgotten precedent surfaces.' }
    ],
    vhasia: [
        { emoji: '☀️', text: 'The sun fractures. You see a reflection of Lence in every mirror.' },
        { emoji: '🗡️', text: 'A knight’s gorget unbuckles on its own. Chivalry is a weight.' },
        { emoji: '👑', text: 'A crown sits on a throne that was empty a moment ago. The claimant is watching.' }
    ],
    viterra: [
        { emoji: '🌳', text: 'A hedge grows where no hedge was before. The boundary has moved.' },
        { emoji: '⚖️', text: 'A legal duel is declared in your name. You have one hour to prepare.' },
        { emoji: '🛡️', text: 'The Queen\'s Justiciar passes by. She does not see you—yet.' }
    ],
    ykrul: [
        { emoji: '🐺', text: 'A wolf howls in the distance. The steppe is counting its debts.' },
        { emoji: '🌾', text: 'A white squall approaches. The wind carries the names of the dead.' },
        { emoji: '⚔️', text: 'A hostage string is cut. A feud rekindles.' }
    ],
    silkstrand: [
        { emoji: '🌊', text: 'The canals run red. The dye-water curse awakens.' },
        { emoji: '🕊️', text: 'A bridge token appears in your pocket. No one knows who left it.' },
        { emoji: '📜', text: 'A contract is voided in invisible ink. You owe nothing—and everything.' }
    ],
    mistlands: [
        { emoji: '🔔', text: 'A bell-line fails. Something steps through the gap.' },
        { emoji: '🧂', text: 'The salt pans turn gray. The wards are weakening.' },
        { emoji: '🌫️', text: 'The mist takes a name. You feel lighter.' }
    ],
    thepyrgos: [
        { emoji: '🔑', text: 'A stair appears where none should be. The Unfinished Stair calls.' },
        { emoji: '📚', text: 'An archive shelf unlocks itself. A forbidden truth is revealed.' },
        { emoji: '🔔', text: 'A bell tolls nine times. The Synod is in session.' }
    ],
    ubral: [
        { emoji: '🪨', text: 'A cairn adds a new stone. The dead have voted.' },
        { emoji: '⚔️', text: 'A guest-right is broken. Blood will answer.' },
        { emoji: '🐎', text: 'A riderless horse appears on the ridge. It waits for you.' }
    ],
    valewood: [
        { emoji: '🌲', text: 'A star-road phases into existence. The forest remembers.' },
        { emoji: '🍃', text: 'A leaf falls upward, pointing to a hidden threshold.' },
        { emoji: '👑', text: 'The Hazel Queen’s laughter echoes through the trees.' }
    ],
    aelinnel: [
        { emoji: '🔮', text: 'A geas forms on your tongue. Choose your next words carefully.' },
        { emoji: '🌿', text: 'The Green Gate opens at the wrong hour. Roads rewire.' },
        { emoji: '🕊️', text: 'A fae courtier offers a gift. Accepting may cost more than you know.' }
    ],
    aelaerem: [
        { emoji: '🍎', text: 'The Hollow walks. The ninth cup is poured.' },
        { emoji: '🐦', text: 'The watch-geese fall silent. Someone is coming.' },
        { emoji: '🌾', text: 'The scarecrow turns to face you. It knows your name.' }
    ],
    zakov: [
        { emoji: '🌊', text: 'The tide turns early. The reef is hungry.' },
        { emoji: '💎', text: 'A crystalline shard glows in the dark. The Reaping stirs.' },
        { emoji: '🏴‍☠️', text: 'The Salt Prince raises the levy. Every ship pays.' }
    ],
};

// ============================================================
// DETERMINISTIC RNG
// ============================================================

// Use a module-level closure to avoid global conflicts
const _deckSeedState = {
    seed: null,
    prng: null
};

class Xorshift128 {
    constructor(seed) {
        this.seed = seed;
        this.state = this._seedToState(seed);
    }
    
    _seedToState(seed) {
        let s0 = 0;
        let s1 = 0;
        
        if (typeof seed === 'number') {
            s0 = seed;
            s1 = seed + 0x9e3779b97f4a7c15;
        } else if (typeof seed === 'string') {
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                hash = hash & hash;
            }
            s0 = hash;
            s1 = hash + 0x9e3779b97f4a7c15;
        } else {
            s0 = Date.now();
            s1 = Date.now() + 0x9e3779b97f4a7c15;
        }
        
        return { s0: BigInt(s0), s1: BigInt(s1) };
    }
    
    random() {
        let s0 = this.state.s0;
        let s1 = this.state.s1;
        
        let x = s1;
        let y = s0;
        
        x = x ^ (x << BigInt(23));
        x = x ^ (x >> BigInt(17));
        x = x ^ (y ^ (y >> BigInt(26)));
        
        this.state.s0 = y;
        this.state.s1 = x;
        
        const result = Number((x + y) & BigInt(0xFFFFFFFFFFFFFFFF)) / 18446744073709551616;
        return result;
    }
    
    randomInt(min, max) {
        return Math.floor(this.random() * (max - min)) + min;
    }
    
    randomIntInclusive(min, max) {
        return Math.floor(this.random() * (max - min + 1)) + min;
    }
}

// Seed management functions
export function getDeckSeed() {
    return _deckSeedState.seed;
}

export function setDeckSeed(seed) {
    _deckSeedState.seed = seed;
    if (seed) {
        _deckSeedState.prng = new Xorshift128(seed);
        try {
            localStorage.setItem('fates-edge-deck-seed', seed);
        } catch (e) { /* ignore */ }
    } else {
        _deckSeedState.prng = null;
        try {
            localStorage.removeItem('fates-edge-deck-seed');
        } catch (e) { /* ignore */ }
    }
    return true;
}

export function generateDeckSeed() {
    try {
        if (window && window.crypto && window.crypto.getRandomValues) {
            const array = new Uint32Array(4);
            window.crypto.getRandomValues(array);
            return array.reduce((acc, val) => acc + val.toString(16).padStart(8, '0'), '');
        }
    } catch (e) { /* ignore */ }
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// Initialize seed from localStorage
try {
    const stored = localStorage.getItem('fates-edge-deck-seed');
    if (stored) {
        _deckSeedState.seed = stored;
        _deckSeedState.prng = new Xorshift128(stored);
        console.log('[Decks] Seed loaded from localStorage:', stored.substring(0, 8) + '...');
    }
} catch (e) { /* ignore */ }

// Also try to load from window seed (set by build script for static sites)
if (!_deckSeedState.seed && typeof window !== 'undefined' && window.__RANDOM_SEED) {
    _deckSeedState.seed = window.__RANDOM_SEED;
    _deckSeedState.prng = new Xorshift128(_deckSeedState.seed);
    try {
        localStorage.setItem('fates-edge-deck-seed', _deckSeedState.seed);
        console.log('[Decks] Seed loaded from window.__RANDOM_SEED:', _deckSeedState.seed.substring(0, 8) + '...');
    } catch (e) { /* ignore */ }
}

// If no seed found, check if dice module has one (share seed across features)
if (!_deckSeedState.seed && typeof window !== 'undefined') {
    try {
        const diceSeed = localStorage.getItem('fates-edge-seed');
        if (diceSeed) {
            _deckSeedState.seed = diceSeed;
            _deckSeedState.prng = new Xorshift128(_deckSeedState.seed);
            localStorage.setItem('fates-edge-deck-seed', _deckSeedState.seed);
            console.log('[Decks] Seed shared from dice module:', _deckSeedState.seed.substring(0, 8) + '...');
        }
    } catch (e) { /* ignore */ }
}

// Deterministic random functions for deck operations
function getDeckRandom() {
    if (_deckSeedState.prng) {
        return _deckSeedState.prng.random();
    }
    try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            return array[0] / 4294967296;
        }
    } catch (e) { /* ignore */ }
    return Math.random();
}

function getDeckRandomInt(min, max) {
    if (_deckSeedState.prng) {
        return _deckSeedState.prng.randomInt(min, max);
    }
    return Math.floor(getDeckRandom() * (max - min)) + min;
}

function getDeckRandomIntInclusive(min, max) {
    if (_deckSeedState.prng) {
        return _deckSeedState.prng.randomIntInclusive(min, max);
    }
    return Math.floor(getDeckRandom() * (max - min + 1)) + min;
}

function deterministicShuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = getDeckRandomInt(0, i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ============================================================
// STATE
// ============================================================

let container = null;
let deck = [];
let deckHistory = [];
let regionData = null;
let regionNames = [];
let selectedRegion = null;
let cardOffset = 0;
let isInitialized = false;
let isSyncing = false;
let regionChangeCallbacks = [];

// Generate initial card offset using deterministic RNG
cardOffset = getDeckRandomInt(0, 1000);

// ============================================================
// HELPERS
// ============================================================

function getRegionSlug(name) {
    return name.toLowerCase().replace(/ /g, '_');
}

function getCardMeaningFromRegion(suit, rank, regionData) {
    const suitKey = suit;
    const arr = regionData[suitKey];
    if (!arr || arr.length === 0) {
        return `A complication of ${suit} arises.`;
    }
    const seed = suit + rank + cardOffset;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    const index = Math.abs(hash) % arr.length;
    return arr[index];
}

function getWildcardMeaning(card, regionData) {
    const twists = DEFAULT_TWISTS;
    const seed = (card.suit || 'joker') + (card.rank || '') + cardOffset + 999;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    const idx = Math.abs(hash) % twists.length;
    const cardName = card.isJoker ? 'Joker' : `${card.rankName} of ${card.suitName}`;
    return `✨ Twist (${cardName}): ${twists[idx]}`;
}

function getAceEffect(region, card) {
    const regionKey = region ? region.toLowerCase() : 'generic';
    let effects = ACE_EFFECTS[regionKey];
    if (!effects) {
        const match = Object.keys(ACE_EFFECTS).find(key => 
            key !== 'generic' && regionKey.includes(key)
        );
        if (match) effects = ACE_EFFECTS[match];
    }
    if (!effects) effects = ACE_EFFECTS.generic;
    
    const seed = (card?.suit || '') + (card?.rank || '') + 'deck';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    const idx = Math.abs(hash) % effects.length;
    return effects[idx];
}

// ============================================================
// WEBSOCKET SYNC
// ============================================================

async function getSyncManager() {
    try {
        const module = await import('../../core/sync/index.js');
        return module.syncManager;
    } catch {
        return null;
    }
}

function broadcastDraw(cards, type, region, synthesis) {
    getSyncManager().then(syncManager => {
        if (syncManager && syncManager.isConnected && syncManager.send) {
            const cardData = cards.map(c => ({
                suit: c.suit,
                rank: c.rank,
                symbol: c.symbol,
                rankName: c.rankName,
                suitName: c.suitName,
                isJoker: c.isJoker || false
            }));
            
            syncManager.send({
                type: 'deck_draw',
                action: 'draw',
                cards: cardData,
                drawType: type,
                region: region,
                synthesis: synthesis,
                timestamp: Date.now()
            });
            console.log('📡 Broadcasted deck draw via WebSocket');
        }
    }).catch(() => {});
}

function broadcastReset() {
    getSyncManager().then(syncManager => {
        if (syncManager && syncManager.isConnected && syncManager.send) {
            syncManager.send({
                type: 'deck_draw',
                action: 'reset',
                timestamp: Date.now()
            });
            console.log('📡 Broadcasted deck reset via WebSocket');
        }
    }).catch(() => {});
}

// ============================================================
// CROWN SPREAD INTERPRETATION
// ============================================================

function interpretCrownCard(card, position, regionData) {
    if (card.isJoker) {
        return {
            title: '🃏 Joker — The Wildcard',
            description: 'The unexpected. The impossible. A force that does not follow the rules. This card breaks the pattern—what was certain is now uncertain. The Joker is the Hollow\'s laughter, the Patron\'s whim, the die that rolls off the table. Expect the unexpected, and prepare to adapt.',
            regionMeaning: null
        };
    }

    const regionMeaning = getCardMeaningFromRegion(card.suit, card.rank, regionData);
    const rankName = RANK_NAMES[card.rank] || card.rank;
    const suitName = SUIT_NAMES[card.suit];
    const suitSymbol = SUIT_SYMBOLS[card.suit];
    const color = SUIT_COLORS[card.suit];
    
    const positionFraming = {
        root: `This is what has been growing beneath the surface—the root of the matter.`,
        crest: `This is what is gathering strength—the rising force you cannot ignore.`,
        crown: `This is the shape of the storm that awaits—the confrontation you must face.`,
        left: `This is what anchors you—the bond, ally, or resource that will see you through.`
    };

    const description = `${positionFraming[position.key]}\n\n${regionMeaning}`;

    return {
        title: `${suitSymbol} ${rankName} of ${suitName}`,
        description: description,
        regionMeaning: regionMeaning,
        suit: card.suit,
        rank: card.rank,
        color: color,
        symbol: suitSymbol
    };
}

function synthesiseCrownSpread(mainCards, wildcard, regionData) {
    const positions = CROWN_POSITIONS;
    const positionCards = mainCards.map((card, i) => {
        const pos = positions[i];
        const interpretation = interpretCrownCard(card, pos, regionData);
        return {
            ...interpretation,
            position: pos,
            card: card,
            isJoker: card.isJoker,
            rankName: card.isJoker ? 'Joker' : RANK_NAMES[card.rank],
            suitName: card.isJoker ? '' : SUIT_NAMES[card.suit]
        };
    });

    const cardsHtml = positionCards.map(p => `
        <div class="crown-card" style="display:flex;flex-direction:column;align-items:center;gap:0.3rem;min-width:80px;">
            <div style="background:var(--bg3);border:2px solid ${p.isJoker ? 'var(--gold)' : p.color};border-radius:var(--radius);padding:0.4rem;text-align:center;width:70px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;${p.isJoker ? 'box-shadow: 0 0 15px rgba(212,175,55,0.3);' : ''}">
                <div style="font-size:0.7rem;color:var(--text3);">${p.position.icon}</div>
                <div style="font-size:1.8rem;color:${p.isJoker ? 'var(--gold)' : p.color};">${p.isJoker ? '🃏' : p.symbol}</div>
                <div style="font-size:0.6rem;color:var(--text2);">${p.isJoker ? 'Joker' : p.rankName}</div>
            </div>
            <div style="font-size:0.6rem;color:var(--text3);text-align:center;max-width:80px;">${p.position.label}</div>
        </div>
    `).join('');

    const wildcardDisplay = `
        <div class="crown-card wildcard" style="display:flex;flex-direction:column;align-items:center;gap:0.3rem;min-width:80px;">
            <div style="background:var(--bg3);border:2px solid var(--gold);border-radius:var(--radius);padding:0.4rem;text-align:center;width:70px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow: 0 0 20px rgba(212,175,55,0.4);animation:pulse-gold 1.5s ease-in-out infinite;">
                <div style="font-size:0.7rem;color:var(--gold);">🌟</div>
                <div style="font-size:1.8rem;color:var(--gold);">🃏</div>
                <div style="font-size:0.6rem;color:var(--gold);">Wildcard</div>
            </div>
            <div style="font-size:0.6rem;color:var(--gold);text-align:center;max-width:80px;">Wildcard<br>Twist</div>
        </div>
    `;

    const horizontalLayout = `
        <div style="display:flex;justify-content:center;gap:0.5rem;padding:0.5rem;overflow-x:auto;flex-wrap:nowrap;">
            ${cardsHtml}
            <div style="display:flex;align-items:center;color:var(--text3);font-size:1.5rem;padding:0 0.2rem;">+</div>
            ${wildcardDisplay}
        </div>
    `;

    const verticalLayout = positionCards.map(p => `
        <div style="display:grid;grid-template-columns:100px 1fr;gap:0.5rem;padding:0.5rem;background:var(--bg2);border-radius:var(--radius);margin-bottom:0.3rem;border-left:4px solid ${p.isJoker ? 'var(--gold)' : p.color};">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="font-size:1.5rem;color:${p.isJoker ? 'var(--gold)' : p.color};">${p.isJoker ? '🃏' : p.symbol}</div>
                <div style="font-size:0.8rem;font-weight:600;color:var(--gold);">${p.isJoker ? 'Joker' : p.rankName}</div>
                <div style="font-size:0.65rem;color:var(--text3);">${p.position.icon} ${p.position.label}</div>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;">
                <div style="font-size:0.8rem;color:var(--text2);font-weight:600;">${p.position.label}</div>
                <div style="font-size:0.85rem;color:var(--text);line-height:1.4;white-space:pre-wrap;">${p.regionMeaning || p.description}</div>
            </div>
        </div>
    `).join('');

    const wildcardMeaning = getWildcardMeaning(wildcard, regionData);
    const wildcardVertical = `
        <div style="display:grid;grid-template-columns:100px 1fr;gap:0.5rem;padding:0.5rem;background:var(--bg4);border-radius:var(--radius);margin-top:0.3rem;border:2px solid var(--gold);">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="font-size:1.5rem;color:var(--gold);">🌟</div>
                <div style="font-size:0.8rem;font-weight:600;color:var(--gold);">Wildcard</div>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;">
                <div style="font-size:0.8rem;color:var(--gold);font-weight:600;">Wildcard Twist</div>
                <div style="font-size:0.85rem;color:var(--text);line-height:1.4;">${wildcardMeaning}</div>
                <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">The wildcard is the unexpected element—a factor no one saw coming.</div>
            </div>
        </div>
    `;

    let synthesis = `The Crown Spread reveals a story of tension and consequence.\n\n`;
    
    synthesis += `🌱 Root: ${positionCards[0].regionMeaning || positionCards[0].description}\n\n`;
    synthesis += `🏔️ Crest: ${positionCards[1].regionMeaning || positionCards[1].description}\n\n`;
    synthesis += `👑 Crown: ${positionCards[2].regionMeaning || positionCards[2].description}\n\n`;
    synthesis += `🤝 Left Hand: ${positionCards[3].regionMeaning || positionCards[3].description}\n\n`;
    synthesis += `🌟 Wildcard: ${wildcardMeaning}`;

    const nonWildcards = mainCards.filter(c => !c.isJoker);
    let highest = null;
    if (nonWildcards.length > 0) {
        highest = nonWildcards.reduce((a, b) => {
            const rankA = POKER_RANK[a.rank] || 0;
            const rankB = POKER_RANK[b.rank] || 0;
            if (rankA !== rankB) return rankA > rankB ? a : b;
            const suitA = SUIT_ORDER[a.suit] || 0;
            const suitB = SUIT_ORDER[b.suit] || 0;
            return suitA > suitB ? a : b;
        });
    } else {
        highest = mainCards[0];
    }
    
    let timer = null;
    let timerCard = '';
    if (highest) {
        const rankVal = POKER_RANK[highest.rank] || 0;
        let segments = 4;
        if (rankVal >= 14) segments = 10;
        else if (rankVal >= 13) segments = 8;
        else if (rankVal >= 11) segments = 8;
        else if (rankVal >= 10) segments = 6;
        else if (rankVal >= 7) segments = 6;
        else segments = 4;
        timer = segments;
        timerCard = `${highest.rankName} of ${highest.suitName}`;
    }

    if (timer) {
        synthesis += `\n\n⏱️ The highest card (${timerCard}) suggests a timer of ${timer} segments—a pressure that will build until it breaks.`;
    }

    const details = `
        <div class="crown-horizontal" style="margin-bottom:0.8rem;">
            ${horizontalLayout}
            <div style="text-align:center;font-size:0.7rem;color:var(--text3);margin-top:0.3rem;">
                Click a card below to see its meaning
            </div>
        </div>
        
        <div class="crown-vertical" style="border-top:1px solid var(--border);padding-top:0.8rem;">
            <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:0.3rem;">📖 Card Meanings</div>
            ${verticalLayout}
            ${wildcardVertical}
        </div>
    `;

    return {
        synthesis,
        details,
        timer: timer ? { segments: timer, card: timerCard } : null,
        positions: positionCards,
        wildcard: wildcardMeaning,
        horizontalLayout,
        verticalLayout
    };
}

// ============================================================
// LOAD REGION DATA
// ============================================================

async function loadManifest() {
    try {
        const res = await fetch('/regions/manifest.json');
        if (!res.ok) throw new Error('Manifest not found');
        const data = await res.json();
        if (Array.isArray(data)) {
            regionNames = data.map(item => typeof item === 'string' ? item : item.name);
        } else {
            regionNames = [];
        }
    } catch (e) {
        console.warn('[Decks] Could not load manifest:', e);
        regionNames = ['Acasia'];
        try {
            const fallbackRes = await fetch('/regions/acasia.json');
            if (fallbackRes.ok) {
                regionNames = ['Acasia'];
            }
        } catch (fallbackErr) {
            // No fallback, just use default
        }
        if (regionNames.length === 0) {
            regionNames = ['Acasia'];
        }
    }
}

async function fetchRegionData(regionName) {
    if (regionData && regionData.name === regionName) {
        return regionData;
    }
    try {
        const slug = getRegionSlug(regionName);
        const res = await fetch(`/regions/${slug}.json`);
        if (!res.ok) throw new Error(`Region "${regionName}" not found`);
        const data = await res.json();
        regionData = data;
        return data;
    } catch (e) {
        console.warn(`[Decks] Error loading region ${regionName}:`, e);
        const fallbackData = {
            name: regionName,
            description: `${regionName} - A region of Fate's Edge.`,
            hearts: ["A matter of loyalty or love arises."],
            spades: ["A conflict or struggle emerges."],
            clubs: ["A physical challenge or obstacle appears."],
            diamonds: ["A resource, treasure, or opportunity is found."]
        };
        regionData = fallbackData;
        return fallbackData;
    }
}

// ============================================================
// REGION CHANGE HANDLER
// ============================================================

async function handleRegionChange() {
    const select = document.getElementById('deck-region-select');
    if (!select) return;
    
    const regionName = select.value;
    const descEl = document.getElementById('region-description');

    if (!regionName) {
        if (descEl) descEl.textContent = 'Select a region to display its description.';
        return;
    }

    selectedRegion = regionName;
    const data = await fetchRegionData(regionName);
    
    if (descEl) {
        if (data && data.description) {
            descEl.innerHTML = data.description;
        } else if (data) {
            descEl.innerHTML = '<p class="region-text">No description available for this region.</p>';
        } else {
            descEl.textContent = 'Could not load region description.';
        }
    }
    
    regionChangeCallbacks.forEach(callback => {
        try {
            callback(regionName, data);
        } catch (e) {
            console.warn('Region change callback error:', e);
        }
    });
}

// ============================================================
// RENDER
// ============================================================

export async function render(el) {
    container = el;
    await loadManifest();

    let regionOptions = regionNames.map(n => `<option value="${n}">${n}</option>`).join('');
    if (regionNames.length === 0) {
        regionOptions = '<option value="">No regions found</option>';
    }

    const isDeterministic = !!_deckSeedState.seed;

    container.innerHTML = `
        <div class="decks-header">
            <h1 class="page-title">🃏 Deck of Consequences</h1>
            <p class="page-sub">Transform Story Beats (SB) into thematic complications. Choose a region and draw type.</p>
        </div>

        <!-- Seed Status -->
        <div class="panel" style="padding:0.3rem 0.8rem;margin-bottom:0.5rem;background:var(--bg3);border-left:3px solid ${isDeterministic ? 'var(--gold)' : 'var(--text3)'};">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                <span style="font-size:0.8rem;color:var(--text2);">
                    ${isDeterministic ? '🎲 Deterministic RNG (seeded)' : '🔀 Cryptographic RNG (random)'}
                    ${isDeterministic ? `<span style="font-size:0.6rem;color:var(--text3);font-family:monospace;">seed: ${_deckSeedState.seed.substring(0, 8)}...</span>` : ''}
                </span>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-ghost" id="deck-seed-regenerate" title="Regenerate seed">🔄 New Seed</button>
                    <button class="btn btn-xs btn-ghost" id="deck-seed-clear" title="Clear seed (use crypto)">🧹 Clear Seed</button>
                </div>
            </div>
        </div>

        <div class="panel">
            <div class="field" style="max-width:300px;">
                <label>Region</label>
                <select id="deck-region-select">
                    <option value="">— Select Region —</option>
                    ${regionOptions}
                </select>
            </div>
            <div id="region-description" style="margin-top:0.8rem;background:var(--bg2);padding:0.8rem 1rem;border-radius:var(--radius);border-left:4px solid var(--gold);color:var(--text2);font-size:0.9rem;">
                Select a region to display its description.
            </div>
        </div>

        <div class="panel">
            <h3>Draw Type</h3>
            <div class="deck-controls" style="display:flex;flex-wrap:wrap;gap:0.8rem;align-items:end;">
                <div class="field" style="flex:0 0 200px;">
                    <label>Cost / Draw</label>
                    <select id="deck-draw-type">
                        <option value="1">1 SB (1 card)</option>
                        <option value="2" selected>2 SB (2 cards)</option>
                        <option value="3">3 SB (3 cards)</option>
                        <option value="crown">👑 Crown Spread (4+1 wildcard)</option>
                    </select>
                </div>
                <button class="btn btn-gold" id="deck-draw-btn">🃏 Draw</button>
                <button class="btn" id="deck-reshuffle-btn">↺ Reshuffle</button>
                <span class="text-muted" id="deck-cards-remaining">54 cards</span>
            </div>
            <div id="spread-type-indicator" style="margin-top:0.4rem;font-size:0.85rem;color:var(--text2);">
                <span id="spread-description">Single draw: one consequence</span>
            </div>
        </div>

        <div class="panel" id="consequence-display">
            <h3 id="consequence-title">Cards Drawn</h3>
            <div id="crown-spread-cards" style="margin:0.8rem 0;display:none;"></div>
            <div class="card-grid" id="drawn-cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.8rem;margin:0.8rem 0;"></div>
            <div id="consequence-synthesis" class="consequence-synthesis" style="background:var(--bg3);border-left:4px solid var(--gold);padding:0.8rem 1rem;border-radius:var(--radius);margin-top:0.8rem;font-style:italic;white-space:pre-wrap;">
                Draw cards to see a complication.
            </div>
            <div id="crown-spread-details" style="margin-top:0.8rem;display:none;"></div>
            <div id="timer-result" style="margin-top:0.8rem;display:none;background:var(--bg3);padding:0.5rem 1rem;border-radius:var(--radius);border-left:4px solid var(--accent);"></div>
        </div>

        <div class="panel">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                <h3 style="margin:0;">📜 History</h3>
                <button class="btn btn-sm" id="deck-history-clear-btn">Clear History</button>
            </div>
            <div class="deck-history" id="deck-history" style="max-height:200px;overflow-y:auto;margin-top:0.5rem;"></div>
        </div>
    `;

    buildDeck();
    renderDeckHistory();
    attachEvents();
    updateSpreadDescription();

    const select = document.getElementById('deck-region-select');
    if (select) {
        select.addEventListener('change', handleRegionChange);
        if (regionNames.length > 0) {
            select.value = regionNames[0];
            await handleRegionChange();
            selectedRegion = regionNames[0];
        } else if (selectedRegion) {
            select.value = selectedRegion;
            await handleRegionChange();
        }
    }
    
    // Seed controls
    const seedRegenerate = document.getElementById('deck-seed-regenerate');
    if (seedRegenerate) {
        seedRegenerate.addEventListener('click', function() {
            const newSeed = generateDeckSeed();
            setDeckSeed(newSeed);
            try {
                localStorage.setItem('fates-edge-seed', newSeed);
            } catch (e) { /* ignore */ }
            cardOffset = getDeckRandomInt(0, 1000);
            render(container);
            showToast('🎲 New deck seed generated: ' + newSeed.substring(0, 8) + '...', 'success');
        });
    }
    
    const seedClear = document.getElementById('deck-seed-clear');
    if (seedClear) {
        seedClear.addEventListener('click', function() {
            if (confirm('Clear the deterministic seed? This will use cryptographic RNG instead.')) {
                setDeckSeed(null);
                cardOffset = getDeckRandomInt(0, 1000);
                render(container);
                showToast('🧹 Deck seed cleared. Using cryptographic RNG.', 'info');
            }
        });
    }
    
    isInitialized = true;
}

// ============================================================
// DECK MANAGEMENT
// ============================================================

function buildDeck() {
    deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({
                suit,
                rank,
                symbol: SUIT_SYMBOLS[suit],
                color: SUIT_COLORS[suit],
                suitName: SUIT_NAMES[suit],
                rankName: RANK_NAMES[rank] || rank
            });
        }
    }
    deck.push({ suit: 'joker', rank: 'Red', symbol: '🃏', color: '#d4af37', isJoker: true, suitName: 'Joker', rankName: 'Red' });
    deck.push({ suit: 'joker', rank: 'Black', symbol: '🃏', color: '#d4af37', isJoker: true, suitName: 'Joker', rankName: 'Black' });
    
    deck = deterministicShuffle(deck);
    updateDeckCount();
    console.log('🔀 Deck shuffled, total cards:', deck.length, _deckSeedState.seed ? '(deterministic)' : '(random)');
    
    // Log shuffle
    if (typeof logRecordingEvent === 'function') {
        logRecordingEvent('deck_shuffle', `Deck shuffled. ${deck.length} cards remaining.`);
    }
}

function updateDeckCount() {
    const el = document.getElementById('deck-cards-remaining');
    if (el) el.textContent = deck.length + ' cards';
}

function updateSpreadDescription() {
    const type = document.getElementById('deck-draw-type')?.value;
    const descEl = document.getElementById('spread-description');
    if (!descEl) return;
    if (type === 'crown') {
        descEl.textContent = '👑 Crown Spread: 4 cards (Root, Crest, Crown, Left Hand) + 1 wildcard twist. Each card draws from the selected region\'s deck.';
    } else if (type === '2') {
        descEl.textContent = 'Two draws: a complication with an additional twist.';
    } else if (type === '3') {
        descEl.textContent = 'Three draws: a chain of consequences.';
    } else {
        descEl.textContent = 'Single draw: one focused consequence.';
    }
}

// ============================================================
// DRAW
// ============================================================

let lastDrawResults = null;

export async function drawConsequence() {
    if (!selectedRegion) {
        showToast('Please select a region first.', 'error');
        return;
    }
    const data = await fetchRegionData(selectedRegion);
    if (!data) return;

    const type = document.getElementById('deck-draw-type')?.value || '1';
    let cards = [];
    let isCrown = false;

    if (type === 'crown') {
        isCrown = true;
        if (deck.length < 5) {
            showToast('Deck running low! Reshuffling...', 'warning');
            buildDeck();
        }
        for (let i = 0; i < 5; i++) {
            if (deck.length === 0) buildDeck();
            cards.push(deck.pop());
        }
    } else {
        const count = parseInt(type, 10) || 1;
        if (deck.length < count) {
            showToast('Deck running low! Reshuffling...', 'warning');
            buildDeck();
        }
        for (let i = 0; i < count; i++) {
            if (deck.length === 0) buildDeck();
            cards.push(deck.pop());
        }
    }

    updateDeckCount();
    renderCards(cards, isCrown);

    let synthesis, details = null, timer = null, cardDisplay = null;
    let aceEffect = null;

    const aces = cards.filter(c => c.rank === 'A' && !c.isJoker);
    if (aces.length > 0) {
        const aceCard = aces[0];
        aceEffect = getAceEffect(selectedRegion, aceCard);
    }

    if (isCrown) {
        const mainCards = cards.slice(0, 4);
        const wildcard = cards[4];
        const result = synthesiseCrownSpread(mainCards, wildcard, data);
        synthesis = result.synthesis;
        details = result.details;
        timer = result.timer;
        cardDisplay = result.horizontalLayout;
        
        const cardsEl = document.getElementById('crown-spread-cards');
        if (cardsEl) {
            cardsEl.style.display = 'block';
            cardsEl.innerHTML = `
                <div style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;">
                    ${cardDisplay}
                </div>
            `;
        }
        
        // Log Crown Spread
        if (typeof logRecordingEvent === 'function') {
            const cardNames = mainCards.map(c => `${c.rankName} of ${c.suitName}`).join(', ');
            logRecordingEvent('crown_spread', `Crown Spread: ${cardNames} | Wildcard: ${wildcard.isJoker ? 'Joker' : `${wildcard.rankName} of ${wildcard.suitName}`} | Region: ${selectedRegion}`);
        }
    } else {
        const cardsEl = document.getElementById('crown-spread-cards');
        if (cardsEl) cardsEl.style.display = 'none';
        synthesis = synthesiseConsequence(cards, data);
        
        // Log regular draw
        if (typeof logRecordingEvent === 'function') {
            const cardNames = cards.map(c => `${c.rankName} of ${c.suitName}`).join(', ');
            logRecordingEvent('deck_draw', `${cards.length} card(s) drawn: ${cardNames} | Region: ${selectedRegion}`);
        }
    }

    let aceHtml = '';
    if (aceEffect) {
        aceHtml = `\n\n♠️ **Ace Effect:** ${aceEffect.emoji} ${aceEffect.text}`;
        synthesis += aceHtml;
        showToast(`♠️ Ace Effect: ${aceEffect.text}`, 'warning');
        if (typeof logRecordingEvent === 'function') {
            logRecordingEvent('deck_ace', `♠️ Ace Effect: ${aceEffect.emoji} ${aceEffect.text} (${selectedRegion})`);
        }
    }

    const synthesisEl = document.getElementById('consequence-synthesis');
    if (synthesisEl) {
        synthesisEl.innerHTML = `<strong>Consequence:</strong>\n${synthesis}`;
    }
    
    const detailsEl = document.getElementById('crown-spread-details');
    if (details) {
        detailsEl.style.display = 'block';
        detailsEl.innerHTML = details;
        const titleEl = document.getElementById('consequence-title');
        if (titleEl) titleEl.textContent = '👑 Crown Spread';
    } else {
        if (detailsEl) detailsEl.style.display = 'none';
        const titleEl = document.getElementById('consequence-title');
        if (titleEl) titleEl.textContent = type === 'crown' ? '👑 Crown Spread' : `🃏 ${type} Draw${type > 1 ? 's' : ''}`;
    }

    const timerEl = document.getElementById('timer-result');
    if (timer) {
        timerEl.style.display = 'block';
        timerEl.innerHTML = `
            <strong>⏱️ Suggested Timer:</strong> ${timer.segments} segments (from highest card: ${timer.card})
            <button class="btn btn-sm btn-primary" id="create-timer-btn" style="margin-left:0.5rem;">➕ Add Timer</button>
        `;
        const btn = timerEl.querySelector('#create-timer-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                createTimerFromCard(timer.card, timer.segments);
            });
        }
    } else {
        timerEl.style.display = 'none';
    }

    lastDrawResults = {
        cards: cards,
        synthesis: synthesis,
        isCrown: isCrown,
        details: details,
        timer: timer,
        type: type,
        aceEffect: aceEffect
    };

    const cardStr = cards.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | ');
    deckHistory.push({
        time: new Date().toLocaleTimeString(),
        cards: cardStr,
        synthesis: synthesis.replace(/\n/g, ' '),
        type: type === 'crown' ? 'Crown Spread' : `${type} Draw${type > 1 ? 's' : ''}`,
        aceEffect: aceEffect ? `${aceEffect.emoji} ${aceEffect.text}` : null
    });
    renderDeckHistory();
    
    broadcastDraw(cards, type, selectedRegion, synthesis);
    
    const cardNames = cards.map(c => c.isJoker ? '🃏 Joker' : `${c.rankName} of ${c.suitName}`).join(', ');
    showToast(`🃏 Drew ${cards.length} card${cards.length > 1 ? 's' : ''}: ${cardNames}`, 'success');
}

function synthesiseConsequence(cards, regionData) {
    const entries = cards.map(c => {
        if (c.isJoker) {
            return getWildcardMeaning(c, regionData);
        }
        return getCardMeaningFromRegion(c.suit, c.rank, regionData);
    });
    if (entries.length === 1) {
        return entries[0];
    } else if (entries.length === 2) {
        return `${entries[0]}\n\nThen, ${entries[1]}`;
    } else {
        return entries.map((e, i) => `${i+1}. ${e}`).join('\n\n');
    }
}

// ============================================================
// CARD RENDERING
// ============================================================

function renderCards(cards, isCrown) {
    const container = document.getElementById('drawn-cards');
    if (!container) return;

    if (isCrown) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = cards.map((c, i) => {
        let classes = 'card-slot';
        if (c.isJoker) {
            classes += ' joker';
        } else {
            classes += ' ' + c.suit;
        }

        let rankDisplay = c.isJoker ? 'Joker' : c.rank;
        let symbolDisplay = c.isJoker ? '🃏' : c.symbol;
        let borderColor = c.isJoker ? 'var(--gold)' : c.color;

        return `
            <div class="${classes}" style="background:var(--bg3);border:2px solid var(--border);border-radius:var(--radius);padding:0.4rem;text-align:center;font-weight:700;min-height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:border-color 0.2s, transform 0.2s;${!c.isJoker ? `border-left:6px solid ${borderColor};` : 'border-color: var(--gold); box-shadow: 0 0 10px rgba(212,175,55,0.3);'}">
                <div class="rank" style="font-size:1rem;color:var(--text2);">${c.isJoker ? '' : rankDisplay}</div>
                <div class="suit" style="font-size:2.5rem;line-height:1.2;color:${c.isJoker ? 'var(--gold)' : c.color}">${symbolDisplay}</div>
                <div class="label" style="font-size:0.65rem;color:var(--text3);">${c.isJoker ? c.rank + ' Joker' : c.suitName}</div>
            </div>
        `;
    }).join('');
}

// ============================================================
// TIMER CREATION
// ============================================================

function createTimerFromCard(cardName, segments) {
    import('../timers/index.js').then(module => {
        if (module.openTimerEditor) {
            module.openTimerEditor({
                name: `Crown Spread: ${cardName}`,
                segments: segments,
                current: 0
            });
            showToast(`⏱️ Creating timer from ${cardName} (${segments} segments)`, 'success');
            if (typeof logRecordingEvent === 'function') {
                logRecordingEvent('timer_created', `Timer created from Crown Spread: ${cardName} (${segments} segments)`);
            }
        } else {
            const state = getState();
            if (!state.timers) state.timers = [];
            const newTimer = {
                id: 'timer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                name: `Crown Spread: ${cardName}`,
                segments: segments,
                current: 0
            };
            state.timers.push(newTimer);
            const event = new CustomEvent('timer-added', { detail: { timer: newTimer } });
            document.dispatchEvent(event);
            showToast(`⏱️ Timer created: ${newTimer.name} (${segments} segments)`, 'success');
            if (typeof logRecordingEvent === 'function') {
                logRecordingEvent('timer_created', `Timer created: ${newTimer.name} (${segments} segments)`);
            }
        }
    }).catch(() => {
        const state = getState();
        if (!state.timers) state.timers = [];
        const newTimer = {
            id: 'timer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: `Crown Spread: ${cardName}`,
            segments: segments,
            current: 0
        };
        state.timers.push(newTimer);
        document.dispatchEvent(new CustomEvent('timer-added', { detail: { timer: newTimer } }));
        showToast(`⏱️ Timer created: ${newTimer.name} (${segments} segments)`, 'success');
        if (typeof logRecordingEvent === 'function') {
            logRecordingEvent('timer_created', `Timer created: ${newTimer.name} (${segments} segments)`);
        }
    });
}

// ============================================================
// HISTORY
// ============================================================

function renderDeckHistory() {
    const el = document.getElementById('deck-history');
    if (!el) return;
    if (deckHistory.length === 0) {
        el.innerHTML = '<span class="text-muted">No draws yet.</span>';
        return;
    }
    el.innerHTML = deckHistory.slice().reverse().map(e =>
        `<div style="padding:0.3rem 0;border-bottom:1px solid var(--border);font-size:0.8rem;display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;">
            <span style="color:var(--text3);font-size:0.7rem;">[${e.time}]</span>
            <span style="background:var(--bg3);padding:0.05rem 0.4rem;border-radius:8px;font-size:0.7rem;">${e.type}</span>
            <span style="font-weight:500;">${e.cards}</span>
            <span style="color:var(--text2);font-size:0.75rem;">→</span>
            <span style="font-size:0.8rem;">${e.synthesis}</span>
            ${e.aceEffect ? `<span style="color:var(--gold);font-size:0.7rem;">${e.aceEffect}</span>` : ''}
        </div>`
    ).join('');
}

function clearDeckHistory() {
    deckHistory = [];
    renderDeckHistory();
    showToast('Deck history cleared.', 'success');
    if (typeof logRecordingEvent === 'function') {
        logRecordingEvent('deck_history_cleared', 'Deck history cleared');
    }
}

// ============================================================
// RESET
// ============================================================

export function resetDeck() {
    cardOffset = getDeckRandomInt(0, 1000);
    buildDeck();
    const drawnCards = document.getElementById('drawn-cards');
    if (drawnCards) drawnCards.innerHTML = '';
    const crownCards = document.getElementById('crown-spread-cards');
    if (crownCards) {
        crownCards.innerHTML = '';
        crownCards.style.display = 'none';
    }
    const synthesis = document.getElementById('consequence-synthesis');
    if (synthesis) synthesis.innerHTML = 'Deck reshuffled. Draw to begin.';
    const details = document.getElementById('crown-spread-details');
    if (details) details.style.display = 'none';
    const timer = document.getElementById('timer-result');
    if (timer) timer.style.display = 'none';
    const title = document.getElementById('consequence-title');
    if (title) title.textContent = 'Cards Drawn';
    
    broadcastReset();
    
    if (typeof logRecordingEvent === 'function') {
        logRecordingEvent('deck_reset', 'Deck reset and reshuffled');
    }
    
    showToast(`Deck reshuffled with new random seeds.${_deckSeedState.seed ? ' (deterministic)' : ''}`, 'success');
}

// ============================================================
// LIFECYCLE METHODS
// ============================================================

export async function onActivate() {
    console.log('[Decks] Activated');
    const select = document.getElementById('deck-region-select');
    if (select && select.value) {
        await handleRegionChange();
    }
}

export function onDeactivate() {
    console.log('[Decks] Deactivated');
}

export async function refresh() {
    console.log('[Decks] Refreshing');
    await loadManifest();
    const select = document.getElementById('deck-region-select');
    if (select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">— Select Region —</option>';
        regionNames.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });
        if (currentValue && regionNames.includes(currentValue)) {
            select.value = currentValue;
        } else if (regionNames.length > 0) {
            select.value = regionNames[0];
        }
        await handleRegionChange();
    }
}

export function destroy() {
    container = null;
    deck = [];
    deckHistory = [];
    regionData = null;
    selectedRegion = null;
    isInitialized = false;
    regionChangeCallbacks = [];
}

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    const drawBtn = document.getElementById('deck-draw-btn');
    if (drawBtn) {
        const newBtn = drawBtn.cloneNode(true);
        drawBtn.parentNode.replaceChild(newBtn, drawBtn);
        newBtn.addEventListener('click', drawConsequence);
    }
    
    const reshuffleBtn = document.getElementById('deck-reshuffle-btn');
    if (reshuffleBtn) {
        const newBtn = reshuffleBtn.cloneNode(true);
        reshuffleBtn.parentNode.replaceChild(newBtn, reshuffleBtn);
        newBtn.addEventListener('click', resetDeck);
    }
    
    const clearBtn = document.getElementById('deck-history-clear-btn');
    if (clearBtn) {
        const newBtn = clearBtn.cloneNode(true);
        clearBtn.parentNode.replaceChild(newBtn, clearBtn);
        newBtn.addEventListener('click', clearDeckHistory);
    }
    
    const typeSelect = document.getElementById('deck-draw-type');
    if (typeSelect) {
        const newSelect = typeSelect.cloneNode(true);
        typeSelect.parentNode.replaceChild(newSelect, typeSelect);
        newSelect.addEventListener('change', updateSpreadDescription);
    }
}

// ============================================================
// CROWN SPREAD MODAL
// ============================================================

let crownSpreadModal = null;

export function openCrownSpread() {
    if (crownSpreadModal && crownSpreadModal.parentNode) {
        crownSpreadModal.remove();
        crownSpreadModal = null;
    }
    
    crownSpreadModal = document.createElement('div');
    crownSpreadModal.className = 'crown-spread-modal';
    crownSpreadModal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;
        z-index: 1000; padding: 1rem; backdrop-filter: blur(12px);
        animation: fadeIn 0.3s ease;
    `;
    
    if (deck.length < 5) {
        buildDeck();
    }
    const cards = [];
    for (let i = 0; i < 5; i++) {
        if (deck.length === 0) buildDeck();
        cards.push(deck.pop());
    }
    updateDeckCount();
    
    const mainCards = cards.slice(0, 4);
    const wildcard = cards[4];
    
    const regionName = selectedRegion || 'Acasia';
    fetchRegionData(regionName).then(data => {
        const result = synthesiseCrownSpread(mainCards, wildcard, data);
        
        // Log Crown Spread
        if (typeof logRecordingEvent === 'function') {
            const cardNames = mainCards.map(c => `${c.rankName} of ${c.suitName}`).join(', ');
            logRecordingEvent('crown_spread_modal', `Crown Spread (modal): ${cardNames} | Wildcard: ${wildcard.isJoker ? 'Joker' : `${wildcard.rankName} of ${wildcard.suitName}`} | Region: ${regionName}`);
        }
        
        crownSpreadModal.innerHTML = `
            <div style="background:var(--bg2);padding:2rem;border-radius:16px;max-width:800px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                    <h2 style="color:var(--gold);margin:0;">👑 Crown Spread</h2>
                    <button onclick="window.closeCrownSpread()" 
                            style="background:var(--bg3);border:1px solid var(--border);color:var(--text2);font-size:1.5rem;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;">
                        ✕
                    </button>
                </div>
                
                <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;margin-bottom:1rem;">
                    ${result.positions.map(p => `
                        <div style="background:var(--bg3);border:2px solid ${p.isJoker ? 'var(--gold)' : p.color};border-radius:var(--radius);padding:0.5rem;text-align:center;min-width:70px;${p.isJoker ? 'box-shadow: 0 0 20px rgba(212,175,55,0.3);' : ''}">
                            <div style="font-size:0.6rem;color:var(--text3);">${p.position.icon}</div>
                            <div style="font-size:2rem;color:${p.isJoker ? 'var(--gold)' : p.color};">${p.isJoker ? '🃏' : p.symbol}</div>
                            <div style="font-size:0.6rem;color:var(--text2);">${p.rankName}</div>
                            <div style="font-size:0.5rem;color:var(--text3);">${p.position.label}</div>
                        </div>
                    `).join('')}
                    <div style="background:var(--bg4);border:2px solid var(--gold);border-radius:var(--radius);padding:0.5rem;text-align:center;min-width:70px;box-shadow:0 0 20px rgba(212,175,55,0.3);">
                        <div style="font-size:0.6rem;color:var(--gold);">🌟</div>
                        <div style="font-size:2rem;color:var(--gold);">🃏</div>
                        <div style="font-size:0.6rem;color:var(--gold);">Wild</div>
                        <div style="font-size:0.5rem;color:var(--text3);">Twist</div>
                    </div>
                </div>
                
                <div style="background:var(--bg3);border-radius:var(--radius);padding:1rem;border-left:4px solid var(--gold);">
                    ${result.positions.map((p, i) => `
                        <div style="margin-bottom:0.5rem;padding-bottom:0.5rem;${i < 3 ? 'border-bottom:1px solid var(--border);' : ''}">
                            <div style="display:flex;align-items:center;gap:0.5rem;">
                                <span style="color:${p.isJoker ? 'var(--gold)' : p.color};">${p.position.icon}</span>
                                <strong style="color:${p.isJoker ? 'var(--gold)' : p.color};">${p.position.label}</strong>
                                <span style="color:var(--text3);font-size:0.8rem;">${p.rankName} of ${p.suitName}</span>
                            </div>
                            <div style="color:var(--text2);font-size:0.9rem;margin-left:1.5rem;">${p.regionMeaning || p.description}</div>
                        </div>
                    `).join('')}
                    <div>
                        <div style="display:flex;align-items:center;gap:0.5rem;">
                            <span style="color:var(--gold);">🌟</span>
                            <strong style="color:var(--gold);">Wildcard Twist</strong>
                        </div>
                        <div style="color:var(--text2);font-size:0.9rem;margin-left:1.5rem;">${result.wildcard}</div>
                    </div>
                </div>
                
                ${result.timer ? `
                    <div style="margin-top:1rem;background:var(--bg3);border-radius:var(--radius);padding:0.5rem 1rem;border-left:4px solid var(--accent);">
                        <strong>⏱️ Suggested Timer:</strong> ${result.timer.segments} segments (from ${result.timer.card})
                        <button class="btn btn-sm btn-primary" onclick="window.createTimerFromCard('${result.timer.card}', ${result.timer.segments})" style="margin-left:0.5rem;">➕ Add Timer</button>
                    </div>
                ` : ''}
                
                <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button class="btn btn-gold" onclick="window.closeCrownSpread(); setTimeout(window.openCrownSpread, 100);">🔄 New Spread</button>
                    <button class="btn btn-secondary" onclick="window.closeCrownSpread();">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(crownSpreadModal);
        
        broadcastDraw(cards, 'crown', regionName, result.synthesis);
        
        crownSpreadModal.addEventListener('click', (e) => {
            if (e.target === crownSpreadModal) {
                window.closeCrownSpread();
            }
        });
        
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape' && crownSpreadModal && crownSpreadModal.parentNode) {
                window.closeCrownSpread();
                document.removeEventListener('keydown', escHandler);
            }
        });
    });
}

window.closeCrownSpread = function() {
    if (crownSpreadModal && crownSpreadModal.parentNode) {
        crownSpreadModal.remove();
        crownSpreadModal = null;
    }
    updateDeckCount();
};

// ============================================================
// EXPOSED FUNCTIONS
// ============================================================

export function getSelectedRegion() {
    return selectedRegion;
}

export function getRegionNames() {
    return [...regionNames];
}

export async function setSelectedRegion(regionName) {
    if (!regionNames.includes(regionName)) {
        console.warn(`[Decks] Region "${regionName}" not found`);
        return false;
    }
    
    selectedRegion = regionName;
    const select = document.getElementById('deck-region-select');
    if (select) {
        select.value = regionName;
        await handleRegionChange();
    }
    return true;
}

export function getRegionData() {
    return regionData;
}

export function getCardMeaning(suit, rank) {
    if (!regionData) {
        return `A complication of ${suit} arises.`;
    }
    return getCardMeaningFromRegion(suit, rank, regionData);
}

export function registerRegionChange(callback) {
    if (typeof callback === 'function') {
        regionChangeCallbacks.push(callback);
        if (selectedRegion) {
            callback(selectedRegion, regionData);
        }
    }
}

export async function onRegionChange(regionNameOrCallback, callback) {
    if (typeof regionNameOrCallback === 'function') {
        registerRegionChange(regionNameOrCallback);
        return;
    }
    
    if (typeof regionNameOrCallback === 'string') {
        const regionName = regionNameOrCallback;
        const success = await setSelectedRegion(regionName);
        if (success && callback) {
            callback(regionName, regionData);
        }
        return success;
    }
    
    await handleRegionChange();
}

// ============================================================
// SHORTCUT FUNCTIONS
// ============================================================

export async function quickDraw(count = 1, regionName = null) {
    if (regionName) {
        await setSelectedRegion(regionName);
    }
    
    if (!selectedRegion) {
        showToast('Please select a region first.', 'error');
        return null;
    }
    
    const data = await fetchRegionData(selectedRegion);
    if (!data) return null;
    
    if (deck.length < count) {
        showToast('Deck running low! Reshuffling...', 'warning');
        buildDeck();
    }
    
    const cards = [];
    for (let i = 0; i < count; i++) {
        if (deck.length === 0) buildDeck();
        cards.push(deck.pop());
    }
    updateDeckCount();
    
    const synthesis = synthesiseConsequence(cards, data);
    const cardNames = cards.map(c => c.isJoker ? '🃏 Joker' : `${c.rankName} of ${c.suitName}`).join(', ');
    
    let aceEffect = null;
    let synthesisWithAce = synthesis;
    const aces = cards.filter(c => c.rank === 'A' && !c.isJoker);
    if (aces.length > 0) {
        const aceCard = aces[0];
        aceEffect = getAceEffect(selectedRegion, aceCard);
        synthesisWithAce += `\n\n♠️ **Ace Effect:** ${aceEffect.emoji} ${aceEffect.text}`;
        showToast(`♠️ Ace Effect: ${aceEffect.text}`, 'warning');
        if (typeof logRecordingEvent === 'function') {
            logRecordingEvent('quick_draw_ace', `♠️ Ace Effect: ${aceEffect.emoji} ${aceEffect.text} (${selectedRegion})`);
        }
    }
    
    broadcastDraw(cards, String(count), selectedRegion, synthesisWithAce);
    
    deckHistory.push({
        time: new Date().toLocaleTimeString(),
        cards: cardNames,
        synthesis: synthesisWithAce.replace(/\n/g, ' '),
        type: `${count} Draw${count > 1 ? 's' : ''}`,
        aceEffect: aceEffect ? `${aceEffect.emoji} ${aceEffect.text}` : null
    });
    renderDeckHistory();
    
    // Log quick draw
    if (typeof logRecordingEvent === 'function') {
        logRecordingEvent('quick_draw', `${count} card(s) drawn: ${cardNames} | Region: ${selectedRegion}`);
    }
    
    showToast(`🎴 ${cardNames}`, 'success');
    
    return {
        cards,
        synthesis: synthesisWithAce,
        cardNames,
        type: count,
        aceEffect: aceEffect
    };
}

export async function quickCrownSpread(regionName = null) {
    if (regionName) {
        await setSelectedRegion(regionName);
    }
    
    if (!selectedRegion) {
        showToast('Please select a region first.', 'error');
        return null;
    }
    
    const data = await fetchRegionData(selectedRegion);
    if (!data) return null;
    
    if (deck.length < 5) {
        showToast('Deck running low! Reshuffling...', 'warning');
        buildDeck();
    }
    
    const cards = [];
    for (let i = 0; i < 5; i++) {
        if (deck.length === 0) buildDeck();
        cards.push(deck.pop());
    }
    updateDeckCount();
    
    const mainCards = cards.slice(0, 4);
    const wildcard = cards[4];
    const result = synthesiseCrownSpread(mainCards, wildcard, data);
    
    let aceEffect = null;
    let synthesisWithAce = result.synthesis;
    const aces = mainCards.filter(c => c.rank === 'A' && !c.isJoker);
    if (aces.length > 0) {
        const aceCard = aces[0];
        aceEffect = getAceEffect(selectedRegion, aceCard);
        synthesisWithAce += `\n\n♠️ **Ace Effect:** ${aceEffect.emoji} ${aceEffect.text}`;
        showToast(`♠️ Ace Effect: ${aceEffect.text}`, 'warning');
        if (typeof logRecordingEvent === 'function') {
            logRecordingEvent('crown_spread_ace', `♠️ Ace Effect: ${aceEffect.emoji} ${aceEffect.text} (${selectedRegion})`);
        }
    }
    
    broadcastDraw(cards, 'crown', selectedRegion, synthesisWithAce);
    
    const cardNames = cards.map(c => c.isJoker ? '🃏 Joker' : `${c.rankName} of ${c.suitName}`).join(', ');
    deckHistory.push({
        time: new Date().toLocaleTimeString(),
        cards: cardNames,
        synthesis: synthesisWithAce.replace(/\n/g, ' '),
        type: 'Crown Spread',
        aceEffect: aceEffect ? `${aceEffect.emoji} ${aceEffect.text}` : null
    });
    renderDeckHistory();
    
    // Log Crown Spread
    if (typeof logRecordingEvent === 'function') {
        logRecordingEvent('crown_spread_quick', `Crown Spread: ${cardNames} | Region: ${selectedRegion}`);
    }
    
    showToast(`👑 Crown Spread: ${cardNames}`, 'success');
    
    return {
        cards,
        mainCards,
        wildcard,
        result: { ...result, synthesis: synthesisWithAce },
        cardNames,
        aceEffect
    };
}

// ============================================================
// WINDOW EXPOSURES
// ============================================================

window.openCrownSpread = openCrownSpread;
window.closeCrownSpread = window.closeCrownSpread;
window.createTimerFromCard = createTimerFromCard;
window.drawConsequence = drawConsequence;
window.resetDeck = resetDeck;
window.quickDraw = quickDraw;
window.quickCrownSpread = quickCrownSpread;
window.getSelectedRegion = getSelectedRegion;
window.getRegionNames = getRegionNames;
window.setSelectedRegion = setSelectedRegion;
window.registerRegionChange = registerRegionChange;
window.onRegionChange = onRegionChange;

// ============================================================
// EXPORT
// ============================================================

export default {
    render,
    drawConsequence,
    resetDeck,
    attachEvents,
    onActivate,
    onDeactivate,
    refresh,
    destroy,
    loadManifest,
    fetchRegionData,
    buildDeck,
    openCrownSpread,
    closeCrownSpread: window.closeCrownSpread,
    getSelectedRegion,
    getRegionNames,
    setSelectedRegion,
    getRegionData,
    getCardMeaning,
    registerRegionChange,
    onRegionChange,
    quickDraw,
    quickCrownSpread
};