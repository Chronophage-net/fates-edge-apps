"""
Deck of Consequences — pure logic (deck building, region-aware card
meanings, Crown Spread synthesis). No I/O beyond reading the bundled
region JSON files, and that's cached after first load.

FIXED relative to the old single-file client: `cmd_deck`'s `--draw` and
`--crown` handlers used to pass an empty `region_data = {}` placeholder
into the synthesis functions (see the old file's comments "Load region
data (simplified - would need actual region data)"), so every card
meaning silently fell back to the generic "A complication of {suit}
arises" line regardless of which `--region` was requested. This module
actually loads and transforms the same region JSON files the server and
web client use (bundled under fates_edge_client/data/regions/), using
the same transform the server's deck.js applies, so region flavor text
now really is region-specific offline.
"""

import json
import random
import time
from pathlib import Path
from typing import Dict, List, Optional

from .config import (
    DECK_SUITS, DECK_RANKS, RANK_NAMES, SUIT_NAMES, SUIT_ARCHETYPES,
    RANK_TIERS, DEFAULT_TWISTS, REGION_DATA_DIR,
)
from .models import Card, DeckState

# ----------------------------------------------------------------------
# Deck building
# ----------------------------------------------------------------------

def build_deck() -> List[Card]:
    """Build a standard Fate's Edge deck (52 cards + 2 jokers), shuffled."""
    cards = []
    for suit in DECK_SUITS:
        for rank in DECK_RANKS:
            cards.append(Card(suit=suit, rank=rank))
    cards.append(Card(suit='joker', rank='Red', is_joker=True, symbol='🃏', suit_name='Joker', rank_name='Red'))
    cards.append(Card(suit='joker', rank='Black', is_joker=True, symbol='🃏', suit_name='Joker', rank_name='Black'))
    random.shuffle(cards)
    return cards


def ensure_deck(deck: DeckState, min_cards: int = 1) -> None:
    """Rebuild the deck in place if it's missing or too low to satisfy
    `min_cards`. Shared by draw/crown so both behave identically when the
    deck runs out mid-session."""
    if not deck.cards or len(deck.cards) < min_cards:
        deck.cards = build_deck()


def draw_cards(deck: DeckState, count: int) -> List[Card]:
    """Draw `count` cards from the deck, rebuilding as needed if it runs
    out mid-draw (matches the server's behavior of never blocking a draw
    on an empty deck)."""
    ensure_deck(deck, count)
    drawn = []
    for _ in range(count):
        if not deck.cards:
            deck.cards = build_deck()
        drawn.append(deck.cards.pop())
    return drawn


# ----------------------------------------------------------------------
# Region data loading + transform
# ----------------------------------------------------------------------
#
# Ported from the server's server/deck.js transformRegionData() /
# getCardMeaningFromRegion() so a fully offline `deck --draw` produces
# the same shape of region-flavored text a server-connected session
# would get. Region source files (data/regions/*.json) are the rich,
# hand-authored region documents (overview, people_and_factions, places,
# complications, rewards, ...) -- suit meanings are derived from four of
# those sections:
#
#   spades   <- places                (Location)
#   hearts   <- people_and_factions   (Actor)
#   clubs    <- complications         (Complication)
#   diamonds <- rewards               (Reward/Leverage)

_SUIT_SOURCE_KEY = {
    'spades': 'places',
    'hearts': 'people_and_factions',
    'clubs': 'complications',
    'diamonds': 'rewards',
}

_region_cache: Dict[str, Dict] = {}


def _map_numeric_rank(rank) -> str:
    """Region source files key their cards 2-14 (poker-style, Ace high);
    map that back onto this app's rank symbols (2-10, J, Q, K, A)."""
    try:
        num = int(rank)
    except (TypeError, ValueError):
        return str(rank)
    if 2 <= num <= 10:
        return str(num)
    if num == 11:
        return 'J'
    if num == 12:
        return 'Q'
    if num == 13:
        return 'K'
    if num == 14:
        return 'A'
    return str(num)


def _transform_region_data(raw: Dict) -> Dict:
    """Turn a raw region document into suit -> {rank: meaning} lookups."""
    transformed: Dict = {
        'name': raw.get('title') or raw.get('id') or 'Unknown',
        'spades': {}, 'hearts': {}, 'clubs': {}, 'diamonds': {},
    }

    for suit, source_key in _SUIT_SOURCE_KEY.items():
        items = raw.get(source_key)
        if not isinstance(items, list):
            continue
        for card in items:
            raw_rank = str(card.get('rank', '') or '')
            if not raw_rank:
                continue
            rank_key = _map_numeric_rank(raw_rank)

            meaning = f"{card.get('title', 'Untitled')}: {card.get('description', '')}"
            if card.get('flavor'):
                meaning += f" {card['flavor']}"
            if card.get('mechanical_hook'):
                meaning += f" [Mechanic: {card['mechanical_hook']}]"
            if card.get('what_they_carry'):
                meaning += f" [Carries: {card['what_they_carry']}]"
            if card.get('what_they_ask'):
                meaning += f" [Asks: {card['what_they_ask']}]"
            if card.get('debt'):
                meaning += f" [Debt: {card['debt']}]"
            if card.get('price'):
                meaning += f" [Price: {card['price']}]"
            if card.get('curse_cost'):
                meaning += f" [Cost: {card['curse_cost']}]"
            transformed[suit][rank_key] = meaning

    return transformed


def _fallback_region_data(region_name: str) -> Dict:
    return {
        'name': region_name,
        'hearts': {'A': 'A matter of loyalty or love arises.'},
        'spades': {'A': 'A conflict or struggle emerges.'},
        'clubs': {'A': 'A physical challenge or obstacle appears.'},
        'diamonds': {'A': 'A resource, treasure, or opportunity is found.'},
    }


