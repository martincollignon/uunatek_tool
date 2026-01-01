"""Canvas API routes."""

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from typing import Any
from pydantic import BaseModel
import base64
import uuid
import logging
import os
import time
import tempfile
import json
from pathlib import Path
from datetime import datetime, timedelta

from api.routes.projects import get_project_by_id, save_project
from core.svg.generator import SVGGenerator
from core.image.converter import ImageConverter
from core.image.preprocessor import ImagePreprocessor
from config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/canvas", tags=["canvas"])

# File-based image storage configuration
# Use absolute path in system temp directory instead of relative path
_DEFAULT_STORAGE_DIR = Path(tempfile.gettempdir()) / "pen-plotter-images"
_IMAGE_STORAGE_DIR = Path(os.getenv("IMAGE_STORAGE_DIR", str(_DEFAULT_STORAGE_DIR)))
_IMAGE_MAX_AGE_HOURS = int(os.getenv("IMAGE_MAX_AGE_HOURS", "24"))

# Ensure storage directory exists
try:
    _IMAGE_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Image storage directory: {_IMAGE_STORAGE_DIR}")
except Exception as e:
    logger.error(f"Failed to create image storage directory: {e}")
    raise

# Mapping of image_id to project_id for lifecycle management
_image_to_project: dict[str, str] = {}


def _get_image_path(image_id: str) -> Path:
    """Get the file path for an image ID."""
    return _IMAGE_STORAGE_DIR / f"{image_id}.bin"


def _save_image_to_disk(image_id: str, content: bytes, project_id: str) -> None:
    """
    Save image content to disk and track its association with a project.

    Args:
        image_id: Unique image identifier
        content: Image binary content
        project_id: Associated project ID
    """
    image_path = _get_image_path(image_id)
    try:
        image_path.write_bytes(content)
        _image_to_project[image_id] = project_id
        logger.info(f"Saved image {image_id} to disk ({len(content)} bytes) for project {project_id}")
    except Exception as e:
        logger.error(f"Failed to save image {image_id} to disk: {e}")
        raise


def _load_image_from_disk(image_id: str) -> bytes:
    """
    Load image content from disk.

    Args:
        image_id: Unique image identifier

    Returns:
        Image binary content

    Raises:
        FileNotFoundError: If image file doesn't exist
    """
    image_path = _get_image_path(image_id)
    if not image_path.exists():
        raise FileNotFoundError(f"Image {image_id} not found")

    try:
        content = image_path.read_bytes()
        logger.debug(f"Loaded image {image_id} from disk ({len(content)} bytes)")
        return content
    except Exception as e:
        logger.error(f"Failed to load image {image_id} from disk: {e}")
        raise


def _cleanup_old_images() -> int:
    """
    Clean up old images that exceed the maximum age.

    Returns:
        Number of images cleaned up
    """
    cleaned = 0
    cutoff_time = datetime.now() - timedelta(hours=_IMAGE_MAX_AGE_HOURS)

    try:
        for image_file in _IMAGE_STORAGE_DIR.glob("*.bin"):
            try:
                # Check file modification time
                mtime = datetime.fromtimestamp(image_file.stat().st_mtime)
                if mtime < cutoff_time:
                    image_id = image_file.stem
                    image_file.unlink()
                    # Remove from tracking dict
                    _image_to_project.pop(image_id, None)
                    cleaned += 1
                    logger.info(f"Cleaned up old image: {image_id}")
            except Exception as e:
                logger.error(f"Failed to clean up image {image_file}: {e}")

        if cleaned > 0:
            logger.info(f"Cleaned up {cleaned} old images")

    except Exception as e:
        logger.error(f"Error during image cleanup: {e}")

    return cleaned


def _cleanup_project_images(project_id: str) -> int:
    """
    Clean up all images associated with a specific project.

    Args:
        project_id: Project ID

    Returns:
        Number of images cleaned up
    """
    cleaned = 0

    # Find all images for this project
    images_to_delete = [
        img_id for img_id, proj_id in _image_to_project.items()
        if proj_id == project_id
    ]

    for image_id in images_to_delete:
        try:
            image_path = _get_image_path(image_id)
            if image_path.exists():
                image_path.unlink()
                cleaned += 1
            _image_to_project.pop(image_id, None)
            logger.info(f"Cleaned up project image: {image_id}")
        except Exception as e:
            logger.error(f"Failed to clean up project image {image_id}: {e}")

    if cleaned > 0:
        logger.info(f"Cleaned up {cleaned} images for project {project_id}")

    return cleaned


class CanvasSaveRequest(BaseModel):
    """Request to save canvas state."""
    canvas_json: dict[str, Any]
    side: str = "front"  # 'front', 'back', 'envelope'


class CanvasResponse(BaseModel):
    """Canvas state response."""
    canvas_json: dict[str, Any] | None
    width_mm: float
    height_mm: float


