"""Image format conversion utilities for ensuring compatibility with Gemini API and canvas."""

import io
import logging
from typing import Tuple
from PIL import Image

# Register HEIC/HEIF support if available
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    logger = logging.getLogger(__name__)
    logger.info("HEIC/HEIF support enabled via pillow-heif")
except ImportError:
    logger = logging.getLogger(__name__)
    logger.warning("pillow-heif not installed - HEIC/HEIF images will not be supported")
    logger.warning("Install with: pip install pillow-heif")

# Gemini API officially supports: PNG, JPEG, WebP
# HEIC is documented but has reliability issues in practice
GEMINI_COMPATIBLE_FORMATS = {"PNG", "JPEG", "WEBP"}

# Canvas-compatible formats (browser-supported)
# Note: SVG is included but will be converted to PNG for canvas embedding
CANVAS_COMPATIBLE_FORMATS = {"PNG", "JPEG", "WEBP", "GIF", "SVG"}


class ImageConverter:
    """Handles image format conversion for compatibility."""

    @staticmethod
    def detect_format(image_bytes: bytes) -> str:
        """
        Detect image format from byte signature.

        Args:
            image_bytes: Raw image bytes

        Returns:
            Format string (e.g., 'PNG', 'JPEG', 'HEIC', 'SVG')
        """
        # SVG signature: Check for XML/SVG tags
        if len(image_bytes) >= 100:
            try:
                # Try to decode as text and check for SVG
                text_start = image_bytes[:100].decode('utf-8', errors='ignore').lower()
                if '<svg' in text_start or '<?xml' in text_start:
                    # Double-check for SVG tag
                    text_full = image_bytes[:500].decode('utf-8', errors='ignore').lower()
                    if '<svg' in text_full:
                        return "SVG"
            except Exception:
                pass

        # PNG signature: 89 50 4E 47 0D 0A 1A 0A
        if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
            return "PNG"

        # JPEG signature: FF D8
        elif image_bytes[:2] == b"\xff\xd8":
            return "JPEG"

        # GIF signature: 47 49 46
        elif image_bytes[:6] in (b"GIF87a", b"GIF89a"):
            return "GIF"

        # WebP signature: RIFF....WEBP
        elif image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
            return "WEBP"

        # HEIC/HEIF signature: check ftyp box
        # HEIC files start with 'ftyp' at offset 4-8
        elif len(image_bytes) >= 12:
            ftyp = image_bytes[4:8]
            if ftyp == b"ftyp":
                brand = image_bytes[8:12]
                if brand in (b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1"):
                    return "HEIC"

        # Try to detect using PIL as fallback
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                return img.format or "UNKNOWN"
        except Exception:
            return "UNKNOWN"

    @staticmethod
    def convert_svg_to_png(svg_bytes: bytes, width: int = 1024, height: int = 1024) -> bytes:
        """
        Convert SVG to PNG format.

        Args:
            svg_bytes: Raw SVG bytes
            width: Output width in pixels (default: 1024)
            height: Output height in pixels (default: 1024)

        Returns:
            PNG image bytes

        Raises:
            ValueError: If SVG cannot be converted
        """
        try:
            import cairosvg

            # Convert SVG to PNG using cairosvg
            png_bytes = cairosvg.svg2png(
                bytestring=svg_bytes,
                output_width=width,
                output_height=height,
            )
            logger.info(f"Converted SVG to PNG ({len(png_bytes)} bytes)")
            return png_bytes

        except ImportError:
            logger.error("cairosvg not installed - SVG conversion not available")
            raise ValueError(
                "SVG conversion requires cairosvg. Install with: pip install cairosvg"
            )
        except Exception as e:
            logger.error(f"Failed to convert SVG to PNG: {e}")
            raise ValueError(f"SVG conversion failed: {str(e)}")

    @staticmethod
    def convert_to_png(image_bytes: bytes) -> bytes:
        """
        Convert any image format to PNG.

        Args:
            image_bytes: Raw image bytes in any format

        Returns:
            PNG image bytes

        Raises:
            ValueError: If image cannot be converted
        """
        # Check if it's an SVG
        format_detected = ImageConverter.detect_format(image_bytes)
        if format_detected == "SVG":
            logger.info("Detected SVG format, using SVG conversion")
            return ImageConverter.convert_svg_to_png(image_bytes)

        try:
            # Open image with PIL (supports HEIC via pillow-heif plugin if installed)
            with Image.open(io.BytesIO(image_bytes)) as img:
                # Apply EXIF orientation if present
                try:
                    from PIL import ImageOps
                    img = ImageOps.exif_transpose(img)
                    logger.info("Applied EXIF orientation correction")
                except Exception as e:
                    logger.debug(f"No EXIF orientation data or failed to apply: {e}")

                # Convert to RGB if necessary (e.g., from RGBA or other modes)
                if img.mode not in ("RGB", "RGBA", "L"):
                    logger.info(f"Converting image mode from {img.mode} to RGB")
                    img = img.convert("RGB")

                # Save as PNG
                output = io.BytesIO()
                img.save(output, format="PNG", optimize=True)
                output.seek(0)

                png_bytes = output.read()
                logger.info(f"Converted image to PNG ({len(png_bytes)} bytes)")
                return png_bytes

        except Exception as e:
            logger.error(f"Failed to convert image to PNG: {e}")
            raise ValueError(f"Image conversion failed: {str(e)}")

    @staticmethod
    def convert_to_jpeg(image_bytes: bytes, quality: int = 95) -> bytes:
        """
        Convert any image format to JPEG.

        Args:
            image_bytes: Raw image bytes in any format
            quality: JPEG quality (1-100)

        Returns:
            JPEG image bytes

        Raises:
            ValueError: If image cannot be converted
        """
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                # Apply EXIF orientation if present
                try:
                    from PIL import ImageOps
                    img = ImageOps.exif_transpose(img)
                    logger.info("Applied EXIF orientation correction")
                except Exception as e:
                    logger.debug(f"No EXIF orientation data or failed to apply: {e}")

                # JPEG doesn't support transparency, convert RGBA to RGB
                if img.mode in ("RGBA", "LA", "P"):
                    logger.info(f"Converting image mode from {img.mode} to RGB for JPEG")
                    # Create white background
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
                    img = background
                elif img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")

                # Save as JPEG
                output = io.BytesIO()
                img.save(output, format="JPEG", quality=quality, optimize=True)
                output.seek(0)

                jpeg_bytes = output.read()
                logger.info(f"Converted image to JPEG ({len(jpeg_bytes)} bytes)")
                return jpeg_bytes

        except Exception as e:
            logger.error(f"Failed to convert image to JPEG: {e}")
            raise ValueError(f"Image conversion failed: {str(e)}")

    @staticmethod
    def convert_for_gemini(image_bytes: bytes, preferred_format: str = "PNG") -> bytes:
        """
        Convert image to Gemini-compatible format.

        Gemini officially supports PNG, JPEG, and WebP.
        HEIC is documented but unreliable in practice.

        Args:
            image_bytes: Raw image bytes
            preferred_format: Preferred output format (PNG, JPEG, or WEBP)

        Returns:
            Image bytes in Gemini-compatible format

        Raises:
            ValueError: If conversion fails
        """
        detected_format = ImageConverter.detect_format(image_bytes)
        logger.info(f"Detected image format: {detected_format}")

        # If already in compatible format, return as-is
        if detected_format in GEMINI_COMPATIBLE_FORMATS:
            logger.info(f"Image already in Gemini-compatible format: {detected_format}")
            return image_bytes

        # Convert to preferred format
        preferred_format = preferred_format.upper()
        if preferred_format not in GEMINI_COMPATIBLE_FORMATS:
            logger.warning(f"Preferred format {preferred_format} not Gemini-compatible, using PNG")
            preferred_format = "PNG"

        logger.info(f"Converting {detected_format} to {preferred_format} for Gemini compatibility")

        if preferred_format == "PNG":
            return ImageConverter.convert_to_png(image_bytes)
        elif preferred_format == "JPEG":
            return ImageConverter.convert_to_jpeg(image_bytes)
        else:  # WEBP
            return ImageConverter.convert_to_webp(image_bytes)

    @staticmethod
    def convert_to_webp(image_bytes: bytes, quality: int = 90) -> bytes:
        """
        Convert any image format to WebP.

        Args:
            image_bytes: Raw image bytes in any format
            quality: WebP quality (1-100)

        Returns:
            WebP image bytes

        Raises:
            ValueError: If image cannot be converted
        """
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                # Apply EXIF orientation if present
                try:
                    from PIL import ImageOps
                    img = ImageOps.exif_transpose(img)
                    logger.info("Applied EXIF orientation correction")
                except Exception as e:
                    logger.debug(f"No EXIF orientation data or failed to apply: {e}")

                # WebP supports both RGB and RGBA
                if img.mode not in ("RGB", "RGBA"):
                    logger.info(f"Converting image mode from {img.mode} to RGBA")
                    img = img.convert("RGBA")

                # Save as WebP
                output = io.BytesIO()
                img.save(output, format="WEBP", quality=quality, method=6)
                output.seek(0)

                webp_bytes = output.read()
                logger.info(f"Converted image to WebP ({len(webp_bytes)} bytes)")
                return webp_bytes

        except Exception as e:
            logger.error(f"Failed to convert image to WebP: {e}")
            raise ValueError(f"Image conversion failed: {str(e)}")

    @staticmethod
    def convert_for_canvas(image_bytes: bytes) -> Tuple[bytes, str]:
        """
        Convert image to canvas-compatible format.

        Canvas (browser) supports PNG, JPEG, WebP, and GIF.

        Args:
            image_bytes: Raw image bytes

        Returns:
            Tuple of (converted_bytes, mime_type)

        Raises:
            ValueError: If conversion fails
        """
        detected_format = ImageConverter.detect_format(image_bytes)
        logger.info(f"Detected image format for canvas: {detected_format}")

        # Map format to MIME type
        format_to_mime = {
            "PNG": "image/png",
            "JPEG": "image/jpeg",
            "WEBP": "image/webp",
            "GIF": "image/gif",
        }

        # If already canvas-compatible, return as-is
        if detected_format in CANVAS_COMPATIBLE_FORMATS:
            mime_type = format_to_mime.get(detected_format, "image/png")
            logger.info(f"Image already canvas-compatible: {detected_format}")
            return image_bytes, mime_type

        # Convert to PNG for canvas (best compatibility)
        logger.info(f"Converting {detected_format} to PNG for canvas compatibility")
        png_bytes = ImageConverter.convert_to_png(image_bytes)
        return png_bytes, "image/png"

    @staticmethod
    def get_image_info(image_bytes: bytes) -> dict:
        """
        Get information about an image.

        Args:
            image_bytes: Raw image bytes

        Returns:
            Dictionary with image information
        """
        try:
            detected_format = ImageConverter.detect_format(image_bytes)

            with Image.open(io.BytesIO(image_bytes)) as img:
                return {
                    "format": detected_format,
                    "mode": img.mode,
                    "width": img.width,
                    "height": img.height,
                    "size_bytes": len(image_bytes),
                    "gemini_compatible": detected_format in GEMINI_COMPATIBLE_FORMATS,
                    "canvas_compatible": detected_format in CANVAS_COMPATIBLE_FORMATS,
                }
        except Exception as e:
            logger.error(f"Failed to get image info: {e}")
            return {
                "format": "UNKNOWN",
                "error": str(e),
            }
