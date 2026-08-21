# Fate's Edge Desktop Client

An Electron wrapper around the [web client](../fates-edge-web-client/) — the same application, packaged as a native desktop app instead of a browser tab.

## Features

- The full web client, unmodified — characters, dice, the VTT, Spellcraft, Kon'reh, Toll & Veil, Session Recap (recording + event transcript bundle into one `.zip`, with an opt-in live-transcription checkbox), all of it.
- Native OS integration, an auto-updater, and app-level keyboard shortcuts (below) on top of whatever the web client itself already provides.
- Minimal resource usage — this is a thin shell, not a second copy of the application logic.

## Installation

### Download

Grab the latest release from the GitHub Releases page.

### From source

```bash
git clone https://github.com/Chronophage-net/fates-edge-apps.git
cd fates-edge-apps/utilities/javascript/fates-edge-desktop-client

# Build the web client this app bundles as its UI (one directory up)
cd ../fates-edge-web-client && npm install && npm run build && cd -

# Install desktop-client dependencies
npm install

# Build for your platform
npm run build
```

### Development

```bash
npm run dev      # rebuilds/copies the web client's dist/ into renderer/ automatically, then launches
npm start         # production mode
```

Both commands copy `../fates-edge-web-client/dist` into this package's `renderer/` folder before launching (`scripts/copy-renderer.js`). If that `dist/` folder doesn't exist yet, build the web client first: `cd ../fates-edge-web-client && npm run build`.

## Usage

1. Launch the application.
2. Enter your Fate's Edge server URL (or skip this to use the client entirely offline, same as the browser version).
3. Play.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + ,` | Open settings |
| `Cmd/Ctrl + R` | Reload page |
| `Cmd/Ctrl + Q` | Quit |
| `Cmd/Ctrl + Shift + I` | Developer tools |
| `Cmd/Ctrl + 0` / `+` / `-` | Reset / zoom in / zoom out |
| `F11` | Toggle full screen |

These are in addition to the web client's own in-app shortcuts — see its [`ACCESSIBILITY.md`](../fates-edge-web-client/ACCESSIBILITY.md) for those.

## Configuration & data

Settings are stored via `electron-store` (`settings.json`, plus a separate `localdata.json` for saved VTT state) under Electron's standard per-OS userData directory for this app (productName `FatesEdge`):

- **Windows:** `%APPDATA%/FatesEdge/settings.json`
- **macOS:** `~/Library/Application Support/FatesEdge/settings.json`
- **Linux:** `~/.config/FatesEdge/settings.json`

Backups (`create-backup`) and named sessions (`save-session`) are written as JSON files under `backups/` and `sessions/` in that same directory.

## Building

```bash
npm run build              # current platform
npm run build:mac          # macOS
npm run build:win          # Windows
npm run build:linux        # Linux
npm run build:all          # all platforms

# or the interactive build script
node scripts/build.js
node scripts/build.js --platform=mac
node scripts/build.js --all
node scripts/build.js --clean
```

### Platform requirements

- **macOS** — Xcode Command Line Tools; an Apple Developer certificate for codesigning.
- **Windows** — Windows 10/11; Visual Studio Build Tools (for native modules).
- **Linux** — `libc6 libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 libxcb1 libx11-xcb1 libxcb-dri3-0 libdrm2 libgbm1`.

### Icon generation

```bash
brew install imagemagick   # or apt-get / choco
cd build
./generate-icons.sh source.png
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "Electron failed to install correctly" | `rm -rf node_modules && npm install` |
| Cannot connect to server | Confirm the server is running, check the URL in Settings (`Cmd/Ctrl + ,`), check your firewall |
| Build fails on macOS | `xcode-select --install`; for dev builds, `export CSC_IDENTITY_AUTO_DISCOVERY=false` |

## Requirements

Node.js 18+, npm or yarn, and (for building installers) `electron-builder`'s per-platform dependencies above.

## Contributing

Fork the repository, branch, make your changes, and open a pull request.

## License

MIT — see the monorepo root's [`LICENSE.code`](../../../LICENSE.code).
