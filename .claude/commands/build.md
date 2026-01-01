---
description: Build the Tauri production app with proper environment setup
argument-hint: "[clean|dev|prod]"
---

Build the Zagreb Plotter Tauri application. This command handles all the necessary setup including:
- Setting up the Rust/Cargo environment (ensures `~/.cargo/bin` is in PATH)
- Running TypeScript compilation
- Building the Vite frontend
- Compiling the Rust backend
- Creating distributable bundles (DMG and .app)

**This is a TAURI application** (migrated from Electron). All build commands run from the project root.

**Arguments:**
- `clean` - Clean build artifacts before building
- `dev` - Run in development mode with hot-reload
- `prod` or no argument - Build production bundle

**Build Commands:**
From project root:
- Production: `npm run build` or `npm run tauri:build`
- Development: `npm run dev` or `npm run tauri:dev`
- Frontend only: `npm run build:frontend`

**Output location:**
- App: `frontend/src-tauri/target/release/bundle/macos/Zagreb Plotter.app`
- DMG: `frontend/src-tauri/target/release/bundle/dmg/Zagreb Plotter_1.0.0_aarch64.dmg`

**Important:**
- Always run build commands from the PROJECT ROOT directory
- The npm scripts automatically handle the correct PATH setup for Cargo/Rust
- Never run `npx tauri build` directly without setting PATH first
- This app uses Tauri (not Electron) for the desktop wrapper

After building, provide the user with:
1. Build success status
2. Exact paths to the built artifacts
3. Command to open/test the app: `open "frontend/src-tauri/target/release/bundle/macos/Zagreb Plotter.app"`
4. Any warnings or errors encountered
