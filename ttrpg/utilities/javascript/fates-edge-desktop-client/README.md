# Fate's Edge Desktop Client

A lightweight desktop client for the Fate's Edge Virtual Tabletop.

## Features

- 📦 Standalone desktop application
- 🔌 Connects to Fate's Edge server
- 🎲 Full web client support
- ⚡ Minimal resource usage
- 🔄 Auto-updater built-in
- 🎨 Native OS integration
- ⌨️ Keyboard shortcuts

## Installation

### Download
Download the latest release from the GitHub Releases page.

### From Source
```bash
# Clone the repository
git clone <your-repo>
cd ttrpg/utilities/fates-edge-client

# Install dependencies
npm install

# Build for your platform
npm run build
```

### Development
```bash
# Run in development mode
npm run dev

# Run in production mode
npm start
```

## Usage

1. Launch the application
2. Enter your Fate's Edge server URL
3. Start gaming!

## Keyboard Shortcuts

- `Cmd/Ctrl + ,` - Open settings
- `Cmd/Ctrl + R` - Reload page
- `Cmd/Ctrl + Q` - Quit
- `Cmd/Ctrl + Shift + I` - Developer Tools
- `Cmd/Ctrl + 0` - Reset zoom
- `Cmd/Ctrl + =` - Zoom in
- `Cmd/Ctrl + -` - Zoom out
- `F11` - Toggle full screen

## Configuration

Settings are stored in:
- **Windows:** `%APPDATA%/fates-edge/config.json`
- **macOS:** `~/Library/Application Support/fates-edge/config.json`
- **Linux:** `~/.config/fates-edge/config.json`

## Building

### Build for Current Platform
```bash
npm run build
```

### Build for Specific Platform
```bash
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

### Build for All Platforms
```bash
npm run build:all
```

### Using the Build Script
```bash
# Interactive menu
node scripts/build.js

# Build for specific platform
node scripts/build.js --platform=mac

# Build for all platforms
node scripts/build.js --all

# Clean build directory
node scripts/build.js --clean

# Show help
node scripts/build.js --help
```

## Requirements

- Node.js 18+
- npm or yarn
- For building: electron-builder dependencies

### Platform-Specific Requirements

#### macOS
- Xcode Command Line Tools
- For codesigning: Apple Developer certificate

#### Windows
- Windows 10/11
- Visual Studio Build Tools (for native modules)

#### Linux
- libc6, libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, libxcb1, libx11-xcb1, libxcb-dri3-0, libdrm2, libgbm1

## Icon Generation

To generate app icons:

```bash
# Install ImageMagick (if not already installed)
brew install imagemagick  # macOS
apt-get install imagemagick  # Linux
choco install imagemagick  # Windows

# Generate icons from a source image
cd build
./generate-icons.sh source.png
```

## Troubleshooting

### "Electron failed to install correctly"
```bash
rm -rf node_modules
npm install
```

### "Cannot connect to server"
- Make sure the Fate's Edge server is running
- Check the server URL in settings (Cmd/Ctrl + ,)
- Check network/firewall settings

### Build fails on macOS
```bash
# Install missing dependencies
xcode-select --install
# Allow signing errors during development
export CSC_IDENTITY_AUTO_DISCOVERY=false
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License