def _slugify(region_name: str) -> str:
    slug = region_name.lower().replace(' ', '-')
    return ''.join(ch for ch in slug if ch.isalnum() or ch == '-')


def load_region_data(region_name: str, region_dir: Optional[Path] = None) -> Dict:
    """Load + transform a region's card-meaning data, with an in-memory
    cache (mirrors the server's regionCache Map) and a small built-in
    fallback if the region file can't be found or parsed."""
    region_dir = region_dir or REGION_DATA_DIR
    cache_key = f"{region_dir}:{region_name}"
    if cache_key in _region_cache:
        return _region_cache[cache_key]

    slug = _slugify(region_name)
    file_path = region_dir / f"{slug}.json"

    try:
        raw = json.loads(file_path.read_text(encoding='utf-8'))
        data = _transform_region_data(raw)
    except (OSError, ValueError):
        data = _fallback_region_data(region_name)

    _region_cache[cache_key] = data
    return data


# ----------------------------------------------------------------------
# Card meaning synthesis
# ----------------------------------------------------------------------

def _stable_hash(seed: str) -> int:
    """Same simple string hash the server and old client both use, kept
    for parity so the same seed produces the same twist/wildcard pick."""
    h = 0
    for ch in seed:
        h = ((h << 5) - h) + ord(ch)
        h &= 0xFFFFFFFF
    if h >= 0x80000000:
        h -= 0x100000000
    return h


def get_card_meaning_from_region(suit: str, rank: str, region_data: Dict) -> str:
    """Region-aware card meaning, with a generic archetype-flavored
    fallback if this specific suit/rank isn't authored in the region
    data (mirrors the server's getCardMeaningFromRegion)."""
    rank_name = RANK_NAMES.get(rank, rank)
    suit_name = SUIT_NAMES.get(suit, suit)
    archetype = SUIT_ARCHETYPES.get(suit, {'label': 'Element', 'desc': 'a force'})
    tier_info = RANK_TIERS.get(rank, {'tier': 'Minor', 'segments': 4})
    tier, segments = tier_info['tier'], tier_info['segments']

    specific = (region_data or {}).get(suit, {}).get(rank)
    if not specific:
        return (
            f"{rank_name} of {suit_name} ({archetype['label']} – {tier}): "
            f"A {archetype['label'].lower()} arises. {archetype['desc']}. "
            f"This card suggests a {tier.lower()} influence "
            f"({segments}-segment clock if this is the highest card)."
        )

    return f"{rank_name} of {suit_name} ({archetype['label']} – {tier}): {specific} ({segments} segments if highest)."


def get_wildcard_meaning(card: Card) -> str:
    """Twist text for a joker / wildcard draw."""
    seed = (card.suit or 'joker') + (card.rank or '') + str(int(time.time() * 1000) % 1000)
    idx = abs(_stable_hash(seed)) % len(DEFAULT_TWISTS)
    card_name = 'Joker' if card.is_joker else f"{card.rank_name} of {card.suit_name}"
    return f"✨ Twist ({card_name}): {DEFAULT_TWISTS[idx]}"


def synthesise_consequence(cards: List[Card], region_data: Dict) -> str:
    """Combine 1-4 drawn cards into a single consequence/complication
    readout."""
    entries = [
        get_wildcard_meaning(c) if c.is_joker else get_card_meaning_from_region(c.suit, c.rank, region_data)
        for c in cards
    ]
    if len(entries) == 1:
        return entries[0]
    if len(entries) == 2:
        return f"{entries[0]}\n\nThen, {entries[1]}"
    return "\n\n".join(f"{i + 1}. {e}" for i, e in enumerate(entries))


_CROWN_POSITIONS = [
    {'key': 'root', 'label': 'Root', 'icon': '🌱'},
    {'key': 'crest', 'label': 'Crest', 'icon': '🏔️'},
    {'key': 'crown', 'label': 'Crown', 'icon': '👑'},
    {'key': 'left', 'label': 'Left Hand', 'icon': '🤝'},
]


def synthesise_crown_spread(main_cards: List[Card], wildcard: Card, region_data: Dict) -> Dict:
    """Build a 4-position Crown Spread (Root/Crest/Crown/Left Hand) plus
    a wildcard twist, returning both the rendered synthesis text and the
    structured per-position data."""
    position_cards = []
    for pos, card in zip(_CROWN_POSITIONS, main_cards):
        if card.is_joker:
            meaning = "The unexpected. The impossible. A force that does not follow the rules."
        else:
            meaning = get_card_meaning_from_region(card.suit, card.rank, region_data)
        position_cards.append({
            **pos,
            'card': card,
            'meaning': meaning,
            'is_joker': card.is_joker,
            'rank_name': 'Joker' if card.is_joker else card.rank_name,
            'suit_name': '' if card.is_joker else card.suit_name,
            'symbol': '🃏' if card.is_joker else card.symbol,
            'color': '#d4af37' if card.is_joker else card.color,
        })

    wildcard_meaning = get_wildcard_meaning(wildcard)

    synthesis = "The Crown Spread reveals a story of tension and consequence.\n\n"
    synthesis += f"🌱 Root: {position_cards[0]['meaning']}\n\n"
    synthesis += f"🏔️ Crest: {position_cards[1]['meaning']}\n\n"
    synthesis += f"👑 Crown: {position_cards[2]['meaning']}\n\n"
    synthesis += f"🤝 Left Hand: {position_cards[3]['meaning']}\n\n"
    synthesis += f"🌟 Wildcard: {wildcard_meaning}"

    return {
        'synthesis': synthesis,
        'positions': position_cards,
        'wildcard': wildcard_meaning,
    }
