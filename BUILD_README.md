# Zagreb Plotter - Build Guide

## Important: This is a Tauri Application

This application has been migrated from Electron to Tauri. All Electron-related files and dependencies have been removed.

## Prerequisites

- Node.js 18+ and npm
- Rust and Cargo (installed via rustup)
- macOS for building macOS apps

## Quick Build Commands

**Run from the project root directory:**

```bash
# Production build (creates .app and DMG)
npm run build

# Development mode (hot-reload)
npm run dev

# Frontend only (no Tauri bundling)
npm run build:frontend
```

## Build Process

The build process includes:

1. **TypeScript Compilation** - Validates types
2. **Vite Frontend Build** - Bundles React app
3. **Rust Backend Compilation** - Compiles Tauri backend
4. **App Bundling** - Creates macOS .app bundle
5. **DMG Creation** - Creates disk image for distribution (may fail, .app is primary artifact)

## Build Artifacts

After a successful build, you'll find:

- **App Bundle**: `frontend/src-tauri/target/release/bundle/macos/Zagreb Plotter.app`
- **DMG Installer**: `frontend/src-tauri/target/release/bundle/dmg/Zagreb Plotter_1.0.0_aarch64.dmg`

## Running the App

```bash
# Open the built app
open "frontend/src-tauri/target/release/bundle/macos/Zagreb Plotter.app"

# Or run in development mode
npm run dev
```

## Project Structure

```
zagreb-v3/
├── frontend/               # Frontend application
│   ├── src/               # React/TypeScript source
│   ├── src-tauri/         # Tauri Rust backend
│   │   ├── src/           # Rust source code
│   │   ├── Cargo.toml     # Rust dependencies
│   │   └── tauri.conf.json # Tauri configuration
│   ├── dist/              # Built frontend (generated)
│   └── package.json       # Frontend dependencies
└── package.json           # Root package (build scripts)
```

## Key Technologies

- **Frontend**: React 18 + TypeScript + Vite + Fabric.js
- **Desktop**: Tauri (Rust-based, replaces Electron)
- **Serial Communication**: Web Serial API / Tauri Serial
- **Storage**: IndexedDB (client-side)

## Troubleshooting

### Build fails with "command not found: tauri"

Make sure Cargo is in your PATH:
```bash
export PATH="$HOME/.cargo/bin:$PATH"
```

The npm scripts handle this automatically.

### DMG bundling fails

This is a known issue with the bundle_dmg.sh script. The .app bundle is the primary artifact and should work fine. You can manually create a DMG if needed.

### "Cannot find module" errors

Make sure dependencies are installed:
```bash
npm install
cd frontend && npm install
```

## Development

For development with hot-reload:

```bash
npm run dev
```

This will:
1. Start the Vite dev server
2. Launch Tauri in development mode
3. Enable hot-reload for frontend changes
4. Auto-rebuild Rust code on changes

## Clean Build

To clean build artifacts:

```bash
cd frontend
rm -rf dist/
rm -rf src-tauri/target/
npm run build
```

## Notes

- The app uses a 3px/mm scale factor in the canvas editor
- SVG export converts from pixel coordinates to mm coordinates
- The preview fix ensures proper scaling during export
- Serial communication works via Web Serial API (Chrome/Edge) or Tauri commands
