"""
Text to path converter for SVG generation.

Converts text strings to SVG path data for accurate plotter output.
Uses fontTools to extract font glyphs and convert them to paths.
"""

import logging
from typing import Optional, Tuple
import os
import sys

logger = logging.getLogger(__name__)

# Try to import fontTools
try:
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    FONTTOOLS_AVAILABLE = True
except ImportError:
    FONTTOOLS_AVAILABLE = False
    logger.warning("fontTools not available - text-to-path conversion limited")


def convert_text_to_path(
    text: str,
    font_family: str,
    font_size_mm: float,
    font_weight: str = "normal",
    font_style: str = "normal",
) -> Optional[str]:
    """
    Convert text to SVG path data using font glyphs.

    This function uses fontTools to extract glyph outlines from TrueType/OpenType fonts
    and convert them to SVG path data. This ensures the exact font appearance is preserved
    in the plotter output.

    Args:
        text: The text to convert
        font_family: Font family name (e.g., "Arial", "Times New Roman")
        font_size_mm: Font size in millimeters
        font_weight: Font weight (e.g., "normal", "bold", "100"-"900")
        font_style: Font style (e.g., "normal", "italic", "oblique")

    Returns:
        SVG path data string, or None if conversion not possible
    """
    if not FONTTOOLS_AVAILABLE:
        logger.debug("fontTools not available for text-to-path conversion")
        return None

    try:
        # Find the font file on the system
        font_path = find_system_font(font_family, font_weight, font_style)
        if not font_path:
            logger.warning(f"Font '{font_family}' not found on system")
            return None

        # Load the font
        font = TTFont(font_path)

        # Get the glyph set
        glyph_set = font.getGlyphSet()

        # Get character map
        cmap = font.getBestCmap()
        if not cmap:
            logger.warning(f"No character map found in font {font_path}")
            return None

        # Convert text to glyphs and build path
        paths = []
        x_offset = 0

        # Get units per em for scaling
        units_per_em = font['head'].unitsPerEm
        scale = font_size_mm / units_per_em

        for char in text:
            # Get glyph name for character
            glyph_name = cmap.get(ord(char))
            if not glyph_name:
                logger.warning(f"No glyph found for character '{char}'")
                continue

            # Get glyph
            glyph = glyph_set[glyph_name]

            # Create SVG path pen
            pen = SVGPathPen(glyph_set)

            # Draw the glyph
            glyph.draw(pen)

            # Get the path data
            path_data = pen.getCommands()

            if path_data:
                # Transform path: scale and translate
                # SVG paths need to be scaled and positioned
                transformed_path = transform_path(path_data, x_offset, 0, scale)
                paths.append(transformed_path)

            # Advance x position by glyph width
            x_offset += glyph.width

        if not paths:
            return None

        # Combine all paths
        combined_path = " ".join(paths)

        font.close()

        logger.info(f"Successfully converted text '{text[:20]}...' to path")
        return combined_path

    except Exception as e:
        logger.error(f"Failed to convert text to path: {e}", exc_info=True)
        return None


def convert_text_to_path_inkscape(
    text: str,
    font_family: str,
    font_size_mm: float,
    font_weight: str = "normal",
    font_style: str = "normal",
) -> Optional[str]:
    """
    Convert text to paths using Inkscape CLI.

    This requires Inkscape to be installed on the system.
    This function creates a temporary SVG with text, converts it to paths using Inkscape,
    and extracts the path data.

    Args:
        text: The text to convert
        font_family: Font family name
        font_size_mm: Font size in millimeters
        font_weight: Font weight
        font_style: Font style

    Returns:
        SVG path data string, or None if conversion fails
    """
    try:
        # Create temporary SVG with text
        with tempfile.NamedTemporaryFile(mode='w', suffix='.svg', delete=False) as f:
            temp_input = f.name
            f.write(f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <text x="10" y="{font_size_mm}"
        font-family="{font_family}"
        font-size="{font_size_mm}mm"
        font-weight="{font_weight}"
        font-style="{font_style}"
        fill="black">{text}</text>
</svg>''')

        temp_output = tempfile.NamedTemporaryFile(suffix='.svg', delete=False).name

        try:
            # Convert text to path using Inkscape
            subprocess.run(
                ['inkscape', '--export-text-to-path', temp_input, '--export-filename', temp_output],
                check=True,
                capture_output=True,
            )

            # Read the output and extract path data
            with open(temp_output, 'r') as f:
                svg_content = f.read()

            # Parse SVG and extract path 'd' attribute
            import re
            path_match = re.search(r'<path[^>]*d="([^"]*)"', svg_content)
            if path_match:
                return path_match.group(1)

            return None

        finally:
            # Clean up temp files
            os.unlink(temp_input)
            if os.path.exists(temp_output):
                os.unlink(temp_output)

    except FileNotFoundError:
        logger.debug("Inkscape not found - text-to-path conversion unavailable")
        return None
    except subprocess.CalledProcessError as e:
        logger.error(f"Inkscape conversion failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in text-to-path conversion: {e}")
        return None
