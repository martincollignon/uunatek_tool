"""Gemini API client for image generation."""

import base64
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class GeminiClient:
    """Client for Gemini API image generation using the latest google-genai SDK."""

    def __init__(self, api_key: str):
        """
        Initialize Gemini client.

        Args:
            api_key: Gemini API key
        """
        self.api_key = api_key
        self._client = None

    async def _ensure_client(self):
        """Lazily initialize the Gemini client."""
        if self._client is None:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except ImportError:
                raise ImportError("google-genai package not installed. Install with: pip install google-genai")

    async def generate_image(
        self,
        prompt: str,
        style: Optional[str] = None,
        width: int = 512,
        height: int = 512,
    ) -> bytes:
        """
        Generate an image from text prompt using Gemini 3 Pro Image.

        Args:
            prompt: Text description of desired image
            style: Style hint ('line_art', 'sketch', 'minimal', 'detailed')
            width: Desired image width (for aspect ratio calculation)
            height: Desired image height (for aspect ratio calculation)

        Returns:
            PNG image bytes
        """
        await self._ensure_client()

        # Enhance prompt for pen plotter output
        enhanced_prompt = self._enhance_prompt_for_plotter(prompt, style)

        from google.genai import types

        # Calculate aspect ratio from width/height
        aspect_ratio = self._calculate_aspect_ratio(width, height)

        # Use Gemini 3 Pro Image model with resolution parameter
        response = await self._client.aio.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[enhanced_prompt],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(
                    aspect_ratio=aspect_ratio,
                    image_size="1K",  # "1K", "2K", "4K" - Using 1K for pen plotter simplicity
                ),
            ),
        )

        # Extract image from response using new API pattern
        for part in response.parts:
            # Check for inline image data
            if part.inline_data is not None:
                # Open the image from inline data bytes
                import io
                from PIL import Image

                # part.inline_data.data contains the raw image bytes
                image = Image.open(io.BytesIO(part.inline_data.data))
                buffer = io.BytesIO()
                image.save(buffer, format='PNG')
                image_bytes = buffer.getvalue()
                logger.debug(f"Image data extracted: {len(image_bytes)} bytes")
                return image_bytes

        raise ValueError("No image in response from Gemini")

    async def generate_image_for_icon(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
    ) -> bytes:
        """
        Generate an app icon image without plotter-specific styling.

        Args:
            prompt: Text description of desired icon
            width: Desired image width (for aspect ratio calculation)
            height: Desired image height (for aspect ratio calculation)

        Returns:
            PNG image bytes
        """
        await self._ensure_client()

        from google.genai import types

        # Calculate aspect ratio from width/height
        aspect_ratio = self._calculate_aspect_ratio(width, height)

        # Use Gemini 3 Pro Image model without plotter-specific enhancements
        response = await self._client.aio.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(
                    aspect_ratio=aspect_ratio,
                    image_size="1K",  # Using 1K for faster generation
                ),
            ),
        )

        # Extract image from response using new API pattern
        for part in response.parts:
            # Check for inline image data
            if part.inline_data is not None:
                # Open the image from inline data bytes
                import io
                from PIL import Image

                # part.inline_data.data contains the raw image bytes
                image = Image.open(io.BytesIO(part.inline_data.data))
                buffer = io.BytesIO()
                image.save(buffer, format='PNG')
                image_bytes = buffer.getvalue()
                logger.debug(f"Image data extracted: {len(image_bytes)} bytes")
                return image_bytes

        raise ValueError("No image in response from Gemini")

    async def edit_image(
        self,
        image_bytes: bytes,
        prompt: str,
        mask_bytes: Optional[bytes] = None,
    ) -> bytes:
        """
        Edit an existing image based on prompt using Gemini 2.5 Flash Image.

        Args:
            image_bytes: Original image as bytes (any format)
            prompt: Edit instruction
            mask_bytes: Optional mask for inpainting (not used in current implementation)

        Returns:
            Edited PNG image bytes
        """
        await self._ensure_client()

        from google.genai import types
        from PIL import Image
        import io

        # Convert image to Gemini-compatible format
        from ..image.converter import ImageConverter

        try:
            logger.debug("Converting image to Gemini-compatible format")
            image_bytes = ImageConverter.convert_for_gemini(image_bytes, preferred_format="PNG")
        except Exception as e:
            logger.warning(f"Image conversion failed, attempting to use original: {e}")

        # Load image using PIL for proper handling
        image = Image.open(io.BytesIO(image_bytes))

        # Add timestamp to prevent caching
        import time
        timestamp = int(time.time() * 1000)

        # Enhance edit prompt for plotter output with VERY explicit instructions
        # Put style description FIRST, then strict technical requirements
        # Add unique identifier to prevent API caching
        edit_prompt = (
            f"[Request ID: {timestamp}] "
            f"{prompt} "
            "The output image must use ONLY black lines on a white background. "
            "NO blue, NO colors, NO grays - ONLY pure black (#000000) and pure white (#FFFFFF). "
            "The color scheme is strictly black and white. "
            f"Recreate the exact same composition from the provided image in this style.\n\n"
            "CRITICAL TECHNICAL REQUIREMENTS:\n"
            "- Use ONLY black ink color for all lines and marks\n"
            "- Background must be pure white with zero texture\n"
            "- NO blue lines, NO colored lines, NO gray shading\n"
            "- All shading done through black line techniques: hatching, cross-hatching, stippling\n"
            "- Keep all recognizable features and details that define the subject\n"
            "- Think pen and ink drawing or woodcut print style\n"
            "- Suitable for a pen plotter machine to draw with a single black pen\n"
            "- Use clear, confident strokes with moderate detail level\n"
            "- Preserve important details that make the subject identifiable\n"
            "- Avoid excessive tiny lines or ultra-fine patterns, but maintain characteristic features"
        )

        # Log the full prompt for debugging
        logger.info(f"Processing image with Gemini. Full prompt:\n{edit_prompt}")
        logger.info(f"Image size: {image.size}, mode: {image.mode}")

        # Use Gemini 3 Pro Image with both text and image
        # Order: PROMPT FIRST, then image (as per official examples)
        # Add temperature to reduce caching and increase variety
        response = await self._client.aio.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[edit_prompt, image],  # Prompt first, image second
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                temperature=1.0,  # Higher temperature for more variety, less caching
                image_config=types.ImageConfig(
                    image_size="1K",  # Using 1K for pen plotter - simpler output, faster generation
                ),
            ),
        )

        # Extract image from response using new API pattern
        for part in response.parts:
            # Check for inline image data
            if part.inline_data is not None:
                # Open the image from inline data bytes
                from PIL import Image as PILImage

                # part.inline_data.data contains the raw image bytes
                result_image = PILImage.open(io.BytesIO(part.inline_data.data))
                buffer = io.BytesIO()
                result_image.save(buffer, format='PNG')
                result_bytes = buffer.getvalue()
                logger.info(f"Received image from Gemini: {len(result_bytes)} bytes")

                # Log image properties to debug color issues
                try:
                    logger.info(f"Result image: size={result_image.size}, mode={result_image.mode}, format={result_image.format}")

                    # Check if image has colors
                    if result_image.mode in ('RGB', 'RGBA'):
                        import numpy as np
                        img_array = np.array(result_image)
                        unique_colors = len(np.unique(img_array.reshape(-1, img_array.shape[2]), axis=0))
                        logger.warning(f"Result has {unique_colors} unique colors - not pure black and white!")

                except Exception as e:
                    logger.warning(f"Could not analyze result image: {e}")

                return result_bytes

        raise ValueError("No image in response from Gemini")

    def _calculate_aspect_ratio(self, width: int, height: int) -> str:
        """
        Calculate the closest supported aspect ratio.

        Supported ratios: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
        """
        ratio = width / height

        # Map to closest supported aspect ratio
        aspect_ratios = {
            1.0: "1:1",
            0.67: "2:3",
            1.5: "3:2",
            0.75: "3:4",
            1.33: "4:3",
            0.8: "4:5",
            1.25: "5:4",
            0.56: "9:16",
            1.78: "16:9",
            2.33: "21:9",
        }

        # Find closest ratio
        closest = min(aspect_ratios.keys(), key=lambda x: abs(x - ratio))
        return aspect_ratios[closest]

    def _enhance_prompt_for_plotter(
        self, prompt: str, style: Optional[str] = None
    ) -> str:
        """Enhance prompt for pen plotter-suitable output."""
        style_instructions = {
            "line_art": "Create as clean line art with bold outlines, suitable for pen plotting.",
            "sketch": "Create as a sketch with varied line weights, suitable for pen plotting.",
            "minimal": "Create as minimal line drawing with simple shapes, suitable for pen plotting.",
            "detailed": "Create as detailed line illustration with cross-hatching for shading, suitable for pen plotting.",
        }

        base_instruction = style_instructions.get(
            style or "line_art",
            "Create as high-contrast black and white line art suitable for pen plotting.",
        )

        return (
            f"{prompt}. {base_instruction} "
            "IMPORTANT: This image will be used by a physical pen plotter machine. "
            "Use ONLY black line outlines on a pure white background. "
            "Create vector-style line drawings, NOT raster images or photographs. "
            "No gradients, no shading with fills, no solid black areas. "
            "All shading must be done with line techniques (hatching, cross-hatching, stippling with dots/lines). "
            "Make lines clear, distinct, and continuous so a pen can physically draw them. "
            "Think of it as a drawing made by a single pen on white paper. "
            "Use moderate detail that preserves recognizability while being plotter-friendly. "
            "Keep characteristic features that make the subject identifiable."
        )
