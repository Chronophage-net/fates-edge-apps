#!/usr/bin/env python3
"""
Fate's Edge Server CLI Management Tool
For managing the Fate's Edge WebSocket server, rooms, users, and modules.

Usage:
    fates-edge-cli --help
    fates-edge-cli server start [--port PORT] [--host HOST]
    fates-edge-cli server stop
    fates-edge-cli server restart
    fates-edge-cli status
    fates-edge-cli rooms list
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

# ============================================================
# Constants
# ============================================================

VERSION = "1.2.0"
DEFAULT_CONFIG_PATH = Path.home() / ".fates-edge" / "cli-config.json"
DEFAULT_SERVER_URL = "http://localhost:3000"
DEFAULT_API_KEY = ""

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
        url = f"{self.server_url}{endpoint}"
        
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
    
    # ... [all existing methods remain the same] ...
    # (health, status, rooms, modules, backup, restore, config, logs)

# ============================================================
# Server Control Commands
# ============================================================

def cmd_server_start(args, config: Config):
    """Start the Fate's Edge server"""
    port = args.port or os.environ.get('PORT', 3000)
    host = args.host or '0.0.0.0'
    
    # Check if server is already running
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex((host, int(port)))
    sock.close()
    
    if result == 0:
        print_warning(f"Server is already running on {host}:{port}")
        return True
    
    print_info(f"Starting Fate's Edge Server on {host}:{port}...")
    
    # Start the server as a subprocess
    try:
        # Use node to run the server
        cmd = ['node', 'server.js']
        
        # Set environment
        env = os.environ.copy()
        env['PORT'] = str(port)
        env['HOST'] = host
        
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
            print_info(f"API Key: {os.environ.get('API_KEY', 'Check logs for API key')}")
            print_info(f"WebSocket: ws://{host}:{port}")
            print_info(f"HTTP: http://{host}:{port}")
            
            # Save PID to config
            config.set('server_pid', process.pid)
            config.set('server_port', port)
            config.set('server_host', host)
            
            return True
        else:
            stdout, stderr = process.communicate()
            print_error(f"Failed to start server: {stderr}")
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
# CLI Class - Updated with server commands
# ============================================================

class CLI:
    def __init__(self):
        self.config = Config()
        self.client = ServerClient(self.config)
        self._setup_completion()
    
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
            'backup', 'restore', 'config', 'logs', 'help', 'exit', 'quit'
        ]
        matches = [c for c in commands if c.startswith(text)]
        if state < len(matches):
            return matches[state]
        return None
    
    # ============================================================
    # Server Command
    # ============================================================
    
    def cmd_server(self, args):
        """Manage the server process"""
        if args.action == 'start':
            return cmd_server_start(args, self.config)
        elif args.action == 'stop':
            return cmd_server_stop(args, self.config)
        elif args.action == 'restart':
            return cmd_server_restart(args, self.config)
        else:
            print_error(f"Unknown server action: {args.action}")
            return False
    
    # ... [all other cmd_* methods remain the same] ...
    # (cmd_health, cmd_status, cmd_rooms, cmd_modules, cmd_backup, cmd_restore, cmd_config, cmd_logs, cmd_help)

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
        
        server_subparsers.add_parser('stop', help='Stop server')
        server_subparsers.add_parser('restart', help='Restart server')
        
        # ... [all other subparsers remain the same] ...
        # (health, status, rooms, modules, backup, restore, config, logs, help)
        
        try:
            return parser.parse_args(argv)
        except SystemExit:
            return None
    
    def print_help(self):
        """Print help message"""
        print("""
╔══════════════════════════════════════════════════════════════╗
║              Fate's Edge CLI v1.2.0                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Server Management:                                          ║
║    server start [--port PORT] [--host HOST]  Start server   ║
║    server stop                         Stop server           ║
║    server restart                      Restart server        ║
║                                                              ║
║  Server Status:                                               ║
║    health                             Check server health    ║
║    status                             Get server status      ║
║                                                              ║
║  Room Management:                                             ║
║    rooms list                         List all rooms         ║
║    rooms create [--name] [--password] Create room           ║
║    rooms delete CODE                  Delete room            ║
║    rooms info CODE                    Show room details      ║
║    rooms draw CODE [--count] [--region] Draw cards          ║
║    rooms crown CODE [--region]        Crown Spread           ║
║    rooms shuffle CODE                 Shuffle deck           ║
║    rooms deck-history CODE [--limit]  View deck history      ║
║    rooms vtt CODE                     Get VTT state          ║
║    rooms chat CODE --message MSG      Send chat message      ║
║    rooms roll CODE --dice EXPR        Roll dice              ║
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
