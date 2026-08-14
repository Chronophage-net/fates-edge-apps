# Fate's Edge Unified Tool

A single-file Tkinter desktop app (`Fates_Edge.py`) covering character
creation/sheet management, dice rolling, armor conversion, a lightweight
GM screen (clocks, factions, patrons, party Trust, rivals), a simple
Deck of Consequences draw, and roll history -- all backed by local JSON
files so it works fully offline.

As of the latest update it can also optionally connect to a Fate's
Edge socket server to sync with a live campaign room.

## Requirements

- Python 3.9+ with `tkinter` (included with most Python installs; on
  Debian/Ubuntu you may need `sudo apt install python3-tk` separately).
- Optional, for the Server tab:
  - `requests` -- campaign snapshot upload/download over REST.
  - `python-socketio` -- live room connection (character push, chat/roll
    broadcast). Install with `pip install "python-socketio[client]"`.

Both networking dependencies are soft: the tool runs fully offline if
neither is installed, and the Server tab just disables the buttons that
need them with an explanation instead of crashing.

## Running

```bash
pip install requests "python-socketio[client]"   # optional, for server sync
python Fates_Edge.py
```

## Data files

All local data lives alongside the script as plain JSON, created
automatically on first run:

| File | Contents |
|---|---|
| `fate_edge_player.json` | Your character (identity, attributes, skills, talents, assets, followers, debt timers, resources) |
| `fate_edge_gm.json` | GM screen state (campaign info, clocks, factions, patrons, party Trust, rivals) |
| `talents.json` | Your talent library, used by the character sheet's talent picker |
| `preferences.json` | UI/server preferences (server URL, room code, API key, roll-broadcast setting) |

The skill list, attribute defaults, XP cost formulas, and armor
conversion table match the canonical rules used by the socket server
(`server/room.js`) and the web client's character editor exactly --
verified directly against both when the Server tab was added.

## Server tab

Connect this tool to a running Fate's Edge socket server
(`utilities/javascript/fates-edge-socket-server`) to:

- **Push My Character to Room** -- publishes your local character
  (name, attributes, skills, and resources) into the room's live
  character list, visible to anyone else connected to that room.
- **Broadcast my dice rolls to the room** (checkbox) -- when connected,
  rolls made in the Dice Roller tab are also announced to the room.
- **Upload/Download Snapshot** -- backs up or restores your entire
  local player + GM data as one blob against the room's auto-save slot,
  the same endpoint the `fates-edge-python-client` CLI's `server --sync`
  command uses. Downloading asks for confirmation before overwriting
  local data.
- A **Live Activity** log shows chat, roll, and deck events from other
  clients in the room while connected.

The API key is stored in `preferences.json` in plaintext, same as this
project's other clients (e.g. the CLI's `~/.fates_edge/data.json`) --
set the `FATES_EDGE_API_KEY` environment variable instead if you'd
rather not have it on disk; that takes precedence over the saved value.

This tool's local character/GM data model and the server's live room
schema use different field casing (`melee`/`body` locally vs.
`Melee`/`Body` on the server) -- pushing a character maps between them
automatically. Deck draws in the GM tab use a simplified local-only
mechanic and are not synced to the server's real Deck of Consequences
(use the `deck` command in the CLI client, or the web client, for a
server-synced draw with real region flavor text).

## Relationship to the other Python client

`utilities/python/fates-edge-python-client/` is a separate, newer
CLI/REPL tool built around the same socket server API. The two don't
share a data format or process -- this tool is a standalone GUI for a
single character/GM screen, the CLI client is scriptable and supports
the full REST/WebSocket surface. Use whichever fits the moment; nothing
stops you from using both against the same room.

## License

Same as the main repository -- this tool's own source code (`Fates_Edge.py`)
is MIT. The bundled Fate's Edge game data/content it reads is not: SRD
material is CC BY-NC-SA, everything else is All Rights Reserved. See the
root `LICENSE.md` for details.
