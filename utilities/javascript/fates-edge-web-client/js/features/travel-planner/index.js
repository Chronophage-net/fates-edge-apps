// features/travel-planner/index.js
/**
 * Travel Planner - Card-based journey generator
 * Uses the Cartomancy system from the Worldbook to generate travel legs
 * between regions with full narrative context
 */

import { escHtml } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { getState, saveState } from '../../core/state.js';

// ============================================================
// CONSTANTS - Region Data from Worldbook
// ============================================================

const REGIONS = {
    kahfagia: {
        name: 'Kahfagia',
        icon: '⚓',
        color: '#2980b9',
        subgenre: 'Creole Thalassocracy',
        mood: 'Signal-and-lane politics, eldritch tide, secret infiltration',
        suits: {
            spades: 'Littoral/Lane/Law - Tidal mudflats, salt-scar piers, mirror towers',
            hearts: 'People & Factions - Tide-runners, pilot apprentices, mirror-keepers',
            clubs: 'Complications - Early tides, smothering fog, light shifts, reef-runners',
            diamonds: 'Leverage - Mooring chits, pilotage tokens, safe-conducts, lantern codes'
        }
    },
    ecktoria: {
        name: 'Ecktoria',
        icon: '🏛️',
        color: '#c0392b',
        subgenre: 'Imperial Decay, Bureaucratic Horror',
        mood: 'Marble grandeur, ash-tipped ambition, the slow rot of imperial forms',
        suits: {
            spades: 'Places - Petition steps, tally-ford ferryhouses, Everflame cloisters',
            hearts: 'People - Torchbearer children, decumanus-masters, Censer-Knights',
            clubs: 'Complications - Blocked bridges, border disputes, bread riots',
            diamonds: 'Leverage - Procession permits, golden edicts, Vigil seals'
        }
    },
    acasia: {
        name: 'Acasia',
        icon: '🌲',
        color: '#27ae60',
        subgenre: 'Low-fantasy Wasteland, Mercenary Realism',
        mood: 'Famine, ambition, and the ghost of empire',
        suits: {
            spades: 'Places - Broken milestones, vine-terrace hillsides, toll-bridge towns',
            hearts: 'People - Tithe-collectors, roadside priors, hedge-witches, free company captains',
            clubs: 'Complications - Peat-fog, sudden levies, bridge feuds, grain blights',
            diamonds: 'Leverage - Toll-exemption plaques, monastery letters, wine-rights'
        }
    },
    vhasia: {
        name: 'Vhasia',
        icon: '☀️',
        color: '#f39c12',
        subgenre: 'Courtly Intrigue, Fractured Legitimacy',
        mood: 'Broken coronations, split loyalties, the tragedy of chivalry',
        suits: {
            spades: 'Places - Wayside shrines, vine-terraces, bastide squares, royal forests',
            hearts: 'People - Road wardens, vintner syndics, abbess-chatelaines, routier captains',
            clubs: 'Complications - Chevauchée raids, interdicts, forest law, river spates',
            diamonds: 'Leverage - Safe-conducts, burgess charters, bridge farms, pareage charters'
        }
    },
    viterra: {
        name: 'Viterra',
        icon: '🌿',
        color: '#2ecc71',
        subgenre: 'Legal Warfare, Border Adventurism',
        mood: 'Post-imperial consolidation, legal precision, fragile crown',
        suits: {
            spades: 'Places - Fen causeways, hedgerow greens, beacon hills, Belworth stairs',
            hearts: 'People - Fen reeves, river syndics, parish surveyors, Dawn quartermasters',
            clubs: 'Complications - Dike breaches, feast clashes, quiet tolls, audit freezes',
            diamonds: 'Leverage - Ferry priority, dike allotments, market licenses, dawn escorts'
        }
    },
    thepyrgos: {
        name: 'Thepyrgos',
        icon: '🔔',
        color: '#8e44ad',
        subgenre: 'Scholarly Vertical City, Academic Mystery',
        mood: 'Stairs, bells, and the argument of patrons',
        suits: {
            spades: 'Places - Pilgrim stairs, tower quarters, chain-barbicans, blue cisterns',
            hearts: 'People - Bell-runners, rope masters, icon-smiths, wall strategoi',
            clubs: 'Complications - Tremors, iconoclast riots, chain jams, black northerlies',
            diamonds: 'Leverage - Stair tokens, harbor passes, cistern draw-rights, crane allotments'
        }
    },
    aeler: {
        name: 'Aeler',
        icon: '⛰️',
        color: '#7f8c8d',
        subgenre: 'Survival Horror Underground',
        mood: 'Infrastructure as soft power, collectivist mercantilism, the weight of every breath',
        suits: {
            spades: 'Places - Vaultmouth gates, crown-crypt porches, under-markets, smoke-shaft stairs',
            hearts: 'People - Lamplighter apprentices, under-masons, vault wardens, censer-knights',
            clubs: 'Complications - Bad air pockets, drip-floods, gas flares, seal misreads',
            diamonds: 'Leverage - Lamp-priority tallies, breath-measure allotments, key-writs, underway passes'
        }
    },
    mistlands: {
        name: 'Mistlands',
        icon: '🌫️',
        color: '#95a5a6',
        subgenre: 'Folk Horror, Gothic Dread',
        mood: 'Bells, salt, and the breath of the Direwood',
        suits: {
            spades: 'Places - Reed-fen causeways, bell-line levees, ghost-ferry slips, pall watch-towers',
            hearts: 'People - Reed-cutters, salt-monks, bell-wardens, oath-ferrymen',
            clubs: 'Complications - Ground-mist, witchlight counts, ward-salt shortages, wrong bells',
            diamonds: 'Leverage - Ward-salt, ferry tokens, bell-keys, lantern writs'
        }
    },
    ykrul: {
        name: 'Ykrul',
        icon: '🐺',
        color: '#d35400',
        subgenre: 'Nomadic Epic, Pragmatic Cunning',
        mood: 'The pragmatism of the steppe, wind-scoured honor',
        suits: {
            spades: 'Places - Wolf mileposts, remount stations, birch windbreaks, salt pans',
            hearts: 'People - Herd-scouts, camp-mothers, banner youths, salt-brokers',
            clubs: 'Complications - White squalls, rasputitsa, remount sickness, salt shortages',
            diamonds: 'Leverage - Camp tokens, salt allotments, ford-rights, remount chits'
        }
    },
    vilikari: {
        name: 'Vilikari',
        icon: '🌾',
        color: '#f1c40f',
        subgenre: 'Legal Dualism, Hybrid Identity',
        mood: 'Early Holy Roman Empire on the steppe - forgotten treaties',
        suits: {
            spades: 'Places - Longhouse quarters, mileforts, stone fords, villa granaries',
            hearts: 'People - Hearth-mothers, shield-brothers, march notaries, horse-reeves',
            clubs: 'Complications - Annona late, law tangles, raid rumors, bridge levies',
            diamonds: 'Leverage - Foedus seals, mallus rights, stipend arrears, Utaran patents'
        }
    },
    linns: {
        name: 'Linns',
        icon: '⛵',
        color: '#16a085',
        subgenre: 'Norse Coastal Saga, Oath-driven Honor',
        mood: 'Skerries, storm-oaths, and the tyranny of seasons',
        suits: {
            spades: 'Places - Kelp-skerry guts, tide-sheds, wave-gate reefs, runestone causeys',
            hearts: 'People - Net-wives, steersmen, shipwrights, oar-masters',
            clubs: 'Complications - Black squalls, fogfall, boom lifts, levy clashes',
            diamonds: 'Leverage - Harbor-marks, oar-shares, pilot tokens, wharf-rights'
        }
    },
    ubral: {
        name: 'Ubral',
        icon: '🪨',
        color: '#5d4e37',
        subgenre: 'Highland Clan, Reiver Honor',
        mood: 'Stone between spears - misty glens, wergild, and blood feuds',
        suits: {
            spades: 'Places - Sheepwalk ledges, warden cairns, wergild fords, droppers bridges',
            hearts: 'People - Hearth-aunts, hill guides, feud-brokers, reiver bands',
            clubs: 'Complications - Upland mist, feuds rekindled, bridge drops, black-rent demands',
            diamonds: 'Leverage - Guest-tokens, guide braids, ford remissions, feud-charters'
        }
    },
    fhara: {
        name: 'Fhara',
        icon: '🏜️',
        color: '#e67e22',
        subgenre: 'Desert Law, Coffee Ritual',
        mood: 'Water as community, the weight of the oasis',
        suits: {
            spades: 'Places - Well-courts, coffee bazaars, date groves, dry riverbeds',
            hearts: 'People - Well-judges, coffee-house poets, caravan masters, water-clerks',
            clubs: 'Complications - Dry wells, coffee rituals interrupted, water disputes, date blights',
            diamonds: 'Leverage - Water-share tablets, caravan court writs, well-judge dippers'
        }
    },
    ashaan: {
        name: 'Ashaan',
        icon: '🎭',
        color: '#2c3e50',
        subgenre: 'Grimdark Spirit-horror, Bureaucratic Terror',
        mood: 'The Veiled Throne - spirit-binding, whispered resistance',
        suits: {
            spades: 'Places - Salt pans with broken spirit-cages, black marble temples, brass gates',
            hearts: 'People - Terrified bakers, ledger clerks, Black Hand recruits, mothers at wells',
            clubs: 'Complications - Spirit-dust storms, brass gates closed, bound spirits break free',
            diamonds: 'Leverage - Slave true names, spirit-lamps, brass seals, veil-clips'
        }
    },
    sekogo: {
        name: 'Sekogo',
        icon: '🌴',
        color: '#27ae60',
        subgenre: 'Jungle Folk Horror, Spirit Diplomacy',
        mood: 'The Green Council - honey, masks, and the Ukwe',
        suits: {
            spades: 'Places - Honey-orchards, druid circles, Lethai-ar silk bridges, the Ukwe',
            hearts: 'People - Honey-gatherers, Green Council druids, Waker radicals, Lethai-ar silk-wardens',
            clubs: 'Complications - Thorn-spirit blocks, Ukwe demands a name, Lethai-ar web-law challenges',
            diamonds: 'Leverage - Leopard favors, Ukwe memories, nkisi shards, honey-jars'
        }
    },
    oshiira: {
        name: 'Oshiira',
        icon: '🌾',
        color: '#d4ac0d',
        subgenre: 'Grain Logistics, Community Weight',
        mood: 'The Ledger Empire - canals, weigh-houses, and the Granary Tower',
        suits: {
            spades: 'Places - Mudflat weigh-stations, granary towers, canal junctions, widow weigh-houses',
            hearts: 'People - Grain inspectors, canal mothers, Vermilion Corps wardens, narrow captains',
            clubs: 'Complications - Desert dust, locust swarms, cold war provocations, inspections in progress',
            diamonds: 'Leverage - Grain receipts, barge priority tokens, weigh-house seals, treaty seals'
        }
    },
    pereshi: {
        name: 'Pereshi',
        icon: '🔥',
        color: '#e74c3c',
        subgenre: 'Fire Temple Nation, Name Erasure',
        mood: 'The Roof of the Way - ash, verse, and the ninth coal',
        suits: {
            spades: 'Places - Fire-shrines, Mount Khvarena, Archive of Severed Names, Adur-Gah',
            hearts: 'People - Flame-keepers, archivists, caravan masters, poets of the ninth verse',
            clubs: 'Complications - A name demanded, the ninth coal cracks, lowland envoys refused',
            diamonds: 'Leverage - Fire-shrine tokens, roses from the ruined garden, tablets of severed names'
        }
    },
    tulkani: {
        name: 'Tulkani',
        icon: '🧵',
        color: '#8e44ad',
        subgenre: 'Itinerant Community, Story-driven Kinship',
        mood: 'The Itinerant Courts - knots, stories, and the Dreamer',
        suits: {
            spades: 'Places - Wagon circles, caravan courts, dream-wagons, cord-maker stalls',
            hearts: 'People - Caravan judges, wagon-keepers, story-sellers, Ikasha\'s knife',
            clubs: 'Complications - Recognition, lord\'s claims, the Hollow walks, memory-cords tangled',
            diamonds: 'Leverage - Memory-beads, safe-haven oaths, dream-cords, caravan judge cords'
        }
    },
    sidhi: {
        name: 'Sidhi',
        icon: '🕯️',
        color: '#1abc9c',
        subgenre: 'Levantine Coastal Grief, Covenant Justice',
        mood: 'Galanina - green flames, unnumbered children, and the sealed coast',
        suits: {
            spades: 'Places - Great Lighthouse, Unnumbered Shore, Covenant Citadel, Lamp-Maker Quarter',
            hearts: 'People - High Keepers, lamp-makers, Covenant judges, Hollow Children',
            clubs: 'Complications - Lamp gutters, Covenant judgments, Ashaani bells, the Unnumbered Shore weeps',
            diamonds: 'Leverage - Green lamps, lamp-maker names, Sealed Archive keys, Covenant writs'
        }
    },
    zakov: {
        name: 'Zakov',
        icon: '🏴‍☠️',
        color: '#2c3e50',
        subgenre: 'Pirate Noir, Eldritch Tide-horror',
        mood: 'Salt, serpent, and the crystalline deep',
        suits: {
            spades: 'Places - Salt wharfs, bone-yard beaches, smuggler gates, the Shallows',
            hearts: 'People - Dock-rats, fences, tavern-keepers, corsair lieutenants',
            clubs: 'Complications - Tide shifts, warehouse fires, cursed cargo, storm warnings',
            diamonds: 'Leverage - Smuggler tokens, forged manifests, safe berths, corsair charters'
        }
    },
    aelaerem: {
        name: 'Aelaerem',
        icon: '🏡',
        color: '#27ae60',
        subgenre: 'Pastoral Folk Horror, Hearth Magic',
        mood: 'Hearth & Hollow - warm hearths, cold thresholds',
        suits: {
            spades: 'Places - Willow fords, cider-press barns, chalk sheep-downs, millponds',
            hearts: 'People - Hedge-witch midwives, millers, orchard reeves, beekeepers',
            clubs: 'Complications - Unseasonal fog, scarecrow turns, soured wassail, black sows in orchards',
            diamonds: 'Leverage - Guest-loaves, cider-marks, hedge-pass ribbons, bee-queen shares'
        }
    },
    valewood: {
        name: 'Valewood',
        icon: '🌳',
        color: '#2d5016',
        subgenre: 'Dark Forest, Fey Remnant, Imperial Echo',
        mood: 'Leaves, oaths, and echoes - the empire under leaves',
        suits: {
            spades: 'Places - Star-road shards, rooted amphitheaters, moon-cisterns, glyphed bridges',
            hearts: 'People - Pathweavers, fox-couriers, owl-sisters, antler-hunters',
            clubs: 'Complications - Sweet winds, path reversals, ward-traps, oath-magnets',
            diamonds: 'Leverage - Way-cords, dew-mirrors, hazel tokens, honey-rights'
        }
    }
};

