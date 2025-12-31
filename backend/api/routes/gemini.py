"""Gemini AI image generation API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import base64
import logging

from config import get_settings
from core.gemini.client import GeminiClient
from core.image.preprocessor import ImagePreprocessor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gemini", tags=["gemini"])


class GenerateRequest(BaseModel):
    """Request to generate an image."""
    prompt: str
    style: Optional[str] = None  # 'line_art', 'sketch', 'minimal', 'detailed'
    width: int = 512
    height: int = 512


class EditRequest(BaseModel):
    """Request to edit an image."""
    image_base64: str
    prompt: str
    mask_base64: Optional[str] = None


class ProcessImageRequest(BaseModel):
    """Request to process/vectorize an uploaded image."""
    image_base64: str
    style: Optional[str] = "line_art"  # 'line_art', 'sketch', 'minimal', 'detailed'
    custom_prompt: Optional[str] = None  # Optional custom instructions
    remove_background: bool = False  # Remove white background before processing
    threshold: int = 250  # Background removal threshold (0-255)
    padding: int = 10  # Padding around content in pixels


class ImageResponse(BaseModel):
    """Image generation response."""
    image_base64: str
    prompt_used: str


@router.post("/generate", response_model=ImageResponse)
async def generate_image(request: GenerateRequest):
    """Generate an image from text prompt using Gemini."""
    settings = get_settings()

    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=400,
            detail="Gemini API key not configured. Set GEMINI_API_KEY environment variable.",
        )

    try:
        client = GeminiClient(settings.gemini_api_key)
        image_bytes = await client.generate_image(
            prompt=request.prompt,
            style=request.style,
            width=request.width,
            height=request.height,
        )

        return ImageResponse(
            image_base64=base64.b64encode(image_bytes).decode(),
            prompt_used=request.prompt,
        )

    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini package not installed: {e}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Image generation failed: {e}",
        )


@router.post("/edit", response_model=ImageResponse)
async def edit_image(request: EditRequest):
    """Edit an existing image with prompt using Gemini."""
    settings = get_settings()

    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=400,
            detail="Gemini API key not configured. Set GEMINI_API_KEY environment variable.",
        )

    try:
        client = GeminiClient(settings.gemini_api_key)

        image_bytes = base64.b64decode(request.image_base64)
        mask_bytes = (
            base64.b64decode(request.mask_base64)
            if request.mask_base64
            else None
        )

        edited_bytes = await client.edit_image(
            image_bytes=image_bytes,
            prompt=request.prompt,
            mask_bytes=mask_bytes,
        )

        return ImageResponse(
            image_base64=base64.b64encode(edited_bytes).decode(),
            prompt_used=request.prompt,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Image editing failed: {e}",
        )


@router.post("/process-image", response_model=ImageResponse)
async def process_image(request: ProcessImageRequest):
    """Process a raster image into line art suitable for pen plotting."""
    logger.info(f"=== NEW IMAGE PROCESSING REQUEST === Style: {request.style}, Custom: {bool(request.custom_prompt)}, RemoveBG: {request.remove_background}")

    settings = get_settings()

    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=400,
            detail="Gemini API key not configured. Set GEMINI_API_KEY environment variable.",
        )

    try:
        client = GeminiClient(settings.gemini_api_key)

        image_bytes = base64.b64decode(request.image_base64)

        # Build prompt based on style and custom instructions
        if request.custom_prompt:
            prompt = request.custom_prompt
        else:
            style_prompts = {
                "line_art": (
                    "Recreate this image as a clean line art illustration. "
                    "Use bold, uniform black outlines to define all major shapes and objects. "
                    "Simplify details into clear geometric forms. Use absolutely no shading - "
                    "just clean outlines like a coloring book page."
                ),
                "sketch": (
                    "Recreate this image as a hand-drawn sketch with expressive linework. "
                    "Vary the line weights - thicker lines for emphasis and foreground, thinner lines for details. "
                    "Use loose, gestural strokes that feel organic and artistic. "
                    "Add minimal shading using only parallel hatching lines where needed for depth."
                ),
                "minimal": (
                    "Recreate this image in an extremely minimal, simplified style. "
                    "Reduce the subject to its absolute essential shapes using the fewest possible lines. "
                    "Think of iconic logos or pictograms - just the core silhouette and key features. "
                    "No shading, no texture, no unnecessary details. Pure, elegant simplicity."
                ),
                "detailed": (
                    "Recreate this image as an intricate pen and ink illustration. "
                    "Use extensive cross-hatching and parallel line work to create rich tonal values and textures. "
                    "Show depth through careful line density - closer hatching for darker areas, "
                    "sparser hatching for lighter tones. Think of vintage engraving or etching techniques. "
                    "Still no solid fills - everything must be achieved through line work only."
                ),
            }
            prompt = style_prompts.get(request.style, style_prompts["line_art"])

        # Use edit_image which already has plotter-specific enhancements
        processed_bytes = await client.edit_image(
            image_bytes=image_bytes,
            prompt=prompt,
        )

        # Preprocess AFTER Gemini processing (when white is truly background)
        if request.remove_background:
            try:
                logger.info(f"Preprocessing after Gemini: threshold={request.threshold}, padding={request.padding}")
                content_percentage = ImagePreprocessor.estimate_content_percentage(processed_bytes, request.threshold)
                logger.info(f"Estimated content: {content_percentage:.1f}%")

                processed_bytes = ImagePreprocessor.remove_background_and_crop(
                    processed_bytes,
                    threshold=request.threshold,
                    padding=request.padding,
                )
                logger.info("Background removed and image cropped after AI processing")
            except ValueError as e:
                logger.warning(f"Post-processing failed, using Gemini output as-is: {e}")

        return ImageResponse(
            image_base64=base64.b64encode(processed_bytes).decode(),
            prompt_used=prompt,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Image processing failed: {e}",
        )


@router.get("/status")
async def check_status():
    """Check if Gemini API is configured."""
    settings = get_settings()

    return {
        "configured": bool(settings.gemini_api_key),
        "message": (
            "Gemini API is configured"
            if settings.gemini_api_key
            else "Set GEMINI_API_KEY environment variable to enable AI image generation"
        ),
    }
