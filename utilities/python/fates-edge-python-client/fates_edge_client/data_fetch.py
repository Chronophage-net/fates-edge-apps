"""
Fetches the region flavor-text data (`data --fetch`) that used to be
bundled directly into this package's wheel/sdist.

That data -- setting lore for each region, used by `deck --draw`/`--crown`
to pick region-flavored card meanings -- is Fate's Edge Copyright content,
licensed separately from this MIT-licensed client (see LICENSE.proprietary
in the fates-edge-apps repo: personal, non-commercial use only). Bundling
it into a package whose own metadata says "License :: MIT" made every
installed copy of this client claim to be 100% MIT when it wasn't. As of
v5.1.0 it isn't bundled anymore -- this module downloads it on request
instead, straight from the same repo path it used to ship from, into a
local cache directory outside the installed package (see
config.REGION_DATA_DIR). Nothing calls this automatically; running without
it just means `deck --draw` falls back to generic, non-region-specific
card meanings (see deck.py's load_region_data()).
"""

import json
from pathlib import Path
from typing import List, Optional

import requests

from .config import REGION_DATA_DIR

# Same relative path this data used to be bundled from -- see the removed
# [tool.setuptools.package-data] entry in pyproject.toml.
_RAW_BASE = (
    "https://raw.githubusercontent.com/Chronophage-net/fates-edge-apps/"
    "main/utilities/python/fates-edge-python-client/fates_edge_client/data/regions"
)

LICENSE_NOTICE = (
    "This downloads Fate's Edge region lore -- Copyright (c) Nicholas A. Gasper,\n"
    "licensed separately from this MIT client for personal, non-commercial use\n"
    "only. See LICENSE.proprietary in the fates-edge-apps repo for the full terms."
)


def fetch_region_data(dest_dir: Optional[Path] = None, quiet: bool = False) -> List[str]:
    """Download manifest.json + every region file it lists into `dest_dir`
    (default: config.REGION_DATA_DIR). Returns the list of region slugs
    fetched. Raises requests.RequestException on network/HTTP failure --
    callers that want a best-effort/silent fetch should catch that."""
    dest_dir = dest_dir or REGION_DATA_DIR
    dest_dir.mkdir(parents=True, exist_ok=True)

    if not quiet:
        print(LICENSE_NOTICE)

    manifest_resp = requests.get(f"{_RAW_BASE}/manifest.json", timeout=10)
    manifest_resp.raise_for_status()
    slugs = json.loads(manifest_resp.text)

    (dest_dir / "manifest.json").write_text(manifest_resp.text, encoding="utf-8")

    fetched = []
    for slug in slugs:
        resp = requests.get(f"{_RAW_BASE}/{slug}.json", timeout=10)
        resp.raise_for_status()
        (dest_dir / f"{slug}.json").write_text(resp.text, encoding="utf-8")
        fetched.append(slug)
        if not quiet:
            print(f"  fetched {slug}.json")

    if not quiet:
        print(f"✅ {len(fetched)} region file(s) saved to {dest_dir}")

    return fetched
