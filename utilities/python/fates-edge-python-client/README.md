# Fate's Edge — Python Client

> **⚠️ Mothballed.** This client is no longer under active development. The
> `fates-edge-cli.py` bundled directly with the
> [socket server](../../javascript/fates-edge-socket-server/) is now the
> maintained scriptable/CLI entry point for the server's REST API (rooms,
> deck, clients, modules, ad-hoc timers, and more) and is where new
> server-API surface gets propagated first. This package still works
> against the current server for what it already implements, but it won't
> track future API changes (e.g. it predates the ad-hoc timer system in
> `server/timers.js`) and isn't the recommended starting point for new
> scripting. Kept in the repo for existing users; not recommended for new
> setups.


A command-line client for the **Fate's Edge** TTRPG toolkit: character management, timers, dice rolling, the Deck of Consequences (region-aware card meanings, Crown Spread), and syncing with a Fate's Edge [socket server](../../javascript/fates-edge-socket-server/) over REST and WebSocket. Installs as a proper package (`fates_edge_client/`) rather than a script you copy around.

---

## Installation

From this directory:

```bash
python -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate
pip install .
```

For development (editable install, so code changes take effect immediately):

```bash
pip install -e ".[dev]"
```

This installs a `fates-edge` command on your `PATH`, backed by the `fates_edge_client` package. `pyproject.toml` is the single source of packaging truth.

If you'd rather not install the package at all, `pip install -r requirements.txt` followed by `python -m fates_edge_client --help` from this directory works too.

---

## Usage

Once installed, run `fates-edge --help` (or `python -m fates_edge_client --help` without installing). The client is split into subcommands:

| Command | Description |
|---|---|
| `characters` | List, add, delete, export, or import characters |
| `timers` | List, add, tick, reset, or delete timers |
| `roll` | Perform a Fate's Edge dice roll |
| `deck` | Build/shuffle/draw from the Deck of Consequences, or pull a Crown Spread — fully offline, using the same region flavor-text data the server ships |
| `modules` | Module listing/push/cleanup (currently a local-only stub — see note below) |
| `server` | Upload / load / sync campaigns with a socket server over REST |
| `websocket` | Connect to a room over WebSocket for live chat, dice, and deck events |
| `config` | Set/show the stored API key and other local settings |
| `shell` | Start an interactive REPL — accepts exactly the same subcommands and flags as the command line |

### Characters

```bash
fates-edge characters --list
fates-edge characters --add --name "Aria" --body 3 --wits 2 --skill melee=2 --skill stealth=1
fates-edge characters --add --name "Thorn" --heritage "Vhasian" --background "Soldier" --patron "The Traveler" --tier II --xp 34 --body 4 --wits 2 --spirit 1 --presence 3 --skill melee=3 --skill endurance=2
fates-edge characters --delete 1
fates-edge characters --export 1 --export-path aria.yaml
fates-edge characters --import-char aria.yaml
```

### Timers

```bash
fates-edge timers --list
fates-edge timers --add --name "Scene Clock" --segments 6
fates-edge timers --tick 1
fates-edge timers --reset 1
fates-edge timers --delete 1
```

### Roll dice

```bash
fates-edge roll --attr 3 --skill 2 --dv 3                       # default position: controlled
fates-edge roll --attr 4 --skill 2 --dv 4 --pos dominant --boons 2
```

### Deck of Consequences

```bash
fates-edge deck --build
fates-edge deck --draw 2 --region Silkstrand
fates-edge deck --crown --region Acasia
fates-edge deck --history
fates-edge deck --shuffle
```

Region flavor text is loaded from the same region JSON the socket server ships, so `--draw`/`--crown` reflect the `--region` you pass. That data is Fate's Edge Copyright content, licensed separately from this MIT client's own code (see [`LICENSE.proprietary`](../../../LICENSE.proprietary)), and isn't bundled into the installed package — fetch it once, opt-in, before relying on region-specific meanings:

```bash
fates-edge data --fetch
```

Without it, `--draw`/`--crown` still work, just with a generic placeholder line instead of region-specific flavor text.

### Server (REST)

`--code` is always your **room code**. Uploading returns a separate **campaign share code**, which you pass back in as `--campaign-code` when loading.

```bash
fates-edge server --upload --code AC12 --server http://localhost:10000
fates-edge server --load --code AC12 --campaign-code xy12ab --server http://localhost:10000
fates-edge server --sync --code AC12 --server http://localhost:10000
fates-edge server --deck-draw --code AC12 --count 2 --region Acasia --server http://localhost:10000
fates-edge server --deck-seed-get --code AC12 --server http://localhost:10000
fates-edge server --deck-seed-set --code AC12 --seed my-seed-123 --server http://localhost:10000
```

Every room shuffles its deck with its own independent, seedable PRNG rather than a shared unseeded `Math.random()` — `--deck-seed-get` reads a room's current (auto-generated if never set) seed, and `--deck-seed-set` explicitly reseeds it and immediately rebuilds and reshuffles, so the room's next draw is reproducible.

> Loading will overwrite your local data; you'll be prompted to confirm.
>
> There is currently no server-side way to delete a manually uploaded campaign snapshot — the server auto-prunes old ones (oldest first) once more than 2 exist for a room, so `--delete` reports that it isn't supported.
>
> `--chat` and `--roll` have no REST equivalent on the server — chat and dice rolls are WebSocket-only. Use `fates-edge websocket --code AC12` (or the `shell`) for those instead.

### WebSocket

```bash
fates-edge websocket --code AC12 --server http://localhost:10000
```

Once connected:

```
> /chat Hello, table!
> /roll 2d6+3
> /draw 3
> /crown
> /shuffle
> /quit
```

### Interactive shell

```bash
fates-edge shell
```

The shell accepts exactly the commands above, without the leading `fates-edge`:

```
fates-edge> characters --list
fates-edge> roll --attr 3 --skill 2 --dv 3
fates-edge> deck --draw 1 --region Ubral
fates-edge> exit
```

---

## Data storage

All data is stored in `~/.fates_edge/data.json` on Unix-like systems. Saves are atomic (written to a temp file, then swapped into place), so a crash mid-write can't corrupt your data. If a data file ever fails to parse, it's preserved as a `.corrupt` sibling instead of being silently discarded.

---

## Server compatibility

The client talks to the same Fate's Edge socket server as the web toolkit and other VTT integrations. See [`API.md`](../../../API.md) in the repository root for the authoritative route/event list. To run your own server, see [the socket server's own README](../../javascript/fates-edge-socket-server/README.md).

---

## Requirements

- Python 3.9+
- `requests`, `python-socketio[asyncio-client]`, `pyyaml` (installed automatically by `pip install .`)

---

## Contributing

This client is part of the **Fate's Edge** project. Please open an issue or pull request for improvements.

---

## License

This package's own source code is MIT (see the `license` field in `pyproject.toml`). The optional Fate's Edge region lore it can fetch via `fates-edge data --fetch` is not: SRD material is CC BY-NC-SA, everything else is All Rights Reserved. See the root [`LICENSE.md`](../../../LICENSE.md) for details.
