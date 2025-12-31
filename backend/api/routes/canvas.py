"""Canvas API routes."""

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from typing import Any
from pydantic import BaseModel
import base64
import uuid
import logging

from api.routes.projects import get_project_by_id, save_project
from core.svg.generator import SVGGenerator
from core.image.converter import ImageConverter
from core.image.preprocessor import ImagePreprocessor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/canvas", tags=["canvas"])

# Storage for uploaded images
_uploaded_images: dict[str, bytes] = {}


class CanvasSaveRequest(BaseModel):
    """Request to save canvas state."""
    canvas_json: dict[str, Any]
    side: str = "front"  # 'front', 'back', 'envelope'


class CanvasResponse(BaseModel):
    """Canvas state response."""
    canvas_json: dict[str, Any] | None
    width_mm: float
    height_mm: float


@router.get("/{project_id}", response_model=CanvasResponse)
async def get_canvas(project_id: str, side: str = "front") -> CanvasResponse:
    """Get canvas state for a project."""
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    canvas_json = None
    if side == "front":
        canvas_json = project.canvas_front
    elif side == "back":
        canvas_json = project.canvas_back
    elif side == "envelope":
        canvas_json = project.canvas_envelope

    return CanvasResponse(
        canvas_json=canvas_json,
        width_mm=project.width_mm,
        height_mm=project.height_mm,
    )


@router.put("/{project_id}")
async def save_canvas(project_id: str, request: CanvasSaveRequest):
    """Save canvas state for a project."""
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if request.side == "front":
        project.canvas_front = request.canvas_json
    elif request.side == "back":
        project.canvas_back = request.canvas_json
    elif request.side == "envelope":
        project.canvas_envelope = request.canvas_json
    else:
        raise HTTPException(status_code=400, detail="Invalid side")

    from datetime import datetime
    project.updated_at = datetime.utcnow()
    save_project(project)

    return {"status": "saved"}


@router.post("/{project_id}/upload")
async def upload_image(
    project_id: str,
    file: UploadFile = File(...),
    remove_background: bool = Query(default=False, description="Remove white background and crop to content"),
    threshold: int = Query(default=250, ge=0, le=255, description="Background removal threshold (0-255)"),
    padding: int = Query(default=10, ge=0, le=100, description="Padding around content in pixels"),
):
    """
    Upload an image file and convert to canvas-compatible format.

    Args:
        project_id: Project ID
        file: Image file to upload
        remove_background: If True, remove white background and auto-crop to content
        threshold: Brightness threshold for background removal (0-255, higher = more aggressive)
        padding: Pixels to add around detected content
    """
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Read file content
    content = await file.read()

    # Get image info
    image_info = ImageConverter.get_image_info(content)
    logger.info(f"Uploading image: {file.filename}, format: {image_info.get('format')}")

    # Preprocess image if requested
    if remove_background:
        try:
            logger.info(f"Preprocessing image: threshold={threshold}, padding={padding}")
            content_percentage = ImagePreprocessor.estimate_content_percentage(content, threshold)
            logger.info(f"Estimated content: {content_percentage:.1f}%")

            content = ImagePreprocessor.remove_background_and_crop(
                content,
                threshold=threshold,
                padding=padding,
            )
            logger.info("Background removed and image cropped")
        except ValueError as e:
            logger.warning(f"Preprocessing failed, using original: {e}")

    # Convert to canvas-compatible format if needed
    try:
        converted_content, mime_type = ImageConverter.convert_for_canvas(content)
        logger.info(f"Image converted for canvas: {mime_type}")
    except ValueError as e:
        logger.error(f"Failed to convert image: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")

    # Generate unique ID for the image
    image_id = str(uuid.uuid4())
    _uploaded_images[image_id] = converted_content

    # Return URL for the image
    return {
        "image_id": image_id,
        "url": f"/api/canvas/images/{image_id}",
        "filename": file.filename,
        "size": len(converted_content),
        "original_format": image_info.get("format"),
        "converted_format": mime_type,
        "preprocessed": remove_background,
    }


@router.get("/images/{image_id}")
async def get_image(image_id: str):
    """Get an uploaded image."""
    if image_id not in _uploaded_images:
        raise HTTPException(status_code=404, detail="Image not found")

    content = _uploaded_images[image_id]

    # Detect content type (simple check)
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        media_type = "image/png"
    elif content[:2] == b"\xff\xd8":
        media_type = "image/jpeg"
    elif content[:6] in (b"GIF87a", b"GIF89a"):
        media_type = "image/gif"
    else:
        media_type = "application/octet-stream"

    return Response(content=content, media_type=media_type)


@router.get("/{project_id}/export/svg")
async def export_svg(project_id: str, side: str = "front", mode: str = "preview"):
    """
    Export canvas as SVG.

    Args:
        project_id: Project ID
        side: Which side to export (front, back, envelope)
        mode: Export mode - "preview" includes canvas boundary, "plot" excludes it
    """
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    canvas_json = None
    if side == "front":
        canvas_json = project.canvas_front
    elif side == "back":
        canvas_json = project.canvas_back
    elif side == "envelope":
        canvas_json = project.canvas_envelope

    if not canvas_json:
        raise HTTPException(status_code=400, detail=f"No canvas data for side: {side}")

    # Include boundary for preview, exclude for plotting
    include_boundary = (mode == "preview")
    generator = SVGGenerator(project.width_mm, project.height_mm, include_boundary=include_boundary)
    svg_content = generator.generate(canvas_json)

    return Response(
        content=svg_content,
        media_type="image/svg+xml",
        headers={"Content-Disposition": f"attachment; filename={project.name}_{side}.svg"},
    )
