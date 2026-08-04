"""`fates-edge characters ...` -- ported verbatim from cmd_characters()."""

from pathlib import Path

from ...io_utils import export_character, import_character
from ...models import Character
from ...store import DataStore, save_data


def run(args, store: DataStore) -> None:
    if args.list:
        if not store.characters:
            print("No characters.")
            return
        for c in store.characters:
            print(f"[{c.id}] {c.name} | Tier {c.tier} | B{c.body} W{c.wits} S{c.spirit} P{c.presence}")
            print(f"    Harm: {c.harm}, Fatigue: {c.fatigue}, Boons: {c.boons}")
        return

    if args.add:
        c = Character(id=store._nextId)
        store._nextId += 1
        if args.name:
            c.name = args.name
        if args.heritage:
            c.heritage = args.heritage
        if args.background:
            c.background = args.background
        if args.patron:
            c.patron = args.patron
        if args.tier:
            c.tier = args.tier
        if args.xp is not None:
            c.xp = args.xp
        if args.body is not None:
            c.body = args.body
        if args.wits is not None:
            c.wits = args.wits
        if args.spirit is not None:
            c.spirit = args.spirit
        if args.presence is not None:
            c.presence = args.presence
        if args.skill:
            for kv in args.skill:
                if '=' not in kv:
                    continue
                k, v = kv.split('=', 1)
                key = k.lower()
                if key in c.skills:
                    c.skills[key] = int(v)
        store.characters.append(c)
        save_data(store)
        print(f"✅ Character {c.name} (ID {c.id}) created.")
        return

    if args.delete is not None:
        idx = next((i for i, c in enumerate(store.characters) if c.id == args.delete), None)
        if idx is None:
            print(f"❌ Character ID {args.delete} not found.")
            return
        removed = store.characters.pop(idx)
        save_data(store)
        print(f"✅ Deleted character {removed.name} (ID {removed.id}).")
        return

    if args.export:
        try:
            export_character(store, args.export, Path(args.export_path or f"character_{args.export}.yaml"))
        except Exception as e:
            print(f"❌ Export failed: {e}")
        return

    if args.import_char:
        try:
            import_character(store, Path(args.import_char))
        except Exception as e:
            print(f"❌ Import failed: {e}")
        return

    print("Character subcommands:")
    print("  list                  - list all characters")
    print("  add [options]         - add a new character")
    print("  delete ID             - delete character by ID")
    print("  export ID [--export-path PATH] - export character to YAML")
    print("  import-char PATH      - import character from YAML")
