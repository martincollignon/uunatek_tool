"""GRBL command abstraction for iDraw 2.0 plotter with DrawCore firmware.

This module provides a high-level interface to the GRBL-based DrawCore firmware
used by the iDraw 2.0 pen plotter. It replaces the EBB protocol commands with
equivalent GRBL G-code commands.

Key differences from EBB:
- Pen control uses Z-axis: Z0 = UP, Z5 = DOWN (inverted from typical CNC)
- Movement uses absolute coordinates with feed rate (mm/min)
- Status queries return detailed state information
- Does NOT support G2/G3 arc commands (use linear segments)

References:
- https://github.com/bbaudry/swart-studio/blob/main/penplotting/README.md
- https://github.com/gnea/grbl/wiki/Grbl-v1.1-Commands
"""

import asyncio
import re
from typing import Optional, Tuple
from dataclasses import dataclass
from core.plotter.connection import PlotterConnection
from core.plotter.errors import PlotterError
from models.plotter import PenState
import logging

logger = logging.getLogger(__name__)


@dataclass
class GRBLStatus:
    """Parsed GRBL status response."""
    state: str  # Idle, Run, Hold, Jog, Alarm, Door, Check, Home, Sleep
    machine_x: float
    machine_y: float
    machine_z: float
    feed_rate: float = 0.0
    spindle_speed: float = 0.0
    work_x: Optional[float] = None
    work_y: Optional[float] = None
    work_z: Optional[float] = None
    pins: Optional[str] = None  # Triggered pin states


