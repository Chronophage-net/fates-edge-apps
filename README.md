<<<<<<< HEAD
# fates-edge-apps
Fate'S Edge Applications, Server, Bots, Modules, and Clients - Javascript, Python, Discord, Roll20, Foundry
=======
# Fate's Edge Apps

This repository contains all applications and utilities for Fate's Edge RPG.

## Structure

```
ttrpg/utilities/
├── javascript/
│   ├── fates-edge-web-client/      # Main web application
│   ├── fates-edge-desktop-client/  # Electron desktop client
│   ├── fates-edge-socket-server/   # WebSocket server
│   └── build_script.py             # Build utilities
├── fates-edge-discord-bot/         # Discord bot
├── fates-edge-roll20/              # Roll20 integration
├── foundry_fates-edge-bridge/      # Foundry VTT bridge
└── python/
    ├── fates_edge_tool/            # Python CLI tool
    └── fates-edge-python-client/   # Python client library
```

## Building the Web Client

```bash
cd ttrpg/utilities/javascript/fates-edge-web-client
npm install
npm run build
```

## Running the Desktop Client

```bash
cd ttrpg/utilities/javascript/fates-edge-desktop-client
npm install
npm start
```

## License

This repository is licensed under MIT License for code.
>>>>>>> 743c67a (Initial commit)
