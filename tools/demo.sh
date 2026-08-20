#!/usr/bin/env bash

# -------------------------------------------------------------------
# demo.sh -- `npm run demo`. Brings up the full Fate's Edge demo stack
#            (client + server + Redis + local Ollama + AI GM bot) with
#            sensible defaults and no API keys required. See
#            docker-compose.full.yml's header comment for the full
#            explanation of what this starts and why.
#
# Usage: npm run demo
#     or: ./tools/demo.sh [--build] [--down]
#
#   (no args)  : bring the stack up (builds images if needed), attached
#   --build    : force a rebuild of the client/server/bot images even
#                if Docker thinks nothing changed (useful after pulling
#                new code in a sibling repo, since Docker's cache can't
#                see changes in ../fates-edge-ai-gm-bot on its own)
#   --down     : stop and remove the demo stack (containers + network;
#                named volumes -- the pulled model, Redis data, server
#                logs -- are left alone so the next `npm run demo` is fast)
#
# Slow machine, or model replies timing out? Set DEMO_LEVEL=light in
# .env.demo (or DEMO_LEVEL=quality for a beefier machine) -- see that
# file's "Local model (Ollama)" section for the full explanation.
# -------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AI_GM_BOT_DIR="$(cd "$REPO_ROOT/.." 2>/dev/null && pwd)/fates-edge-ai-gm-bot"
AI_GM_BOT_REPO_URL="https://github.com/Chronophage-net/fates-edge-ai-gm-bot.git"
COMPOSE_FILE="$REPO_ROOT/docker-compose.full.yml"
ENV_FILE="$REPO_ROOT/.env.demo"
ENV_EXAMPLE="$REPO_ROOT/.env.demo.example"

cd "$REPO_ROOT"

BUILD_FLAG=""
DOWN=false
for arg in "$@"; do
    case "$arg" in
        --build) BUILD_FLAG="--build" ;;
        --down) DOWN=true ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

# ─── Pick a Compose command (V2 required -- see docker-compose.full.yml) ──
if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
    echo "⚠️  Only the legacy 'docker-compose' (v1) binary was found." >&2
    echo "   docker-compose.full.yml uses the 'service_completed_successfully'" >&2
    echo "   depends_on condition, which v1 does not support -- the Ollama" >&2
    echo "   model-pull step may not be waited on correctly." >&2
    echo "   Install Docker Desktop or the Compose V2 plugin: https://docs.docker.com/compose/install/" >&2
    COMPOSE=(docker-compose)
else
    echo "❌ Docker Compose not found. Install Docker Desktop (includes Compose V2):" >&2
    echo "   https://docs.docker.com/get-docker/" >&2
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker doesn't seem to be running. Start Docker Desktop (or dockerd) and try again." >&2
    exit 1
fi

# ─── Handle --down and exit early ─────────────────────────────────
if [[ "$DOWN" == true ]]; then
    echo "Stopping the demo stack (volumes are kept -- pulled model, Redis data, server logs)..."
    "${COMPOSE[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down 2>/dev/null \
        || "${COMPOSE[@]}" -f "$COMPOSE_FILE" down
    echo "✓ Stopped. Run 'npm run demo' again any time -- the model and data are still cached."
    exit 0
fi

# ─── Make sure the sibling AI GM bot repo exists (build context) ──
if [[ ! -d "$AI_GM_BOT_DIR" ]]; then
    echo "fates-edge-ai-gm-bot isn't cloned next to this repo yet."
    echo "Expected at: $AI_GM_BOT_DIR"
    if command -v git >/dev/null 2>&1; then
        echo "Cloning it now (one-time)..."
        git clone "$AI_GM_BOT_REPO_URL" "$AI_GM_BOT_DIR"
    else
        echo "❌ git isn't available to clone it automatically. Clone it yourself:" >&2
        echo "   git clone $AI_GM_BOT_REPO_URL \"$AI_GM_BOT_DIR\"" >&2
        exit 1
    fi
else
    echo "✓ Found fates-edge-ai-gm-bot at $AI_GM_BOT_DIR"
fi

