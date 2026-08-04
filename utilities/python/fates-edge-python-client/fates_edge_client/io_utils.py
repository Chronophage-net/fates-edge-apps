"""
Character export/import (YAML) and the CLI's progress-spinner helper.
Ported near-verbatim from the old single-file client; grouped here since
neither belongs in a data-model, network, or CLI-parsing module.
"""

import asyncio
import itertools
import logging
import sys
from pathlib import Path

import yaml

from .models import Character
from .store import DataStore, save_data

logger = logging.getLogger("fates-edge.io")


def export_character(store: DataStore, char_id: int, path: Path) -> None:
    char = next((c for c in store.characters if c.id == char_id), None)
    if not char:
        raise ValueError(f"Character {char_id} not found")
    with open(path, 'w') as f:
        yaml.dump(char.to_dict(), f)
    logger.info(f"Character exported to {path}")


def import_character(store: DataStore, path: Path) -> None:
    with open(path, 'r') as f:
        data = yaml.safe_load(f)
    char = Character.from_dict(data)
    char.id = store._nextId
    store._nextId += 1
    store.characters.append(char)
    save_data(store)
    logger.info(f"Character imported from {path}")


async def with_spinner(coro, message: str = "Processing"):
    """Run a coroutine with a spinner animation, matching the old
    client's console UX for slow (network) operations."""
    spinner = itertools.cycle(['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'])
    task = asyncio.create_task(coro)

    while not task.done():
        sys.stdout.write(f'\r{next(spinner)} {message}')
        sys.stdout.flush()
        await asyncio.sleep(0.1)

    result = await task
    sys.stdout.write('\r✅ Done!      \n')
    return result
