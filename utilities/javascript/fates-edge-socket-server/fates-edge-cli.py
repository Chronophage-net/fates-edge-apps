#!/usr/bin/env python3
"""
Fate's Edge Server CLI Management Tool
For managing the Fate's Edge WebSocket server, rooms, users, and modules.

Features:
- Server lifecycle management (start/stop/restart)
- Room management with deck operations
- Client management (list, kick, ban, unban)  <-- NEW
- Module management (push/cleanup/list)
- Grid Combat support
- Whiteboard sync
- Backup & Restore
- Interactive mode with tab completion

Usage:
    fates-edge-cli --help
    fates-edge-cli server start [--port PORT] [--host HOST] [--api-key KEY]
    fates-edge-cli server stop
    fates-edge-cli server restart
    fates-edge-cli status
    fates-edge-cli rooms list
    fates-edge-cli rooms clients list CODE
    fates-edge-cli rooms client kick CODE --id CLIENT_ID [--reason REASON]
    fates-edge-cli rooms client ban CODE --id CLIENT_ID [--reason REASON]
    fates-edge-cli rooms client unban CODE --id CLIENT_ID
    ...
"""

import sys
import os
import json
import argparse
import subprocess
import requests
import time
import signal
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import yaml
import readline
import getpass
import socket
import tempfile
from urllib.parse import urljoin

# ============================================================
# Constants
# ============================================================

VERSION = "1.4.0"  # bumped version
DEFAULT_CONFIG_PATH = Path.home() / ".fates-edge" / "cli-config.json"
DEFAULT_SERVER_URL = "http://localhost:10000"
DEFAULT_API_KEY = ""
DEFAULT_WS_URL = "ws://localhost:10000"

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
    
    @staticmethod
    def colorize(text: str, color: str) -> str:
        return f"{color}{text}{Colors.ENDC}"

