// features/decks/index.js
/**
 * Decks feature - Deck of Consequences and Crown Spread
 * Supports single draw, multiple draw, and Crown Spread (4+1 wildcard).
 * Loads region data dynamically from /regions/.
 * Supports WebSocket sync for multiplayer draws.
 */

import { shuffleArray } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { getState, addTimer } from '../../core/state.js';

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
// STATE
// ============================================================

let container = null;
let deck = [];
let deckHistory = [];
let regionData = null;
let regionNames = [];
let selectedRegion = null;
let cardOffset = Math.floor(Math.random() * 1000);
let isInitialized = false;
let isSyncing = false;

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
    // Broadcast via WebSocket if available
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
        regionNames = [];
        showToast('Could not load region list. Check /regions/manifest.json', 'error');
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
        showToast(`Could not load region "${regionName}".`, 'error');
        return null;
    }
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

    container.innerHTML = `
        <div class="decks-header">
            <h1 class="page-title">🃏 Deck of Consequences</h1>
            <p class="page-sub">Transform Story Beats (SB) into thematic complications. Choose a region and draw type.</p>
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

    document.getElementById('deck-region-select').addEventListener('change', onRegionChange);
    if (regionNames.length > 0) {
        document.getElementById('deck-region-select').value = regionNames[0];
        await onRegionChange();
        selectedRegion = regionNames[0];
    }
    
    isInitialized = true;
}

// ============================================================
// REGION CHANGE
// ============================================================

async function onRegionChange() {
    const select = document.getElementById('deck-region-select');
    const regionName = select.value;
    const descEl = document.getElementById('region-description');

    if (!regionName) {
        descEl.textContent = 'Select a region to display its description.';
        return;
    }

    const data = await fetchRegionData(regionName);
    if (data && data.description) {
        descEl.innerHTML = data.description;
    } else if (data) {
        descEl.innerHTML = '<p class="region-text">No description available for this region.</p>';
    } else {
        descEl.textContent = 'Could not load region description.';
    }
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
    shuffleArray(deck);
    updateDeckCount();
    console.log('🔀 Deck shuffled, total cards:', deck.length);
}

function updateDeckCount() {
    const el = document.getElementById('deck-cards-remaining');
    if (el) el.textContent = deck.length + ' cards';
}

function updateSpreadDescription() {
    const type = document.getElementById('deck-draw-type').value;
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

// In decks/index.js, add this function at the top level:

let lastDrawResults = null;

// Then modify drawConsequence to store results:

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
    } else {
        const cardsEl = document.getElementById('crown-spread-cards');
        if (cardsEl) cardsEl.style.display = 'none';
        synthesis = synthesiseConsequence(cards, data);
    }

    const synthesisEl = document.getElementById('consequence-synthesis');
    if (synthesisEl) {
        synthesisEl.innerHTML = `<strong>Consequence:</strong>\n${synthesis}`;
    }
    
    const detailsEl = document.getElementById('crown-spread-details');
    if (details) {
        detailsEl.style.display = 'block';
        detailsEl.innerHTML = details;
        document.getElementById('consequence-title').textContent = '👑 Crown Spread';
    } else {
        detailsEl.style.display = 'none';
        document.getElementById('consequence-title').textContent = type === 'crown' ? '👑 Crown Spread' : `🃏 ${type} Draw${type > 1 ? 's' : ''}`;
    }

    const timerEl = document.getElementById('timer-result');
    if (timer) {
        timerEl.style.display = 'block';
        timerEl.innerHTML = `
            <strong>⏱️ Suggested Timer:</strong> ${timer.segments} segments (from highest card: ${timer.card})
            <button class="btn btn-sm btn-primary" id="create-timer-btn" style="margin-left:0.5rem;">➕ Add Timer</button>
        `;
        const btn = timerEl.querySelector('#create-timer-btn');
        btn.addEventListener('click', () => {
            createTimerFromCard(timer.card, timer.segments);
        });
    } else {
        timerEl.style.display = 'none';
    }

    // Store results for later display
    lastDrawResults = {
        cards: cards,
        synthesis: synthesis,
        isCrown: isCrown,
        details: details,
        timer: timer,
        type: type
    };

    // Add to history
    const cardStr = cards.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | ');
    deckHistory.push({
        time: new Date().toLocaleTimeString(),
        cards: cardStr,
        synthesis: synthesis.replace(/\n/g, ' '),
        type: type === 'crown' ? 'Crown Spread' : `${type} Draw${type > 1 ? 's' : ''}`
    });
    renderDeckHistory();
    
    // Broadcast via WebSocket
    broadcastDraw(cards, type, selectedRegion, synthesis);
    
    // Enhanced toast with card names
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
        let positionLabel = '';

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
        </div>`
    ).join('');
}

