"""EBB command abstraction for iDraw 2.0 plotter."""

import asyncio
from typing import Optional
from core.plotter.connection import PlotterConnection
from core.plotter.errors import PlotterError
from models.plotter import PenState
import logging

logger = logging.getLogger(__name__)


class EBBCommands:
    """High-level EBB command interface for iDraw 2.0."""

    # Motor resolution: steps per mm (iDraw 2.0 default)
    STEPS_PER_MM = 80

    # Pen servo timing (derived from iDraw config)
    # Pen heights in mm converted to servo positions
    PEN_UP_DEFAULT = 0.5  # mm
    PEN_DOWN_DEFAULT = 5.0  # mm

    def __init__(self, connection: PlotterConnection):
        self.conn = connection
        self._pen_state = PenState.UNKNOWN
        self._pen_up_height = self.PEN_UP_DEFAULT
        self._pen_down_height = self.PEN_DOWN_DEFAULT

    async def get_version(self) -> str:
        """Query firmware version."""
        return await self.conn.send_command("V")

    async def pen_up(self, delay_ms: int = 300):
        """
        Raise the pen.

        Args:
            delay_ms: Time to wait for servo movement
        """
        # SP command: SP,value,duration
        # For iDraw, we use height-based positioning
        await self.conn.send_command(f"SP,0,{delay_ms}")
        self._pen_state = PenState.UP
        await asyncio.sleep(delay_ms / 1000)

    async def pen_down(self, delay_ms: int = 300):
        """
        Lower the pen.

        Args:
            delay_ms: Time to wait for servo movement
        """
        await self.conn.send_command(f"SP,1,{delay_ms}")
        self._pen_state = PenState.DOWN
        await asyncio.sleep(delay_ms / 1000)

    async def set_pen_heights(self, up_height_mm: float, down_height_mm: float):
        """Configure pen heights."""
        self._pen_up_height = up_height_mm
        self._pen_down_height = down_height_mm
        # Note: iDraw uses SC commands to set servo positions
        # The exact mapping depends on hardware calibration

    @property
    def pen_state(self) -> PenState:
        """Get current pen state."""
        return self._pen_state

    async def enable_motors(self, microstep_mode: int = 1):
        """
        Enable stepper motors.

        Args:
            microstep_mode: 1=1/16, 2=1/8, 3=1/4, 4=1/2, 5=full step
        """
        await self.conn.send_command(f"EM,{microstep_mode},{microstep_mode}")
        logger.info("Motors enabled")

    async def disable_motors(self):
        """Disable stepper motors (allows manual movement)."""
        await self.conn.send_command("EM,0,0")
        logger.info("Motors disabled")

    async def move_relative(self, dx_mm: float, dy_mm: float, duration_ms: int):
        """
        Move relative to current position.

        Args:
            dx_mm: X displacement in mm
            dy_mm: Y displacement in mm
            duration_ms: Movement duration in milliseconds
        """
        # Convert mm to steps
        dx_steps = int(dx_mm * self.STEPS_PER_MM)
        dy_steps = int(dy_mm * self.STEPS_PER_MM)

        # SM command: SM,duration,axis1_steps,axis2_steps
        # Note: axis mapping may need adjustment based on iDraw orientation
        await self.conn.send_command(f"SM,{duration_ms},{dy_steps},{dx_steps}")

    async def move_relative_steps(self, dx_steps: int, dy_steps: int, duration_ms: int):
        """
        Move relative to current position in motor steps.

        Args:
            dx_steps: X displacement in steps
            dy_steps: Y displacement in steps
            duration_ms: Movement duration in milliseconds
        """
        await self.conn.send_command(f"SM,{duration_ms},{dy_steps},{dx_steps}")

    async def query_motors(self) -> dict:
        """Query motor status."""
        response = await self.conn.send_command("QM")
        # Response format varies by firmware
        return {"raw": response}

    async def query_status(self) -> dict:
        """Query general status byte."""
        response = await self.conn.send_command("QG")
        try:
            # First line contains status byte as decimal or hex
            status_str = response.split("\r\n")[0].strip()
            status_byte = int(status_str)
            return {
                "motor1_moving": bool(status_byte & 0x01),
                "motor2_moving": bool(status_byte & 0x02),
                "command_executing": bool(status_byte & 0x04),
                "fifo_empty": bool(status_byte & 0x08),
            }
        except (ValueError, IndexError):
            return {"raw": response}

    async def emergency_stop(self):
        """Emergency stop - halt all motion immediately."""
        await self.conn.send_command("ES,1")
        await self.pen_up(100)  # Quick pen lift
        logger.warning("Emergency stop executed")

    async def home(self, timeout: float = 30.0):
        """
        Move to home position using limit switches.

        Note: iDraw 2.0 has contact switches for auto-homing.

        Args:
            timeout: Maximum time to wait for homing completion

        Raises:
            PlotterError: PLT-M001 if homing fails or times out
        """
        try:
            # HM command with rate
            await self.conn.send_command("HM,4000")
            logger.info("Homing initiated")

            # Wait for homing to complete
            start_time = asyncio.get_event_loop().time()
            while True:
                status = await self.query_status()
                if status.get("fifo_empty", True) and not status.get("command_executing", False):
                    break

                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed > timeout:
                    raise PlotterError("PLT-M001", context={"timeout": timeout, "elapsed": elapsed})

                await asyncio.sleep(0.1)

            logger.info("Homing completed")
        except PlotterError:
            raise
        except Exception as e:
            raise PlotterError("PLT-M001", context={"error": str(e)}, cause=e)

    async def wait_for_completion(self, timeout: float = 60.0):
        """Wait for all queued commands to complete.

        Raises:
            PlotterError: PLT-M002 if motion times out
        """
        start_time = asyncio.get_event_loop().time()

        while True:
            status = await self.query_status()
            if status.get("fifo_empty", True) and not status.get("command_executing", False):
                break

            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > timeout:
                raise PlotterError("PLT-M002", context={"timeout": timeout, "elapsed": elapsed})

            await asyncio.sleep(0.05)

    async def configure_acceleration(self, rate: int = 2):
        """
        Configure acceleration rate.

        Args:
            rate: Acceleration rate (1-5, higher = slower acceleration)
        """
        # SC,11,rate sets acceleration rate
        await self.conn.send_command(f"SC,11,{rate}")

    def mm_to_steps(self, mm: float) -> int:
        """Convert millimeters to motor steps."""
        return int(mm * self.STEPS_PER_MM)

    def steps_to_mm(self, steps: int) -> float:
        """Convert motor steps to millimeters."""
        return steps / self.STEPS_PER_MM

    # ============= Calibration Methods =============

    async def move_to_position(self, x_mm: float, y_mm: float, speed_mm_s: float = 50.0):
        """
        Move to an absolute position (relative to home) for calibration.
        Pen must be up before calling this method.

        Args:
            x_mm: Target X position in mm
            y_mm: Target Y position in mm
            speed_mm_s: Movement speed in mm/s
        """
        import math

        # Calculate distance for duration
        distance = math.sqrt(x_mm ** 2 + y_mm ** 2)
        if distance < 0.1:
            return  # Already at position

        duration_ms = max(int((distance / speed_mm_s) * 1000), 50)

        # Convert to steps
        dx_steps = int(x_mm * self.STEPS_PER_MM)
        dy_steps = int(y_mm * self.STEPS_PER_MM)

        await self.conn.send_command(f"SM,{duration_ms},{dy_steps},{dx_steps}")
        await asyncio.sleep(duration_ms / 1000 + 0.1)  # Wait for movement + buffer
        logger.info(f"Moved to position ({x_mm}, {y_mm}) mm")

    async def draw_test_pattern(self, size_mm: float = 10.0, speed_mm_s: float = 30.0):
        """
        Draw a small test pattern for calibration verification.
        Pattern: square with X diagonals.

        Args:
            size_mm: Size of the test pattern square in mm
            speed_mm_s: Drawing speed in mm/s
        """
        import math

        def calc_duration(distance: float) -> int:
            return max(int((distance / speed_mm_s) * 1000), 50)

        # Draw square (pen already at start position)
        await self.pen_down()

        # Right
        await self.move_relative(size_mm, 0, calc_duration(size_mm))
        await asyncio.sleep(calc_duration(size_mm) / 1000 + 0.05)

        # Down
        await self.move_relative(0, size_mm, calc_duration(size_mm))
        await asyncio.sleep(calc_duration(size_mm) / 1000 + 0.05)

        # Left
        await self.move_relative(-size_mm, 0, calc_duration(size_mm))
        await asyncio.sleep(calc_duration(size_mm) / 1000 + 0.05)

        # Up (back to start)
        await self.move_relative(0, -size_mm, calc_duration(size_mm))
        await asyncio.sleep(calc_duration(size_mm) / 1000 + 0.05)

        await self.pen_up()

        # Draw first diagonal (top-left to bottom-right)
        await self.pen_down()
        diagonal = math.sqrt(2) * size_mm
        await self.move_relative(size_mm, size_mm, calc_duration(diagonal))
        await asyncio.sleep(calc_duration(diagonal) / 1000 + 0.05)
        await self.pen_up()

        # Move to top-right corner
        await self.move_relative(0, -size_mm, calc_duration(size_mm))
        await asyncio.sleep(calc_duration(size_mm) / 1000 + 0.05)

        # Draw second diagonal (top-right to bottom-left)
        await self.pen_down()
        await self.move_relative(-size_mm, size_mm, calc_duration(diagonal))
        await asyncio.sleep(calc_duration(diagonal) / 1000 + 0.05)
        await self.pen_up()

        # Return to start position (top-left)
        await self.move_relative(0, -size_mm, calc_duration(size_mm))
        await asyncio.sleep(calc_duration(size_mm) / 1000 + 0.05)

        logger.info(f"Test pattern drawn ({size_mm}mm square with X)")

    # ============= Hardware Status Methods =============

    async def query_voltage(self) -> bool:
        """
        Query voltage status to check if power supply is connected.

        Based on AxiDraw ebb_motion.queryVoltage() implementation.

        Returns:
            True if voltage is OK, False if low voltage detected

        Note: This queries the RA (Read Analog) command for motor power supply.
        """
        try:
            # QC command returns comma-separated values including voltage
            # We can also use RA to read analog input
            response = await self.conn.send_command("QC")
            # Parse response - format varies but includes voltage reading
            # If voltage is below threshold, return False
            parts = response.split(",")
            if len(parts) >= 2:
                try:
                    # The second value is typically the motor voltage
                    voltage_raw = int(parts[1])
                    # Threshold based on AxiDraw - ~8V minimum for motors
                    # Raw value is ADC reading, typically ~300+ is OK
                    return voltage_raw > 200
                except (ValueError, IndexError):
                    pass
            return True  # Assume OK if can't parse
        except Exception:
            return True  # Assume OK on query error

    async def query_pause_button(self) -> int:
        """
        Query the physical pause button state.

        Returns:
            1 if button pressed, 0 if not pressed, -1 on error
        """
        try:
            # QB command queries button state
            response = await self.conn.send_command("QB")
            # Response is typically "0\r\n" or "1\r\n"
            button_state = response.split("\r")[0].strip()
            return int(button_state)
        except Exception:
            return -1

    async def check_for_pause_button(self) -> bool:
        """
        Check if pause button was pressed.

        Returns:
            True if button was pressed

        Raises:
            PlotterError: PLT-U001 if button pressed, PLT-C004 if connection lost
        """
        result = await self.query_pause_button()
        if result == -1:
            # Connection lost
            raise PlotterError("PLT-C004", context={"source": "pause_button_query"})
        elif result == 1:
            raise PlotterError("PLT-U001")
        return False

    async def check_voltage(self):
        """
        Check voltage and raise warning if low.

        Raises:
            PlotterError: PLT-W001 if low voltage detected
        """
        if not await self.query_voltage():
            raise PlotterError("PLT-W001")
