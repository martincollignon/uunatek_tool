"""
Text to path converter for SVG generation.

Converts text strings to SVG path data for accurate plotter output.
Uses fontTools to extract font glyphs and convert them to paths.
Supports system fonts and provides Google Fonts fallbacks.
"""

import logging
from typing import Optional, Dict, Tuple
import os
import sys
import re
import urllib.request
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# Try to import fontTools
try:
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    FONTTOOLS_AVAILABLE = True
except ImportError:
    FONTTOOLS_AVAILABLE = False
    logger.warning("fontTools not available - text-to-path conversion limited")

# Cache for downloaded Google Fonts
_font_cache: Dict[str, str] = {}
_GOOGLE_FONTS_CACHE_DIR = Path(tempfile.gettempdir()) / "tallahassee_fonts"

# Google Fonts mapping for common fonts
GOOGLE_FONTS_MAP = {
    "Roboto": "https://github.com/google/roboto/raw/main/src/hinted/Roboto-Regular.ttf",
    "Open Sans": "https://github.com/googlefonts/opensans/raw/main/fonts/ttf/OpenSans-Regular.ttf",
    "Lato": "https://github.com/google/fonts/raw/main/ofl/lato/Lato-Regular.ttf",
    "Montserrat": "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Regular.ttf",
    "Oswald": "https://github.com/googlefonts/OswaldFont/raw/master/fonts/ttf/Oswald-Regular.ttf",
    "Source Sans Pro": "https://github.com/adobe-fonts/source-sans/raw/release/TTF/SourceSans3-Regular.ttf",
    "Raleway": "https://github.com/googlefonts/raleway/raw/master/fonts/ttf/Raleway-Regular.ttf",
    "PT Sans": "https://github.com/google/fonts/raw/main/ofl/ptsans/PTSans-Regular.ttf",
    "Merriweather": "https://github.com/SorkinType/Merriweather/raw/master/fonts/ttf/Merriweather-Regular.ttf",
    "Ubuntu": "https://github.com/canonical/Ubuntu-fonts/raw/main/fonts/ubuntu-font-family-0.83/Ubuntu-R.ttf",
}


def download_google_font(font_family: str) -> Optional[str]:
    """
    Download a Google Font and cache it locally.

    Args:
        font_family: Font family name

    Returns:
        Path to downloaded font file, or None if download failed
    """
    # Check if already cached in memory
    if font_family in _font_cache:
        if os.path.exists(_font_cache[font_family]):
            return _font_cache[font_family]

    # Check if font URL exists in mapping
    font_url = GOOGLE_FONTS_MAP.get(font_family)
    if not font_url:
        logger.debug(f"No Google Fonts URL available for '{font_family}'")
        return None

    try:
        # Create cache directory if needed
        _GOOGLE_FONTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

        # Generate cache file path
        safe_name = font_family.replace(" ", "_").replace("-", "_")
        cache_file = _GOOGLE_FONTS_CACHE_DIR / f"{safe_name}.ttf"

        # Download if not already cached
        if not cache_file.exists():
            logger.info(f"Downloading Google Font: {font_family}")
            urllib.request.urlretrieve(font_url, cache_file)
            logger.info(f"Google Font cached: {cache_file}")

        # Cache in memory and return
        _font_cache[font_family] = str(cache_file)
        return str(cache_file)

    except Exception as e:
        logger.error(f"Failed to download Google Font '{font_family}': {e}")
        return None