def print_success(text): print(Colors.colorize(f"✅ {text}", Colors.GREEN))
def print_error(text): print(Colors.colorize(f"❌ {text}", Colors.RED))
def print_warning(text): print(Colors.colorize(f"⚠️  {text}", Colors.YELLOW))
def print_info(text): print(Colors.colorize(f"ℹ️  {text}", Colors.CYAN))
def print_header(text): print(Colors.colorize(f"\n{text}\n{'=' * len(text)}", Colors.BOLD + Colors.BLUE))
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
        return self.get('server_url', DEFAULT_SERVER_URL)
    
    def get_api_key(self) -> str:
        return self.get('api_key', DEFAULT_API_KEY)
    
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
        """Make an API request to the server"""
        url = urljoin(self.server_url, endpoint)
        
        try:
            if method == 'GET':
                resp = requests.get(url, headers=self.headers, timeout=timeout)
            elif method == 'POST':
                resp = requests.post(url, json=data, headers=self.headers, timeout=timeout)
            elif method == 'PUT':
                resp = requests.put(url, json=data, headers=self.headers, timeout=timeout)
            elif method == 'DELETE':
                resp = requests.delete(url, headers=self.headers, timeout=timeout)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.ConnectionError:
            print_error(f"Could not connect to server at {self.server_url}")
            print_info("Make sure the server is running and the URL is correct")
            sys.exit(1)
        except requests.exceptions.Timeout:
            print_error("Request timed out")
            sys.exit(1)
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                print_error("Authentication failed. Check your API key.")
                print_info("Set API key with: fates-edge-cli config set api_key YOUR_KEY")
            elif e.response.status_code == 403:
                print_error("Forbidden. Check your API key permissions.")
            elif e.response.status_code == 404:
                print_error("Endpoint not found. Check the server version.")
            else:
                print_error(f"HTTP error: {e}")
            sys.exit(1)
    
    def health(self) -> Dict:
        """Get server health"""
        return self._request('GET', '/api/healthz')
    
    def status(self) -> Dict:
        """Get server status (via health)"""
        return self._request('GET', '/api/healthz')
    
    def list_rooms(self) -> List[Dict]:
        """List all rooms"""
        result = self._request('GET', '/api/rooms')
        return result.get('rooms', [])
    
    def create_room(self, name: str, password: str = None) -> Dict:
        """Create a new room"""
        data = {'name': name}
        if password:
            data['password'] = password
        return self._request('POST', '/api/rooms', data)
    
    def delete_room(self, code: str) -> Dict:
        """Delete a room"""
        return self._request('DELETE', f'/api/rooms/{code}')
    
    def get_room(self, code: str) -> Dict:
        """Get room details"""
        return self._request('GET', f'/api/rooms/{code}')
    
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
    
    def list_modules(self) -> List[Dict]:
        """List available modules"""
        result = self._request('GET', '/api/modules')
        return result.get('modules', [])
    
    def push_module(self, module_id: str, room_code: str = None) -> Dict:
        """Push a module to clients"""
        data = {'moduleId': module_id}
        if room_code:
            data['roomCode'] = room_code
        return self._request('POST', f'/api/modules/{module_id}/push', data)
    
    def cleanup_module(self, module_id: str, room_code: str = None) -> Dict:
        """Cleanup a module from clients"""
        data = {'moduleId': module_id}
        if room_code:
            data['roomCode'] = room_code
        return self._request('POST', f'/api/modules/{module_id}/cleanup', data)
    
    def get_room_state(self, code: str) -> Dict:
        """Get room VTT state"""
        return self._request('GET', f'/api/rooms/{code}/state')
    
    def send_chat(self, code: str, message: str, sender: str = 'CLI') -> Dict:
        """Send a chat message"""
        return self._request('POST', f'/api/rooms/{code}/chat', {'message': message, 'sender': sender})
    
    def get_whiteboard(self, code: str) -> Dict:
        """Get whiteboard state"""
        return self._request('GET', f'/api/rooms/{code}/whiteboard')
    
    def sync_whiteboard(self, code: str, data: Dict) -> Dict:
        """Sync whiteboard state"""
        return self._request('POST', f'/api/rooms/{code}/whiteboard', data)
    
    def toggle_grid_combat(self, code: str, enabled: bool, grid_type: str = 'square') -> Dict:
        """Toggle grid combat mode"""
        return self._request('POST', f'/api/rooms/{code}/grid-combat', {
            'enabled': enabled,
            'gridType': grid_type
        })
    
    def add_token(self, code: str, token_data: Dict) -> Dict:
        """Add a token to grid combat"""
        return self._request('POST', f'/api/rooms/{code}/tokens', token_data)
    
    def remove_token(self, code: str, token_id: str) -> Dict:
        """Remove a token from grid combat"""
        return self._request('DELETE', f'/api/rooms/{code}/tokens/{token_id}')
    
    def list_tokens(self, code: str) -> List[Dict]:
        """List tokens in a room"""
        result = self._request('GET', f'/api/rooms/{code}/tokens')
        return result.get('tokens', [])
    
    # ============================================================
    # NEW: Client management
    # ============================================================
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

# ============================================================
# Server Control Commands
# ============================================================

