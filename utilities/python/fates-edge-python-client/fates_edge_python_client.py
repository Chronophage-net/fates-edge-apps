#!/usr/bin/env python3
"""
Fate's Edge Toolkit – Python Client
Emulates the mainpage features (characters, timers, dice, campaign server sync) in a CLI.
Usage: python client.py --help
"""

import json
import sys
import os
import argparse
import random
import hashlib
import requests
import asyncio
import websockets
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field, asdict
from collections import defaultdict
import readline
import signal
import logging
import yaml
import itertools

# Version information
__version__ = "1.2.0"

# ----------------------------------------------------------------------
# Logging Setup
# ----------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("fates-edge")

# ----------------------------------------------------------------------
# Constants & Data Model
# ----------------------------------------------------------------------

ALL_SKILLS = [
    'Melee', 'Ranged', 'Brawl', 'Tactics', 'Athletics', 'Stealth',
    'Endurance', 'Craft', 'Survival', 'Sway', 'Command', 'Deception',
    'Performance', 'Insight', 'Lore', 'Investigation', 'Medicine',
    'Arcana', 'Ritual'
]

BASE_START_XP = 32
MAX_START_XP = 36

# Deck constants
DECK_SUITS = ['hearts', 'spades', 'clubs', 'diamonds']
DECK_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
SUIT_SYMBOLS = {'hearts': '♥', 'spades': '♠', 'clubs': '♣', 'diamonds': '♦'}
SUIT_NAMES = {'hearts': 'Hearts', 'spades': 'Spades', 'clubs': 'Clubs', 'diamonds': 'Diamonds'}
RANK_NAMES = {
    'A': 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
    '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten',
    'J': 'Jack', 'Q': 'Queen', 'K': 'King'
}

# ----------------------------------------------------------------------
# Data Classes
# ----------------------------------------------------------------------

@dataclass
class Card:
    suit: str
    rank: str
    symbol: str = ""
    suit_name: str = ""
    rank_name: str = ""
    is_joker: bool = False
    color: str = "#2980b9"

    def __post_init__(self):
        if not self.symbol and not self.is_joker:
            self.symbol = SUIT_SYMBOLS.get(self.suit, '♦')
        if not self.suit_name and not self.is_joker:
            self.suit_name = SUIT_NAMES.get(self.suit, self.suit)
        if not self.rank_name and not self.is_joker:
            self.rank_name = RANK_NAMES.get(self.rank, self.rank)
        if not self.color and not self.is_joker:
            self.color = {'hearts': '#c0392b', 'spades': '#2c3e50', 'clubs': '#27ae60', 'diamonds': '#2980b9'}.get(self.suit, '#2980b9')
        if self.is_joker:
            self.color = '#d4af37'

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, data):
        return cls(**data)

@dataclass
class DeckState:
    cards: List[Card] = field(default_factory=list)
    history: List[Dict] = field(default_factory=list)
    offset: int = 0

    def to_dict(self):
        return {
            "cards": [c.to_dict() for c in self.cards],
            "history": self.history,
            "offset": self.offset
        }

    @classmethod
    def from_dict(cls, data):
        cards = [Card.from_dict(c) for c in data.get("cards", [])]
        return cls(
            cards=cards,
            history=data.get("history", []),
            offset=data.get("offset", 0)
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

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, data):
        return cls(**data)

@dataclass
class Timer:
    id: int
    name: str
    segments: int
    current: int = 0

@dataclass
class MessageQueue:
    messages: List[Dict] = field(default_factory=list)
    max_size: int = 100
    
    def enqueue(self, event: str, data: Any):
        if len(self.messages) < self.max_size:
            self.messages.append({
                "event": event, 
                "data": data, 
                "timestamp": time.time()
            })
    
    def flush(self, ws_client):
        for msg in self.messages:
            asyncio.create_task(ws_client.send_message(msg["event"], msg["data"]))
        self.messages.clear()

@dataclass
class DataStore:
    version: int = 5
    characters: List[Character] = field(default_factory=list)
    timers: List[Timer] = field(default_factory=list)
    wiki: List[Dict] = field(default_factory=list)
    rollHistory: List[Dict] = field(default_factory=list)
    talents: List[Dict] = field(default_factory=list)
    chatHistory: List[Dict] = field(default_factory=list)
    encounters: List[Dict] = field(default_factory=list)
    npcs: List[Dict] = field(default_factory=list)
    deck: DeckState = field(default_factory=DeckState)
    passwordHash: Optional[str] = None
    baseUrl: str = ""
    apiKey: str = ""
    _nextId: int = 1
    _nextTalentId: int = 1
    _nextEncounterId: int = 1
    _nextNpcId: int = 1

    def to_dict(self):
        return {
            "version": self.version,
            "characters": [c.to_dict() for c in self.characters],
            "timers": [asdict(t) for t in self.timers],
            "wiki": self.wiki,
            "rollHistory": self.rollHistory,
            "talents": self.talents,
            "chatHistory": self.chatHistory,
            "encounters": self.encounters,
            "npcs": self.npcs,
            "deck": self.deck.to_dict() if self.deck else DeckState().to_dict(),
            "passwordHash": self.passwordHash,
            "baseUrl": self.baseUrl,
            "apiKey": self.apiKey,
            "_nextId": self._nextId,
            "_nextTalentId": self._nextTalentId,
            "_nextEncounterId": self._nextEncounterId,
            "_nextNpcId": self._nextNpcId,
        }

    @classmethod
    def from_dict(cls, data):
        chars = [Character.from_dict(c) for c in data.get("characters", [])]
        timers = [Timer(**t) for t in data.get("timers", [])]
        deck_data = data.get("deck", {})
        deck = DeckState.from_dict(deck_data) if deck_data else DeckState()
        store = cls(
            characters=chars,
            timers=timers,
            wiki=data.get("wiki", []),
            rollHistory=data.get("rollHistory", []),
            talents=data.get("talents", []),
            chatHistory=data.get("chatHistory", []),
            encounters=data.get("encounters", []),
            npcs=data.get("npcs", []),
            deck=deck,
            passwordHash=data.get("passwordHash"),
            baseUrl=data.get("baseUrl", ""),
            apiKey=data.get("apiKey", ""),
            _nextId=data.get("_nextId", 1),
            _nextTalentId=data.get("_nextTalentId", 1),
            _nextEncounterId=data.get("_nextEncounterId", 1),
            _nextNpcId=data.get("_nextNpcId", 1),
        )
        return store

# ----------------------------------------------------------------------
# Storage
# ----------------------------------------------------------------------

DEFAULT_DATA_PATH = Path.home() / ".fates_edge" / "data.json"

def load_data(path: Path = DEFAULT_DATA_PATH) -> DataStore:
    """Load data from JSON file, creating default if missing."""
    if not path.exists():
        return DataStore()
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return DataStore.from_dict(data)
    except Exception as e:
        logger.warning(f"Failed to load data: {e}")
        return DataStore()

