#!/bin/bash
set -e

echo "🚀 Building Pen Plotter App for macOS..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
if [ "$(echo "$PYTHON_VERSION < 3.10" | bc)" -eq 1 ]; then
    echo -e "${RED}❌ Python 3.10+ is required (found $PYTHON_VERSION)${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Step 0: Clean caches
echo -e "${BLUE}🧹 Cleaning build caches...${NC}"
# Clean PyInstaller cache (but keep backend.spec - it's source!)
rm -rf ~/.cache/pyinstaller 2>/dev/null || true
rm -rf build/ dist/ backend-dist/ 2>/dev/null || true
# Clean Python cache
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
# Clean frontend cache
rm -rf frontend/dist/ frontend/node_modules/.vite 2>/dev/null || true
# Clean electron-builder cache
rm -rf node_modules/.cache 2>/dev/null || true
echo -e "${GREEN}✅ Caches cleaned${NC}"
echo ""

# Step 1: Build Frontend
echo -e "${BLUE}🎨 Building frontend...${NC}"
cd frontend
npm install
npm run build
cd ..
echo -e "${GREEN}✅ Frontend built${NC}"
echo ""

# Step 2: Install Python dependencies
echo -e "${BLUE}🐍 Installing Python dependencies...${NC}"
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
pip install pyinstaller
cd ..
echo -e "${GREEN}✅ Python dependencies installed${NC}"
echo ""

# Step 3: Bundle Backend with PyInstaller
echo -e "${BLUE}📦 Bundling backend with PyInstaller...${NC}"
source backend/venv/bin/activate
pyinstaller backend.spec --clean

# Move the bundled backend to backend-dist
rm -rf backend-dist
mv dist/plotter-backend backend-dist
rm -rf build dist
echo -e "${GREEN}✅ Backend bundled${NC}"
echo ""

# Step 4: Install Electron dependencies
echo -e "${BLUE}⚡ Installing Electron dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Electron dependencies installed${NC}"
echo ""

# Step 5: Build Electron app
echo -e "${BLUE}🖥️  Building macOS application...${NC}"
npm run electron:build
echo -e "${GREEN}✅ Application built${NC}"
echo ""

# Final output
echo -e "${GREEN}🎉 Build complete!${NC}"
echo ""
echo "Your application is ready at:"
echo "  📦 DMG installer: dist/Pen Plotter-1.0.0.dmg"
echo "  📦 ZIP archive:   dist/Pen Plotter-1.0.0-mac.zip"
echo ""
echo "To install:"
echo "  1. Open the DMG file"
echo "  2. Drag 'Pen Plotter' to Applications"
echo "  3. Double-click to launch"
echo ""
