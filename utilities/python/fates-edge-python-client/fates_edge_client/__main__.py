"""
`python -m fates_edge_client` / `fates-edge` console-script entry point.

Dispatch is deliberately uniform for both sync and async command
functions: call `args.func(args, store)`, and if the result is
awaitable, run it to completion with `asyncio.run()`. There is no
running event loop at this point (this is the top-level, synchronous
entry point), so a single `asyncio.run()` here is always safe -- unlike
calling it again from inside `shell.py`, which is already running inside
its own `asyncio.run()` and awaits command coroutines directly instead.
"""

import asyncio
import inspect
import logging
import sys

import requests

from .cli.parser import build_parser
from .config import __version__
from .shell import run_shell
from .store import load_data

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("fates-edge")


def check_for_updates():
    """Check for a newer version on PyPI. Best-effort; silent on any
    failure (offline, PyPI down, package not published yet, etc.)."""
    try:
        response = requests.get(
            "https://pypi.org/pypi/fates-edge-client/json",
            timeout=2,
        )
        latest = response.json()["info"]["version"]
        if latest > __version__:
            print(f"📦 Update available: v{latest} (current: v{__version__})")
            print("   Run: pip install --upgrade fates-edge-client")
    except Exception:
        pass


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command and '--version' not in sys.argv:
        check_for_updates()
        parser.print_help()
        return

    if args.command == 'shell':
        store = load_data()
        asyncio.run(run_shell(store))
        return

    store = load_data()
    func = getattr(args, 'func', None)
    if func is None:
        parser.print_help()
        return

    result = func(args, store)
    if inspect.isawaitable(result):
        asyncio.run(result)


if __name__ == '__main__':
    main()
