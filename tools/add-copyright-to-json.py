#!/usr/bin/env python3
"""
clean_and_license.py — Strip invalid extras from JSON files and add license.
"""

import json, os, sys

LICENSE = (
    "Fate's Edge Proprietary Content – "
    "© 2024 Nicholas A. Gasper. All rights reserved."
)

def fix_file(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            raw = f.read()
        # Find the start of the first JSON value
        decoder = json.JSONDecoder()
        obj, end_idx = decoder.raw_decode(raw)
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

for root, _, files in os.walk("."):
    for f in files:
        if f.lower().endswith(".json"):
            path = os.path.join(root, f)
            fix_file(path)
