#!/usr/bin/env python3
"""Test Y direction without clamping."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.plotter.connection import PlotterConnection
from core.plotter.grbl_commands import GRBLCommands


async def test_y_no_clamp():
    """Test Y direction by sending G-code directly without clamping."""
    print("=== Testing Y Direction Without Clamping ===\n")

    conn = PlotterConnection()

    try:
        print("Connecting...")
        await conn.connect()
        print("Connected!\n")

        cmd = GRBLCommands(conn)
        await cmd.initialize()

        # Home first
        print("Step 1: Homing...")
        try:
            await cmd.home(timeout=60.0)
        except Exception as e:
            print(f"Homing timeout (may be normal): {e}")

        print("Waiting 5 seconds...")
        await asyncio.sleep(5)

        status = await cmd.query_status()
        print(f"After homing: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print("Physical: back-left corner (0.7cm from left, 0cm from top/back)\n")

        # Test negative Y by sending G-code directly (bypassing clamping)
        print("Step 2: Sending G00 X0.000 Y-10.000 (bypass clamping)")
        await cmd.pen_up()
        # Send G-code directly to bypass the clamping in move_absolute
        await cmd._send_gcode("G00 X0.000 Y-10.000")
        await cmd.wait_for_completion()
        await asyncio.sleep(1)

        status = await cmd.query_status()
        print(f"After Y-10 move: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print("\nOBSERVE: Did the pen move toward you (front)?")
        print("         Or did it stay at home position?")
        print()

        # Return home
        print("Step 3: Returning to (0,0)")
        await cmd._send_gcode("G00 X0.000 Y0.000")
        await cmd.wait_for_completion()

        status = await cmd.query_status()
        print(f"Back at home: ({status.machine_x:.1f}, {status.machine_y:.1f})")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.disconnect()
        print("\nDisconnected.")


if __name__ == "__main__":
    asyncio.run(test_y_no_clamp())
