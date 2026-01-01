# Web App + Tauri Migration - Next Steps

## Current Status: ✅ Core Implementation Complete

The TypeScript serial layer and Tauri desktop app have been built. The app now supports:
- **Web version** (Chrome/Edge) via Web Serial API - zero install
- **Desktop version** (all platforms including Safari) via Tauri - 25MB app

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              SHARED FRONTEND (React/Vite)               │
│            frontend/src/lib/serial, lib/grbl            │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌─────────────────────┐       ┌─────────────────────────┐
│   WEB (Chrome/Edge) │       │   TAURI (macOS/Win/Lin) │
│   Web Serial API    │       │   Native serial plugin  │
│   Zero install      │       │   25MB app (debug)      │
└─────────────────────┘       └─────────────────────────┘
```

---

## Files Created

### Serial Layer (`frontend/src/lib/serial/`)
| File | Purpose |
|------|---------|
| `types.ts` | Abstract serial interface, error types |
| `WebSerialConnection.ts` | Browser Web Serial API implementation |
| `TauriSerialConnection.ts` | Tauri native serial implementation |
| `index.ts` | Environment detection, connection factory |

### GRBL Layer (`frontend/src/lib/grbl/`)
| File | Purpose |
|------|---------|
| `types.ts` | GRBL status, commands, paper configs |
| `GRBLCommands.ts` | High-level GRBL controller interface |
| `PlotExecutor.ts` | Plot execution with coordinate transform |
| `index.ts` | Module exports |

### Plotter Service (`frontend/src/lib/plotter/`)
| File | Purpose |
|------|---------|
| `PlotterService.ts` | Unified plotter control service |
| `index.ts` | Module exports |

### Store (`frontend/src/stores/`)
| File | Purpose |
|------|---------|
| `plotterStoreNew.ts` | Zustand store using new TypeScript layer |

### Tauri (`frontend/src-tauri/`)
| File | Purpose |
|------|---------|
| `Cargo.toml` | Rust dependencies including serial plugin |
| `tauri.conf.json` | App configuration |
| `src/lib.rs` | Tauri app entry with serial plugin |

---

## Next Steps

### 1. ✅ Integrate New Store into UI Components (COMPLETED)

Replaced usage of old `plotterStore.ts` with `plotterStoreNew.ts`:

**Updated Files:**
- `frontend/src/pages/PlotPage.tsx` - Now uses `usePlotterStoreNew` and `svgToPlotCommands`
- `frontend/src/components/workflow/PlotterControls.tsx` - Uses new store with browser detection
- `frontend/src/components/layout/Header.tsx` - Uses new store for connection status
- `frontend/src/components/workflow/PlotProgress.tsx` - Handles both old and new progress formats
- `frontend/src/components/calibration/CalibrationWizard.tsx` - Uses new store for calibration

### 2. ✅ Add Browser Detection UI (COMPLETED)

Browser detection is now integrated into:
- `PlotterControls.tsx` - Shows warning when serial not supported
- `Header.tsx` - Shows browser warning indicator
- `PlotPage.tsx` - Disables plotting and shows message for unsupported browsers

### 3. ✅ Convert SVG to PlotCommands (COMPLETED)

Created utility at `frontend/src/lib/plotter/svgToCommands.ts`:

```typescript
import { svgToPlotCommands, fabricCanvasToPlotCommands } from '../lib/plotter';

// Convert SVG string to plot commands
const commands = svgToPlotCommands(svgString, {
  canvasWidthMm: 210,
  canvasHeightMm: 297,
  safetyMarginMm: 3,
  optimizePaths: true,
});

// Or convert Fabric.js canvas JSON directly
const commands = fabricCanvasToPlotCommands(canvasJson, options);
```

Features:
- Parses SVG path commands (M, L, H, V, C, Q, Z and relative variants)
- Handles basic shapes (rect, circle, ellipse, line, polyline, polygon)
- Approximates bezier curves with line segments
- Optimizes path order for faster plotting
- Applies safety margins
- Centers design within canvas bounds

### 4. Test with Hardware

1. Connect iDraw plotter via USB
2. Run web version: `npm run dev` and open in Chrome
3. Run Tauri version: `npx tauri dev`
4. Test connection, homing, and plotting

### 5. Build Release Version

```bash
# Build optimized Tauri app
npx tauri build

# Output locations:
# macOS: src-tauri/target/release/bundle/macos/Zagreb Plotter.app
# DMG:   src-tauri/target/release/bundle/dmg/Zagreb Plotter_1.0.0_aarch64.dmg
```

### 6. Optional: Remove Old Backend

Once the new system is verified working:

```bash
# These can be removed (keep as reference initially)
rm -rf backend/          # Python FastAPI backend
rm -rf electron/         # Electron shell
```

Update `package.json` to remove Electron dependencies.

---

## Testing Checklist

### Web Version (Chrome/Edge)
- [ ] Port detection and listing
- [ ] Connect to plotter
- [ ] Home command
- [ ] Pen up/down
- [ ] Manual movement
- [ ] Plot execution
- [ ] Pause/resume/cancel
- [ ] Disconnect handling
- [ ] Error recovery

### Tauri Version (macOS/Windows/Linux)
- [ ] Same tests as web version
- [ ] App launches correctly
- [ ] Serial permissions work
- [ ] App signing (for distribution)

---

## Deployment Options

### Web Version
- Deploy `dist/` to any static host (Vercel, Netlify, GitHub Pages)
- Must be served over HTTPS (Web Serial requirement)

### Desktop Version
- Distribute `.dmg` for macOS
- Build `.msi` for Windows: `npx tauri build --target x86_64-pc-windows-msvc`
- Build `.deb`/`.AppImage` for Linux

---

## Browser Support Matrix

| Browser | Web Serial | Solution |
|---------|------------|----------|
| Chrome 89+ | ✅ | Web app |
| Edge 89+ | ✅ | Web app |
| Opera 76+ | ✅ | Web app |
| Safari | ❌ | Tauri app |
| Firefox | ❌ | Tauri app |
| Mobile | ❌ | Not supported |

---

## Size Comparison

| Version | Size |
|---------|------|
| Old Electron app | ~150MB |
| New Tauri app (debug) | 25MB |
| New Tauri app (release) | ~10-15MB |
| Web version | 0 (hosted) |
