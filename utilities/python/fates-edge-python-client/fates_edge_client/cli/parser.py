"""
The single argparse tree for the Fate's Edge CLI. Built once here and
reused by both `__main__.py` (real command-line invocation) and
`shell.py` (the interactive REPL, which just shlex.splits a line and
calls `parser.parse_args(tokens)`) -- this is the fix for the old
client's `InteractiveShell`, which rebuilt an equivalent
`argparse.ArgumentParser` by hand inside every `handle_*` method instead
of sharing one schema with `main()`.
"""

import argparse

from ..config import BASE_START_XP, DEFAULT_SERVER_URL, __version__
from .commands import account, characters, config, data, deck, modules, roll, server, timers, websocket


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog='fates-edge', description="Fate's Edge Python Client")
    parser.add_argument('--version', action='version', version=f"Fate's Edge Python Client v{__version__}")
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
    char_parser.set_defaults(func=characters.run)

    # Timers
    timer_parser = subparsers.add_parser('timers', help='Manage timers')
    timer_parser.add_argument('--list', action='store_true', help='List timers')
    timer_parser.add_argument('--add', action='store_true', help='Add timer')
    timer_parser.add_argument('--name', help='Timer name')
    timer_parser.add_argument('--segments', type=int, default=4, help='Number of segments')
    timer_parser.add_argument('--tick', type=int, help='Tick timer by ID')
    timer_parser.add_argument('--reset', type=int, help='Reset timer by ID')
    timer_parser.add_argument('--delete', type=int, help='Delete timer by ID')
    timer_parser.set_defaults(func=timers.run)

    # Roll
    roll_parser = subparsers.add_parser('roll', help='Roll dice')
    roll_parser.add_argument('--attr', type=int, required=True, help='Attribute rating')
    roll_parser.add_argument('--skill', type=int, required=True, help='Skill rating')
    roll_parser.add_argument('--dv', type=int, required=True, help='Difficulty Value')
    roll_parser.add_argument('--pos', default='controlled', choices=['dominant', 'controlled', 'desperate'], help='Position')
    roll_parser.add_argument('--boons', type=int, default=0, help='Boons to spend')
    roll_parser.set_defaults(func=roll.run)

    # Deck
    deck_parser = subparsers.add_parser('deck', help='Deck operations')
    deck_parser.add_argument('--build', action='store_true', help='Build new deck')
    deck_parser.add_argument('--draw', type=int, help='Draw N cards')
    deck_parser.add_argument('--crown', action='store_true', help='Crown Spread')
    deck_parser.add_argument('--shuffle', action='store_true', help='Shuffle deck')
    deck_parser.add_argument('--history', action='store_true', help='Show deck history')
    deck_parser.add_argument('--clear-history', action='store_true', help='Clear deck history')
    deck_parser.add_argument('--region', default='Acasia', help='Region for card meanings')
    deck_parser.set_defaults(func=deck.run)

    # Modules
    module_parser = subparsers.add_parser('modules', help='Module management')
    module_parser.add_argument('--list', action='store_true', help='List available modules')
    module_parser.add_argument('--push', action='store_true', help='Push module to clients')
    module_parser.add_argument('--cleanup', action='store_true', help='Cleanup module from clients')
    module_parser.add_argument('--module-id', help='Module ID')
    module_parser.add_argument('--server', default=DEFAULT_SERVER_URL, help='Server URL')
    module_parser.add_argument('--api-key', help='API key')
    module_parser.set_defaults(func=modules.run)

    # Server
    server_parser = subparsers.add_parser('server', help='Campaign server operations')
    server_parser.add_argument('--server', default=DEFAULT_SERVER_URL, help='Server URL')
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
    server_parser.add_argument('--deck-seed-get', action='store_true', help='Get this room\'s deck RNG seed')
    server_parser.add_argument('--deck-seed-set', metavar='SEED', help='Reseed this room\'s deck RNG (string or number) and reshuffle')
    server_parser.add_argument('--code', help='Room code (required by every --server subcommand)')
    server_parser.add_argument('--campaign-code', help='Campaign share code (returned by --upload; required by --load)')
    server_parser.add_argument('--message', help='Chat message')
    server_parser.add_argument('--sender', help='Message sender')
    server_parser.add_argument('--dice', help='Dice expression (e.g., 2d6+3)')
    server_parser.add_argument('--reason', help='Roll reason')
    server_parser.add_argument('--count', type=int, default=1, help='Number of cards to draw')
    server_parser.add_argument('--region', default='Acasia', help='Region for card meanings')
    server_parser.add_argument('--api-key', help='API key for server operations')
    server_parser.set_defaults(func=server.run)

    # WebSocket
    ws_parser = subparsers.add_parser('websocket', help='WebSocket operations')
    ws_parser.add_argument('--server', default=DEFAULT_SERVER_URL, help='Server URL')
    ws_parser.add_argument('--code', required=True, help='Room code')
    ws_parser.add_argument('--api-key', help='API key')
    ws_parser.set_defaults(func=websocket.run)

    # Data (region lore fetch -- see data_fetch.py; not bundled, opt-in,
    # not MIT-licensed like the rest of this package)
    data_parser = subparsers.add_parser('data', help='Fetch optional region lore data')
    data_parser.add_argument('--fetch', action='store_true', help='Download region lore data for deck --draw/--crown')
    data_parser.set_defaults(func=data.run)

    # Configuration
    config_parser = subparsers.add_parser('config', help='Configuration management')
    config_parser.add_argument('--set-api-key', help='Set API key')
    config_parser.add_argument('--show', action='store_true', help='Show configuration')
    config_parser.set_defaults(func=config.run)

    # Account (NEW): optional login/register + server-owned character
    # library + admin room-password/ban helpers. See account.py's
    # module docstring -- none of this affects any other subcommand
    # unless a token has actually been stored via --login/--register.
    account_parser = subparsers.add_parser('account', help='Optional account login, character library, and admin tools')
    account_parser.add_argument('--server', default=DEFAULT_SERVER_URL, help='Server URL')
    account_parser.add_argument('--api-key', help='Admin API key (for --set-room-password/--ban-user/--unban-user)')
    account_parser.add_argument('--register', action='store_true', help='Create an account and log in')
    account_parser.add_argument('--login', action='store_true', help='Log in to an existing account')
    account_parser.add_argument('--logout', action='store_true', help='Forget the locally stored login token')
    account_parser.add_argument('--whoami', action='store_true', help='Show current login status')
    account_parser.add_argument('--username', help='Username for --register/--login')
    account_parser.add_argument('--password', help='Password for --register/--login')
    account_parser.add_argument('--list-characters', action='store_true', help='List characters stored on your account')
    account_parser.add_argument('--upload-character', type=int, help='Copy a local character (by ID) to your account')
    account_parser.add_argument('--delete-character', help='Delete a character from your account by its account character ID')
    account_parser.add_argument('--set-room-password', help='(admin) Set/replace a room join password')
    account_parser.add_argument('--ban-user', help='(admin) Persistently ban an account (by user ID) from a room')
    account_parser.add_argument('--unban-user', help='(admin) Lift a persistent ban')
    account_parser.add_argument('--code', help='Room code (required by --set-room-password/--ban-user/--unban-user)')
    account_parser.set_defaults(func=account.run)

    # Interactive shell -- func is wired up in __main__.py to avoid a
    # circular import (shell.py itself calls build_parser()).
    subparsers.add_parser('shell', help='Start interactive shell')

    return parser