function clearDeckHistory() {
    deckHistory = [];
    renderDeckHistory();
    showToast('Deck history cleared.', 'success');
}

// ============================================================
// RESET
// ============================================================

export function resetDeck() {
    cardOffset = Math.floor(Math.random() * 1000);
    buildDeck();
    document.getElementById('drawn-cards').innerHTML = '';
    document.getElementById('crown-spread-cards').innerHTML = '';
    document.getElementById('crown-spread-cards').style.display = 'none';
    document.getElementById('consequence-synthesis').innerHTML = 'Deck reshuffled. Draw to begin.';
    document.getElementById('crown-spread-details').style.display = 'none';
    document.getElementById('timer-result').style.display = 'none';
    document.getElementById('consequence-title').textContent = 'Cards Drawn';
    
    // Broadcast via WebSocket
    broadcastReset();
    
    showToast('Deck reshuffled with new random seeds.', 'success');
}

// ============================================================
// LIFECYCLE METHODS
// ============================================================

export async function onActivate() {
    console.log('[Decks] Activated');
    const select = document.getElementById('deck-region-select');
    if (select && select.value) {
        await onRegionChange();
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
        await onRegionChange();
    }
}

export function destroy() {
    container = null;
    deck = [];
    deckHistory = [];
    regionData = null;
    selectedRegion = null;
    isInitialized = false;
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
    // If modal already exists, remove it first
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
    
    // Draw 5 cards for Crown Spread
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
    
    // Get region data
    const regionName = selectedRegion || 'Acasia';
    fetchRegionData(regionName).then(data => {
        const result = synthesiseCrownSpread(mainCards, wildcard, data);
        
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
        
        // Broadcast via WebSocket
        broadcastDraw(cards, 'crown', regionName, result.synthesis);
        
        // Click on backdrop to close
        crownSpreadModal.addEventListener('click', (e) => {
            if (e.target === crownSpreadModal) {
                window.closeCrownSpread();
            }
        });
        
        // Escape key to close
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape' && crownSpreadModal && crownSpreadModal.parentNode) {
                window.closeCrownSpread();
                document.removeEventListener('keydown', escHandler);
            }
        });
    });
}

// Close Crown Spread modal
window.closeCrownSpread = function() {
    if (crownSpreadModal && crownSpreadModal.parentNode) {
        crownSpreadModal.remove();
        crownSpreadModal = null;
    }
    // Refresh the decks view to show updated deck count
    const container = document.getElementById('scene-view-container');
    if (container) {
        const activeTab = document.querySelector('.scene-tab.active');
        if (activeTab && activeTab.dataset.view === 'consequences') {
            // Re-render consequences view
            import('../decks/index.js').then(module => {
                if (module.render) {
                    module.render(container);
                }
            });
        }
    }
    // Update deck count display
    updateDeckCount();
};

// Expose to window
window.openCrownSpread = openCrownSpread;
window.closeCrownSpread = window.closeCrownSpread;
window.createTimerFromCard = createTimerFromCard;
window.drawConsequence = drawConsequence;
window.resetDeck = resetDeck;

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
    closeCrownSpread: window.closeCrownSpread
};