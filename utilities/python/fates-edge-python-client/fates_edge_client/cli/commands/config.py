"""`fates-edge config ...` -- ported verbatim from cmd_config()."""

from ...store import DataStore, save_data


def run(args, store: DataStore) -> None:
    if args.set_api_key:
        store.apiKey = args.set_api_key
        save_data(store)
        print("✅ API key set")

    elif args.show:
        print(f"API Key: {store.apiKey[:8]}...{store.apiKey[-4:] if store.apiKey else 'Not set'}")
        print(f"Server URL: {store.baseUrl or 'Not set'}")
        print(f"Characters: {len(store.characters)}")
        print(f"Timers: {len(store.timers)}")
        print(f"Roll History: {len(store.rollHistory)} entries")
        print(f"Deck: {len(store.deck.cards)} cards, {len(store.deck.history)} history entries")

    else:
        print("Configuration commands:")
        print("  --set-api-key KEY  - Set API key")
        print("  --show             - Show current configuration")
