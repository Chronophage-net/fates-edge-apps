// features/travel-planner/index.js
/**
 * Travel Planner - Cartomancy-based journey generation
 * Uses the Deck of Consequences to plan journeys with place, actor, pressure, and leverage.
 * Integrates with the existing decks module for region data and RNG.
 */

import { logRecordingEvent } from '../../core/media.js';
import { showToast } from '../../components/Toast.js';
import { getState, addTimer } from '../../core/state.js';
import { 
    getSelectedRegion, 
    getRegionNames, 
    setSelectedRegion,
    getRegionData as getDeckRegionData,
    registerRegionChange
} from '../decks/index.js';

// ============================================================
// CONSTANTS
// ============================================================

const SUITS = ['hearts', 'spades', 'clubs', 'diamonds'];
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

// Travel roles
const TRAVEL_ROLES = [
    { key: 'guide', label: 'Guide', icon: '🧭', desc: 'Navigates the route; rolls Wits + Lore to tick Travel Timer.', skill: 'Lore' },
    { key: 'scout', label: 'Scout', icon: '🔭', desc: 'Avoids surprise; rolls Wits + Stealth to spot threats.', skill: 'Stealth' },
    { key: 'quartermaster', label: 'Quartermaster', icon: '📦', desc: 'Manages supplies; rolls Wits + Craft to prevent depletion.', skill: 'Craft' },
    { key: 'watch', label: 'Watch', icon: '👁️', desc: 'Keeps lookout; rolls Presence + Insight for first defense.', skill: 'Insight' }
];

// ============================================================
// ACE EFFECTS (Travel Edition)
// ============================================================

const ACE_EFFECTS = {
    generic: [
        { emoji: '🌀', text: 'The road loops back on itself. You\'ve been here before.' },
        { emoji: '🌉', text: 'A bridge appears where none was marked. The crossing is free—for now.' },
        { emoji: '🌫️', text: 'Fog rolls in, erasing the horizon. Trust your instincts.' },
        { emoji: '🕯️', text: 'A wayfarer\'s lantern glows in the distance. It leads you off the path.' },
        { emoji: '🗝️', text: 'A locked gate opens without a key. What waits beyond is watching.' },
        { emoji: '🌙', text: 'The moon rises early. Shadows stretch toward places you cannot see.' },
        { emoji: '⛰️', text: 'A landmark appears where none should be. The mountain has moved.' },
        { emoji: '💧', text: 'A spring flows where the map shows dry ground. The water tastes of iron.' }
    ],
    acasia: [
        { emoji: '🌿', text: 'The Curse shifts. A milepost points the wrong way—you are being watched.' },
        { emoji: '🪦', text: 'A broken bridge spans a dry river. The toll is a forgotten name.' },
        { emoji: '🔥', text: 'A free company\'s banner flutters on the horizon. They\'ve seen you.' }
    ],
    ecktoria: [
        { emoji: '🏛️', text: 'A Triumph Stair appears in the middle of the road. Climbing it may change your destination.' },
        { emoji: '⚜️', text: 'A Vigil seal glows on the roadside. You are being recorded.' },
        { emoji: '🔥', text: 'The Everflame flickers ahead. A heretic is being burned tonight.' }
    ],
    vhasia: [
        { emoji: '☀️', text: 'The sun splits into two shadows. Your path forks into two futures.' },
        { emoji: '🗡️', text: 'A knight in rusted armor stands at the crossroads. They ask for a vow.' },
        { emoji: '👑', text: 'A crown lies in the mud. Picking it up makes you a claimant.' }
    ],
    viterra: [
        { emoji: '🌳', text: 'A hedge has grown across the road overnight. The boundary has moved.' },
        { emoji: '⚖️', text: 'A Justiciar\'s seal hangs from a branch. A legal challenge is imminent.' },
        { emoji: '🛡️', text: 'A Queen\'s Progress banner flutters ahead. You may be pressed into service.' }
    ],
    ykrul: [
        { emoji: '🐺', text: 'A pack of wolves shadows you. They are not hunting—they are counting.' },
        { emoji: '🌾', text: 'The steppe grass bends in a pattern. A hostile camp lies just beyond.' },
        { emoji: '⚔️', text: 'A hostage string lies across the trail. Someone has broken an oath.' }
    ],
    silkstrand: [
        { emoji: '🌊', text: 'The canals flow backward. The tide is carrying secrets.' },
        { emoji: '🕊️', text: 'A bridge toll is waived—but the toll-taker asks for a promise instead.' },
        { emoji: '📜', text: 'A manifest washes ashore. The cargo is listed as "nothing."' }
    ],
    mistlands: [
        { emoji: '🔔', text: 'A bell-line hums in the distance. The wards are thin here.' },
        { emoji: '🧂', text: 'Salt scatters across the path. The Direwood is close.' },
        { emoji: '🌫️', text: 'The mist takes a shape—a face you recognize. It does not speak.' }
    ],
    thepyrgos: [
        { emoji: '🔑', text: 'A stair leads upward where the road should flatten. The city is watching.' },
        { emoji: '📚', text: 'A book lies open on a milestone. Its words shift as you read.' },
        { emoji: '🔔', text: 'A bell tolls nine times. The Synod has issued a decree.' }
    ],
    ubral: [
        { emoji: '🪨', text: 'A cairn has been disturbed. The dead are restless.' },
        { emoji: '⚔️', text: 'A guest-right token lies broken on the path. Feud is inevitable.' },
        { emoji: '🐎', text: 'A riderless horse stands at the ford. It waits for a rider.' }
    ],
    valewood: [
        { emoji: '🌲', text: 'A star-road shard glows on the forest floor. The path is ancient.' },
        { emoji: '🍃', text: 'A leaf falls upward, pointing to a hidden grove.' },
        { emoji: '👑', text: 'The Hazel Queen\'s laughter echoes through the trees. She knows you are passing.' }
    ],
    aelinnel: [
        { emoji: '🔮', text: 'A geas forms on the wind. Your next word may bind you.' },
        { emoji: '🌿', text: 'The Green Gate shimmers ahead. The toll is a truth you have never told.' },
        { emoji: '🕊️', text: 'A fae courier passes you without a word. They carry a message meant for you.' }
    ],
    aelaerem: [
        { emoji: '🍎', text: 'The Hollow walks beside you. The ninth step is yours.' },
        { emoji: '🐦', text: 'The watch-geese are silent. Something is coming.' },
        { emoji: '🌾', text: 'A scarecrow stands in the middle of the road. It turns to face you.' }
    ],
    zakov: [
        { emoji: '🌊', text: 'The tide rises unusually fast. A hidden cove is revealed.' },
        { emoji: '💎', text: 'A crystalline shard washes up. The Reaping\'s corruption is close.' },
        { emoji: '🏴‍☠️', text: 'A pirate ship is beached ahead. The crew is gone.' }
    ]
};

