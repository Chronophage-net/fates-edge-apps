// features/travel-planner/index.js
/**
 * Travel Planner - Cartomancy-based journey generation
 *
 * Implements the "Core Travel Procedure" from the Amaranthine Core's Travel
 * Reference chapter, built on the universal suit grammar from The
 * Cartomancer's Compass (see fates_edge_amaranthine_condensed.tex /
 * fates_edge_amaranthine.tex, "Travel Reference" chapter):
 *
 *   For each leg of a journey, draw one card per suit:
 *     ♠ Spades   (Place)    — from the DESTINATION deck: sets the scene.
 *     ♥ Hearts   (Actor)    — from the DESTINATION deck: the local actor/faction.
 *     ♣ Clubs    (Pressure) — from the WILDS deck (general hazards), unless
 *                              the route is strongly policed, in which case
 *                              it's drawn from the destination deck instead.
 *     ♦ Diamonds (Leverage) — from the GATEWAY AUTHORITY deck: whichever
 *                              polity's papers, escorts, or rights actually
 *                              gate the route (often the destination, but
 *                              not always — a mountain pass into Viterra
 *                              might be gated by Ubral or Aeler instead).
 *   The highest-ranked card among the four sets the leg's timer (2-5 -> 4
 *   segments, 6-10 -> 6, J/Q/K -> 8, A -> 10 -- see "Rank and Severity").
 *   An Ace draws the Hollow's attention (+1 SB). A face card (J/Q/K) is a
 *   person or personified force with agency, not just a high number (see
 *   "Card Faces: The Court as Character").
 *
 * Region card data (place/actor/pressure/leverage per rank) is loaded
 * through decks/index.js's fetchRegionData(), which already transforms
 * each region's generator-schema JSON into the {spades:{rank:text}, ...}
 * lookup this module needs -- reusing it here (instead of re-fetching and
 * re-parsing region JSON independently, as this file used to) guarantees
 * the Travel Planner and the Deck of Consequences always agree on what a
 * given card means in a given region.
 */

import { logRecordingEvent } from '../../core/media.js';
import { showToast } from '../../components/Toast.js';
import { addTimer } from '../../core/state.js';
import decksModule from '../decks/index.js';
import {
    getSelectedRegion,
    getRegionNames,
    setSelectedRegion
} from '../decks/index.js';

const { fetchRegionData } = decksModule;

const WILDS_REGION_NAME = 'The Wilds';

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

// ─── The Traveler's Spread (Tulkani three-card journey reading) ───────
// From "Tulkani Cartomancy Traditions" in The Cartomancer's Compass: a
// Quick Working, three cards laid for the road behind, the road ahead,
// and the road beneath. No suit is fixed to a position -- any card can
// land anywhere -- so this uses a genuine mixed 52-card draw rather than
// the suit-locked draws the four-card leg procedure uses.
const TRAVELERS_SPREAD_POSITIONS = [
    { key: 'behind', label: 'The Road Behind', icon: '👣', prompt: 'What have you left behind, and what follows you?' },
    { key: 'ahead', label: 'The Road Ahead', icon: '🌄', prompt: 'What waits for you, and what will you face?' },
    { key: 'beneath', label: 'The Road Beneath', icon: '🪨', prompt: 'What is true, whether you wish it or not?' }
];

// Universal suit grammar, for when no region data is available to give a
// card a specific meaning (see "Interpreting Any Draw, Any Region").
const SUIT_UNIVERSAL_PROMPT = {
    spades: 'A place or landmark. What is its name? What happened here?',
    hearts: 'A person or faction. What do they want? What do they fear?',
    clubs: 'A complication or threat. Who or what is the obstacle?',
    diamonds: 'A reward, token, or secret. What can be gained?'
};

// "Card Faces: The Court as Character" -- face cards are persons (or
// personified forces) with agency, not just a high number.
const FACE_CARD_ROLE = {
    J: { name: 'Jack', role: "an agent or functionary, acting on someone else's authority — competent but replaceable" },
    Q: { name: 'Queen', role: 'a power in their own right, with influence and a network — not easily replaced' },
    K: { name: 'King', role: 'the ultimate authority in their domain — to challenge them is to challenge the order itself' }
};

function getFaceCardNote(suit, rank) {
    const face = FACE_CARD_ROLE[rank];
    if (!face) return null;
    if (suit === 'hearts') {
        return `🎭 Face card — give this actor a name and a motive. As a ${face.name}, they are ${face.role}.`;
    }
    const personified = {
        spades: 'a landmark that remembers every traveler who has crossed it',
        clubs: 'a feud, blockade, or crisis that has lasted generations',
        diamonds: 'a boon so significant it carries its own reputation'
    };
    return `🎭 Face card — treat this as a personified force, not a person: a ${face.name} of ${SUIT_NAMES[suit] || suit} might be ${personified[suit] || 'unusually significant'}.`;
}

