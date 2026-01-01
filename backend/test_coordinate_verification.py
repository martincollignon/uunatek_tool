#!/usr/bin/env python3
"""Systematic coordinate system verification with position checks at each step."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.plotter.connection import PlotterConnection
from core.plotter.grbl_commands import GRBLCommands


async def verify_coordinates():
    """Systematically verify the coordinate system."""
    print("=== Coordinate System Verification ===\n")

    conn = PlotterConnection()

    try:
        print("Connecting...")
        await conn.connect()
        print("Connected!\n")

        cmd = GRBLCommands(conn)
        await cmd.initialize()

        # Step 1: Check current position
        print("Step 1: Check current position BEFORE homing")
        status = await cmd.query_status()
        print(f"  Position: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print()

        # Step 2: Home
        print("Step 2: Homing...")
        try:
            await cmd.home(timeout=60.0)
        except Exception as e:
            print(f"  Homing timeout (may be normal): {e}")

        print("  Waiting 5 seconds...")
        await asyncio.sleep(5)

        # Step 3: Check position AFTER homing
        print("\nStep 3: Check position AFTER homing")
        status = await cmd.query_status()
        home_x = status.machine_x
        home_y = status.machine_y
        print(f"  Position: ({home_x:.1f}, {home_y:.1f})")
        print(f"  Physical location: back-left corner (top-left when viewed from front)")
        print()

        # Step 4: Try small positive X movement
        print("Step 4: Move +10mm in X direction (should go RIGHT)")
        print(f"  Command: move_absolute({home_x + 10:.1f}, {home_y:.1f})")
        await cmd.pen_up()
        await cmd.move_absolute(home_x + 10, home_y, None)
        await cmd.wait_for_completion()
        await asyncio.sleep(1)

        status = await cmd.query_status()
        print(f"  New position: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print(f"  Did pen move RIGHT? (Expected: YES)")
        print()

        # Step 5: Return home
        print("Step 5: Return to home position")
        await cmd.move_absolute(home_x, home_y, None)
        await cmd.wait_for_completion()
        await asyncio.sleep(1)

        status = await cmd.query_status()
        print(f"  Position: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print()

        # Step 6: Try NEGATIVE Y movement (since +Y failed)
        print("Step 6: Move -10mm in Y direction (negative Y)")
        print(f"  Command: move_absolute({home_x:.1f}, {home_y - 10:.1f})")
        print(f"  If home Y={home_y:.1f}, then target Y={home_y - 10:.1f}")
        await cmd.move_absolute(home_x, home_y - 10, None)
        await cmd.wait_for_completion()
        await asyncio.sleep(1)

        status = await cmd.query_status()
        print(f"  New position: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print(f"  Did pen move? Did it make noise?")
        print(f"  If moved toward FRONT (toward you): -Y = toward front")
        print(f"  If moved toward BACK (away from you): -Y = toward back")
        print(f"  If motor noise: Can't move in Y at all from home")
        print()

        # Step 7: Return home again
        print("Step 7: Return to home position")
        await cmd.move_absolute(home_x, home_y, None)
        await cmd.wait_for_completion()

        status = await cmd.query_status()
        print(f"  Final position: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print()

        print("=== SUMMARY ===")
        print(f"Home position after $H: ({home_x:.1f}, {home_y:.1f})")
        print(f"Physical location: back-left corner (0.7cm from left, 0cm from top/back)")
        print()
        print("Please observe and report:")
        print("  - Did +X move go RIGHT? (Expected: YES)")
        print("  - Did +Y move cause motor noise or did it move?")
        print("  - If it moved, which direction (toward front or toward back)?")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.disconnect()
        print("\nDisconnected.")


if __name__ == "__main__":
    asyncio.run(verify_coordinates())