def convert_text_to_path(
    text: str,
    font_family: str,
    font_size_mm: float,
    font_weight: str = "normal",
    font_style: str = "normal",
) -> Tuple[Optional[str], Optional[str]]:
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
        Tuple of (SVG path data string or None, warning message or None)
    """
    if not FONTTOOLS_AVAILABLE:
        logger.debug("fontTools not available for text-to-path conversion")
        return None, "fontTools library not available - text may not render accurately on plotter"

    if not text or not text.strip():
        return None, "Empty text cannot be converted to path"

    try:
        # First, try to find the font on the system
        font_path = find_system_font(font_family, font_weight, font_style)

        # If not found on system, try Google Fonts
        if not font_path:
            logger.info(f"Font '{font_family}' not found on system, trying Google Fonts...")
            font_path = download_google_font(font_family)

        if not font_path:
            warning = f"Font '{font_family}' not found on system or in Google Fonts - using fallback rendering"
            logger.warning(warning)
            return None, warning

        # Load the font (handle TrueType Collections)
        try:
            if font_path.endswith('.ttc'):
                # TrueType Collection - use first font
                font = TTFont(font_path, fontNumber=0)
            else:
                font = TTFont(font_path)
        except Exception as e:
            warning = f"Failed to load font file '{font_path}': {str(e)}"
            logger.error(warning)
            return None, warning

        # Get the glyph set
        try:
            glyph_set = font.getGlyphSet()
        except Exception as e:
            font.close()
            warning = f"Failed to get glyph set from font: {str(e)}"
            logger.error(warning)
            return None, warning

        # Get character map
        cmap = font.getBestCmap()
        if not cmap:
            warning = f"No character map found in font {font_path}"
            logger.warning(warning)
            font.close()
            return None, warning

        # Convert text to glyphs and build path
        paths = []
        x_offset = 0
        missing_chars = []

        # Get units per em for scaling
        units_per_em = font['head'].unitsPerEm
        scale = font_size_mm / units_per_em

        for char in text:
            # Get glyph name for character
            glyph_name = cmap.get(ord(char))
            if not glyph_name:
                missing_chars.append(char)
                logger.warning(f"No glyph found for character '{char}' (code: {ord(char)})")
                # Use a space width as fallback
                x_offset += units_per_em * 0.5
                continue

            try:
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
                    transformed_path = transform_path(path_data, x_offset, 0, scale)
                    paths.append(transformed_path)

                # Advance x position by glyph width
                x_offset += glyph.width

            except Exception as e:
                logger.warning(f"Failed to process glyph '{glyph_name}' for character '{char}': {e}")
                missing_chars.append(char)
                # Use a space width as fallback
                x_offset += units_per_em * 0.5
                continue

        font.close()

        if not paths:
            warning = f"No valid paths generated from text '{text[:20]}...'"
            if missing_chars:
                warning += f" (missing glyphs for: {', '.join(set(missing_chars))})"
            logger.warning(warning)
            return None, warning

        # Combine all paths
        combined_path = " ".join(paths)

        # Generate warning if some characters were missing
        warning = None
        if missing_chars:
            unique_missing = sorted(set(missing_chars))
            warning = f"Some characters could not be converted: {', '.join(unique_missing)}"
            logger.warning(warning)

        logger.info(f"Successfully converted text '{text[:20]}...' to path (font: {font_family})")
        return combined_path, warning

    except Exception as e:
        error_msg = f"Unexpected error converting text to path: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return None, error_msg


def transform_path(path_data: str, x_offset: float, y_offset: float, scale: float) -> str:
    """
    Transform SVG path data with translation and scaling.

    Handles the coordinate system conversion from font space (y-up) to SVG space (y-down).

    Args:
        path_data: Original SVG path data
        x_offset: X translation in font units
        y_offset: Y translation in font units (typically 0)
        scale: Scale factor (from font units to mm)

    Returns:
        Transformed path data
    """
    # Parse and transform coordinates
    def transform_coords(match):
        cmd = match.group(1)
        coords = match.group(2).strip().split()

        transformed = []
        for i in range(0, len(coords), 2):
            if i + 1 < len(coords):
                try:
                    x = float(coords[i])
                    y = float(coords[i + 1])

                    # Apply transformation:
                    # 1. Translate x by offset
                    # 2. Flip y-axis (fonts are y-up, SVG is y-down)
                    # 3. Scale to millimeters
                    new_x = (x + x_offset) * scale
                    new_y = -y * scale  # Negative to flip y-axis

                    transformed.append(f"{new_x:.2f}")
                    transformed.append(f"{new_y:.2f}")
                except (ValueError, IndexError):
                    # Keep original if parsing fails
                    transformed.append(coords[i])
                    if i + 1 < len(coords):
                        transformed.append(coords[i + 1])

        return f"{cmd} {' '.join(transformed)}"

    # Transform path commands with coordinates
    transformed = re.sub(r'([MLCQTAmlcqta])\s*([\d\s.-]+)', transform_coords, path_data)

    return transformed


def find_system_font(font_family: str, font_weight: str = "normal", font_style: str = "normal") -> Optional[str]:
    """
    Find a font file on the system matching the given criteria.

    Args:
        font_family: Font family name (e.g., "Arial", "Helvetica")
        font_weight: Font weight (e.g., "normal", "bold")
        font_style: Font style (e.g., "normal", "italic")

    Returns:
        Path to font file, or None if not found
    """
    # Common font directories on different systems
    if sys.platform == "darwin":  # macOS
        font_dirs = [
            "/System/Library/Fonts",
            "/Library/Fonts",
            os.path.expanduser("~/Library/Fonts"),
        ]
    elif sys.platform == "win32":  # Windows
        font_dirs = [
            r"C:\Windows\Fonts",
        ]
    else:  # Linux
        font_dirs = [
            "/usr/share/fonts",
            "/usr/local/share/fonts",
            os.path.expanduser("~/.fonts"),
            os.path.expanduser("~/.local/share/fonts"),
        ]

    # Normalize font family name for matching
    font_family_lower = font_family.lower().replace(" ", "")

    # Font weight mapping
    weight_keywords = {
        "normal": ["regular", "normal", ""],
        "bold": ["bold", "heavy", "black"],
        "100": ["thin", "hairline"],
        "200": ["extralight", "ultralight"],
        "300": ["light"],
        "400": ["regular", "normal"],
        "500": ["medium"],
        "600": ["semibold", "demibold"],
        "700": ["bold"],
        "800": ["extrabold", "ultrabold"],
        "900": ["black", "heavy"],
    }

    # Font style keywords
    style_keywords = {
        "normal": [""],
        "italic": ["italic", "oblique"],
        "oblique": ["oblique", "italic"],
    }

    weight_terms = weight_keywords.get(font_weight.lower(), [""])
    style_terms = style_keywords.get(font_style.lower(), [""])

    # Search for font file
    for font_dir in font_dirs:
        if not os.path.exists(font_dir):
            continue

        # Walk through font directory
        for root, dirs, files in os.walk(font_dir):
            for file in files:
                if not (file.endswith('.ttf') or file.endswith('.otf')):
                    continue

                file_lower = file.lower().replace(" ", "")

                # Check if font family matches
                if font_family_lower not in file_lower:
                    continue

                # Check weight and style
                matches_weight = any(term in file_lower for term in weight_terms) if weight_terms != [""] else True
                matches_style = any(term in file_lower for term in style_terms) if style_terms != [""] else True

                if matches_weight and matches_style:
                    font_path = os.path.join(root, file)
                    logger.info(f"Found font: {font_path}")
                    return font_path

    # Fallback: try common substitutions
    fallback_fonts = {
        "arial": ["Helvetica", "Liberation Sans"],
        "helvetica": ["Helvetica", "Arial", "Liberation Sans"],
        "times": ["Times New Roman", "Liberation Serif"],
        "courier": ["Courier New", "Liberation Mono"],
        "verdana": ["Verdana", "DejaVu Sans"],
    }

    font_key = font_family_lower.split()[0] if " " in font_family_lower else font_family_lower

    if font_key in fallback_fonts:
        for fallback in fallback_fonts[font_key]:
            if fallback.lower().replace(" ", "") == font_family_lower:
                # Avoid infinite recursion
                continue
            result = find_system_font(fallback, font_weight, font_style)
            if result:
                logger.info(f"Using fallback font {fallback} for {font_family}")
                return result

    logger.warning(f"Could not find font '{font_family}' on system")
    return None
