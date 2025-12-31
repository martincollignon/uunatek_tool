"""Plotter status and progress models."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class PlotState(str, Enum):
    """Current state of a plot job."""
    IDLE = "idle"
    CONNECTING = "connecting"
    PLOTTING = "plotting"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"


class PenState(str, Enum):
    """Current pen position."""
    UP = "up"
    DOWN = "down"
    UNKNOWN = "unknown"


class PlotterStatus(BaseModel):
    """Current plotter connection and state."""
    model_config = {"populate_by_name": True}

    is_connected: bool = Field(False, serialization_alias='connected')
    port: Optional[str] = None
    firmware_version: Optional[str] = None
    pen_state: PenState = PenState.UNKNOWN
    motors_enabled: bool = False


class PlotProgress(BaseModel):
    """Progress of current plot job."""
    state: PlotState = PlotState.IDLE
    current_command: int = 0
    total_commands: int = 0
    percentage: float = 0.0
    estimated_remaining_seconds: float = 0.0
    current_side: Optional[str] = None  # 'front', 'back', 'envelope'
    error_message: Optional[str] = None
    error_code: Optional[str] = None  # Structured error code (e.g., PLT-C004)
