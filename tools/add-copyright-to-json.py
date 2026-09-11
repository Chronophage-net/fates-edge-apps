#!/usr/bin/env python3
"""
clean_and_license.py — Strip invalid extras from JSON files and add license.
"""

import json, os, sys

LICENSE = (
    "Fate's Edge Copyright – "
    "© 2024 - 2026 Nicholas A. Gasper. Used with permission, All rights reserved."
)

def fix_file(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            raw = f.read()
        # Find the start of the first JSON value
        decoder = json.JSONDecoder()
        obj = json.loads(raw)
        # Now obj is the first JSON object/array, end_idx is where it ended
        if isinstance(obj, dict):
            obj["_license"] = LICENSE
        elif isinstance(obj, list):
            obj = {"_license": LICENSE, "data": obj}
        else:
            obj = {"_license": LICENSE, "value": obj}
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(obj, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"Cleaned + licensed: {filepath}")
    except json.JSONDecodeError as e:
        print(f"Still invalid: {filepath} — {e}", file=sys.stderr)
    except Exception as e:
        print(f"Error processing {filepath}: {e}", file=sys.stderr)

EXCLUDED = {"node_modules", ".git", "venv", ".venv", "dist", "build", "coverage", "vendor", "site-packages"}


def license_tree(directory):
    """Only walk explicitly selected first-party data; never follow dependency trees."""
    from pathlib import Path
    base = Path(directory).resolve()
    if any(part in EXCLUDED for part in base.parts):
        raise ValueError("Refusing to stamp third-party or generated files")
    for root, dirs, files in os.walk(base, followlinks=False):
        dirs[:] = [name for name in dirs if name not in EXCLUDED and not Path(root, name).is_symlink()]
        for name in files:
            path = Path(root, name)
            if path.is_symlink() or name in {"package.json", "package-lock.json", "manifest.json"}:
                continue
            if name.lower().endswith(".json"):
                fix_file(path)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Usage: add-copyright-to-json.py FIRST_PARTY_DATA_DIRECTORY [...]. Review schema compatibility before wrapping arrays.")
    for directory in sys.argv[1:]:
        license_tree(directory)
