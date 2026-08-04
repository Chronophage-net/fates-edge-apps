"""
`fates-edge deck ...` -- ported from cmd_deck(), with the region-data bug
actually fixed: the old code passed `region_data = {}` (a hardcoded
placeholder, see the old file's "Load region data (simplified - would
need actual region data)" comment) into synthesise_consequence() /
synthesise_crown_spread(), so every draw's flavor text ignored --region
entirely. This now calls deck.load_region_data(region) for real.
"""

import random
from datetime import datetime

from ... import deck as deck_logic
from ...store import DataStore, save_data


def run(args, store: DataStore) -> None:
    if args.build:
        store.deck.cards = deck_logic.build_deck()
        store.deck.history = []
        store.deck.offset = random.randint(0, 1000)
        save_data(store)
        print(f"✅ Deck built with {len(store.deck.cards)} cards.")
        return

    if args.draw is not None:
        count = args.draw
        region = args.region or "Acasia"

        drawn = deck_logic.draw_cards(store.deck, count)
        region_data = deck_logic.load_region_data(region)
        synthesis = deck_logic.synthesise_consequence(drawn, region_data)

        store.deck.history.append({
            'cards': [c.to_dict() for c in drawn],
            'synthesis': synthesis,
            'type': f"{count} Draw",
            'timestamp': datetime.now().isoformat(),
        })
        save_data(store)

        print(f"🃏 Drew {count} card{'s' if count > 1 else ''}:")
        for i, c in enumerate(drawn):
            print(f"   {i + 1}. {c.rank_name} of {c.suit_name} {'🃏' if c.is_joker else ''}")
        print(f"\n📖 {synthesis}")
        return

    if args.crown:
        region = args.region or "Acasia"

        drawn = deck_logic.draw_cards(store.deck, 5)
        main_cards = drawn[:4]
        wildcard = drawn[4]
        region_data = deck_logic.load_region_data(region)
        result = deck_logic.synthesise_crown_spread(main_cards, wildcard, region_data)

        store.deck.history.append({
            'cards': [c.to_dict() for c in drawn],
            'synthesis': result['synthesis'],
            'type': 'Crown Spread',
            'timestamp': datetime.now().isoformat(),
        })
        save_data(store)

        print("👑 Crown Spread:")
        for pos in result['positions']:
            print(f"   {pos['icon']} {pos['label']}: {pos['meaning']}")
        print(f"\n🌟 Wildcard: {result['wildcard']}")
        return

    if args.history:
        if not store.deck.history:
            print("No deck history.")
            return
        for h in store.deck.history[-10:]:
            print(f"[{h.get('type', 'Draw')}] {h.get('synthesis', '')[:80]}...")
        return

    if args.clear_history:
        store.deck.history = []
        save_data(store)
        print("✅ Deck history cleared.")
        return

    if args.shuffle:
        store.deck.cards = deck_logic.build_deck()
        store.deck.offset = random.randint(0, 1000)
        save_data(store)
        print(f"✅ Deck shuffled. {len(store.deck.cards)} cards remaining.")
        return

    print("Deck subcommands:")
    print("  build                 - Build new deck")
    print("  shuffle               - Shuffle deck")
    print("  draw N [--region R]   - Draw N cards")
    print("  crown [--region R]    - Crown Spread")
    print("  history               - Show deck history")
    print("  clear-history         - Clear deck history")