def save_data(store: DataStore, path: Path = DEFAULT_DATA_PATH):
    """Save data to JSON file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(store.to_dict(), f, indent=2, ensure_ascii=False)

# ----------------------------------------------------------------------
# XP Cost Helpers
# ----------------------------------------------------------------------

def attr_cost(rating: int) -> int:
    total = 0
    for i in range(2, rating + 1):
        total += i * 3
    return total

def skill_cost(level: int) -> int:
    total = 0
    for i in range(1, level + 1):
        total += i * 2
    return total

# ----------------------------------------------------------------------
# Deck Helpers
# ----------------------------------------------------------------------

def build_deck() -> List[Card]:
    """Build a standard Fate's Edge deck with jokers."""
    cards = []
    for suit in DECK_SUITS:
        for rank in DECK_RANKS:
            cards.append(Card(suit=suit, rank=rank))
    # Add two jokers
    cards.append(Card(suit='joker', rank='Red', is_joker=True, symbol='🃏', suit_name='Joker', rank_name='Red'))
    cards.append(Card(suit='joker', rank='Black', is_joker=True, symbol='🃏', suit_name='Joker', rank_name='Black'))
    
    # Shuffle
    random.shuffle(cards)
    return cards

def get_card_meaning_from_region(suit: str, rank: str, region_data: Dict) -> str:
    """Get card meaning from region data."""
    if not region_data or suit not in region_data:
        return f"A complication of {suit} arises."
    
    arr = region_data.get(suit, [])
    if not arr:
        return f"A complication of {suit} arises."
    
    seed = suit + rank + str(int(time.time() * 1000) % 1000)
    hash_val = 0
    for char in seed:
        hash_val = ((hash_val << 5) - hash_val) + ord(char)
        hash_val = hash_val & hash_val
    
    index = abs(hash_val) % len(arr)
    return arr[index]

def get_wildcard_meaning(card: Card) -> str:
    """Get wildcard meaning for joker or wildcard card."""
    twists = [
        "A sudden storm or environmental shift changes the scene.",
        "An unexpected ally appears with conflicting motives.",
        "A minor curse or blessing from a Patron alters the odds.",
        "A forgotten debt is called in at the worst moment.",
        "The ground beneath you gives way—literal or figurative.",
        "A piece of evidence surfaces that reframes everything.",
        "A rival's plan backfires, creating chaos for everyone.",
        "A moment of clarity reveals a hidden truth.",
    ]
    seed = (card.suit or 'joker') + (card.rank or '') + str(int(time.time() * 1000) % 1000)
    hash_val = 0
    for char in seed:
        hash_val = ((hash_val << 5) - hash_val) + ord(char)
        hash_val = hash_val & hash_val
    
    idx = abs(hash_val) % len(twists)
    card_name = 'Joker' if card.is_joker else f"{card.rank_name} of {card.suit_name}"
    return f"✨ Twist ({card_name}): {twists[idx]}"

def synthesise_consequence(cards: List[Card], region_data: Dict) -> str:
    """Synthesise a consequence from drawn cards."""
    entries = []
    for c in cards:
        if c.is_joker:
            entries.append(get_wildcard_meaning(c))
        else:
            entries.append(get_card_meaning_from_region(c.suit, c.rank, region_data))
    
    if len(entries) == 1:
        return entries[0]
    elif len(entries) == 2:
        return f"{entries[0]}\n\nThen, {entries[1]}"
    else:
        return "\n\n".join(f"{i+1}. {e}" for i, e in enumerate(entries))

def synthesise_crown_spread(main_cards: List[Card], wildcard: Card, region_data: Dict) -> Dict:
    """Synthesise a crown spread."""
    positions = [
        {'key': 'root', 'label': 'Root', 'icon': '🌱'},
        {'key': 'crest', 'label': 'Crest', 'icon': '🏔️'},
        {'key': 'crown', 'label': 'Crown', 'icon': '👑'},
        {'key': 'left', 'label': 'Left Hand', 'icon': '🤝'}
    ]
    
    position_cards = []
    for i, card in enumerate(main_cards):
        pos = positions[i]
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
            'color': '#d4af37' if card.is_joker else card.color
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
        'wildcard': wildcard_meaning
    }

# ----------------------------------------------------------------------
# Dice Roller
# ----------------------------------------------------------------------

def roll_d10() -> int:
    return random.randint(1, 10)

def perform_roll(attr: int, skill: int, dv: int, pos: str, boons: int) -> Dict:
    """Perform a Fate's Edge roll. Returns result dict."""
    pool = attr + skill
    if pool < 1:
        raise ValueError("Pool must be at least 1")
    dice = [roll_d10() for _ in range(pool)]

    # Position
    if pos == 'dominant':
        for i, d in enumerate(dice):
            if d < 6:
                dice[i] = roll_d10()
                break
    elif pos == 'desperate':
        for i, d in enumerate(dice):
            if d >= 6:
                dice[i] = roll_d10()
                break

    # Boons (re-roll lowest failures)
    boons_used = 0
    while boons_used < boons:
        min_idx = min(range(len(dice)), key=lambda i: dice[i])
        if dice[min_idx] >= 6:
            break
        dice[min_idx] = roll_d10()
        boons_used += 1

    successes = sum(1 for d in dice if d >= 6) + sum(1 for d in dice if d == 10)
    sb = sum(1 for d in dice if d == 1)

    # Outcome
    if successes >= dv and sb == 0:
        outcome = 'Clean Success'
        outcome_class = 'outcome-clean'
        result_text = 'You succeed without cost.'
    elif successes >= dv and sb > 0:
        outcome = 'Success with SB'
        outcome_class = 'outcome-sb'
        result_text = f'You succeed, but the GM gains {sb} Story Beat{"" if sb==1 else "s"}.'
    elif 0 < successes < dv:
        outcome = 'Partial'
        outcome_class = 'outcome-partial'
        result_text = 'You make progress. Gain 1 Boon.'
    else:
        outcome = 'Miss'
        outcome_class = 'outcome-miss'
        result_text = 'You fail and things get worse. Gain 2 Boons.'

    return {
        'attr': attr,
        'skill': skill,
        'dv': dv,
        'pos': pos,
        'boons': boons,
        'boons_used': boons_used,
        'pool': pool,
        'dice': dice,
        'successes': successes,
        'sb': sb,
        'outcome': outcome,
        'outcome_class': outcome_class,
        'result_text': result_text,
        'time': datetime.now().isoformat(),
    }

# ----------------------------------------------------------------------
# Progress Indicator
# ----------------------------------------------------------------------

async def with_spinner(coro, message="Processing"):
    """Run coroutine with spinner animation."""
    spinner = itertools.cycle(['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'])
    task = asyncio.create_task(coro)
    
    while not task.done():
        sys.stdout.write(f'\r{next(spinner)} {message}')
        sys.stdout.flush()
        await asyncio.sleep(0.1)
    
    result = await task
    sys.stdout.write('\r✅ Done!      \n')
    return result

# ----------------------------------------------------------------------
# Campaign Server Client
# ----------------------------------------------------------------------