// ============================================================
// STATE
// ============================================================

let container = null;
let selectedRegionA = null;
let selectedRegionB = null;
let currentDraw = null;
let travelLegs = [];
let isGenerating = false;
let travelModal = null;

// ============================================================
// HELPERS
// ============================================================

function getRegionSlug(name) {
    return name.toLowerCase().replace(/ /g, '_');
}

function getSuitSymbol(suit) {
    const symbols = {
        spades: '♠',
        hearts: '♡',
        clubs: '♣',
        diamonds: '♢'
    };
    return symbols[suit] || '♦';
}

function getSuitName(suit) {
    const names = {
        spades: 'Spades',
        hearts: 'Hearts',
        clubs: 'Clubs',
        diamonds: 'Diamonds'
    };
    return names[suit] || suit;
}

function getSuitColor(suit) {
    const colors = {
        spades: '#2c3e50',
        hearts: '#c0392b',
        clubs: '#27ae60',
        diamonds: '#2980b9'
    };
    return colors[suit] || '#7f8c8d';
}

function getSuitEmoji(suit) {
    const emojis = {
        spades: '🏔️',
        hearts: '👤',
        clubs: '⚡',
        diamonds: '💎'
    };
    return emojis[suit] || '♦';
}

function getRankName(rank) {
    const names = {
        'A': 'Ace',
        '2': 'Two',
        '3': 'Three',
        '4': 'Four',
        '5': 'Five',
        '6': 'Six',
        '7': 'Seven',
        '8': 'Eight',
        '9': 'Nine',
        '10': 'Ten',
        'J': 'Jack',
        'Q': 'Queen',
        'K': 'King'
    };
    return names[rank] || rank;
}

