# Pen Plotter Web App

A web application for controlling an iDraw 2.0 pen plotter, replacing the Inkscape-based workflow with a visual canvas editor and AI image generation.

## Features

- Visual canvas editor with fabric.js
- Support for multiple paper sizes (business card to A3)
- Double-sided printing workflow
- Envelope addressing
- AI image generation via Gemini 2.5 Flash Image (latest model)
- **Universal image format support** (PNG, JPEG, WebP, GIF, HEIC, etc.)
- **Automatic format conversion** for compatibility
- Real-time plotter status and control
- Multi-step plotting workflow with pause/resume

## Prerequisites

- **Python 3.10+** (Required for latest dependencies)
- Node.js 18+
- iDraw 2.0 pen plotter (or compatible EBB-based plotter)

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Important:** Python 3.10 or higher is required for the latest dependency versions.

### Frontend

```bash
cd frontend
npm install
```

### Environment Variables

Create a `.env` file in the `backend/` directory:

```
GEMINI_API_KEY=your_api_key_here
PLOTTER_PORT=/dev/tty.usbserial-xxx  # Optional, auto-detected if not set
```

Get your Gemini API key from: https://aistudio.google.com/app/apikey

## Running the Application

### Development Mode

Start the backend:
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Start the frontend (in a separate terminal):
```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`

### Production Build

Build the frontend:
```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`. Configure your backend to serve these static files.

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   React Frontend    │────▶│   Python Backend     │
│   (Vite + fabric.js)│◀────│   (FastAPI)          │
└─────────────────────┘     └──────────────────────┘
                                      │
                                      ▼
                            ┌──────────────────────┐
                            │   iDraw 2.0 Plotter  │
                            │   (USB Serial)       │
                            └──────────────────────┘
```

## Workflow

1. Create a new project (select paper size, double-sided option, envelope option)
2. Design in the canvas editor (add text, images, AI-generated images)
3. Click "Start Plotting" to begin the multi-step workflow
4. Plot Side 1 → Confirm → Flip paper → Plot Side 2 → Confirm → Insert envelope → Plot envelope

## AI Image Generation

The app uses **Gemini 2.5 Flash Image**, Google's latest model for image generation. It's optimized for:
- Line art and sketch generation perfect for pen plotting
- Fast generation times
- Subject consistency across edits
- Clean, continuous lines suitable for single-line pen drawing

Supported styles:
- **Line Art**: Clean, bold outlines
- **Sketch**: Varied line weights
- **Minimal**: Simple shapes and lines
- **Detailed**: Cross-hatching and intricate patterns

## Technology Stack

### Backend
- FastAPI 0.127.0
- google-genai 1.56.0 (latest Gemini SDK)
- Pillow 12.0.0
- pillow-heif 0.20.0 (HEIC/HEIF support)
- cairosvg 2.7.0 (SVG to PNG conversion)
- websockets 15.0.1
- pyserial 3.5

### Frontend
- React 18.3.1
- Vite 7.3.0
- fabric.js 6.5.3
- TypeScript 5.9.3
- Zustand 5.0.9
- Axios 1.13.2

## EBB Commands Used

The plotter uses the EBB (EiBotBoard) protocol:

- `SM,duration,x_steps,y_steps` - Stepper move
- `SP,0/1,delay` - Pen up/down (servo)
- `EM,mode,mode` - Enable/disable motors
- `V` - Version query (connection test)

## Image Format Support

The app supports **all common image formats** and automatically converts them for compatibility:

### Supported Formats
- **PNG** - Best for line art with transparency
- **JPEG** - Good for photos
- **WebP** - Modern format with good compression
- **GIF** - Animated or static images
- **SVG** - Vector graphics (automatically converted to PNG)
- **HEIC** - iOS default format (automatically converted)
- **BMP, TIFF** - Automatically converted to compatible formats

### Automatic Conversion
- Images are automatically converted to ensure compatibility with both the canvas and Gemini API
- **SVG files** are rasterized to PNG at high resolution (1024x1024)
- **HEIC images** from iPhone/iPad are seamlessly converted to PNG
- All formats are optimized for pen plotter output
- Import any image you find online - it will just work!

For detailed technical information, see [IMAGE_FORMAT_HANDLING.md](IMAGE_FORMAT_HANDLING.md)

## Troubleshooting

### Backend won't start
- Ensure Python 3.10+ is installed: `python --version`
- Activate virtual environment: `source venv/bin/activate`
- Reinstall dependencies: `pip install -r requirements.txt --upgrade`

### Gemini API errors
- Verify your API key is set in `.env`
- Check API key is valid at https://aistudio.google.com/app/apikey
- Ensure `google-genai` package is installed (not the deprecated `google-generativeai`)

### Image format issues
- If HEIC images fail to upload, ensure `pillow-heif` is installed: `pip install pillow-heif`
- If SVG images fail to convert, ensure `cairosvg` is installed: `pip install cairosvg`
- For other format issues, check the browser console for error messages
- See [IMAGE_FORMAT_HANDLING.md](IMAGE_FORMAT_HANDLING.md) for detailed troubleshooting

### Plotter not connecting
- Check USB connection
- Verify correct port in `.env` or let it auto-detect
- On macOS/Linux, ensure user has permission to access serial ports

## Distribution

### For End Users (No Command Line Required)

Want to distribute this app to others? See **[PACKAGING.md](PACKAGING.md)** for instructions on creating a standalone macOS application with a double-click installer.

**Quick build:**
```bash
./build.sh
```

This creates a `.dmg` installer that users can:
1. Double-click to open
2. Drag to Applications
3. Launch like any other Mac app

No terminal, no setup required for end users!

## License

MIT
