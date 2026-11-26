#!/usr/bin/env python3
"""
Fate's Edge Server CLI Management Tool
For managing the Fate's Edge WebSocket server, rooms, users, modules, and
ad-hoc timers. Entry point for both standalone usage and Docker containers.

If run without arguments in a non-interactive environment (e.g., Docker),
it automatically starts the server. Otherwise, it runs the interactive shell
or executes the given command.

RESTORED in v1.6.0: a prior edit (see git history) had silently gutted this
file from ~1080 lines to ~570, replacing cmd_rooms/cmd_modules/cmd_backup/
cmd_restore/cmd_config and most of ServerClient's methods with comments
claiming they were "unchanged" -- they were gone, and typing `rooms ...`
just errored with "Unknown command" despite the help text still advertising
it. This version restores that functionality from the last commit that had
it, re-verified and updated against the CURRENT server/api.js route surface
(quite a bit of which had moved since: grid-combat/tokens live under
/whiteboard/ now, there's no single-room GET/DELETE/create REST route
anymore -- rooms are created implicitly the moment any client connects, see
room.js's createRoom() -- and a generic /state or /chat REST route was
never brought back after the socket-only chat/VTT-state paths took over).
Commands with no current server-side equivalent were dropped rather than
left silently broken; see each removed command's note below.

Features:
- Server lifecycle management (start/stop/restart/docker)
- Room management with deck operations
- Client management (list, kick, ban, unban)
- Module management (push/cleanup/list)
- Grid Combat support (tokens, live under /whiteboard/)
- Ad-hoc Timers (server/timers.js) -- NEW in v1.6.0
- Backup & Restore (local snapshot of room/module listings)
- Interactive mode with tab completion
- Docker integration

Usage:
    fates-edge-cli --help
    fates-edge-cli server start [--port PORT] [--host HOST] [--api-key KEY]
    fates-edge-cli server stop
    fates-edge-cli server restart
    fates-edge-cli server docker [--image] [--port] [--host-port]
    fates-edge-cli status
    fates-edge-cli rooms list
    fates-edge-cli rooms clients list CODE
    fates-edge-cli rooms clients kick CODE --id CLIENT_ID [--reason REASON]
    fates-edge-cli rooms timer create CODE --name NAME --segments N
    fates-edge-cli rooms timer tick CODE --name NAME [--amount N]
    ...
"""

import sys
import os
import json
import argparse
import subprocess
import time
import signal
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import readline
import getpass
import socket
import tempfile
import re
import shlex
import urllib.request
import urllib.error
from urllib.parse import urljoin, quote

# ============================================================
# Constants
# ============================================================

VERSION = "1.7.0"
DEFAULT_CONFIG_PATH = Path.home() / ".fates-edge" / "cli-config.json"

# Detect if running inside a container
INSIDE_CONTAINER = os.path.exists('/.dockerenv') or os.getenv('CONTAINER') == 'docker'

# Adjust default server URL for container or host
if INSIDE_CONTAINER:
    DEFAULT_SERVER_URL = "http://host.docker.internal:10000"  # default for Docker on Linux/macOS
    # On Windows, use host.docker.internal as well; on some setups, use 172.17.0.1
else:
    DEFAULT_SERVER_URL = "http://localhost:10000"

DEFAULT_API_KEY = ""
DEFAULT_WS_URL = "ws://localhost:10000"
HISTORY_PATH = Path.home() / ".fates-edge" / "cli-history"
SERVER_LOG_PATH = Path.home() / ".fates-edge" / "server.log"


class CLIError(Exception):
    """A command failed; the message is already user-facing. The
    interactive shell prints it and carries on; one-shot mode exits 1."""


class NoRoom(CLIError):
    """The room isn't open. Not a failure: rooms exist only while someone
    is connected, so this is reported as information and exits 0."""
    def __init__(self, code: str):
        self.code = code.upper()
        super().__init__(f"No room {self.code} is open right now (a room exists only while someone is connected to it).")


# ============================================================
# Color Output
# ============================================================

class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    PURPLE = '\033[95m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

    ENABLED = sys.stdout.isatty() and not os.environ.get('NO_COLOR')

    @staticmethod
    def colorize(text: str, color: str) -> str:
        return f"{color}{text}{Colors.ENDC}" if Colors.ENABLED else text

def print_success(text): print(Colors.colorize(f"✅ {text}", Colors.GREEN))
def print_error(text): print(Colors.colorize(f"❌ {text}", Colors.RED), file=sys.stderr)
def print_warning(text): print(Colors.colorize(f"⚠️  {text}", Colors.YELLOW))
def print_info(text): print(Colors.colorize(f"ℹ️  {text}", Colors.CYAN))
def print_header(text): print(Colors.colorize(f"\n{text}\n{'=' * len(text)}", Colors.HEADER + Colors.BOLD))
def print_data(text): print(Colors.colorize(text, Colors.PURPLE))

# ============================================================
# Configuration
# ============================================================

class Config:
    def __init__(self, path: Path = DEFAULT_CONFIG_PATH):
        self.path = path
        self.data = self._load()

    def _load(self) -> Dict:
        if self.path.exists():
            try:
                with open(self.path, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {}

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path, 'w') as f:
            json.dump(self.data, f, indent=2)

    def get(self, key: str, default=None):
        return self.data.get(key, default)

    def set(self, key: str, value: Any):
        self.data[key] = value
        self.save()

    def get_server_url(self) -> str:
        # Environment first (the Docker image sets FATES_EDGE_SERVER_URL),
        # then the saved config, then the default.
        return os.environ.get('FATES_EDGE_SERVER_URL') or self.get('server_url') or DEFAULT_SERVER_URL

    def get_api_key(self) -> str:
        # FATES_EDGE_API_KEY, else the server's own API_KEY (same machine
        # or container), else the saved config.
        return os.environ.get('FATES_EDGE_API_KEY') or os.environ.get('API_KEY') or self.get('api_key') or DEFAULT_API_KEY

    def get_ws_url(self) -> str:
        return self.get('ws_url', DEFAULT_WS_URL)

# ============================================================
# Server Client
# ============================================================

