"""
Shared constants and configuration for the Fate's Edge Python client.

Single source of truth for values that used to be scattered/duplicated
across the old single-file script (e.g. the default server URL was
hardcoded independently in ~7 different argparse subparsers).
"""

from pathlib import Path

# ----------------------------------------------------------------------
# Package metadata
# ----------------------------------------------------------------------

__version__ = "5.0.0"

# ----------------------------------------------------------------------
# Server defaults
# ----------------------------------------------------------------------

# Matches the socket server's default port (see utilities/javascript/
# fates-edge-socket-server). The old client defaulted to :3000 in several
# places, which never matched the server's actual default of :10000.
DEFAULT_SERVER_URL = "http://localhost:10000"

# ----------------------------------------------------------------------
# Local data storage
# ----------------------------------------------------------------------

DEFAULT_DATA_DIR = Path.home() / ".fates_edge"
DEFAULT_DATA_PATH = DEFAULT_DATA_DIR / "data.json"

# ----------------------------------------------------------------------
# Character rules constants
# ----------------------------------------------------------------------

ALL_SKILLS = [
    'Melee', 'Ranged', 'Brawl', 'Tactics', 'Athletics', 'Stealth',
    'Endurance', 'Craft', 'Survival', 'Sway', 'Command', 'Deception',
    'Performance', 'Insight', 'Lore', 'Investigation', 'Medicine',
    'Arcana', 'Ritual'
]

BASE_START_XP = 32
MAX_START_XP = 36

# ----------------------------------------------------------------------
# Deck constants
# ----------------------------------------------------------------------

DECK_SUITS = ['hearts', 'spades', 'clubs', 'diamonds']
DECK_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
SUIT_SYMBOLS = {'hearts': '♥', 'spades': '♠', 'clubs': '♣', 'diamonds': '♦'}
SUIT_COLORS = {'hearts': '#c0392b', 'spades': '#2c3e50', 'clubs': '#27ae60', 'diamonds': '#2980b9'}
SUIT_NAMES = {'hearts': 'Hearts', 'spades': 'Spades', 'clubs': 'Clubs', 'diamonds': 'Diamonds'}
RANK_NAMES = {
    'A': 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
    '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten',
    'J': 'Jack', 'Q': 'Queen', 'K': 'King'
}

# Same suit -> "what this card represents" framing the server's deck.js
# uses for its region-data transform and for the generic fallback text.
SUIT_ARCHETYPES = {
    'hearts': {'label': 'Actor', 'desc': 'a person, faction, or relationship that drives the scene'},
    'spades': {'label': 'Location', 'desc': 'a place, terrain, or environmental feature'},
    'clubs': {'label': 'Complication', 'desc': 'an obstacle, danger, or twist'},
    'diamonds': {'label': 'Reward/Leverage', 'desc': 'a resource, opportunity, or material gain'},
}

# Rank -> narrative "weight" tier + suggested clock length, also mirrored
# from the server's deck.js so a local `deck --draw` gives the same shape
# of answer a server-connected session would.
RANK_TIERS = {
    '2': {'tier': 'Minor', 'segments': 4},
    '3': {'tier': 'Minor', 'segments': 4},
    '4': {'tier': 'Minor', 'segments': 4},
    '5': {'tier': 'Minor', 'segments': 4},
    '6': {'tier': 'Medium', 'segments': 6},
    '7': {'tier': 'Medium', 'segments': 6},
    '8': {'tier': 'Medium', 'segments': 6},
    '9': {'tier': 'Medium', 'segments': 6},
    '10': {'tier': 'Major', 'segments': 8},
    'J': {'tier': 'Major', 'segments': 8},
    'Q': {'tier': 'Major', 'segments': 8},
    'K': {'tier': 'Major', 'segments': 8},
    'A': {'tier': 'Ace', 'segments': 10},
}

DEFAULT_TWISTS = [
    "A sudden storm or environmental shift changes the scene.",
    "An unexpected ally appears with conflicting motives.",
    "A minor curse or blessing from a Patron alters the odds.",
    "A forgotten debt is called in at the worst moment.",
    "The ground beneath you gives way—literal or figurative.",
    "A piece of evidence surfaces that reframes everything.",
    "A rival's plan backfires, creating chaos for everyone.",
    "A moment of clarity reveals a hidden truth.",
]

# Bundled copy of the region flavor-text data (utilities/javascript/
# fates-edge-socket-server/data/regions/*.json) so `deck --draw` works
# fully offline, the same way characters/timers/rolls already do. See
# deck.py's region-data loader for the transform that turns these files
# into suit/rank -> meaning lookups.
REGION_DATA_DIR = Path(__file__).parent / "data" / "regions"
