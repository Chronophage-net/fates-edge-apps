"""
Local persistence for the Fate's Edge Python client.

Two things this fixes relative to the old single-file client:

1. Atomic writes. The old `save_data()` opened the target file directly
   and wrote into it — if the process was killed mid-write (Ctrl-C,
   crash, disk full), `~/.fates_edge/data.json` could be left truncated
   or corrupt with no backup. This version writes to a temp file in the
   same directory and `os.replace()`s it over the real path, which is
   atomic on POSIX and Windows: a reader (or a concurrent save) always
   sees either the old file or the new one, never a partial write.
2. Versioned migrations. `DataStore.version` existed in the old code but
   nothing ever read it — old-format files just relied on `.get(key,
   default)` scattered through `from_dict()`. `migrate()` below is a
   small, explicit chain keyed off the stored version number, so future
   schema changes have one obvious place to land instead of silently
   patched-over defaults.
"""

import json
import logging
import os
import tempfile
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional

from .config import DEFAULT_DATA_PATH
from .models import Character, DeckState, Timer

logger = logging.getLogger("fates-edge.store")

CURRENT_VERSION = 5


@dataclass
class DataStore:
    version: int = CURRENT_VERSION
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
    # NEW: optional per-user JWT from /api/auth/login|register, distinct
    # from the static admin apiKey above. Lets `server`/`ws` subcommands
    # skip a room's password once, and makes account-owned character
    # library calls (`characters --account-*`) possible. Never required.
    authToken: str = ""
    authUsername: str = ""
    _nextId: int = 1
    _nextTalentId: int = 1
    _nextEncounterId: int = 1
    _nextNpcId: int = 1

    def to_dict(self) -> Dict:
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
            "authToken": self.authToken,
            "authUsername": self.authUsername,
            "_nextId": self._nextId,
            "_nextTalentId": self._nextTalentId,
            "_nextEncounterId": self._nextEncounterId,
            "_nextNpcId": self._nextNpcId,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "DataStore":
        data = migrate(data)
        chars = [Character.from_dict(c) for c in data.get("characters", [])]
        timers = [Timer(**t) for t in data.get("timers", [])]
        deck_data = data.get("deck", {})
        deck = DeckState.from_dict(deck_data) if deck_data else DeckState()
        return cls(
            version=data.get("version", CURRENT_VERSION),
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
            authToken=data.get("authToken", ""),
            authUsername=data.get("authUsername", ""),
            _nextId=data.get("_nextId", 1),
            _nextTalentId=data.get("_nextTalentId", 1),
            _nextEncounterId=data.get("_nextEncounterId", 1),
            _nextNpcId=data.get("_nextNpcId", 1),
        )


# ----------------------------------------------------------------------
# Migrations
# ----------------------------------------------------------------------
#
# Each step upgrades data one version forward and is applied in order
# until `data['version']` reaches CURRENT_VERSION. There are no real
# schema changes to make yet (every field already existed by version 5,
# which is what every file on disk today already has), so this is
# currently a no-op chain — but it's the one place a future field
# rename/removal should be handled, instead of a `.get(key, default)`
# quietly masking missing data forever.

_MIGRATIONS = {
    # version_found: function(data) -> data (mutates or returns a new dict)
    # Example for the future:
    # 5: lambda data: {**data, "newField": data.get("oldField", "")},
}


def migrate(data: Dict) -> Dict:
    version = data.get("version", 1)
    while version in _MIGRATIONS:
        data = _MIGRATIONS[version](data)
        version = data.get("version", version + 1)
    if version < CURRENT_VERSION:
        # Older file with no explicit migration step registered yet --
        # DataStore.from_dict()'s .get(..., default) calls handle any
        # missing keys gracefully, so just stamp the current version.
        data = {**data, "version": CURRENT_VERSION}
    return data


# ----------------------------------------------------------------------
# Load / save
# ----------------------------------------------------------------------

def load_data(path: Path = DEFAULT_DATA_PATH) -> DataStore:
    """Load data from the JSON file, returning a fresh empty store if the
    file is missing. If the file exists but fails to parse, the corrupt
    file is preserved (renamed to a .corrupt sibling) rather than
    silently discarded, so no data is lost without a trace."""
    if not path.exists():
        return DataStore()
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return DataStore.from_dict(data)
    except Exception as e:
        logger.warning(f"Failed to load data from {path}: {e}")
        try:
            corrupt_path = path.with_suffix(path.suffix + ".corrupt")
            path.replace(corrupt_path)
            logger.warning(f"Preserved unreadable file at {corrupt_path}")
        except Exception:
            pass
        return DataStore()


def save_data(store: DataStore, path: Path = DEFAULT_DATA_PATH) -> None:
    """Save data atomically: write to a temp file in the same directory,
    then os.replace() it over the real path. A crash or Ctrl-C mid-write
    leaves the temp file orphaned, not the real data file corrupted."""
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(store.to_dict(), indent=2, ensure_ascii=False)

    fd, tmp_path = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent)
    )
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(payload)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)
    except Exception:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        raise
