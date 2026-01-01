#!/usr/bin/env python3
"""
Simple test for text-to-path conversion that doesn't require all dependencies.
"""

import sys

# Test fonttools availability
print("Testing fonttools availability...")
try:
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    print("✓ fonttools is available")
    FONTTOOLS_AVAILABLE = True
except ImportError as e:
    print(f"✗ fonttools is NOT available: {e}")
    print("  Install with: pip install fonttools>=4.40.0")
    FONTTOOLS_AVAILABLE = False
    sys.exit(1)

# Test font finding
import os

def find_system_font_simple():
    """Find a system font for testing (looking for common fonts like Helvetica/Arial)."""
    if sys.platform == "darwin":  # macOS
        # Try specific fonts first
        preferred = [
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/Times.ttc",
            "/Library/Fonts/Arial.ttf",
        ]
        for font_path in preferred:
            if os.path.exists(font_path):
                print(f"✓ Found preferred font: {font_path}")
                return font_path

        # Fall back to searching
        font_dirs = [
            "/System/Library/Fonts",
            "/Library/Fonts",
        ]
    elif sys.platform == "win32":  # Windows
        font_dirs = [r"C:\Windows\Fonts"]
    else:  # Linux
        font_dirs = ["/usr/share/fonts"]

    print("\nSearching for system fonts...")
    for font_dir in font_dirs:
        if not os.path.exists(font_dir):
            continue
        for root, dirs, files in os.walk(font_dir):
            for file in files:
                # Skip symbol/icon fonts
                if any(skip in file.lower() for skip in ['symbol', 'icon', 'emoji', 'dingbat']):
                    continue
                if file.endswith('.ttf') or file.endswith('.otf') or file.endswith('.ttc'):
                    font_path = os.path.join(root, file)
                    print(f"✓ Found font: {font_path}")
                    return font_path
    return None

font_path = find_system_font_simple()
if not font_path:
    print("✗ No TrueType/OpenType fonts found")
    sys.exit(1)

# Test font loading and glyph extraction
print("\nTesting font loading and glyph extraction...")
try:
    # Handle TrueType Collections (.ttc files)
    if font_path.endswith('.ttc'):
        font = TTFont(font_path, fontNumber=0)  # Use first font in collection
    else:
        font = TTFont(font_path)
    print(f"✓ Successfully loaded font: {font_path}")

    # Get character map
    cmap = font.getBestCmap()
    if not cmap:
        print("✗ No character map found")
        sys.exit(1)
    print(f"✓ Character map loaded ({len(cmap)} characters)")

    # Get glyph set
    glyph_set = font.getGlyphSet()
    print(f"✓ Glyph set loaded ({len(glyph_set)} glyphs)")

    # Get units per em for scaling
    units_per_em = font['head'].unitsPerEm
    print(f"✓ Units per em: {units_per_em}")

    # Test extracting a glyph
    test_char = 'H'
    glyph_name = cmap.get(ord(test_char))
    if not glyph_name:
        print(f"✗ No glyph found for character '{test_char}'")
        sys.exit(1)

    print(f"✓ Glyph name for '{test_char}': {glyph_name}")

    # Get glyph
    glyph = glyph_set[glyph_name]
    print(f"✓ Glyph loaded, width: {glyph.width}")

    # Create SVG path pen and draw
    pen = SVGPathPen(glyph_set)
    glyph.draw(pen)
    path_data = pen.getCommands()

    if path_data:
        print(f"✓ Successfully extracted path data")
        print(f"  Path length: {len(path_data)} characters")
        print(f"  Path preview: {path_data[:100]}...")

        # Test y-axis flip transformation
        print("\nTesting coordinate transformation with y-axis flip...")

        # Simple transform test
        scale = 10.0 / units_per_em  # 10mm font size
        import re

        def transform_coords(match):
            cmd = match.group(1)
            coords = match.group(2).strip().split()
            transformed = []
            for i in range(0, len(coords), 2):
                if i + 1 < len(coords):
                    x = float(coords[i])
                    y = float(coords[i + 1])
                    new_x = x * scale
                    new_y = -y * scale  # Y-AXIS FLIP
                    transformed.append(f"{new_x:.2f}")
                    transformed.append(f"{new_y:.2f}")
            return f"{cmd} {' '.join(transformed)}"

        transformed = re.sub(r'([MLCQTAmlcqta])\s*([\d\s.-]+)', transform_coords, path_data)

        print(f"✓ Transformed path:")
        print(f"  Length: {len(transformed)} characters")
        print(f"  Preview: {transformed[:100]}...")

        # Check for negative y-coordinates (indicating y-flip)
        if "-" in transformed:
            print("✓ Y-axis flip is working (negative coordinates present)")
        else:
            print("⚠ Warning: No negative coordinates found")

    else:
        print("✗ Failed to extract path data")
        sys.exit(1)

    font.close()

    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED")
    print("\nThe text-to-path implementation should work correctly!")
    print("=" * 60)

except Exception as e:
    print(f"\n✗ Test failed with error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
