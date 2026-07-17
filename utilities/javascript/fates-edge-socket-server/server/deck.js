/**
 * Fate's Edge - Deck Management
 */

const path = require('path');
const fs = require('fs');

const DECK_SUITS = ['hearts', 'spades', 'clubs', 'diamonds'];
const DECK_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOLS = { hearts: '♥', spades: '♠', clubs: '♣', diamonds: '♦' };
const SUIT_NAMES = { hearts: 'Hearts', spades: 'Spades', clubs: 'Clubs', diamonds: 'Diamonds' };
const RANK_NAMES = {
    'A': 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
    '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten',
    'J': 'Jack', 'Q': 'Queen', 'K': 'King'
};
const SUIT_COLORS = {
    hearts: '#e74c3c',
    spades: '#2c3e50',
    clubs: '#27ae60',
    diamonds: '#3498db',
    joker: '#d4af37'
};

const CROWN_POSITIONS = [
    { key: 'root', label: 'Root', icon: '🌱' },
    { key: 'crest', label: 'Crest', icon: '🏔️' },
    { key: 'crown', label: 'Crown', icon: '👑' },
    { key: 'left', label: 'Left Hand', icon: '🤝' }
];

const regionDataCache = new Map();

function buildDeck() {
    const deck = [];
    for (const suit of DECK_SUITS) {
        for (const rank of DECK_RANKS) {
            deck.push({
                suit,
                rank,
                symbol: SUIT_SYMBOLS[suit],
                suitName: SUIT_NAMES[suit],
                rankName: RANK_NAMES[rank] || rank,
                color: SUIT_COLORS[suit],
                isJoker: false
            });
        }
    }

    deck.push({
        suit: 'joker', rank: 'Red', symbol: '🃏', suitName: 'Joker',
        rankName: 'Red', color: SUIT_COLORS.joker, isJoker: true
    });
    deck.push({
        suit: 'joker', rank: 'Black', symbol: '🃏', suitName: 'Joker',
        rankName: 'Black', color: SUIT_COLORS.joker, isJoker: true
    });

    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function getCardMeaningFromRegion(suit, rank, regionData) {
    if (!regionData || !regionData[suit]) {
        return `A complication of ${suit} arises.`;
    }
    const arr = regionData[suit];
    if (!arr || arr.length === 0) return `A complication of ${suit} arises.`;
    const seed = suit + rank + Math.floor(Math.random() * 1000);
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    const index = Math.abs(hash) % arr.length;
    return arr[index];
}

function getWildcardMeaning(card) {
    const twists = [
        "A sudden storm or environmental shift changes the scene.",
        "An unexpected ally appears with conflicting motives.",
        "A minor curse or blessing from a Patron alters the odds.",
        "A forgotten debt is called in at the worst moment.",
        "The ground beneath you gives way—literal or figurative.",
        "A piece of evidence surfaces that reframes everything.",
        "A rival's plan backfires, creating chaos for everyone.",
        "A moment of clarity reveals a hidden truth.",
    ];
    const seed = (card.suit || 'joker') + (card.rank || '') + Math.floor(Math.random() * 1000);
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    const idx = Math.abs(hash) % twists.length;
    const cardName = card.isJoker ? 'Joker' : `${card.rankName} of ${card.suitName}`;
    return `✨ Twist (${cardName}): ${twists[idx]}`;
}

function synthesiseConsequence(cards, regionData) {
    const entries = cards.map(c => {
        if (c.isJoker) return getWildcardMeaning(c);
        return getCardMeaningFromRegion(c.suit, c.rank, regionData);
    });
    if (entries.length === 1) return entries[0];
    if (entries.length === 2) return `${entries[0]}\n\nThen, ${entries[1]}`;
    return entries.map((e, i) => `${i + 1}. ${e}`).join('\n\n');
}

function synthesiseCrownSpread(mainCards, wildcard, regionData) {
    const positions = CROWN_POSITIONS;
    const positionCards = mainCards.map((card, i) => {
        const pos = positions[i];
        const meaning = card.isJoker ?
            "The unexpected. The impossible. A force that does not follow the rules." :
            getCardMeaningFromRegion(card.suit, card.rank, regionData);
        return {
            ...pos,
            card: card,
            meaning: meaning,
            isJoker: card.isJoker || false,
            rankName: card.isJoker ? 'Joker' : RANK_NAMES[card.rank],
            suitName: card.isJoker ? '' : SUIT_NAMES[card.suit],
            symbol: card.isJoker ? '🃏' : card.symbol,
            color: card.isJoker ? '#d4af37' : (card.color || '#2980b9')
        };
    });

    const wildcardMeaning = getWildcardMeaning(wildcard);

    let synthesis = "The Crown Spread reveals a story of tension and consequence.\n\n";
    synthesis += `🌱 Root: ${positionCards[0].meaning}\n\n`;
    synthesis += `🏔️ Crest: ${positionCards[1].meaning}\n\n`;
    synthesis += `👑 Crown: ${positionCards[2].meaning}\n\n`;
    synthesis += `🤝 Left Hand: ${positionCards[3].meaning}\n\n`;
    synthesis += `🌟 Wildcard: ${wildcardMeaning}`;

    const highestCard = positionCards.reduce((a, b) => {
        const rankOrder = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
        return rankOrder.indexOf(a.card.rank) < rankOrder.indexOf(b.card.rank) ? a : b;
    });

    return {
        synthesis,
        positions: positionCards,
        wildcard: wildcardMeaning,
        timer: {
            segments: 6,
            card: `${highestCard.rankName} of ${highestCard.card.suitName}`
        }
    };
}

async function loadRegionData(regionName) {
    if (regionDataCache.has(regionName)) {
        return regionDataCache.get(regionName);
    }

    try {
        const regionPath = path.join(__dirname, 'data', 'regions', `${regionName.toLowerCase()}.json`);
        if (fs.existsSync(regionPath)) {
            const data = JSON.parse(fs.readFileSync(regionPath, 'utf-8'));
            regionDataCache.set(regionName, data);
            return data;
        }

        const miscPath = path.join(__dirname, 'misc', 'regions', `${regionName.toLowerCase()}.json`);
        if (fs.existsSync(miscPath)) {
            const data = JSON.parse(fs.readFileSync(miscPath, 'utf-8'));
            regionDataCache.set(regionName, data);
            return data;
        }

        const defaultData = {
            name: regionName,
            description: `${regionName} - A region of Fate's Edge.`,
            hearts: ["A matter of loyalty or love arises."],
            spades: ["A conflict or struggle emerges."],
            clubs: ["A physical challenge or obstacle appears."],
            diamonds: ["A resource, treasure, or opportunity is found."]
        };
        regionDataCache.set(regionName, defaultData);
        return defaultData;
    } catch (e) {
        const defaultData = {
            name: regionName,
            description: `${regionName} - A region of Fate's Edge.`,
            hearts: ["A matter of loyalty or love arises."],
            spades: ["A conflict or struggle emerges."],
            clubs: ["A physical challenge or obstacle appears."],
            diamonds: ["A resource, treasure, or opportunity is found."]
        };
        regionDataCache.set(regionName, defaultData);
        return defaultData;
    }
}

module.exports = {
    buildDeck,
    loadRegionData,
    synthesiseConsequence,
    synthesiseCrownSpread,
    getCardMeaningFromRegion,
    getWildcardMeaning,
};
