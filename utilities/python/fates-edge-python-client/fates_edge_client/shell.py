"""
Interactive REPL shell.

FIXED relative to the old client's `InteractiveShell`: every `handle_*`
method used to build its own `argparse.ArgumentParser` from scratch,
duplicating (and slowly drifting from) the schema `main()` already
defined. This version does none of that -- it shlex.splits the input
line and feeds the tokens straight into the same shared parser built by
`cli/parser.py`, so the shell and the plain CLI can never disagree about
what flags a subcommand accepts.
"""

import asyncio
import inspect
import readline
import shlex

from .cli.parser import build_parser
from .store import DataStore

_TOP_LEVEL_COMMANDS = [
    'characters', 'timers', 'roll', 'deck', 'server', 'websocket',
    'modules', 'config', 'help', 'exit', 'quit',
]


class InteractiveShell:
    def __init__(self, store: DataStore):
        self.store = store
        self.running = True
        self.prompt = "fates-edge> "
        self.parser = build_parser()

    def _completer(self, text, state):
        matches = [o for o in _TOP_LEVEL_COMMANDS if o.startswith(text)]
        return matches[state] if state < len(matches) else None

    def _setup_completion(self):
        readline.parse_and_bind("tab: complete")
        readline.set_completer(self._completer)

    async def run(self):
        print("Fate's Edge Python Client – Interactive Shell")
        print("Type 'help' for commands, 'exit' to quit.")
        self._setup_completion()

        while self.running:
            try:
                line = input(self.prompt).strip()
                if not line:
                    continue

                cmd = line.split(maxsplit=1)[0].lower()
                if cmd in ('exit', 'quit'):
                    await self._shutdown()
                    break
                if cmd == 'help':
                    self._show_help()
                    continue

                await self._dispatch(line)

            except KeyboardInterrupt:
                print("\nUse 'exit' to quit.")
            except EOFError:
                await self._shutdown()
                break
            except Exception as e:
                print(f"Error: {e}")

    async def _dispatch(self, line: str):
        try:
            tokens = shlex.split(line)
        except ValueError as e:
            print(f"❌ Could not parse input: {e}")
            return

        try:
            args = self.parser.parse_args(tokens)
        except SystemExit:
            # argparse already printed an error/usage message to stderr.
            return

        func = getattr(args, 'func', None)
        if func is None:
            print(f"Unknown command: {tokens[0] if tokens else ''}. Type 'help' for available commands.")
            return

        result = func(args, self.store)
        if inspect.isawaitable(result):
            await result

    async def _shutdown(self):
        self.running = False
        print("Goodbye!")

    def _show_help(self):
        print("""
Available commands:
  characters [--list|--add|--delete ID]  - Manage characters
  timers [--list|--add|--tick ID]        - Manage timers
  roll --attr A --skill S --dv N         - Roll dice
  deck [--build|--draw N|--crown|--shuffle|--history] - Deck operations
  server [--upload|--load|--delete] --server URL --code CODE
  websocket --server URL --code CODE     - Connect to WebSocket
  modules [--list|--push|--cleanup]      - Module management
  config [--set-api-key KEY|--show]      - Configuration
  help                                   - Show this help
  exit                                   - Exit the shell
""")


async def run_shell(store: DataStore):
    await InteractiveShell(store).run()