// ============================================================
// WORKED ITINERARIES (Travel Reference chapter, "Worked Itineraries")
// ============================================================
// Travel in the setting is charted the way medieval travel actually was --
// as an itinerary of named waypoints and gates, not a coordinate map. The
// sourcebook's Regional Routes / Route Tables / Worked Itineraries sections
// lay out several canonical journeys where each leg's four cards are drawn
// from SPECIFIC (and not always matching) region decks -- e.g. the first
// leg of the Coastal Haul draws its Diamond from Kahfagia even though the
// leg's destination is Ecktoria. That's richer than the generic "policed
// route / gateway authority" fallback below can express on its own, so
// named itineraries are modeled as an explicit leg-by-leg script. Each leg
// may offer `variants` (the sourcebook's "Pick 1" branch points); the
// first variant is the default. Legs use the real dataset region names so
// they can be fed straight into fetchRegionData().
const WORKED_ITINERARIES = [
    {
        key: 'coastal_haul',
        name: 'West-to-East Coastal Haul',
        description: 'Kahfagia → Ecktoria → Silkstrand (Acasia) → Marcott (Vhasia) → Fairport (Viterra).',
        legs: [
            { label: 'Kassamira → Ecktoria', spade: 'Ecktoria', heart: 'Ecktoria', club: WILDS_REGION_NAME, diamond: 'Kahfagia', clockHint: 6, flavor: 'Aqueduct arcades; Coin-house factor; gale; convoy letter.' },
            { label: 'Ecktoria → Silkstrand', spade: 'Acasia', heart: 'Acasia', club: 'Acasia', diamond: 'Acasia', clockHint: 7, flavor: "Three-Queens Bridge; Dyers' Guildmistress; loom strike; Exchange pass." },
            { label: 'Silkstrand → Marcott', spade: 'Vhasia', heart: 'Vhasia', club: 'Vhasia', diamond: 'Vhasia', flavor: 'Pont-du-Tithe; Parlement clerk; coin rumor; letters patent.' },
            { label: 'Marcott → Fairport', spade: 'Viterra', heart: 'Viterra', club: 'Linn', diamond: 'Viterra', clockHint: 6, flavor: 'Fairport tideworks; shipwright; boom lifts; customs seal.' }
        ]
    },
    // "East-to-West Coastal Haul" -- the full return leg of the above,
    // previously missing entirely. The sourcebook only scripts the
    // Kahfagia-outbound direction ("Worked Itineraries: West-to-East
    // Coastal Haul (Kahfagia -> Viterra)"), but the Core Travel Procedure
    // (Global Travel Procedures chapter) is direction-agnostic: Spade/Heart
    // are always drawn from the CURRENT leg's destination, and Diamond from
    // whichever authority gates that destination -- see the Gateways &
    // Control Points table, which lists Kassamira Port's Diamond source as
    // Kahfagia itself. So traveling toward Kahfagia, Kassamira (the
    // Kahfagia gateway) is where the journey arrives, not where it starts.
    // Each leg reuses the same region-deck sourcing as the forward leg that
    // first arrives at that place (arriving somewhere reads the same
    // regardless of which direction you came from) -- only the order and
    // labels are reversed. The Kahfagia-Diamond override on the original
    // leg 1 (an explicit "leaving Kahfagia on a convoy letter" exception,
    // not a general destination default) isn't carried over, since this
    // itinerary is arriving at, not departing, Kahfagia.
    {
        key: 'coastal_haul_reverse',
        name: 'East-to-West Coastal Haul (Viterra → Kahfagia)',
        description: 'Fairport (Viterra) → Marcott (Vhasia) → Silkstrand (Acasia) → Ecktoria → Kassamira (Kahfagia).',
        legs: [
            { label: 'Fairport → Marcott', spade: 'Vhasia', heart: 'Vhasia', club: 'Vhasia', diamond: 'Vhasia', flavor: 'Pont-du-Tithe; Parlement clerk; coin rumor; letters patent.' },
            { label: 'Marcott → Silkstrand', spade: 'Acasia', heart: 'Acasia', club: 'Acasia', diamond: 'Acasia', clockHint: 7, flavor: "Three-Queens Bridge; Dyers' Guildmistress; loom strike; Exchange pass." },
            { label: 'Silkstrand → Ecktoria', spade: 'Ecktoria', heart: 'Ecktoria', club: WILDS_REGION_NAME, diamond: 'Ecktoria', clockHint: 6, flavor: 'Aqueduct arcades; Coin-house factor; gale; berth priority.' },
            { label: 'Ecktoria → Kassamira', spade: 'Kahfagia', heart: 'Kahfagia', club: WILDS_REGION_NAME, diamond: 'Kahfagia', clockHint: 6, flavor: 'Kassamira Port auctions; Mirror-Keeper; gale; convoy letter and lantern-law warrant.' }
        ]
    },
    {
        key: 'acasia_mistlands',
        name: 'Acasia → Mistlands (Forgotten Pass + Under-Gate)',
        description: 'Silkstrand (Acasia) → Aeler Gate → Mistlands.',
        legs: [
            { label: 'Silkstrand → Aeler Gate', spade: 'Aeler', heart: 'Aeler', club: 'Aeler', diamond: 'Aeler', flavor: 'Avalanche gallery; Geometer; Engineer requisition; Underway Pass.' },
            { label: 'Gate → Mistlands', spade: 'Mistlands', heart: 'Mistlands', club: 'Mistlands', diamond: 'Mistlands', flavor: 'Bell-Line levee; Bell-warden; wraith crossing; Ward-salt.' }
        ]
    },
    // Reverse of the above -- same Forgotten Pass / Under-Gate, run from
    // the Mistlands side back down into the Broken Marches.
    {
        key: 'mistlands_acasia',
        name: 'Mistlands → Acasia (Forgotten Pass + Under-Gate, reversed)',
        description: 'Mistlands → Aeler Gate → Silkstrand (Acasia).',
        legs: [
            { label: 'Mistlands → Aeler Gate', spade: 'Aeler', heart: 'Aeler', club: 'Aeler', diamond: 'Aeler', flavor: 'Avalanche gallery; Geometer; Engineer requisition; Underway Pass.' },
            { label: 'Gate → Silkstrand', spade: 'Acasia', heart: 'Acasia', club: 'Acasia', diamond: 'Acasia', flavor: "Three-Queens Bridge; Dyers' Guildmistress; Exchange pass; the Curse's weight settles as the canals come into view." }
        ]
    },
    // Silkstrand's own region entry is explicit that it borders Acasia to
    // the north and is routinely reached overland through it ("the Curse
    // bleeds into the canals"), not just by the Ecktoria sea-lane the
    // Coastal Haul uses -- a separate short itinerary for that caravan
    // road, both directions.
    {
        key: 'acasia_silkstrand_caravan',
        name: 'Acasia → Silkstrand (Overland Caravan Road)',
        description: 'Many caravans skip the Ecktoria sea-lane entirely and cut south through the Broken Marches to the canals -- slower than a coastal hop, but it avoids harbor tariffs.',
        legs: [
            { label: 'Broken Marches → Silkstrand (by caravan)', spade: 'Silkstrand', heart: 'Acasia', club: 'Acasia', diamond: 'Acasia', clockHint: 7, flavor: "A condotta escort haggles over the toll before the canals even come into view; the Curse's weight is felt in the dyewater long before the bridges are." }
        ]
    },
    {
        key: 'silkstrand_acasia_caravan',
        name: 'Silkstrand → Acasia (Overland Caravan Road, reversed)',
        description: 'The same caravan road, walked out of the City of Bridges and back into the Broken Marches.',
        legs: [
            { label: 'Silkstrand → Broken Marches (by caravan)', spade: 'Acasia', heart: 'Acasia', club: 'Acasia', diamond: 'Acasia', clockHint: 7, flavor: 'The bridges fall behind as the canal road turns to rutted track; a condotta banner marks the marches ahead.' }
        ]
    },
    // Mistlands <-> Violet Steppe (Ykrul): two documented borders, two
    // routes. Mistlands' own entry lists the Violet Steppe directly to its
    // north (a route that never touches the mountains at all) AND Aeler
    // directly to its south (Aeler's own entry then lists the Violet
    // Steppe to ITS northwest) -- i.e. a slower, better-papered route
    // through the Aeler high passes instead of around them. "North of the
    // Aelerian Mountains" / "South of the Aelerian Mountains" below refers
    // to which of these two documented borders a party uses, not a new
    // route invented for this planner.
    {
        key: 'mistlands_ykrul_north',
        name: 'Mistlands → Violet Steppe (North of the Aelerian Mountains)',
        description: 'The direct border crossing north of Aeler -- fog gives way to open grass without ever touching the mountain holds.',
        legs: [
            { label: "Payden's Port → the Fogline Border", spade: 'Mistlands', heart: 'Mistlands', club: 'Mistlands', diamond: 'Mistlands', clockHint: 6, flavor: 'Bell-line outposts thin out heading north; a Protectorate patrol logs your papers before the fog gives out.' },
            { label: 'Fogline → Violet Steppe (Ykrul)', spade: 'Ykrul', heart: 'Ykrul', club: WILDS_REGION_NAME, diamond: 'Ykrul', clockHint: 7, flavor: 'The bells stop; the grass starts. Winter-camp smoke on the horizon -- the Ykrul do not linger where the bells rang false, but they watch the treeline all the same.' }
        ]
    },
    {
        key: 'ykrul_mistlands_north',
        name: 'Violet Steppe → Mistlands (North of the Aelerian Mountains, reversed)',
        description: 'Ykrul territory → the Fogline Border → Payden\'s Port.',
        legs: [
            { label: 'Ykrul Territory → the Fogline Border', spade: 'Ykrul', heart: 'Ykrul', club: WILDS_REGION_NAME, diamond: 'Ykrul', clockHint: 7, flavor: 'Grass gives way to fog on the horizon long before the bells are audible. No khagan\'s writ runs past this line.' },
            { label: "Fogline → Payden's Port (Mistlands)", spade: 'Mistlands', heart: 'Mistlands', club: 'Mistlands', diamond: 'Mistlands', clockHint: 6, flavor: 'The first bell-line outpost logs your papers with visible relief. A Protectorate patrol escorts you the rest of the way in.' }
        ]
    },
    {
        key: 'mistlands_ykrul_south',
        name: 'Mistlands → Violet Steppe (South, via the Aeler High Passes)',
        description: 'Through the mountain holds instead of around them -- slower, but the Aeler under-passages are safer than open steppe in raiding season.',
        legs: [
            { label: 'Mistlands → Aeler High Holds', spade: 'Aeler', heart: 'Aeler', club: 'Aeler', diamond: 'Aeler', clockHint: 8, flavor: 'Bell-line caravans trade places with grain barges at the border; the High-Mist Pass toll is paid in iron, not coin. Mountain Passes rule: an Ace here may convert the route to an under-route.' },
            { label: 'Aeler High Holds → Violet Steppe (Ykrul)', spade: 'Ykrul', heart: 'Ykrul', club: WILDS_REGION_NAME, diamond: 'Aeler', clockHint: 7, flavor: "The passes empty onto contested valleys; the Khagan's scouts watch from the ridgelines. Your Aeler papers may or may not mean anything out here -- the mountain's authority doesn't extend past its own shadow." }
        ]
    },
    {
        key: 'ykrul_mistlands_south',
        name: 'Violet Steppe → Mistlands (South, via the Aeler High Passes, reversed)',
        description: 'Ykrul territory → Aeler High Holds → Mistlands.',
        legs: [
            { label: 'Ykrul Territory → Aeler High Holds', spade: 'Aeler', heart: 'Aeler', club: WILDS_REGION_NAME, diamond: 'Aeler', clockHint: 7, flavor: "Contested valleys narrow toward the passes; the Khagan's scouts fall away as the mountain's shadow takes over." },
            { label: 'Aeler High Holds → Mistlands', spade: 'Mistlands', heart: 'Mistlands', club: 'Aeler', diamond: 'Aeler', clockHint: 8, flavor: 'Grain barges trade places with bell-line caravans at the border; the High-Mist Pass toll is paid in iron, not coin.' }
        ]
    },
    // Continuing the Coastal Haul past Fairport: the sourcebook only takes
    // it as far as Viterra, but Viterra's own entry documents two further
    // borders -- Thepyrgos to the south and Ubral to the north -- each
    // worth its own short itinerary, both directions.
    {
        key: 'viterra_thepyrgos',
        name: 'Viterra → Thepyrgos (South Coastal Road)',
        description: 'Continuing the Coastal Haul past Fairport, south along the Black River border into Synod territory.',
        legs: [
            { label: 'Fairport → the Black River Crossing', spade: 'Thepyrgos', heart: 'Thepyrgos', club: WILDS_REGION_NAME, diamond: 'Thepyrgos', clockHint: 7, flavor: 'Chain-Lanterns watch both banks; a Viterran warrant is kindling here, and vice versa. The boom rises when the moon is high and the tide is low.' }
        ]
    },
    {
        key: 'thepyrgos_viterra',
        name: 'Thepyrgos → Viterra (South Coastal Road, reversed)',
        description: 'The Black River Crossing → Fairport.',
        legs: [
            { label: 'Thepyrgos → the Black River Crossing', spade: 'Viterra', heart: 'Viterra', club: WILDS_REGION_NAME, diamond: 'Viterra', clockHint: 7, flavor: "The chain-towers fall behind; hedge-law replaces Synod edict at the ford. The Queen's justiciars ride this border every spring." }
        ]
    },
    // North instead: Ubral, then a Dolmis Sea crossing. Ubral's own entry
    // gives it direct, undefined sea access ("the sea is a horizon, not a
    // border"); the four eastern shores a crossing might make landfall on
    // are modeled as a single "pick a landfall" leg with the compass
    // layout as given -- Zakov northwest, Valewood (Thin Coast) northeast,
    // Aelinnel due east, Aelaerem south -- rather than four separate full
    // itineraries, since the Ubral leg is identical regardless of which
    // shore the crossing lands on.
    {
        key: 'viterra_ubral_dolmis',
        name: 'Viterra → Ubral → Dolmis Sea Crossing',
        description: 'North past Fairport into the highland clans, then a sea crossing to whichever eastern shore the winds allow.',
        legs: [
            { label: 'Fairport → Ubral Highlands', spade: 'Ubral', heart: 'Ubral', club: WILDS_REGION_NAME, diamond: 'Ubral', clockHint: 7, flavor: "The Queen's writ ends at the highland line; tax collectors go armed here, and the cairns vote against the crown every season." },
            {
                label: 'Dolmis Sea Crossing (pick a landfall)', spade: 'Zakov', heart: 'Zakov', club: WILDS_REGION_NAME, diamond: 'Zakov', clockHint: 8,
                variants: [
                    { name: 'A) Northwest to Zakov', spade: 'Zakov', heart: 'Zakov', club: WILDS_REGION_NAME, diamond: 'Zakov', flavor: "Salt Wharf lights on the horizon; the Serpent's Spine reef forces a careful approach." },
                    { name: 'B) Northeast to Valewood (Thin Coast)', spade: 'Valewood', heart: 'Valewood', club: WILDS_REGION_NAME, diamond: 'Valewood', flavor: 'The Thin Coast portage comes into view; star-road shards glitter at the waterline.' },
                    { name: 'C) Due east to Aelinnel', spade: 'Aelinnel', heart: 'Aelinnel', club: WILDS_REGION_NAME, diamond: 'Aelinnel', flavor: 'The gnomish tide-traders signal from the Dolmis shallows; a counting-song carries across open water.' },
                    { name: 'D) South to Aelaerem', spade: 'Aelaerem', heart: 'Aelaerem', club: WILDS_REGION_NAME, diamond: 'Aelaerem', flavor: 'The halfling downs rise gently from the water; watch-geese call from the fishing weirs.' }
                ]
            }
        ]
    },
    {
        key: 'dolmis_ubral_viterra',
        name: 'Dolmis Sea Crossing → Ubral → Viterra (reversed)',
        description: 'Whichever eastern shore you started from, the crossing lands at Ubral before the road turns south to Fairport.',
        legs: [
            {
                label: 'Dolmis Sea Crossing (pick your point of departure)', spade: 'Ubral', heart: 'Ubral', club: WILDS_REGION_NAME, diamond: 'Ubral', clockHint: 8,
                variants: [
                    { name: 'A) Departing Zakov (northwest shore)', spade: 'Ubral', heart: 'Ubral', club: WILDS_REGION_NAME, diamond: 'Ubral', flavor: "The Serpent's Spine falls behind; Ubral's coves and fishing villages are a plainer welcome than Salt Wharf." },
                    { name: 'B) Departing Valewood / Thin Coast (northeast shore)', spade: 'Ubral', heart: 'Ubral', club: WILDS_REGION_NAME, diamond: 'Ubral', flavor: 'Star-road shards give way to plain cairns; the crossing is calmer heading west than it was heading out.' },
                    { name: 'C) Departing Aelinnel (due east shore)', spade: 'Ubral', heart: 'Ubral', club: WILDS_REGION_NAME, diamond: 'Ubral', flavor: 'The counting-songs fade behind you; Ubral does not sing back.' },
                    { name: 'D) Departing Aelaerem (south shore)', spade: 'Ubral', heart: 'Ubral', club: WILDS_REGION_NAME, diamond: 'Ubral', flavor: 'The watch-geese calls fade into open water; the highland coves are a colder shore than the downs.' }
                ]
            },
            { label: 'Ubral Highlands → Fairport', spade: 'Viterra', heart: 'Viterra', club: WILDS_REGION_NAME, diamond: 'Viterra', clockHint: 6, flavor: 'Fairport tideworks rise out of the haze; customs seals are checked twice for anyone coming down from the highlands.' }
        ]
    },
    {
        key: 'thin_shore_zakov_theona',
        name: 'Thin Shore → Zakov → Theona (Corsair Jobs)',
        description: 'A fast arc for crews running the misted coast into pirate politics and back into isle taboos.',
        legs: [
            { label: "Payden's Port → Thin Shore (Shadow Corridor)", spade: 'Valewood', heart: 'Mistlands', club: 'Mistlands', diamond: 'Mistlands', clockHint: 6, flavor: 'Green lane / Unfound stile; Protectorate clerk; bell-line failure; Lantern Writ. Rule of 9s applies.' },
            { label: 'Thin Shore Transit (toward Zakov)', spade: 'Valewood', heart: 'Valewood', club: 'Valewood', diamond: 'Valewood', clockHint: 6, flavor: 'Sea-mist arcade; Path-warden; Sweet wind; Way-cord (spending it negates one Sweet wind lie).' },
            { label: 'Approach to Zakov (Roadstead & Booms)', spade: 'Zakov', heart: 'Zakov', club: 'Zakov', diamond: 'Zakov', clockHint: 7, flavor: 'Boomhouse or Red Wharf; Pilot-Matron or Night Magistrate; Boom Drop or Customs Sweep; Harbor-Green Chit or Pilot Token. Apply the Gatekeepers overlay on arrival; a 9 triggers Missing Ninth.' },
            {
                label: 'Corsair Job Inside Zakov (pick one)', spade: 'Zakov', heart: 'Zakov', club: 'Zakov', diamond: 'Zakov',
                variants: [
                    { name: 'A) Lift a Hull from Drydock Four', flavor: "Drydock Four; Corsair Quartermaster; Admiralty Audit; Shipwright's Lien Release -- avoids bond but flips a debt later." },
                    { name: 'B) Court the Black Bishop for Indulgence', flavor: "Black Bell Tower; Black Bishop; Bounty Proclamation; Magistrate's Hush -- rumor must be paid in coin or gossip." },
                    { name: "C) Smuggler's Ladder Run", flavor: "Lantern Ladder; Lampman; Informant Flip; Smuggler's Ladder Map -- your tip was sold twice." }
                ]
            },
            { label: 'Zakov → Theona (Isles & Moot)', spade: 'Theona', heart: 'Theona', club: 'Linn', diamond: 'Theona', clockHint: 7, flavor: "Uncounted Bridge; Matron of Wells or Moot Envoy; fogfall raids; Moot Token. Taboo: don't count the steps aloud." },
            {
                label: 'Theona Contract (pick one)', spade: 'Theona', heart: 'Theona', club: 'Theona', diamond: 'Theona',
                variants: [
                    { name: 'A) Raid-Truce at the Skerries', spade: 'Theona', heart: 'Theona', club: 'Theona', diamond: 'Theona', flavor: 'Tide caves; Isle Moot Envoy; Muster drum; Raid-truce Ribbon -- failure triggers a Linn muster timer.' },
                    { name: 'B) Deliver the Ledger Shard', spade: 'Theona', heart: 'Theona', club: 'Zakov', diamond: 'Theona', flavor: 'Well-yard; Matron of Wells; a Zakov Debt Call follows you; Sanctuary Night buys time.' }
                ]
            }
        ]
    },
    {
        key: 'steppe_passage',
        name: 'Steppe Passage: Black Banner Territory',
        description: 'A dangerous journey through contested lands where three powers vie for control.',
        legs: [
            { label: 'Foedus Stone → Black Banner Camp', spade: 'Vilikari', heart: 'Black Banners', club: WILDS_REGION_NAME, diamond: 'Black Banners', clockHint: 7, flavor: 'Wolf Road milepost or Foedus Stone; Clan Elder or War Captain; Rasputitsa or Remount Sickness; Safe-conduct or Remount Chit. Foedus recall may invalidate your papers.' },
            { label: 'Black Banner Camp → Ykrul Territory', spade: 'Ykrul', heart: 'Ykrul', club: WILDS_REGION_NAME, diamond: 'Ykrul', clockHint: 7, flavor: "Winter camp ring or Khagan's way-station; Khatun of the Ring or Noyan envoy; Hostage protocol or Feud spark; Paiza tablet or Foedus seal. Choose which law applies." }
        ]
    },
    // Reverse of the above -- same contested corridor, run from Ykrul
    // territory back toward the Foedus Stone. Each leg reuses its forward
    // counterpart's card sourcing (same place, same blended Vilikari/Black
    // Banners sourcing the forward route uses), just relabeled.
    {
        key: 'steppe_passage_reverse',
        name: 'Steppe Passage: Black Banner Territory (Ykrul → Vilikari, reversed)',
        description: 'The same contested corridor, run from Ykrul territory back toward the Foedus Stone.',
        legs: [
            { label: 'Ykrul Territory → Black Banner Camp', spade: 'Black Banners', heart: 'Black Banners', club: WILDS_REGION_NAME, diamond: 'Black Banners', clockHint: 7, flavor: "Winter camp ring or Khagan's way-station falls behind; Khatun of the Ring or Noyan envoy; Hostage protocol or Feud spark; Paiza tablet or Foedus seal. Choose which law applies." },
            { label: 'Black Banner Camp → Foedus Stone', spade: 'Vilikari', heart: 'Black Banners', club: WILDS_REGION_NAME, diamond: 'Black Banners', clockHint: 7, flavor: 'Wolf Road milepost or Foedus Stone comes into view; Clan Elder or War Captain; Rasputitsa or Remount Sickness; Safe-conduct or Remount Chit. Foedus recall may invalidate your papers.' }
        ]
    },
    // Reverse of the Corsair Jobs arc -- isle taboos back into pirate
    // politics and out through the misted coast. The two "pick one"
    // activity legs (Corsair Job, Theona Contract) don't represent travel
    // at all -- they're side business at a fixed location -- so they carry
    // over unchanged (same variants, same sourcing) between the transit
    // legs around them, which are reversed and relabeled.
    {
        key: 'theona_zakov_thin_shore',
        name: 'Theona → Zakov → Thin Shore (Return Passage)',
        description: 'The Corsair Jobs itinerary, run in reverse -- isle taboos back into pirate politics and the misted coast.',
        legs: [
            {
                label: 'Theona Contract (pick one)', spade: 'Theona', heart: 'Theona', club: 'Theona', diamond: 'Theona',
                variants: [
                    { name: 'A) Raid-Truce at the Skerries', spade: 'Theona', heart: 'Theona', club: 'Theona', diamond: 'Theona', flavor: 'Tide caves; Isle Moot Envoy; Muster drum; Raid-truce Ribbon -- failure triggers a Linn muster timer.' },
                    { name: 'B) Deliver the Ledger Shard', spade: 'Theona', heart: 'Theona', club: 'Zakov', diamond: 'Theona', flavor: 'Well-yard; Matron of Wells; a Zakov Debt Call follows you; Sanctuary Night buys time.' }
                ]
            },
            { label: 'Theona → Zakov (Isles & Moot, reversed)', spade: 'Zakov', heart: 'Zakov', club: 'Linn', diamond: 'Zakov', clockHint: 7, flavor: "Uncounted Bridge falls behind; Boomhouse gossip waits dockside; fogfall raids; Moot Token still honored. Taboo: don't count the steps aloud." },
            {
                label: 'Corsair Job Inside Zakov (pick one)', spade: 'Zakov', heart: 'Zakov', club: 'Zakov', diamond: 'Zakov',
                variants: [
                    { name: 'A) Lift a Hull from Drydock Four', flavor: "Drydock Four; Corsair Quartermaster; Admiralty Audit; Shipwright's Lien Release -- avoids bond but flips a debt later." },
                    { name: 'B) Court the Black Bishop for Indulgence', flavor: "Black Bell Tower; Black Bishop; Bounty Proclamation; Magistrate's Hush -- rumor must be paid in coin or gossip." },
                    { name: "C) Smuggler's Ladder Run", flavor: "Lantern Ladder; Lampman; Informant Flip; Smuggler's Ladder Map -- your tip was sold twice." }
                ]
            },
            { label: 'Zakov → Thin Shore Transit (reversed)', spade: 'Valewood', heart: 'Valewood', club: 'Valewood', diamond: 'Valewood', clockHint: 6, flavor: 'Sea-mist arcade; Path-warden; Sweet wind; Way-cord (spending it negates one Sweet wind lie).' },
            { label: "Thin Shore → Payden's Port (Shadow Corridor, reversed)", spade: 'Valewood', heart: 'Mistlands', club: 'Mistlands', diamond: 'Mistlands', clockHint: 6, flavor: 'Green lane / Unfound stile; Protectorate clerk; bell-line failure; Lantern Writ. Rule of 9s applies.' }
        ]
    }
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
let currentReading = null;   // last Traveler's Spread reading
let isInitialized = false;
let regionList = [];

// "Core Travel Procedure" leg-sourcing controls (see file header):
let policedRoute = false;    // true -> ♣ Pressure drawn from destination, not the Wilds
let gatewayRegion = null;    // region whose deck ♦ Leverage is drawn from (defaults to destination)

// Worked-itinerary controls: '' means "freeform journey" (Core Travel
// Procedure above); otherwise a WORKED_ITINERARIES[].key.
let selectedItinerary = '';
let itineraryVariantChoices = {}; // { legIndex: variantIndex }

// ============================================================
// HELPERS
// ============================================================

/**
 * Look up a card's meaning for a region, using decks/index.js's already-
 * transformed, rank-keyed region data ({ spades: { A: '...', 2: '...' },
 * hearts: {...}, ... } — see fetchRegionData/transformRegionData there).
 *
 * BUGFIX: this file used to fetch region JSON itself and index into
 * `regionData[suit]` as if it were a flat ARRAY, hashing suit+rank into
 * an array index. But every real region file is in the "generator"
 * schema (places/people_and_factions/complications/rewards, each an
 * array of per-rank card objects) -- `regionData.spades` was always
 * `undefined` on the raw JSON, so every single leg silently fell through
 * to the generic "A complication of clubs arises." filler text, for
 * every region, always. Reusing decks/index.js's fetchRegionData (which
 * already runs transformRegionData()) gives real per-rank text and keeps
 * this file's card meanings identical to what the Decks feature shows
 * for the same card in the same region.
 */
function getCardMeaningFromRegion(suit, rank, regionData) {
    const meaning = regionData?.[suit]?.[rank];
    if (meaning) return meaning;
    return SUIT_UNIVERSAL_PROMPT[suit] || `A complication of ${suit} arises.`;
}

// "Rank and Severity: The Weight of the Card" / "Timer Conversion" --
// BUGFIX: this used to gate the 6-segment tier on rank >= 7, so a 6
// (which the book puts in the 6-10 -> 6-segment band) fell through to
// the 4-segment "2-5" band instead.
export function getTimerSizeFromRank(rank) {
    const val = POKER_RANK[rank] || 0;
    if (val >= 14) return 10;      // A
    if (val >= 11) return 8;       // J, Q, K
    if (val >= 6) return 6;        // 6-10
    return 4;                      // 2-5
}

// Region card meanings can contain inline HTML (e.g. <em>...</em>) meant
// for the per-leg cards, which render via innerHTML. Plain-text contexts
// (the synthesis panel's textContent, copy/export summaries) don't parse
// HTML, so those tags were showing up literally. Strip them for any text
// destined for a plain-text display.
function stripHtml(str) {
    if (!str) return str;
    return String(str).replace(/<[^>]*>/g, '');
}

// Builds the plain-text journey synthesis shown in the "synthesis" panel
// (rendered via textContent, so it must not contain HTML) and reused for
// copy/export. One line per leg, tags stripped, Ace effects listed once
// at the end -- replaces the old single-line, pipe-and-semicolon-joined
// blob that also leaked <em> tags from region flavor text as literal
// characters since textContent doesn't parse HTML.
function buildOverallSynthesis(headerLine, legs, aceEffects) {
    const lines = [`${headerLine} (${legs.length} leg${legs.length === 1 ? '' : 's'})`, ''];
    legs.forEach((leg, i) => {
        const label = leg.legLabel || `Leg ${i + 1}`;
        lines.push(`${label}:`);
        lines.push(`  Place: ${stripHtml(leg.place)}`);
        lines.push(`  Actor: ${stripHtml(leg.actor)}`);
        lines.push(`  Pressure: ${stripHtml(leg.pressure)}`);
        lines.push(`  Leverage: ${stripHtml(leg.leverage)}`);
        lines.push('');
    });
    if (aceEffects && aceEffects.length > 0) {
        lines.push("The Hollow's Attention:");
        aceEffects.forEach(e => lines.push(`  ${e.emoji || '🃏'} ${stripHtml(e.text || 'The Hollow takes notice.')}`));
    }
    return lines.join('\n').trimEnd();
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

export class Xorshift128 {
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

        // BUGFIX: converting the full 64-bit combined state straight to a
        // JS Number loses precision (doubles only hold 53 mantissa bits)
        // and occasionally rounds UP to exactly 2^64, which divided by
        // 2^64 yields random() === 1 instead of a value < 1. That let
        // randomInt(0, n) return n itself (out of bounds), which corrupted
        // the Fisher-Yates shuffle by swapping in `undefined` -- the cause
        // of "Cannot read properties of undefined (reading 'rank')".
        // Masking to 53 bits keeps the value exactly representable as a
        // double, so it is always strictly < 1.
        const combined = (x + y) & BigInt(0x1FFFFFFFFFFFFF); // 2^53 - 1
        const result = Number(combined) / 9007199254740992; // 2^53
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

// ─── Suit-locked decks ──────────────────────────────────────────────
// BUGFIX: the previous version drew four cards from one shared 52-card
// deck and simply LABELED the first draw "the spade," the second "the
// heart," etc. -- regardless of the card's actual suit (a "spade" draw
// could really be, say, the King of Hearts, whose suit was then shown
// as-is in the UI while its MEANING was computed as if it were a Spade).
// The Core Travel Procedure calls for one card per suit, so each suit
// gets its own 13-card deck here and card identity always matches its
// role.
let suitDecks = { spades: [], hearts: [], clubs: [], diamonds: [] };
const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function resetSuitDecksForTest() {
    resetSuitDecks();
}

export function drawSuitCardForTest(suit) {
    return drawSuitCard(suit);
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = getTravelRandomInt(0, i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function buildSuitDeck(suit) {
    return shuffle(CARD_RANKS.map(rank => ({ suit, rank })));
}

function resetSuitDecks() {
    suitDecks = {
        spades: buildSuitDeck('spades'),
        hearts: buildSuitDeck('hearts'),
        clubs: buildSuitDeck('clubs'),
        diamonds: buildSuitDeck('diamonds')
    };
}

function drawSuitCard(suit) {
    if (!suitDecks[suit] || suitDecks[suit].length === 0) {
        suitDecks[suit] = buildSuitDeck(suit);
    }
    return suitDecks[suit].pop();
}

// A genuine mixed 52-card deck, for draws where suit isn't fixed to a
// position (the Traveler's Spread).
function buildMixedDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of CARD_RANKS) deck.push({ suit, rank });
    }
    return shuffle(deck);
}

// ============================================================
// JOURNEY GENERATION — Core Travel Procedure (4 cards/leg)
// ============================================================

// sources: { spadeData, heartData, clubData, diamondData,
//            spadeLabel, heartLabel, clubLabel, diamondLabel,
//            aceRegion, legLabel, legFlavor, clockHint }
// spadeData/heartData/etc. may point to the SAME region-data object (the
// generic Core Travel Procedure) or to four different ones (a Worked
// Itinerary leg, where the sourcebook sometimes draws, say, the Diamond
// from a different region entirely than the Spade/Heart).
function generateLeg(sources, legIndex) {
    const spade = drawSuitCard('spades');
    const heart = drawSuitCard('hearts');
    const club = drawSuitCard('clubs');
    const diamond = drawSuitCard('diamonds');

    const cards = { spade, heart, club, diamond };

    const place = getCardMeaningFromRegion('spades', spade.rank, sources.spadeData);
    const actor = getCardMeaningFromRegion('hearts', heart.rank, sources.heartData);
    const pressure = getCardMeaningFromRegion('clubs', club.rank, sources.clubData);
    const leverage = getCardMeaningFromRegion('diamonds', diamond.rank, sources.diamondData);

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

    // "Aces and the Ninth: The Hollow's Attention" -- any Ace in the draw
    // draws the Hollow's notice (GM gains 1 extra SB), separate from
    // the region-flavored Ace omen already shown.
    const allCards = [spade, heart, club, diamond];
    const aces = allCards.filter(c => c.rank === 'A');
    let aceEffect = null;
    if (aces.length > 0) {
        aceEffect = getAceEffect(sources.aceRegion || sources.spadeLabel, aces[0]);
        if (typeof logRecordingEvent === 'function') {
            logRecordingEvent('travel_leg_ace', `♠️ Travel Ace Effect: ${aceEffect.emoji} ${aceEffect.text} (Leg ${legIndex + 1}, ${sources.spadeLabel})`);
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
        aceCount: aces.length,
        legLabel: sources.legLabel || null,
        legFlavor: sources.legFlavor || null,
        spadeSource: sources.spadeLabel,
        heartSource: sources.heartLabel,
        clubSource: sources.clubLabel,
        diamondSource: sources.diamondLabel,
        cardDetails: {
            spade: { rank: spade.rank, suit: spade.suit, symbol: getSuitSymbol('spades'), color: getSuitColor('spades'), meaning: place, faceNote: getFaceCardNote('spades', spade.rank) },
            heart: { rank: heart.rank, suit: heart.suit, symbol: getSuitSymbol('hearts'), color: getSuitColor('hearts'), meaning: actor, faceNote: getFaceCardNote('hearts', heart.rank) },
            club: { rank: club.rank, suit: club.suit, symbol: getSuitSymbol('clubs'), color: getSuitColor('clubs'), meaning: pressure, faceNote: getFaceCardNote('clubs', club.rank) },
            diamond: { rank: diamond.rank, suit: diamond.suit, symbol: getSuitSymbol('diamonds'), color: getSuitColor('diamonds'), meaning: leverage, faceNote: getFaceCardNote('diamonds', diamond.rank) }
        }
    };
}

async function generateJourneyAsync(startRegion, destRegion, numLegs = 3) {
    if (!startRegion || !destRegion) {
        showToast('Please select both start and destination regions.', 'error');
        return null;
    }

    const destData = await fetchRegionData(destRegion);
    if (!destData) {
        showToast('Could not load region data.', 'error');
        return null;
    }

    // ♣ Pressure: the Wilds' general hazards, unless the route is
    // strongly policed (destination's own complications instead).
    const clubData = policedRoute ? destData : await fetchRegionData(WILDS_REGION_NAME);

    // ♦ Leverage: whichever authority actually gates the route. Defaults
    // to the destination, but a GM can name a different gateway (e.g. a
    // mountain pass into Viterra gated by Ubral or Aeler papers instead).
    const diamondRegionName = gatewayRegion && gatewayRegion !== destRegion ? gatewayRegion : destRegion;
    const diamondData = diamondRegionName === destRegion ? destData : await fetchRegionData(diamondRegionName);

    resetSuitDecks();

    const sources = {
        spadeData: destData, heartData: destData, clubData, diamondData,
        spadeLabel: destRegion, heartLabel: destRegion,
        clubLabel: policedRoute ? destRegion : WILDS_REGION_NAME,
        diamondLabel: diamondRegionName,
        aceRegion: destRegion
    };

    const legs = [];
    let totalTimer = 0;
    let highestCardOverall = null;
    let allAceEffects = [];

    for (let i = 0; i < numLegs; i++) {
        const leg = generateLeg(sources, i);
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
    const overallSynthesis = buildOverallSynthesis(`Journey: ${startRegion} → ${destRegion}`, legs, allAceEffects);

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
        policedRoute,
        gatewayRegion: diamondRegionName,
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
// WORKED ITINERARY JOURNEYS — named, leg-scripted journeys
// ============================================================

function resolveItineraryLeg(legDef) {
    // Applies the chosen variant (if any) over its parent leg's defaults.
    const variantIdx = itineraryVariantChoices[legDef._index] || 0;
    if (legDef.variants && legDef.variants[variantIdx]) {
        const v = legDef.variants[variantIdx];
        return {
            label: `${legDef.label} — ${v.name}`,
            spade: v.spade || legDef.spade,
            heart: v.heart || legDef.heart,
            club: v.club || legDef.club,
            diamond: v.diamond || legDef.diamond,
            flavor: v.flavor || legDef.flavor,
            clockHint: legDef.clockHint
        };
    }
    return legDef;
}

async function generateItineraryJourneyAsync(itineraryKey) {
    const itinerary = WORKED_ITINERARIES.find(it => it.key === itineraryKey);
    if (!itinerary) {
        showToast('Unknown itinerary.', 'error');
        return null;
    }

    resetSuitDecks();

    // Cache region-data fetches across legs -- worked itineraries often
    // reuse the same region deck for several consecutive legs.
    const dataCache = new Map();
    async function getData(name) {
        if (!dataCache.has(name)) {
            dataCache.set(name, await fetchRegionData(name));
        }
        return dataCache.get(name);
    }

    const legs = [];
    let totalTimer = 0;
    let highestCardOverall = null;
    let allAceEffects = [];

    for (let i = 0; i < itinerary.legs.length; i++) {
        const raw = { ...itinerary.legs[i], _index: i };
        const resolved = resolveItineraryLeg(raw);

        const [spadeData, heartData, clubData, diamondData] = await Promise.all([
            getData(resolved.spade), getData(resolved.heart), getData(resolved.club), getData(resolved.diamond)
        ]);
        if (!spadeData || !heartData || !clubData || !diamondData) {
            showToast(`Could not load region data for "${resolved.label}".`, 'error');
            return null;
        }

        const sources = {
            spadeData, heartData, clubData, diamondData,
            spadeLabel: resolved.spade, heartLabel: resolved.heart,
            clubLabel: resolved.club, diamondLabel: resolved.diamond,
            aceRegion: resolved.spade,
            legLabel: resolved.label, legFlavor: resolved.flavor
        };

        const leg = generateLeg(sources, i);
        legs.push(leg);
        totalTimer += leg.timerSegments;
        if (leg.aceEffect) allAceEffects.push(leg.aceEffect);
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
                if (suitA > suitB) highestCardOverall = leg.cards.spade;
            }
        }
    }

    const totalSegments = Math.min(totalTimer, 10);
    const overallSynthesis = buildOverallSynthesis(`Worked Itinerary: ${itinerary.name}`, legs, allAceEffects);

    const roles = TRAVEL_ROLES.map(role => ({ ...role, assigned: true }));

    const journey = {
        startRegion: itinerary.legs[0].spade,
        destRegion: itinerary.legs[itinerary.legs.length - 1].spade,
        itineraryKey: itinerary.key,
        itineraryName: itinerary.name,
        numLegs: legs.length,
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

    if (typeof logRecordingEvent === 'function') {
        logRecordingEvent('journey_generated', `🗺️ Worked Itinerary: ${itinerary.name} (${journey.numLegs} legs, ${journey.totalSegments} segments, ${journey.aceEffects.length} Ace effects)`);
        legs.forEach((leg) => {
            logRecordingEvent('journey_leg', `${leg.legLabel}: Place: ${leg.place} | Actor: ${leg.actor} | Pressure: ${leg.pressure} | Leverage: ${leg.leverage} | Timer: ${leg.timerSegments} segments`);
        });
    }

    return journey;
}

// ============================================================
// THE TRAVELER'S SPREAD — Tulkani three-card quick reading
// ============================================================

async function generateTravelersSpread(regionName) {
    const data = regionName ? await fetchRegionData(regionName) : null;
    const deck = buildMixedDeck();

    const cards = TRAVELERS_SPREAD_POSITIONS.map(position => {
        const card = deck.pop();
        const meaning = data
            ? getCardMeaningFromRegion(card.suit, card.rank, data)
            : SUIT_UNIVERSAL_PROMPT[card.suit];
        return {
            position,
            card,
            symbol: getSuitSymbol(card.suit),
            color: getSuitColor(card.suit),
            meaning,
            faceNote: getFaceCardNote(card.suit, card.rank),
            isAce: card.rank === 'A'
        };
    });

    const anyAces = cards.some(c => c.isAce);
    let aceEffect = null;
    if (anyAces) {
        const aceCard = cards.find(c => c.isAce).card;
        aceEffect = getAceEffect(regionName, aceCard);
    }

    const reading = {
        region: regionName || null,
        cards,
        aceEffect,
        timestamp: new Date().toISOString()
    };

    currentReading = reading;

    if (typeof logRecordingEvent === 'function') {
        logRecordingEvent('travelers_spread', `🔮 Traveler's Spread${regionName ? ` (${regionName})` : ''}: ` +
            cards.map(c => `${c.position.label}: ${getRankName(c.card.rank)} of ${getSuitName(c.card.suit)} — ${c.meaning}`).join(' | '));
    }

    return reading;
}

// ============================================================
// RENDER
// ============================================================

export async function render(el) {
    container = el;
    
    let regionNames = getRegionNames() || ['Acasia', 'Ecktoria', 'Vhasia', 'Viterra', 'Ykrul', 'Silkstrand'];
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
                <h3>🗒️ Worked Itinerary <span style="font-size:0.75rem;color:var(--text3);font-weight:normal;">(named journeys from the Travel Reference chapter — travel here is charted as an itinerary of waypoints and gates, not a map)</span></h3>
                <div class="field">
                    <label>Itinerary</label>
                    <select id="travel-itinerary-select">
                        <option value="">— Freeform Journey (Core Travel Procedure) —</option>
                        ${WORKED_ITINERARIES.map(it => `<option value="${it.key}" ${it.key === selectedItinerary ? 'selected' : ''}>${it.name}</option>`).join('')}
                    </select>
                </div>
                <div id="travel-itinerary-preview" style="margin-top:0.5rem;${selectedItinerary ? '' : 'display:none;'}"></div>
            </div>

            <div class="panel" id="travel-freeform-panel" style="${selectedItinerary ? 'display:none;' : ''}">
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
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:end;margin-top:0.7rem;">
                    <div class="field" style="display:flex;align-items:center;gap:0.4rem;">
                        <input type="checkbox" id="travel-policed-route" ${policedRoute ? 'checked' : ''}>
                        <label for="travel-policed-route" style="margin:0;">Strongly Policed Route</label>
                    </div>
                    <div class="field" style="flex:1;min-width:180px;">
                        <label>Gateway Authority <span style="color:var(--text3);font-weight:normal;">(who gates this route — defaults to destination)</span></label>
                        <select id="travel-gateway-region">
                            <option value="">Same as Destination</option>
                            ${regionNames.map(name => `<option value="${name}" ${name === gatewayRegion ? 'selected' : ''}>${name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div style="margin-top:0.5rem;font-size:0.85rem;color:var(--text2);">
                    Each leg draws one card per suit — Place (♠) and Actor (♥) from the destination; Pressure (♣) from the Wilds' general hazards
                    unless the route is strongly policed (then the destination); Leverage (♦) from whichever authority actually gates the route.
                    The highest card sets a suggested timer.
                    <span style="color:var(--gold);">♠️ Aces draw the Hollow's attention (+1 SB)!</span>
                </div>
            </div>

            <div class="panel">
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button class="btn btn-gold" id="travel-generate-btn">🃏 Generate Journey</button>
                    <button class="btn" id="travel-reshuffle-btn">↺ Reshuffle</button>
                </div>
            </div>

            <div class="panel">
                <h3>🔮 The Traveler's Spread <span style="font-size:0.75rem;color:var(--text3);font-weight:normal;">(Tulkani quick reading — Road Behind / Road Ahead / Road Beneath)</span></h3>
                <div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:end;">
                    <div class="field" style="flex:1;min-width:180px;">
                        <label>Region <span style="color:var(--text3);font-weight:normal;">(optional — leave blank for universal meanings)</span></label>
                        <select id="travel-spread-region">
                            <option value="">— Universal (no region) —</option>
                            ${regionNames.map(name => `<option value="${name}">${name}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn btn-secondary" id="travel-spread-btn">🔮 Draw Traveler's Spread</button>
                </div>
                <div id="travel-spread-display" style="margin-top:0.6rem;display:none;"></div>
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

    const policedCheck = document.getElementById('travel-policed-route');
    if (policedCheck) {
        policedCheck.addEventListener('change', (e) => {
            policedRoute = e.target.checked;
        });
    }

    const gatewaySelect = document.getElementById('travel-gateway-region');
    if (gatewaySelect) {
        gatewaySelect.addEventListener('change', (e) => {
            gatewayRegion = e.target.value || null;
        });
    }

    const spreadBtn = document.getElementById('travel-spread-btn');
    if (spreadBtn) {
        spreadBtn.addEventListener('click', handleTravelersSpread);
    }

    const itinerarySelect = document.getElementById('travel-itinerary-select');
    if (itinerarySelect) {
        itinerarySelect.addEventListener('change', (e) => {
            selectedItinerary = e.target.value;
            itineraryVariantChoices = {};
            const freeformPanel = document.getElementById('travel-freeform-panel');
            if (freeformPanel) freeformPanel.style.display = selectedItinerary ? 'none' : '';
            renderItineraryPreview();
        });
    }

    renderItineraryPreview();
}

function renderItineraryPreview() {
    const preview = document.getElementById('travel-itinerary-preview');
    if (!preview) return;
    if (!selectedItinerary) {
        preview.style.display = 'none';
        preview.innerHTML = '';
        return;
    }
    const itinerary = WORKED_ITINERARIES.find(it => it.key === selectedItinerary);
    if (!itinerary) return;

    preview.style.display = 'block';
    preview.innerHTML = `
        <p style="font-size:0.85rem;color:var(--text2);margin:0 0 0.5rem;">${itinerary.description}</p>
        ${itinerary.legs.map((leg, idx) => `
            <div style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem 0.7rem;margin-bottom:0.4rem;">
                <strong style="font-size:0.85rem;">Leg ${idx + 1}: ${leg.label}</strong>
                <div style="font-size:0.75rem;color:var(--text3);margin-top:0.15rem;">
                    ♠${leg.spade} ♥${leg.heart} ♣${leg.club} ♦${leg.diamond}${leg.clockHint ? ` — suggested clock ${leg.clockHint}` : ''}
                </div>
                ${leg.flavor ? `<div style="font-size:0.75rem;font-style:italic;color:var(--text2);margin-top:0.15rem;">${leg.flavor}</div>` : ''}
                ${leg.variants ? `
                    <div class="field" style="margin-top:0.3rem;">
                        <select class="travel-itinerary-variant-select" data-leg-index="${idx}" style="font-size:0.8rem;">
                            ${leg.variants.map((v, vi) => `<option value="${vi}" ${(itineraryVariantChoices[idx] || 0) === vi ? 'selected' : ''}>${v.name}</option>`).join('')}
                        </select>
                    </div>
                ` : ''}
            </div>
        `).join('')}
    `;

    preview.querySelectorAll('.travel-itinerary-variant-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const legIdx = parseInt(e.target.getAttribute('data-leg-index'), 10);
            itineraryVariantChoices[legIdx] = parseInt(e.target.value, 10);
        });
    });
}

// ============================================================
// HANDLERS
// ============================================================

async function handleGenerate() {
    if (selectedItinerary) {
        showToast('Generating journey...', 'info');
        try {
            const itinerary = WORKED_ITINERARIES.find(it => it.key === selectedItinerary);
            const journey = await generateItineraryJourneyAsync(selectedItinerary);
            if (!journey) {
                showToast('Failed to generate journey.', 'error');
                return;
            }
            displayJourney(journey);
            addToHistory(journey);
            const aceCount = journey.aceEffects ? journey.aceEffects.length : 0;
            showToast(`"${itinerary.name}" generated (${journey.numLegs} legs). ${aceCount > 0 ? `♠️ ${aceCount} Ace effect(s) triggered!` : ''}`, 'success');
            if (typeof logRecordingEvent === 'function') {
                logRecordingEvent('travel_planner_generate', `User generated worked itinerary: ${itinerary.name}`);
            }
        } catch (err) {
            console.error('Error generating journey:', err);
            showToast('Error generating journey.', 'error');
        }
        return;
    }

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

async function handleTravelersSpread() {
    const regionSelect = document.getElementById('travel-spread-region');
    const regionName = regionSelect ? (regionSelect.value || null) : null;

    showToast("Drawing the Traveler's Spread...", 'info');

    try {
        const reading = await generateTravelersSpread(regionName);
        displayTravelersSpread(reading);
        showToast(`Traveler's Spread drawn${regionName ? ` for ${regionName}` : ''}.`, 'success');
    } catch (err) {
        console.error("Error generating Traveler's Spread:", err);
        showToast("Error drawing the Traveler's Spread.", 'error');
    }
}

function displayTravelersSpread(reading) {
    const display = document.getElementById('travel-spread-display');
    if (!display) return;
    display.style.display = 'block';

    display.innerHTML = `
        ${reading.aceEffect ? `
            <div style="margin-bottom:0.5rem;padding:0.3rem 0.6rem;background:var(--bg4);border-radius:var(--radius);border:1px solid var(--gold);color:var(--gold);font-size:0.85rem;">
                ♠️ <strong>The Hollow's Attention:</strong> ${reading.aceEffect.emoji} ${reading.aceEffect.text} <em>(GM gains 1 SB)</em>
            </div>
        ` : ''}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.5rem;">
            ${reading.cards.map(c => `
                <div style="background:var(--bg2);border-radius:var(--radius);padding:0.6rem;border-left:4px solid ${c.color};">
                    <div style="font-size:0.75rem;color:var(--text3);">${c.position.icon} ${c.position.label}</div>
                    <div style="font-size:0.8rem;font-style:italic;color:var(--text2);margin:0.15rem 0;">${c.position.prompt}</div>
                    <div style="font-weight:bold;margin-top:0.2rem;">${getRankName(c.card.rank)} ${c.symbol} of ${getSuitName(c.card.suit)}</div>
                    <div style="margin-top:0.2rem;">${c.meaning}</div>
                    ${c.faceNote ? `<div style="margin-top:0.3rem;font-size:0.75rem;color:var(--text3);">${c.faceNote}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;
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
            showToast(`⏱️ Opening Timer Editor...`, 'info');
        } else {
            const createdTimer = addTimer({ name: timerName, segments, current: 0 });
            document.dispatchEvent(new CustomEvent('timer-added', { detail: { timer: createdTimer } }));
            showToast(`⏱️ Timer created: ${createdTimer.name} (${segments} segments)`, 'success');
        }
    }).catch(() => {
        const createdTimer = addTimer({ name: timerName, segments, current: 0 });
        document.dispatchEvent(new CustomEvent('timer-added', { detail: { timer: createdTimer } }));
        showToast(`⏱️ Timer created: ${createdTimer.name} (${segments} segments)`, 'success');
    });

    if (typeof logRecordingEvent === 'function') {
        logRecordingEvent('travel_timer_created', `Timer created: ${timerName} (${segments} segments)`);
    }
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
                
                const required = ['startRegion', 'destRegion', 'legs', 'totalSegments', 'numLegs', 'timestamp'];
                const missing = required.filter(field => !(field in data));
                if (missing.length > 0) {
                    showToast(`Invalid journey file: missing fields: ${missing.join(', ')}`, 'error');
                    document.body.removeChild(input);
                    return;
                }
                
                if (!Array.isArray(data.legs) || data.legs.length === 0) {
                    showToast('Invalid journey file: legs must be a non-empty array.', 'error');
                    document.body.removeChild(input);
                    return;
                }
                
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
                
                if (!data.aceEffects) data.aceEffects = [];
                
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
        title.textContent = journey.itineraryName
            ? `🗒️ Worked Itinerary: ${journey.itineraryName}`
            : `🗺️ Journey: ${journey.startRegion} → ${journey.destRegion}`;
    }
    const meta = document.getElementById('travel-journey-meta');
    if (meta) {
        meta.innerHTML = `
            <span>Legs: ${journey.numLegs}</span>
            <span style="margin-left:1rem;">Total Timer: ${journey.totalSegments} segments</span>
            <span style="margin-left:1rem;">Highest Card: ${journey.highestCard}</span>
            ${journey.itineraryName ? '' : `
                <span style="margin-left:1rem;">♣ Pressure from: ${journey.policedRoute ? journey.destRegion + ' (policed)' : 'The Wilds'}</span>
                <span style="margin-left:1rem;">♦ Gateway: ${journey.gatewayRegion}</span>
            `}
            ${journey.aceEffects && journey.aceEffects.length > 0 ? `<span style="margin-left:1rem;color:var(--gold);">♠️ ${journey.aceEffects.length} Ace effect(s) — the Hollow's Attention (GM +${journey.aceEffects.length} SB)</span>` : ''}
        `;
    }
    
    const legsContainer = document.getElementById('travel-journey-legs');
    if (legsContainer) {
        legsContainer.innerHTML = journey.legs.map((leg, idx) => {
            const hasAce = !!leg.aceEffect;
            return `
            <div style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;margin-bottom:0.5rem;border-left:4px solid ${hasAce ? 'var(--gold)' : 'var(--border)'};">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                    <strong style="font-size:1rem;">${leg.legLabel ? `Leg ${idx+1}: ${leg.legLabel}` : `Leg ${idx+1}`}</strong>
                    <span style="font-size:0.8rem;color:var(--text3);">Timer: ${leg.timerSegments} segments (${leg.timerCard})</span>
                </div>
                ${leg.legFlavor ? `<div style="font-size:0.8rem;font-style:italic;color:var(--text2);margin-top:0.15rem;">${leg.legFlavor}</div>` : ''}
                ${hasAce ? `
                    <div style="margin:0.3rem 0;padding:0.2rem 0.6rem;background:var(--bg4);border-radius:var(--radius);border:1px solid var(--gold);color:var(--gold);font-size:0.85rem;">
                        ♠️ <strong>The Hollow's Attention:</strong> ${leg.aceEffect.emoji} ${leg.aceEffect.text} <em>(GM gains ${leg.aceCount} SB)</em>
                    </div>
                ` : ''}
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.5rem;margin-top:0.3rem;">
                    <div style="background:var(--bg3);padding:0.3rem 0.5rem;border-radius:4px;border-left:3px solid ${leg.cardDetails.spade.color};">
                        <span style="font-weight:bold;">♠ Place:</span> ${leg.place}
                        <div style="font-size:0.7rem;color:var(--text3);">from ${leg.spadeSource}</div>
                        ${leg.cardDetails.spade.faceNote ? `<div style="margin-top:0.2rem;font-size:0.7rem;color:var(--text3);">${leg.cardDetails.spade.faceNote}</div>` : ''}
                    </div>
                    <div style="background:var(--bg3);padding:0.3rem 0.5rem;border-radius:4px;border-left:3px solid ${leg.cardDetails.heart.color};">
                        <span style="font-weight:bold;">♥ Actor:</span> ${leg.actor}
                        <div style="font-size:0.7rem;color:var(--text3);">from ${leg.heartSource}</div>
                        ${leg.cardDetails.heart.faceNote ? `<div style="margin-top:0.2rem;font-size:0.7rem;color:var(--text3);">${leg.cardDetails.heart.faceNote}</div>` : ''}
                    </div>
                    <div style="background:var(--bg3);padding:0.3rem 0.5rem;border-radius:4px;border-left:3px solid ${leg.cardDetails.club.color};">
                        <span style="font-weight:bold;">♣ Pressure:</span> ${leg.pressure}
                        <div style="font-size:0.7rem;color:var(--text3);">from ${leg.clubSource}</div>
                        ${leg.cardDetails.club.faceNote ? `<div style="margin-top:0.2rem;font-size:0.7rem;color:var(--text3);">${leg.cardDetails.club.faceNote}</div>` : ''}
                    </div>
                    <div style="background:var(--bg3);padding:0.3rem 0.5rem;border-radius:4px;border-left:3px solid ${leg.cardDetails.diamond.color};">
                        <span style="font-weight:bold;">♦ Leverage:</span> ${leg.leverage}
                        <div style="font-size:0.7rem;color:var(--text3);">from ${leg.diamondSource}</div>
                        ${leg.cardDetails.diamond.faceNote ? `<div style="margin-top:0.2rem;font-size:0.7rem;color:var(--text3);">${leg.cardDetails.diamond.faceNote}</div>` : ''}
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
    
    // Fix: Calculate the real index using the map callback to avoid O(n²) lookups and broken references
    el.innerHTML = journeyHistory.slice().reverse().map((j, revIdx) => {
        const realIdx = journeyHistory.length - 1 - revIdx;
        const aceCount = j.aceEffects ? j.aceEffects.length : 0;
        return `
        <div style="padding:0.3rem 0;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;">
            <span style="color:var(--text3);font-size:0.7rem;">[${new Date(j.timestamp).toLocaleTimeString()}]</span>
            <span style="font-weight:500;">${j.startRegion} → ${j.destRegion}</span>
            <span style="font-size:0.8rem;color:var(--text2);">(${j.numLegs} legs, ${j.totalSegments} segments)</span>
            ${aceCount > 0 ? `<span style="color:var(--gold);font-size:0.8rem;">♠️ ${aceCount} Ace</span>` : ''}
            <button class="btn btn-xs btn-ghost" data-journey-index="${realIdx}" style="margin-left:auto;">👁️ View</button>
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
    const headerLabel = journey.itineraryName
        ? `Worked Itinerary: ${journey.itineraryName}`
        : `Journey from ${journey.startRegion} to ${journey.destRegion}`;
    let summary = `${headerLabel}\n`;
    summary += `Legs: ${journey.numLegs}\n`;
    summary += `Total Timer: ${journey.totalSegments} segments\n`;
    if (journey.aceEffects && journey.aceEffects.length > 0) {
        summary += `♠️ Ace Effects (The Hollow's Attention):\n`;
        journey.aceEffects.forEach(e => summary += `  ${e.emoji || '🃏'} ${stripHtml(e.text || 'The Hollow takes notice.')}\n`);
    }
    summary += `\n`;
    journey.legs.forEach((leg, i) => {
        summary += `${leg.legLabel || `Leg ${i+1}`}:\n`;
        summary += `  Place: ${stripHtml(leg.place)}\n`;
        summary += `  Actor: ${stripHtml(leg.actor)}\n`;
        summary += `  Pressure: ${stripHtml(leg.pressure)}\n`;
        summary += `  Leverage: ${stripHtml(leg.leverage)}\n`;
        summary += `  Timer: ${leg.timerSegments} segments (${leg.timerCard})\n`;
        if (leg.aceEffect) {
            summary += `  ♠️ Ace Effect: ${leg.aceEffect.emoji || '🃏'} ${stripHtml(leg.aceEffect.text || 'The Hollow takes notice.')}\n`;
        }
        summary += `\n`;
    });
    return summary.trimEnd();
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