@router.get("/debug/{project_id}")
async def debug_canvas_json(project_id: str, side: str = "front"):
    """
    Debug endpoint: Return the raw canvas JSON currently stored.
    This helps diagnose serialization issues.
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
        return {
            "project_id": project_id,
            "side": side,
            "canvas_json": None,
            "object_count": 0,
            "objects": []
        }

    objects = canvas_json.get("objects", [])
    object_summary = []

    for i, obj in enumerate(objects):
        obj_type = obj.get("type", "unknown")
        obj_name = obj.get("name", "unnamed")
        obj_info = {
            "index": i,
            "type": obj_type,
            "name": obj_name,
            "selectable": obj.get("selectable"),
            "evented": obj.get("evented"),
            "excludeFromExport": obj.get("excludeFromExport", False),
        }

        # For groups, include child info
        if obj_type == "group":
            children = obj.get("objects", [])
            obj_info["child_count"] = len(children)
            obj_info["children"] = [
                {"type": child.get("type", "unknown"), "name": child.get("name", "unnamed")}
                for child in children
            ]

        object_summary.append(obj_info)

    return {
        "project_id": project_id,
        "side": side,
        "object_count": len(objects),
        "objects": object_summary,
        "full_canvas_json": canvas_json
    }


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

    # Debug: Log received canvas JSON structure
    canvas_json = request.canvas_json
    objects = canvas_json.get("objects", [])
    logger.info(f"Saving canvas for project {project_id}, side {request.side}")
    logger.info(f"Received {len(objects)} objects in canvas JSON")

    # Log each object type and key properties
    for i, obj in enumerate(objects):
        obj_type = obj.get("type", "unknown")
        obj_name = obj.get("name", "unnamed")
        exclude = obj.get("excludeFromExport", False)
        logger.info(f"  Object {i}: type={obj_type}, name={obj_name}, excludeFromExport={exclude}")

        # For groups, log children and transform
        if obj_type.lower() == "group":
            objects_in_group = obj.get("objects", [])
            left = obj.get("left", 0)
            top = obj.get("top", 0)
            angle = obj.get("angle", 0)
            scaleX = obj.get("scaleX", 1)
            scaleY = obj.get("scaleY", 1)
            logger.info(f"    Group transform: left={left}, top={top}, angle={angle}, scaleX={scaleX}, scaleY={scaleY}")
            logger.info(f"    Group contains {len(objects_in_group)} children")
            for j, child in enumerate(objects_in_group):
                child_type = child.get("type", "unknown")
                child_left = child.get("left", 0)
                child_top = child.get("top", 0)
                logger.info(f"      Child {j}: type={child_type}, left={child_left}, top={child_top}")

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

    # Save to disk instead of memory
    _save_image_to_disk(image_id, converted_content, project_id)

    # Trigger cleanup of old images (async, non-blocking)
    try:
        _cleanup_old_images()
    except Exception as e:
        logger.error(f"Failed to cleanup old images: {e}")

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
    """Get an uploaded image from disk."""
    try:
        content = _load_image_from_disk(image_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Image not found")
    except Exception as e:
        logger.error(f"Failed to load image {image_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load image")

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


@router.delete("/{project_id}/images")
async def cleanup_project_images(project_id: str):
    """Clean up all images associated with a project."""
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    cleaned = _cleanup_project_images(project_id)
    return {"status": "success", "images_cleaned": cleaned}


@router.post("/cleanup")
async def cleanup_old_images_endpoint():
    """Manually trigger cleanup of old images."""
    cleaned = _cleanup_old_images()
    return {"status": "success", "images_cleaned": cleaned}


@router.get("/{project_id}/export/svg")
async def export_svg(project_id: str, side: str = "front", mode: str = "preview", format: str = "json"):
    """
    Export canvas as SVG.

    Args:
        project_id: Project ID
        side: Which side to export (front, back, envelope)
        mode: Export mode - "preview" includes canvas boundary, "plot" excludes it
        format: Response format - "json" for JSON with warnings, "svg" for plain SVG (for backward compatibility)
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
    # Vectorize images to make them plottable (converts raster to vector paths)
    include_boundary = (mode == "preview")

    # If preview mode, manually add boundary to canvas JSON
    # (boundary is excluded from saved JSON to prevent z-index issues)
    if include_boundary:
        # Add boundary as first object (will be rendered at the back)
        canvas_json_with_boundary = canvas_json.copy()
        objects = canvas_json_with_boundary.get("objects", [])

        # Create boundary object matching frontend (3 pixels per mm)
        boundary_obj = {
            "type": "rect",
            "left": 0,
            "top": 0,
            "width": project.width_mm * 3,  # Match frontend SCALE constant
            "height": project.height_mm * 3,
            "fill": "transparent",
            "stroke": "#3b82f6",
            "strokeWidth": 2,
            "name": "canvas-boundary",
        }

        # Insert boundary at the beginning (renders first = back)
        canvas_json_with_boundary["objects"] = [boundary_obj] + objects
        canvas_json = canvas_json_with_boundary

    # Apply safety margin clipping for both preview and plot mode
    # This ensures preview shows exactly what will be plotted (clipped at safety margin)
    settings = get_settings()

    generator = SVGGenerator(
        project.width_mm,
        project.height_mm,
        vectorize_images=True,
        include_boundary=include_boundary,
        safety_margin_mm=settings.safety_margin_mm
    )

    try:
        svg_content, warnings = generator.generate_with_warnings(canvas_json)
    except Exception as e:
        logger.error(f"Error generating SVG: {e}")
        logger.error(f"Canvas JSON: {json.dumps(canvas_json, indent=2)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"SVG generation failed: {str(e)}")

    # Return JSON format by default, with backward compatibility for SVG format
    if format == "svg":
        return Response(
            content=svg_content,
            media_type="image/svg+xml",
            headers={"Content-Disposition": f"attachment; filename={project.name}_{side}.svg"},
        )

    # Return JSON with SVG and warnings
    return {
        "svg": svg_content,
        "warnings": warnings,
    }