function getTimerSegments(rank) {
    const rankMap = {
        '2': 4, '3': 4, '4': 4, '5': 4,
        '6': 6, '7': 6, '8': 6, '9': 6, '10': 6,
        'J': 8, 'Q': 8, 'K': 8,
        'A': 10
    };
    return rankMap[rank] || 6;
}

function getTimerLabel(segments) {
    if (segments <= 4) return 'Short';
    if (segments <= 6) return 'Standard';
    if (segments <= 8) return 'Extended';
    return 'Epic';
}

// ============================================================
// CARD GENERATION
// ============================================================

function generateCard(suit, rank, regionData) {
    // Use seeded random for deterministic generation
    const seed = regionData.name + suit + rank;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    const index = Math.abs(hash) % 12;
    
    // Get meaning from region data
    const suitKey = suit;
    const entries = regionData.suits[suitKey];
    let meaning = '';
    if (typeof entries === 'string') {
        // If it's a string description, split into array
        const parts = entries.split(/[-–—]/).filter(p => p.trim());
        meaning = parts[index % parts.length] || entries;
    } else if (Array.isArray(entries)) {
        meaning = entries[index % entries.length] || entries[0];
    } else {
        meaning = `A ${suit} complication arises.`;
    }
    
    return {
        suit,
        rank,
        symbol: getSuitSymbol(suit),
        suitName: getSuitName(suit),
        rankName: getRankName(rank),
        color: getSuitColor(suit),
        emoji: getSuitEmoji(suit),
        meaning: meaning,
        isFace: ['J', 'Q', 'K'].includes(rank),
        isAce: rank === 'A',
        timerSegments: getTimerSegments(rank),
        timerLabel: getTimerLabel(getTimerSegments(rank))
    };
}

