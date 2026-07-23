#!/usr/bin/env bash

# -------------------------------------------------------------------
# npm-install-all.sh – Run `npm install` in every subdirectory
#                     that contains a package.json file.
#
# Usage: ./npm-install-all.sh [--dry-run] [--parallel] [--ignore-scripts]
#
#   --dry-run       : Show which directories would be processed, but don't install.
#   --parallel      : Run installations in parallel (GNU parallel required).
#   --ignore-scripts: Pass --ignore-scripts to npm install (skip postinstall).
# -------------------------------------------------------------------

set -euo pipefail

DRY_RUN=false
PARALLEL=false
IGNORE_SCRIPTS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --parallel) PARALLEL=true; shift ;;
        --ignore-scripts) IGNORE_SCRIPTS=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Find all directories containing package.json (excluding node_modules)
DIRS=()
while IFS= read -r dir; do
    DIRS+=("$dir")
done < <(find . -type f -name "package.json" -not -path "*/node_modules/*" -exec dirname {} \; | sort -u)

if [[ ${#DIRS[@]} -eq 0 ]]; then
    echo "No package.json files found."
    exit 0
fi

echo "Found ${#DIRS[@]} directories with package.json:"
for d in "${DIRS[@]}"; do
    echo "  $d"
done
echo

if [[ "$DRY_RUN" == true ]]; then
    echo "Dry run – no installations will be performed."
    exit 0
fi

# Build npm install command with optional --ignore-scripts
NPM_CMD="npm install"
if [[ "$IGNORE_SCRIPTS" == true ]]; then
    NPM_CMD="npm install --ignore-scripts"
fi

# Function to run npm install in one directory
install_in_dir() {
    local dir="$1"
    echo "Installing in $dir ..."
    (cd "$dir" && $NPM_CMD)
    echo "✓ Done with $dir"
}

if [[ "$PARALLEL" == true ]]; then
    # Check if GNU parallel is available
    if ! command -v parallel &> /dev/null; then
        echo "Error: --parallel requires GNU parallel to be installed."
        echo "Install it with: brew install parallel (macOS) or apt install parallel (Linux)"
        exit 1
    fi
    export -f install_in_dir
    export NPM_CMD
    parallel install_in_dir ::: "${DIRS[@]}"
else
    for dir in "${DIRS[@]}"; do
        install_in_dir "$dir"
    done
fi

echo "All installations completed."