// ============================================================
// STATE
// ============================================================

let container = null;
let selectedStartRegion = null;
let selectedDestRegion = null;
let journeyHistory = [];
let currentJourney = null;
let isInitialized = false;
let regionList = [];
let regionDataCache = {};

// ============================================================
// HELPERS
// ============================================================

function getRegionSlug(name) {
    return name.toLowerCase().replace(/ /g, '_');
}

async function fetchRegionData(regionName) {
    if (regionDataCache[regionName]) {
        return regionDataCache[regionName];
    }
    try {
        const slug = getRegionSlug(regionName);
        const res = await fetch(`/data/regions/${slug}.json`);
        if (!res.ok) throw new Error(`Region "${regionName}" not found`);
        const data = await res.json();
        regionDataCache[regionName] = data;
        return data;
    } catch (e) {
        console.warn(`[TravelPlanner] Error loading region ${regionName}:`, e);
        const fallbackData = {
            name: regionName,
            description: `${regionName} - A region of Fate's Edge.`,
            hearts: ["A matter of loyalty or love arises."],
            spades: ["A conflict or struggle emerges."],
            clubs: ["A physical challenge or obstacle appears."],
            diamonds: ["A resource, treasure, or opportunity is found."]
        };
        regionDataCache[regionName] = fallbackData;
        return fallbackData;
    }
}

function getCardMeaningFromRegion(suit, rank, regionData) {
    const suitKey = suit;
    const arr = regionData[suitKey];
    if (!arr || arr.length === 0) {
        return `A complication of ${suit} arises.`;
    }
    const seed = suit + rank;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    const index = Math.abs(hash) % arr.length;
    return arr[index];
}

function getTimerSizeFromRank(rank) {
    const val = POKER_RANK[rank] || 0;
    if (val >= 14) return 10;
    if (val >= 11) return 8;
    if (val >= 7) return 6;
    return 4;
}

function getRankName(rank) {
    return RANK_NAMES[rank] || rank;
}

function getSuitName(suit) {
    return SUIT_NAMES[suit] || suit;
}

function getSuitSymbol(suit) {
    return SUIT_SYMBOLS[suit] || '♦';
}

function getSuitColor(suit) {
    return SUIT_COLORS[suit] || '#2980b9';
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
    
    const seed = (card?.suit || '') + (card?.rank || '') + 'travel';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    const idx = Math.abs(hash) % effects.length;
    return effects[idx];
}

// ============================================================
// DECK MANAGEMENT (using decks module's RNG)
// ============================================================

let travelSeed = null;
let travelPRNG = null;

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
}