function generateDeck() {
    const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ============================================================
// TRAVEL GENERATION
// ============================================================

export function generateTravelPlan(regionA, regionB) {
    const regionDataA = REGIONS[regionA];
    const regionDataB = REGIONS[regionB];
    
    if (!regionDataA || !regionDataB) {
        showToast('Please select two valid regions.', 'error');
        return null;
    }
    
    // Generate a deck and draw cards
    const deck = generateDeck();
    shuffleArray(deck);
    
    // Draw one card for each suit
    const drawnCards = [];
    const usedSuits = new Set();
    for (const card of deck) {
        if (!usedSuits.has(card.suit)) {
            usedSuits.add(card.suit);
            const regionData = Math.random() > 0.5 ? regionDataA : regionDataB;
            drawnCards.push(generateCard(card.suit, card.rank, regionData));
        }
        if (usedSuits.size === 4) break;
    }
    
    // If we didn't get all suits, fill with random
    const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
    for (const suit of suits) {
        if (!usedSuits.has(suit)) {
            const rank = ['6', '7', '8', '9', '10'][Math.floor(Math.random() * 5)];
            const regionData = Math.random() > 0.5 ? regionDataA : regionDataB;
            drawnCards.push(generateCard(suit, rank, regionData));
        }
    }
    
    // Sort by suit order
    const suitOrder = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
    drawnCards.sort((a, b) => suitOrder[a.suit] - suitOrder[b.suit]);
    
    // Determine highest rank for timer
    const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    let highestRank = drawnCards.reduce((max, card) => {
        const val = rankValues[card.rank] || 0;
        return val > max ? val : max;
    }, 0);
    const highestCard = drawnCards.find(c => rankValues[c.rank] === highestRank);
    const timerSegments = highestCard ? highestCard.timerSegments : 6;
    const timerLabel = highestCard ? highestCard.timerLabel : 'Standard';
    
    // Build the result
    const result = {
        regionA: regionDataA,
        regionB: regionDataB,
        cards: drawnCards,
        timer: {
            segments: timerSegments,
            label: timerLabel,
            source: highestCard ? `${highestCard.rankName} of ${highestCard.suitName}` : 'Standard'
        },
        synthesis: generateSynthesis(drawnCards, regionDataA, regionDataB),
        timestamp: new Date().toISOString()
    };
    
    currentDraw = result;
    return result;
}

function generateSynthesis(cards, regionA, regionB) {
    const spade = cards.find(c => c.suit === 'spades');
    const heart = cards.find(c => c.suit === 'hearts');
    const club = cards.find(c => c.suit === 'clubs');
    const diamond = cards.find(c => c.suit === 'diamonds');
    
    let synthesis = `The journey from ${regionA.name} to ${regionB.name} begins.\n\n`;
    
    if (spade) {
        synthesis += `♠ The Stage: ${spade.meaning}\n`;
    }
    if (heart) {
        synthesis += `♡ The Actor: ${heart.meaning}\n`;
    }
    if (club) {
        synthesis += `♣ The Pressure: ${club.meaning}\n`;
    }
    if (diamond) {
        synthesis += `♢ The Leverage: ${diamond.meaning}\n`;
    }
    
    synthesis += `\n⏱️ Timer: ${getTimerLabel(getTimerSegments(cards[0]?.rank || '6'))} (${getTimerSegments(cards[0]?.rank || '6')} segments)`;
    
    return synthesis;
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    
    const regionOptions = Object.entries(REGIONS).map(([key, data]) => 
        `<option value="${key}">${data.icon} ${data.name}</option>`
    ).join('');
    
    container.innerHTML = `
        <div class="travel-planner">
            <div class="travel-planner-header">
                <h1 class="page-title">🗺️ Travel Planner</h1>
                <p class="page-sub">Generate a travel leg between two regions using the Cartomancy system.</p>
            </div>
            
            <div class="panel">
                <div class="form-row">
                    <div class="field">
                        <label>From</label>
                        <select id="travel-region-a">
                            <option value="">— Select Region —</option>
                            ${regionOptions}
                        </select>
                    </div>
                    <div class="field">
                        <label>To</label>
                        <select id="travel-region-b">
                            <option value="">— Select Region —</option>
                            ${regionOptions}
                        </select>
                    </div>
                    <div class="field" style="flex:0 0 auto;display:flex;align-items:end;">
                        <button class="btn btn-gold" id="travel-generate-btn">🃏 Generate Journey</button>
                    </div>
                </div>
            </div>
            
            <div id="travel-result" style="display:none;"></div>
            
            <div class="panel" id="travel-history-panel">
                <h3>📜 Journey History</h3>
                <div id="travel-history" style="max-height:300px;overflow-y:auto;margin-top:0.5rem;">
                    <span class="text-muted">No journeys planned yet.</span>
                </div>
            </div>
        </div>
    `;
    
    attachEvents();
    renderHistory();
    
    return container;
}

// ============================================================
// EVENTS
// ============================================================

function attachEvents() {
    const generateBtn = document.getElementById('travel-generate-btn');
    if (generateBtn) {
        const newBtn = generateBtn.cloneNode(true);
        generateBtn.parentNode.replaceChild(newBtn, generateBtn);
        newBtn.addEventListener('click', handleGenerate);
    }
    
    // Enter key support on selects
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && container && container.contains(e.target)) {
            const btn = document.getElementById('travel-generate-btn');
            if (btn) btn.click();
        }
    });
}