def cmd_server_start(args, config: Config):
    """Start the Fate's Edge server"""
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
    
    # Check if server.js exists
    server_path = Path.cwd() / 'server.js'
    if not server_path.exists():
        print_error("server.js not found in current directory")
        print_info("Make sure you're in the server directory")
        return False
    
    try:
        # Use node to run the server
        cmd = ['node', 'server.js']
        
        # Set environment
        env = os.environ.copy()
        env['PORT'] = str(port)
        env['HOST'] = host
        if api_key:
            env['API_KEY'] = api_key
        
        # Start process
        process = subprocess.Popen(
            cmd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait a moment to see if it starts
        time.sleep(2)
        
        # Check if process is still running
        if process.poll() is None:
            print_success(f"Server started on {host}:{port} (PID: {process.pid})")
            if api_key:
                print_info(f"API Key: {api_key}")
            else:
                print_info("API Key: (Check server logs for API key if not set)")
            print_info(f"WebSocket: ws://{host}:{port}")
            print_info(f"HTTP: http://{host}:{port}")
            print_info(f"Health Check: http://{host}:{port}/api/healthz")
            
            # Save PID to config
            config.set('server_pid', process.pid)
            config.set('server_port', port)
            config.set('server_host', host)
            if api_key:
                config.set('api_key', api_key)
            
            return True
        else:
            stdout, stderr = process.communicate()
            print_error(f"Failed to start server: {stderr}")
            if stdout:
                print_info(f"Output: {stdout}")
            return False
            
    except Exception as e:
        print_error(f"Failed to start server: {e}")
        return False

def cmd_server_stop(args, config: Config):
    """Stop the Fate's Edge server"""
    pid = config.get('server_pid')
    
    if not pid:
        print_warning("No server PID found. Server may not be running.")
        return True
    
    try:
        # Send SIGTERM
        os.kill(pid, signal.SIGTERM)
        
        # Wait for process to terminate
        for _ in range(10):
            time.sleep(0.5)
            try:
                os.kill(pid, 0)
            except OSError:
                # Process is gone
                config.set('server_pid', None)
                print_success("Server stopped")
                return True
        
        # Force kill if still running
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
    """Restart the Fate's Edge server"""
    print_info("Restarting server...")
    
    # Stop the server
    if not cmd_server_stop(args, config):
        return False
    
    # Wait a moment
    time.sleep(1)
    
    # Start the server
    return cmd_server_start(args, config)

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
        """Setup tab completion for interactive shell"""
        try:
            readline.parse_and_bind("tab: complete")
            readline.set_completer(self._completer)
        except:
            pass
    
    def _completer(self, text, state):
        commands = [
            'server', 'status', 'health', 'rooms', 'users', 'modules', 
            'backup', 'restore', 'config', 'logs', 'whiteboard',
            'grid-combat', 'tokens', 'help', 'exit', 'quit'
        ]
        matches = [c for c in commands if c.startswith(text)]
        if state < len(matches):
            return matches[state]
        return None
    
    def interactive(self):
        """Interactive shell mode"""
        print_header("Fate's Edge CLI v" + VERSION)
        print_info("Type 'help' for commands, 'exit' to quit\n")
        
        while self.running:
            try:
                cmd = input(f"{Colors.GREEN}fe>{Colors.ENDC} ").strip()
                if not cmd:
                    continue
                
                if cmd in ['exit', 'quit']:
                    self.running = False
                    print_info("Goodbye!")
                    break
                
                if cmd == 'help':
                    self.print_help()
                    continue
                
                # Parse and execute command
                args = self._parse_args(cmd.split())
                if args:
                    if hasattr(self, f'cmd_{args.command}'):
                        func = getattr(self, f'cmd_{args.command}')
                        func(args)
                    else:
                        print_error(f"Unknown command: {args.command}")
                        self.print_help()
                
            except KeyboardInterrupt:
                print("\n")
                continue
            except EOFError:
                self.running = False
                print_info("\nGoodbye!")
                break
            except Exception as e:
                print_error(f"Error: {e}")
    
    def _parse_args(self, argv):
        """Parse command line arguments"""
        parser = argparse.ArgumentParser(prog='fates-edge')
        subparsers = parser.add_subparsers(dest='command', help='Commands')
        
        # Server Control
        server_parser = subparsers.add_parser('server', help='Manage server process')
        server_subparsers = server_parser.add_subparsers(dest='action', help='Server actions')
        
        server_start = server_subparsers.add_parser('start', help='Start server')
        server_start.add_argument('--port', type=int, help='Port to listen on')
        server_start.add_argument('--host', default='0.0.0.0', help='Host to bind to')
        server_start.add_argument('--api-key', help='API key to set in environment')
        
        server_subparsers.add_parser('stop', help='Stop server')
        server_subparsers.add_parser('restart', help='Restart server')
        
        # Health & Status
        subparsers.add_parser('health', help='Check server health')
        subparsers.add_parser('status', help='Get server status')
        
        # Rooms
        rooms_parser = subparsers.add_parser('rooms', help='Manage rooms')
        rooms_subparsers = rooms_parser.add_subparsers(dest='action', help='Room actions')
        
        # Basic room actions
        rooms_subparsers.add_parser('list', help='List all rooms')
        rooms_create = rooms_subparsers.add_parser('create', help='Create a room')
        rooms_create.add_argument('--name', required=True, help='Room name')
        rooms_create.add_argument('--password', help='Room password')
        rooms_delete = rooms_subparsers.add_parser('delete', help='Delete a room')
        rooms_delete.add_argument('code', help='Room code')
        rooms_info = rooms_subparsers.add_parser('info', help='Get room details')
        rooms_info.add_argument('code', help='Room code')
        
        # Deck operations
        deck_parser = rooms_subparsers.add_parser('draw', help='Draw cards from deck')
        deck_parser.add_argument('code', help='Room code')
        deck_parser.add_argument('--count', type=int, default=1, help='Number of cards to draw')
        deck_parser.add_argument('--region', default='Acasia', help='Region name')
        
        crown_parser = rooms_subparsers.add_parser('crown', help='Draw a Crown Spread')
        crown_parser.add_argument('code', help='Room code')
        crown_parser.add_argument('--region', default='Acasia', help='Region name')
        
        shuffle_parser = rooms_subparsers.add_parser('shuffle', help='Shuffle deck')
        shuffle_parser.add_argument('code', help='Room code')
        
        history_parser = rooms_subparsers.add_parser('deck-history', help='View deck history')
        history_parser.add_argument('code', help='Room code')
        history_parser.add_argument('--limit', type=int, default=50, help='Number of entries to show')
        
        history_clear = rooms_subparsers.add_parser('deck-history-clear', help='Clear deck history')
        history_clear.add_argument('code', help='Room code')
        
        # Chat & VTT
        chat_parser = rooms_subparsers.add_parser('chat', help='Send chat message')
        chat_parser.add_argument('code', help='Room code')
        chat_parser.add_argument('--message', required=True, help='Message to send')
        chat_parser.add_argument('--sender', default='CLI', help='Sender name')
        
        vtt_parser = rooms_subparsers.add_parser('vtt', help='Get VTT state')
        vtt_parser.add_argument('code', help='Room code')
        
        # Grid Combat
        grid_parser = rooms_subparsers.add_parser('grid-combat', help='Toggle grid combat mode')
        grid_parser.add_argument('code', help='Room code')
        grid_parser.add_argument('--enable', action='store_true', help='Enable grid combat')
        grid_parser.add_argument('--disable', action='store_true', help='Disable grid combat')
        grid_parser.add_argument('--grid-type', choices=['square', 'hex', 'isometric'], default='square', help='Grid type')
        
        # Tokens
        token_parser = rooms_subparsers.add_parser('token', help='Manage tokens')
        token_subparsers = token_parser.add_subparsers(dest='token_action')
        
        token_add = token_subparsers.add_parser('add', help='Add a token')
        token_add.add_argument('code', help='Room code')
        token_add.add_argument('--name', required=True, help='Token name')
        token_add.add_argument('--x', type=int, help='X position')
        token_add.add_argument('--y', type=int, help='Y position')
        token_add.add_argument('--color', default='#d4af37', help='Token color')
        token_add.add_argument('--shape', choices=['circle', 'square', 'diamond'], default='circle', help='Token shape')
        
        token_remove = token_subparsers.add_parser('remove', help='Remove a token')
        token_remove.add_argument('code', help='Room code')
        token_remove.add_argument('--id', required=True, help='Token ID')
        
        token_list = token_subparsers.add_parser('list', help='List tokens')
        token_list.add_argument('code', help='Room code')
        
        # Whiteboard
        whiteboard_parser = rooms_subparsers.add_parser('whiteboard', help='Get whiteboard state')
        whiteboard_parser.add_argument('code', help='Room code')
        
        whiteboard_sync = rooms_subparsers.add_parser('whiteboard-sync', help='Sync whiteboard')
        whiteboard_sync.add_argument('code', help='Room code')
        whiteboard_sync.add_argument('--file', help='JSON file to sync')
        
        # ============================================================
        # NEW: Client management under rooms
        # ============================================================
        clients_parser = rooms_subparsers.add_parser('clients', help='Manage clients in a room')
        clients_subparsers = clients_parser.add_subparsers(dest='clients_action')
        
        clients_list = clients_subparsers.add_parser('list', help='List clients in a room')
        clients_list.add_argument('code', help='Room code')
        
        client_kick = clients_subparsers.add_parser('kick', help='Kick a client from a room')
        client_kick.add_argument('code', help='Room code')
        client_kick.add_argument('--id', required=True, help='Client ID')
        client_kick.add_argument('--reason', default='Kicked by CLI', help='Reason for kick')
        
        client_ban = clients_subparsers.add_parser('ban', help='Ban a client from a room')
        client_ban.add_argument('code', help='Room code')
        client_ban.add_argument('--id', required=True, help='Client ID')
        client_ban.add_argument('--reason', default='Banned by CLI', help='Reason for ban')
        
        client_unban = clients_subparsers.add_parser('unban', help='Unban a client from a room')
        client_unban.add_argument('code', help='Room code')
        client_unban.add_argument('--id', required=True, help='Client ID')
        
        # Modules
        modules_parser = subparsers.add_parser('modules', help='Manage modules')
        modules_subparsers = modules_parser.add_subparsers(dest='action', help='Module actions')
        
        modules_subparsers.add_parser('list', help='List available modules')
        module_push = modules_subparsers.add_parser('push', help='Push a module')
        module_push.add_argument('id', help='Module ID')
        module_push.add_argument('--room', help='Room code (optional)')
        module_cleanup = modules_subparsers.add_parser('cleanup', help='Cleanup a module')
        module_cleanup.add_argument('id', help='Module ID')
        module_cleanup.add_argument('--room', help='Room code (optional)')
        
        # Backup & Restore
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
        
        # Logs
        logs_parser = subparsers.add_parser('logs', help='View server logs')
        logs_parser.add_argument('--tail', type=int, default=50, help='Number of lines to show')
        logs_parser.add_argument('--docker', action='store_true', help='Use docker logs')
        
        # Help
        subparsers.add_parser('help', help='Show this help')
        
        try:
            return parser.parse_args(argv)
        except SystemExit:
            return None
    
    def print_help(self):
        """Print help message"""
        print("""
╔══════════════════════════════════════════════════════════════╗
║              Fate's Edge CLI v1.4.0                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Server Management:                                          ║
║    server start [--port PORT] [--host HOST] [--api-key KEY] ║
║    server stop                         Stop server           ║
║    server restart                      Restart server        ║
║                                                              ║
║  Server Status:                                               ║
║    health                             Check server health    ║
║    status                             Get server status      ║
║                                                              ║
║  Room Management:                                             ║
║    rooms list                         List all rooms         ║
║    rooms create --name NAME           Create room           ║
║    rooms delete CODE                  Delete room            ║
║    rooms info CODE                    Show room details      ║
║    rooms draw CODE [--count] [--region] Draw cards          ║
║    rooms crown CODE [--region]        Crown Spread           ║
║    rooms shuffle CODE                 Shuffle deck           ║
║    rooms deck-history CODE [--limit]  View deck history      ║
║    rooms deck-history-clear CODE      Clear deck history     ║
║    rooms chat CODE --message MSG      Send chat message      ║
║    rooms vtt CODE                     Get VTT state          ║
║                                                              ║
║  Client Management (NEW):                                    ║
║    rooms clients list CODE           List clients in room   ║
║    rooms clients kick CODE --id ID   Kick a client          ║
║    rooms clients ban CODE --id ID    Ban a client           ║
║    rooms clients unban CODE --id ID  Unban a client         ║
║                                                              ║
║  Grid Combat:                                                 ║
║    rooms grid-combat CODE [--enable|--disable]              ║
║    rooms token add CODE --name NAME [--x X] [--y Y]         ║
║    rooms token remove CODE --id TOKEN_ID                    ║
║    rooms token list CODE              List tokens            ║
║                                                              ║
║  Whiteboard:                                                  ║
║    rooms whiteboard CODE              Get whiteboard state   ║
║    rooms whiteboard-sync CODE --file  Sync from JSON file    ║
║                                                              ║
║  Module Management:                                           ║
║    modules list                       List modules           ║
║    modules push ID [--room]           Push module            ║
║    modules cleanup ID [--room]        Cleanup module         ║
║                                                              ║
║  Backup & Restore:                                            ║
║    backup [filename]                  Backup server data     ║
║    restore filename                   Restore server data    ║
║                                                              ║
║  Configuration:                                               ║
║    config get [key]                   Get configuration      ║
║    config set KEY VALUE               Set configuration      ║
║    config unset KEY                   Remove configuration   ║
║                                                              ║
║  Logs:                                                       ║
║    logs [--tail N] [--docker]        View server logs       ║
║                                                              ║
║  General:                                                    ║
║    help                               Show this help         ║
║    exit                               Exit the CLI           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
        """)
    
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
        else:
            print_error(f"Unknown server action: {args.action}")
            return False
    
    def cmd_health(self, args):
        """Check server health"""
        try:
            data = self.client.health()
            print_success("Server is healthy")
            print_data(json.dumps(data, indent=2))
        except:
            print_error("Server health check failed")
    
    def cmd_status(self, args):
        """Get server status"""
        try:
            data = self.client.status()
            print_header("Server Status")
            for key, value in data.items():
                print(f"  {key}: {value}")
        except:
            print_error("Failed to get server status")
    
    def cmd_rooms(self, args):
        """Handle room commands"""
        if args.action == 'list':
            rooms = self.client.list_rooms()
            if rooms:
                print_header(f"Rooms ({len(rooms)})")
                for room in rooms:
                    status = room.get('status', 'active')
                    status_icon = '🟢' if status == 'active' else '🔴'
                    print(f"  {status_icon} {room.get('code')}: {room.get('name')} ({room.get('clients', 0)} clients)")
            else:
                print_info("No rooms found")
        elif args.action == 'create':
            room = self.client.create_room(args.name, args.password)
            print_success(f"Room created: {room.get('code')}")
            print_info(f"Name: {room.get('name')}")
            if args.password:
                print_info(f"Password: {args.password}")
        elif args.action == 'delete':
            self.client.delete_room(args.code)
            print_success(f"Room {args.code} deleted")
        elif args.action == 'info':
            room = self.client.get_room(args.code)
            print_header(f"Room: {room.get('code')}")
            for key, value in room.items():
                if key != 'deck':
                    print(f"  {key}: {value}")
            if 'deck' in room:
                print(f"  deck_remaining: {len(room['deck'])} cards")
            # Also show banned list if available
            if 'banned' in room:
                print(f"  banned_count: {len(room['banned'])}")
        elif args.action == 'draw':
            result = self.client.deck_draw(args.code, args.count, args.region)
            print_success(f"Drew {args.count} card(s) from {args.region}")
            cards = result.get('cards', [])
            for card in cards:
                print(f"  {card.get('rankName')} of {card.get('suitName')}")
            if result.get('synthesis'):
                print_data(f"\n  Synthesis: {result['synthesis']}")
            print_info(f"Remaining: {result.get('remaining', 0)} cards")
        elif args.action == 'crown':
            result = self.client.deck_crown(args.code, args.region)
            print_success(f"Crown Spread from {args.region}")
            cards = result.get('cards', [])
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
                    print(f"    {entry.get('synthesis')[:100]}...")
            else:
                print_info("No deck history available")
        elif args.action == 'deck-history-clear':
            self.client.deck_clear_history(args.code)
            print_success(f"Deck history cleared for room {args.code}")
        elif args.action == 'grid-combat':
            if args.enable:
                result = self.client.toggle_grid_combat(args.code, True, args.grid_type)
                print_success(f"Grid Combat enabled for room {args.code} ({args.grid_type})")
            elif args.disable:
                result = self.client.toggle_grid_combat(args.code, False)
                print_success(f"Grid Combat disabled for room {args.code}")
            else:
                # Toggle
                state = self.client.get_room_state(args.code)
                current = state.get('gridCombat', {}).get('enabled', False)
                new_state = not current
                result = self.client.toggle_grid_combat(args.code, new_state, args.grid_type)
                if new_state:
                    print_success(f"Grid Combat enabled for room {args.code} ({args.grid_type})")
                else:
                    print_success(f"Grid Combat disabled for room {args.code}")
        elif args.action == 'chat':
            self.client.send_chat(args.code, args.message, args.sender)
            print_success(f"Message sent to room {args.code}")
        elif args.action == 'vtt':
            data = self.client.get_room_state(args.code)
            print_header(f"VTT State - Room {args.code}")
            print_data(json.dumps(data, indent=2))
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
        elif args.action == 'whiteboard-sync':
            if args.file:
                with open(args.file, 'r') as f:
                    data = json.load(f)
                self.client.sync_whiteboard(args.code, data)
                print_success(f"Whiteboard synced for room {args.code}")
            else:
                print_error("Please specify --file to sync from")
        elif args.action == 'token':
            if args.token_action == 'add':
                token_data = {
                    'name': args.name,
                    'color': args.color,
                    'shape': args.shape
                }
                if args.x is not None:
                    token_data['x'] = args.x
                if args.y is not None:
                    token_data['y'] = args.y
                result = self.client.add_token(args.code, token_data)
                print_success(f"Token '{args.name}' added to room {args.code}")
                print_info(f"Token ID: {result.get('id')}")
            elif args.token_action == 'remove':
                self.client.remove_token(args.code, args.id)
                print_success(f"Token {args.id} removed from room {args.code}")
            elif args.token_action == 'list':
                tokens = self.client.list_tokens(args.code)
                if tokens:
                    print_header(f"Tokens ({len(tokens)})")
                    for token in tokens:
                        print(f"  {token.get('id')}: {token.get('name')} ({token.get('shape')}) at ({token.get('x', 0)}, {token.get('y', 0)})")
                else:
                    print_info("No tokens in room")
        # ============================================================
        # NEW: Client management
        # ============================================================
        elif args.action == 'clients':
            if args.clients_action == 'list':
                clients = self.client.get_clients(args.code)
                if clients:
                    print_header(f"Clients in room {args.code} ({len(clients)})")
                    for client in clients:
                        role_icon = '👑' if client.get('role') == 'gm' else '👤'
                        print(f"  {role_icon} {client.get('id')}: {client.get('name')} ({client.get('role')})")
                        if client.get('email'):
                            print(f"     Email: {client.get('email')}")
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
            else:
                print_error(f"Unknown clients action: {args.clients_action}")
        else:
            print_error(f"Unknown room action: {args.action}")
    
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
            print_error(f"Unknown module action: {args.action}")
    
    def cmd_backup(self, args):
        """Backup server data"""
        # Create backup directory
        backup_path = Path(args.path) if args.path else Path.cwd() / 'backups'
        backup_path.mkdir(parents=True, exist_ok=True)
        
        # Create backup filename
        if args.filename:
            filename = args.filename
        else:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"fates-edge-backup-{timestamp}.json"
        
        filepath = backup_path / filename
        
        try:
            # Get all data from server
            data = {
                'version': VERSION,
                'timestamp': datetime.now().isoformat(),
                'rooms': self.client.list_rooms(),
                'modules': self.client.list_modules(),
                'config': self.config.data
            }
            
            # Save to file
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2)
            
            print_success(f"Backup saved to {filepath}")
            print_info(f"Size: {filepath.stat().st_size} bytes")
        except Exception as e:
            print_error(f"Backup failed: {e}")
    
    def cmd_restore(self, args):
        """Restore server data from backup"""
        # Find backup file
        backup_path = Path(args.path) if args.path else Path.cwd() / 'backups'
        filepath = backup_path / args.filename
        
        if not filepath.exists():
            print_error(f"Backup file not found: {filepath}")
            return
        
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
            
            print_header(f"Restoring from {filepath}")
            print_info(f"Version: {data.get('version', 'unknown')}")
            print_info(f"Timestamp: {data.get('timestamp', 'unknown')}")
            print_info(f"Rooms: {len(data.get('rooms', []))}")
            print_info(f"Modules: {len(data.get('modules', []))}")
            
            # Restore rooms
            for room in data.get('rooms', []):
                print(f"  Restoring room: {room.get('code')} - {room.get('name')}")
                # Note: Actual restore would need to handle existing rooms
            
            print_success("Restore completed (simulated)")
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
                # Show all config
                print_data(json.dumps(self.config.data, indent=2))
        elif args.action == 'set':
            self.config.set(args.key, args.value)
            print_success(f"Set {args.key} = {args.value}")
        elif args.action == 'unset':
            self.config.set(args.key, None)
            print_success(f"Unset {args.key}")
        else:
            print_error(f"Unknown config action: {args.action}")
    
    def cmd_logs(self, args):
        """View server logs"""
        # This would need to be implemented based on your logging setup
        print_info("Log viewing not yet implemented")
        print_info("Check the server logs directly in your deployment")

# ============================================================
# Main Entry Point
# ============================================================

def main():
    cli = CLI()
    
    if len(sys.argv) > 1:
        # Command line mode
        args = cli._parse_args(sys.argv[1:])
        if args:
            if hasattr(cli, f'cmd_{args.command}'):
                func = getattr(cli, f'cmd_{args.command}')
                success = func(args)
                sys.exit(0 if success else 1)
            else:
                print_error(f"Unknown command: {args.command}")
                cli.print_help()
                sys.exit(1)
        else:
            sys.exit(1)
    else:
        # Interactive mode
        try:
            cli.interactive()
        except KeyboardInterrupt:
            print("\nGoodbye!")
        except Exception as e:
            print_error(f"Fatal error: {e}")
            sys.exit(1)

if __name__ == '__main__':
    main()