class GRBLCommands:
    """High-level GRBL command interface for iDraw 2.0 with DrawCore firmware.

    The DrawCore firmware uses GRBL 1.1h with some specific behaviors:
    - Pen up/down is controlled via Z-axis (Z0=up, Z5=down)
    - Speed range is F50-F2500 mm/min
    - G2/G3 arc commands are NOT supported
    """

    # Pen heights (Z-axis positions in mm)
    # NOTE: Z-axis is INVERTED on DrawCore - Z0 is UP, higher Z is DOWN
    PEN_UP_Z = 0.0      # Z position for pen up
    PEN_DOWN_Z = 5.0    # Z position for pen down

    # Machine limits (from GRBL $130/$131 settings - verified empirically)
    MAX_X_MM = 297.0  # A3 width in mm (GRBL $130=297)
    MAX_Y_MM = 420.0  # A3 height in mm (GRBL $131=420)
    MIN_Y_MM = -420.0 # Front edge of bed (A3 paper extends to Y=-420)
    MAX_Z_MM = 10.0

    # Speed limits (mm/min) - from DrawCore documentation
    MAX_FEED_RATE = 2500.0   # Maximum speed
    MIN_FEED_RATE = 50.0     # Minimum speed
    DEFAULT_RAPID_SPEED = 2500.0    # For G00 moves (pen up travel)
    DEFAULT_DRAW_SPEED = 2000.0     # For G01 moves (pen down drawing)

    def __init__(self, connection: PlotterConnection):
        self.conn = connection
        self._pen_state = PenState.UNKNOWN
        self._current_x = 0.0
        self._current_y = 0.0
        self._current_z = 0.0
        self._is_absolute = True  # G90 mode
        self._is_initialized = False

    # === Initialization ===

    async def initialize(self):
        """Initialize GRBL controller after connection.

        Sets up:
        - G21: Millimeter units
        - G90: Absolute positioning mode
        - G17: XY plane selection
        - Syncs current position from status query
        """
        # Set millimeter units
        await self._send_gcode("G21")

        # Set absolute positioning mode
        await self._send_gcode("G90")
        self._is_absolute = True

        # Set XY plane
        await self._send_gcode("G17")

        # Query current position
        status = await self.query_status()
        self._current_x = status.machine_x
        self._current_y = status.machine_y
        self._current_z = status.machine_z

        # Determine pen state from Z position
        if self._current_z <= self.PEN_UP_Z + 0.5:
            self._pen_state = PenState.UP
        else:
            self._pen_state = PenState.DOWN

        self._is_initialized = True
        logger.info(f"GRBL initialized at position ({self._current_x}, {self._current_y}, {self._current_z})")

    async def get_version(self) -> str:
        """Query firmware version.

        Returns:
            Firmware version string like "Grbl 1.1h DrawCore V2.09"
        """
        response = await self.conn.send_command("$I")
        return response

    # === Pen Control ===

    async def pen_up(self, delay_ms: int = 300):
        """Raise the pen using Z-axis movement.

        Args:
            delay_ms: Ignored for GRBL (provided for API compatibility)
        """
        await self._send_gcode(f"G00 Z{self.PEN_UP_Z}")
        self._pen_state = PenState.UP
        self._current_z = self.PEN_UP_Z
        # Wait for movement completion
        await self._wait_for_idle(timeout=5.0)

    async def pen_down(self, delay_ms: int = 300):
        """Lower the pen using Z-axis movement.

        On DrawCore, pen down uses higher Z values (Z5).

        Args:
            delay_ms: Ignored for GRBL (provided for API compatibility)
        """
        await self._send_gcode(f"G00 Z{self.PEN_DOWN_Z}")
        self._pen_state = PenState.DOWN
        self._current_z = self.PEN_DOWN_Z
        # Wait for movement completion
        await self._wait_for_idle(timeout=5.0)

    async def set_pen_heights(self, up_height_mm: float, down_height_mm: float):
        """Configure pen heights.

        Args:
            up_height_mm: Z position for pen up
            down_height_mm: Z position for pen down
        """
        self.PEN_UP_Z = up_height_mm
        self.PEN_DOWN_Z = down_height_mm
        logger.info(f"Pen heights set: up={up_height_mm}mm, down={down_height_mm}mm")

    @property
    def pen_state(self) -> PenState:
        """Get current pen state."""
        return self._pen_state

    # === Motor Control ===

    async def enable_motors(self, microstep_mode: int = 1):
        """Enable stepper motors (unlock if in alarm state).

        Args:
            microstep_mode: Ignored for GRBL (provided for API compatibility)
        """
        # Clear any alarm state with $X (kill alarm lock)
        await self.conn.send_command("$X")
        logger.info("Motors enabled (GRBL unlocked)")

    async def disable_motors(self):
        """Disable stepper motors (allows manual movement)."""
        # M18 disables steppers on most GRBL implementations
        # Some use $SLP for sleep mode
        try:
            await self._send_gcode("M18")
        except PlotterError:
            # If M18 not supported, try sleep mode
            await self.conn.send_command("$SLP")
        logger.info("Motors disabled")

    # === Movement ===

    async def move_absolute(self, x_mm: float, y_mm: float, feed_rate: Optional[float] = None):
        """Move to absolute position.

        Args:
            x_mm: Target X position in mm
            y_mm: Target Y position in mm
            feed_rate: Feed rate in mm/min. If None, uses G00 rapid move.
        """
        # Clamp to machine limits
        # Note: Y can be negative (front of bed is negative Y)
        x_mm = max(0, min(x_mm, self.MAX_X_MM))
        y_mm = max(self.MIN_Y_MM, min(y_mm, self.MAX_Y_MM))

        if feed_rate is None:
            # Rapid move (G00) - maximum speed, no feed rate parameter
            await self._send_gcode(f"G00 X{x_mm:.3f} Y{y_mm:.3f}")
        else:
            # Linear move (G01) with feed rate
            feed_rate = max(self.MIN_FEED_RATE, min(feed_rate, self.MAX_FEED_RATE))
            await self._send_gcode(f"G01 X{x_mm:.3f} Y{y_mm:.3f} F{feed_rate:.1f}")

        self._current_x = x_mm
        self._current_y = y_mm

    async def move_relative(self, dx_mm: float, dy_mm: float, duration_ms: int):
        """Move relative to current position.

        Provided for API compatibility with EBB interface.
        Converts duration to feed rate.

        Args:
            dx_mm: X displacement in mm
            dy_mm: Y displacement in mm
            duration_ms: Target duration in ms (converted to feed rate)
        """
        import math

        # Calculate target position
        target_x = self._current_x + dx_mm
        target_y = self._current_y + dy_mm

        # Calculate distance and required feed rate
        distance = math.sqrt(dx_mm * dx_mm + dy_mm * dy_mm)
        if distance > 0.01 and duration_ms > 0:
            # Convert duration to feed rate: F = distance / (duration/60000) mm/min
            feed_rate = (distance * 60000) / duration_ms
            feed_rate = max(self.MIN_FEED_RATE, min(feed_rate, self.MAX_FEED_RATE))
        else:
            feed_rate = self.DEFAULT_DRAW_SPEED

        await self.move_absolute(target_x, target_y, feed_rate)

    async def move_relative_steps(self, dx_steps: int, dy_steps: int, duration_ms: int):
        """Move relative using step counts (EBB compatibility).

        Converts steps to mm using standard steps/mm ratio.

        Args:
            dx_steps: X displacement in motor steps
            dy_steps: Y displacement in motor steps
            duration_ms: Target duration in ms
        """
        STEPS_PER_MM = 80  # Standard for iDraw 2.0 (from GRBL $100/$101)
        dx_mm = dx_steps / STEPS_PER_MM
        dy_mm = dy_steps / STEPS_PER_MM
        await self.move_relative(dx_mm, dy_mm, duration_ms)

    # === Status and Queries ===

    async def query_status(self) -> GRBLStatus:
        """Query GRBL status.

        Sends the ? real-time command and parses the response.

        Returns:
            GRBLStatus with current machine state and position
        """
        response = await self.conn.send_command("?")
        return self._parse_status_response(response)

    def _parse_status_response(self, response: str) -> GRBLStatus:
        """Parse GRBL status response string.

        Format: <Idle|MPos:100.000,50.000,5.000|FS:0,0|WCO:0,0,0>

        Args:
            response: Raw status response string

        Returns:
            Parsed GRBLStatus object
        """
        state = "Unknown"
        mx, my, mz = 0.0, 0.0, 0.0
        wx, wy, wz = None, None, None
        feed = 0.0
        spindle = 0.0
        pins = None

        # Extract state
        state_match = re.search(r'<(\w+)\|', response)
        if state_match:
            state = state_match.group(1)

        # Extract machine position
        mpos_match = re.search(r'MPos:([-\d.]+),([-\d.]+),([-\d.]+)', response)
        if mpos_match:
            mx = float(mpos_match.group(1))
            my = float(mpos_match.group(2))
            mz = float(mpos_match.group(3))

        # Extract work position (if present instead of MPos)
        wpos_match = re.search(r'WPos:([-\d.]+),([-\d.]+),([-\d.]+)', response)
        if wpos_match:
            wx = float(wpos_match.group(1))
            wy = float(wpos_match.group(2))
            wz = float(wpos_match.group(3))

        # Extract feed rate and spindle speed
        fs_match = re.search(r'FS:(\d+),(\d+)', response)
        if fs_match:
            feed = float(fs_match.group(1))
            spindle = float(fs_match.group(2))

        # Extract pin states
        pn_match = re.search(r'Pn:([XYZPDHRS]+)', response)
        if pn_match:
            pins = pn_match.group(1)

        return GRBLStatus(
            state=state,
            machine_x=mx,
            machine_y=my,
            machine_z=mz,
            feed_rate=feed,
            spindle_speed=spindle,
            work_x=wx,
            work_y=wy,
            work_z=wz,
            pins=pins
        )

    async def query_motors(self) -> dict:
        """Query motor status (EBB compatibility).

        Returns status query result.
        """
        status = await self.query_status()
        return {
            "state": status.state,
            "x": status.machine_x,
            "y": status.machine_y,
            "z": status.machine_z,
            "feed_rate": status.feed_rate,
        }

    async def is_idle(self) -> bool:
        """Check if controller is idle."""
        status = await self.query_status()
        return status.state == "Idle"

    async def _wait_for_idle(self, timeout: float = 60.0):
        """Wait for GRBL to become idle.

        Args:
            timeout: Maximum time to wait in seconds

        Raises:
            PlotterError: PLT-M002 if timeout exceeded
        """
        start = asyncio.get_event_loop().time()
        while True:
            status = await self.query_status()
            if status.state == "Idle":
                return
            if status.state == "Alarm":
                raise PlotterError("PLT-G001", context={
                    "alarm_state": status.state,
                    "position": (status.machine_x, status.machine_y, status.machine_z)
                })
            elapsed = asyncio.get_event_loop().time() - start
            if elapsed > timeout:
                raise PlotterError("PLT-M002", context={"timeout": timeout, "elapsed": elapsed})
            await asyncio.sleep(0.05)

    async def wait_for_completion(self, timeout: float = 60.0):
        """Wait for all movements to complete.

        Args:
            timeout: Maximum time to wait in seconds
        """
        await self._wait_for_idle(timeout)

    # === Homing ===

    async def home(self, timeout: float = 30.0):
        """Execute GRBL homing cycle.

        Args:
            timeout: Maximum time to wait for homing completion

        Raises:
            PlotterError: PLT-M001 if homing fails
        """
        try:
            await self.conn.send_command("$H")
            await self._wait_for_idle(timeout)

            # After homing, sync position
            status = await self.query_status()
            self._current_x = status.machine_x
            self._current_y = status.machine_y
            self._current_z = status.machine_z

            # Assume pen is up after homing
            self._pen_state = PenState.UP

            logger.info(f"Homing completed at ({self._current_x}, {self._current_y}, {self._current_z})")
        except PlotterError as e:
            if e.code == "PLT-G001":
                # Re-raise alarm errors with homing context
                raise PlotterError("PLT-M001", context={"error": str(e), "phase": "homing"}, cause=e)
            raise
        except Exception as e:
            raise PlotterError("PLT-M001", context={"error": str(e)}, cause=e)

    # === Emergency Stop ===

    async def emergency_stop(self):
        """Emergency stop - halt all motion immediately.

        Sends feed hold (!) followed by soft reset (Ctrl-X).
        """
        # Send feed hold (immediate stop) - real-time command
        await self.conn.send_command_no_response("!")
        await asyncio.sleep(0.1)

        # Soft reset (Ctrl-X = 0x18)
        await self.conn.send_command_no_response("\x18")
        await asyncio.sleep(0.5)

        # Clear alarm state
        try:
            await self.conn.send_command("$X")
        except Exception:
            pass  # May fail if in certain states

        logger.warning("Emergency stop executed")

    # === Internal Helpers ===

    async def _send_gcode(self, gcode: str, timeout: float = 5.0) -> str:
        """Send G-code command and handle GRBL response.

        Args:
            gcode: G-code command to send
            timeout: Response timeout in seconds

        Returns:
            Response string (usually "ok")

        Raises:
            PlotterError: PLT-X003 on GRBL error, PLT-G001 on alarm
        """
        response = await self.conn.send_command(gcode, timeout)

        # Check for error response
        if "error:" in response.lower():
            error_match = re.search(r'error:(\d+)', response.lower())
            error_code = error_match.group(1) if error_match else "unknown"
            raise PlotterError("PLT-X003", context={
                "gcode": gcode,
                "grbl_error": error_code,
                "response": response
            })

        # Check for alarm
        if "ALARM" in response.upper():
            alarm_match = re.search(r'ALARM:(\d+)', response.upper())
            alarm_code = alarm_match.group(1) if alarm_match else "unknown"
            raise PlotterError("PLT-G001", context={
                "gcode": gcode,
                "alarm": alarm_code,
                "response": response
            })

        return response

    # === Utility ===

    def mm_to_steps(self, mm: float) -> int:
        """Convert millimeters to motor steps (for compatibility).

        Args:
            mm: Distance in millimeters

        Returns:
            Equivalent motor steps
        """
        return int(mm * 80)  # STEPS_PER_MM = 80 (standard iDraw 2.0)

    def steps_to_mm(self, steps: int) -> float:
        """Convert motor steps to millimeters.

        Args:
            steps: Motor steps

        Returns:
            Distance in millimeters
        """
        return steps / 80.0

    @property
    def current_position(self) -> Tuple[float, float]:
        """Get current X, Y position in mm."""
        return (self._current_x, self._current_y)

    # === Calibration Methods (API compatibility) ===

    async def move_to_position(self, x_mm: float, y_mm: float, speed_mm_s: float = 50.0):
        """Move to position for calibration.

        Args:
            x_mm: Target X position in mm
            y_mm: Target Y position in mm
            speed_mm_s: Speed in mm/s (converted to mm/min)
        """
        feed_rate = speed_mm_s * 60  # Convert mm/s to mm/min
        await self.move_absolute(x_mm, y_mm, feed_rate)
        await self._wait_for_idle()
        logger.info(f"Moved to position ({x_mm}, {y_mm}) mm")

    async def draw_test_pattern(self, size_mm: float = 10.0, speed_mm_s: float = 30.0):
        """Draw test pattern (square with X diagonals).

        Args:
            size_mm: Size of the test pattern square in mm
            speed_mm_s: Drawing speed in mm/s
        """
        feed_rate = speed_mm_s * 60  # mm/min
        start_x, start_y = self._current_x, self._current_y

        # Draw square
        await self.pen_down()

        # Right
        await self.move_absolute(start_x + size_mm, start_y, feed_rate)
        await self._wait_for_idle()

        # Down
        await self.move_absolute(start_x + size_mm, start_y + size_mm, feed_rate)
        await self._wait_for_idle()

        # Left
        await self.move_absolute(start_x, start_y + size_mm, feed_rate)
        await self._wait_for_idle()

        # Up (back to start)
        await self.move_absolute(start_x, start_y, feed_rate)
        await self._wait_for_idle()

        await self.pen_up()

        # Draw first diagonal (top-left to bottom-right)
        await self.pen_down()
        await self.move_absolute(start_x + size_mm, start_y + size_mm, feed_rate)
        await self._wait_for_idle()
        await self.pen_up()

        # Move to top-right corner
        await self.move_absolute(start_x + size_mm, start_y, None)  # Rapid
        await self._wait_for_idle()

        # Draw second diagonal (top-right to bottom-left)
        await self.pen_down()
        await self.move_absolute(start_x, start_y + size_mm, feed_rate)
        await self._wait_for_idle()
        await self.pen_up()

        # Return to start position
        await self.move_absolute(start_x, start_y, None)  # Rapid
        await self._wait_for_idle()

        logger.info(f"Test pattern drawn ({size_mm}mm square with X)")

    # === Hardware Status (stub methods for EBB compatibility) ===

    async def query_voltage(self) -> bool:
        """Query voltage - GRBL doesn't have direct voltage query.

        Returns:
            True (always, as GRBL can't check voltage)
        """
        return True  # Assume OK - GRBL has no voltage monitoring

    async def query_pause_button(self) -> int:
        """Query pause button state via Hold state check.

        Returns:
            1 if in Hold state, 0 otherwise, -1 on error
        """
        try:
            status = await self.query_status()
            return 1 if status.state == "Hold" else 0
        except Exception:
            return -1

    async def check_for_pause_button(self) -> bool:
        """Check if pause was triggered (Hold state).

        Returns:
            False if not paused

        Raises:
            PlotterError: PLT-U001 if in Hold state
        """
        result = await self.query_pause_button()
        if result == 1:
            raise PlotterError("PLT-U001")
        return False

    async def check_voltage(self):
        """Check voltage - no-op for GRBL."""
        pass  # GRBL doesn't support voltage monitoring

    async def configure_acceleration(self, rate: int = 2):
        """Configure acceleration - would need GRBL $120/$121 settings.

        Note: GRBL acceleration is set via EEPROM parameters, not runtime commands.
        This is a no-op to maintain API compatibility.
        """
        # GRBL acceleration is set via $120 (X), $121 (Y), $122 (Z) in EEPROM
        # Runtime configuration not typically done
        pass
