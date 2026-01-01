# Quick Build Guide

## Web App (Public Release)

Users provide their own Gemini API keys via the UI.

```bash
cd frontend
npm install
npm run build
```

Deploy `frontend/dist/` to Vercel, Netlify, or any static host.

---

## Desktop App (Public Release)

Users provide their own Gemini API keys via the UI.

```bash
cd frontend
npm install
npm run tauri:build
```

Distribute the app from `frontend/src-tauri/target/release/bundle/`

---

## Desktop App (Internal - With Bundled API Key)

For internal distribution where you want to bundle your Gemini API key.

### Setup (One Time)

```bash
cd frontend
cp .env.example .env
# Edit .env and add your actual Gemini API key to GEMINI_API_KEY
```

### Build

```bash
npm run tauri:build:with-key
```

The API key will be compiled into the binary.

⚠️ **Warning:** Only use this for internal/private distributions. The key is harder to extract than in a web build but not impossible.

---

## Quick Reference

| What | Command | API Key |
|------|---------|---------|
| Web development | `npm run dev` | `.env` or user-provided |
| Web production | `npm run build` | User-provided (recommended) |
| Desktop development | `npm run tauri:dev` | `.env` or user-provided |
| Desktop public | `npm run tauri:build` | User-provided |
| Desktop internal | `npm run tauri:build:with-key` | Bundled from `.env` |

---

## Testing Locally

### Web Version
```bash
cd frontend
npm run dev
```
Open http://localhost:5173 in Chrome or Edge

### Desktop Version
```bash
cd frontend
npm run tauri:dev
```

---

## Environment Files

- `frontend/.env` - For both web and desktop builds
- Copy from `frontend/.env.example` and add your keys

---

See `DEPLOYMENT.md` for detailed deployment instructions.