class ServerClient:
    def __init__(self, config: Config):
        self.config = config
        self.server_url = config.get_server_url()
        self.api_key = config.get_api_key()
        self.headers = {"X-API-Key": self.api_key} if self.api_key else {}

    def _request(self, method: str, endpoint: str, data: Dict = None, timeout: int = 30) -> Dict:
        """Call the server's REST API. Raises CLIError with a clear message."""
        url = urljoin(self.server_url, endpoint)
        body = json.dumps(data).encode() if data is not None and method in ('POST', 'PUT') else None
        headers = dict(self.headers)
        if body is not None:
            headers['Content-Type'] = 'application/json'
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            raw = e.read().decode('utf-8', 'replace')
            try:
                detail = json.loads(raw).get('error') or raw
            except Exception:
                detail = raw or e.reason
            # Every room route reports a missing room as "Room CODE not
            # found", with a 400, 404 or 500 depending on the route.
            missing = re.match(r'^Room (\S+) not found$', str(detail).strip())
            if missing:
                raise NoRoom(missing.group(1))
            if e.code == 401:
                raise CLIError("Authentication failed: no API key sent. Set one with: config set api_key YOUR_KEY (or FATES_EDGE_API_KEY).")
            if e.code == 403:
                raise CLIError(f"Forbidden: {detail}. Check the API key matches the server's API_KEY.")
            if e.code == 404:
                raise CLIError(f"Not found: {detail} (a room exists only while someone is connected to it).")
            raise CLIError(f"HTTP {e.code}: {detail}")
        except urllib.error.URLError as e:
            raise CLIError(f"Could not connect to {self.server_url} ({e.reason}). Is the server running? Set the URL with: config set server_url URL")
        except TimeoutError:
            raise CLIError(f"Request to {url} timed out after {timeout}s")
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except ValueError:
            return {'text': raw}

    def health(self) -> Dict:
        """Server health with room/client counts (no API key needed)"""
        return self._request('GET', '/api/health')

    # ─── Adventure (server-side; see server/adventure.js) ───────────
    def get_adventure(self, code: str) -> Dict:
        return self._request('GET', f'/api/rooms/{quote(code)}/adventure')

    def adventure_next(self, code: str) -> Dict:
        return self._request('POST', f'/api/rooms/{quote(code)}/adventure/scene', {})

    def adventure_load(self, code: str, module_id: str) -> Dict:
        return self._request('POST', f'/api/rooms/{quote(code)}/adventure/load', {'moduleId': module_id})

    def adventure_reset(self, code: str) -> Dict:
        return self._request('POST', f'/api/rooms/{quote(code)}/adventure/reset', {})

    def adventure_log(self, code: str, text: str) -> Dict:
        return self._request('POST', f'/api/rooms/{quote(code)}/adventure/log', {'text': text, 'author': 'CLI'})

    def adventure_tick(self, code: str, scope: str, ref: str, amount: int) -> Dict:
        ref_value = int(ref) if str(ref).isdigit() else ref
        return self._request('POST', f'/api/rooms/{quote(code)}/adventure/timer', {'scope': scope, 'ref': ref_value, 'amount': amount})

    # ─── Characters and roles ───────────────────────────────────────
    def list_characters(self, code: str) -> List[Dict]:
        return self._request('GET', f'/api/rooms/{quote(code)}/characters').get('characters', [])

    def set_role(self, code: str, client_id: str, role: str, persist: bool = False) -> Dict:
        return self._request('POST', f'/api/rooms/{quote(code)}/clients/{quote(client_id)}/role', {'role': role, 'persist': persist})

    # ─── Rooms ──────────────────────────────────────────────────────
    # NOTE: there is no REST route to create/delete/fetch a single room.
    # Rooms are created implicitly the moment any client (WS/Socket.io)
    # connects with that room code (see server/room.js's createRoom(),
    # called from ws-handlers.js/socketio-handlers.js on join) -- so
    # `rooms create`/`rooms delete` from earlier CLI versions have no
    # server-side equivalent any more and are not offered here. `info`
    # below is synthesized client-side by filtering the room list.
    def list_rooms(self) -> List[Dict]:
        """List all rooms"""
        result = self._request('GET', '/api/rooms')
        return result.get('rooms', [])

    def get_room_info(self, code: str) -> Optional[Dict]:
        """Find one room's stats from the room list (no single-room GET route exists)"""
        for r in self.list_rooms():
            if str(r.get('code', '')).upper() == code.upper():
                return r
        return None

    def deck_draw(self, code: str, count: int = 1, region: str = 'Acasia') -> Dict:
        """Draw cards from deck"""
        return self._request('POST', f'/api/rooms/{code}/deck/draw', {'count': count, 'region': region})

    def deck_crown(self, code: str, region: str = 'Acasia') -> Dict:
        """Draw a Crown Spread"""
        return self._request('POST', f'/api/rooms/{code}/deck/crown', {'region': region})

    def deck_shuffle(self, code: str) -> Dict:
        """Shuffle deck"""
        return self._request('POST', f'/api/rooms/{code}/deck/shuffle')

    def deck_history(self, code: str, limit: int = 50) -> Dict:
        """Get deck history"""
        return self._request('GET', f'/api/rooms/{code}/deck/history?limit={limit}')

    def deck_clear_history(self, code: str) -> Dict:
        """Clear deck history"""
        return self._request('DELETE', f'/api/rooms/{code}/deck/history')

    # ─── Modules ────────────────────────────────────────────────────
    def list_modules(self) -> List[Dict]:
        """List available modules"""
        result = self._request('GET', '/api/modules')
        return result.get('modules', [])

    def push_module(self, module_id: str, room_code: str = None) -> Dict:
        """Push a module to clients"""
        data = {}
        if room_code:
            data['roomCode'] = room_code
        return self._request('POST', f'/api/modules/{module_id}/push', data)

    def cleanup_module(self, module_id: str, room_code: str = None) -> Dict:
        """Cleanup a module from clients"""
        data = {}
        if room_code:
            data['roomCode'] = room_code
        return self._request('POST', f'/api/modules/{module_id}/cleanup', data)

    # ─── Whiteboard / Grid Combat ───────────────────────────────────
    # NOTE: token add/move now address grid CELLS (col/row), not raw
    # canvas pixels -- the server derives x/y from col/row * cellSize
    # (see server/api.js's tokenCellToPixel()). There is also no
    # wholesale "sync this whole whiteboard JSON" REST route any more
    # (that's socket-only, `whiteboard-update`); `whiteboard-sync` is not
    # offered here for that reason.
    def get_whiteboard(self, code: str) -> Dict:
        """Get whiteboard state (drawings/notes/images/gridCombat)"""
        return self._request('GET', f'/api/rooms/{code}/whiteboard')

    def toggle_grid_combat(self, code: str, enabled: bool = None, grid_type: str = None, cell_size: int = None) -> Dict:
        """Enable/disable grid combat and/or change its grid type or cell size"""
        data = {}
        if enabled is not None:
            data['enabled'] = enabled
        if grid_type:
            data['gridType'] = grid_type
        if cell_size:
            data['cellSize'] = cell_size
        return self._request('POST', f'/api/rooms/{code}/whiteboard/grid-combat', data)

    def add_token(self, code: str, token: Dict) -> Dict:
        """Add (or update, if it has an existing id) a grid combat token"""
        return self._request('POST', f'/api/rooms/{code}/whiteboard/tokens', {'token': token})

    def move_token(self, code: str, token_id: str, col: int, row: int) -> Dict:
        """Move a grid combat token to a new cell"""
        return self._request('POST', f'/api/rooms/{code}/whiteboard/tokens/{token_id}/move', {'col': col, 'row': row})

    def remove_token(self, code: str, token_id: str) -> Dict:
        """Remove a grid combat token"""
        return self._request('DELETE', f'/api/rooms/{code}/whiteboard/tokens/{token_id}')

    # ─── Client management ──────────────────────────────────────────
    def get_clients(self, code: str) -> List[Dict]:
        """List clients in a room"""
        result = self._request('GET', f'/api/rooms/{code}/clients')
        return result.get('clients', [])

    def kick_client(self, code: str, client_id: str, reason: str = 'Kicked by CLI') -> Dict:
        """Kick a client from a room"""
        return self._request('POST', f'/api/rooms/{code}/clients/{client_id}/kick', {'reason': reason})

    def ban_client(self, code: str, client_id: str, reason: str = 'Banned by CLI') -> Dict:
        """Ban a client from a room"""
        return self._request('POST', f'/api/rooms/{code}/clients/{client_id}/ban', {'reason': reason})

    def unban_client(self, code: str, client_id: str) -> Dict:
        """Unban a client from a room"""
        return self._request('POST', f'/api/rooms/{code}/clients/{client_id}/unban')

    # ─── Ad-Hoc Timers (server/timers.js) ──────────────────────────
    # NEW in v1.6.0. Deliberately separate from the adventure module's
    # own pre-authored scene/campaign timers (POST .../adventure/timer,
    # not exposed here) -- these are GM-improvised timers ("Guard
    # Patrol", "Village Unrest") that exist independent of any loaded
    # adventure. See server/timers.js's header doc for the full
    # rationale, and fates-edge-web-client's/fates-edge-roll20's/the
    # Discord bot's equivalent ad-hoc timer commands for the same
    # capability on other clients.
    def list_timers(self, code: str) -> Dict:
        """Get the room's active ad-hoc timers plus a recent log slice"""
        return self._request('GET', f'/api/rooms/{code}/timers')

    def create_timer(self, code: str, name: str, segments: int, description: str = '') -> Dict:
        """Create (or re-arm, if a timer of the same name exists) an ad-hoc timer"""
        return self._request('POST', f'/api/rooms/{code}/timers', {'name': name, 'segments': segments, 'description': description})

    def tick_timer(self, code: str, ref: str, amount: int = 1) -> Dict:
        """Tick a timer forward (or back, with a negative amount)"""
        return self._request('POST', f'/api/rooms/{code}/timers/tick', {'ref': ref, 'amount': amount})

    def resolve_timer(self, code: str, ref: str) -> Dict:
        """Resolve a (typically filled) timer -- removes it and returns its data for narration"""
        return self._request('POST', f'/api/rooms/{code}/timers/resolve', {'ref': ref})

    def remove_timer(self, code: str, ref: str) -> Dict:
        """Remove a timer outright, no fill/resolve narration"""
        return self._request('DELETE', f'/api/rooms/{code}/timers/{ref}')

