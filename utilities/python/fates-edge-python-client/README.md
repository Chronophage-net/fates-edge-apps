# Fate's Edge – Python Client

A command-line client for the **Fate's Edge** TTRPG toolkit: character
management, timers, dice rolling, the Deck of Consequences (region-aware
card meanings, Crown Spread), and syncing with a Fate's Edge socket
server over REST and WebSocket.

As of v5.0.0 this is a proper installable package (`fates_edge_client/`),
not a single script you copy around. See `PYTHON_CLIENT_REDESIGN_PLAN.md`
in the repo root for the full rationale if you're curious what changed
and why.

---

## 📦 Installation

From this directory:

```bash
python -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate
pip install .
```

For development (editable install, so code changes take effect
immediately):

```bash
pip install -e ".[dev]"
```

This installs a `fates-edge` command on your `PATH`, backed by the
`fates_edge_client` package. `pyproject.toml` is the single source of
packaging truth -- if you see a `setup.py` in this directory, it's an
inert leftover (the sandbox this redesign was built in couldn't delete
it); it will refuse to run and tells you to delete it.

If you'd rather not install the package at all, `pip install -r
requirements.txt` followed by `python -m fates_edge_client --help` from
this directory works too.

---

## 🔧 Usage

Once installed, run `fates-edge --help` (or `python -m fates_edge_client
--help` without installing). The client is split into subcommands:

| Command      | Description |
|--------------|-------------|
| `characters` | List, add, delete, export, or import characters |
| `timers`     | List, add, tick, reset, or delete timers |
| `roll`       | Perform a Fate's Edge dice roll |
| `deck`       | Build/shuffle/draw from the Deck of Consequences, or pull a Crown Spread -- fully offline, using the same region flavor-text data the server ships |
| `modules`    | Module listing/push/cleanup (currently a local-only stub; see note below) |
| `server`     | Upload / load / sync campaigns with a socket server over REST |
| `websocket`  | Connect to a room over WebSocket for live chat, dice, and deck events |
| `config`     | Set/show the stored API key and other local settings |
| `shell`      | Start an interactive REPL -- accepts exactly the same subcommands and flags as the command line |

### 📌 Characters

```bash
fates-edge characters --list
fates-edge characters --add --name "Aria" --body 3 --wits 2 --skill melee=2 --skill stealth=1
fates-edge characters --add --name "Thorn" --heritage "Vhasian" --background "Soldier" --patron "The Traveler" --tier II --xp 34 --body 4 --wits 2 --spirit 1 --presence 3 --skill melee=3 --skill endurance=2
fates-edge characters --delete 1
fates-edge characters --export 1 --export-path aria.yaml
fates-edge characters --import-char aria.yaml
```

### ⏱️ Timers

```bash
fates-edge timers --list
fates-edge timers --add --name "Scene Clock" --segments 6
fates-edge timers --tick 1
fates-edge timers --reset 1
fates-edge timers --delete 1
```

### 🎲 Roll dice

```bash
# Basic roll (default position: controlled)
fates-edge roll --attr 3 --skill 2 --dv 3

# With position and boons
fates-edge roll --attr 4 --skill 2 --dv 4 --pos dominant --boons 2
```

### 🃏 Deck of Consequences

```bash
fates-edge deck --build
fates-edge deck --draw 2 --region Silkstrand
fates-edge deck --crown --region Acasia
fates-edge deck --history
fates-edge deck --shuffle
```

Region flavor text is loaded from the same region JSON the socket server
ships (bundled into the package), so `--draw`/`--crown` actually reflect
the `--region` you pass -- earlier versions of this client silently fell
back to a generic placeholder line regardless of region.

### 🌐 Server (REST)

`--code` is always your **room code**. Uploading returns a separate
**campaign share code**, which you pass back in as `--campaign-code`
when loading.

```bash
fates-edge server --upload --code ABC123 --server http://localhost:10000
fates-edge server --load --code ABC123 --campaign-code xy12ab --server http://localhost:10000
fates-edge server --sync --code ABC123 --server http://localhost:10000
fates-edge server --deck-draw --code ABC123 --count 2 --region Acasia --server http://localhost:10000
```

> Loading will overwrite your local data; you'll be prompted to confirm.
>
> There is currently no server-side way to delete a manually uploaded
> campaign snapshot -- the server auto-prunes old ones (oldest first)
> once more than 2 exist for a room, so `--delete` reports that it isn't
> supported.
>
> `--chat` and `--roll` have no REST equivalent on the server -- chat and
> dice rolls are WebSocket-only. Use `fates-edge websocket --code
> ABC123` (or the `shell`) for those instead.

### 🔌 WebSocket

```bash
fates-edge websocket --code ABC123 --server http://localhost:10000
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

### 🖥️ Interactive Shell

```bash
fates-edge shell
```

The shell accepts exactly the commands above, without the leading
`fates-edge`:

```
fates-edge> characters --list
fates-edge> roll --attr 3 --skill 2 --dv 3
fates-edge> deck --draw 1 --region Ubral
fates-edge> exit
```

---

## 💾 Data Storage

All data is stored in `~/.fates_edge/data.json` on Unix-like systems.
Saves are atomic (written to a temp file, then swapped into place), so a
crash mid-write can't corrupt your data. If a data file ever fails to
parse, it's preserved as a `.corrupt` sibling instead of being silently
discarded.

---

## 🧩 Server Compatibility

The client talks to the same Fate's Edge socket server as the web
toolkit and other VTT integrations. See `API.md` in the repo root for
the authoritative route/event list. To run your own server, see
`utilities/javascript/fates-edge-socket-server/README.md`.

---

## 📚 Requirements

- Python 3.9+
- `requests`, `python-socketio[asyncio-client]`, `pyyaml` (installed
  automatically by `pip install .`)

---

## 🤝 Contributing

This client is part of the **Fate's Edge** project. Please open an issue
or pull request for improvements.

---

## 📜 License

Same as the main repository -- dual license (SRD under CC BY-NC-SA, all
other content All Rights Reserved). See the root `LICENSE.md` for
details.
