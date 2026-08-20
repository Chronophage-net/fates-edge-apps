"""
WebSocket (Socket.IO) client for the Fate's Edge socket server, built on
the real `python-socketio` `AsyncClient` instead of the old single-file
script's hand-rolled Engine.IO framing.

Why this needed a real rewrite, not just a relocation: the old
`WebSocketClient` opened a raw `websockets.connect(...)` to the bare
Engine.IO URL and immediately started sending `"42[...]"` event frames
-- but it never sent the Socket.IO namespace-connect packet (`"40"`)
that a real Socket.IO v4 server requires before it will accept any event
on the default namespace. Against an actual server (not just something
that happens to accept a WebSocket upgrade), the old client's
`join_room()` call would very likely have been silently ignored. Using
`python-socketio`'s own client sidesteps the entire hand-rolled protocol
layer -- namespace handshake, ping/pong, ack callbacks, and reconnection
are all handled by a library that's tested against real Socket.IO
servers, including this one.

Behavior/API surface is kept close to the old `WebSocketClient` so the
CLI/shell layer ports over with minimal change: `connect()`,
`join_room()`, `send_chat()`, `roll_dice()`, `deck_draw()`,
`deck_shuffle()`, `add_listener()`, `disconnect()`, and outbound-message
queuing while disconnected are all still here.
"""

import logging
from datetime import datetime
from typing import Any, Callable, DefaultDict, Dict, List
from collections import defaultdict

import socketio

from .models import MessageQueue

logger = logging.getLogger("fates-edge.ws")

# Server -> client events this module prints a default one-line summary
# for, mirroring the old client's built-in console output. Any listener
# registered via add_listener() for the same event still fires first.
_DEFAULT_PRINTERS = (
    "chat-message", "roll-result", "deck-drawn", "deck-shuffled",
    "crown-spread", "state-updated", "module-push", "module-cleanup",
    "scene-status-update", "combat-status-update",
    # NEW: optional AI GM voice narration (see the AI GM Bot's
    # TTS_ENABLED/TTS_URL). This client has no audio playback of its
    # own -- narration integration is intentionally out of scope here
    # (see the web client, Foundry bridge, and Discord bot for the
    # clients that do play it) -- so this just prints a one-line
    # acknowledgment instead of dropping the event silently. The
    # narration TEXT already arrived via the separate "chat-message"
    # event above.
    "tts-audio",
    # NEW: optional Reactive Soundscape (see the AI GM Bot's
    # adventure-context.js mood -> trackId profile). Acknowledge-only,
    # same reasoning as tts-audio above -- no audio playback here.
    "soundboard-ambience",
)


