/**
 * Server-side Deck of Consequences module.
 * Loads region data from /data/regions/ (same as client).
 * Provides card draw, Crown Spread, and region-aware synthesis.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Constants ────────────────────────────────────────────────────────
const REGION_DIR = path.resolve(process.cwd(), 'data', 'regions');

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

const SUIT_ARCHETYPES = {
    hearts: { label: 'Actor', desc: 'a person, faction, or relationship that drives the scene' },
    spades: { label: 'Location', desc: 'a place, terrain, or environmental feature' },
    clubs: { label: 'Complication', desc: 'an obstacle, danger, or twist' },
    diamonds: { label: 'Reward/Leverage', desc: 'a resource, opportunity, or material gain' }
};

const RANK_TIERS = {
    '2': { tier: 'Minor', segments: 4 },
    '3': { tier: 'Minor', segments: 4 },
    '4': { tier: 'Minor', segments: 4 },
    '5': { tier: 'Minor', segments: 4 },
    '6': { tier: 'Medium', segments: 6 },
    '7': { tier: 'Medium', segments: 6 },
    '8': { tier: 'Medium', segments: 6 },
    '9': { tier: 'Medium', segments: 6 },
    '10': { tier: 'Major', segments: 8 },
    'J': { tier: 'Major', segments: 8 },
    'Q': { tier: 'Major', segments: 8 },
    'K': { tier: 'Major', segments: 8 },
    'A': { tier: 'Ace', segments: 10 }
};

const POKER_RANK = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
const SUIT_ORDER = { 'spades': 4, 'hearts': 3, 'diamonds': 2, 'clubs': 1 };

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

const CROWN_POSITIONS = [
    { key: 'root', label: 'Root', icon: '🌱', desc: 'The underlying tension or theme of the situation.', interpretive: 'What has been growing beneath the surface?' },
    { key: 'crest', label: 'Crest', icon: '🏔️', desc: 'A key faction, patron, or influence that will rise.', interpretive: 'What power is gathering strength?' },
    { key: 'crown', label: 'Crown', icon: '👑', desc: 'The climax image or major confrontation.', interpretive: 'What is the shape of the storm that awaits?' },
    { key: 'left', label: 'Left Hand', icon: '🤝', desc: 'A bond, ally, or relationship that anchors play.', interpretive: 'Who stands with you?' },
];

const ACE_EFFECTS = {
    generic: [
        { emoji: '👻', text: 'The Hollow takes notice. A pale figure watches from the corner of your eye.' },
        { emoji: '🔔', text: 'A bell rings without being struck. The ninth chime is silent.' },
        { emoji: '🌫️', text: 'Mist rolls in, carrying whispers of a debt unpaid.' },
        { emoji: '🕯️', text: 'A candle gutters and relights itself, burning blue.' },
        { emoji: '🃏', text: 'The Joker\'s wildcard manifests — the unexpected becomes inevitable.' },
        { emoji: '🌙', text: 'The moon flickers. For a moment, you see two shadows.' },
        { emoji: '⚖️', text: 'A scale appears in the air, weighing something you cannot see.' },
        { emoji: '🕸️', text: 'A spider web glistens in the corner, its threads forming a pattern you almost recognize.' },
        { emoji: '🗝️', text: 'A key falls from an empty pocket. It unlocks a door you haven\'t found yet.' },
        { emoji: '🦉', text: 'An owl lands and watches you, unblinking. It does not fly away when you approach.' },
        { emoji: '🍷', text: 'A cup of wine spills, but the stain forms a map that wasn\'t there a moment ago.' },
        { emoji: '🍂', text: 'A dead leaf falls upward, pointing toward a hidden path.' }
    ],
    acasia: [
        { emoji: '🌿', text: 'The Curse stirs. A crossroads behind you now leads to a place you have already been.' },
        { emoji: '🪦', text: 'A broken milestone weeps rust. The empire\'s ghost is counting.' },
        { emoji: '🔥', text: 'A free company\'s banner flickers in the distance, its colors changed.' }
    ],
    // ... (other region-specific effects can be added, but fallback to generic if missing)
};

// ─── Helper: deterministic shuffle (not used for server, but kept for parity) ──
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ─── Region data cache ──────────────────────────────────────────────
const regionCache = new Map();

// ─── Transform region data (same logic as client) ────────────────
function transformRegionData(raw) {
    if (!raw) return null;
    // If it's already in the transformed format (has suits as objects), return as is
    if (raw.hearts && raw.spades && raw.clubs && raw.diamonds && typeof raw.hearts === 'object') {
        return raw;
    }

    const transformed = {
        name: raw.title || raw.id || 'Unknown',
        description: '',
        spades: {},
        hearts: {},
        clubs: {},
        diamonds: {},
        tags: [],
        metadata: { source_file: raw.id || 'unknown' }
    };

    if (raw.overview) {
        let desc = '';
        if (raw.overview.tagline) desc += `<p><em>${raw.overview.tagline}</em></p>`;
        if (raw.overview.genre) desc += `<p><strong>Genre:</strong> ${raw.overview.genre}</p>`;
        if (raw.overview.mood) desc += `<p><strong>Mood:</strong> ${raw.overview.mood}</p>`;
        if (raw.overview.starting_location) desc += `<p><strong>Starting Location:</strong> ${raw.overview.starting_location}</p>`;
        if (raw.overview.lore) {
            if (raw.overview.lore.history) desc += `<p>${raw.overview.lore.history}</p>`;
            if (raw.overview.lore.first_notice) desc += `<p><strong>What you notice first:</strong> ${raw.overview.lore.first_notice}</p>`;
            if (raw.overview.lore.rule_that_kills) desc += `<p><strong>Rule that kills:</strong> ${raw.overview.lore.rule_that_kills}</p>`;
        }
        transformed.description = desc;
        // Extract tags from overview text
        const text = JSON.stringify(raw.overview);
        const tags = extractTagsFromText(text);
        transformed.tags.push(...tags);
    }

    const suitMap = {
        spades: 'places',
        hearts: 'people_and_factions',
        clubs: 'complications',
        diamonds: 'rewards'
    };

    for (const suit of SUITS) {
        const key = suitMap[suit];
        const items = raw[key];
        if (!items || !Array.isArray(items)) continue;
        for (const card of items) {
            const rawRank = String(card.rank || '');
            if (!rawRank) continue;
            const rankKey = mapNumericRank(rawRank);

            let meaning = `${card.title || 'Untitled'}: ${card.description || ''}`;
            if (card.flavor) meaning += ` <em>${card.flavor}</em>`;
            if (card.mechanical_hook) meaning += ` [Mechanic: ${card.mechanical_hook}]`;
            if (card.what_they_carry) meaning += ` [Carries: ${card.what_they_carry}]`;
            if (card.what_they_ask) meaning += ` [Asks: ${card.what_they_ask}]`;
            if (card.debt) meaning += ` [Debt: ${card.debt}]`;
            if (card.price) meaning += ` [Price: ${card.price}]`;
            if (card.curse_cost) meaning += ` [Cost: ${card.curse_cost}]`;
            transformed[suit][rankKey] = meaning;

            const tags = [];
            if (card.subtitle) tags.push(card.subtitle);
            if (card.tags && Array.isArray(card.tags)) tags.push(...card.tags);
            const cardText = JSON.stringify(card);
            const cardTags = extractTagsFromText(cardText);
            tags.push(...cardTags);
            for (const tag of tags) {
                const clean = tag.replace(/[\[\]]/g, '').trim().toUpperCase();
                if (clean) transformed.tags.push(clean);
            }
        }
    }

    const extraFields = ['ninth_taboo', 'lore_echoes', 'superstitions', 'additional_features'];
    for (const field of extraFields) {
        if (raw[field]) {
            const text = JSON.stringify(raw[field]);
            const tags = extractTagsFromText(text);
            transformed.tags.push(...tags);
        }
    }

    transformed.tags = [...new Set(transformed.tags)].filter(t => t && t.length > 0);

    transformed.metadata = {
        source_file: raw.id || 'unknown',
        version: raw.version || '1.0.0',
        type: raw.type || 'generator'
    };

    return transformed;
}

function mapNumericRank(rank) {
    const num = parseInt(rank, 10);
    if (isNaN(num)) return String(rank);
    if (num >= 2 && num <= 10) return String(num);
    if (num === 11) return 'J';
    if (num === 12) return 'Q';
    if (num === 13) return 'K';
    if (num === 14) return 'A';
    return String(num);
}

function extractTagsFromText(text) {
    if (!text || typeof text !== 'string') return [];
    const tags = [];
    const hashMatches = text.match(/#([A-Za-z0-9_]+)/g);
    if (hashMatches) {
        tags.push(...hashMatches.map(t => t.slice(1).toUpperCase()));
    }
    const capMatches = text.match(/\b([A-Z]{3,})\b/g);
    if (capMatches) {
        tags.push(...capMatches);
    }
    const bracketMatches = text.match(/\[([A-Za-z0-9_]+)\]/g);
    if (bracketMatches) {
        tags.push(...bracketMatches.map(t => t.slice(1, -1).toUpperCase()));
    }
    return [...new Set(tags)];
}

// ─── Load region data from file system ─────────────────────────────
function loadRegionDataSync(regionName) {
    if (regionCache.has(regionName)) {
        return regionCache.get(regionName);
    }

    const slug = regionName.toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '');
    const filePath = path.join(REGION_DIR, `${slug}.json`);

    try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const data = transformRegionData(raw);
        regionCache.set(regionName, data);
        console.log(`[Deck] Loaded region data for ${regionName}`);
        return data;
    } catch (e) {
        console.warn(`[Deck] Could not load ${regionName}, using fallback.`, e.message);
        const fallback = createFallbackData(regionName);
        regionCache.set(regionName, fallback);
        return fallback;
    }
}

function createFallbackData(regionName) {
    return {
        name: regionName,
        description: `${regionName} – A region of Fate's Edge. (Using fallback data)`,
        hearts: { "A": "A matter of loyalty or love arises." },
        spades: { "A": "A conflict or struggle emerges." },
        clubs: { "A": "A physical challenge or obstacle appears." },
        diamonds: { "A": "A resource, treasure, or opportunity is found." }
    };
}

// ─── Get card meaning from region ──────────────────────────────────
function getCardMeaningFromRegion(suit, rank, regionData) {
    const suitKey = suit;
    const obj = regionData[suitKey];
    const rankName = RANK_NAMES[rank] || rank;
    const suitName = SUIT_NAMES[suit] || suit;
    const archetype = SUIT_ARCHETYPES[suit] || { label: 'Element', desc: 'a force' };
    const tierInfo = RANK_TIERS[rank] || { tier: 'Minor', segments: 4 };

    if (!obj || !obj[rank]) {
        const tier = tierInfo.tier;
        const segments = tierInfo.segments;
        return `${rankName} of ${suitName} (${archetype.label} – ${tier}): A ${archetype.label.toLowerCase()} arises. ${archetype.desc}. This card suggests a ${tier.toLowerCase()} influence (${segments}-segment clock if this is the highest card).`;
    }

    const specific = obj[rank];
    const tier = tierInfo.tier;
    const segments = tierInfo.segments;
    return `${rankName} of ${suitName} (${archetype.label} – ${tier}): ${specific} (${segments} segments if highest).`;
}

// ─── Get wildcard meaning ──────────────────────────────────────────
function getWildcardMeaning(card, regionData) {
    const twists = DEFAULT_TWISTS;
    const seed = (card?.suit || 'joker') + (card?.rank || '') + 'deck';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    const idx = Math.abs(hash) % twists.length;
    const isJoker = card.isJoker === true;
    const cardName = isJoker ? 'Joker' : `${card?.rankName || card?.rank || '?'} of ${card?.suitName || card?.suit || '?'}`;
    return `✨ Twist (${cardName}): ${twists[idx]}`;
}

// ─── Get Ace effect ─────────────────────────────────────────────────
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

// ─── Synthesise consequence (1-3 cards) ────────────────────────────
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

// ─── Synthesise Crown Spread ────────────────────────────────────────
function synthesiseCrownSpread(mainCards, wildcard, regionData) {
    const positions = CROWN_POSITIONS;
    const positionCards = mainCards.map((card, i) => {
        const pos = positions[i];
        const interpretation = interpretCrownCard(card, pos, regionData);
        return {
            ...interpretation,
            position: pos,
            card: card,
            isJoker: card.isJoker || false,
            rankName: card.isJoker ? 'Joker' : RANK_NAMES[card.rank],
            suitName: card.isJoker ? '' : SUIT_NAMES[card.suit]
        };
    });

    const wildcardMeaning = getWildcardMeaning(wildcard, regionData);

    let synthesis = `The Crown Spread reveals a story of tension and consequence.\n\n`;
    synthesis += `🌱 Root: ${positionCards[0].regionMeaning || positionCards[0].description}\n\n`;
    synthesis += `🏔️ Crest: ${positionCards[1].regionMeaning || positionCards[1].description}\n\n`;
    synthesis += `👑 Crown: ${positionCards[2].regionMeaning || positionCards[2].description}\n\n`;
    synthesis += `🤝 Left Hand: ${positionCards[3].regionMeaning || positionCards[3].description}\n\n`;
    synthesis += `🌟 Wildcard: ${wildcardMeaning}`;

    // Determine highest card for timer
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
    if (highest && !highest.isJoker) {
        const rankVal = POKER_RANK[highest.rank] || 0;
        let segments = 4;
        if (rankVal === 14) segments = 10;
        else if (rankVal >= 10) segments = 8;
        else if (rankVal >= 6) segments = 6;
        else segments = 4;
        timer = segments;
        timerCard = `${highest.rankName} of ${highest.suitName}`;
    } else if (highest) {
        timer = 4;
        timerCard = 'Joker (Wildcard)';
    }

    if (timer) {
        synthesis += `\n\n⏱️ The highest card (${timerCard}) suggests a timer of ${timer} segments—a pressure that will build until it breaks.`;
    }

    return {
        synthesis,
        timer: timer ? { segments: timer, card: timerCard } : null,
        positions: positionCards,
        wildcard: wildcardMeaning
    };
}

function interpretCrownCard(card, position, regionData) {
    if (card.isJoker) {
        return {
            title: '🃏 Joker — The Wildcard',
            description: 'The unexpected. The impossible. A force that does not follow the rules.',
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
        description, regionMeaning, suit: card.suit, rank: card.rank, color, symbol: suitSymbol
    };
}

// ─── Build a deck (for server-side draws) ──────────────────────────
function buildDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({
                suit,
                rank,
                symbol: SUIT_SYMBOLS[suit],
                color: SUIT_COLORS[suit],
                suitName: SUIT_NAMES[suit],
                rankName: RANK_NAMES[rank] || rank,
                isJoker: false
            });
        }
    }
    deck.push({ suit: 'joker', rank: 'Red', symbol: '🃏', color: '#d4af37', isJoker: true, suitName: 'Joker', rankName: 'Red' });
    deck.push({ suit: 'joker', rank: 'Black', symbol: '🃏', color: '#d4af37', isJoker: true, suitName: 'Joker', rankName: 'Black' });
    // Shuffle using Fisher-Yates with crypto randomness
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// ─── Draw one of each suit (for Crown Spread) ──────────────────────
function drawOneOfEachSuit(deck) {
    const suits = ['hearts', 'spades', 'clubs', 'diamonds'];
    const cards = [];
    for (const suit of suits) {
        let index = -1;
        for (let i = 0; i < deck.length; i++) {
            if (deck[i].suit === suit && !deck[i].isJoker) {
                index = i;
                break;
            }
        }
        if (index === -1) {
            // Not enough cards; rebuild deck and retry
            return null;
        }
        cards.push(deck.splice(index, 1)[0]);
    }
    return cards;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Load region data (synchronous, with caching)
 */
