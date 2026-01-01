#!/usr/bin/env python3
"""Test Y-axis direction."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.plotter.connection import PlotterConnection
from core.plotter.grbl_commands import GRBLCommands


async def test_y_direction():
    """Test Y-axis direction by moving from (0,0) to (0,20)."""
    print("=== Testing Y-Axis Direction ===\n")

    conn = PlotterConnection()

    try:
        print("Connecting...")
        await conn.connect()
        print("Connected!\n")

        cmd = GRBLCommands(conn)
        await cmd.initialize()

        # Current position should be (0,0) from previous test
        status = await cmd.query_status()
        print(f"Current position: ({status.machine_x:.1f}, {status.machine_y:.1f})")

        if abs(status.machine_x) > 1 or abs(status.machine_y) > 1:
            print("WARNING: Not at (0,0). Homing first...")
            await cmd.home(timeout=60.0)
            print("Homed to (0,0)")

        print("\nMoving from (0,0) to (0,20)...")
        print("This moves Y by +20, X stays at 0")

        await cmd.pen_up()
        await cmd.move_absolute(0, 20, None)
        await cmd.wait_for_completion()

        status = await cmd.query_status()
        print(f"New position: ({status.machine_x:.1f}, {status.machine_y:.1f})")

        print("\nOBSERVE: Did the pen move toward you (front) or away from you (back)?")
        print("         - If toward you (front): +Y goes DOWN toward user")
        print("         - If away from you (back): +Y goes UP away from user")
        print()

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.disconnect()
        print("Disconnected.")


if __name__ == "__main__":
    asyncio.run(test_y_direction())
