"""Image vectorization - convert raster images to vector paths."""

import subprocess
import tempfile
import logging
import sys
import os
import re
from pathlib import Path
from PIL import Image
import io

logger = logging.getLogger(__name__)


def normalize_svg_stroke_widths(svg_content: str, target_width: float = 0.5) -> str:
    """
    Normalize all stroke widths in SVG to a consistent thin width suitable for pen plotting.

    Args:
        svg_content: SVG content as string
        target_width: Target stroke width in mm (default: 0.5mm for fine pen)

    Returns:
        Modified SVG content with normalized stroke widths
    """
    # Replace stroke-width attributes with consistent value
    # Match both stroke-width="X" and stroke-width='X' patterns
    svg_content = re.sub(
        r'stroke-width=["\'][\d.]+["\']',
        f'stroke-width="{target_width}"',
        svg_content
    )

    # Also handle style attributes that contain stroke-width
    def replace_style_stroke_width(match):
        style = match.group(1)
        # Replace stroke-width value in style string
        style = re.sub(
            r'stroke-width:\s*[\d.]+(?:px|pt|mm)?',
            f'stroke-width:{target_width}mm',
            style
        )
        return f'style="{style}"'

    svg_content = re.sub(
        r'style="([^"]*)"',
        replace_style_stroke_width,
        svg_content
    )

    # If no stroke-width is specified at all, add it to path elements
    # This handles SVGs that rely on default stroke width
    lines = svg_content.split('\n')
    processed_lines = []

    for line in lines:
        # If line contains <path and doesn't have stroke-width, add it
        if '<path' in line and 'stroke-width' not in line:
            # Add stroke-width before the closing >
            line = line.replace('>', f' stroke-width="{target_width}">', 1)
        processed_lines.append(line)

    svg_content = '\n'.join(processed_lines)

    logger.info(f"Normalized SVG stroke widths to {target_width}mm")
    return svg_content


def find_potrace():
    """
    Find potrace executable, checking bundled location first (for PyInstaller),
    then system PATH.

    Returns:
        Path to potrace executable, or None if not found
    """
    # Check if running as a PyInstaller bundle
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        # Running in a PyInstaller bundle
        bundled_potrace = os.path.join(sys._MEIPASS, 'potrace')
        if os.path.exists(bundled_potrace):
            logger.info(f"Using bundled potrace: {bundled_potrace}")
            return bundled_potrace

    # Fall back to system PATH
    import shutil
    potrace_path = shutil.which('potrace')
    if potrace_path:
        logger.info(f"Using system potrace: {potrace_path}")
        return potrace_path

    logger.error("potrace not found in bundle or system PATH")
    return None


class ImageVectorizer:
    """Convert raster images to vector SVG paths using potrace."""

    @staticmethod
    def vectorize(image_bytes: bytes, **options) -> str:
        """
        Vectorize a raster image to SVG format.

        Args:
            image_bytes: Raw image data (PNG, JPEG, etc.)
            **options: Potrace options:
                - turdsize: Suppress speckles of up to this size (default: 2)
                - turnpolicy: Turn policy (black, white, left, right, minority, majority, random)
                - alphamax: Corner threshold (default: 1.0)
                - opttolerance: Curve optimization tolerance (default: 0.2)
                - normalize_stroke_width: Target stroke width in mm (default: 0.5mm)
                - skip_normalize: If True, skip stroke width normalization (default: False)

        Returns:
            SVG content as string

        Raises:
            RuntimeError: If vectorization fails
        """
        # Load image with PIL
        try:
            img = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            raise RuntimeError(f"Failed to load image: {e}")

        # Convert to grayscale if needed
        if img.mode != 'L':
            img = img.convert('L')

        # Create temporary files
        with tempfile.NamedTemporaryFile(suffix='.bmp', delete=False) as bmp_file:
            bmp_path = Path(bmp_file.name)
            try:
                # Save as BMP (potrace's preferred format)
                img.save(bmp_path, 'BMP')

                # Find potrace executable
                potrace_exe = find_potrace()
                if not potrace_exe:
                    raise RuntimeError("potrace executable not found. Cannot vectorize image.")

                # Build potrace command
                cmd = [potrace_exe, '--svg', '--output', '-']

                # Add options
                turdsize = options.get('turdsize', 2)
                cmd.extend(['--turdsize', str(turdsize)])

                turnpolicy = options.get('turnpolicy')
                if turnpolicy:
                    cmd.extend(['--turnpolicy', turnpolicy])

                alphamax = options.get('alphamax', 1.0)
                cmd.extend(['--alphamax', str(alphamax)])

                opttolerance = options.get('opttolerance', 0.2)
                cmd.extend(['--opttolerance', str(opttolerance)])

                cmd.append(str(bmp_path))

                # Run potrace
                logger.info(f"Running potrace: {' '.join(cmd)}")
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    check=True
                )

                svg_content = result.stdout

                if not svg_content:
                    raise RuntimeError("Potrace returned empty SVG")

                # Normalize stroke widths unless explicitly skipped
                if not options.get('skip_normalize', False):
                    target_width = options.get('normalize_stroke_width', 0.5)
                    svg_content = normalize_svg_stroke_widths(svg_content, target_width)

                logger.info(f"Vectorization successful: {len(svg_content)} bytes")
                return svg_content

            except subprocess.CalledProcessError as e:
                logger.error(f"Potrace failed: {e.stderr}")
                raise RuntimeError(f"Vectorization failed: {e.stderr}")
            except Exception as e:
                logger.error(f"Vectorization error: {e}")
                raise RuntimeError(f"Vectorization failed: {e}")
            finally:
                # Clean up temp file
                try:
                    bmp_path.unlink()
                except Exception:
                    pass

    @staticmethod
    def vectorize_with_threshold(image_bytes: bytes, threshold: int = 128, **options) -> str:
        """
        Vectorize with explicit black/white threshold.

        Args:
            image_bytes: Raw image data
            threshold: Grayscale threshold (0-255), pixels below are black
            **options: Additional potrace options

        Returns:
            SVG content as string
        """
        # Load and threshold image
        img = Image.open(io.BytesIO(image_bytes))

        # Convert to grayscale
        if img.mode != 'L':
            img = img.convert('L')

        # Apply threshold to create pure black and white
        img = img.point(lambda p: 255 if p > threshold else 0, mode='1')

        # Convert back to bytes
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)

        return ImageVectorizer.vectorize(buf.read(), **options)
