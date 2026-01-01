"""Image preprocessing utilities for background removal and cropping."""

import io
import logging
from typing import Tuple, Optional
from PIL import Image, ImageChops, ImageFilter
import numpy as np

logger = logging.getLogger(__name__)


class ImagePreprocessor:
    """Handles image preprocessing operations like background removal and cropping."""

    @staticmethod
    def remove_background_and_crop(
        image_bytes: bytes,
        threshold: int = 250,
        padding: int = 10,
        blur_radius: int = 1,
    ) -> bytes:
        """
        Remove white/light background from image and crop to content bounds.

        This is particularly useful for preparing images for pen plotting, as it:
        - Removes unnecessary white space that would waste plotting time
        - Ensures the plotter only draws the actual content
        - Makes the final vector output cleaner

        Args:
            image_bytes: Input image bytes
            threshold: Brightness threshold for considering a pixel as "background" (0-255)
                      Higher = more aggressive removal. Default 250 (nearly white)
            padding: Pixels to add around the detected content bounds (default: 10)
            blur_radius: Radius for edge smoothing (default: 1, 0 = no blur)

        Returns:
            Processed PNG image bytes with background removed and cropped

        Raises:
            ValueError: If image processing fails
        """
        try:
            # Open image
            with Image.open(io.BytesIO(image_bytes)) as img:
                # Apply EXIF orientation if present
                try:
                    from PIL import ImageOps
                    img = ImageOps.exif_transpose(img)
                    logger.info("Applied EXIF orientation correction")
                except Exception as e:
                    logger.debug(f"No EXIF orientation data or failed to apply: {e}")

                original_mode = img.mode
                original_size = img.size
                logger.info(f"Processing image: {original_size}, mode: {original_mode}")

                # Convert to RGBA for consistent processing
                if img.mode != "RGBA":
                    img = img.convert("RGBA")

                # Get image data as numpy array for easier manipulation
                img_array = np.array(img)

                # Calculate brightness for each pixel (average of RGB)
                # Shape: (height, width)
                if img.mode == "RGBA":
                    brightness = img_array[:, :, :3].mean(axis=2)
                else:
                    brightness = img_array.mean(axis=2) if len(img_array.shape) == 3 else img_array

                # Create mask: True where pixel is darker than threshold (i.e., content)
                content_mask = brightness < threshold

                # Find bounding box of content
                rows = np.any(content_mask, axis=1)
                cols = np.any(content_mask, axis=0)

                # Check if there's any content
                if not np.any(rows) or not np.any(cols):
                    logger.warning("No content detected after background removal - returning original")
                    return image_bytes

                # Get bounds
                row_min, row_max = np.where(rows)[0][[0, -1]]
                col_min, col_max = np.where(cols)[0][[0, -1]]

                # Add padding (but don't exceed image bounds)
                row_min = max(0, row_min - padding)
                row_max = min(img.height - 1, row_max + padding)
                col_min = max(0, col_min - padding)
                col_max = min(img.width - 1, col_max + padding)

                # Crop to content bounds
                cropped = img.crop((col_min, row_min, col_max + 1, row_max + 1))

                logger.info(
                    f"Background removal: {original_size} -> {cropped.size} "
                    f"(saved {100 - (cropped.width * cropped.height * 100 / (original_size[0] * original_size[1])):.1f}% area)"
                )

                # Optional: Apply slight blur to smooth edges
                if blur_radius > 0:
                    cropped = cropped.filter(ImageFilter.GaussianBlur(radius=blur_radius))

                # Convert to RGB with white background for final output
                # This ensures compatibility with formats that don't support transparency
                final_img = Image.new("RGB", cropped.size, (255, 255, 255))
                if cropped.mode == "RGBA":
                    final_img.paste(cropped, mask=cropped.split()[3])  # Use alpha channel as mask
                else:
                    final_img.paste(cropped)

                # Save as PNG
                output = io.BytesIO()
                final_img.save(output, format="PNG", optimize=True)
                output.seek(0)

                result_bytes = output.read()
                logger.info(f"Preprocessing complete: {len(image_bytes)} -> {len(result_bytes)} bytes")
                return result_bytes

        except Exception as e:
            logger.error(f"Failed to preprocess image: {e}")
            raise ValueError(f"Image preprocessing failed: {str(e)}")

    @staticmethod
    def auto_crop_to_content(
        image_bytes: bytes,
        threshold: int = 250,
        padding: int = 10,
    ) -> bytes:
        """
        Crop image to content bounds without removing background.

        Args:
            image_bytes: Input image bytes
            threshold: Brightness threshold for detecting content edges (0-255)
            padding: Pixels to add around the detected content bounds

        Returns:
            Cropped PNG image bytes

        Raises:
            ValueError: If image processing fails
        """
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                original_size = img.size

                # Convert to grayscale for edge detection
                gray = img.convert("L")

                # Get numpy array
                gray_array = np.array(gray)

                # Find content (pixels darker than threshold)
                content_mask = gray_array < threshold

                # Find bounding box
                rows = np.any(content_mask, axis=1)
                cols = np.any(content_mask, axis=0)

                if not np.any(rows) or not np.any(cols):
                    logger.warning("No content detected for cropping - returning original")
                    return image_bytes

                row_min, row_max = np.where(rows)[0][[0, -1]]
                col_min, col_max = np.where(cols)[0][[0, -1]]

                # Add padding
                row_min = max(0, row_min - padding)
                row_max = min(img.height - 1, row_max + padding)
                col_min = max(0, col_min - padding)
                col_max = min(img.width - 1, col_max + padding)

                # Crop
                cropped = img.crop((col_min, row_min, col_max + 1, row_max + 1))

                logger.info(f"Auto-crop: {original_size} -> {cropped.size}")

                # Save as PNG
                output = io.BytesIO()
                cropped.save(output, format="PNG", optimize=True)
                output.seek(0)

                return output.read()

        except Exception as e:
            logger.error(f"Failed to auto-crop image: {e}")
            raise ValueError(f"Image cropping failed: {str(e)}")

    @staticmethod
    def get_content_bounds(
        image_bytes: bytes,
        threshold: int = 250,
    ) -> Optional[Tuple[int, int, int, int]]:
        """
        Get bounding box of content in image.

        Args:
            image_bytes: Input image bytes
            threshold: Brightness threshold for detecting content

        Returns:
            Tuple of (left, top, right, bottom) or None if no content detected
        """
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                gray = img.convert("L")
                gray_array = np.array(gray)

                content_mask = gray_array < threshold
                rows = np.any(content_mask, axis=1)
                cols = np.any(content_mask, axis=0)

                if not np.any(rows) or not np.any(cols):
                    return None

                row_min, row_max = np.where(rows)[0][[0, -1]]
                col_min, col_max = np.where(cols)[0][[0, -1]]

                return (col_min, row_min, col_max, row_max)

        except Exception as e:
            logger.error(f"Failed to get content bounds: {e}")
            return None

    @staticmethod
    def estimate_content_percentage(image_bytes: bytes, threshold: int = 250) -> float:
        """
        Estimate what percentage of the image is actual content vs background.

        Args:
            image_bytes: Input image bytes
            threshold: Brightness threshold for detecting content

        Returns:
            Percentage of pixels considered content (0.0 to 100.0)
        """
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                gray = img.convert("L")
                gray_array = np.array(gray)

                content_mask = gray_array < threshold
                content_pixels = np.sum(content_mask)
                total_pixels = gray_array.size

                percentage = (content_pixels / total_pixels) * 100
                logger.debug(f"Content percentage: {percentage:.1f}%")

                return percentage

        except Exception as e:
            logger.error(f"Failed to estimate content percentage: {e}")
            return 100.0  # Assume full content on error
