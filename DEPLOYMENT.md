# Deployment Guide

## Web App Deployment

### 1. Build the Web App

```bash
cd frontend
npm install
npm run build
```

Output will be in `frontend/dist/`

### 2. Deploy Options

#### Vercel (Recommended)
```bash
npm install -g vercel
cd frontend
vercel --prod
```

#### Netlify
```bash
npm install -g netlify-cli
cd frontend
netlify deploy --prod --dir=dist
```

#### GitHub Pages
```bash
# Install gh-pages
npm install -g gh-pages

# Deploy
gh-pages -d dist
```

### 3. Environment Variables (Optional)

If you want to bundle a Gemini API key (not recommended for public deployments):

**Vercel/Netlify:**
- Add `VITE_GEMINI_API_KEY` in the dashboard
- The key will be baked into the JavaScript bundle
- ⚠️ **Warning**: Anyone can extract it from the JS

**Build-time:**
```bash
cd frontend
echo "VITE_GEMINI_API_KEY=your_key" > .env
npm run build
```

**Recommended:** Let users provide their own API keys via the UI instead.

---

## Desktop App Deployment (Tauri)

### 1. Build with Bundled API Key (Optional)

For internal/private distributions where you want to include the API key:

```bash
cd frontend

# Option A: Use .env file
cp .env.tauri.example .env.tauri
# Edit .env.tauri and add your key
source .env.tauri
export GEMINI_API_KEY

# Option B: Inline environment variable
GEMINI_API_KEY=your_actual_key npm run tauri:build
```

The key will be compiled into the binary and harder to extract.

### 2. Build without API Key (Public Distribution)

For public releases, don't bundle the key. Users will provide their own:

```bash
cd frontend
npm run tauri:build
```

### 3. Output Locations

**macOS:**
- App: `src-tauri/target/release/bundle/macos/Zagreb Plotter.app`
- DMG: `src-tauri/target/release/bundle/dmg/Zagreb Plotter_1.0.0_*.dmg`

**Windows:**
```bash
npm run tauri:build -- --target x86_64-pc-windows-msvc
```
- Installer: `src-tauri/target/release/bundle/msi/Zagreb Plotter_1.0.0_x64.msi`

**Linux:**
```bash
npm run tauri:build
```
- DEB: `src-tauri/target/release/bundle/deb/zagreb-plotter_1.0.0_amd64.deb`
- AppImage: `src-tauri/target/release/bundle/appimage/zagreb-plotter_1.0.0_amd64.AppImage`

### 4. Code Signing (macOS)

For distribution outside the App Store:

```bash
# Sign the app
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  "src-tauri/target/release/bundle/macos/Zagreb Plotter.app"

# Notarize (required for macOS 10.15+)
xcrun notarytool submit \
  "src-tauri/target/release/bundle/dmg/Zagreb Plotter_1.0.0_*.dmg" \
  --apple-id "your@email.com" \
  --password "app-specific-password" \
  --team-id "TEAM_ID" \
  --wait
```

---

## API Key Strategy by Deployment Type

| Deployment | API Key Strategy | Security |
|------------|------------------|----------|
| **Web (Public)** | User-provided via UI | ✅ Most Secure |
| **Web (Internal)** | Build-time env var | ⚠️ Extractable from JS |
| **Desktop (Public)** | User-provided via UI | ✅ Secure |
| **Desktop (Internal)** | Compiled into binary | ✅ Harder to extract |

---

## Browser Compatibility

### Web Version Requirements
- Chrome 89+ or Edge 89+ (for Web Serial API)
- HTTPS required for Web Serial
- Other browsers: Use desktop app instead

### Desktop Version
- Works on any browser (uses native serial)
- No HTTPS requirement
- Full offline support

---

## Post-Deployment

### Web App
1. Ensure HTTPS is enabled
2. Test serial port access in Chrome/Edge
3. Verify localStorage works (no privacy mode)

### Desktop App
1. Test on target platform
2. Verify serial port access permissions
3. Check app signing for macOS

---

## User Instructions

For public deployments, provide users with:
1. Link to get Gemini API key: https://aistudio.google.com/app/apikey
2. Instructions to configure it in the app
3. Browser compatibility info (Chrome/Edge for web)

See `GEMINI_SETUP.md` for user-facing documentation.

---

## Troubleshooting

### Web Serial Not Working
- Check HTTPS is enabled
- Verify browser is Chrome/Edge 89+
- Try desktop app as fallback

### API Key Issues
- Ensure key format is correct (starts with AIza...)
- Check console for API errors
- Verify quota hasn't been exceeded

### Build Errors
```bash
# Clean build
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

---

## Cost Considerations

### Using Bundled API Key
- You pay for all API usage
- Monitor usage in Google AI Studio
- Set up billing alerts

### Using User-Provided Keys
- Users pay for their own usage
- No API costs for you
- Better for public releases
- More privacy-focused

**Recommendation:** For public apps, use user-provided keys (Option 1). For internal tools, you can bundle the key (Option 4).