function loadRegionData(regionName) {
    return loadRegionDataSync(regionName);
}

/**
 * Draw a number of cards from the deck, with optional region.
 * Returns an object: { cards, synthesis, aceEffect, deckRemaining }
 */
function drawCards(deck, count, regionName) {
    if (!deck || deck.length < count) {
        // Rebuild if insufficient
        const newDeck = buildDeck();
        deck.splice(0, deck.length, ...newDeck);
    }
    const drawn = [];
    for (let i = 0; i < count; i++) {
        if (deck.length === 0) {
            const newDeck = buildDeck();
            deck.splice(0, deck.length, ...newDeck);
        }
        drawn.push(deck.pop());
    }
    const regionData = regionName ? loadRegionData(regionName) : null;
    let synthesis = regionData ? synthesiseConsequence(drawn, regionData) : 'Draw cards without a region.';

    let aceEffect = null;
    const aces = drawn.filter(c => c.rank === 'A' && !c.isJoker);
    if (aces.length > 0 && regionName) {
        aceEffect = getAceEffect(regionName, aces[0]);
        synthesis += `\n\n♠️ **Ace Effect:** ${aceEffect.emoji} ${aceEffect.text}`;
    }

    return { cards: drawn, synthesis, aceEffect, deckRemaining: deck.length };
}

