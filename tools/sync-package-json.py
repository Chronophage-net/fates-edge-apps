#!/usr/bin/env python3
"""
Sync author and version across all package.json files in a repo.

Usage:
  python sync_package_json.py [--author "Your Name <email>"] [--version "1.2.3"] [--root PATH]

If --author and --version are omitted, the script will read them from the root package.json
(if found) and use those as the source.
"""

import os
import sys
import json
import argparse
from pathlib import Path

def find_package_json(root_dir, exclude_dirs=("node_modules", ".git", "dist", "build", "coverage")):
    """Yield all package.json file paths under root_dir, excluding common ignore dirs."""
    root = Path(root_dir).resolve()
    for path in root.rglob("package.json"):
        # Skip if any part of the path is in exclude_dirs
        if any(part in exclude_dirs for part in path.parts):
            continue
        yield path

def read_json(filepath):
    """Read and parse JSON file."""
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def write_json(filepath, data):
    """Write JSON with pretty formatting (2 spaces)."""
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")   # add trailing newline

def get_root_values(root_dir):
    """Attempt to read author and version from the root package.json."""
    root_pkg = Path(root_dir) / "package.json"
    if root_pkg.exists():
        try:
            data = read_json(root_pkg)
            return data.get("author"), data.get("version")
        except Exception as e:
            print(f"Warning: Could not read root package.json: {e}")
    return None, None

def main():
    parser = argparse.ArgumentParser(description="Sync author and version across all package.json files.")
    parser.add_argument("--author", help="Author string (e.g., 'John Doe <john@example.com>')")
    parser.add_argument("--version", help="Version string (e.g., '1.2.3')")
    parser.add_argument("--root", default=".", help="Root directory of the repository (default: current directory)")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be changed without writing")
    args = parser.parse_args()

    root_dir = args.root

    # If author/version not provided, try to read from root package.json
    if args.author is None or args.version is None:
        root_author, root_version = get_root_values(root_dir)
        if args.author is None:
            args.author = root_author
        if args.version is None:
            args.version = root_version

    if args.author is None and args.version is None:
        print("Error: Neither --author/--version provided nor found in root package.json.")
        sys.exit(1)

    # If either is still missing, we can still proceed with the one that is set,
    # but we'll warn that the other will not be changed.
    if args.author is None:
        print("Warning: No author provided; author field will not be changed.")
    if args.version is None:
        print("Warning: No version provided; version field will not be changed.")

    modified_count = 0
    for pkg_path in find_package_json(root_dir):
        try:
            data = read_json(pkg_path)
            changed = False

            if args.author is not None and data.get("author") != args.author:
                data["author"] = args.author
                changed = True
            if args.version is not None and data.get("version") != args.version:
                data["version"] = args.version
                changed = True

            if changed:
                print(f"Updating {pkg_path}")
                if not args.dry_run:
                    write_json(pkg_path, data)
                modified_count += 1
        except Exception as e:
            print(f"Error processing {pkg_path}: {e}")

    print(f"Done. {modified_count} file(s) updated.")

if __name__ == "__main__":
    main()
