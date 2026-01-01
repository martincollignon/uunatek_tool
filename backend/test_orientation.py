#!/usr/bin/env python3
"""Test orientation and coordinate transformation with a directional pattern.

Draws an arrow pointing RIGHT and DOWN to verify orientation:
- Arrow should point toward bottom-right corner of paper
- If rotated/flipped, we'll see it immediately

Pattern (in SVG coordinates, top-left origin):
- Starts at (50, 50) - near top-left
- Arrow shaft goes RIGHT to (150, 50)
- Arrow head points DOWN-RIGHT
- Letter "F" at top to mark "front/top"
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.plotter.connection import PlotterConnection
from core.plotter.grbl_commands import GRBLCommands
from core.plotter.executor import PlotExecutor, PlotCommand


async def test_orientation():
    """Test coordinate transformation with clear orientation markers."""
    print("=== Orientation and Scaling Test ===")
    print("This will draw:")
    print("1. Arrow pointing toward bottom-right")
    print("2. Letter 'F' at the top to mark orientation")
    print("3. Rectangle border showing exact dimensions")
    print()

    conn = PlotterConnection()

    try:
        print("Connecting...")
        await conn.connect()
        print("Connected!\n")

        cmd = GRBLCommands(conn)
        await cmd.initialize()

        # Create executor for A4 paper
        executor = PlotExecutor(
            cmd,
            canvas_width_mm=210.0,  # A4 width
            canvas_height_mm=297.0,  # A4 height
        )

        # Create test pattern with clear orientation
        # All coordinates in SVG space (mm): origin top-left, +X right, +Y down
        commands = []

        # 1. Draw border rectangle (10mm from edges) to verify dimensions
        print("Pattern 1: Border rectangle (10mm from edges)")
        border_commands = [
            PlotCommand("pen_up"),
            PlotCommand("move", 10, 10),  # Top-left
            PlotCommand("pen_down"),
            PlotCommand("line", 200, 10),  # Top-right
            PlotCommand("line", 200, 287),  # Bottom-right
            PlotCommand("line", 10, 287),  # Bottom-left
            PlotCommand("line", 10, 10),  # Back to top-left
            PlotCommand("pen_up"),
        ]
        commands.extend(border_commands)

        # 2. Draw letter "F" at top-center (marks "top")
        print("Pattern 2: Letter 'F' at top (30mm tall)")
        f_x = 95  # Center horizontally
        f_y = 30  # 30mm from top
        f_commands = [
            PlotCommand("move", f_x, f_y),
            PlotCommand("pen_down"),
            PlotCommand("line", f_x, f_y + 30),  # Vertical line down
            PlotCommand("move", f_x, f_y),
            PlotCommand("line", f_x + 15, f_y),  # Top horizontal
            PlotCommand("move", f_x, f_y + 15),
            PlotCommand("line", f_x + 10, f_y + 15),  # Middle horizontal
            PlotCommand("pen_up"),
        ]
        commands.extend(f_commands)

        # 3. Draw arrow pointing bottom-right (to show orientation clearly)
        print("Pattern 3: Arrow pointing toward bottom-right corner")
        arrow_start_x = 50
        arrow_start_y = 100
        arrow_commands = [
            # Arrow shaft (horizontal line to the right)
            PlotCommand("move", arrow_start_x, arrow_start_y),
            PlotCommand("pen_down"),
            PlotCommand("line", arrow_start_x + 60, arrow_start_y),

            # Arrow head pointing down-right
            PlotCommand("line", arrow_start_x + 80, arrow_start_y + 20),  # Diagonal to bottom-right
            PlotCommand("move", arrow_start_x + 60, arrow_start_y),
            PlotCommand("line", arrow_start_x + 60, arrow_start_y + 20),  # Vertical down
            PlotCommand("line", arrow_start_x + 80, arrow_start_y + 20),  # To tip
            PlotCommand("pen_up"),
        ]
        commands.extend(arrow_commands)

        # 4. Draw scale reference (20mm line with marks)
        print("Pattern 4: 20mm scale reference at bottom")
        scale_x = 50
        scale_y = 260
        scale_commands = [
            PlotCommand("move", scale_x, scale_y),
            PlotCommand("pen_down"),
            PlotCommand("line", scale_x + 20, scale_y),  # 20mm horizontal line
            # Tick marks every 5mm
            PlotCommand("move", scale_x, scale_y - 2),
            PlotCommand("line", scale_x, scale_y + 2),
            PlotCommand("move", scale_x + 5, scale_y - 2),
            PlotCommand("line", scale_x + 5, scale_y + 2),
            PlotCommand("move", scale_x + 10, scale_y - 2),
            PlotCommand("line", scale_x + 10, scale_y + 2),
            PlotCommand("move", scale_x + 15, scale_y - 2),
            PlotCommand("line", scale_x + 15, scale_y + 2),
            PlotCommand("move", scale_x + 20, scale_y - 2),
            PlotCommand("line", scale_x + 20, scale_y + 2),
            PlotCommand("pen_up"),
        ]
        commands.extend(scale_commands)

        print()
        print(f"Total commands: {len(commands)}")
        print()
        print("Expected result:")
        print("- Border should be 200mm × 277mm (10mm margins)")
        print("- 'F' should be at top-center")
        print("- Arrow should point toward bottom-right corner")
        print("- Scale should show exactly 20mm")
        print()
        print("Starting plot...")

        # Execute the plot
        success = await executor.execute(commands)

        if success:
            print("\n✓ Plot completed successfully!")
            print()
            print("Please verify:")
            print("1. Border dimensions are correct (190mm × 277mm)")
            print("2. 'F' is at the top (not rotated/flipped)")
            print("3. Arrow points toward bottom-right corner")
            print("4. Scale measures exactly 20mm")
        else:
            print("\n✗ Plot was cancelled")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.disconnect()
        print("\nDisconnected.")


if __name__ == "__main__":
    asyncio.run(test_orientation())
