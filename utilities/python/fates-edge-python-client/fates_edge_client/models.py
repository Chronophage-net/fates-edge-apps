"""
Pure data model for the Fate's Edge Python client — cards, decks,
characters, timers, and the message queue used while a WebSocket
connection is down. No I/O, no network, no printing: every class here
should be safe to construct and round-trip through to_dict()/from_dict()
in a unit test with no mocking required.
"""

import time
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

from .config import (
    ALL_SKILLS, BASE_START_XP, SUIT_SYMBOLS, SUIT_NAMES, RANK_NAMES, SUIT_COLORS,
)


@dataclass
class Card:
    suit: str
    rank: str
    symbol: str = ""
    suit_name: str = ""
    rank_name: str = ""
    is_joker: bool = False
    color: str = ""

    def __post_init__(self):
        if not self.symbol and not self.is_joker:
            self.symbol = SUIT_SYMBOLS.get(self.suit, '♦')
        if not self.suit_name and not self.is_joker:
            self.suit_name = SUIT_NAMES.get(self.suit, self.suit)
        if not self.rank_name and not self.is_joker:
            self.rank_name = RANK_NAMES.get(self.rank, self.rank)
        if not self.color and not self.is_joker:
            self.color = SUIT_COLORS.get(self.suit, '#2980b9')
        if self.is_joker:
            self.color = '#d4af37'

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict) -> "Card":
        return cls(**data)


@dataclass
class DeckState:
    cards: List[Card] = field(default_factory=list)
    history: List[Dict] = field(default_factory=list)
    offset: int = 0

    def to_dict(self) -> Dict:
        return {
            "cards": [c.to_dict() for c in self.cards],
            "history": self.history,
            "offset": self.offset,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "DeckState":
        cards = [Card.from_dict(c) for c in data.get("cards", [])]
        return cls(
            cards=cards,
            history=data.get("history", []),
            offset=data.get("offset", 0),
        )


@dataclass
class Character:
    id: int
    name: str = ""
    heritage: str = ""
    background: str = ""
    patron: str = ""
    tier: str = "I"
    xp: int = BASE_START_XP
    body: int = 3
    wits: int = 2
    spirit: int = 1
    presence: int = 1
    skills: Dict[str, int] = field(default_factory=dict)
    talents: List[Dict] = field(default_factory=list)
    assets: List[Dict] = field(default_factory=list)
    equipment: List[Dict] = field(default_factory=list)
    bonds: List[Dict] = field(default_factory=list)
    complications: List[Dict] = field(default_factory=list)
    harm: int = 0
    fatigue: int = 0
    boons: int = 0
    vtt: bool = False

    def __post_init__(self):
        if not self.skills:
            self.skills = {s.lower(): 0 for s in ALL_SKILLS}
        if not self.talents:
            self.talents = []
        if not self.assets:
            self.assets = []
        if not self.equipment:
            self.equipment = []
        if not self.bonds:
            self.bonds = []
        if not self.complications:
            self.complications = []

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict) -> "Character":
        return cls(**data)


@dataclass
class Timer:
    id: int
    name: str
    segments: int
    current: int = 0


@dataclass
class MessageQueue:
    """Buffers outbound WebSocket messages while disconnected, so a
    reconnect can flush them in order instead of silently dropping them."""
    messages: List[Dict] = field(default_factory=list)
    max_size: int = 100

    def enqueue(self, event: str, data: Any) -> None:
        if len(self.messages) < self.max_size:
            self.messages.append({
                "event": event,
                "data": data,
                "timestamp": time.time(),
            })

    def drain(self) -> List[Dict]:
        """Pop and return all queued messages, oldest first."""
        drained = list(self.messages)
        self.messages.clear()
        return drained
