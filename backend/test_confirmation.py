#!/usr/bin/env python3
"""Single corner test with confirmation."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.plotter.connection import PlotterConnection
from core.plotter.grbl_commands import GRBLCommands


async def test_corner(x: float, y: float, description: str):
    """Test a single corner position."""
    print(f"=== Testing: {description} ===")
    print(f"Target coordinates: ({x}, {y})\n")

    conn = PlotterConnection()

    try:
        print("Connecting...")
        await conn.connect()
        print("Connected!\n")

        cmd = GRBLCommands(conn)
        await cmd.initialize()

        print("Moving pen up...")
        await cmd.pen_up()
        await asyncio.sleep(0.5)

        print(f"Moving to ({x}, {y})...")
        await cmd._send_gcode(f"G00 X{x:.3f} Y{y:.3f}")
        await cmd.wait_for_completion()
        await asyncio.sleep(1)

        status = await cmd.query_status()
        print(f"Current position: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print(f"\nExpected: {description}")
        print("Check if pen is at the correct position.\n")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.disconnect()
        print("Disconnected.\n")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python test_confirmation.py <x> <y> <description>")
        print('Example: python test_confirmation.py 80 0 "A4 TOP-LEFT"')
        sys.exit(1)

    x = float(sys.argv[1])
    y = float(sys.argv[2])
    description = sys.argv[3]

    asyncio.run(test_corner(x, y, description))
