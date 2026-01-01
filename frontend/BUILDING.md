# Building Zagreb Plotter

## Quick Start

```bash
# Development mode (hot-reload)
npm run tauri:dev

# Production build
npm run tauri:build
```

## Prerequisites

Before building, ensure you have:

1. **Rust/Cargo** - Installed at `~/.cargo/bin/`
2. **create-dmg** - For creating DMG installers
   ```bash
   brew install create-dmg
   ```
3. **Xcode Command Line Tools** - For macOS development

## What Was Fixed

The Tauri CLI requires Rust/Cargo to be in your PATH. We've fixed this in two ways:

### 1. Shell Configuration
Added to your `~/.zshrc`:
```bash
export PATH="$HOME/.cargo/bin:$PATH"
```

For this to take effect in your current terminal, run:
```bash
source ~/.zshrc
```

### 2. NPM Scripts (Automatic)
The npm scripts now automatically ensure cargo is in PATH, so you can always use:
- `npm run tauri:build` - Production build
- `npm run tauri:dev` - Development mode
- `npm run tauri` - Run any tauri command

## ❌ Don't Do This

```bash
# This will fail if cargo isn't in PATH:
npx tauri build
```

## ✅ Always Do This

```bash
# This always works:
npm run tauri:build
```

Or use the Claude command:
```
/build
```

## Build Artifacts

After a successful production build, you'll find:

- **App Bundle**: `src-tauri/target/release/bundle/macos/Zagreb Plotter.app`
- **DMG Installer**: `src-tauri/target/release/bundle/dmg/Zagreb Plotter_1.0.0_aarch64.dmg`

## Testing the App

```bash
# Open the built app
open "src-tauri/target/release/bundle/macos/Zagreb Plotter.app"

# Or mount the DMG
open "src-tauri/target/release/bundle/dmg/Zagreb Plotter_1.0.0_aarch64.dmg"
```

## Troubleshooting

### "cargo: command not found"

If you still see this error:

1. Verify Rust is installed:
   ```bash
   ls ~/.cargo/bin/cargo
   ```

2. Manually add to PATH for current session:
   ```bash
   export PATH="$HOME/.cargo/bin:$PATH"
   ```

3. For permanent fix, ensure `~/.zshrc` contains:
   ```bash
   export PATH="$HOME/.cargo/bin:$PATH"
   ```

4. Reload your shell:
   ```bash
   source ~/.zshrc
   ```

### Clean Build

To start fresh:
```bash
cd src-tauri
cargo clean
cd ..
npm run tauri:build
```