function initTravelSeed() {
    try {
        const stored = localStorage.getItem('fates-edge-deck-seed');
        if (stored) {
            travelSeed = stored;
            travelPRNG = new Xorshift128(stored);
            console.log('[TravelPlanner] Seed loaded from localStorage:', stored.substring(0, 8) + '...');
            return;
        }
        const diceSeed = localStorage.getItem('fates-edge-seed');
        if (diceSeed) {
            travelSeed = diceSeed;
            travelPRNG = new Xorshift128(diceSeed);
            console.log('[TravelPlanner] Seed shared from dice module:', diceSeed.substring(0, 8) + '...');
            return;
        }
        const fallback = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        travelSeed = fallback;
        travelPRNG = new Xorshift128(fallback);
        console.log('[TravelPlanner] Generated fallback seed.');
    } catch (e) {
        travelSeed = null;
        travelPRNG = null;
        console.warn('[TravelPlanner] Could not initialize seed, using Math.random.');
    }
}

function getTravelRandom() {
    if (travelPRNG) {
        return travelPRNG.random();
    }
    return Math.random();
}

function getTravelRandomInt(min, max) {
    if (travelPRNG) {
        return travelPRNG.randomInt(min, max);
    }
    return Math.floor(getTravelRandom() * (max - min)) + min;
}

initTravelSeed();

// ============================================================
// JOURNEY GENERATION
// ============================================================

function generateCard(deck) {
    if (deck.length === 0) {
        deck = buildDeck();
    }
    const idx = getTravelRandomInt(0, deck.length);
    const card = deck.splice(idx, 1)[0];
    return card;
}

function buildDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) {
            deck.push({ suit, rank });
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = getTravelRandomInt(0, i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function generateLeg(deck, regionData, regionName, legIndex) {
    const spade = generateCard(deck);
    const heart = generateCard(deck);
    const club = generateCard(deck);
    const diamond = generateCard(deck);
    
    const cards = { spade, heart, club, diamond };
    
    const place = getCardMeaningFromRegion('spades', spade.rank, regionData);
    const actor = getCardMeaningFromRegion('hearts', heart.rank, regionData);
    const pressure = getCardMeaningFromRegion('clubs', club.rank, regionData);
    const leverage = getCardMeaningFromRegion('diamonds', diamond.rank, regionData);
    
    const highestRank = [spade, heart, club, diamond].reduce((a, b) => {
        const rankA = POKER_RANK[a.rank] || 0;
        const rankB = POKER_RANK[b.rank] || 0;
        if (rankA !== rankB) return rankA > rankB ? a : b;
        const suitA = SUIT_ORDER[a.suit] || 0;
        const suitB = SUIT_ORDER[b.suit] || 0;
        return suitA > suitB ? a : b;
    });
    const timerSegments = getTimerSizeFromRank(highestRank.rank);
    const timerCard = `${getRankName(highestRank.rank)} of ${getSuitName(highestRank.suit)}`;
    
    const allCards = [spade, heart, club, diamond];
    const aces = allCards.filter(c => c.rank === 'A');
    let aceEffect = null;
    if (aces.length > 0) {
        const aceCard = aces[0];
        aceEffect = getAceEffect(regionName, aceCard);
        if (typeof logRecordingEvent === 'function') {
            logRecordingEvent('travel_leg_ace', `♠️ Travel Ace Effect: ${aceEffect.emoji} ${aceEffect.text} (Leg ${legIndex + 1}, ${regionName})`);
        }
    }
    
    const synthesis = `Place: ${place}\nActor: ${actor}\nPressure: ${pressure}\nLeverage: ${leverage}`;
    
    return {
        cards,
        place,
        actor,
        pressure,
        leverage,
        timerSegments,
        timerCard,
        synthesis,
        aceEffect,
        cardDetails: {
            spade: { rank: spade.rank, suit: spade.suit, symbol: getSuitSymbol('spades'), color: getSuitColor('spades'), meaning: place },
            heart: { rank: heart.rank, suit: heart.suit, symbol: getSuitSymbol('hearts'), color: getSuitColor('hearts'), meaning: actor },
            club: { rank: club.rank, suit: club.suit, symbol: getSuitSymbol('clubs'), color: getSuitColor('clubs'), meaning: pressure },
            diamond: { rank: diamond.rank, suit: diamond.suit, symbol: getSuitSymbol('diamonds'), color: getSuitColor('diamonds'), meaning: leverage }
        }
    };
}

async function generateJourneyAsync(startRegion, destRegion, numLegs = 3) {
    if (!startRegion || !destRegion) {
        showToast('Please select both start and destination regions.', 'error');
        return null;
    }
    
    const data = await fetchRegionData(destRegion);
    if (!data) {
        showToast('Could not load region data.', 'error');
        return null;
    }
    
    const deck = buildDeck();
    const legs = [];
    let totalTimer = 0;
    let highestCardOverall = null;
    let allAceEffects = [];
    
    for (let i = 0; i < numLegs; i++) {
        const leg = generateLeg(deck, data, destRegion, i);
        legs.push(leg);
        totalTimer += leg.timerSegments;
        if (leg.aceEffect) {
            allAceEffects.push(leg.aceEffect);
        }
        if (!highestCardOverall) {
            highestCardOverall = leg.cards.spade;
        } else {
            const rankA = POKER_RANK[leg.cards.spade.rank] || 0;
            const rankB = POKER_RANK[highestCardOverall.rank] || 0;
            if (rankA > rankB) {
                highestCardOverall = leg.cards.spade;
            } else if (rankA === rankB) {
                const suitA = SUIT_ORDER[leg.cards.spade.suit] || 0;
                const suitB = SUIT_ORDER[highestCardOverall.suit] || 0;
                if (suitA > suitB) {
                    highestCardOverall = leg.cards.spade;
                }
            }
        }
    }
    
    const totalSegments = Math.min(totalTimer, 10);
    
    let overallSynthesis = `Journey from ${startRegion} to ${destRegion}. ${legs.length} leg(s). ` +
        legs.map((leg, i) => `Leg ${i+1}: ${leg.place} | ${leg.actor} | ${leg.pressure} | ${leg.leverage}`).join('; ');
    
    if (allAceEffects.length > 0) {
        overallSynthesis += '\n\n♠️ **Ace Effects:**\n' +
            allAceEffects.map((e, i) => `${e.emoji} ${e.text}`).join('\n');
    }
    
    const roles = TRAVEL_ROLES.map(role => ({ ...role, assigned: true }));
    
    const journey = {
        startRegion,
        destRegion,
        numLegs,
        legs,
        totalSegments,
        maxTimer: legs.reduce((max, leg) => Math.max(max, leg.timerSegments), 0),
        overallSynthesis,
        roles,
        highestCard: highestCardOverall ? `${getRankName(highestCardOverall.rank)} of ${getSuitName(highestCardOverall.suit)}` : 'N/A',
        timestamp: new Date().toISOString(),
        aceEffects: allAceEffects
    };
    
    currentJourney = journey;
    
    // Comprehensive logging
    if (typeof logRecordingEvent === 'function') {
        logRecordingEvent('journey_generated', `🗺️ Journey: ${journey.startRegion} → ${journey.destRegion} (${journey.numLegs} legs, ${journey.totalSegments} segments, ${journey.aceEffects.length} Ace effects)`);
        if (allAceEffects.length > 0) {
            const aceSummary = allAceEffects.map(e => `${e.emoji} ${e.text}`).join('; ');
            logRecordingEvent('journey_ace_summary', `♠️ Ace effects: ${aceSummary}`);
        }
        // Log each leg's details
        legs.forEach((leg, idx) => {
            logRecordingEvent('journey_leg', `Leg ${idx+1}: Place: ${leg.place} | Actor: ${leg.actor} | Pressure: ${leg.pressure} | Leverage: ${leg.leverage} | Timer: ${leg.timerSegments} segments`);
        });
    }
    
    return journey;
}

// ============================================================
// RENDER
// ============================================================

export async function render(el) {
    container = el;
    
    const regionNames = getRegionNames() || ['Acasia', 'Ecktoria', 'Vhasia', 'Viterra', 'Ykrul', 'Silkstrand'];
    if (regionNames.length === 0) {
        regionNames = ['Acasia'];
    }
    regionList = regionNames;
    
    let currentRegion = getSelectedRegion() || regionNames[0];
    selectedStartRegion = currentRegion;
    selectedDestRegion = regionNames.length > 1 ? regionNames[1] : regionNames[0];
    
    const isDeterministic = !!travelSeed;
    
    container.innerHTML = `
        <div class="travel-planner">
            <div class="travel-planner-header">
                <h1 class="page-title">🗺️ Travel Planner</h1>
                <p class="page-sub">Plan journeys using the Cartomancy system. Draw cards to generate places, actors, pressures, and leverage for each leg.</p>
            </div>
            
            <div class="panel" style="padding:0.3rem 0.8rem;margin-bottom:0.5rem;background:var(--bg3);border-left:3px solid ${isDeterministic ? 'var(--gold)' : 'var(--text3)'};">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                    <span style="font-size:0.8rem;color:var(--text2);">
                        ${isDeterministic ? '🎲 Deterministic RNG (seeded)' : '🔀 Cryptographic RNG (random)'}
                        ${isDeterministic ? `<span style="font-size:0.6rem;color:var(--text3);font-family:monospace;">seed: ${travelSeed.substring(0, 8)}...</span>` : ''}
                    </span>
                </div>
            </div>
            
            <div class="panel">
                <h3>Journey Configuration</h3>
                <div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:end;">
                    <div class="field" style="flex:1;min-width:150px;">
                        <label>Start Region</label>
                        <select id="travel-start-region">
                            ${regionNames.map(name => `<option value="${name}" ${name === selectedStartRegion ? 'selected' : ''}>${name}</option>`).join('')}
                        </select>
                    </div>
                    <div style="font-size:1.5rem;color:var(--text3);">→</div>
                    <div class="field" style="flex:1;min-width:150px;">
                        <label>Destination Region</label>
                        <select id="travel-dest-region">
                            ${regionNames.map(name => `<option value="${name}" ${name === selectedDestRegion ? 'selected' : ''}>${name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="field" style="flex:0 0 120px;">
                        <label>Number of Legs</label>
                        <select id="travel-legs">
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3" selected>3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                        </select>
                    </div>
                    <button class="btn btn-gold" id="travel-generate-btn">🃏 Generate Journey</button>
                    <button class="btn" id="travel-reshuffle-btn">↺ Reshuffle</button>
                </div>
                <div style="margin-top:0.5rem;font-size:0.85rem;color:var(--text2);">
                    Each leg draws four cards: Place (♠), Actor (♥), Pressure (♣), Leverage (♦). The highest card sets a suggested timer.
                    <span style="color:var(--gold);">♠ Ace cards trigger special journey omens!</span>
                </div>
            </div>
            
            <div id="travel-journey-display" class="panel" style="display:none;">
                <div id="travel-journey-header">
                    <h3 id="travel-journey-title">Journey</h3>
                    <div id="travel-journey-meta" style="font-size:0.9rem;color:var(--text2);"></div>
                </div>
                <div id="travel-journey-legs" style="margin-top:0.5rem;"></div>
                <div id="travel-journey-synthesis" style="margin-top:0.8rem;background:var(--bg3);padding:0.8rem 1rem;border-radius:var(--radius);border-left:4px solid var(--gold);white-space:pre-wrap;"></div>
                <div id="travel-timer-result" style="margin-top:0.5rem;display:none;background:var(--bg3);padding:0.5rem 1rem;border-radius:var(--radius);border-left:4px solid var(--accent);"></div>
                <div style="margin-top:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" id="travel-add-timer-btn">⏱️ Add Timer</button>
                    <button class="btn btn-sm btn-secondary" id="travel-copy-btn">📋 Copy Summary</button>
                    <button class="btn btn-sm btn-secondary" id="travel-export-btn">📤 Export</button>
                    <button class="btn btn-sm btn-secondary" id="travel-import-btn">📥 Import</button>
                </div>
            </div>
            
            <div class="panel">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                    <h3 style="margin:0;">📜 Journey History</h3>
                    <button class="btn btn-sm" id="travel-history-clear-btn">Clear History</button>
                </div>
                <div id="travel-history" style="max-height:200px;overflow-y:auto;margin-top:0.5rem;font-size:0.85rem;">
                    <span class="text-muted">No journeys planned yet.</span>
                </div>
            </div>
        </div>
    `;
    
    attachEvents();
    isInitialized = true;
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function attachEvents() {
    const generateBtn = document.getElementById('travel-generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }
    
    const reshuffleBtn = document.getElementById('travel-reshuffle-btn');
    if (reshuffleBtn) {
        reshuffleBtn.addEventListener('click', handleReshuffle);
    }
    
    const clearBtn = document.getElementById('travel-history-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', handleClearHistory);
    }
    
    const addTimerBtn = document.getElementById('travel-add-timer-btn');
    if (addTimerBtn) {
        addTimerBtn.addEventListener('click', handleAddTimer);
    }
    
    const copyBtn = document.getElementById('travel-copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', handleCopy);
    }
    
    // NEW: Export & Import
    const exportBtn = document.getElementById('travel-export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExport);
    }
    
    const importBtn = document.getElementById('travel-import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', handleImport);
    }
    
    const startSelect = document.getElementById('travel-start-region');
    if (startSelect) {
        startSelect.addEventListener('change', (e) => {
            selectedStartRegion = e.target.value;
        });
    }
    const destSelect = document.getElementById('travel-dest-region');
    if (destSelect) {
        destSelect.addEventListener('change', (e) => {
            selectedDestRegion = e.target.value;
        });
    }
}

// ============================================================
// HANDLERS
// ============================================================

async function handleGenerate() {
    const startSelect = document.getElementById('travel-start-region');
    const destSelect = document.getElementById('travel-dest-region');
    const legsSelect = document.getElementById('travel-legs');
    
    if (!startSelect || !destSelect || !legsSelect) {
        showToast('Form elements not found.', 'error');
        return;
    }
    
    const start = startSelect.value;
    const dest = destSelect.value;
    const numLegs = parseInt(legsSelect.value, 10) || 3;
    
    if (start === dest) {
        showToast('Start and destination regions must be different.', 'warning');
        return;
    }
    
    showToast('Generating journey...', 'info');
    
    try {
        const journey = await generateJourneyAsync(start, dest, numLegs);
        if (!journey) {
            showToast('Failed to generate journey.', 'error');
            return;
        }
        displayJourney(journey);
        addToHistory(journey);
        const aceCount = journey.aceEffects ? journey.aceEffects.length : 0;
        showToast(`Journey from ${start} to ${dest} generated with ${numLegs} leg(s). ${aceCount > 0 ? `♠️ ${aceCount} Ace effect(s) triggered!` : ''}`, 'success');
        
        if (typeof logRecordingEvent === 'function') {
            logRecordingEvent('travel_planner_generate', `User generated journey: ${start} → ${dest} (${numLegs} legs)`);
        }
    } catch (err) {
        console.error('Error generating journey:', err);
        showToast('Error generating journey.', 'error');
    }
}

function handleReshuffle() {
    handleGenerate();
}

function handleClearHistory() {
    if (journeyHistory.length === 0) return;
    if (confirm('Clear all journey history?')) {
        journeyHistory = [];
        renderHistory();
        showToast('History cleared.', 'info');
        if (typeof logRecordingEvent === 'function') {
            logRecordingEvent('travel_history_cleared', 'Journey history cleared');
        }
    }
}

function handleAddTimer() {
    if (!currentJourney) {
        showToast('No journey to add timer from.', 'error');
        return;
    }
    const timerName = `Travel: ${currentJourney.startRegion} → ${currentJourney.destRegion}`;
    const segments = currentJourney.totalSegments || 6;
    
    import('../timers/index.js').then(module => {
        if (module.openTimerEditor) {
            module.openTimerEditor({
                name: timerName,
                segments: segments,
                current: 0
            });
            showToast(`⏱️ Creating timer: ${timerName} (${segments} segments)`, 'success');
            if (typeof logRecordingEvent === 'function') {
                logRecordingEvent('travel_timer_created', `Timer created: ${timerName} (${segments} segments)`);
            }
        } else {
            const state = getState();
            if (!state.timers) state.timers = [];
            const newTimer = {
                id: 'travel-timer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                name: timerName,
                segments: segments,
                current: 0
            };
            state.timers.push(newTimer);
            const event = new CustomEvent('timer-added', { detail: { timer: newTimer } });
            document.dispatchEvent(event);
            showToast(`⏱️ Timer created: ${newTimer.name} (${segments} segments)`, 'success');
            if (typeof logRecordingEvent === 'function') {
                logRecordingEvent('travel_timer_created', `Timer created: ${newTimer.name} (${segments} segments)`);
            }
        }
    }).catch(() => {
        const state = getState();
        if (!state.timers) state.timers = [];
        const newTimer = {
            id: 'travel-timer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: timerName,
            segments: segments,
            current: 0
        };
        state.timers.push(newTimer);
        const event = new CustomEvent('timer-added', { detail: { timer: newTimer } });
        document.dispatchEvent(event);
        showToast(`⏱️ Timer created: ${newTimer.name} (${segments} segments)`, 'success');
        if (typeof logRecordingEvent === 'function') {
            logRecordingEvent('travel_timer_created', `Timer created: ${newTimer.name} (${segments} segments)`);
        }
    });
}

function handleCopy() {
    if (!currentJourney) {
        showToast('No journey to copy.', 'error');
        return;
    }
    const summary = generateJourneySummary(currentJourney);
    navigator.clipboard.writeText(summary).then(() => {
        showToast('Journey summary copied to clipboard.', 'success');
        if (typeof logRecordingEvent === 'function') {
            logRecordingEvent('travel_summary_copied', 'Journey summary copied to clipboard');
        }
    }).catch(() => {
        prompt('Copy the following summary:', summary);
    });
}

// ============================================================
// EXPORT / IMPORT HANDLERS
// ============================================================

function handleExport() {
    if (!currentJourney) {
        showToast('No journey to export.', 'error');
        return;
    }
    
    try {
        const json = JSON.stringify(currentJourney, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        a.download = `journey_${currentJourney.startRegion}_to_${currentJourney.destRegion}_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Journey exported successfully.', 'success');
        if (typeof logRecordingEvent === 'function') {
            logRecordingEvent('travel_export', `Exported journey: ${currentJourney.startRegion} → ${currentJourney.destRegion} (${currentJourney.numLegs} legs)`);
        }
    } catch (err) {
        console.error('Export error:', err);
        showToast('Error exporting journey.', 'error');
    }
}

function handleImport() {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    document.body.appendChild(input);
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) {
            document.body.removeChild(input);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);
                
                // Validate required fields
                const required = ['startRegion', 'destRegion', 'legs', 'totalSegments', 'numLegs', 'timestamp'];
                const missing = required.filter(field => !(field in data));
                if (missing.length > 0) {
                    showToast(`Invalid journey file: missing fields: ${missing.join(', ')}`, 'error');
                    document.body.removeChild(input);
                    return;
                }
                
                // Validate legs array
                if (!Array.isArray(data.legs) || data.legs.length === 0) {
                    showToast('Invalid journey file: legs must be a non-empty array.', 'error');
                    document.body.removeChild(input);
                    return;
                }
                
                // Check each leg has required fields
                const legRequired = ['place', 'actor', 'pressure', 'leverage', 'timerSegments', 'timerCard', 'cardDetails'];
                for (let i = 0; i < data.legs.length; i++) {
                    const leg = data.legs[i];
                    const missingLeg = legRequired.filter(f => !(f in leg));
                    if (missingLeg.length > 0) {
                        showToast(`Invalid journey file: leg ${i+1} missing fields: ${missingLeg.join(', ')}`, 'error');
                        document.body.removeChild(input);
                        return;
                    }
                }
                
                // Ensure aceEffects exists
                if (!data.aceEffects) data.aceEffects = [];
                
                // Set as current journey
                currentJourney = data;
                displayJourney(data);
                addToHistory(data);
                
                showToast(`Journey imported: ${data.startRegion} → ${data.destRegion} (${data.numLegs} legs)`, 'success');
                if (typeof logRecordingEvent === 'function') {
                    logRecordingEvent('travel_import', `Imported journey: ${data.startRegion} → ${data.destRegion} (${data.numLegs} legs)`);
                }
            } catch (err) {
                console.error('Import error:', err);
                showToast('Error parsing journey file.', 'error');
            }
            document.body.removeChild(input);
        };
        
        reader.onerror = function() {
            showToast('Error reading file.', 'error');
            document.body.removeChild(input);
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// ============================================================
// DISPLAY FUNCTIONS
// ============================================================

function displayJourney(journey) {
    const display = document.getElementById('travel-journey-display');
    if (!display) return;
    display.style.display = 'block';
    
    const title = document.getElementById('travel-journey-title');
    if (title) {
        title.textContent = `🗺️ Journey: ${journey.startRegion} → ${journey.destRegion}`;
    }
    const meta = document.getElementById('travel-journey-meta');
    if (meta) {
        meta.innerHTML = `
            <span>Legs: ${journey.numLegs}</span>
            <span style="margin-left:1rem;">Total Timer: ${journey.totalSegments} segments</span>
            <span style="margin-left:1rem;">Highest Card: ${journey.highestCard}</span>
            ${journey.aceEffects && journey.aceEffects.length > 0 ? `<span style="margin-left:1rem;color:var(--gold);">♠️ ${journey.aceEffects.length} Ace effect(s)</span>` : ''}
        `;
    }
    
    const legsContainer = document.getElementById('travel-journey-legs');
    if (legsContainer) {
        legsContainer.innerHTML = journey.legs.map((leg, idx) => {
            const hasAce = !!leg.aceEffect;
            return `
            <div style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;margin-bottom:0.5rem;border-left:4px solid ${hasAce ? 'var(--gold)' : 'var(--border)'};">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                    <strong style="font-size:1rem;">Leg ${idx+1}</strong>
                    <span style="font-size:0.8rem;color:var(--text3);">Timer: ${leg.timerSegments} segments (${leg.timerCard})</span>
                </div>
                ${hasAce ? `
                    <div style="margin:0.3rem 0;padding:0.2rem 0.6rem;background:var(--bg4);border-radius:var(--radius);border:1px solid var(--gold);color:var(--gold);font-size:0.85rem;">
                        ♠️ <strong>Ace Effect:</strong> ${leg.aceEffect.emoji} ${leg.aceEffect.text}
                    </div>
                ` : ''}
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.5rem;margin-top:0.3rem;">
                    <div style="background:var(--bg3);padding:0.3rem 0.5rem;border-radius:4px;border-left:3px solid ${leg.cardDetails.spade.color};">
                        <span style="font-weight:bold;">♠ Place:</span> ${leg.place}
                    </div>
                    <div style="background:var(--bg3);padding:0.3rem 0.5rem;border-radius:4px;border-left:3px solid ${leg.cardDetails.heart.color};">
                        <span style="font-weight:bold;">♥ Actor:</span> ${leg.actor}
                    </div>
                    <div style="background:var(--bg3);padding:0.3rem 0.5rem;border-radius:4px;border-left:3px solid ${leg.cardDetails.club.color};">
                        <span style="font-weight:bold;">♣ Pressure:</span> ${leg.pressure}
                    </div>
                    <div style="background:var(--bg3);padding:0.3rem 0.5rem;border-radius:4px;border-left:3px solid ${leg.cardDetails.diamond.color};">
                        <span style="font-weight:bold;">♦ Leverage:</span> ${leg.leverage}
                    </div>
                </div>
                <div style="margin-top:0.2rem;font-size:0.75rem;color:var(--text3);">
                    Cards: ${getRankName(leg.cards.spade.rank)}♠ ${getRankName(leg.cards.heart.rank)}♥ ${getRankName(leg.cards.club.rank)}♣ ${getRankName(leg.cards.diamond.rank)}♦
                </div>
            </div>
        `}).join('');
    }
    
    const synth = document.getElementById('travel-journey-synthesis');
    if (synth) {
        synth.textContent = journey.overallSynthesis;
    }
    
    const timerResult = document.getElementById('travel-timer-result');
    if (timerResult) {
        if (journey.totalSegments > 0) {
            timerResult.style.display = 'block';
            timerResult.innerHTML = `
                <strong>⏱️ Suggested Travel Timer:</strong> ${journey.totalSegments} segments 
                (based on highest card per leg, combined).
                <span style="font-size:0.8rem;color:var(--text3);">Click "Add Timer" to create.</span>
            `;
        } else {
            timerResult.style.display = 'none';
        }
    }
}

function renderHistory() {
    const el = document.getElementById('travel-history');
    if (!el) return;
    if (journeyHistory.length === 0) {
        el.innerHTML = '<span class="text-muted">No journeys planned yet.</span>';
        return;
    }
    el.innerHTML = journeyHistory.slice().reverse().map(j => {
        const aceCount = j.aceEffects ? j.aceEffects.length : 0;
        return `
        <div style="padding:0.3rem 0;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;">
            <span style="color:var(--text3);font-size:0.7rem;">[${new Date(j.timestamp).toLocaleTimeString()}]</span>
            <span style="font-weight:500;">${j.startRegion} → ${j.destRegion}</span>
            <span style="font-size:0.8rem;color:var(--text2);">(${j.numLegs} legs, ${j.totalSegments} segments)</span>
            ${aceCount > 0 ? `<span style="color:var(--gold);font-size:0.8rem;">♠️ ${aceCount} Ace</span>` : ''}
            <button class="btn btn-xs btn-ghost" data-journey-index="${journeyHistory.length - 1 - journeyHistory.slice().reverse().indexOf(j)}" style="margin-left:auto;">👁️ View</button>
        </div>
    `}).join('');
    
    el.querySelectorAll('[data-journey-index]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.journeyIndex, 10);
            const journey = journeyHistory[idx];
            if (journey) {
                displayJourney(journey);
                currentJourney = journey;
                showToast(`Loaded journey: ${journey.startRegion} → ${journey.destRegion}`, 'info');
            }
        });
    });
}

