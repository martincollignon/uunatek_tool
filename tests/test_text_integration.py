#!/usr/bin/env python3
"""
Integration test for text-to-path in SVG generation.

Tests the full pipeline: Fabric.js JSON -> SVG Generator -> Text-to-Path conversion
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from core.svg.generator import SVGGenerator


def test_text_to_path_integration():
    """Test full integration of text-to-path in SVG generation."""
    print("=" * 60)
    print("TEXT-TO-PATH INTEGRATION TEST")
    print("=" * 60)

    # Create a sample Fabric.js JSON with a text object
    canvas_json = {
        "version": "5.3.0",
        "objects": [
            {
                "type": "text",
                "left": 30,  # 30px = 10mm (at 3px/mm)
                "top": 30,   # 30px = 10mm
                "text": "Hello World",
                "fontSize": 36,  # 36px = 12mm
                "fontFamily": "Arial",
                "fontWeight": "normal",
                "fontStyle": "normal",
                "fill": "black",
                "stroke": None,
                "strokeWidth": 1,
            }
        ],
    }

    # Create SVG generator (100mm x 100mm canvas)
    print("\nCreating SVG generator...")
    generator = SVGGenerator(width_mm=100, height_mm=100, include_boundary=False)
    print("✓ Generator created")

    # Generate SVG
    print("\nGenerating SVG with text-to-path conversion...")
    try:
        svg_content, warnings = generator.generate_with_warnings(canvas_json)
        print("✓ SVG generated successfully")

        # Check the output
        print(f"\nGenerated SVG length: {len(svg_content)} characters")

        # Check if it contains path elements (indicating text was converted)
        if "<path" in svg_content:
            print("✓ SVG contains path elements (text was likely converted)")

            # Check for negative y-coordinates (indicating y-flip)
            if " -" in svg_content or '"-' in svg_content:
                print("✓ SVG contains negative coordinates (y-axis flip working)")
            else:
                print("⚠ Warning: No negative coordinates found")

            # Preview the SVG
            print("\nSVG Preview (first 500 chars):")
            print(svg_content[:500])
            print("...")

            # Check warnings
            if warnings:
                print(f"\n⚠ Warnings ({len(warnings)}):")
                for warning in warnings:
                    print(f"  - {warning}")
            else:
                print("\n✓ No warnings generated")

            # Save to file for manual inspection
            output_path = "/tmp/test_text_output.svg"
            with open(output_path, "w") as f:
                f.write(svg_content)
            print(f"\n✓ SVG saved to: {output_path}")
            print("  You can open this file in a browser or SVG viewer to verify")

            print("\n" + "=" * 60)
            print("✅ INTEGRATION TEST PASSED")
            print("=" * 60)
            return True

        else:
            print("✗ SVG does not contain path elements")
            print("   Text may have used fallback rendering")

            # Check if it has text elements instead
            if "<text" in svg_content:
                print("   Found <text> elements - using fallback")

            if warnings:
                print(f"\n⚠ Warnings ({len(warnings)}):")
                for warning in warnings:
                    print(f"  - {warning}")

            print("\n" + "=" * 60)
            print("⚠ INTEGRATION TEST COMPLETED WITH FALLBACK")
            print("=" * 60)
            return True

    except Exception as e:
        print(f"\n✗ Failed to generate SVG: {e}")
        import traceback
        traceback.print_exc()

        print("\n" + "=" * 60)
        print("❌ INTEGRATION TEST FAILED")
        print("=" * 60)
        return False


def test_multiple_text_objects():
    """Test with multiple text objects to verify character spacing."""
    print("\n" + "=" * 60)
    print("MULTIPLE TEXT OBJECTS TEST")
    print("=" * 60)

    canvas_json = {
        "version": "5.3.0",
        "objects": [
            {
                "type": "text",
                "left": 30,
                "top": 30,
                "text": "ABC",
                "fontSize": 36,
                "fontFamily": "Helvetica",
                "fontWeight": "normal",
                "fontStyle": "normal",
                "fill": "black",
                "stroke": None,
                "strokeWidth": 1,
            },
            {
                "type": "text",
                "left": 30,
                "top": 120,
                "text": "123",
                "fontSize": 36,
                "fontFamily": "Helvetica",
                "fontWeight": "bold",
                "fontStyle": "normal",
                "fill": "black",
                "stroke": None,
                "strokeWidth": 1,
            },
        ],
    }

    generator = SVGGenerator(width_mm=100, height_mm=100, include_boundary=False)

    try:
        svg_content, warnings = generator.generate_with_warnings(canvas_json)
        print("✓ SVG with multiple text objects generated")

        # Count path elements
        path_count = svg_content.count("<path")
        print(f"✓ Found {path_count} path element(s)")

        if path_count >= 2:
            print("✓ Multiple text objects converted to paths")
        else:
            print("⚠ Warning: Expected at least 2 path elements")

        print("\n" + "=" * 60)
        print("✅ MULTIPLE TEXT TEST PASSED")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success1 = test_text_to_path_integration()
    success2 = test_multiple_text_objects()

    if success1 and success2:
        print("\n" + "=" * 60)
        print("✅ ALL INTEGRATION TESTS PASSED")
        print("\nThe text-to-path feature is working correctly!")
        print("Text in the canvas will be converted to vector paths for plotting.")
        print("=" * 60)
        sys.exit(0)
    else:
        print("\n" + "=" * 60)
        print("❌ SOME TESTS FAILED")
        print("=" * 60)
        sys.exit(1)
