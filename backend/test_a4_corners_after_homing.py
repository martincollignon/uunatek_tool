#!/usr/bin/env python3
"""Systematic A4 corner verification after proper homing."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.plotter.connection import PlotterConnection
from core.plotter.grbl_commands import GRBLCommands


async def test_a4_corners():
    """Home, then systematically test A4 paper corners."""
    print("=== A4 Corner Verification After Homing ===\n")

    conn = PlotterConnection()

    try:
        print("Connecting...")
        await conn.connect()
        print("Connected!\n")

        cmd = GRBLCommands(conn)
        await cmd.initialize()

        # Step 1: Home the plotter
        print("Step 1: Homing with $H...")
        try:
            await cmd.home(timeout=60.0)
        except Exception as e:
            print(f"Homing timeout (may be normal): {e}")

        print("Waiting 5 seconds for homing to complete...")
        await asyncio.sleep(5)

        status = await cmd.query_status()
        print(f"After homing: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print("Physical: back-left corner (0.7cm from left, 0cm from back/top)\n")

        # Step 2: Move to estimated A4 TOP-RIGHT corner
        # Based on our findings:
        # - Home (0,0) is at back-left (0.7cm from left edge)
        # - A4 paper is flush top-right
        # - A4 is 210mm wide, 297mm tall
        # - Paper left edge is at ~80mm from machine origin
        # - So top-right should be at (80 + 210, 0) = (290, 0)
        # - But we discovered Y=0 is at back, and -Y goes toward front
        print("Step 2: Moving to estimated A4 TOP-RIGHT corner...")
        print("Command: move to (290, 0)")
        print("Expected: Top-right corner of A4 paper (back-right of paper)\n")

        await cmd.pen_up()
        # Bypass clamping by sending G-code directly
        await cmd._send_gcode("G00 X290.000 Y0.000")
        await cmd.wait_for_completion()
        await asyncio.sleep(1)

        status = await cmd.query_status()
        print(f"Position: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print("\n*** PLEASE CONFIRM ***")
        print("Is the pen at the TOP-RIGHT corner of the A4 paper?")
        print("(Top = back edge, Right = right edge)")
        print("Press Enter when confirmed, or type 'no' if incorrect...")
        response = input("> ").strip().lower()

        if response == "no":
            print("\nPosition incorrect. Please report where the pen actually is.")
            print("Aborting test.\n")
            return

        print("\nTop-right confirmed! Continuing...\n")

        # Step 3: Move to A4 TOP-LEFT corner
        print("Step 3: Moving to A4 TOP-LEFT corner...")
        print("Command: move to (80, 0)")
        print("Expected: Top-left corner of A4 paper\n")

        await cmd._send_gcode("G00 X80.000 Y0.000")
        await cmd.wait_for_completion()
        await asyncio.sleep(1)

        status = await cmd.query_status()
        print(f"Position: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print("Confirm: Is pen at TOP-LEFT corner? (press Enter)")
        input("> ")
        print()

        # Step 4: Move to A4 BOTTOM-LEFT corner
        print("Step 4: Moving to A4 BOTTOM-LEFT corner...")
        print("Command: move to (80, -297)")
        print("Expected: Bottom-left corner of A4 paper (front-left)\n")

        await cmd._send_gcode("G00 X80.000 Y-297.000")
        await cmd.wait_for_completion()
        await asyncio.sleep(1)

        status = await cmd.query_status()
        print(f"Position: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print("Confirm: Is pen at BOTTOM-LEFT corner? (press Enter)")
        input("> ")
        print()

        # Step 5: Move to A4 BOTTOM-RIGHT corner
        print("Step 5: Moving to A4 BOTTOM-RIGHT corner...")
        print("Command: move to (290, -297)")
        print("Expected: Bottom-right corner of A4 paper (front-right)\n")

        await cmd._send_gcode("G00 X290.000 Y-297.000")
        await cmd.wait_for_completion()
        await asyncio.sleep(1)

        status = await cmd.query_status()
        print(f"Position: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print("Confirm: Is pen at BOTTOM-RIGHT corner? (press Enter)")
        input("> ")
        print()

        # Step 6: Return to home
        print("Step 6: Returning to home position...")
        await cmd._send_gcode("G00 X0.000 Y0.000")
        await cmd.wait_for_completion()

        status = await cmd.query_status()
        print(f"Final position: ({status.machine_x:.1f}, {status.machine_y:.1f})")
        print()

        print("=== SUMMARY ===")
        print("If all corners matched:")
        print("  A4 TOP-RIGHT (back-right):    (290, 0)")
        print("  A4 TOP-LEFT (back-left):      (80, 0)")
        print("  A4 BOTTOM-LEFT (front-left):  (80, -297)")
        print("  A4 BOTTOM-RIGHT (front-right):(290, -297)")
        print()
        print("Coordinate system:")
        print("  - Origin (0,0) = back-left corner of plotter bed")
        print("  - +X = RIGHT")
        print("  - -Y = toward FRONT (toward user)")
        print("  - Y=0 is at BACK edge")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.disconnect()
        print("\nDisconnected.")


if __name__ == "__main__":
    asyncio.run(test_a4_corners())
