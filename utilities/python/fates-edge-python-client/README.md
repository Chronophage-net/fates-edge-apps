## 📖 `README.md`

```markdown
# Fate's Edge – Python Client

A command‑line client for the **Fate's Edge** TTRPG toolkit.  
It replicates the core features of the web mainpage (character management, timers, dice rolling) and supports syncing with the campaign sharing server.

---

## 📦 Installation

### 1. Clone or copy the client script

Place `fates_edge_python_client.py` in a directory of your choice.  
Create a virtual environment (recommended):

```bash
python -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the client

```bash
python fates_edge_python_client.py --help
```

---

## 🔧 Usage

The client is split into subcommands:

| Command       | Description |
|---------------|-------------|
| `characters`  | List, add, or delete characters |
| `timers`      | List, add, tick, reset, or delete timers |
| `roll`        | Perform a Fate's Edge dice roll |
| `server`      | Upload / load / delete campaigns from the sharing server |
| `shell`       | Start an interactive REPL (for convenience) |

### 📌 Characters

```bash
# List all characters
python fates_edge_python_client.py characters --list

# Add a character (minimal example)
python fates_edge_python_client.py characters --add --name "Aria" --body 3 --wits 2 --skill melee=2 --skill stealth=1

# Add with custom fields
python fates_edge_python_client.py characters --add --name "Thorn" --heritage "Vhasian" --background "Soldier" --patron "The Traveler" --tier II --xp 34 --body 4 --wits 2 --spirit 1 --presence 3 --skill melee=3 --skill endurance=2

# Delete a character by ID
python fates_edge_python_client.py characters --delete 1
```

### ⏱️ Timers

```bash
# List timers
python fates_edge_python_client.py timers --list

# Add a timer
python fates_edge_python_client.py timers --add --name "Scene Clock" --segments 6

# Tick a timer (advance by 1)
python fates_edge_python_client.py timers --tick 1

# Reset a timer to 0
python fates_edge_python_client.py timers --reset 1

# Delete a timer
python fates_edge_python_client.py timers --delete 1
```

### 🎲 Roll dice

```bash
# Basic roll (default position: controlled)
python fates_edge_python_client.py roll --attr 3 --skill 2 --dv 3

# With position and boons
python fates_edge_python_client.py roll --attr 4 --skill 2 --dv 4 --pos dominant --boons 2
```

### 🌐 Server (Campaign Sharing)

`--code` is always your **room code**. Uploading returns a separate **campaign share code**, which you pass back in as `--campaign-code` when loading.

```bash
# Upload your local data to the server (prints a share code)
python fates_edge_python_client.py server --upload --code ABC123 --server http://localhost:10000

# Load a campaign from the server using the share code an earlier --upload printed
# (replaces local data!)
python fates_edge_python_client.py server --load --code ABC123 --campaign-code xy12ab --server http://localhost:10000

# Sync against the room's auto-save slot instead (one snapshot per room, no separate code)
python fates_edge_python_client.py server --sync --code ABC123 --server http://localhost:10000
```

> **Note:** Loading will overwrite your local data. You'll be prompted to confirm.
>
> There is currently no server-side way to delete a manually uploaded campaign snapshot — the server automatically prunes old ones (oldest first) once more than 2 exist for a room, so `--delete` will report that it isn't supported.
>
> `--chat`, `--roll`, and `--upload`/`--load` chat/dice-adjacent flows have no REST equivalent on the server at all — chat and dice rolls are WebSocket-only. Use `python fates_edge_python_client.py websocket --code ABC123` (or `shell`) for those instead.

### 🖥️ Interactive Shell

```bash
python fates_edge_python_client.py shell
```

Inside the shell you can type any command (without `python fates_edge_python_client.py`).  
For example:

```
> characters --list
> roll --attr 3 --skill 2 --dv 3
> exit
```

---

## 💾 Data Storage

All data is stored in `~/.fates_edge/data.json` on Unix‑like systems.  
You can edit this file manually, but it’s safer to use the client commands.

---

## 🧩 Server Compatibility

The client uses the same JSON format as the web toolkit.  
To run your own server, see the [campaign server documentation](../campaign-server/README.md) (Docker image included).

---

## 📚 Requirements

- Python 3.6+
- `requests` library (for server operations)

Install with `pip install -r requirements.txt`.

---

## 🤝 Contributing

This client is part of the **Fate's Edge** project.  
Please open an issue or pull request for improvements.

---

## 📜 License

Same as the main repository – dual license (SRD under CC BY‑NC‑SA, all other content All Rights Reserved).  
See the root `LICENSE.md` for details.
```

---

## 📁 Where to place these files

- `fates_edge_python_client.py` – the Python script itself (already provided in the previous response).
- `requirements.txt` – in the same directory as `fates_edge_python_client.py`.
- `README.md` – in the same directory.

You can now run the client inside a virtual environment with a single command:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python fates_edge_python_client.py --help
