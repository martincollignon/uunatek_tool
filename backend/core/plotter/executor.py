"""Plot execution engine for GRBL-based plotters (iDraw 2.0 with DrawCore).

This module executes plot commands by converting them to GRBL G-code
and sending them to the plotter via the GRBLCommands interface.
"""

import asyncio
import math
from typing import Callable, Optional, AsyncGenerator, Union
from dataclasses import dataclass
from core.plotter.grbl_commands import GRBLCommands
from core.plotter.errors import PlotterError, ErrorSeverity
from models.plotter import PlotProgress, PlotState
import logging

logger = logging.getLogger(__name__)


@dataclass
class PlotCommand:
    """A single plotting command."""
    type: str  # 'move', 'line', 'pen_up', 'pen_down'
    x: float = 0  # mm
    y: float = 0  # mm


@dataclass
class MotionSegment:
    """A planned motion segment."""
    dx_steps: int
    dy_steps: int
    duration_ms: int
    pen_down: bool


class PlotExecutor:
    """Execute plot commands on the GRBL-based plotter.

    Converts PlotCommand objects to GRBL G-code commands and handles
    motion planning, speed control, and progress reporting.
    """

    # Paper position constants (VERIFIED EMPIRICALLY)
    # Papers are positioned flush top-right (back-right) of plotter bed
    # After $H homing: origin (0,0) at back-left, +X right, -Y toward front

    # A4 Paper (210mm × 297mm)
    A4_TOP_RIGHT_X = 290.0   # Back-right X
    A4_TOP_RIGHT_Y = 0.0     # Back-right Y (back edge)
    A4_TOP_LEFT_X = 80.0
    A4_TOP_LEFT_Y = 0.0
    A4_BOTTOM_LEFT_X = 80.0
    A4_BOTTOM_LEFT_Y = -297.0
    A4_BOTTOM_RIGHT_X = 290.0
    A4_BOTTOM_RIGHT_Y = -297.0

    # A3 Paper (297mm × 420mm)
    A3_TOP_RIGHT_X = 290.0   # Back-right X
    A3_TOP_RIGHT_Y = 0.0     # Back-right Y (back edge)
    A3_TOP_LEFT_X = -7.0
    A3_TOP_LEFT_Y = 0.0
    A3_BOTTOM_LEFT_X = -7.0
    A3_BOTTOM_LEFT_Y = -420.0
    A3_BOTTOM_RIGHT_X = 290.0
    A3_BOTTOM_RIGHT_Y = -420.0

    # Speed settings (mm/s) - will be converted to mm/min for GRBL
    DEFAULT_PEN_DOWN_SPEED = 33.3  # ~2000 mm/min for drawing
    DEFAULT_PEN_UP_SPEED = 41.7   # ~2500 mm/min for rapid moves (DrawCore max)
    MIN_SEGMENT_DURATION_MS = 5

    def __init__(
        self,
        commands: GRBLCommands,
        pen_down_speed: float = DEFAULT_PEN_DOWN_SPEED,
        pen_up_speed: float = DEFAULT_PEN_UP_SPEED,
        canvas_width_mm: float = 210.0,  # A4 width
        canvas_height_mm: float = 297.0,  # A4 height
    ):
        self.cmd = commands
        self.pen_down_speed = pen_down_speed
        self.pen_up_speed = pen_up_speed
        self.canvas_width_mm = canvas_width_mm
        self.canvas_height_mm = canvas_height_mm

        # Current state
        self._current_x = 0.0  # mm
        self._current_y = 0.0  # mm
        self._pen_down = False

        # Origin tracking (set at plot start based on pen position)
        self._origin_x = 0.0  # mm - machine X coordinate of top-right corner
        self._origin_y = 0.0  # mm - machine Y coordinate of top-right corner

        # Control flags
        self._cancel_requested = False
        self._pause_requested = False

    def reset_position(self):
        """Reset internal position tracking to origin."""
        self._current_x = 0.0
        self._current_y = 0.0
        self._pen_down = False

    def _transform_coordinates(self, svg_x: float, svg_y: float) -> tuple[float, float]:
        """Transform SVG coordinates to plotter machine coordinates.

        After homing, pen moves to top-right corner of paper at (290, 0).
        This becomes the origin for our coordinate transform.

        SVG origin (0,0) is at top-left corner of paper.
        Pen starts at top-right corner = SVG (canvas_width, 0).

        Coordinate system mapping (VERIFIED EMPIRICALLY):
        - Machine: origin (0,0) at back-left after $H homing
        - Machine: +X goes RIGHT, -Y goes toward FRONT (toward user)
        - Machine: Y=0 is at BACK edge, negative Y toward front
        - SVG: (0,0) at top-left, +X goes RIGHT, +Y goes DOWN
        - Paper positioned flush top-right (back-right) of bed

        Transformation:
        - X: offset from top-right corner (left = negative offset)
        - Y: SVG +Y down = machine -Y (both toward front/user)

        Args:
            svg_x: X coordinate from SVG (0 = left edge of paper)
            svg_y: Y coordinate from SVG (0 = top edge of paper)

        Returns:
            (machine_x, machine_y) tuple in plotter's machine coordinates
        """
        # X: offset from top-right corner (negative = left of start)
        relative_x = svg_x - self.canvas_width_mm

        # Y: SVG +Y down = machine -Y (both go toward front/user)
        relative_y = -svg_y

        # Add origin offset to get absolute machine coordinates
        machine_x = self._origin_x + relative_x
        machine_y = self._origin_y + relative_y

        return (machine_x, machine_y)

    async def execute(
        self,
        plot_commands: list[PlotCommand],
        progress_callback: Optional[Callable[[PlotProgress], None]] = None,
        side: str = "front",
        check_voltage: bool = True,
        poll_pause_button: bool = True,
    ) -> bool:
        """
        Execute a list of plot commands.

        Args:
            plot_commands: List of PlotCommand objects
            progress_callback: Called with progress updates
            side: Which side is being plotted ('front', 'back', 'envelope')
            check_voltage: Whether to check voltage before starting
            poll_pause_button: Whether to poll physical pause button during plot

        Returns:
            True if completed successfully, False if cancelled

        Raises:
            PlotterError: Various error codes depending on failure type
        """
        self._cancel_requested = False
        self._pause_requested = False
        total = len(plot_commands)
        self._current_command_index = 0

        try:
            # Check voltage before starting (PLT-W001)
            if check_voltage:
                await self.cmd.check_voltage()

            # Initialize and home the plotter
            await self.cmd.enable_motors()
            await self.cmd.pen_up()
            self._pen_down = False

            # Auto-home to establish absolute coordinates (PLT-C001)
            logger.info("Homing plotter to establish absolute coordinates...")
            try:
                await self.cmd.home(timeout=60.0)
                await asyncio.sleep(5)  # Wait for homing to complete
            except Exception as e:
                logger.warning(f"Homing timeout (may be normal): {e}")
                await asyncio.sleep(5)

            # Verify we're at home position
            status = await self.cmd.query_status()
            logger.info(f"After homing: machine position ({status.machine_x:.1f}, {status.machine_y:.1f})")

            # Move to paper top-right corner (back-right)
            # Both A4 and A3 share the same top-right position when flush right
            self._origin_x = self.A4_TOP_RIGHT_X if self.canvas_width_mm == 210.0 else self.A3_TOP_RIGHT_X
            self._origin_y = self.A4_TOP_RIGHT_Y if self.canvas_width_mm == 210.0 else self.A3_TOP_RIGHT_Y
            logger.info(f"Moving to paper top-right corner: ({self._origin_x:.1f}, {self._origin_y:.1f})")
            await self.cmd.move_absolute(self._origin_x, self._origin_y, None)
            await asyncio.sleep(1)

            # Confirm position
            status = await self.cmd.query_status()
            logger.info(f"Pen positioned at: ({status.machine_x:.1f}, {status.machine_y:.1f})")
            logger.info(f"This is SVG coordinate ({self.canvas_width_mm:.0f}, 0) - top-right corner of paper")

            # Initialize current position tracking
            self._current_x = self._origin_x
            self._current_y = self._origin_y

            for i, cmd in enumerate(plot_commands):
                self._current_command_index = i

                # Check for cancel
                if self._cancel_requested:
                    logger.info("Plot cancelled by user")
                    await self.cmd.pen_up()
                    return False

                # Poll physical pause button (PLT-U001)
                if poll_pause_button and i % 10 == 0:  # Check every 10 commands
                    try:
                        await self.cmd.check_for_pause_button()
                    except PlotterError as e:
                        if e.code == "PLT-U001":
                            # Pause button pressed - enter pause state
                            self._pause_requested = True
                            logger.info("Physical pause button pressed")
                        else:
                            raise

                # Handle pause
                while self._pause_requested:
                    if progress_callback:
                        progress_callback(PlotProgress(
                            state=PlotState.PAUSED,
                            current_command=i,
                            total_commands=total,
                            percentage=(i / total) * 100,
                            current_side=side,
                        ))
                    await asyncio.sleep(0.1)
                    if self._cancel_requested:
                        await self.cmd.pen_up()
                        return False

                # Execute command
                await self._execute_command(cmd)

                # Report progress
                if progress_callback:
                    progress_callback(PlotProgress(
                        state=PlotState.PLOTTING,
                        current_command=i + 1,
                        total_commands=total,
                        percentage=((i + 1) / total) * 100,
                        current_side=side,
                    ))

            # Finish up
            await self.cmd.pen_up()
            await self.cmd.wait_for_completion()

            if progress_callback:
                progress_callback(PlotProgress(
                    state=PlotState.COMPLETED,
                    current_command=total,
                    total_commands=total,
                    percentage=100.0,
                    current_side=side,
                ))

            return True

        except PlotterError as e:
            logger.error(f"Plot execution error: {e.code} - {e}")
            try:
                await self.cmd.pen_up()
            except Exception:
                pass  # Best effort pen up

            # Add command context to error
            e.context["command_index"] = self._current_command_index
            e.context["total_commands"] = total
            e.context["side"] = side

            if progress_callback:
                progress_callback(PlotProgress(
                    state=PlotState.ERROR,
                    current_command=self._current_command_index,
                    total_commands=total,
                    error_message=str(e),
                    error_code=e.code,
                    current_side=side,
                ))
            raise

        except Exception as e:
            logger.error(f"Plot execution error: {e}")
            try:
                await self.cmd.pen_up()
            except Exception:
                pass  # Best effort pen up

            # Wrap in PlotterError for consistent handling
            error = PlotterError(
                "PLT-X002",
                context={
                    "command_index": self._current_command_index,
                    "total_commands": total,
                    "side": side,
                    "original_error": str(e),
                },
                cause=e,
            )

            if progress_callback:
                progress_callback(PlotProgress(
                    state=PlotState.ERROR,
                    current_command=self._current_command_index,
                    total_commands=total,
                    error_message=str(e),
                    error_code="PLT-X002",
                    current_side=side,
                ))
            raise error

    async def _execute_command(self, cmd: PlotCommand):
        """Execute a single plot command using GRBL G-code.

        For GRBL, we use absolute positioning (G90 mode) with feed rates
        instead of the EBB's duration-based relative moves.
        """
        if cmd.type == "pen_up":
            if self._pen_down:
                await self.cmd.pen_up()
                self._pen_down = False

        elif cmd.type == "pen_down":
            if not self._pen_down:
                await self.cmd.pen_down()
                self._pen_down = True

        elif cmd.type in ("move", "line"):
            # Transform SVG coordinates to plotter coordinates
            plotter_x, plotter_y = self._transform_coordinates(cmd.x, cmd.y)

            logger.info(f"Move command: SVG({cmd.x:.2f}, {cmd.y:.2f}) → Plotter({plotter_x:.2f}, {plotter_y:.2f})")

            # Calculate distance for skip check (using transformed coordinates)
            dx = plotter_x - self._current_x
            dy = plotter_y - self._current_y
            distance = math.sqrt(dx * dx + dy * dy)

            if distance < 0.01:  # Less than 0.01mm, skip
                return

            # For GRBL, use absolute coordinates with appropriate feed rate
            if self._pen_down:
                # Drawing move - use G01 with feed rate
                feed_rate = self.pen_down_speed * 60  # Convert mm/s to mm/min
                logger.info(f"G01 X{plotter_x:.3f} Y{plotter_y:.3f} F{feed_rate:.1f}")
                await self.cmd.move_absolute(plotter_x, plotter_y, feed_rate)
            else:
                # Rapid move (pen up) - use G00 (no feed rate = maximum speed)
                logger.info(f"G00 X{plotter_x:.3f} Y{plotter_y:.3f}")
                await self.cmd.move_absolute(plotter_x, plotter_y, None)

            # Update internal position tracking (use transformed coordinates)
            self._current_x = plotter_x
            self._current_y = plotter_y

            # Wait for GRBL to complete the move
            await self.cmd.wait_for_completion(timeout=60.0)

    def pause(self):
        """Request pause of current plot."""
        self._pause_requested = True
        logger.info("Pause requested")

    def resume(self):
        """Resume paused plot."""
        self._pause_requested = False
        logger.info("Resume requested")

    def cancel(self):
        """Cancel current plot."""
        self._cancel_requested = True
        self._pause_requested = False
        logger.info("Cancel requested")

    @property
    def is_paused(self) -> bool:
        return self._pause_requested

    @property
    def is_cancelled(self) -> bool:
        return self._cancel_requested
