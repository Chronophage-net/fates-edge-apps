"""`fates-edge server ...` -- ported from cmd_server(), targeting the new
FatesEdgeRestClient (typed exceptions) instead of the old CampaignServer.

`run()` is a coroutine, not a plain function that calls asyncio.run()
itself -- the old client's cmd_server() did the latter, which works fine
called from plain `main()` but would raise "asyncio.run() cannot be
called from a running event loop" if invoked from inside the interactive
shell's own event loop (shell.py runs entirely inside one asyncio.run()
call). Callers (`__main__.py`'s dispatch and `shell.py`) are responsible
for awaiting this; see cli/parser.py's docstring for how that's wired."""

import hashlib
import json

from ...io_utils import with_spinner
from ...rest_client import FatesEdgeApiError, FatesEdgeRestClient
from ...store import DataStore, save_data


async def run(args, store: DataStore) -> None:
    client = FatesEdgeRestClient(args.server, store.apiKey or args.api_key,
                                  auth_token=store.authToken)

    if args.upload:
        if not args.code:
            print("❌ Please provide --code ROOM_CODE")
            return
        try:
            code = await with_spinner(client.upload(args.code, store.to_dict()), "Uploading campaign")
            print(f"✅ Campaign uploaded to room {args.code}. Share code: {code}")
            print(f"   Load it again with: --code {args.code} --campaign-code {code}")
        except FatesEdgeApiError as e:
            print(f"❌ Upload failed: {e}")

    elif args.load:
        if not args.code:
            print("❌ Please provide --code ROOM_CODE")
            return
        if not args.campaign_code:
            print("❌ Please provide --campaign-code CODE (the share code an earlier --upload printed)")
            return
        try:
            data = await with_spinner(client.load(args.code, args.campaign_code), "Loading campaign")
            new_store = DataStore.from_dict(data)
            if store.characters or store.timers:
                confirm = input("This will replace local data. Continue? [y/N] ")
                if confirm.lower() != 'y':
                    print("Aborted.")
                    return
            store.characters = new_store.characters
            store.timers = new_store.timers
            store.wiki = new_store.wiki
            store.rollHistory = new_store.rollHistory
            store.talents = new_store.talents
            store.chatHistory = new_store.chatHistory
            store.encounters = new_store.encounters
            store.npcs = new_store.npcs
            store.deck = new_store.deck
            store.passwordHash = new_store.passwordHash
            store.baseUrl = new_store.baseUrl
            store.apiKey = new_store.apiKey
            store._nextId = new_store._nextId
            store._nextTalentId = new_store._nextTalentId
            store._nextEncounterId = new_store._nextEncounterId
            store._nextNpcId = new_store._nextNpcId
            save_data(store)
            print(f"✅ Campaign {args.campaign_code} (room {args.code}) loaded successfully.")
        except FatesEdgeApiError as e:
            print(f"❌ Load failed: {e}")

    elif args.delete:
        if not args.code:
            print("❌ Please provide --code ROOM_CODE")
            return
        try:
            await with_spinner(client.delete(args.code), "Deleting campaign")
            print(f"✅ Campaign {args.code} deleted from server.")
        except FatesEdgeApiError as e:
            print(f"❌ Delete failed: {e}")

    elif args.chat:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        if not args.message:
            print("❌ Please provide --message MESSAGE")
            return
        try:
            result = await with_spinner(
                client.send_chat(args.code, args.message, args.sender or "CLI"), "Sending message"
            )
            print(f"✅ Message sent: {result.get('message', {}).get('id')}")
        except FatesEdgeApiError as e:
            print(f"❌ Chat send failed: {e}")

    elif args.roll:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        if not args.dice:
            print("❌ Please provide --dice DICE_EXPRESSION")
            return
        try:
            result = await with_spinner(
                client.roll_dice(args.code, args.dice, args.reason or "CLI Roll"), "Rolling dice"
            )
            print(f"✅ Dice rolled: {result.get('expr')} = {result.get('result')}")
        except FatesEdgeApiError as e:
            print(f"❌ Dice roll failed: {e}")

    elif args.sync:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        try:
            async def sync_task():
                remote = await client.get_state(args.code)
                local_hash = hashlib.sha256(json.dumps(store.to_dict(), sort_keys=True).encode()).hexdigest()
                remote_hash = hashlib.sha256(json.dumps(remote, sort_keys=True).encode()).hexdigest()
                return local_hash, remote_hash, remote

            local_hash, remote_hash, remote = await with_spinner(sync_task(), "Checking sync status")

            if local_hash == remote_hash:
                print("✅ In sync")
            else:
                print("📊 Differences detected:")
                print(f"   Local hash:  {local_hash[:8]}...")
                print(f"   Remote hash: {remote_hash[:8]}...")
                direction = input("Upload local changes (u) or download remote (d)? ")
                if direction == 'u':
                    await with_spinner(client.sync_state(args.code, store.to_dict()), "Uploading state")
                    print("✅ State uploaded")
                else:
                    print("📥 Downloading remote state...")
                    print("⚠️  Merge functionality not implemented yet")
        except FatesEdgeApiError as e:
            print(f"❌ Sync failed: {e}")

    elif args.deck_get:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        try:
            result = await with_spinner(client.get_deck(args.code), "Getting deck state")
            print(f"✅ Deck has {result.get('remaining', 0)} cards remaining")
            print(f"   History: {len(result.get('deckHistory', []))} entries")
        except FatesEdgeApiError as e:
            print(f"❌ Deck get failed: {e}")

    elif args.deck_shuffle:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        try:
            result = await with_spinner(client.shuffle_deck(args.code), "Shuffling deck")
            print(f"✅ Deck shuffled. {result.get('remaining', 0)} cards remaining.")
        except FatesEdgeApiError as e:
            print(f"❌ Deck shuffle failed: {e}")

    elif args.deck_draw:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        count = args.count or 1
        region = args.region or "Acasia"
        try:
            result = await with_spinner(client.draw_cards(args.code, count, region), f"Drawing {count} cards")
            print(f"✅ Drew {len(result.get('cards', []))} cards from {region}")
            print(f"   {result.get('synthesis', 'No synthesis')}")
        except FatesEdgeApiError as e:
            print(f"❌ Deck draw failed: {e}")

    elif args.deck_crown:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        region = args.region or "Acasia"
        try:
            result = await with_spinner(client.crown_spread(args.code, region), "Performing Crown Spread")
            print("👑 Crown Spread:")
            if result.get('result'):
                print(f"   {result['result'].get('synthesis', 'No synthesis')}")
        except FatesEdgeApiError as e:
            print(f"❌ Crown spread failed: {e}")

    elif args.deck_seed_get:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        try:
            result = await with_spinner(client.get_deck_seed(args.code), "Getting deck seed")
            print(f"✅ Deck seed for room {result.get('code', args.code)}: {result.get('seed')}")
        except FatesEdgeApiError as e:
            print(f"❌ Deck seed get failed: {e}")

    elif args.deck_seed_set is not None:
        if not args.code:
            print("❌ Please provide --code CODE")
            return
        try:
            result = await with_spinner(client.set_deck_seed(args.code, args.deck_seed_set), "Reseeding deck")
            print(f"✅ Deck reseeded to {result.get('seed')}. {result.get('remaining', 0)} cards remaining.")
        except FatesEdgeApiError as e:
            print(f"❌ Deck reseed failed: {e}")

    else:
        print("Server subcommands:")
        print("  upload --server URL                - upload local data")
        print("  load --server URL --code CODE     - load campaign")
        print("  delete --server URL --code CODE   - delete campaign")
        print("  chat --server URL --code CODE --message MSG [--sender S]")
        print("  roll --server URL --code CODE --dice EXPRESSION [--reason R]")
        print("  sync --server URL --code CODE     - sync with server")
        print("  deck-get --server URL --code CODE - get deck state")
        print("  deck-shuffle --server URL --code CODE - shuffle deck")
        print("  deck-draw --server URL --code CODE --count N --region R - draw cards")
        print("  deck-crown --server URL --code CODE --region R - crown spread")
        print("  deck-seed-get --server URL --code CODE - get deck RNG seed")
        print("  deck-seed-set --server URL --code CODE --seed VALUE - reseed deck RNG")
