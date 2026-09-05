#!/usr/bin/env bash

# -------------------------------------------------------------------
# demo.sh -- `npm run demo`. Brings up the full Fate's Edge demo stack
#            (client + server + Redis + local Ollama + AI GM bot) with
#            sensible defaults and no API keys required. See
#            docker-compose.full.yml's header comment for the full
#            explanation of what this starts and why.
#
# Usage: npm run demo
#     or: ./tools/demo.sh [--build] [--down] [--voice] [--voice-rvc]
#
#   (no args)  : bring the stack up (builds images if needed), attached
#   --build    : force a rebuild of the client/server/bot images even
#                if Docker thinks nothing changed (useful after pulling
#                new code in a sibling repo, since Docker's cache can't
#                see changes in ../fates-edge-ai-gm-bot on its own)
#   --down     : stop and remove the demo stack (containers + network;
#                named volumes -- the pulled model, Redis data, server
#                logs -- are left alone so the next `npm run demo` is fast)
#   --voice    : also bring up docker-compose.voice.yml's `tts` +
#                `voice-adapter` services, giving the AI GM a cloned
#                voice (Chatterbox, zero-shot from a reference clip --
#                see voice-tts-reference/README.md). Heavier than the
#                base demo (multi-GB model download on first run) --
#                see docker-compose.voice.yml's header comment.
#   --voice-rvc: everything --voice does, plus the `rvc` service for a
#                second voice-conversion layer -- needs a trained model
#                you supply yourself (see voice-rvc-models/README.md)
#                and VOICE_RVC_ENABLED=true in .env.demo to actually
#                turn it on for the bot, not just start the container.
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
VOICE_COMPOSE_FILE="$REPO_ROOT/docker-compose.voice.yml"
ENV_FILE="$REPO_ROOT/.env.demo"
ENV_EXAMPLE="$REPO_ROOT/.env.demo.example"

cd "$REPO_ROOT"

BUILD_FLAG=""
DOWN=false
VOICE=false
VOICE_RVC=false
for arg in "$@"; do
    case "$arg" in
        --build) BUILD_FLAG="--build" ;;
        --down) DOWN=true ;;
        --voice) VOICE=true ;;
        --voice-rvc) VOICE=true; VOICE_RVC=true ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

# ─── Build the -f file list and profile flags for docker compose ──
COMPOSE_FILE_ARGS=(-f "$COMPOSE_FILE")
PROFILE_ARGS=()
if [[ "$VOICE" == true ]]; then
    COMPOSE_FILE_ARGS+=(-f "$VOICE_COMPOSE_FILE")
fi
if [[ "$VOICE_RVC" == true ]]; then
    PROFILE_ARGS+=(--profile voice-rvc)
fi

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
# Always includes the voice compose file (harmless if those services
# were never started) so `--down` alone tears down everything from a
# previous `--voice`/`--voice-rvc` run too, without needing to remember
# which flags you brought it up with.
if [[ "$DOWN" == true ]]; then
    echo "Stopping the demo stack (volumes are kept -- pulled model, Redis data, server logs,"
    echo "Chatterbox's model cache)..."
    DOWN_FILE_ARGS=(-f "$COMPOSE_FILE")
    [[ -f "$VOICE_COMPOSE_FILE" ]] && DOWN_FILE_ARGS+=(-f "$VOICE_COMPOSE_FILE")
    "${COMPOSE[@]}" "${DOWN_FILE_ARGS[@]}" --profile voice-rvc --env-file "$ENV_FILE" down 2>/dev/null \
        || "${COMPOSE[@]}" "${DOWN_FILE_ARGS[@]}" --profile voice-rvc down
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
# Preserve a one-run shell override. Without this, sourcing .env.demo
# silently replaced `DEMO_LEVEL=light npm run demo` with the value in the
# file, which made the documented quick override look as though it worked
# while the heavier settings were still used.
DEMO_LEVEL_OVERRIDE="${DEMO_LEVEL:-}"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
if [[ -n "$DEMO_LEVEL_OVERRIDE" ]]; then
    export DEMO_LEVEL="$DEMO_LEVEL_OVERRIDE"
fi

# Apple-silicon laptops can run the whole stack, but Docker has no Metal
# passthrough and local generation is CPU-bound. Use the light context by
# default there; an explicit DEMO_LEVEL=default or quality still wins.
if [[ -z "$DEMO_LEVEL_OVERRIDE" && "${DEMO_LEVEL:-default}" == "default" \
      && "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" ]]; then
    export DEMO_LEVEL="light"
    echo "Apple silicon detected -- using DEMO_LEVEL=light for this run."
    echo "Set DEMO_LEVEL=default or quality explicitly to override it."
    echo
fi

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

if [[ "$VOICE" == true ]]; then
    echo "🎙️  --voice: bringing up Chatterbox + voice-adapter too."
    echo "   First run pulls the Chatterbox image, then downloads its model weights on"
    echo "   first startup (together, roughly a few GB) -- this is on top of the Ollama"
    echo "   pull above and can take 10-15 minutes on a slower connection. Watch progress"
    echo "   with: docker logs -f fates-edge-demo-tts"
    if [[ ! -s "$REPO_ROOT/voice-tts-reference/${CHATTERBOX_REFERENCE_FILE:-reference.wav}" ]]; then
        echo "   ⚠️  No reference clip found at voice-tts-reference/${CHATTERBOX_REFERENCE_FILE:-reference.wav} --"
        echo "      the GM will still talk, just in Chatterbox's stock voice, not a cloned one."
        echo "      Drop a 10-30s .wav there (see that folder's README) and restart to clone it."
    else
        echo "   ✓ Found reference clip: voice-tts-reference/${CHATTERBOX_REFERENCE_FILE:-reference.wav}"
    fi
    echo
fi
if [[ "$VOICE_RVC" == true ]]; then
    echo "🗣️  --voice-rvc: also bringing up the rvc service."
    if [[ "${VOICE_RVC_ENABLED:-false}" != "true" ]]; then
        echo "   ⚠️  VOICE_RVC_ENABLED is not 'true' in .env.demo -- the rvc container will start,"
        echo "      but the bot won't route audio through it until you set that and restart."
    fi
    if [[ -z "$(ls -A "$REPO_ROOT/voice-rvc-models" 2>/dev/null | grep -v -e README.md -e .gitkeep)" ]]; then
        echo "   ⚠️  voice-rvc-models/ looks empty -- see that folder's README for what to put there."
    fi
    echo
fi

echo "Press Ctrl+C to stop. Nothing is deleted -- 'npm run demo' again picks up"
echo "right where you left off. Use 'npm run demo -- --down' to tear it down."
echo

exec "${COMPOSE[@]}" "${COMPOSE_FILE_ARGS[@]}" "${PROFILE_ARGS[@]}" --env-file "$ENV_FILE" up $BUILD_FLAG