# ─── Make sure an env file exists (defaults work fine either way) ─
if [[ ! -f "$ENV_FILE" ]]; then
    echo "No .env.demo found -- creating one from .env.demo.example (all defaults, nothing required)."
    cp "$ENV_EXAMPLE" "$ENV_FILE"

    # Generate a random per-run API key instead of leaving the example
    # file's static "demo-local-key-change-me" placeholder in place --
    # keeps the demo secure-by-default even if someone forgets to change
    # it before exposing the stack beyond their own machine.
    GENERATED_API_KEY=""
    if command -v openssl >/dev/null 2>&1; then
        GENERATED_API_KEY="$(openssl rand -hex 16)"
    elif command -v node >/dev/null 2>&1; then
        GENERATED_API_KEY="$(node -e "process.stdout.write(require('crypto').randomBytes(16).toString('hex'))")"
    elif [[ -r /dev/urandom ]]; then
        GENERATED_API_KEY="$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    fi

    if [[ -n "$GENERATED_API_KEY" ]]; then
        # Portable in-place edit -- the empty '' suffix after -i works on
        # both GNU sed (Linux) and BSD/macOS sed, which otherwise differ
        # on whether -i takes its backup-suffix arg inline or separately.
        sed -i.bak "s/^API_KEY=.*/API_KEY=${GENERATED_API_KEY}/" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
        echo "Generated a random API_KEY for this .env.demo (unique per run -- see the file if you"
        echo "need it for anything outside the stack itself, e.g. hitting the server's REST API directly)."
    else
        echo "⚠️  Couldn't find openssl, node, or /dev/urandom to generate a random API_KEY --" >&2
        echo "   keeping the static placeholder from .env.demo.example. Fine for a local-only demo;" >&2
        echo "   change it yourself before exposing this stack beyond your own machine." >&2
    fi
fi

# Read the values back so the "open this URL" message below shows what
# will actually be used, not just the compose file's own fallback
# syntax -- .env.demo is a file this script generates itself from a
# known-safe template, so sourcing it directly is fine.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ─── DEMO_LEVEL: an all-or-nothing preset over the three Ollama knobs ──
# (DEMO_OLLAMA_MODEL / _CONTEXT_WINDOW / _TIMEOUT_MS). Doesn't probe your
# actual hardware -- Docker Desktop's CPU/RAM allocation isn't visible to
# a script running outside the container anyway -- just three sensible
# bundles for people who'd rather say "my laptop is a potato" or "I've
# got a beefy machine" than tune three separate .env.demo values. Unset
# or "default" leaves whatever's already in .env.demo alone. Exporting
# here (rather than just setting) is what lets these win over --env-file
# when Compose resolves ${...} in docker-compose.full.yml.
case "${DEMO_LEVEL:-default}" in
    light)
        export DEMO_OLLAMA_MODEL="llama3.2:1b"
        export DEMO_OLLAMA_CONTEXT_WINDOW="4096"
        export DEMO_OLLAMA_TIMEOUT_MS="240000"
        echo "DEMO_LEVEL=light -- smallest/fastest model (llama3.2:1b), smaller context,"
        echo "a generous 4min timeout for slow/CPU-only machines."
        echo
        ;;
    quality)
        export DEMO_OLLAMA_MODEL="mistral"
        export DEMO_OLLAMA_CONTEXT_WINDOW="8192"
        export DEMO_OLLAMA_TIMEOUT_MS="300000"
        echo "DEMO_LEVEL=quality -- best writing (mistral, ~4.1GB first pull), 5min timeout"
        echo "to give the larger model room on CPU-only Ollama."
        echo
        ;;
    default|"") ;;
    *)
        echo "⚠️  Unknown DEMO_LEVEL='$DEMO_LEVEL' (expected light, default, or quality) --" >&2
        echo "   ignoring it and using DEMO_OLLAMA_MODEL/_CONTEXT_WINDOW/_TIMEOUT_MS from .env.demo as-is." >&2
        ;;
esac

echo
echo "Starting the demo stack: client + server + Redis + local Ollama + AI GM bot"
echo "(First run: builds 3 images and pulls a small local model -- a few minutes."
echo " Later runs reuse the Docker cache and the already-pulled model -- much faster.)"
echo
if [[ "${DEMO_OLLAMA_MODEL:-llama3.2:1b}" == "llama3.2:1b" ]]; then
    echo "ℹ️  Using llama3.2:1b -- fast to pull, but its writing can get nonsensical on"
    echo "   complex TTRPG scenarios (don't worry, the AI GM isn't broken -- it's just a"
    echo "   very small model). For a noticeably better GM, set DEMO_LEVEL=quality in"
    echo "   .env.demo for an all-in-one preset, or hand-pick with"
    echo "   DEMO_OLLAMA_MODEL=llama3.2:3b / mistral (both larger and smarter, just"
    echo "   slower to pull the first time)."
    echo
fi
echo "Once it's up:"
echo "  1. Open http://localhost:${CLIENT_PORT:-8080}"
echo "  2. Create/join room \"${DEMO_ROOM:-DEMO}\""
echo "  3. Wait ~10s -- the AI GM bot auto-joins and takes the GM seat"
echo "     (its very first reply may take an extra 10-30s while Ollama loads the model"
echo "     into memory for the first time -- every reply after that is much faster)"
echo "  4. Open a second tab, join the same room, and turn on voice chat in both"
echo "  5. (optional) http://localhost:${AIGM_STATUS_PORT:-4141} -- the bot's own live status dashboard"
echo
echo "Press Ctrl+C to stop. Nothing is deleted -- 'npm run demo' again picks up"
echo "right where you left off. Use 'npm run demo -- --down' to tear it down."
echo

exec "${COMPOSE[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up $BUILD_FLAG
