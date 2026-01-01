"""Plotter communication and control modules for iDraw 2.0 with DrawCore (GRBL).

The iDraw 2.0 uses DrawCore firmware which is GRBL-based and accepts G-code commands.
This module provides the GRBLCommands class for controlling the plotter.
"""

from .connection import PlotterConnection
from .grbl_commands import GRBLCommands

# Keep EBBCommands available for reference but not as primary export
# from .commands import EBBCommands

__all__ = ["PlotterConnection", "GRBLCommands"]
