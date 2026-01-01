"""FastAPI application entry point."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging
import re

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

# Configure logging with more detailed output
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# Enable detailed logging for plotter module
plotter_logger = logging.getLogger("core.plotter")
plotter_logger.setLevel(logging.INFO)

# Create FastAPI app
app = FastAPI(
    title="Pen Plotter App",
    description="Web application for iDraw 2.0 pen plotter control",
    version="1.0.0",
)


class DynamicCORSMiddleware(BaseHTTPMiddleware):
    """Custom CORS middleware that allows any localhost port."""

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")

        # Check if origin is localhost with any port or file protocol (for Electron)
        if origin and (
            re.match(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$", origin)
            or origin == "null"
            or origin.startswith("file://")
        ):
            response = await call_next(request)
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
            return response

        return await call_next(request)


# Configure CORS
settings = get_settings()
# Add dynamic CORS middleware for Electron
app.add_middleware(DynamicCORSMiddleware)

# Also add standard CORS for configured origins
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
    import sys

    # Parse command line arguments for dynamic port
    port = settings.api_port
    host = settings.api_host

    for i, arg in enumerate(sys.argv):
        if arg == '--port' and i + 1 < len(sys.argv):
            try:
                port = int(sys.argv[i + 1])
                logging.info(f"Using port from command line: {port}")
            except ValueError:
                logging.error(f"Invalid port number: {sys.argv[i + 1]}")
        elif arg == '--host' and i + 1 < len(sys.argv):
            host = sys.argv[i + 1]
            logging.info(f"Using host from command line: {host}")

    uvicorn.run(
        "main:app",  # Use 'main:app' for PyInstaller, 'backend.main:app' for development
        host=host,
        port=port,
        reload=False,  # Use reload=False for production
    )