function addToHistory(journey) {
    journeyHistory.push(journey);
    renderHistory();
}

function generateJourneySummary(journey) {
    let summary = `Journey from ${journey.startRegion} to ${journey.destRegion}\n`;
    summary += `Legs: ${journey.numLegs}\n`;
    summary += `Total Timer: ${journey.totalSegments} segments\n`;
    if (journey.aceEffects && journey.aceEffects.length > 0) {
        summary += `♠️ Ace Effects:\n`;
        journey.aceEffects.forEach(e => summary += `  ${e.emoji} ${e.text}\n`);
    }
    summary += `\n`;
    journey.legs.forEach((leg, i) => {
        summary += `Leg ${i+1}:\n`;
        summary += `  Place: ${leg.place}\n`;
        summary += `  Actor: ${leg.actor}\n`;
        summary += `  Pressure: ${leg.pressure}\n`;
        summary += `  Leverage: ${leg.leverage}\n`;
        summary += `  Timer: ${leg.timerSegments} segments (${leg.timerCard})\n`;
        if (leg.aceEffect) {
            summary += `  ♠️ Ace Effect: ${leg.aceEffect.emoji} ${leg.aceEffect.text}\n`;
        }
        summary += `\n`;
    });
    summary += `Overall: ${journey.overallSynthesis}`;
    return summary;
}

// ============================================================
// LIFECYCLE METHODS
// ============================================================

export function onActivate() {
    console.log('[TravelPlanner] Activated');
    if (currentJourney) {
        displayJourney(currentJourney);
    }
    renderHistory();
}

export function onDeactivate() {
    console.log('[TravelPlanner] Deactivated');
}

export function refresh() {
    if (container) {
        render(container);
    }
}

export function destroy() {
    container = null;
    journeyHistory = [];
    currentJourney = null;
    isInitialized = false;
}

// ============================================================
// EXPORTS
// ============================================================

export default {
    render,
    onActivate,
    onDeactivate,
    refresh,
    destroy,
    generateJourneyAsync,
    getCurrentJourney: () => currentJourney,
    getHistory: () => journeyHistory
};