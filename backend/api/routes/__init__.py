"""API routes."""

from .projects import router as projects_router
from .canvas import router as canvas_router
from .plotter import router as plotter_router
from .gemini import router as gemini_router
from .qrcode import router as qrcode_router

__all__ = [
    "projects_router",
    "canvas_router",
    "plotter_router",
    "gemini_router",
    "qrcode_router",
]