class CampaignServer:
    def __init__(self, base_url: str = "http://localhost:3000", api_key: str = ""):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key or os.environ.get("FATES_EDGE_API_KEY", "")
        self.headers = {"X-API-Key": self.api_key} if self.api_key else {}

    async def _request(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """Make an API request."""
        url = f"{self.base_url}{endpoint}"
        if method == 'GET':
            resp = requests.get(url, headers=self.headers)
        elif method == 'POST':
            resp = requests.post(url, json=data, headers=self.headers)
        elif method == 'PUT':
            resp = requests.put(url, json=data, headers=self.headers)
        elif method == 'DELETE':
            resp = requests.delete(url, headers=self.headers)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        resp.raise_for_status()
        return resp.json()

    async def upload(self, data: Dict) -> str:
        """Upload data, returns campaign code."""
        result = await self._request('POST', '/api/rooms', data)
        return result['code']

    async def load(self, code: str) -> Dict:
        """Load campaign data by code."""
        return await self._request('GET', f'/api/rooms/{code}')

    async def delete(self, code: str) -> bool:
        """Delete campaign by code."""
        await self._request('DELETE', f'/api/rooms/{code}')
        return True

    async def get_state(self, code: str) -> Dict:
        """Get room state."""
        return await self._request('GET', f'/api/rooms/{code}/state')

    async def sync_state(self, code: str, state: Dict) -> Dict:
        """Sync room state."""
        return await self._request('PUT', f'/api/rooms/{code}/state', state)

    async def send_chat(self, code: str, message: str, sender: str = "CLI") -> Dict:
        """Send chat message."""
        payload = {"message": message, "sender": sender}
        return await self._request('POST', f'/api/rooms/{code}/chat', payload)

    async def get_chat_history(self, code: str) -> List[Dict]:
        """Get chat history."""
        result = await self._request('GET', f'/api/rooms/{code}/chat')
        return result.get('messages', [])

    async def roll_dice(self, code: str, roll: str, reason: str = "CLI Roll") -> Dict:
        """Roll dice via API."""
        payload = {"roll": roll, "reason": reason}
        return await self._request('POST', f'/api/rooms/{code}/roll', payload)

    # ============================================================
    # DECK API METHODS
    # ============================================================

    async def get_deck(self, code: str) -> Dict:
        """Get deck state."""
        return await self._request('GET', f'/api/rooms/{code}/deck')

    async def shuffle_deck(self, code: str) -> Dict:
        """Shuffle the deck."""
        return await self._request('POST', f'/api/rooms/{code}/deck/shuffle')

    async def draw_cards(self, code: str, count: int = 1, region: str = 'Acasia') -> Dict:
        """Draw cards from the deck."""
        payload = {"count": count, "region": region}
        return await self._request('POST', f'/api/rooms/{code}/deck/draw', payload)

    async def crown_spread(self, code: str, region: str = 'Acasia') -> Dict:
        """Perform a Crown Spread."""
        payload = {"region": region}
        return await self._request('POST', f'/api/rooms/{code}/deck/crown', payload)

    async def get_deck_history(self, code: str, limit: int = 50) -> Dict:
        """Get deck history."""
        return await self._request('GET', f'/api/rooms/{code}/deck/history?limit={limit}')

    async def clear_deck_history(self, code: str) -> Dict:
        """Clear deck history."""
        return await self._request('DELETE', f'/api/rooms/{code}/deck/history')

    # ============================================================
    # MODULE API METHODS
    # ============================================================

    async def list_modules(self) -> Dict:
        """List available modules."""
        return await self._request('GET', '/api/modules')

    async def push_module(self, module_id: str, room_code: str = None) -> Dict:
        """Push a module to clients."""
        payload = {}
        if room_code:
            payload['roomCode'] = room_code
        return await self._request('POST', f'/api/modules/{module_id}/push', payload)

    async def cleanup_module(self, module_id: str, room_code: str = None) -> Dict:
        """Cleanup a module from clients."""
        payload = {}
        if room_code:
            payload['roomCode'] = room_code
        return await self._request('POST', f'/api/modules/{module_id}/cleanup', payload)

# ----------------------------------------------------------------------
# WebSocket Client
# ----------------------------------------------------------------------

class WebSocketClient:
    def __init__(self, server_url: str, api_key: str, room_code: str):
        self.server_url = server_url
        self.api_key = api_key
        self.room_code = room_code
        self.websocket = None
        self.connected = False
        self.running = False
        self.listeners = defaultdict(list)
        self.client_data = {"name": "CLI Client", "type": "cli"}
        self.message_queue = MessageQueue()
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5

    async def connect_with_retry(self, max_retries=5):
        """Connect with automatic retry logic."""
        retries = 0
        while retries < max_retries:
            try:
                await self.connect()
                self.reconnect_attempts = 0
                return True
            except Exception as e:
                retries += 1
                wait = min(2 ** retries, 30)
                logger.warning(f"Connection failed, retrying in {wait}s...")
                await asyncio.sleep(wait)
        return False

    async def connect(self):
        """Connect to WebSocket server."""
        try:
            ws_url = self.server_url.replace("http://", "ws://").replace("https://", "wss://")
            self.websocket = await websockets.connect(
                f"{ws_url}?EIO=4&transport=websocket",
                extra_headers={"X-API-Key": self.api_key}
            )
            self.connected = True
            self.running = True
            logger.info("Connected to WebSocket server")
            await self._listen()
        except Exception as e:
            logger.error(f"WebSocket connection failed: {e}")
            self.connected = False
            raise

    async def _listen(self):
        """Listen for incoming messages."""
        try:
            async for message in self.websocket:
                await self._handle_message(message)
        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed")
            self.connected = False
            await self._reconnect()
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
            self.connected = False

    async def _reconnect(self):
        """Attempt to reconnect with exponential backoff."""
        if self.reconnect_attempts < self.max_reconnect_attempts:
            self.reconnect_attempts += 1
            wait = min(2 ** self.reconnect_attempts, 30)
            logger.info(f"Reconnecting in {wait}s... (attempt {self.reconnect_attempts})")
            await asyncio.sleep(wait)
            await self.connect_with_retry()

    async def _handle_message(self, message):
        """Handle incoming WebSocket messages."""
        if isinstance(message, str) and message.startswith("42"):
            try:
                payload = json.loads(message[2:])
                event_type = payload[0]
                data = payload[1] if len(payload) > 1 else {}
                
                for callback in self.listeners[event_type]:
                    await callback(data)
                    
                if event_type == "chat-message":
                    sender = data.get("sender", "Unknown")
                    text = data.get("text", "")
                    timestamp = datetime.fromtimestamp(data.get("timestamp", 0)/1000).strftime("%H:%M")
                    print(f"\n[CHAT] [{timestamp}] {sender}: {text}")
                elif event_type == "roll-result":
                    sender = data.get("sender", "Unknown")
                    expr = data.get("expr", "")
                    result = data.get("result", 0)
                    print(f"\n[DICE] {sender} rolled {expr} = {result}")
                elif event_type == "deck-drawn":
                    cards = data.get("cards", [])
                    synthesis = data.get("synthesis", "")
                    region = data.get("region", "Unknown")
                    print(f"\n[DECK] Drew {len(cards)} cards from {region}")
                    print(f"  {synthesis}")
                elif event_type == "deck-shuffled":
                    remaining = data.get("remaining", 0)
                    print(f"\n[DECK] Deck shuffled. {remaining} cards remaining.")
                elif event_type == "crown-spread":
                    result = data.get("result", {})
                    print(f"\n[CROWN] 👑 Crown Spread")
                    print(f"  {result.get('synthesis', '')}")
                elif event_type == "state-updated":
                    print(f"\n[SYNC] State updated by {data.get('updatedBy', 'Unknown')}")
                elif event_type == "module-push":
                    module = data.get("module", {})
                    manifest = module.get("manifest", {})
                    print(f"\n[MODULE] Module pushed: {manifest.get('name', module.get('id', 'Unknown'))}")
                elif event_type == "module-cleanup":
                    module_id = data.get("moduleId", "Unknown")
                    print(f"\n[MODULE] Module cleanup requested: {module_id}")
            except json.JSONDecodeError:
                pass
        elif message == "2":
            await self.websocket.send("3")

    async def join_room(self):
        """Join the specified room."""
        if not self.connected:
            return False
            
        try:
            join_msg = ["join-room", self.room_code, self.client_data]
            await self.websocket.send(f"42{json.dumps(join_msg)}")
            logger.info(f"Joined room {self.room_code}")
            return True
        except Exception as e:
            logger.error(f"Failed to join room: {e}")
            return False

    async def send_message(self, event: str, data: Any):
        """Send a message to the server."""
        if not self.connected:
            self.message_queue.enqueue(event, data)
            return
            
        try:
            message = [event, data]
            await self.websocket.send(f"42{json.dumps(message)}")
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            self.message_queue.enqueue(event, data)

    async def send_chat(self, message: str):
        """Send a chat message."""
        await self.send_message("chat-message", {"text": message})

    async def roll_dice(self, roll_expr: str, reason: str = "CLI Roll"):
        """Roll dice via WebSocket."""
        await self.send_message("roll-dice", {"roll": roll_expr, "reason": reason})

    async def deck_draw(self, count: int = 1, region: str = "Acasia"):
        """Draw cards from deck via WebSocket."""
        await self.send_message("deck-draw", {"count": count, "region": region})

    async def deck_shuffle(self):
        """Shuffle deck via WebSocket."""
        await self.send_message("deck-shuffle", {})

    async def module_push(self, module_id: str):
        """Request module push via WebSocket."""
        await self.send_message("module-push-request", {"moduleId": module_id})

    async def module_cleanup(self, module_id: str):
        """Request module cleanup via WebSocket."""
        await self.send_message("module-cleanup-request", {"moduleId": module_id})

    def add_listener(self, event_type: str, callback):
        """Add a listener for WebSocket events."""
        self.listeners[event_type].append(callback)

    async def disconnect(self):
        """Disconnect from WebSocket server."""
        self.running = False
        if self.websocket:
            await self.websocket.close()
        self.connected = False

# ----------------------------------------------------------------------
# Export/Import Functions
# ----------------------------------------------------------------------

def export_character(store, char_id, path: Path):
    """Export character to YAML file."""
    char = next((c for c in store.characters if c.id == char_id), None)
    if not char:
        raise ValueError(f"Character {char_id} not found")
    with open(path, 'w') as f:
        yaml.dump(char.to_dict(), f)
    logger.info(f"Character exported to {path}")

def import_character(store, path: Path):
    """Import character from YAML file."""
    with open(path, 'r') as f:
        data = yaml.safe_load(f)
    char = Character.from_dict(data)
    char.id = store._nextId
    store._nextId += 1
    store.characters.append(char)
    save_data(store)
    logger.info(f"Character imported from {path}")

# ----------------------------------------------------------------------
# CLI Commands
# ======================================================================

def cmd_characters(args, store: DataStore):
    """Manage characters."""
    if args.list:
        if not store.characters:
            print("No characters.")
            return
        for c in store.characters:
            print(f"[{c.id}] {c.name} | Tier {c.tier} | B{c.body} W{c.wits} S{c.spirit} P{c.presence}")
            print(f"    Harm: {c.harm}, Fatigue: {c.fatigue}, Boons: {c.boons}")
        return

    if args.add:
        c = Character(id=store._nextId)
        store._nextId += 1
        if args.name:
            c.name = args.name
        if args.heritage:
            c.heritage = args.heritage
        if args.background:
            c.background = args.background
        if args.patron:
            c.patron = args.patron
        if args.tier:
            c.tier = args.tier
        if args.xp is not None:
            c.xp = args.xp
        if args.body is not None:
            c.body = args.body
        if args.wits is not None:
            c.wits = args.wits
        if args.spirit is not None:
            c.spirit = args.spirit
        if args.presence is not None:
            c.presence = args.presence
        if args.skill:
            for kv in args.skill:
                if '=' not in kv:
                    continue
                k, v = kv.split('=', 1)
                key = k.lower()
                if key in c.skills:
                    c.skills[key] = int(v)
        store.characters.append(c)
        save_data(store)
        print(f"✅ Character {c.name} (ID {c.id}) created.")
        return

    if args.delete is not None:
        idx = next((i for i, c in enumerate(store.characters) if c.id == args.delete), None)
        if idx is None:
            print(f"❌ Character ID {args.delete} not found.")
            return
        removed = store.characters.pop(idx)
        save_data(store)
        print(f"✅ Deleted character {removed.name} (ID {removed.id}).")
        return

    if args.export:
        try:
            export_character(store, args.export, Path(args.export_path or f"character_{args.export}.yaml"))
        except Exception as e:
            print(f"❌ Export failed: {e}")
        return

    if args.import_char:
        try:
            import_character(store, Path(args.import_char))
        except Exception as e:
            print(f"❌ Import failed: {e}")
        return

    print("Character subcommands:")
    print("  list                  - list all characters")
    print("  add [options]         - add a new character")
    print("  delete ID             - delete character by ID")
    print("  export ID [--export-path PATH] - export character to YAML")
    print("  import-char PATH      - import character from YAML")

def cmd_timers(args, store: DataStore):
    """Manage timers."""
    if args.list:
        if not store.timers:
            print("No timers.")
            return
        for t in store.timers:
            print(f"[{t.id}] {t.name} | {t.current}/{t.segments}")
        return

    if args.add:
        name = args.name or "Unnamed"
        segments = args.segments or 4
        t = Timer(id=store._nextId, name=name, segments=segments, current=0)
        store._nextId += 1
        store.timers.append(t)
        save_data(store)
        print(f"✅ Timer '{name}' (ID {t.id}) created with {segments} segments.")
        return

    if args.tick is not None:
        t = next((x for x in store.timers if x.id == args.tick), None)
        if not t:
            print(f"❌ Timer ID {args.tick} not found.")
            return
        t.current = min(t.current + 1, t.segments)
        save_data(store)
        print(f"⏱️  Timer '{t.name}' ticked: {t.current}/{t.segments}")
        return

    if args.reset is not None:
        t = next((x for x in store.timers if x.id == args.reset), None)
        if not t:
            print(f"❌ Timer ID {args.reset} not found.")
            return
        t.current = 0
        save_data(store)
        print(f"↺ Timer '{t.name}' reset to 0/{t.segments}")
        return

    if args.delete is not None:
        idx = next((i for i, x in enumerate(store.timers) if x.id == args.delete), None)
        if idx is None:
            print(f"❌ Timer ID {args.delete} not found.")
            return
        removed = store.timers.pop(idx)
        save_data(store)
        print(f"🗑️  Deleted timer '{removed.name}'.")
        return

    print("Timer subcommands:")
    print("  list                  - list all timers")
    print("  add --name NAME --segments N - add timer")
    print("  tick ID               - advance timer by 1")
    print("  reset ID              - reset timer to 0")
    print("  delete ID             - delete timer")

def cmd_roll(args, store: DataStore):
    """Roll dice."""
    if args.attr is None or args.skill is None or args.dv is None:
        print("Usage: roll --attr A --skill S --dv N [--pos POS] [--boons B]")
        return
    try:
        result = perform_roll(args.attr, args.skill, args.dv, args.pos, args.boons)
        print(f"🎲 Roll: {result['attr']}+{result['skill']} vs DV{result['dv']} ({result['pos']})")
        print(f"   Dice: {' '.join(map(str, result['dice']))}")
        print(f"   Successes: {result['successes']} | SB: {result['sb']}")
        print(f"   Outcome: {result['outcome']} — {result['result_text']}")
        
        store.rollHistory.append(result)
        save_data(store)
    except ValueError as e:
        print(f"❌ {e}")

# ======================================================================
# DECK COMMANDS
# ======================================================================

def cmd_deck(args, store: DataStore):
    """Manage deck operations."""
    if args.build:
        store.deck.cards = build_deck()
        store.deck.history = []
        store.deck.offset = random.randint(0, 1000)
        save_data(store)
        print(f"✅ Deck built with {len(store.deck.cards)} cards.")
        return

    if args.draw is not None:
        count = args.draw
        region = args.region or "Acasia"
        
        if not store.deck.cards or len(store.deck.cards) < count:
            print("⚠️ Deck running low, rebuilding...")
            store.deck.cards = build_deck()
        
        drawn = []
        for _ in range(count):
            if not store.deck.cards:
                store.deck.cards = build_deck()
            drawn.append(store.deck.cards.pop())
        
        # Load region data (simplified - would need actual region data)
        region_data = {}  # Placeholder
        synthesis = synthesise_consequence(drawn, region_data)
        
        store.deck.history.append({
            'cards': [c.to_dict() for c in drawn],
            'synthesis': synthesis,
            'type': f"{count} Draw",
            'timestamp': datetime.now().isoformat()
        })
        save_data(store)
        
        print(f"🃏 Drew {count} card{'s' if count > 1 else ''}:")
        for i, c in enumerate(drawn):
            print(f"   {i+1}. {c.rank_name} of {c.suit_name} {'🃏' if c.is_joker else ''}")
        print(f"\n📖 {synthesis}")
        return

    if args.crown:
        region = args.region or "Acasia"
        
        if not store.deck.cards or len(store.deck.cards) < 5:
            print("⚠️ Deck running low, rebuilding...")
            store.deck.cards = build_deck()
        
        drawn = []
        for _ in range(5):
            if not store.deck.cards:
                store.deck.cards = build_deck()
            drawn.append(store.deck.cards.pop())
        
        main_cards = drawn[:4]
        wildcard = drawn[4]
        region_data = {}  # Placeholder
        result = synthesise_crown_spread(main_cards, wildcard, region_data)
        
        store.deck.history.append({
            'cards': [c.to_dict() for c in drawn],
            'synthesis': result['synthesis'],
            'type': 'Crown Spread',
            'timestamp': datetime.now().isoformat()
        })
        save_data(store)
        
        print("👑 Crown Spread:")
        for pos in result['positions']:
            print(f"   {pos['icon']} {pos['label']}: {pos['meaning']}")
        print(f"\n🌟 Wildcard: {result['wildcard']}")
        return

    if args.history:
        if not store.deck.history:
            print("No deck history.")
            return
        for h in store.deck.history[-10:]:
            print(f"[{h.get('type', 'Draw')}] {h.get('synthesis', '')[:80]}...")
        return

    if args.clear_history:
        store.deck.history = []
        save_data(store)
        print("✅ Deck history cleared.")
        return

    if args.shuffle:
        store.deck.cards = build_deck()
        store.deck.offset = random.randint(0, 1000)
        save_data(store)
        print(f"✅ Deck shuffled. {len(store.deck.cards)} cards remaining.")
        return

    print("Deck subcommands:")
    print("  build                 - Build new deck")
    print("  shuffle               - Shuffle deck")
    print("  draw N [--region R]   - Draw N cards")
    print("  crown [--region R]    - Crown Spread")
    print("  history               - Show deck history")
    print("  clear-history         - Clear deck history")

def cmd_modules(args, store: DataStore):
    """Module operations."""
    if args.list:
        print("📦 Available modules:")
        print("  (Use --server URL to query the server for available modules)")
        return

    if args.push:
        if not args.module_id:
            print("❌ Please provide --module-id ID")
            return
        print(f"📦 Pushing module: {args.module_id}")
        print("  (Use --server URL to push to a server)")
        return

    if args.cleanup:
        if not args.module_id:
            print("❌ Please provide --module-id ID")
            return
        print(f"🧹 Cleaning up module: {args.module_id}")
        print("  (Use --server URL to cleanup from a server)")
        return

    print("Module subcommands:")
    print("  list                  - List available modules")
    print("  push --module-id ID   - Push module to clients")
    print("  cleanup --module-id ID - Cleanup module from clients")

def cmd_server(args, store: DataStore):
    """Campaign server operations."""
    server = CampaignServer(args.server, store.apiKey or args.api_key)

    if args.upload:
        try:
            async def upload_task():
                return await server.upload(store.to_dict())
            
            code = asyncio.run(with_spinner(upload_task(), "Uploading campaign"))
            print(f"✅ Campaign uploaded. Share code: {code}")
        except Exception as e:
            print(f"❌ Upload failed: {e}")

    elif args.load:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        try:
            async def load_task():
                return await server.load(args.code)
            
            data = asyncio.run(with_spinner(load_task(), "Loading campaign"))
            new_store = DataStore.from_dict(data)
            if store.characters or store.timers:
                confirm = input("This will replace local data. Continue? [y/N] ")
                if confirm.lower() != 'y':
                    print("Aborted.")
                    return
            store.characters = new_store.characters
            store.timers = new_store.timers
            store.wiki = new_store.wiki
            store.rollHistory = new_store.rollHistory
            store.talents = new_store.talents
            store.chatHistory = new_store.chatHistory
            store.encounters = new_store.encounters
            store.npcs = new_store.npcs
            store.deck = new_store.deck
            store.passwordHash = new_store.passwordHash
            store.baseUrl = new_store.baseUrl
            store.apiKey = new_store.apiKey
            store._nextId = new_store._nextId
            store._nextTalentId = new_store._nextTalentId
            store._nextEncounterId = new_store._nextEncounterId
            store._nextNpcId = new_store._nextNpcId
            save_data(store)
            print(f"✅ Campaign {args.code} loaded successfully.")
        except Exception as e:
            print(f"❌ Load failed: {e}")

    elif args.delete:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        try:
            async def delete_task():
                return await server.delete(args.code)
            
            asyncio.run(with_spinner(delete_task(), "Deleting campaign"))
            print(f"✅ Campaign {args.code} deleted from server.")
        except Exception as e:
            print(f"❌ Delete failed: {e}")

    elif args.chat:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        if not args.message:
            print("❌ Please provide --message MESSAGE")
            return
        try:
            async def chat_task():
                return await server.send_chat(args.code, args.message, args.sender or "CLI")
            
            result = asyncio.run(with_spinner(chat_task(), "Sending message"))
            print(f"✅ Message sent: {result.get('message', {}).get('id')}")
        except Exception as e:
            print(f"❌ Chat send failed: {e}")

    elif args.roll:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        if not args.dice:
            print("❌ Please provide --dice DICE_EXPRESSION")
            return
        try:
            async def roll_task():
                return await server.roll_dice(args.code, args.dice, args.reason or "CLI Roll")
            
            result = asyncio.run(with_spinner(roll_task(), "Rolling dice"))
            print(f"✅ Dice rolled: {result.get('expr')} = {result.get('result')}")
        except Exception as e:
            print(f"❌ Dice roll failed: {e}")

    elif args.sync:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        try:
            async def sync_task():
                remote = await server.get_state(args.code)
                local_hash = hashlib.sha256(json.dumps(store.to_dict(), sort_keys=True).encode()).hexdigest()
                remote_hash = hashlib.sha256(json.dumps(remote, sort_keys=True).encode()).hexdigest()
                return local_hash, remote_hash, remote
            
            local_hash, remote_hash, remote = asyncio.run(with_spinner(sync_task(), "Checking sync status"))
            
            if local_hash == remote_hash:
                print("✅ In sync")
            else:
                print("📊 Differences detected:")
                print(f"   Local hash:  {local_hash[:8]}...")
                print(f"   Remote hash: {remote_hash[:8]}...")
                direction = input("Upload local changes (u) or download remote (d)? ")
                if direction == 'u':
                    async def upload_state():
                        return await server.sync_state(args.code, store.to_dict())
                    result = asyncio.run(with_spinner(upload_state(), "Uploading state"))
                    print(f"✅ State uploaded")
                else:
                    print("📥 Downloading remote state...")
                    print("⚠️  Merge functionality not implemented yet")
        except Exception as e:
            print(f"❌ Sync failed: {e}")

    elif args.deck_get:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        try:
            async def deck_task():
                return await server.get_deck(args.code)
            result = asyncio.run(with_spinner(deck_task(), "Getting deck state"))
            print(f"✅ Deck has {result.get('remaining', 0)} cards remaining")
            print(f"   History: {len(result.get('deckHistory', []))} entries")
        except Exception as e:
            print(f"❌ Deck get failed: {e}")

    elif args.deck_shuffle:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        try:
            async def shuffle_task():
                return await server.shuffle_deck(args.code)
            result = asyncio.run(with_spinner(shuffle_task(), "Shuffling deck"))
            print(f"✅ Deck shuffled. {result.get('remaining', 0)} cards remaining.")
        except Exception as e:
            print(f"❌ Deck shuffle failed: {e}")

    elif args.deck_draw:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        count = args.count or 1
        region = args.region or "Acasia"
        try:
            async def draw_task():
                return await server.draw_cards(args.code, count, region)
            result = asyncio.run(with_spinner(draw_task(), f"Drawing {count} cards"))
            print(f"✅ Drew {len(result.get('cards', []))} cards from {region}")
            print(f"   {result.get('synthesis', 'No synthesis')}")
        except Exception as e:
            print(f"❌ Deck draw failed: {e}")

    elif args.deck_crown:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        region = args.region or "Acasia"
        try:
            async def crown_task():
                return await server.crown_spread(args.code, region)
            result = asyncio.run(with_spinner(crown_task(), "Performing Crown Spread"))
            print("👑 Crown Spread:")
            if result.get('result'):
                print(f"   {result['result'].get('synthesis', 'No synthesis')}")
        except Exception as e:
            print(f"❌ Crown spread failed: {e}")

    else:
        print("Server subcommands:")
        print("  upload --server URL                - upload local data")
        print("  load --server URL --code CODE     - load campaign")
        print("  delete --server URL --code CODE   - delete campaign")
        print("  chat --server URL --code CODE --message MSG [--sender S]")
        print("  roll --server URL --code CODE --dice EXPRESSION [--reason R]")
        print("  sync --server URL --code CODE     - sync with server")
        print("  deck-get --server URL --code CODE - get deck state")
        print("  deck-shuffle --server URL --code CODE - shuffle deck")
        print("  deck-draw --server URL --code CODE --count N --region R - draw cards")
        print("  deck-crown --server URL --code CODE --region R - crown spread")

async def cmd_websocket(args, store: DataStore):
    """WebSocket operations."""
    if not args.code:
        print("❌ Please provide --code CODE")
        return
        
    ws_client = WebSocketClient(args.server, store.apiKey or args.api_key, args.code)
    
    if not await ws_client.connect_with_retry():
        print("❌ Failed to connect to WebSocket server")
        return
        
    if not await ws_client.join_room():
        print("❌ Failed to join room")
        await ws_client.disconnect()
        return
    
    def chat_listener(data):
        sender = data.get("sender", "Unknown")
        text = data.get("text", "")
        print(f"\n[CHAT] {sender}: {text}")
        
    def roll_listener(data):
        sender = data.get("sender", "Unknown")
        expr = data.get("expr", "")
        result = data.get("result", 0)
        print(f"\n[DICE] {sender} rolled {expr} = {result}")
    
    def deck_listener(data):
        cards = data.get("cards", [])
        synthesis = data.get("synthesis", "")
        region = data.get("region", "Unknown")
        print(f"\n[DECK] Drew {len(cards)} cards from {region}")
        print(f"  {synthesis[:100]}..." if len(synthesis) > 100 else f"  {synthesis}")
    
    ws_client.add_listener("chat-message", chat_listener)
    ws_client.add_listener("roll-result", roll_listener)
    ws_client.add_listener("deck-drawn", deck_listener)
    
    print("WebSocket client connected. Commands:")
    print("  /chat MESSAGE       - Send chat message")
    print("  /roll DICE_EXPR     - Roll dice (e.g., 2d6+3)")
    print("  /draw N             - Draw N cards from deck")
    print("  /crown              - Perform Crown Spread")
    print("  /shuffle            - Shuffle deck")
    print("  /quit               - Exit")
    
    try:
        while ws_client.connected:
            try:
                line = await asyncio.get_event_loop().run_in_executor(None, input, "> ")
                if line.startswith("/chat "):
                    await ws_client.send_chat(line[6:])
                elif line.startswith("/roll "):
                    await ws_client.roll_dice(line[6:])
                elif line.startswith("/draw "):
                    try:
                        count = int(line[6:].strip())
                        await ws_client.deck_draw(count)
                    except ValueError:
                        print("❌ Please specify a number (e.g., /draw 3)")
                elif line == "/crown":
                    await ws_client.deck_draw(5)  # Crown spread is 5 cards
                elif line == "/shuffle":
                    await ws_client.deck_shuffle()
                elif line == "/quit":
                    break
            except EOFError:
                break
    finally:
        await ws_client.disconnect()
        print("Disconnected from WebSocket server.")

def cmd_config(args, store: DataStore):
    """Configuration management."""
    if args.set_api_key:
        store.apiKey = args.set_api_key
        save_data(store)
        print(f"✅ API key set")
        
    elif args.show:
        print(f"API Key: {store.apiKey[:8]}...{store.apiKey[-4:] if store.apiKey else 'Not set'}")
        print(f"Server URL: {store.baseUrl or 'Not set'}")
        print(f"Characters: {len(store.characters)}")
        print(f"Timers: {len(store.timers)}")
        print(f"Roll History: {len(store.rollHistory)} entries")
        print(f"Deck: {len(store.deck.cards)} cards, {len(store.deck.history)} history entries")
        
    else:
        print("Configuration commands:")
        print("  --set-api-key KEY  - Set API key")
        print("  --show             - Show current configuration")

# ----------------------------------------------------------------------
# Version Check
# ----------------------------------------------------------------------

def check_for_updates():
    """Check for newer version on PyPI."""
    try:
        response = requests.get(
            "https://pypi.org/pypi/fates-edge-python-client/json",
            timeout=2
        )
        latest = response.json()["info"]["version"]
        current = __version__
        if latest > current:
            print(f"📦 Update available: v{latest} (current: v{current})")
            print(f"   Run: pip install --upgrade fates-edge-python-client")
    except:
        pass

# ----------------------------------------------------------------------
# Interactive Shell
# ----------------------------------------------------------------------

class InteractiveShell:
    def __init__(self, store: DataStore):
        self.store = store
        self.running = True
        self.ws_client = None
        self.prompt = "fates-edge> "
        
    def completer(self, text, state):
        """Tab completion for commands."""
        options = [
            'characters', 'timers', 'roll', 'deck', 'server', 'websocket', 
            'modules', 'config', 'help', 'exit', 'quit'
        ]
        matches = [o for o in options if o.startswith(text)]
        if state < len(matches):
            return matches[state]
        return None

    def setup_completion(self):
        """Setup readline completion."""
        readline.parse_and_bind("tab: complete")
        readline.set_completer(self.completer)

    async def run(self):
        """Run the interactive shell."""
        print("Fate's Edge Python Client – Interactive Shell")
        print("Type 'help' for commands, 'exit' to quit.")
        self.setup_completion()
        
        while self.running:
            try:
                line = input(self.prompt).strip()
                if not line:
                    continue
                    
                parts = line.split()
                cmd = parts[0].lower()
                
                if cmd in ['exit', 'quit']:
                    await self.shutdown()
                    break
                elif cmd == 'help':
                    self.show_help()
                elif cmd == 'characters':
                    self.handle_characters(parts[1:])
                elif cmd == 'timers':
                    self.handle_timers(parts[1:])
                elif cmd == 'roll':
                    self.handle_roll(parts[1:])
                elif cmd == 'deck':
                    self.handle_deck(parts[1:])
                elif cmd == 'server':
                    self.handle_server(parts[1:])
                elif cmd == 'websocket':
                    await self.handle_websocket(parts[1:])
                elif cmd == 'modules':
                    self.handle_modules(parts[1:])
                elif cmd == 'config':
                    self.handle_config(parts[1:])
                else:
                    print(f"Unknown command: {cmd}. Type 'help' for available commands.")
                    
            except KeyboardInterrupt:
                print("\nUse 'exit' to quit.")
            except EOFError:
                await self.shutdown()
                break
            except Exception as e:
                print(f"Error: {e}")

    async def shutdown(self):
        """Shutdown the shell."""
        self.running = False
        if self.ws_client:
            await self.ws_client.disconnect()
        print("Goodbye!")

    def show_help(self):
        """Show help information."""
        print("""
Available commands:
  characters [list|add|delete]  - Manage characters
  timers [list|add|tick|reset]  - Manage timers
  roll --attr A --skill S --dv N - Roll dice
  deck [build|draw|crown|shuffle|history] - Deck operations
  server [upload|load|delete]   - Campaign server operations
  websocket --code CODE         - Connect to WebSocket
  modules [list|push|cleanup]   - Module management
  config [set|show]             - Configuration
  help                          - Show this help
  exit                          - Exit the shell
""")

    def handle_characters(self, args):
        parser = argparse.ArgumentParser(prog='characters')
        parser.add_argument('--list', action='store_true')
        parser.add_argument('--add', action='store_true')
        parser.add_argument('--name')
        parser.add_argument('--heritage')
        parser.add_argument('--background')
        parser.add_argument('--patron')
        parser.add_argument('--tier', default='I')
        parser.add_argument('--xp', type=int, default=BASE_START_XP)
        parser.add_argument('--body', type=int, default=3)
        parser.add_argument('--wits', type=int, default=2)
        parser.add_argument('--spirit', type=int, default=1)
        parser.add_argument('--presence', type=int, default=1)
        parser.add_argument('--skill', action='append')
        parser.add_argument('--delete', type=int)
        parser.add_argument('--export', type=int)
        parser.add_argument('--export-path')
        parser.add_argument('--import-char')
        
        try:
            parsed = parser.parse_args(args)
            cmd_characters(parsed, self.store)
        except SystemExit:
            pass

    def handle_timers(self, args):
        parser = argparse.ArgumentParser(prog='timers')
        parser.add_argument('--list', action='store_true')
        parser.add_argument('--add', action='store_true')
        parser.add_argument('--name')
        parser.add_argument('--segments', type=int, default=4)
        parser.add_argument('--tick', type=int)
        parser.add_argument('--reset', type=int)
        parser.add_argument('--delete', type=int)
        
        try:
            parsed = parser.parse_args(args)
            cmd_timers(parsed, self.store)
        except SystemExit:
            pass

    def handle_roll(self, args):
        parser = argparse.ArgumentParser(prog='roll')
        parser.add_argument('--attr', type=int, required=True)
        parser.add_argument('--skill', type=int, required=True)
        parser.add_argument('--dv', type=int, required=True)
        parser.add_argument('--pos', default='controlled', choices=['dominant', 'controlled', 'desperate'])
        parser.add_argument('--boons', type=int, default=0)
        
        try:
            parsed = parser.parse_args(args)
            cmd_roll(parsed, self.store)
        except SystemExit:
            pass

    def handle_deck(self, args):
        parser = argparse.ArgumentParser(prog='deck')
        parser.add_argument('--build', action='store_true')
        parser.add_argument('--draw', type=int)
        parser.add_argument('--crown', action='store_true')
        parser.add_argument('--shuffle', action='store_true')
        parser.add_argument('--history', action='store_true')
        parser.add_argument('--clear-history', action='store_true')
        parser.add_argument('--region', default='Acasia')
        
        try:
            parsed = parser.parse_args(args)
            cmd_deck(parsed, self.store)
        except SystemExit:
            pass

    def handle_server(self, args):
        parser = argparse.ArgumentParser(prog='server')
        parser.add_argument('--server', default='http://localhost:3000')
        parser.add_argument('--upload', action='store_true')
        parser.add_argument('--load', action='store_true')
        parser.add_argument('--delete', action='store_true')
        parser.add_argument('--chat', action='store_true')
        parser.add_argument('--roll', action='store_true')
        parser.add_argument('--sync', action='store_true')
        parser.add_argument('--deck-get', action='store_true')
        parser.add_argument('--deck-shuffle', action='store_true')
        parser.add_argument('--deck-draw', action='store_true')
        parser.add_argument('--deck-crown', action='store_true')
        parser.add_argument('--code')
        parser.add_argument('--message')
        parser.add_argument('--sender')
        parser.add_argument('--dice')
        parser.add_argument('--reason')
        parser.add_argument('--count', type=int, default=1)
        parser.add_argument('--region', default='Acasia')
        parser.add_argument('--api-key')
        
        try:
            parsed = parser.parse_args(args)
            cmd_server(parsed, self.store)
        except SystemExit:
            pass

    async def handle_websocket(self, args):
        parser = argparse.ArgumentParser(prog='websocket')
        parser.add_argument('--server', default='http://localhost:3000')
        parser.add_argument('--code', required=True)
        parser.add_argument('--api-key')
        
        try:
            parsed = parser.parse_args(args)
            await cmd_websocket(parsed, self.store)
        except SystemExit:
            pass

    def handle_modules(self, args):
        parser = argparse.ArgumentParser(prog='modules')
        parser.add_argument('--list', action='store_true')
        parser.add_argument('--push', action='store_true')
        parser.add_argument('--cleanup', action='store_true')
        parser.add_argument('--module-id')
        parser.add_argument('--server', default='http://localhost:3000')
        parser.add_argument('--api-key')
        
        try:
            parsed = parser.parse_args(args)
            cmd_modules(parsed, self.store)
        except SystemExit:
            pass

    def handle_config(self, args):
        parser = argparse.ArgumentParser(prog='config')
        parser.add_argument('--set-api-key')
        parser.add_argument('--show', action='store_true')
        
        try:
            parsed = parser.parse_args(args)
            cmd_config(parsed, self.store)
        except SystemExit:
            pass

# ----------------------------------------------------------------------
# Main Entry Point
# ----------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Fate's Edge Python Client")
    parser.add_argument('--version', action='version', version=f'Fate\'s Edge Python Client v{__version__}')
    subparsers = parser.add_subparsers(dest='command', help='Subcommands')

    # Characters
    char_parser = subparsers.add_parser('characters', help='Manage characters')
    char_parser.add_argument('--list', action='store_true', help='List characters')
    char_parser.add_argument('--add', action='store_true', help='Add character')
    char_parser.add_argument('--name', help='Character name')
    char_parser.add_argument('--heritage', help='Heritage')
    char_parser.add_argument('--background', help='Background')
    char_parser.add_argument('--patron', help='Patron')
    char_parser.add_argument('--tier', default='I', help='Tier (default I)')
    char_parser.add_argument('--xp', type=int, default=BASE_START_XP, help='Starting XP')
    char_parser.add_argument('--body', type=int, default=3, help='Body (1-5)')
    char_parser.add_argument('--wits', type=int, default=2, help='Wits (1-5)')
    char_parser.add_argument('--spirit', type=int, default=1, help='Spirit (1-5)')
    char_parser.add_argument('--presence', type=int, default=1, help='Presence (1-5)')
    char_parser.add_argument('--skill', action='append', help='Skill=value (e.g. --skill melee=2)')
    char_parser.add_argument('--delete', type=int, help='Delete character by ID')
    char_parser.add_argument('--export', type=int, help='Export character by ID')
    char_parser.add_argument('--export-path', help='Export path')
    char_parser.add_argument('--import-char', help='Import character from file')
    char_parser.set_defaults(func=cmd_characters)

    # Timers
    timer_parser = subparsers.add_parser('timers', help='Manage timers')
    timer_parser.add_argument('--list', action='store_true', help='List timers')
    timer_parser.add_argument('--add', action='store_true', help='Add timer')
    timer_parser.add_argument('--name', help='Timer name')
    timer_parser.add_argument('--segments', type=int, default=4, help='Number of segments')
    timer_parser.add_argument('--tick', type=int, help='Tick timer by ID')
    timer_parser.add_argument('--reset', type=int, help='Reset timer by ID')
    timer_parser.add_argument('--delete', type=int, help='Delete timer by ID')
    timer_parser.set_defaults(func=cmd_timers)

    # Roll
    roll_parser = subparsers.add_parser('roll', help='Roll dice')
    roll_parser.add_argument('--attr', type=int, required=True, help='Attribute rating')
    roll_parser.add_argument('--skill', type=int, required=True, help='Skill rating')
    roll_parser.add_argument('--dv', type=int, required=True, help='Difficulty Value')
    roll_parser.add_argument('--pos', default='controlled', choices=['dominant', 'controlled', 'desperate'], help='Position')
    roll_parser.add_argument('--boons', type=int, default=0, help='Boons to spend')
    roll_parser.set_defaults(func=cmd_roll)

    # Deck
    deck_parser = subparsers.add_parser('deck', help='Deck operations')
    deck_parser.add_argument('--build', action='store_true', help='Build new deck')
    deck_parser.add_argument('--draw', type=int, help='Draw N cards')
    deck_parser.add_argument('--crown', action='store_true', help='Crown Spread')
    deck_parser.add_argument('--shuffle', action='store_true', help='Shuffle deck')
    deck_parser.add_argument('--history', action='store_true', help='Show deck history')
    deck_parser.add_argument('--clear-history', action='store_true', help='Clear deck history')
    deck_parser.add_argument('--region', default='Acasia', help='Region for card meanings')
    deck_parser.set_defaults(func=cmd_deck)

    # Modules
    module_parser = subparsers.add_parser('modules', help='Module management')
    module_parser.add_argument('--list', action='store_true', help='List available modules')
    module_parser.add_argument('--push', action='store_true', help='Push module to clients')
    module_parser.add_argument('--cleanup', action='store_true', help='Cleanup module from clients')
    module_parser.add_argument('--module-id', help='Module ID')
    module_parser.add_argument('--server', default='http://localhost:3000', help='Server URL')
    module_parser.add_argument('--api-key', help='API key')
    module_parser.set_defaults(func=cmd_modules)

    # Server
    server_parser = subparsers.add_parser('server', help='Campaign server operations')
    server_parser.add_argument('--server', default='http://localhost:3000', help='Server URL')
    server_parser.add_argument('--upload', action='store_true', help='Upload local data')
    server_parser.add_argument('--load', action='store_true', help='Load campaign from server')
    server_parser.add_argument('--delete', action='store_true', help='Delete campaign from server')
    server_parser.add_argument('--chat', action='store_true', help='Send chat message')
    server_parser.add_argument('--roll', action='store_true', help='Roll dice via API')
    server_parser.add_argument('--sync', action='store_true', help='Sync with server')
    server_parser.add_argument('--deck-get', action='store_true', help='Get deck state')
    server_parser.add_argument('--deck-shuffle', action='store_true', help='Shuffle deck')
    server_parser.add_argument('--deck-draw', action='store_true', help='Draw cards from deck')
    server_parser.add_argument('--deck-crown', action='store_true', help='Crown Spread')
    server_parser.add_argument('--code', help='Campaign code')
    server_parser.add_argument('--message', help='Chat message')
    server_parser.add_argument('--sender', help='Message sender')
    server_parser.add_argument('--dice', help='Dice expression (e.g., 2d6+3)')
    server_parser.add_argument('--reason', help='Roll reason')
    server_parser.add_argument('--count', type=int, default=1, help='Number of cards to draw')
    server_parser.add_argument('--region', default='Acasia', help='Region for card meanings')
    server_parser.add_argument('--api-key', help='API key for server operations')
    server_parser.set_defaults(func=cmd_server)

    # WebSocket
    ws_parser = subparsers.add_parser('websocket', help='WebSocket operations')
    ws_parser.add_argument('--server', default='http://localhost:3000', help='Server URL')
    ws_parser.add_argument('--code', required=True, help='Room code')
    ws_parser.add_argument('--api-key', help='API key')
    ws_parser.set_defaults(func=lambda args, store: asyncio.run(cmd_websocket(args, store)))

    # Configuration
    config_parser = subparsers.add_parser('config', help='Configuration management')
    config_parser.add_argument('--set-api-key', help='Set API key')
    config_parser.add_argument('--show', action='store_true', help='Show configuration')
    config_parser.set_defaults(func=cmd_config)

    # Interactive shell
    shell_parser = subparsers.add_parser('shell', help='Start interactive shell')
    shell_parser.set_defaults(func=lambda args, store: asyncio.run(interactive_shell(store)))

    args = parser.parse_args()
    if not args.command and '--version' not in sys.argv:
        check_for_updates()
        parser.print_help()
        return

    store = load_data()
    if hasattr(args, 'func'):
        args.func(args, store)
    else:
        parser.print_help()

async def interactive_shell(store: DataStore):
    """Start interactive shell."""
    shell = InteractiveShell(store)
    await shell.run()

if __name__ == '__main__':
    main()