"""`fates-edge account ...` -- optional account auth + the server-owned,
5-character-per-account character library. NEW module: none of this
existed in the old single-file client because the server itself had no
account system until now (see server/auth.js, server/api.js).

Entirely optional. A user who never runs any `account` subcommand sees
no behavior change anywhere else in this client -- `server`/`websocket`
subcommands just omit the auth token they'd otherwise attach.
"""

import json

from ...io_utils import with_spinner
from ...rest_client import FatesEdgeApiError, FatesEdgeRestClient
from ...store import DataStore, save_data


def _client(args, store: DataStore) -> FatesEdgeRestClient:
    return FatesEdgeRestClient(args.server, store.apiKey or args.api_key,
                                auth_token=store.authToken)


async def run(args, store: DataStore) -> None:
    client = _client(args, store)

    if args.register or args.login:
        if not args.username or not args.password:
            print("❌ Please provide --username and --password")
            return
        try:
            verb = "Registering" if args.register else "Logging in"
            action = client.register if args.register else client.login
            result = await with_spinner(action(args.username, args.password), verb)
            store.authToken = result.get('token', '')
            store.authUsername = result.get('user', {}).get('username', args.username)
            save_data(store)
            print(f"✅ {'Registered and logged in' if args.register else 'Logged in'} as {store.authUsername}")
        except FatesEdgeApiError as e:
            print(f"❌ {'Registration' if args.register else 'Login'} failed: {e}")

    elif args.logout:
        store.authToken = ''
        store.authUsername = ''
        save_data(store)
        print("✅ Logged out")

    elif args.whoami:
        if not store.authToken:
            print("🔓 Not logged in (playing anonymously). Use --login or --register.")
            return
        try:
            me = await with_spinner(client.whoami(), "Checking account")
            print(f"🔐 Logged in as: {me.get('username', store.authUsername)}")
        except FatesEdgeApiError as e:
            print(f"❌ Could not verify login (token may be expired): {e}")

    elif args.set_room_password:
        if not args.code:
            print("❌ Please provide --code ROOM_CODE")
            return
        try:
            await with_spinner(client.set_room_password(args.code, args.set_room_password),
                                "Setting room password")
            print(f"✅ Password set for room {args.code}")
        except FatesEdgeApiError as e:
            print(f"❌ Failed to set room password: {e}")

    elif args.ban_user:
        if not args.code:
            print("❌ Please provide --code ROOM_CODE")
            return
        try:
            await with_spinner(client.ban_member(args.code, args.ban_user), "Banning member")
            print(f"✅ Banned user {args.ban_user} from room {args.code} (persists across reconnects)")
        except FatesEdgeApiError as e:
            print(f"❌ Ban failed: {e}")

    elif args.unban_user:
        if not args.code:
            print("❌ Please provide --code ROOM_CODE")
            return
        try:
            await with_spinner(client.unban_member(args.code, args.unban_user), "Unbanning member")
            print(f"✅ Unbanned user {args.unban_user} from room {args.code}")
        except FatesEdgeApiError as e:
            print(f"❌ Unban failed: {e}")

    elif args.list_characters:
        try:
            chars = await with_spinner(client.list_account_characters(), "Fetching account characters")
            if not chars:
                print("No characters stored on your account (0/5).")
            for c in chars:
                print(f"  [{c.get('id')}] {c.get('name')}")
            print(f"{len(chars)}/5 slots used")
        except FatesEdgeApiError as e:
            print(f"❌ Failed to list account characters: {e}")

    elif args.upload_character is not None:
        idx = args.upload_character
        match = next((c for c in store.characters if c.id == idx), None)
        if not match:
            print(f"❌ No local character with ID {idx}")
            return
        try:
            result = await with_spinner(
                client.create_account_character(match.name, match.to_dict()),
                "Uploading character to your account",
            )
            print(f"✅ Uploaded '{match.name}' to your account (id {result.get('id')})")
        except FatesEdgeApiError as e:
            if e.status_code == 409:
                print("❌ Account character limit reached (5/5). Delete one first with --delete-character ID.")
            else:
                print(f"❌ Upload failed: {e}")

    elif args.delete_character:
        try:
            await with_spinner(client.delete_account_character(args.delete_character),
                                "Deleting account character")
            print(f"✅ Deleted account character {args.delete_character}")
        except FatesEdgeApiError as e:
            print(f"❌ Delete failed: {e}")

    else:
        print("Account subcommands (all optional -- anonymous play still works fully):")
        print("  --register --username U --password P   - create an account and log in")
        print("  --login --username U --password P      - log in")
        print("  --logout                                - forget the locally stored token")
        print("  --whoami                                - show current login status")
        print("  --list-characters                       - list characters stored on your account (max 5)")
        print("  --upload-character ID                   - copy a local character to your account")
        print("  --delete-character ID                   - remove a character from your account")
        print("  --set-room-password PASS --code CODE    - (admin) set/replace a room's join password")
        print("  --ban-user USER_ID --code CODE          - (admin) persistently ban an account from a room")
        print("  --unban-user USER_ID --code CODE        - (admin) lift a persistent ban")