class FatesEdgeWsClient:
    def __init__(self, server_url: str, api_key: str, room_code: str,
                 client_name: str = "CLI Client", auth_token: str = ""):
        self.server_url = server_url.rstrip('/')
        self.api_key = api_key
        self.room_code = room_code
        self.client_data = {"name": client_name, "type": "cli"}
        # NEW: optional per-user JWT from FatesEdgeRestClient.login()/
        # register(). Purely additive -- omitted/invalid, join-room behaves
        # exactly as before (room password required if the room has one).
        self.auth_token = auth_token

        self.connected = False
        self.message_queue = MessageQueue()
        self.listeners: DefaultDict[str, List[Callable]] = defaultdict(list)

        self.sio = socketio.AsyncClient(logger=False, engineio_logger=False)
        self._register_core_handlers()

    # ------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------

    def _register_core_handlers(self):
        @self.sio.event
        async def connect():
            self.connected = True
            logger.info("Connected to WebSocket server")
            await self._flush_queue()

        @self.sio.event
        async def disconnect():
            self.connected = False
            logger.warning("WebSocket connection closed")

        @self.sio.event
        async def connect_error(data):
            self.connected = False
            logger.error(f"WebSocket connection failed: {data}")

        # Catch-all so every server event both reaches user-registered
        # listeners and gets a default one-line print, matching the old
        # client's behavior.
        @self.sio.on('*')
        async def catch_all(event, data):
            await self._handle_event(event, data)

    async def connect(self):
        """Connect to the Socket.IO server. Raises on failure (matches
        the old client's connect() contract).

        Tries the normal polling->websocket upgrade first. Some
        proxied/sandboxed networks corrupt the websocket upgrade
        handshake specifically (verified against a real instance of this
        project's socket server) while plain long-polling works fine, so
        on an upgrade failure this falls back to polling-only before
        giving up -- transparent to the caller either way, since
        python-socketio's emit/receive API is identical over both
        transports."""
        headers = {"X-API-Key": self.api_key} if self.api_key else {}
        try:
            await self.sio.connect(
                self.server_url,
                headers=headers,
                wait_timeout=10,
            )
        except Exception as e:
            logger.warning(f"Websocket-upgrade connect failed ({e}); retrying over long-polling only")
            # The failed attempt can leave the underlying Engine.IO client
            # stuck in a non-'disconnected' state (it errored mid-handshake
            # rather than cleanly closing), which would make a second
            # sio.connect() raise 'Client is not in a disconnected state'.
            # Rebuilding the AsyncClient guarantees a clean slate for the
            # retry; re-registering handlers is cheap and side-effect-free.
            self.sio = socketio.AsyncClient(logger=False, engineio_logger=False)
            self._register_core_handlers()
            try:
                await self.sio.connect(
                    self.server_url,
                    headers=headers,
                    transports=["polling"],
                    wait_timeout=10,
                )
            except Exception as e2:
                logger.error(f"WebSocket connection failed: {e2}")
                self.connected = False
                raise

    async def connect_with_retry(self, max_retries: int = 5) -> bool:
        """Connect with exponential backoff, up to max_retries attempts.
        python-socketio's own client also has built-in reconnection once
        connected; this covers the *initial* connection attempt, which
        the library does not retry on its own."""
        import asyncio
        retries = 0
        while retries < max_retries:
            try:
                await self.connect()
                return True
            except Exception:
                retries += 1
                wait = min(2 ** retries, 30)
                logger.warning(f"Connection failed, retrying in {wait}s...")
                await asyncio.sleep(wait)
        return False

    async def disconnect(self):
        if self.sio.connected:
            await self.sio.disconnect()
        self.connected = False

    # ------------------------------------------------------------
    # Room / messaging
    # ------------------------------------------------------------

    async def join_room(self) -> bool:
        if not self.connected:
            return False
        try:
            # The server's join-room handler (socketio-handlers.js)
            # destructures a single object -- { roomCode, playerName,
            # ... } -- not a positional [roomCode, clientData] array.
            # Emitting a list would arrive server-side as two separate
            # positional arguments; since the handler only reads its
            # first parameter, `data` would end up being the bare
            # room-code string with no `.roomCode` field, always failing
            # as "Invalid room code". Matches the shape
            # js/core/websocket.js's joinRoom() uses.
            payload = {
                "roomCode": self.room_code,
                "playerName": self.client_data.get("name", "CLI Client"),
            }
            # NEW: optional -- an absent/invalid token just means an
            # anonymous join, same as before this was added.
            if self.auth_token:
                payload["authToken"] = self.auth_token
            await self.sio.emit("join-room", payload)
            logger.info(f"Joined room {self.room_code}")
            return True
        except Exception as e:
            logger.error(f"Failed to join room: {e}")
            return False

    async def send_message(self, event: str, data: Any):
        """Send an event to the server, queuing it if disconnected so a
        reconnect can flush it in order."""
        if not self.connected:
            self.message_queue.enqueue(event, data)
            return
        try:
            await self.sio.emit(event, data)
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            self.message_queue.enqueue(event, data)

    async def _flush_queue(self):
        for msg in self.message_queue.drain():
            try:
                await self.sio.emit(msg["event"], msg["data"])
            except Exception as e:
                logger.error(f"Failed to flush queued message: {e}")

    async def send_chat(self, message: str):
        await self.send_message("chat-message", {"text": message})

    async def roll_dice(self, roll_expr: str, reason: str = "CLI Roll"):
        await self.send_message("roll-dice", {"roll": roll_expr, "reason": reason})

    async def deck_draw(self, count: int = 1, region: str = "Acasia"):
        await self.send_message("deck-draw", {"count": count, "region": region})

    async def deck_shuffle(self):
        await self.send_message("deck-shuffle", {})

    async def crown_spread(self, region: str = "Acasia"):
        """Request a Crown Spread (5-card draw + 4-position narrative) via
        the server's dedicated `crown-spread` event. FIXED relative to the
        old client: its `/crown` shell command called `deck_draw(5)`
        instead, which just performs a plain 5-card draw and never
        triggers the server's real Crown Spread synthesis."""
        await self.send_message("crown-spread", {"region": region})

    async def module_push(self, module_id: str):
        await self.send_message("module-push-request", {"moduleId": module_id})

    async def module_cleanup(self, module_id: str):
        await self.send_message("module-cleanup-request", {"moduleId": module_id})

    # ------------------------------------------------------------
    # Incoming events
    # ------------------------------------------------------------

    def add_listener(self, event_type: str, callback: Callable):
        self.listeners[event_type].append(callback)

    async def _handle_event(self, event_type: str, data: Any):
        data = data or {}
        for callback in self.listeners[event_type]:
            await callback(data)

        if event_type not in _DEFAULT_PRINTERS:
            return

        if event_type == "chat-message":
            sender = data.get("sender", "Unknown")
            text = data.get("text", "")
            ts = data.get("timestamp", 0) / 1000
            timestamp = datetime.fromtimestamp(ts).strftime("%H:%M") if ts else "--:--"
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
            print("\n[CROWN] \U0001F451 Crown Spread")
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
        elif event_type == "scene-status-update":
            scene = data.get("scene", {})
            print(f"\n[SCENE] Scene status updated: {scene.get('name', scene.get('id', 'Unknown'))}")
        elif event_type == "combat-status-update":
            print(f"\n[COMBAT] Combat status updated by {data.get('updatedBy', 'Unknown')}")
        elif event_type == "tts-audio":
            text = (data.get("text") or "")[:60]
            print(f"\n[TTS] AI GM narration audio received (not played by this client): \"{text}\"")
        elif event_type == "soundboard-ambience":
            mood = data.get("mood", "?")
            track_id = data.get("trackId", "?")
            print(f"\n[SOUNDSCAPE] Ambience shifting to \"{mood}\" (track {track_id}, not played by this client)")