/**
 * Draw a Crown Spread (5 cards: 4 suits + wildcard).
 */
function drawCrownSpread(deck, regionName) {
    if (!deck || deck.length < 5) {
        const newDeck = buildDeck();
        deck.splice(0, deck.length, ...newDeck);
    }
    const mainCards = drawOneOfEachSuit(deck);
    if (!mainCards) {
        // If drawOneOfEachSuit fails, rebuild and retry once
        const newDeck = buildDeck();
        deck.splice(0, deck.length, ...newDeck);
        const retry = drawOneOfEachSuit(deck);
        if (!retry) throw new Error('Failed to draw one of each suit even after rebuild.');
        mainCards = retry;
    }
    if (deck.length === 0) {
        const newDeck = buildDeck();
        deck.splice(0, deck.length, ...newDeck);
    }
    const wildcard = deck.pop();
    const regionData = regionName ? loadRegionData(regionName) : null;
    const result = regionData ? synthesiseCrownSpread(mainCards, wildcard, regionData) : {
        synthesis: 'Crown Spread requires a region.',
        timer: null,
        positions: [],
        wildcard: ''
    };

    let aceEffect = null;
    const aces = mainCards.filter(c => c.rank === 'A' && !c.isJoker);
    if (aces.length > 0 && regionName) {
        aceEffect = getAceEffect(regionName, aces[0]);
        result.synthesis += `\n\n♠️ **Ace Effect:** ${aceEffect.emoji} ${aceEffect.text}`;
    }

    return {
        cards: [...mainCards, wildcard],
        mainCards,
        wildcard,
        result,
        aceEffect,
        deckRemaining: deck.length
    };
}

/**
 * Reset / rebuild the deck.
 */
function resetDeck() {
    return buildDeck();
}

// ─── Exports ─────────────────────────────────────────────────────────
module.exports = {
    loadRegionData,
    drawCards,
    drawCrownSpread,
    buildDeck,
    resetDeck,
    // For internal use / testing
    transformRegionData,
    getCardMeaningFromRegion,
    synthesiseConsequence,
    synthesiseCrownSpread,
    getAceEffect
};