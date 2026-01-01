#!/usr/bin/env python3
"""Test script to verify homing position and (0,0) location."""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from core.plotter.connection import PlotterConnection
from core.plotter.grbl_commands import GRBLCommands


async def test_home_and_zero():
    """Home the plotter, then move to (0,0)."""
    print("=== Testing Home and (0,0) Position ===\n")

    conn = PlotterConnection()

    try:
        # Connect
        print("Connecting to plotter...")
        await conn.connect()
        print("Connected!\n")

        cmd = GRBLCommands(conn)
        await cmd.initialize()

        # Step 1: Home the plotter
        print("Step 1: Homing plotter ($H command)...")
        print("Note: Homing can take up to 60 seconds...")

        try:
            await cmd.home(timeout=60.0)
            print("Homing complete!")
        except Exception as e:
            print(f"Homing timeout (expected): {e}")
            print("Waiting for plotter to finish homing...")
            await asyncio.sleep(5)

        # Query position after homing
        print("\nQuerying position after homing...")
        status = await cmd.query_status()
        print(f"Position after homing: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print()
        print("OBSERVE: Where is the pen physically located right now?")
        print("         (Look at the plotter - is it at top-left, top-right, bottom-left, or bottom-right?)")
        print()

        # Wait 5 seconds
        print("Waiting 5 seconds before moving to (0,0)...\n")
        await asyncio.sleep(5)

        # Step 2: Move to (0,0)
        print("Step 2: Moving to coordinates (0, 0)...")
        await cmd.pen_up()
        await cmd.move_absolute(0, 0, None)
        await cmd.wait_for_completion()

        # Query position
        status = await cmd.query_status()
        print(f"Position after move to (0,0): ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print()
        print("OBSERVE: Where is the pen physically located now?")
        print("         We expect it to be at the BOTTOM-LEFT corner of the plotter bed.")
        print()

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.disconnect()
        print("\nDisconnected.")


if __name__ == "__main__":
    asyncio.run(test_home_and_zero())
