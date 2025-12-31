"""Plot execution engine."""

import asyncio
import math
from typing import Callable, Optional, AsyncGenerator
from dataclasses import dataclass
from core.plotter.commands import EBBCommands
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
    """Execute plot commands on the plotter."""

    # Speed settings (mm/s)
    DEFAULT_PEN_DOWN_SPEED = 33.3  # ~2000 mm/min
    DEFAULT_PEN_UP_SPEED = 133.3  # ~8000 mm/min
    MIN_SEGMENT_DURATION_MS = 5

    def __init__(
        self,
        commands: EBBCommands,
        pen_down_speed: float = DEFAULT_PEN_DOWN_SPEED,
        pen_up_speed: float = DEFAULT_PEN_UP_SPEED,
    ):
        self.cmd = commands
        self.pen_down_speed = pen_down_speed
        self.pen_up_speed = pen_up_speed

        # Current state
        self._current_x = 0.0  # mm
        self._current_y = 0.0  # mm
        self._pen_down = False

        # Control flags
        self._cancel_requested = False
        self._pause_requested = False

    def reset_position(self):
        """Reset internal position tracking to origin."""
        self._current_x = 0.0
        self._current_y = 0.0
        self._pen_down = False

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

            # Initialize
            await self.cmd.enable_motors()
            await self.cmd.pen_up()
            self._pen_down = False

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
        """Execute a single plot command."""
        if cmd.type == "pen_up":
            if self._pen_down:
                await self.cmd.pen_up()
                self._pen_down = False

        elif cmd.type == "pen_down":
            if not self._pen_down:
                await self.cmd.pen_down()
                self._pen_down = True

        elif cmd.type in ("move", "line"):
            # Calculate displacement
            dx = cmd.x - self._current_x
            dy = cmd.y - self._current_y
            distance = math.sqrt(dx * dx + dy * dy)

            if distance < 0.01:  # Less than 0.01mm, skip
                return

            # Choose speed based on pen state
            speed = self.pen_down_speed if self._pen_down else self.pen_up_speed

            # Calculate duration
            duration_s = distance / speed
            duration_ms = max(self.MIN_SEGMENT_DURATION_MS, int(duration_s * 1000))

            # Convert to steps
            dx_steps = self.cmd.mm_to_steps(dx)
            dy_steps = self.cmd.mm_to_steps(dy)

            # Send movement command
            await self.cmd.move_relative_steps(dx_steps, dy_steps, duration_ms)

            # Update position
            self._current_x = cmd.x
            self._current_y = cmd.y

            # Wait for motion (simple delay based on duration)
            await asyncio.sleep(duration_ms / 1000)

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