# ============================================================
# Server Control Commands
# ============================================================

def cmd_server_start(args, config: Config):
    """Start the Fate's Edge server (standalone)"""
    port = args.port or os.environ.get('PORT', 10000)
    host = args.host or '0.0.0.0'
    api_key = args.api_key or os.environ.get('API_KEY', '')

    # Check if server is already running
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex((host, int(port)))
    sock.close()

    if result == 0:
        print_warning(f"Server is already running on {host}:{port}")
        return True

    print_info(f"Starting Fate's Edge Server on {host}:{port}...")

    # The entry point is server-start.js in a checkout and server.js in
    # the Docker image; look next to this script first, then here.
    script_dir = Path(__file__).resolve().parent
    candidates = [script_dir / 'server-start.js', Path.cwd() / 'server-start.js', Path.cwd() / 'server.js']
    server_path = next((p for p in candidates if p.exists()), None)
    if not server_path:
        print_error("Could not find server-start.js (or server.js). Run this from the server directory.")
        return False

    SERVER_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        env = os.environ.copy()
        env['PORT'] = str(port)
        env['HOST'] = host
        if api_key:
            env['API_KEY'] = api_key
        # Server output goes to a log file. It used to go to an unread
        # pipe, which blocked the server once ~64 KB of logs piled up.
        log_file = open(SERVER_LOG_PATH, 'a')
        process = subprocess.Popen(
            ['node', str(server_path)],
            cwd=str(server_path.parent), env=env,
            stdout=log_file, stderr=subprocess.STDOUT,
            start_new_session=True,
        )

        # Wait for the health endpoint rather than a fixed sleep.
        url = f"http://127.0.0.1:{port}/healthz"
        for _ in range(40):
            if process.poll() is not None:
                break
            try:
                urllib.request.urlopen(url, timeout=1).close()
                break
            except Exception:
                time.sleep(0.25)

        if process.poll() is None:
            print_success(f"Server started on {host}:{port} (PID: {process.pid})")
            print_info(f"WebSocket: ws://localhost:{port}   HTTP: http://localhost:{port}")
            print_info(f"Logs: {SERVER_LOG_PATH}  (fates-edge-cli logs --follow)")
            config.set('server_pid', process.pid)
            config.set('server_port', port)
            config.set('server_host', host)
            config.set('server_url', f"http://localhost:{port}")
            if api_key:
                config.set('api_key', api_key)
            return True
        print_error("Server exited during startup. Last log lines:")
        for line in tail_file(SERVER_LOG_PATH, 15):
            print("   " + line)
        return False

    except Exception as e:
        print_error(f"Failed to start server: {e}")
        return False


