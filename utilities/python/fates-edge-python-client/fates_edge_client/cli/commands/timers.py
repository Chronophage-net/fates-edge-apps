"""`fates-edge timers ...` -- ported verbatim from cmd_timers()."""

from ...models import Timer
from ...store import DataStore, save_data


def run(args, store: DataStore) -> None:
    if args.list:
        if not store.timers:
            print("No timers.")
            return
        for t in store.timers:
            print(f"[{t.id}] {t.name} | {t.current}/{t.segments}")
        return

    if args.add:
        name = args.name or "Unnamed"
        segments = args.segments or 4
        t = Timer(id=store._nextId, name=name, segments=segments, current=0)
        store._nextId += 1
        store.timers.append(t)
        save_data(store)
        print(f"✅ Timer '{name}' (ID {t.id}) created with {segments} segments.")
        return

    if args.tick is not None:
        t = next((x for x in store.timers if x.id == args.tick), None)
        if not t:
            print(f"❌ Timer ID {args.tick} not found.")
            return
        t.current = min(t.current + 1, t.segments)
        save_data(store)
        print(f"⏱️  Timer '{t.name}' ticked: {t.current}/{t.segments}")
        return

    if args.reset is not None:
        t = next((x for x in store.timers if x.id == args.reset), None)
        if not t:
            print(f"❌ Timer ID {args.reset} not found.")
            return
        t.current = 0
        save_data(store)
        print(f"↺ Timer '{t.name}' reset to 0/{t.segments}")
        return

    if args.delete is not None:
        idx = next((i for i, x in enumerate(store.timers) if x.id == args.delete), None)
        if idx is None:
            print(f"❌ Timer ID {args.delete} not found.")
            return
        removed = store.timers.pop(idx)
        save_data(store)
        print(f"🗑️  Deleted timer '{removed.name}'.")
        return

    print("Timer subcommands:")
    print("  list                  - list all timers")
    print("  add --name NAME --segments N - add timer")
    print("  tick ID               - advance timer by 1")
    print("  reset ID              - reset timer to 0")
    print("  delete ID             - delete timer")
