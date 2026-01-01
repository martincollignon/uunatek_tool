"""Serial connection management for GRBL-based plotters (iDraw 2.0 with DrawCore).

This module handles serial communication with the iDraw 2.0 pen plotter using
the DrawCore firmware (GRBL-based). It supports both GRBL and legacy EBB protocols.

GRBL Response Formats:
- "ok" - Command accepted
- "error:X" - Error with code X
- "<Idle|MPos:...>" - Status query response
- "ALARM:X" - Alarm triggered

References:
- https://github.com/gnea/grbl/wiki/Grbl-v1.1-Commands
"""

import asyncio
import serial
import serial.tools.list_ports
from typing import Optional
from contextlib import asynccontextmanager
import logging
import errno

from .errors import PlotterError

logger = logging.getLogger(__name__)


class PlotterConnection:
    """Manage serial connection to GRBL-based plotter (iDraw 2.0 with DrawCore)."""

    # USB identifiers for supported devices
    SUPPORTED_DEVICES = [
        {"vid": 0x1A86, "pid": 0x7523, "name": "CH340"},  # iDraw CH340
        {"vid": 0x1A86, "pid": 0x8040, "name": "CH340K"},  # iDraw CH340K
        {"vid": 0x04D8, "pid": 0xFD92, "name": "EiBotBoard"},  # AxiDraw
    ]

    BAUD_RATE = 115200
    TIMEOUT = 1.0

    def __init__(self):
        self._serial: Optional[serial.Serial] = None
        self._lock = asyncio.Lock()
        self._port_name: Optional[str] = None

    @classmethod
    def list_available_ports(cls) -> list[dict]:
        """List available serial ports, highlighting compatible devices."""
        ports = []
        for port in serial.tools.list_ports.comports():
            is_compatible = False
            device_name = None

            for device in cls.SUPPORTED_DEVICES:
                if port.vid == device["vid"] and port.pid == device["pid"]:
                    is_compatible = True
                    device_name = device["name"]
                    break

            ports.append({
                "device": port.device,
                "description": port.description,
                "hwid": port.hwid,
                "is_compatible": is_compatible,
                "device_name": device_name,
            })

        return ports

    @classmethod
    def find_plotter_port(cls) -> Optional[str]:
        """Auto-detect plotter port."""
        for port in serial.tools.list_ports.comports():
            for device in cls.SUPPORTED_DEVICES:
                if port.vid == device["vid"] and port.pid == device["pid"]:
                    logger.info(f"Found {device['name']} on {port.device}")
                    return port.device
        return None

    @property
    def is_connected(self) -> bool:
        """Check if connected to plotter."""
        if self._serial is None:
            return False

        # Check if port is open
        if not self._serial.is_open:
            return False

        # Additional check: verify the serial port still exists
        try:
            # On macOS/Linux, check if the device file still exists
            import os
            if hasattr(self._serial, 'port') and self._serial.port:
                if not os.path.exists(self._serial.port):
                    # Device was unplugged
                    self._serial = None
                    self._port_name = None
                    return False
        except Exception:
            # If we can't verify, assume it's still connected
            pass

        return True

    @property
    def port_name(self) -> Optional[str]:
        """Get current port name."""
        return self._port_name

    async def connect(self, port: Optional[str] = None) -> bool:
        """
        Connect to the plotter.

        Args:
            port: Serial port path. Auto-detects if not provided.

        Returns:
            True if connection successful.

        Raises:
            PlotterError: If connection fails with specific error code.
        """
        async with self._lock:
            if self.is_connected:
                return True

            port = port or self.find_plotter_port()
            if not port:
                raise PlotterError("PLT-C001", context={"searched_ports": len(self.list_available_ports())})

            try:
                self._serial = serial.Serial(
                    port=port,
                    baudrate=self.BAUD_RATE,
                    timeout=self.TIMEOUT,
                    write_timeout=self.TIMEOUT,
                )
                self._port_name = port

                # Verify connection - try GRBL $I first, then fall back to EBB V
                try:
                    # Try GRBL identification first
                    version = await self._send_command_locked("$I", timeout=3.0)
                    if not version:
                        # Fall back to EBB version command
                        version = await self._send_command_locked("V", timeout=3.0)
                    if not version:
                        self._serial.close()
                        self._serial = None
                        self._port_name = None
                        raise PlotterError("PLT-C005", context={"port": port})
                except PlotterError:
                    # If $I fails, try V command (for EBB compatibility)
                    try:
                        version = await self._send_command_locked("V", timeout=3.0)
                    except Exception:
                        self._serial.close()
                        self._serial = None
                        self._port_name = None
                        raise PlotterError("PLT-C005", context={"port": port})
                except TimeoutError:
                    self._serial.close()
                    self._serial = None
                    self._port_name = None
                    raise PlotterError("PLT-C005", context={"port": port})

                logger.info(f"Connected to plotter on {port}: {version}")
                return True

            except serial.SerialException as e:
                self._serial = None
                self._port_name = None

                # Map serial exceptions to specific error codes
                error_msg = str(e).lower()
                if "permission" in error_msg or "access" in error_msg:
                    raise PlotterError("PLT-C003", context={"port": port, "error": str(e)}, cause=e)
                elif "busy" in error_msg or "in use" in error_msg or "resource" in error_msg:
                    raise PlotterError("PLT-C002", context={"port": port, "error": str(e)}, cause=e)
                else:
                    raise PlotterError("PLT-C001", context={"port": port, "error": str(e)}, cause=e)
            except PlotterError:
                raise
            except Exception as e:
                self._serial = None
                self._port_name = None
                raise PlotterError("PLT-C001", context={"port": port, "error": str(e)}, cause=e)

    async def disconnect(self):
        """Disconnect from the plotter."""
        async with self._lock:
            if self._serial:
                try:
                    self._serial.close()
                except Exception as e:
                    logger.warning(f"Error closing serial port: {e}")
                finally:
                    self._serial = None
                    self._port_name = None

    async def send_command(self, command: str, timeout: float = 5.0) -> str:
        """
        Send command and wait for response.

        Args:
            command: EBB command string (without CR)
            timeout: Response timeout in seconds

        Returns:
            Response string from plotter

        Raises:
            PlotterError: If not connected, disconnected, or times out
        """
        async with self._lock:
            return await self._send_command_locked(command, timeout)

    async def _send_command_locked(self, command: str, timeout: float = 5.0) -> str:
        """Send command (must hold lock).

        Supports both GRBL and EBB response formats:
        - GRBL: "ok", "error:X", "<State|...>", "ALARM:X"
        - EBB: ends with "\\r\\n" or "OK\\r\\n"
        """
        if not self._serial or not self._serial.is_open:
            raise PlotterError("PLT-C004", context={"command": command})

        # Determine command type for response parsing
        is_grbl_status_query = command == "?"
        is_grbl_realtime = command in ["?", "!", "~", "\x18"]  # Real-time commands don't need newline
        is_grbl_command = command.startswith("$") or command.startswith("G") or command.startswith("M") or is_grbl_realtime

        try:
            # Clear any pending input
            self._serial.reset_input_buffer()

            # Send command with appropriate line ending
            # Real-time commands (?, !, ~) don't need terminator
            # GRBL uses \n, EBB uses \r
            if is_grbl_realtime:
                cmd_bytes = command.encode("ascii")
            elif is_grbl_command:
                cmd_bytes = f"{command}\n".encode("ascii")
            else:
                cmd_bytes = f"{command}\r".encode("ascii")
            self._serial.write(cmd_bytes)
            logger.debug(f"Sent: {repr(command)}")

        except serial.SerialException as e:
            # Device disconnected during write
            logger.error(f"Serial exception during write. Command: {command}, Error: {e}")
            self._serial = None
            self._port_name = None
            raise PlotterError("PLT-C004", context={"command": command, "phase": "write", "error": str(e)}, cause=e)
        except OSError as e:
            # Handle OS-level disconnection errors
            if e.errno in (errno.EIO, errno.ENODEV, errno.ENOENT):
                self._serial = None
                self._port_name = None
                raise PlotterError("PLT-C004", context={"command": command, "phase": "write"}, cause=e)
            raise

        # Read response
        response = ""
        start_time = asyncio.get_event_loop().time()

        try:
            while True:
                if self._serial.in_waiting > 0:
                    chunk = self._serial.read(self._serial.in_waiting).decode("ascii", errors="ignore")
                    response += chunk

                    # Check for complete response based on protocol
                    response_lower = response.lower()
                    response_stripped = response.rstrip()

                    # GRBL response patterns
                    if is_grbl_status_query:
                        # Status query ends with ">"
                        if response_stripped.endswith(">"):
                            break
                    elif is_grbl_command:
                        # GRBL commands end with "ok" or "error:X"
                        if "ok" in response_lower:
                            break
                        if "error:" in response_lower:
                            break
                        if "alarm:" in response_lower:
                            break
                        # Some GRBL responses end with newline
                        if response.endswith("\n") and len(response_stripped) > 0:
                            # Check if we have a complete multi-line response
                            lines = response_stripped.split("\n")
                            last_line = lines[-1].lower().strip()
                            if last_line == "ok" or last_line.startswith("error:"):
                                break
                    else:
                        # EBB response handling (legacy)
                        if response.endswith("\r\n") or "OK\r\n" in response:
                            break

                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed > timeout:
                    raise PlotterError("PLT-X001", context={"command": command, "timeout": timeout, "partial_response": response})

                await asyncio.sleep(0.01)

        except serial.SerialException as e:
            # Device disconnected during read
            logger.error(f"Serial exception during read. Command: {command}, Error: {e}")
            self._serial = None
            self._port_name = None
            raise PlotterError("PLT-C004", context={"command": command, "phase": "read", "error": str(e)}, cause=e)
        except OSError as e:
            # Handle OS-level disconnection errors
            if e.errno in (errno.EIO, errno.ENODEV, errno.ENOENT):
                self._serial = None
                self._port_name = None
                raise PlotterError("PLT-C004", context={"command": command, "phase": "read"}, cause=e)
            raise

        response = response.strip()
        logger.debug(f"Received: {response}")

        # Check for rejection/error responses
        # EBB error format
        if response.startswith("!"):
            raise PlotterError("PLT-X003", context={"command": command, "response": response})

        # GRBL error format is handled by the caller (grbl_commands.py)
        # We don't raise here because error responses are valid responses that need parsing

        return response

    async def send_command_no_response(self, command: str):
        """Send command without waiting for response.

        Used for real-time commands like GRBL feed hold (!) and soft reset (Ctrl-X).
        """
        async with self._lock:
            if not self._serial or not self._serial.is_open:
                raise PlotterError("PLT-C004", context={"command": command})

            try:
                # Real-time commands (!, ~, ?) don't need line ending
                # Regular commands need appropriate terminator
                if command in ["!", "~", "?", "\x18"]:
                    cmd_bytes = command.encode("ascii")
                else:
                    # Use \n for GRBL commands, \r for EBB
                    is_grbl = command.startswith("$") or command.startswith("G") or command.startswith("M")
                    terminator = "\n" if is_grbl else "\r"
                    cmd_bytes = f"{command}{terminator}".encode("ascii")
                self._serial.write(cmd_bytes)
                logger.debug(f"Sent (no wait): {repr(command)}")
            except serial.SerialException as e:
                self._serial = None
                self._port_name = None
                raise PlotterError("PLT-C004", context={"command": command}, cause=e)
            except OSError as e:
                if e.errno in (errno.EIO, errno.ENODEV, errno.ENOENT):
                    self._serial = None
                    self._port_name = None
                    raise PlotterError("PLT-C004", context={"command": command}, cause=e)
                raise

    @asynccontextmanager
    async def session(self, port: Optional[str] = None):
        """Context manager for plotter session."""
        await self.connect(port)
        try:
            yield self
        finally:
            await self.disconnect()
