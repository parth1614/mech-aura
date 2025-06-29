# MechNerd

A mechanical keyboard sound simulator for macOS and Windows. Get the satisfying click-clack sound of mechanical switches while typing on any keyboard!

## Features

- Multiple mechanical keyboard sound profiles (Cherry MX Blue, Brown, Topre, Alps)
- Adjustable volume control
- System tray integration
- Auto-start with system option
- Easy to use settings interface

## Installation

### From Releases

1. Download the latest release for your platform from the Releases page
2. Run the installer
3. Launch MechNerd from your applications

### Building from Source

Prerequisites:
- Node.js 16 or later
- npm 7 or later

```bash
# Clone the repository
git clone https://github.com/yourusername/mechnerd.git
cd mechnerd

# Install dependencies
npm install

# Start the app in development mode
npm start

# Build the app for your platform
npm run make
```

## Usage

1. After installation, MechNerd will appear in your system tray
2. Click the tray icon to access quick toggles
3. Open settings to:
   - Choose your preferred keyboard sound
   - Adjust volume
   - Enable/disable auto-start
   - Toggle the sound on/off

## Development

The app is built with:
- Electron
- TypeScript
- Howler.js for audio
- uiohook-napi for keyboard events

## License

MIT 