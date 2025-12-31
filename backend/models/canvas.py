"""Canvas data models."""

from typing import Optional, Any
from pydantic import BaseModel


class CanvasElement(BaseModel):
    """A single element on the canvas."""
    id: str
    type: str  # 'image', 'text', 'path', 'rect', 'circle', etc.
    data: dict[str, Any]  # fabric.js object data
    z_index: int = 0


class CanvasState(BaseModel):
    """Complete canvas state (serializable to/from fabric.js JSON)."""
    version: str = "1.0"
    objects: list[dict[str, Any]] = []
    background: Optional[str] = "#ffffff"
    width: float = 210  # mm
    height: float = 297  # mm