def tail_file(path: Path, lines: int) -> List[str]:
    """Last `lines` lines of a text file (empty list if missing)."""
    try:
        with open(path, 'rb') as fh:
            fh.seek(0, os.SEEK_END)
            size = fh.tell()
            block = min(size, 64 * 1024 * max(1, lines // 200 + 1))
            fh.seek(size - block)
            return fh.read().decode('utf-8', 'replace').splitlines()[-lines:]
    except OSError:
        return []

def cmd_server_stop(args, config: Config):
    """Stop the Fate's Edge server (standalone)"""
    pid = config.get('server_pid')
    if not pid:
        print_warning("No server PID found. Server may not be running.")
        return True

    try:
        os.kill(pid, signal.SIGTERM)
        for _ in range(10):
            time.sleep(0.5)
            try:
                os.kill(pid, 0)
            except OSError:
                config.set('server_pid', None)
                print_success("Server stopped")
                return True

        try:
            os.kill(pid, signal.SIGKILL)
            print_warning("Server was force killed")
        except OSError:
            pass

        config.set('server_pid', None)
        print_success("Server stopped")
        return True

    except OSError:
        print_warning("Process not found. Server may already be stopped.")
        config.set('server_pid', None)
        return True
    except Exception as e:
        print_error(f"Failed to stop server: {e}")
        return False

def cmd_server_restart(args, config: Config):
    """Restart the Fate's Edge server (standalone)"""
    print_info("Restarting server...")
    if not cmd_server_stop(args, config):
        return False
    time.sleep(1)
    return cmd_server_start(args, config)

def cmd_server_docker(args, config: Config):
    """Run the server inside a Docker container (using the current image)"""
    image = args.image or 'fates-edge:latest'
    port = args.port or 10000
    host_port = args.host_port or port

    cmd = [
        'docker', 'run', '-d',
        '--name', f'fates-edge-{int(time.time())}',
        '-p', f'{host_port}:{port}',
        '-e', f'PORT={port}',
        '-e', 'NODE_ENV=production',
        image
    ]

    if args.api_key:
        cmd.extend(['-e', f'API_KEY={args.api_key}'])

    print_info(f"Starting Docker container from image {image} on port {host_port}...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            container_id = result.stdout.strip()
            print_success(f"Container started: {container_id}")
            print_info(f"Server should be accessible at http://localhost:{host_port}")
            return True
        else:
            print_error(f"Docker run failed: {result.stderr}")
            return False
    except FileNotFoundError:
        print_error("Docker not found. Please install Docker.")
        return False

# ============================================================
# Formatting helpers
# ============================================================

def format_duration(seconds) -> str:
    seconds = int(seconds or 0)
    d, rem = divmod(seconds, 86400)
    h, rem = divmod(rem, 3600)
    m = rem // 60
    return f"{d}d {h}h" if d else f"{h}h {m}m" if h else f"{m}m"

def format_time(ms) -> str:
    return datetime.fromtimestamp(ms / 1000).strftime('%Y-%m-%d %H:%M') if ms else '—'

def format_ago(ms) -> str:
    if not ms:
        return '—'
    return format_duration(max(0, time.time() - ms / 1000)) + ' ago'

def harm_label(harm, dead=False) -> str:
    if dead:
        return 'DEAD'
    harm = int(harm or 0)
    return f"{harm}" + (' (down)' if harm >= 3 else '')

def print_table(headers: List[str], rows: List[List[str]]):
    """A plain aligned table; columns size to their content."""
    widths = [max(len(str(h)), *(len(str(r[i])) for r in rows)) if rows else len(str(h)) for i, h in enumerate(headers)]
    print("  " + "  ".join(Colors.colorize(str(h).ljust(w), Colors.BOLD) for h, w in zip(headers, widths)))
    for row in rows:
        print("  " + "  ".join(str(c).ljust(w) for c, w in zip(row, widths)))

def print_rooms_table(rooms: List[Dict]):
    print_table(['Room', 'Clients', 'GM', 'Adventure', 'Last activity'], [
        [r.get('code', '?'), f"{r.get('clients', 0)}" + (f" ({r.get('bots')} bot)" if r.get('bots') else ''),
         r.get('gm') or '—', (r.get('adventure') or {}).get('title') or '—', format_ago(r.get('lastActivity'))]
        for r in sorted(rooms, key=lambda r: -(r.get('lastActivity') or 0))])

ROLE_ICONS = {'gm': '👑', 'co-gm': '🛡️', 'assistant-gm': '🤖', 'spectator': '👁️'}

def print_clients(clients: List[Dict]):
    print_table(['', 'Name', 'Role', 'Character', 'ID'], [
        [ROLE_ICONS.get(c.get('role'), '👤'), c.get('name') or '?', c.get('role') or 'player',
         ', '.join(c.get('selectedCharacters') or []) or c.get('selectedCharacter') or '—', c.get('id', '')]
        for c in clients])

def print_adventure(state: Dict, with_log: bool = True):
    if not state.get('moduleId'):
        print_info("No adventure loaded. Load one with: rooms adventure CODE load MODULE")
        return
    scene = state.get('currentScene') or {}
    print_header(f"{state.get('title', 'Adventure')} — {state.get('status', '')}")
    print(f"  Act: {(state.get('currentAct') or {}).get('title', '—')}")
    print(f"  Scene: {scene.get('title', '—')}")
    enc = state.get('activeEncounter')
    if enc:
        print(f"  Encounter: {enc.get('name', '?')}" + (f" (DV {enc.get('dv')})" if enc.get('dv') else ''))
    clocks = [('scene', i, t) for i, t in enumerate(scene.get('timers') or [])] + [('campaign', i, t) for i, t in enumerate(state.get('campaignTimers') or [])]
    for scope, i, t in clocks:
        segs = max(1, int(t.get('segments') or 1))
        cur = min(segs, int(t.get('current') or 0))
        print(f"  ⏱️  {t.get('name', 'Clock')} [{scope} {i}]  {'■' * cur}{'□' * (segs - cur)}  {cur}/{segs}")
    if state.get('dynamicGrowth'):
        print(f"  Growing: sessions {state.get('sessionsPlayed', 0)}/{state.get('climaxAfterSessions', '?')}, climax {'started' if state.get('climaxTriggered') else 'not yet'}")
    if with_log and state.get('log'):
        print("  Recent:")
        for entry in state['log'][-5:]:
            print(f"    · {entry.get('message', '')}")

def capture(fn, *args) -> List[str]:
    """Run a printing helper and return its output lines (for watch)."""
    import io, contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        fn(*args)
    return buf.getvalue().splitlines()

# ============================================================
# CLI Class
# ============================================================

class CLI:
    def __init__(self):
        self.config = Config()
        self.client = ServerClient(self.config)
        self._setup_completion()
        self.running = True

    def _setup_completion(self):
        """Tab completion for every command level, plus saved history."""
        try:
            readline.parse_and_bind("tab: complete")
            readline.parse_and_bind("bind ^I rl_complete")  # libedit (macOS)
            readline.set_completer_delims(' \t\n')
            readline.set_completer(self._completer)
            HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
            if HISTORY_PATH.exists():
                readline.read_history_file(str(HISTORY_PATH))
            readline.set_history_length(1000)
        except Exception:
            pass

    def _command_tree(self, parser=None) -> Dict:
        """{word: subtree} from the argparse subcommands, for completion."""
        parser = parser or self._build_parser()
        tree = {}
        for action in parser._actions:
            if isinstance(action, argparse._SubParsersAction):
                for name, sub in action.choices.items():
                    tree[name] = self._command_tree(sub)
            elif action.option_strings and action.dest != 'help':
                for opt in action.option_strings:
                    if opt.startswith('--'):
                        tree[opt] = {}
        return tree

    def _completer(self, text, state):
        if state == 0:
            if not hasattr(self, '_tree'):
                self._tree = self._command_tree()
                self._tree.update({'help': {}, 'exit': {}, 'quit': {}})
            words = readline.get_line_buffer().split()
            if text and words:
                words = words[:-1]
            node = self._tree
            for word in words:
                node = node.get(word, node if word.startswith('-') or word not in node else {})
            self._matches = sorted(w for w in node if w.startswith(text))
        return self._matches[state] if state < len(self._matches) else None

    def run(self, argv: List[str]):
        """Run one command; returns the handler's result. Raises CLIError."""
        if argv and argv[0] == 'help':
            self.print_help()
            return True
        args = self._parse_args(argv)
        if not args:
            return False
        if not args.command:
            self.print_help()
            return True
        handler = getattr(self, f'cmd_{args.command}', None)
        if not handler:
            raise CLIError(f"Unknown command: {args.command} (try: help)")
        try:
            return handler(args)
        except NoRoom as e:
            print_info(str(e))
            return True

    def interactive(self):
        """Interactive shell. A failed command prints its error and the
        shell carries on; it used to exit the whole console."""
        print_header("Fate's Edge CLI v" + VERSION)
        print_info(f"Server: {self.client.server_url}   API key: {'set' if self.client.api_key else 'not set'}")
        print_info("Type 'help' for commands, Tab to complete, 'exit' to quit\n")

        while self.running:
            try:
                line = input(Colors.colorize("fe> ", Colors.GREEN)).strip()
                if not line:
                    continue
                if line in ('exit', 'quit'):
                    break
                self.run(shlex.split(line))
            except CLIError as e:
                print_error(str(e))
            except ValueError as e:  # shlex: unbalanced quotes
                print_error(f"Could not read that command: {e}")
            except SystemExit:
                pass  # argparse already printed its usage message
            except KeyboardInterrupt:
                print()
            except EOFError:
                print()
                break
            except Exception as e:
                print_error(f"Unexpected error: {e}")
        try:
            readline.write_history_file(str(HISTORY_PATH))
        except Exception:
            pass
        print_info("Goodbye!")

    def _parse_args(self, argv):
        """Parse a command; None if argparse rejected it (it prints why)."""
        try:
            return self._build_parser().parse_args(argv)
        except SystemExit:
            return None

    def _build_parser(self):
        """The full command grammar (also drives tab completion)."""
        parser = argparse.ArgumentParser(prog='fates-edge-cli')
        subparsers = parser.add_subparsers(dest='command', help='Commands')

        # Server Control
        server_parser = subparsers.add_parser('server', help='Manage server process')
        server_subparsers = server_parser.add_subparsers(dest='action', help='Server actions')

        server_start = server_subparsers.add_parser('start', help='Start server (standalone)')
        server_start.add_argument('--port', type=int, help='Port to listen on')
        server_start.add_argument('--host', default='0.0.0.0', help='Host to bind to')
        server_start.add_argument('--api-key', help='API key to set in environment')

        server_subparsers.add_parser('stop', help='Stop server (standalone)')
        server_subparsers.add_parser('restart', help='Restart server (standalone)')

        server_docker = server_subparsers.add_parser('docker', help='Run server in Docker container')
        server_docker.add_argument('--image', help='Docker image name (default: fates-edge:latest)')
        server_docker.add_argument('--port', type=int, default=10000, help='Container internal port')
        server_docker.add_argument('--host-port', type=int, help='Host port to map (default: same as --port)')
        server_docker.add_argument('--api-key', help='API key to set in container environment')

        # Health & Status
        subparsers.add_parser('health', help='Check server health')
        subparsers.add_parser('status', help='Get server status')

        # Rooms
        rooms_parser = subparsers.add_parser('rooms', help='Manage rooms')
        rooms_subparsers = rooms_parser.add_subparsers(dest='action', help='Room actions')

        rooms_subparsers.add_parser('list', help='List all rooms')
        rooms_info = rooms_subparsers.add_parser('info', help='Get room details (from the room list)')
        rooms_info.add_argument('code', type=str.upper, help='Room code')

        # Deck operations
        deck_parser = rooms_subparsers.add_parser('draw', help='Draw cards from deck')
        deck_parser.add_argument('code', type=str.upper, help='Room code')
        deck_parser.add_argument('--count', type=int, default=1, help='Number of cards to draw')
        deck_parser.add_argument('--region', default='Acasia', help='Region name')

        crown_parser = rooms_subparsers.add_parser('crown', help='Draw a Crown Spread')
        crown_parser.add_argument('code', type=str.upper, help='Room code')
        crown_parser.add_argument('--region', default='Acasia', help='Region name')

        shuffle_parser = rooms_subparsers.add_parser('shuffle', help='Shuffle deck')
        shuffle_parser.add_argument('code', type=str.upper, help='Room code')

        history_parser = rooms_subparsers.add_parser('deck-history', help='View deck history')
        history_parser.add_argument('code', type=str.upper, help='Room code')
        history_parser.add_argument('--limit', type=int, default=50, help='Number of entries to show')

        history_clear = rooms_subparsers.add_parser('deck-history-clear', help='Clear deck history')
        history_clear.add_argument('code', type=str.upper, help='Room code')

        # Grid Combat / Whiteboard
        grid_parser = rooms_subparsers.add_parser('grid-combat', help='Toggle/configure grid combat mode')
        grid_parser.add_argument('code', type=str.upper, help='Room code')
        grid_parser.add_argument('--enable', action='store_true', help='Enable grid combat')
        grid_parser.add_argument('--disable', action='store_true', help='Disable grid combat')
        grid_parser.add_argument('--grid-type', choices=['square', 'hex', 'isometric'], help='Grid type')
        grid_parser.add_argument('--cell-size', type=int, help='Cell size in pixels')

        whiteboard_parser = rooms_subparsers.add_parser('whiteboard', help='Get whiteboard state')
        whiteboard_parser.add_argument('code', type=str.upper, help='Room code')

        # Tokens (addressed by grid cell -- col/row, not raw x/y pixels)
        token_parser = rooms_subparsers.add_parser('token', help='Manage grid combat tokens')
        token_subparsers = token_parser.add_subparsers(dest='token_action')

        token_add = token_subparsers.add_parser('add', help='Add (or update) a token')
        token_add.add_argument('code', type=str.upper, help='Room code')
        token_add.add_argument('--name', required=True, help='Token label')
        token_add.add_argument('--id', help='Existing token id, to update it in place')
        token_add.add_argument('--col', type=int, default=0, help='Grid column')
        token_add.add_argument('--row', type=int, default=0, help='Grid row')
        token_add.add_argument('--faction', choices=['ally', 'enemy'], default='enemy', help='Token faction')
        token_add.add_argument('--color', help='Token color (hex)')
        token_add.add_argument('--body', type=int, help='Body/health value')

        token_move = token_subparsers.add_parser('move', help='Move a token to a new cell')
        token_move.add_argument('code', type=str.upper, help='Room code')
        token_move.add_argument('--id', required=True, help='Token ID')
        token_move.add_argument('--col', type=int, required=True, help='Grid column')
        token_move.add_argument('--row', type=int, required=True, help='Grid row')

        token_remove = token_subparsers.add_parser('remove', help='Remove a token')
        token_remove.add_argument('code', type=str.upper, help='Room code')
        token_remove.add_argument('--id', required=True, help='Token ID')

        # Client management
        clients_parser = rooms_subparsers.add_parser('clients', help='Manage clients in a room')
        clients_subparsers = clients_parser.add_subparsers(dest='clients_action')

        clients_list = clients_subparsers.add_parser('list', help='List clients in a room')
        clients_list.add_argument('code', type=str.upper, help='Room code')

        client_kick = clients_subparsers.add_parser('kick', help='Kick a client from a room')
        client_kick.add_argument('code', type=str.upper, help='Room code')
        client_kick.add_argument('--id', required=True, help='Client ID')
        client_kick.add_argument('--reason', default='Kicked by CLI', help='Reason for kick')

        client_ban = clients_subparsers.add_parser('ban', help='Ban a client from a room')
        client_ban.add_argument('code', type=str.upper, help='Room code')
        client_ban.add_argument('--id', required=True, help='Client ID')
        client_ban.add_argument('--reason', default='Banned by CLI', help='Reason for ban')

        client_unban = clients_subparsers.add_parser('unban', help='Unban a client from a room')
        client_unban.add_argument('code', type=str.upper, help='Room code')
        client_unban.add_argument('--id', required=True, help='Client ID')

        client_role = clients_subparsers.add_parser('role', help='Change a client\'s role')
        client_role.add_argument('code', type=str.upper, help='Room code')
        client_role.add_argument('--id', required=True, help='Client ID')
        client_role.add_argument('--role', required=True, choices=['gm', 'co-gm', 'assistant-gm', 'player', 'spectator'], help='New role')
        client_role.add_argument('--persist', action='store_true', help='Keep the role for this account in future sessions')

        # Adventure (server-side, the one the AI GM runs)
        adv_parser = rooms_subparsers.add_parser('adventure', help='Show or drive the room\'s adventure')
        adv_parser.add_argument('code', type=str.upper, help='Room code')
        adv_sub = adv_parser.add_subparsers(dest='adventure_action')
        adv_sub.add_parser('show', help='Show the current scene, clocks and log (default)')
        adv_sub.add_parser('next', help='Advance to the next scene')
        adv_load = adv_sub.add_parser('load', help='Load an adventure module')
        adv_load.add_argument('module', help='Module ID (see: modules list)')
        adv_sub.add_parser('reset', help='Reset the adventure to its start')
        adv_log = adv_sub.add_parser('log', help='Add a line to the adventure log')
        adv_log.add_argument('text', help='Text to log (quote it)')
        adv_tick = adv_sub.add_parser('tick', help='Tick an adventure clock')
        adv_tick.add_argument('ref', help='Clock name or index')
        adv_tick.add_argument('--scope', choices=['scene', 'campaign'], default='scene')
        adv_tick.add_argument('--amount', type=int, default=1)

        chars_parser = rooms_subparsers.add_parser('characters', help='List characters with Harm, Fatigue and Boons')
        chars_parser.add_argument('code', type=str.upper, help='Room code')

        # Ad-Hoc Timers (server/timers.js) -- NEW in v1.6.0
        timer_parser = rooms_subparsers.add_parser('timer', help='Manage ad-hoc timers (independent of any loaded adventure)')
        timer_subparsers = timer_parser.add_subparsers(dest='timer_action')

        timer_list = timer_subparsers.add_parser('list', help='List active ad-hoc timers')
        timer_list.add_argument('code', type=str.upper, help='Room code')

        timer_create = timer_subparsers.add_parser('create', help='Create (or re-arm) an ad-hoc timer')
        timer_create.add_argument('code', type=str.upper, help='Room code')
        timer_create.add_argument('--name', required=True, help='Timer name')
        timer_create.add_argument('--segments', type=int, required=True, help='Number of segments')
        timer_create.add_argument('--description', default='', help='What happens when this timer fills')

        timer_tick = timer_subparsers.add_parser('tick', help='Tick a timer forward (or back, with a negative amount)')
        timer_tick.add_argument('code', type=str.upper, help='Room code')
        timer_tick.add_argument('--name', required=True, help='Timer name')
        timer_tick.add_argument('--amount', type=int, default=1, help='Number of ticks')

        timer_resolve = timer_subparsers.add_parser('resolve', help='Resolve a (typically filled) timer')
        timer_resolve.add_argument('code', type=str.upper, help='Room code')
        timer_resolve.add_argument('--name', required=True, help='Timer name')

        timer_remove = timer_subparsers.add_parser('remove', help='Remove a timer outright, no resolve narration')
        timer_remove.add_argument('code', type=str.upper, help='Room code')
        timer_remove.add_argument('--name', required=True, help='Timer name')

        # Modules
        modules_parser = subparsers.add_parser('modules', help='Manage modules')
        modules_subparsers = modules_parser.add_subparsers(dest='action', help='Module actions')

        modules_subparsers.add_parser('list', help='List available modules')
        module_push = modules_subparsers.add_parser('push', help='Push a module')
        module_push.add_argument('id', help='Module ID')
        module_push.add_argument('--room', help='Room code (optional, default: all rooms)')
        module_cleanup = modules_subparsers.add_parser('cleanup', help='Cleanup a module')
        module_cleanup.add_argument('id', help='Module ID')
        module_cleanup.add_argument('--room', help='Room code (optional, default: all rooms)')

        # Backup & Restore (local snapshot of room/module listings + CLI config)
        backup_parser = subparsers.add_parser('backup', help='Backup server data')
        backup_parser.add_argument('filename', nargs='?', default=None, help='Backup filename')
        backup_parser.add_argument('--path', help='Backup directory path')

        restore_parser = subparsers.add_parser('restore', help='Restore server data')
        restore_parser.add_argument('filename', help='Backup filename')
        restore_parser.add_argument('--path', help='Backup directory path')

        # Config
        config_parser = subparsers.add_parser('config', help='Manage configuration')
        config_subparsers = config_parser.add_subparsers(dest='action', help='Config actions')

        config_get = config_subparsers.add_parser('get', help='Get configuration value')
        config_get.add_argument('key', nargs='?', default=None, help='Configuration key')

        config_set = config_subparsers.add_parser('set', help='Set configuration value')
        config_set.add_argument('key', help='Configuration key')
        config_set.add_argument('value', help='Configuration value')

        config_unset = config_subparsers.add_parser('unset', help='Remove configuration value')
        config_unset.add_argument('key', help='Configuration key')

        # Watch
        watch_parser = subparsers.add_parser('watch', help='Live view of rooms (or one room); Ctrl+C to stop')
        watch_parser.add_argument('code', nargs='?', type=str.upper, help='Room code to focus on')
        watch_parser.add_argument('--interval', type=float, default=3.0, help='Seconds between refreshes')

        # Logs
        logs_parser = subparsers.add_parser('logs', help='View server logs')
        logs_parser.add_argument('--tail', type=int, default=50, help='Number of lines to show')
        logs_parser.add_argument('--follow', '-f', action='store_true', help='Keep printing new lines')
        logs_parser.add_argument('--docker', action='store_true', help='Use docker logs (requires container name)')
        logs_parser.add_argument('--container', help='Docker container name (default: auto-detect)')

        return parser

    def print_help(self):
        """Grouped command overview; add --help to any command for details."""
        groups = [
            ("Server", [
                ("status", "Health plus a table of open rooms"),
                ("health", "Is the server up? (no API key needed)"),
                ("watch [CODE] [--interval S]", "Live view of all rooms, or one room"),
                ("logs [--tail N] [-f] [--docker]", "Server log (from 'server start', or Docker)"),
                ("server start|stop|restart|docker", "Run the server locally or in Docker"),
            ]),
            ("Rooms", [
                ("rooms list", "Open rooms with GM, clients and adventure"),
                ("rooms info CODE", "One room in detail, with its clients"),
                ("rooms characters CODE", "Characters with Harm, Fatigue, Boons, XP"),
                ("rooms clients list|kick|ban|unban CODE --id ID", "Manage connected clients"),
                ("rooms clients role CODE --id ID --role ROLE", "gm, co-gm, assistant-gm, player, spectator"),
            ]),
            ("Adventure (the one the AI GM runs)", [
                ("rooms adventure CODE", "Current act, scene, clocks and recent log"),
                ("rooms adventure CODE next|reset", "Advance the scene, or start over"),
                ("rooms adventure CODE load MODULE", "Load an adventure module"),
                ("rooms adventure CODE tick NAME [--scope] [--amount]", "Tick a scene or campaign clock"),
                ("rooms adventure CODE log \"TEXT\"", "Add a line to the adventure log"),
            ]),
            ("Deck, timers and the table", [
                ("rooms draw|crown|shuffle CODE", "Deck of Consequences / Crown Spread"),
                ("rooms deck-history[-clear] CODE", "Recent draws"),
                ("rooms timer list|create|tick|resolve|remove CODE", "Ad-hoc timers"),
                ("rooms grid-combat|whiteboard|token ... CODE", "Grid combat and tokens"),
            ]),
            ("Other", [
                ("modules list|push|cleanup", "Content modules"),
                ("backup [FILE] / restore FILE", "Local snapshot of rooms and modules"),
                ("config get|set|unset", "server_url, api_key (env FATES_EDGE_SERVER_URL / FATES_EDGE_API_KEY win)"),
                ("help / exit", ""),
            ]),
        ]
        print_header(f"Fate's Edge CLI v{VERSION}")
        for title, rows in groups:
            print(Colors.colorize(f"\n  {title}", Colors.BOLD))
            width = max(len(c) for c, _ in rows)
            for cmd, desc in rows:
                print(f"    {cmd.ljust(width)}  {desc}")
        print("\n  Add --help to any command for its options. Quote arguments with spaces.\n")

    # ============================================================
    # Command Handlers
    # ============================================================

    def cmd_server(self, args):
        """Handle server commands"""
        if args.action == 'start':
            return cmd_server_start(args, self.config)
        elif args.action == 'stop':
            return cmd_server_stop(args, self.config)
        elif args.action == 'restart':
            return cmd_server_restart(args, self.config)
        elif args.action == 'docker':
            return cmd_server_docker(args, self.config)
        else:
            print_error(f"Unknown server action: {args.action}")
            return False

    def cmd_health(self, args):
        """Check server health"""
        data = self.client.health()
        stats = data.get('stats', {})
        print_success(f"Server is up at {self.client.server_url} — {stats.get('totalRooms', 0)} rooms, {stats.get('totalClients', 0)} clients, up {format_duration(data.get('uptime', 0))}")
        return True

    def cmd_status(self, args):
        """Server health plus a table of rooms (needs the API key)"""
        data = self.client.health()
        print_header(f"Fate's Edge server — {self.client.server_url}")
        print(f"  Uptime: {format_duration(data.get('uptime', 0))}")
        rooms = self.client.list_rooms()
        print(f"  Rooms: {len(rooms)}   Clients: {sum(r.get('clients', 0) for r in rooms)}")
        if rooms:
            print()
            print_rooms_table(rooms)
        return True

    def cmd_rooms(self, args):
        """Handle room commands"""
        if args.action is None:
            raise CLIError("Choose a room action, e.g. rooms list (see: help)")
        if args.action == 'list':
            rooms = self.client.list_rooms()
            if rooms:
                print_header(f"Rooms ({len(rooms)})")
                print_rooms_table(rooms)
            else:
                print_info("No rooms open (a room exists while someone is connected)")
        elif args.action == 'info':
            room = self.client.get_room_info(args.code)
            if not room:
                raise NoRoom(args.code)
            print_header(f"Room {room.get('code')}")
            adventure = room.get('adventure')
            print(f"  GM: {room.get('gm') or '—'}   Clients: {room.get('clients', 0)} ({room.get('bots', 0)} bots)   Password: {'yes' if room.get('hasPassword') else 'no'}")
            print(f"  Adventure: {adventure['title'] + ' (' + adventure.get('status', '') + ')' if adventure else '—'}")
            print(f"  Characters: {room.get('characterCount', 0)}   Deck: {room.get('deckRemaining', 0)} cards, {room.get('historyCount', 0)} draws")
            print(f"  Open since: {format_time(room.get('created'))}   Last activity: {format_ago(room.get('lastActivity'))}")
            clients = self.client.get_clients(args.code)
            if clients:
                print()
                print_clients(clients)
        elif args.action == 'adventure':
            self._adventure(args)
        elif args.action == 'characters':
            chars = self.client.list_characters(args.code)
            if not chars:
                print_info("No characters in this room")
            else:
                print_header(f"Characters — room {args.code.upper()} ({len(chars)})")
                print_table(['Name', 'Player', 'Harm', 'Fatigue', 'Boons', 'XP'], [
                    [c.get('name', '?'), c.get('playerName') or '—', harm_label(c.get('harm', 0), c.get('dead')),
                     str(c.get('fatigue', 0)), str(c.get('boons', 0)), str(c.get('xp', 0))] for c in chars])
        elif args.action == 'draw':
            result = self.client.deck_draw(args.code, args.count, args.region)
            print_success(f"Drew {args.count} card(s) from {args.region}")
            cards = result.get('cards', [])
            for card in cards:
                print(f"  {card.get('rankName')} of {card.get('suitName')}")
            synthesis = result.get('synthesis')
            if synthesis:
                text = synthesis if isinstance(synthesis, str) else synthesis.get('synthesis', '')
                print_data(f"\n  Synthesis: {text}")
            print_info(f"Remaining: {result.get('remaining', 0)} cards")
        elif args.action == 'crown':
            result = self.client.deck_crown(args.code, args.region)
            print_success(f"Crown Spread from {args.region}")
            print_data(f"\n  {result.get('result', {}).get('synthesis', '')}")
            print_info(f"Remaining: {result.get('remaining', 0)} cards")
        elif args.action == 'shuffle':
            self.client.deck_shuffle(args.code)
            print_success(f"Deck shuffled for room {args.code}")
        elif args.action == 'deck-history':
            data = self.client.deck_history(args.code, args.limit)
            history = data.get('history', [])
            if history:
                print_header(f"Deck History ({len(history)} entries)")
                for entry in history[-10:]:  # Show last 10
                    print(f"  [{entry.get('type')}] {entry.get('cards')}")
                    synthesis = entry.get('synthesis') or ''
                    print(f"    {synthesis[:100]}...")
            else:
                print_info("No deck history available")
        elif args.action == 'deck-history-clear':
            self.client.deck_clear_history(args.code)
            print_success(f"Deck history cleared for room {args.code}")
        elif args.action == 'grid-combat':
            enabled = True if args.enable else (False if args.disable else None)
            result = self.client.toggle_grid_combat(args.code, enabled, args.grid_type, args.cell_size)
            gc = result.get('gridCombat', {})
            print_success(f"Grid Combat is now {'enabled' if gc.get('enabled') else 'disabled'} for room {args.code} ({gc.get('gridType', 'square')}, cell size {gc.get('cellSize', 40)})")
        elif args.action == 'whiteboard':
            data = self.client.get_whiteboard(args.code)
            print_header(f"Whiteboard - Room {args.code}")
            print(f"  Drawings: {len(data.get('drawings', []))}")
            print(f"  Notes: {len(data.get('notes', []))}")
            print(f"  Images: {len(data.get('images', []))}")
            gc = data.get('gridCombat', {})
            print(f"  Grid Combat: {'Enabled' if gc.get('enabled') else 'Disabled'}")
            print(f"  Grid Type: {gc.get('gridType', 'square')}")
            print(f"  Tokens: {len(gc.get('tokens', []))}")
            for token in gc.get('tokens', []):
                print(f"    {token.get('id')}: {token.get('label')} ({token.get('faction')}) body={token.get('body')}")
        elif args.action == 'token':
            if args.token_action == 'add':
                token_data = {'label': args.name, 'faction': args.faction, 'col': args.col, 'row': args.row}
                if args.id:
                    token_data['id'] = args.id
                if args.color:
                    token_data['color'] = args.color
                if args.body is not None:
                    token_data['body'] = args.body
                result = self.client.add_token(args.code, token_data)
                token = result.get('token', {})
                print_success(f"Token '{args.name}' saved in room {args.code}")
                print_info(f"Token ID: {token.get('id')}")
            elif args.token_action == 'move':
                self.client.move_token(args.code, args.id, args.col, args.row)
                print_success(f"Token {args.id} moved to ({args.col}, {args.row}) in room {args.code}")
            elif args.token_action == 'remove':
                self.client.remove_token(args.code, args.id)
                print_success(f"Token {args.id} removed from room {args.code}")
            else:
                print_error("Specify a token action: add, move, or remove")
        elif args.action == 'clients':
            if args.clients_action == 'list':
                clients = self.client.get_clients(args.code)
                if clients:
                    print_header(f"Clients in room {args.code.upper()} ({len(clients)})")
                    print_clients(clients)
                else:
                    print_info("No clients in room")
            elif args.clients_action == 'kick':
                self.client.kick_client(args.code, args.id, args.reason)
                print_success(f"Client {args.id} kicked from room {args.code}")
            elif args.clients_action == 'ban':
                self.client.ban_client(args.code, args.id, args.reason)
                print_success(f"Client {args.id} banned from room {args.code}")
            elif args.clients_action == 'unban':
                self.client.unban_client(args.code, args.id)
                print_success(f"Client {args.id} unbanned from room {args.code}")
            elif args.clients_action == 'role':
                result = self.client.set_role(args.code, args.id, args.role, args.persist)
                print_success(f"Client {args.id} is now {result.get('role', args.role)}" + (" (kept for future sessions)" if result.get('persist') else ""))
            else:
                print_error(f"Unknown clients action: {args.clients_action}")
        elif args.action == 'timer':
            if args.timer_action == 'list':
                data = self.client.list_timers(args.code)
                timers = data.get('timers', [])
                if timers:
                    print_header(f"Ad-Hoc Timers - Room {args.code} ({len(timers)})")
                    for t in timers:
                        status = '⚠️ COMPLETE' if t.get('full') else '⏳ Active'
                        print(f"  {t.get('name')}: {t.get('current', 0)}/{t.get('segments', 0)} - {status}")
                        if t.get('description'):
                            print(f"    {t.get('description')}")
                else:
                    print_info("No active ad-hoc timers")
            elif args.timer_action == 'create':
                result = self.client.create_timer(args.code, args.name, args.segments, args.description)
                print_success(f"Timer '{args.name}' created ({args.segments} segments) in room {args.code}")
            elif args.timer_action == 'tick':
                result = self.client.tick_timer(args.code, args.name, args.amount)
                ticked = result.get('tickedTimer', {})
                status = '⚠️ COMPLETE' if ticked.get('full') else '⏳ Active'
                print_success(f"Timer '{args.name}': {ticked.get('current', 0)}/{ticked.get('segments', 0)} - {status}")
            elif args.timer_action == 'resolve':
                result = self.client.resolve_timer(args.code, args.name)
                print_success(f"Timer '{args.name}' resolved in room {args.code}")
            elif args.timer_action == 'remove':
                result = self.client.remove_timer(args.code, args.name)
                print_success(f"Timer '{args.name}' removed from room {args.code}")
            else:
                print_error("Specify a timer action: list, create, tick, resolve, or remove")
        else:
            raise CLIError(f"Unknown room action: {args.action}")
        return True

    def _adventure(self, args):
        action = args.adventure_action or 'show'
        if action == 'next':
            state = self.client.adventure_next(args.code)
            print_success(f"Now at: {(state.get('currentScene') or {}).get('title', 'the end of the adventure')}")
        elif action == 'load':
            state = self.client.adventure_load(args.code, args.module)
            print_success(f"Loaded \"{state.get('title', args.module)}\"")
        elif action == 'reset':
            self.client.adventure_reset(args.code)
            print_success("Adventure reset to its first scene")
        elif action == 'log':
            self.client.adventure_log(args.code, args.text)
            print_success("Logged")
        elif action == 'tick':
            self.client.adventure_tick(args.code, args.scope, args.ref, args.amount)
            print_success(f"Ticked {args.scope} clock {args.ref} by {args.amount}")
        state = self.client.get_adventure(args.code)
        print_adventure(state)

    def cmd_watch(self, args):
        """Refresh a live view until Ctrl+C."""
        try:
            while True:
                lines = [f"Fate's Edge — {self.client.server_url} — {datetime.now().strftime('%H:%M:%S')} (Ctrl+C to stop)", ""]
                if args.code:
                    # Keep watching while the room is closed: it opens again
                    # the moment someone reconnects.
                    try:
                        room = self.client.get_room_info(args.code)
                        if not room:
                            raise NoRoom(args.code)
                        lines.append(f"Room {room.get('code')} — GM {room.get('gm') or '—'} — {room.get('clients', 0)} connected — last activity {format_ago(room.get('lastActivity'))}")
                        lines += capture(print_clients, self.client.get_clients(args.code))
                        if room.get('adventure'):
                            lines.append("")
                            lines += capture(print_adventure, self.client.get_adventure(args.code), False)
                    except NoRoom as e:
                        lines.append(str(e))
                else:
                    rooms = self.client.list_rooms()
                    lines.append(f"{len(rooms)} rooms, {sum(r.get('clients', 0) for r in rooms)} clients")
                    if rooms:
                        lines.append("")
                        lines += capture(print_rooms_table, rooms)
                if sys.stdout.isatty():
                    print("\033[2J\033[H", end="")
                print("\n".join(lines), flush=True)
                time.sleep(max(0.5, args.interval))
        except KeyboardInterrupt:
            print()
        return True

    def cmd_modules(self, args):
        """Handle module commands"""
        if args.action == 'list':
            modules = self.client.list_modules()
            if modules:
                print_header(f"Modules ({len(modules)})")
                for module in modules:
                    print(f"  📦 {module.get('id')}: {module.get('name')} v{module.get('version')}")
                    print(f"     {module.get('description', '')}")
            else:
                print_info("No modules found")
        elif args.action == 'push':
            self.client.push_module(args.id, args.room)
            print_success(f"Module {args.id} pushed" + (f" to room {args.room}" if args.room else " to all rooms"))
        elif args.action == 'cleanup':
            self.client.cleanup_module(args.id, args.room)
            print_success(f"Module {args.id} cleaned up" + (f" from room {args.room}" if args.room else " from all rooms"))
        else:
            raise CLIError(f"Unknown module action: {args.action}")
        return True

    def cmd_backup(self, args):
        """Backup server data (a local snapshot of the room/module listings + this CLI's config -- not a server-side backup)"""
        backup_path = Path(args.path) if args.path else Path.cwd() / 'backups'
        backup_path.mkdir(parents=True, exist_ok=True)

        if args.filename:
            filename = args.filename
        else:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"fates-edge-backup-{timestamp}.json"

        filepath = backup_path / filename

        try:
            data = {
                'version': VERSION,
                'timestamp': datetime.now().isoformat(),
                'rooms': self.client.list_rooms(),
                'modules': self.client.list_modules(),
                'config': self.config.data
            }

            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2)

            print_success(f"Backup saved to {filepath}")
            print_info(f"Size: {filepath.stat().st_size} bytes")
            return True
        except OSError as e:
            raise CLIError(f"Backup failed: {e}")

    def cmd_restore(self, args):
        """Show what a backup snapshot contained (informational only -- rooms are ephemeral and re-created live, not restored from a file)"""
        backup_path = Path(args.path) if args.path else Path.cwd() / 'backups'
        filepath = backup_path / args.filename

        if not filepath.exists():
            print_error(f"Backup file not found: {filepath}")
            return

        try:
            with open(filepath, 'r') as f:
                data = json.load(f)

            print_header(f"Backup contents: {filepath}")
            print_info(f"Version: {data.get('version', 'unknown')}")
            print_info(f"Timestamp: {data.get('timestamp', 'unknown')}")
            print_info(f"Rooms: {len(data.get('rooms', []))}")
            print_info(f"Modules: {len(data.get('modules', []))}")

            for room in data.get('rooms', []):
                print(f"  Room: {room.get('code')} - {room.get('name')}")

            print_info("This is a read-only look at the snapshot -- there is no server-side restore endpoint (rooms are ephemeral and re-created live by whoever connects).")
        except Exception as e:
            print_error(f"Restore failed: {e}")

    def cmd_config(self, args):
        """Handle configuration commands"""
        if args.action == 'get':
            if args.key:
                value = self.config.get(args.key)
                if value is not None:
                    print(f"{args.key}: {value}")
                else:
                    print_error(f"Key '{args.key}' not found")
            else:
                print_data(json.dumps(self.config.data, indent=2))
        elif args.action == 'set':
            self.config.set(args.key, args.value)
            print_success(f"Set {args.key} = {args.value}")
        elif args.action == 'unset':
            self.config.set(args.key, None)
            print_success(f"Unset {args.key}")
        else:
            raise CLIError(f"Unknown config action: {args.action}")
        return True

    def cmd_logs(self, args):
        """View server logs"""
        if args.docker:
            container = args.container
            if not container:
                try:
                    result = subprocess.run(
                        ['docker', 'ps', '--format', '{{.Names}}'],
                        capture_output=True, text=True
                    )
                    containers = result.stdout.strip().split()
                    matching = [c for c in containers if 'fates-edge' in c]
                    if matching:
                        container = matching[0]
                    else:
                        raise CLIError("No fates-edge container found. Specify --container.")
                except FileNotFoundError:
                    raise CLIError("Docker is not installed or not on PATH.")

            cmd = ['docker', 'logs', '--tail', str(args.tail)] + (['--follow'] if args.follow else []) + [container]
            try:
                subprocess.run(cmd, check=True)
            except subprocess.CalledProcessError as e:
                raise CLIError(f"Failed to get logs: {e}")
            except FileNotFoundError:
                raise CLIError("Docker is not installed or not on PATH.")
            except KeyboardInterrupt:
                print()
            return True
        if not SERVER_LOG_PATH.exists():
            raise CLIError(f"No log at {SERVER_LOG_PATH}. It is written when the server is started with 'server start'; for Docker use 'logs --docker'.")
        for line in tail_file(SERVER_LOG_PATH, args.tail):
            print(line)
        if args.follow:
            try:
                with open(SERVER_LOG_PATH, 'r', errors='replace') as fh:
                    fh.seek(0, os.SEEK_END)
                    while True:
                        line = fh.readline()
                        if line:
                            print(line, end='', flush=True)
                        else:
                            time.sleep(0.3)
            except KeyboardInterrupt:
                print()
        return True

# ============================================================
# Main Entry Point
# ============================================================

def main():
    # No arguments and no terminal (e.g. a container): start the server.
    if len(sys.argv) == 1 and not sys.stdin.isatty():
        print_info("No command given; starting server automatically (Docker mode).")
        class Args:
            port = None
            host = '0.0.0.0'
            api_key = os.environ.get('API_KEY')
        cli = CLI()
        sys.exit(0 if cmd_server_start(Args(), cli.config) else 1)

    cli = CLI()
    if len(sys.argv) > 1:
        try:
            result = cli.run(sys.argv[1:])
        except CLIError as e:
            print_error(str(e))
            sys.exit(1)
        except KeyboardInterrupt:
            sys.exit(130)
        # Handlers return False on failure; anything else is success.
        sys.exit(1 if result is False else 0)
    try:
        cli.interactive()
    except KeyboardInterrupt:
        print("\nGoodbye!")

if __name__ == '__main__':
    main()