function handleGenerate() {
    const regionA = document.getElementById('travel-region-a')?.value;
    const regionB = document.getElementById('travel-region-b')?.value;
    
    if (!regionA || !regionB) {
        showToast('Please select both regions.', 'error');
        return;
    }
    
    if (regionA === regionB) {
        showToast('Please select two different regions.', 'error');
        return;
    }
    
    const result = generateTravelPlan(regionA, regionB);
    if (result) {
        displayResult(result);
        addToHistory(result);
        showToast(`🃏 Journey planned from ${result.regionA.name} to ${result.regionB.name}`, 'success');
    }
}

// ============================================================
// DISPLAY RESULT
// ============================================================

function displayResult(result) {
    const resultEl = document.getElementById('travel-result');
    if (!resultEl) return;
    
    const cardsHtml = result.cards.map(card => `
        <div class="travel-card" style="
            background: var(--bg3);
            border: 2px solid ${card.color};
            border-radius: var(--radius);
            padding: 0.8rem;
            text-align: center;
            min-width: 140px;
            flex: 0 0 auto;
            transition: transform 0.2s;
            cursor: default;
            ${card.isAce ? 'box-shadow: 0 0 20px rgba(212,175,55,0.3);' : ''}
            ${card.isFace ? 'border-width: 3px;' : ''}
        ">
            <div style="font-size:0.7rem;color:var(--text3);margin-bottom:0.2rem;">
                ${card.emoji} ${card.suitName}
            </div>
            <div style="font-size:2rem;color:${card.color};font-weight:bold;">
                ${card.symbol}${card.rank}
            </div>
            <div style="font-size:0.75rem;color:var(--text2);font-weight:600;">
                ${card.rankName}
                ${card.isAce ? ' 🃏' : ''}
                ${card.isFace ? ' 👑' : ''}
            </div>
            <div style="font-size:0.65rem;color:var(--text3);margin-top:0.3rem;border-top:1px solid var(--border);padding-top:0.3rem;">
                ${escHtml(card.meaning.substring(0, 40))}${card.meaning.length > 40 ? '...' : ''}
            </div>
        </div>
    `).join('');
    
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
        <div class="panel" style="margin-top:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;">
                <h3 style="margin:0;">
                    🃏 ${result.regionA.icon} ${result.regionA.name} → ${result.regionB.icon} ${result.regionB.name}
                </h3>
                <div style="display:flex;gap:0.5rem;align-items:center;">
                    <span style="font-size:0.8rem;color:var(--text3);">
                        ⏱️ ${result.timer.label} (${result.timer.segments} segments)
                    </span>
                    <button class="btn btn-sm btn-ghost" id="travel-open-modal">🔍 Full View</button>
                </div>
            </div>
            
            <div style="display:flex;gap:0.8rem;overflow-x:auto;padding:0.5rem 0.2rem;flex-wrap:nowrap;">
                ${cardsHtml}
            </div>
            
            <div style="margin-top:0.8rem;background:var(--bg2);border-radius:var(--radius);padding:0.8rem 1rem;border-left:4px solid var(--gold);">
                <div style="font-size:0.9rem;white-space:pre-wrap;color:var(--text2);">
                    ${escHtml(result.synthesis)}
                </div>
            </div>
            
            <div style="margin-top:0.5rem;display:flex;gap:0.4rem;flex-wrap:wrap;">
                <button class="btn btn-sm" id="travel-save-journey">💾 Save to History</button>
                <button class="btn btn-sm btn-ghost" id="travel-export-journey">📤 Export</button>
            </div>
        </div>
    `;
    
    // Attach events for the result
    const modalBtn = resultEl.querySelector('#travel-open-modal');
    if (modalBtn) {
        modalBtn.addEventListener('click', () => openTravelModal(result));
    }
    
    const saveBtn = resultEl.querySelector('#travel-save-journey');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            addToHistory(result);
            showToast('💾 Journey saved to history', 'success');
        });
    }
    
    const exportBtn = resultEl.querySelector('#travel-export-journey');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => exportJourney(result));
    }
}

// ============================================================
// TRAVEL MODAL
// ============================================================

function openTravelModal(result) {
    if (travelModal && travelModal.parentNode) {
        travelModal.remove();
        travelModal = null;
    }
    
    travelModal = document.createElement('div');
    travelModal.className = 'travel-modal';
    travelModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
        backdrop-filter: blur(12px);
        animation: fadeIn 0.3s ease;
    `;
    
    const cardsHtml = result.cards.map(card => `
        <div style="
            background: var(--bg3);
            border: 2px solid ${card.color};
            border-radius: var(--radius);
            padding: 1rem;
            text-align: center;
            min-width: 160px;
            flex: 0 0 auto;
            ${card.isAce ? 'box-shadow: 0 0 30px rgba(212,175,55,0.3);' : ''}
            ${card.isFace ? 'border-width: 3px;' : ''}
        ">
            <div style="font-size:0.8rem;color:var(--text3);margin-bottom:0.3rem;">
                ${card.emoji} ${card.suitName}
            </div>
            <div style="font-size:3rem;color:${card.color};font-weight:bold;">
                ${card.symbol}${card.rank}
            </div>
            <div style="font-size:1rem;color:var(--text2);font-weight:600;">
                ${card.rankName}
                ${card.isAce ? ' 🃏' : ''}
                ${card.isFace ? ' 👑' : ''}
            </div>
            <div style="font-size:0.8rem;color:var(--text3);margin-top:0.5rem;border-top:1px solid var(--border);padding-top:0.5rem;">
                ${escHtml(card.meaning)}
            </div>
            <div style="font-size:0.7rem;color:var(--text3);margin-top:0.3rem;">
                ⏱️ ${card.timerLabel} (${card.timerSegments} segments)
            </div>
        </div>
    `).join('');
    
    travelModal.innerHTML = `
        <div style="
            background: var(--bg2);
            padding: 2rem;
            border-radius: 16px;
            max-width: 900px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            border: 1px solid var(--border);
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                <h2 style="color:var(--gold);margin:0;">
                    🃏 ${result.regionA.icon} ${result.regionA.name} → ${result.regionB.icon} ${result.regionB.name}
                </h2>
                <button onclick="window.closeTravelModal()" 
                        style="background:var(--bg3);border:1px solid var(--border);color:var(--text2);font-size:1.5rem;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;">
                    ✕
                </button>
            </div>
            
            <div style="display:flex;gap:0.8rem;overflow-x:auto;padding:0.5rem 0.2rem;flex-wrap:nowrap;margin-bottom:1rem;">
                ${cardsHtml}
            </div>
            
            <div style="background:var(--bg3);border-radius:var(--radius);padding:1rem;border-left:4px solid var(--gold);margin-bottom:1rem;">
                <div style="font-weight:600;color:var(--gold);margin-bottom:0.3rem;">📖 Journey Synthesis</div>
                <div style="font-size:0.95rem;white-space:pre-wrap;color:var(--text2);">
                    ${escHtml(result.synthesis)}
                </div>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:1rem;">
                <div style="background:var(--bg3);border-radius:var(--radius);padding:0.5rem 0.8rem;">
                    <div style="font-size:0.7rem;color:var(--text3);">From</div>
                    <div style="font-weight:600;">${result.regionA.icon} ${result.regionA.name}</div>
                    <div style="font-size:0.7rem;color:var(--text3);">${result.regionA.subgenre}</div>
                </div>
                <div style="background:var(--bg3);border-radius:var(--radius);padding:0.5rem 0.8rem;">
                    <div style="font-size:0.7rem;color:var(--text3);">To</div>
                    <div style="font-weight:600;">${result.regionB.icon} ${result.regionB.name}</div>
                    <div style="font-size:0.7rem;color:var(--text3);">${result.regionB.subgenre}</div>
                </div>
            </div>
            
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center;">
                <button class="btn btn-gold" onclick="window.closeTravelModal();">Close</button>
                <button class="btn btn-secondary" onclick="window.closeTravelModal(); document.getElementById('travel-generate-btn')?.click();">🔄 New Journey</button>
                <button class="btn btn-sm" onclick="window.closeTravelModal(); window.exportTravelJourney();">📤 Export</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(travelModal);
    
    travelModal.addEventListener('click', (e) => {
        if (e.target === travelModal) {
            window.closeTravelModal();
        }
    });
    
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape' && travelModal && travelModal.parentNode) {
            window.closeTravelModal();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

// Close modal
window.closeTravelModal = function() {
    if (travelModal && travelModal.parentNode) {
        travelModal.remove();
        travelModal = null;
    }
};

window.exportTravelJourney = function() {
    if (currentDraw) {
        exportJourney(currentDraw);
    }
};

// ============================================================
// HISTORY
// ============================================================

function getHistory() {
    const state = getState();
    return state.travelHistory || [];
}

function saveHistory(history) {
    const state = getState();
    state.travelHistory = history;
    saveState();
}

function addToHistory(result) {
    const history = getHistory();
    const entry = {
        id: Date.now().toString(),
        regionA: result.regionA.name,
        regionB: result.regionB.name,
        regionAIcon: result.regionA.icon,
        regionBIcon: result.regionB.icon,
        cards: result.cards.map(c => ({
            suit: c.suit,
            rank: c.rank,
            rankName: c.rankName,
            suitName: c.suitName,
            color: c.color,
            meaning: c.meaning
        })),
        timer: result.timer,
        synthesis: result.synthesis,
        timestamp: result.timestamp
    };
    history.unshift(entry);
    if (history.length > 20) history.pop();
    saveHistory(history);
    renderHistory();
}

function renderHistory() {
    const historyEl = document.getElementById('travel-history');
    if (!historyEl) return;
    
    const history = getHistory();
    if (history.length === 0) {
        historyEl.innerHTML = '<span class="text-muted">No journeys planned yet.</span>';
        return;
    }
    
    historyEl.innerHTML = history.slice(0, 10).map(entry => `
        <div style="padding:0.4rem 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
            <div style="display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;">
                <span style="font-size:0.7rem;color:var(--text3);">
                    ${new Date(entry.timestamp).toLocaleDateString()}
                </span>
                <span style="font-weight:500;">
                    ${entry.regionAIcon} ${escHtml(entry.regionA)} → ${entry.regionBIcon} ${escHtml(entry.regionB)}
                </span>
                <span style="font-size:0.7rem;color:var(--text3);background:var(--bg3);padding:0.05rem 0.4rem;border-radius:8px;">
                    ⏱️ ${entry.timer.label}
                </span>
                <button class="btn btn-xs btn-ghost" onclick="window.viewTravelHistory('${entry.id}')">👁️</button>
            </div>
            <div style="font-size:0.75rem;color:var(--text3);margin-top:0.15rem;padding-left:0.5rem;border-left:2px solid var(--gold);">
                ${escHtml(entry.synthesis.substring(0, 80))}${entry.synthesis.length > 80 ? '...' : ''}
            </div>
        </div>
    `).join('');
}

window.viewTravelHistory = function(id) {
    const history = getHistory();
    const entry = history.find(e => e.id === id);
    if (!entry) {
        showToast('Journey not found.', 'error');
        return;
    }
    
    // Reconstruct result from history
    const result = {
        regionA: { name: entry.regionA, icon: entry.regionAIcon },
        regionB: { name: entry.regionB, icon: entry.regionBIcon },
        cards: entry.cards.map(c => ({
            ...c,
            symbol: getSuitSymbol(c.suit),
            emoji: getSuitEmoji(c.suit),
            isFace: ['J', 'Q', 'K'].includes(c.rank),
            isAce: c.rank === 'A',
            timerSegments: getTimerSegments(c.rank),
            timerLabel: getTimerLabel(getTimerSegments(c.rank))
        })),
        timer: entry.timer,
        synthesis: entry.synthesis,
        timestamp: entry.timestamp
    };
    
    openTravelModal(result);
};

// ============================================================
// EXPORT
// ============================================================

function exportJourney(result) {
    const data = {
        journey: {
            from: result.regionA.name,
            to: result.regionB.name,
            cards: result.cards.map(c => ({
                suit: c.suit,
                rank: c.rank,
                meaning: c.meaning,
                timerSegments: c.timerSegments
            })),
            timer: result.timer,
            synthesis: result.synthesis,
            timestamp: result.timestamp
        }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journey-${result.regionA.name}-to-${result.regionB.name}-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📤 Journey exported!', 'success');
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================

function showToast(message, type = 'info') {
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }
    
    const colors = {
        info: 'var(--text)',
        success: 'var(--green)',
        error: 'var(--red)',
        warning: 'var(--orange)'
    };
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg2);
        color: ${colors[type] || colors.info};
        padding: 0.8rem 1.5rem;
        border-radius: var(--radius);
        border: 1px solid var(--border);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 9999;
        font-size: 0.9rem;
        max-width: 90%;
        animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 3000);
}

// ============================================================
// LIFECYCLE METHODS
// ============================================================

export function onActivate() {
    console.log('[Travel Planner] Activated');
    renderHistory();
}

export function onDeactivate() {
    console.log('[Travel Planner] Deactivated');
}

export function refresh() {
    console.log('[Travel Planner] Refreshing');
    render(container);
}

export function destroy() {
    container = null;
    if (travelModal && travelModal.parentNode) {
        travelModal.remove();
        travelModal = null;
    }
}

// ============================================================
// EXPORT DEFAULT
// ============================================================

export default {
    render,
    destroy,
    onActivate,
    onDeactivate,
    refresh,
    generateTravelPlan,
    exportJourney
};