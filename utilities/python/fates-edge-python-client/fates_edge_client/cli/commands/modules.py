"""
`fates-edge modules ...` -- ported verbatim from cmd_modules().

Kept as a stub exactly like the old client (it never actually called the
server, per the redesign plan's audit notes). `rest_client.py` now has
real `list_modules()`/`push_module()`/`cleanup_module()` methods it
could delegate to, but wiring that up is a user-facing feature change
outside this redesign's explicit non-goals, not a bug fix -- left for a
follow-up.
"""

from ...store import DataStore


def run(args, store: DataStore) -> None:
    if args.list:
        print("📦 Available modules:")
        print("  (Use --server URL to query the server for available modules)")
        return

    if args.push:
        if not args.module_id:
            print("❌ Please provide --module-id ID")
            return
        print(f"📦 Pushing module: {args.module_id}")
        print("  (Use --server URL to push to a server)")
        return

    if args.cleanup:
        if not args.module_id:
            print("❌ Please provide --module-id ID")
            return
        print(f"🧹 Cleaning up module: {args.module_id}")
        print("  (Use --server URL to cleanup from a server)")
        return

    print("Module subcommands:")
    print("  list                  - List available modules")
    print("  push --module-id ID   - Push module to clients")
    print("  cleanup --module-id ID - Cleanup module from clients")
