# Running the Fate's Edge AI GM Bot

A complete, start-to-finish guide to getting the **AI GM Bot** — an autonomous AI Game Master for
*Fate's Edge* — up and running against a live campaign server. This guide consolidates the setup
material spread across the bot's own `README.md`, `INSTALL.md`, `DESIGN.md`, and
`adventure_manual.md` (all in the [`fates-edge-ai-gm-bot`](https://github.com/Chronophage-net/fates-edge-ai-gm-bot)
repository) into one place. It doesn't replace those documents — it's the on-ramp; each section
below links back to the source of truth for anything you want to go deeper on.

---

## 1. Where this fits in the ecosystem

The AI GM Bot is **one repository among several** that make up the Fate's Edge toolkit, and it's
worth understanding how they relate before installing anything:

| Repo | What it is |
|---|---|
| **`fates-edge-apps`** | The monorepo everyone else needs: the web client (the app your players actually use), the socket server (the real-time backend), and every VTT integration (Discord, Roll20, Foundry). |
| **`fates-edge-ai-gm-bot`** *(this guide)* | A standalone client that connects to the socket server, claims the Game Master seat, and narrates using a pluggable AI backend (OpenAI, DeepSeek, or a local Ollama model). It is not part of `fates-edge-apps` — it's developed and versioned separately, and cloned as a sibling directory when you want it. |
| **`fates-edge-docs`** | The source-of-truth documents (rules, patrons, regions, adventures) that everything else consumes. Not something you run — it's where the game content itself lives and gets built from. |

The bot is, functionally, just another WebSocket client on the socket server — indistinguishable
from a human GM except for the optional `assistant-gm` room role it can hold instead of full `gm`
(see [§8](#8-assistant-gm-mode) below). That means **you need a running socket server before the
bot is useful for anything** — it has nothing to connect to otherwise. If you haven't set one up
yet, do that first: see [`fates-edge-socket-server`'s own README](https://github.com/Chronophage-net/fates-edge-apps/tree/main/utilities/javascript/fates-edge-socket-server)
and `INSTALL.md`.

**Just want to see the whole thing work, no setup?** From a `fates-edge-apps` checkout:

```bash
npm run demo
```

This brings up the web client, the socket server, Redis, a local Ollama instance, and the AI GM
bot (cloned automatically as a sibling directory), wired together with working defaults — no API
keys, nothing cloud-hosted. Open `http://localhost:8080`, join room `DEMO`, and the bot takes the
GM seat within about ten seconds. That's the fastest path to "show me it running." The rest of this
guide is for when you already have (or are setting up) your own socket server and want to run the
AI GM against it for real, on your own AI backend of choice.

---

## 2. Prerequisites

- [ ] **A running Fate's Edge socket server**, and its address + room code (e.g.
      `ws://localhost:10000`, room `AC12`) — same address your players use in the web client.
- [ ] **The socket server's `API_KEY`** — the bot needs this to save/load campaign data
      (auto-save, Facts, adventure progress). Whoever set up the server has this.
- [ ] **Node.js 18 or newer**, or **Docker**, whichever you'd rather use.
- [ ] **An AI backend**, decided before you start the setup wizard (it will ask):
  - **OpenAI or DeepSeek** — easiest: just an API key from their website. Costs a small amount
    per message (typically fractions of a cent), runs in the cloud.
  - **Ollama** — free and fully private, runs on your own hardware. Install
    [Ollama](https://ollama.com) separately first and pull a model
    (`ollama pull mistral`, or similar). Wants a reasonably capable machine/GPU for good response
    times.

---

## 3. Installing & configuring

### The fast way (Node.js + setup wizard)

```bash
git clone https://github.com/Chronophage-net/fates-edge-ai-gm-bot.git
cd fates-edge-ai-gm-bot
npm install
npm run configure    # interactive wizard — pick a driver, paste an API key, set WS_URL/ROOM
npm start             # connects, claims the GM seat, starts narrating
```

The wizard (`configure-bot.js`) scans `/drivers`, lets you pick a backend, asks for its API key (or
a file path containing one), and asks for your socket server's `WS_URL`, `ROOM`, and `API_KEY`. It
writes all of this into a `.env` file for you — nothing to hand-edit unless you want to.

Once running, open `http://localhost:4141` in a browser — a live status dashboard (see
[§7](#7-the-status-dashboard) below) confirming the bot connected, which driver/model it's using,
and real session token counts.

### The Docker way

```bash
git clone https://github.com/Chronophage-net/fates-edge-ai-gm-bot.git
cd fates-edge-ai-gm-bot
npm install && npm run configure   # run the wizard once outside Docker to generate .env
docker compose up -d
```

Docker can't run the interactive wizard itself (it needs a real terminal), so generate `.env` first
either via the wizard above or by hand-writing it (see [§5](#5-configuration-reference) below).
`docker compose up -d` then starts just the bot, dashboard included at the same
`http://localhost:4141`.

Running more than one bot (separate tables/campaigns)? Give each its own folder, `.env`, and a
distinct `STATUS_PORT` so their dashboards don't collide on `4141`.

### Manual configuration (hand-writing `.env`)

`ai-gm-bot.js` selects its driver by **`AI_PROVIDER`** — one of `ollama`, `openai`, or `deepseek`.
The wizard also writes an informational `AI_DRIVER=./drivers/...` line, but only `AI_PROVIDER` is
actually read at startup.

**OpenAI:**
```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
AI_MODEL=gpt-4o-mini
WS_URL=ws://localhost:10000
ROOM=AC12
BOT_NAME=AI_GM
API_KEY=your-socket-servers-api-key
```

**Ollama (local):**
```
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
OLLAMA_CONTEXT_WINDOW=8192   # match your actual model -- see §5
WS_URL=ws://localhost:10000
ROOM=AC12
API_KEY=your-socket-servers-api-key
```

**DeepSeek:**
```
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
DEEPSEEK_MODEL=deepseek-chat
WS_URL=ws://localhost:10000
ROOM=AC12
API_KEY=your-socket-servers-api-key
```

---

## 4. Running on small/underpowered machines (lite stack)

Everything above assumes a machine with some room to spare — a real cloud model, or a local Ollama
model with a GPU or a few spare gigabytes of RAM. If you're putting this on a small VPS, an old
laptop, a Raspberry Pi-class box, or anywhere else that's tight on resources, there's a **lite**
path that trades quality and features for a much smaller footprint.

### What's different

```bash
git clone https://github.com/Chronophage-net/fates-edge-ai-gm-bot.git
cd fates-edge-ai-gm-bot
cp env-lite-example.md .env.lite   # fill in WS_URL / ROOM / API_KEY
docker compose -f docker-compose.lite.yml --env-file .env.lite up -d --build
```

`docker-compose.lite.yml` bundles the bot with its own local Ollama instance running
**`llama3.2:1b`** (~1.3GB) — the smallest model that reliably runs the bot's `[ROLL ...]`/
`[CALL FOR ROLL ...]` tag protocol at all — and **deliberately leaves out Elasticsearch (long-term
memory), TTS (voice narration), and RVC (voice cloning) entirely.** That's not just "off by
default" the way the main `docker-compose.yml`'s profiles are — those services aren't defined in
this file at all, so there's nothing extra a constrained machine could be asked to start.

### The caveats — read before you rely on this

This isn't a strictly worse version of the same experience; it's a real trade-off, and it's worth
knowing what you're trading before your table hits it mid-session:

- **Narrative quality is noticeably weaker.** `llama3.2:1b` writes serviceably but generically
  compared to `mistral`, DeepSeek, or OpenAI — expect flatter prose, less consistent NPC voice, and
  more repeated phrasing over a long campaign. If a session feels bland rather than broken,
  that's the model, not a bug.
- **Tag-following is less reliable.** The bot's own README notes that `llama3.2:1b` is the weakest
  of the commonly-used local models at emitting well-formed `[ROLL ...]`/`[CALL FOR ROLL ...]`
  tags. The bot's fuzzy tag-repair pass (`repairAITagSyntax()`) catches a lot of drift, but not
  all of it — expect an occasional tag to leak into chat as literal bracket text instead of
  resolving into a dice prompt. `llama3.2:3b` (~2.0GB, still modest) is a meaningfully better
  middle ground if your machine can spare the extra RAM.
- **Responses are slow.** This stack has no GPU passthrough assumption — inference runs on CPU
  only. A reply can genuinely take a minute or more on constrained hardware, which is why
  `LITE_OLLAMA_TIMEOUT_MS` defaults to 5 minutes instead of the bot's usual 60 seconds. Set
  expectations at the table: this is a "the GM is thinking" pace, not an instant-reply one.
  Smaller context (`LITE_OLLAMA_CONTEXT_WINDOW=4096` by default, half the main guide's 8192) also
  means less headroom before the driver's `trimToFit()` safety net starts trimming — watch the
  logs for its truncation warnings if narration starts ignoring earlier scene details.
- **No long-term memory.** Without Elasticsearch, Facts and NPCs work exactly as they always do
  (nothing is lost), but the campaign never gets the relevance-ranked recall a long-running game
  benefits from — the model relies entirely on its recent-history window and the always-included
  Facts dump. Fine for a short campaign or one-shot; worth revisiting for a long-running one.
- **No voice narration or voice cloning.** The GM is text-only on this stack. If your table wants
  spoken narration, that's a heavier feature (a real TTS service, ideally with a GPU) that doesn't
  fit "small/underpowered" — see the main `docker-compose.yml`'s `tts`/`rvc` profiles once you have
  the hardware for them.
- **This is still a real, self-hosted deployment** — the same `HEADLESS=true` requirement, the same
  no-login status dashboard caveat (`STATUS_HOST` stays loopback-only unless you widen it), and the
  same "your socket server is separate and must already be running" assumption as the main guide.
  The lite stack only shrinks the AI backend and drops the optional extras — it doesn't change
  anything about how the bot talks to your campaign server.

### When to graduate off it

If a session feels sluggish, the GM's writing feels thin, or tags are leaking into chat more than
occasionally, that's the signal to move up — either bump `LITE_OLLAMA_MODEL` to `llama3.2:3b` (or
further, to `mistral`, if your machine can now spare ~4GB), or switch to the main
`docker-compose.yml`/`.env` with a cloud provider (OpenAI/DeepSeek) instead, which needs no local
compute at all beyond running the bot's own lightweight Node process. Nothing about your socket
server or campaign data needs to change either way — only which driver/model the bot itself uses.

---

## 5. Configuration reference

The full list — everything below is optional beyond the driver/connection basics above (unset
defaults are shown; see the bot's own `README.md` "Environment Variables Reference" for the
authoritative, most current copy of this table):

| Variable | Applies to | Default | Purpose |
|---|---|---|---|
| `AI_PROVIDER` | core | `ollama` | `ollama` \| `openai` \| `deepseek` — which backend to load. |
| `WS_URL` | core | — | Your socket server's WebSocket address. |
| `ROOM` | core | — | Room code to join — must match what your players use. |
| `BOT_NAME` | core | `AI_GM` | Display name in chat. |
| `API_KEY` | core | — | The **socket server's** admin API key (not an AI provider key) — needed for the bot to save/load campaign progress via REST. |
| `HEADLESS` / `OLLAMA_NONINTERACTIVE` | Ollama | off | Skip interactive model-recovery prompts and fail fast instead. **Required for any unattended deployment** (Docker, systemd, pm2) — without it, a missing/broken Ollama model hangs the process forever waiting on a terminal that isn't there. |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | Ollama | `http://localhost:11434` / — | Where Ollama is running and which model to use. |
| `OLLAMA_CONTEXT_WINDOW` | Ollama | `8192` | Sent to Ollama as `num_ctx` on every request — **set this to your actual model's real context window** (`ollama show <model>`), or narration silently loses grounding in character stats/rules once the real prompt exceeds this bot's default guess. |
| `OLLAMA_TIMEOUT_MS` / `OLLAMA_MAX_RETRIES` | Ollama | `60000` / `1` | Per-request timeout and retry count. |
| `OPENAI_API_KEY` / `AI_MODEL` | OpenAI | — / `gpt-4o-mini` | API key and model. |
| `OPENAI_CONTEXT_WINDOW` / `OPENAI_TIMEOUT_MS` / `OPENAI_MAX_RETRIES` | OpenAI | `128000` / `30000` / `2` | Context window and SDK-level retry/timeout. |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | DeepSeek | — / `deepseek-chat` | API key and model. |
| `DEEPSEEK_CONTEXT_WINDOW` / `DEEPSEEK_TIMEOUT_MS` / `DEEPSEEK_MAX_RETRIES` | DeepSeek | `64000` / `30000` / `2` | Context window and retry/timeout. |
| `LOG_LEVEL` | all | `info` | `error`\|`warn`\|`info`\|`debug` — `debug` also shows raw background chatter (sync ticks, wire traffic), hidden by default. |
| `STATUS_SERVER` / `STATUS_PORT` / `STATUS_HOST` | dashboard | `true` / `4141` / `127.0.0.1` | Turn the dashboard off, change its port, or (carefully — **it has no login**) expose it beyond localhost. |
| `ES_URL` and friends | Long-Term Memory | unset | See [§8.1](#81-long-term-memory-optional-elasticsearch). |
| `TTS_ENABLED` / `TTS_URL` and friends | Voice Narration | unset | See [§8.2](#82-voice-narration--voice-cloning-optional). |
| `RVC_ENABLED` / `RVC_URL` and friends | Voice Cloning | unset | See [§8.2](#82-voice-narration--voice-cloning-optional). |
| `SOUNDSCAPE_PROFILE` / `SOUNDSCAPE_PROFILE_PATH` | Reactive Soundscape | unset | See [§8.3](#83-reactive-soundscape-optional). |
| `LITE_OLLAMA_MODEL` / `LITE_OLLAMA_CONTEXT_WINDOW` / `LITE_OLLAMA_TIMEOUT_MS` | Lite stack only | `llama3.2:1b` / `4096` / `300000` | Only read by `docker-compose.lite.yml` — see [§4](#4-running-on-smallunderpowered-machines-lite-stack). |

---

## 6. Running it, and talking to it

```bash
npm start
```

The bot connects, claims the Game Master role (auto-approving its own pending vote if another GM
is present), and starts listening to chat. Players see: *"The AI Game Master has joined."*

**In the bot's own terminal**, you can type:

- **Any text** — sent as a GM chat message (manual override — useful for correcting the AI or
  narrating something yourself mid-session).
- **`/admin players`** — list players in the room (requires `API_KEY`).
- **`/admin kick <clientId> [reason]`** / **`/admin ban <clientId> [reason]`** / **`/admin unban <clientId>`**

**In the room's own chat**, `!gm ...` commands cover everything from adventures to timers to
knowledge/secrets — the full command reference lives in `adventure_manual.md` in the bot's repo,
built around a worked tutorial adventure ("The Lantern at Dusk"). A few of the most commonly used:

| Command | What it does |
|---|---|
| `!gm adventure load <id>` / `!gm adventure start` | Load and begin a structured adventure module. |
| `!gm scene next` | Manually advance to the next scene. |
| `!gm roll ...` | Resolve a roll the bot called for with `[CALL FOR ROLL ...]`. |
| `!gm fact <key> <value>` | Record a campaign Fact (also settable by the AI itself via `[FACT ...]`). |
| `!gm knowledge list` / `reveal <id>` / `hide <id>` | Manage structured secrets. |
| `!gm adventure legacy [schema] [set <key> <value>\|clear]` | The Legacy Tracker — carryover state between adventures (see the bot's `DESIGN.md` §4). |
| `!gm session end` | Mark a real-world session as finished — the metric dynamic-growth adventures use to pace toward a climax. |

**Running headless** (systemd, Docker, `nohup`, pm2 — anywhere without an attached terminal): set
`HEADLESS=true`. This matters most for Ollama, whose model-recovery flow otherwise hangs forever on
an interactive prompt that will never be answered.

---

## 7. The Status Dashboard

`http://localhost:4141` by default (`STATUS_PORT`) — a live, no-refresh-needed view of:

- Connection state, GM/player role, and which driver/model is active.
- The currently loaded adventure — title, status, act, and scene.
- Session token usage — real counts from the provider's own API where it reports them
  (OpenAI/DeepSeek/Ollama's non-streaming path), estimated otherwise.
- Party status — synced characters with a one-line Harm/Fatigue readout.
- The **AI GM Session Panel** — Story Beats bank, every recorded campaign Fact, the model's actual
  live conversation window, and Obligation totals grouped by Patron.
- **Assistant GM — Pending Suggestions** (only while the bot holds that role) — one-click
  Approve/Reject on every narrative-authority tag currently held for human review.

No extra dependency — a plain `http` server pushing updates over Server-Sent Events. Disable it
entirely with `STATUS_SERVER=false` on a locked-down box.

---

## 8. Optional features

Everything in this section is **off by default and fails soft** — leaving it unconfigured changes
nothing about how the bot otherwise behaves.

### 8.1. Long-Term Memory (optional, Elasticsearch)

Facts and NPCs accumulate over a long campaign with no pruning otherwise. Set `ES_URL` (e.g.
`http://localhost:9200`) and the bot indexes Facts, NPCs, and periodic campaign summaries as they
happen, then folds a relevance-ranked "Relevant Memory" block into the prompt each turn — on top
of, not instead of, everything the bot already tracks. `!gm recall <query>` runs the same search
manually, no LLM involved. See the bot's README "Long-Term Memory" section for the full setup
(including running it via `docker compose --profile elastic up -d` alongside the bot itself).

### 8.2. Voice Narration & Voice Cloning (optional)

Point `TTS_ENABLED=true` and `TTS_URL` at any Chatterbox/Coqui-XTTS-shaped HTTP TTS service, and the
bot's GM/assistant-GM replies get synthesized to speech and broadcast to every connected client
right alongside the text — never instead of it. Layer `RVC_ENABLED=true` and `RVC_URL` on top to
re-voice that output through a trained [RVC](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI)
model, so the GM consistently sounds like one specific voice. See the bot's README "Voice
Narration"/"Voice Cloning" sections for the exact HTTP contracts, and
`docs/local-voice-cloning/VOICE-CLONING-LOCAL-SETUP.md` in the bot's own repo for a from-scratch
local walkthrough.

### 8.3. Reactive Soundscape (optional)

Maps mood names (`"tense"`, `"combat"`, `"calm"`, ...) to ambience track ids from your web client's
own soundboard, so the bot can crossfade the room's background music automatically on scene changes
or explicitly via `[MOOD "..."]` in its own narration:

```bash
cp data/soundscape-profile.example.json data/soundscape-profile.json
# edit it, replacing each sound_REPLACE_WITH_YOUR_TRACK_ID with a real track id
```

No profile configured (and no `SOUNDSCAPE_PROFILE` env var) means the feature is entirely off.

---

## 9. Assistant GM Mode

A middle tier between full GM (every AI-emitted tag applies immediately) and an ordinary player. A
GM hands the bot this role like any other promotion (`role_change_request` with
`role: 'assistant-gm'`). In this mode, the bot keeps rolling dice, applying Harm/Fatigue/Boon
deltas, and ticking timers live — but holds anything that changes shared campaign truth
(`[FACT ...]`, `[NPC CREATE ...]`, `[SCENE COMPLETE ...]`) as a **pending suggestion** for a human
GM to approve or reject, visible on the dashboard or via `!gm suggestions` / `!gm approve <id>` /
`!gm reject <id>` in chat. It also does **not** auto-promote itself to full GM if the human
disappears — it posts a prompt instead, and anyone can `!gm confirm-takeover` if that's actually
wanted. See the bot's own README "Assistant GM Mode" section for the full behavior.

---

## 10. Keeping it running & updating

**Docker:** `docker-compose.yml` sets `restart: unless-stopped` — it survives crashes and comes
back after a reboot, as long as Docker itself starts on boot.

**Manual/Node**, via [pm2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start ai-gm-bot.js --name fates-edge-gm-bot
pm2 save
pm2 startup     # prints one command to run so it survives a reboot too
```

Set `HEADLESS=true` in `.env` first — running under pm2 is exactly the unattended situation that
flag exists for.

**Updating:**

```bash
git pull
npm install       # or: docker compose up -d --build
# restart however you started it
```

Your `.env` isn't touched by an update. The bot itself holds no campaign data (the socket server
does — see that server's own backup guidance); the only bot-local state worth knowing about is the
optional Elasticsearch long-term-memory index, if you turned that on.

---

## 11. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Bot connects but nobody sees it in chat | `ROOM` in `.env` doesn't match your players' room code exactly. |
| "AI error" instead of real responses | Bad/missing API key for the chosen provider, or Ollama not actually reachable at `OLLAMA_BASE_URL`. |
| `Failed to auto-save campaign: HTTP 401` | `API_KEY` in `.env` doesn't match the **socket server's** own `API_KEY` — these must be identical. |
| Bot hangs forever at startup, no crash | Running Ollama headless without `HEADLESS=true` — it's stuck at an interactive prompt with no stdin. |
| Narration ignores character stats/rules | Context window smaller than what's actually being sent. Set `OLLAMA_CONTEXT_WINDOW` to your model's *real* window and watch the logs for `trimToFit` truncation warnings. |
| `[LOOKUP RULE "..."]` shows up literally in chat | The tag's quoted title didn't match any `data/rules.txt` section closely enough — check the logs for the exact query sent. |
| Can't reach `http://localhost:4141` | `STATUS_SERVER=false` is set, or you're browsing from a different machine than the bot runs on — use that machine's IP and check the firewall on `STATUS_PORT`. |
| Two bots' dashboards collide | Give each bot its own `STATUS_PORT` in its own `.env`. |

---

## 12. Where to go next

This guide is the on-ramp. For the full picture, the bot's own repository has:

- **`README.md`** — the complete feature list, module-by-module architecture, and the full
  environment variable reference.
- **`INSTALL.md`** — the same setup steps as here, written more slowly for someone new to running
  a dedicated game server.
- **`DESIGN.md`** — how the Adventure Director's dynamic-growth engine, climax pacing, the Legacy
  Tracker, and the voice/audio pipeline actually work internally.
- **`adventure_manual.md`** — the full `!gm adventure` / `!gm scene` / `!gm knowledge` command
  reference, with a worked example adventure end to end.

*This guide is a snapshot as of the bot's v4.13.3 release; if anything here drifts from what the
bot's own README/CHANGELOG say, trust the bot's own repo — it's the source of truth.*
