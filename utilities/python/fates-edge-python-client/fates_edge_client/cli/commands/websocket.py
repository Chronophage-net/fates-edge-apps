"""`fates-edge websocket ...` -- ported from cmd_websocket(), targeting
the new FatesEdgeWsClient (python-socketio) instead of the old hand-rolled
WebSocketClient.

`run()` is a coroutine -- see server.py's module docstring for why
(nested `asyncio.run()` calls break when invoked from inside the
interactive shell's own event loop)."""

import asyncio

from ...store import DataStore
from ...ws_client import FatesEdgeWsClient


async def run(args, store: DataStore) -> None:
    if not args.code:
        print("❌ Please provide --code CODE")
        return

    client = FatesEdgeWsClient(
        args.server, store.apiKey or args.api_key, args.code,
        auth_token=store.authToken,
    )

    try:
        await client.connect_with_retry()
    except Exception:
        pass
    if not client.connected:
        print("❌ Failed to connect to WebSocket server")
        return

    if not await client.join_room():
        print("❌ Failed to join room")
        await client.disconnect()
        return

    async def chat_listener(data):
        sender = data.get("sender", "Unknown")
        text = data.get("text", "")
        print(f"\n[CHAT] {sender}: {text}")

    async def roll_listener(data):
        sender = data.get("sender", "Unknown")
        expr = data.get("expr", "")
        result = data.get("result", 0)
        print(f"\n[DICE] {sender} rolled {expr} = {result}")

    async def deck_listener(data):
        cards = data.get("cards", [])
        synthesis = data.get("synthesis", "")
        region = data.get("region", "Unknown")
        print(f"\n[DECK] Drew {len(cards)} cards from {region}")
        print(f"  {synthesis[:100]}..." if len(synthesis) > 100 else f"  {synthesis}")

    client.add_listener("chat-message", chat_listener)
    client.add_listener("roll-result", roll_listener)
    client.add_listener("deck-drawn", deck_listener)

    print("WebSocket client connected. Commands:")
    print("  /chat MESSAGE       - Send chat message")
    print("  /roll DICE_EXPR     - Roll dice (e.g., 2d6+3)")
    print("  /draw N             - Draw N cards from deck")
    print("  /crown              - Perform Crown Spread")
    print("  /shuffle            - Shuffle deck")
    print("  /quit               - Exit")

    try:
        while client.connected:
            try:
                line = await asyncio.get_event_loop().run_in_executor(None, input, "> ")
                if line.startswith("/chat "):
                    await client.send_chat(line[6:])
                elif line.startswith("/roll "):
                    await client.roll_dice(line[6:])
                elif line.startswith("/draw "):
                    try:
                        count = int(line[6:].strip())
                        await client.deck_draw(count)
                    except ValueError:
                        print("❌ Please specify a number (e.g., /draw 3)")
                elif line == "/crown":
                    await client.crown_spread()
                elif line == "/shuffle":
                    await client.deck_shuffle()
                elif line == "/quit":
                    break
            except EOFError:
                break
    finally:
        await client.disconnect()
        print("Disconnected from WebSocket server.")
