# Zagreb Plotter - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Gemini AI (Optional)

If you want to use AI image generation/processing features:

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your Gemini API key
# Get your key from: https://aistudio.google.com/app/apikey
```

Edit `frontend/.env`:
```
VITE_GEMINI_API_KEY=AIzaSy...your_actual_key_here
```

### 3. Run the App

#### Web Version (Chrome/Edge only)
```bash
npm run dev
```
Open http://localhost:5173 in Chrome or Edge

#### Desktop Version (All browsers/platforms)
```bash
npm run tauri:dev
```

## Features

### ✅ Works Without Backend
- No Python backend needed
- No database required
- All data stored locally in IndexedDB
- Offline-capable (except AI features)

### Serial Communication
- **Web**: Uses Web Serial API (Chrome/Edge only)
- **Desktop**: Uses Tauri native serial plugin (all platforms)

### AI Features (Optional)
- **Image Processing**: Convert images to plotter-friendly line art
- **Image Generation**: (Coming soon) Generate from text descriptions
- Requires Gemini API key (see `GEMINI_SETUP.md`)

## Building for Production

### Web App
```bash
npm run build
```
Output in `dist/` - deploy to any static hosting

### Desktop App
```bash
npm run tauri:build
```
Output in `src-tauri/target/release/bundle/`

## Troubleshooting

### "Module not found" errors
```bash
cd frontend
npm install
```

### Plotter not connecting (Web)
- Use Chrome or Edge browser
- Ensure you've granted serial port permissions
- Or use the desktop app instead

### Gemini AI not working
1. Check you have a valid API key in `frontend/.env`
2. Restart the dev server after adding the key
3. Check the browser console for errors

## Project Structure

```
frontend/
├── src/
│   ├── lib/
│   │   ├── gemini/         # Gemini AI client
│   │   ├── qrcode/         # QR code generation
│   │   ├── canvas/         # SVG export
│   │   ├── serial/         # Serial communication
│   │   └── grbl/           # GRBL plotter control
│   ├── services/
│   │   ├── projectDB.ts    # IndexedDB storage
│   │   └── imageGalleryDB.ts
│   ├── stores/             # Zustand state management
│   └── components/
└── src-tauri/              # Desktop app (Rust)
```

## Documentation

- `GEMINI_SETUP.md` - Detailed Gemini AI setup
- `BACKEND_MIGRATION_COMPLETE.md` - Technical migration details
- `WEBAPP_MIGRATION.md` - Original migration plan

## Need Help?

Check the browser console (F12) for error messages, or review the documentation files above.
