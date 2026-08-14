"""`fates-edge data ...` -- fetches the (non-MIT) region lore data that
`deck --draw`/`--crown` can use for region-flavored card meanings. See
data_fetch.py's module docstring for why this is a separate opt-in step
rather than something bundled into the install."""

import requests

from ...data_fetch import fetch_region_data


def run(args, store) -> None:
    if args.fetch:
        try:
            fetch_region_data()
        except requests.RequestException as e:
            print(f"❌ Fetch failed: {e}")
    else:
        print("Data commands:")
        print("  --fetch  - Download region lore data for `deck --draw`/`--crown`")
