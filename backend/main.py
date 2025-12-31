"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging

try:
    # Try absolute imports first (for PyInstaller)
    from config import get_settings
    from api.routes import (
        projects_router,
        canvas_router,
        plotter_router,
        gemini_router,
        qrcode_router,
    )
except ImportError:
    # Fall back to relative imports (for development)
    from .config import get_settings
    from .api.routes import (
        projects_router,
        canvas_router,
        plotter_router,
        gemini_router,
        qrcode_router,
    )

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# Create FastAPI app
app = FastAPI(
    title="Pen Plotter App",
    description="Web application for iDraw 2.0 pen plotter control",
    version="1.0.0",
)

# Configure CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects_router)
app.include_router(canvas_router)
app.include_router(plotter_router)
app.include_router(gemini_router)
app.include_router(qrcode_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Pen Plotter App",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=False,  # Use reload=False for production; use run_backend.py for proper entry point
    )
