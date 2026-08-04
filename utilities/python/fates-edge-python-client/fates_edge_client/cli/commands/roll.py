"""`fates-edge roll ...` -- ported verbatim from cmd_roll()."""

from ...rolls import perform_roll
from ...store import DataStore, save_data


def run(args, store: DataStore) -> None:
    if args.attr is None or args.skill is None or args.dv is None:
        print("Usage: roll --attr A --skill S --dv N [--pos POS] [--boons B]")
        return
    try:
        result = perform_roll(args.attr, args.skill, args.dv, args.pos, args.boons)
        print(f"🎲 Roll: {result['attr']}+{result['skill']} vs DV{result['dv']} ({result['pos']})")
        print(f"   Dice: {' '.join(map(str, result['dice']))}")
        print(f"   Successes: {result['successes']} | SB: {result['sb']}")
        print(f"   Outcome: {result['outcome']} — {result['result_text']}")

        store.rollHistory.append(result)
        save_data(store)
    except ValueError as e:
        print(f"❌ {e}")
