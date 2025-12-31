"""SVG generator - creates SVG from canvas state."""

import svgwrite
from typing import Any
import logging
import base64
import re

logger = logging.getLogger(__name__)


class SVGGenerator:
    """Generate SVG from canvas state (fabric.js JSON)."""

    # Fabric.js canvas uses 3 pixels per mm (matches frontend SCALE constant)
    PIXELS_PER_MM = 3.0

    def __init__(self, width_mm: float, height_mm: float, vectorize_images: bool = False):
        """
        Initialize generator.

        Args:
            width_mm: Canvas width in millimeters
            height_mm: Canvas height in millimeters
            vectorize_images: If True, automatically vectorize raster images to paths
        """
        self.width_mm = width_mm
        self.height_mm = height_mm
        self.vectorize_images = vectorize_images

    def generate(self, canvas_json: dict) -> str:
        """
        Generate SVG from fabric.js canvas JSON.

        Args:
            canvas_json: Canvas state from fabric.js toJSON()

        Returns:
            SVG document as string
        """
        dwg = svgwrite.Drawing(
            size=(f"{self.width_mm}mm", f"{self.height_mm}mm"),
            viewBox=f"0 0 {self.width_mm} {self.height_mm}",
        )

        objects = canvas_json.get("objects", [])

        for obj in objects:
            obj_type = obj.get("type", "")

            if obj_type == "path":
                self._add_path(dwg, obj)
            elif obj_type == "rect":
                self._add_rect(dwg, obj)
            elif obj_type == "circle":
                self._add_circle(dwg, obj)
            elif obj_type == "ellipse":
                self._add_ellipse(dwg, obj)
            elif obj_type == "line":
                self._add_line(dwg, obj)
            elif obj_type == "polyline":
                self._add_polyline(dwg, obj)
            elif obj_type == "polygon":
                self._add_polygon(dwg, obj)
            elif obj_type in ("text", "i-text", "textbox"):
                self._add_text(dwg, obj)
            elif obj_type.lower() == "image":  # Case-insensitive check for Fabric.js "Image" type
                self._add_image(dwg, obj)
            else:
                logger.debug(f"Unknown object type: {obj_type}")

        return dwg.tostring()

    def _px_to_mm(self, px: float) -> float:
        """Convert pixels to millimeters."""
        return px / self.PIXELS_PER_MM

    def _get_transform(self, obj: dict) -> str:
        """Build SVG transform string from fabric.js object properties."""
        transforms = []

        # Convert pixel coordinates to mm
        left = self._px_to_mm(obj.get("left", 0))
        top = self._px_to_mm(obj.get("top", 0))
        angle = obj.get("angle", 0)
        scaleX = obj.get("scaleX", 1)
        scaleY = obj.get("scaleY", 1)

        if left != 0 or top != 0:
            transforms.append(f"translate({left},{top})")

        if angle != 0:
            transforms.append(f"rotate({angle})")

        if scaleX != 1 or scaleY != 1:
            transforms.append(f"scale({scaleX},{scaleY})")

        return " ".join(transforms) if transforms else None

    def _get_stroke_props(self, obj: dict) -> dict:
        """Extract stroke properties."""
        props = {}

        stroke = obj.get("stroke")
        if stroke and stroke != "transparent":
            props["stroke"] = stroke
        else:
            props["stroke"] = "black"

        stroke_width = obj.get("strokeWidth", 1)
        props["stroke_width"] = stroke_width

        # For plotter, we typically want no fill
        props["fill"] = "none"

        return props

    def _add_path(self, dwg: svgwrite.Drawing, obj: dict):
        """Add path element."""
        path_data = obj.get("path", [])

        if not path_data:
            return

        # Convert fabric.js path array to SVG d string with pixel-to-mm conversion
        d_parts = []
        for segment in path_data:
            if isinstance(segment, list) and segment:
                cmd = segment[0]
                params = segment[1:]
                # Convert coordinate parameters from pixels to mm
                converted_params = [self._px_to_mm(p) if isinstance(p, (int, float)) else p for p in params]
                d_parts.append(f"{cmd} {' '.join(str(p) for p in converted_params)}")

        d = " ".join(d_parts)

        props = self._get_stroke_props(obj)
        transform = self._get_transform(obj)

        path = dwg.path(d=d, **props)
        if transform:
            path.attribs["transform"] = transform

        dwg.add(path)

    def _add_rect(self, dwg: svgwrite.Drawing, obj: dict):
        """Add rectangle element."""
        width = self._px_to_mm(obj.get("width", 0))
        height = self._px_to_mm(obj.get("height", 0))

        props = self._get_stroke_props(obj)
        transform = self._get_transform(obj)

        # Adjust for origin (fabric.js uses center by default for some objects)
        origin_x = obj.get("originX", "left")
        origin_y = obj.get("originY", "top")

        x = -width / 2 if origin_x == "center" else 0
        y = -height / 2 if origin_y == "center" else 0

        rect = dwg.rect(insert=(x, y), size=(width, height), **props)
        if transform:
            rect.attribs["transform"] = transform

        dwg.add(rect)

    def _add_circle(self, dwg: svgwrite.Drawing, obj: dict):
        """Add circle element."""
        radius = self._px_to_mm(obj.get("radius", 0))

        props = self._get_stroke_props(obj)
        transform = self._get_transform(obj)

        circle = dwg.circle(center=(0, 0), r=radius, **props)
        if transform:
            circle.attribs["transform"] = transform

        dwg.add(circle)

    def _add_ellipse(self, dwg: svgwrite.Drawing, obj: dict):
        """Add ellipse element."""
        rx = self._px_to_mm(obj.get("rx", 0))
        ry = self._px_to_mm(obj.get("ry", 0))

        props = self._get_stroke_props(obj)
        transform = self._get_transform(obj)

        ellipse = dwg.ellipse(center=(0, 0), r=(rx, ry), **props)
        if transform:
            ellipse.attribs["transform"] = transform

        dwg.add(ellipse)

    def _add_line(self, dwg: svgwrite.Drawing, obj: dict):
        """Add line element."""
        x1 = self._px_to_mm(obj.get("x1", 0))
        y1 = self._px_to_mm(obj.get("y1", 0))
        x2 = self._px_to_mm(obj.get("x2", 0))
        y2 = self._px_to_mm(obj.get("y2", 0))

        props = self._get_stroke_props(obj)
        transform = self._get_transform(obj)

        line = dwg.line(start=(x1, y1), end=(x2, y2), **props)
        if transform:
            line.attribs["transform"] = transform

        dwg.add(line)

    def _add_polyline(self, dwg: svgwrite.Drawing, obj: dict):
        """Add polyline element."""
        points = obj.get("points", [])

        if not points:
            return

        # Convert to list of tuples with pixel-to-mm conversion
        point_tuples = [(self._px_to_mm(p.get("x", 0)), self._px_to_mm(p.get("y", 0))) for p in points]

        props = self._get_stroke_props(obj)
        transform = self._get_transform(obj)

        polyline = dwg.polyline(points=point_tuples, **props)
        if transform:
            polyline.attribs["transform"] = transform

        dwg.add(polyline)

    def _add_polygon(self, dwg: svgwrite.Drawing, obj: dict):
        """Add polygon element."""
        points = obj.get("points", [])

        if not points:
            return

        # Convert to list of tuples with pixel-to-mm conversion
        point_tuples = [(self._px_to_mm(p.get("x", 0)), self._px_to_mm(p.get("y", 0))) for p in points]

        props = self._get_stroke_props(obj)
        transform = self._get_transform(obj)

        polygon = dwg.polygon(points=point_tuples, **props)
        if transform:
            polygon.attribs["transform"] = transform

        dwg.add(polygon)

    def _add_text(self, dwg: svgwrite.Drawing, obj: dict):
        """
        Add text element.

        Note: For accurate plotter output, text should be converted to paths
        on the frontend before sending to backend.
        """
        text_content = obj.get("text", "")
        font_family = obj.get("fontFamily", "Arial")
        # Convert font size from pixels to mm
        font_size = self._px_to_mm(obj.get("fontSize", 12))

        props = self._get_stroke_props(obj)
        transform = self._get_transform(obj)

        # Basic text element (plotter can't render fonts directly)
        # This is a placeholder - real implementation needs text-to-path conversion
        text = dwg.text(
            text_content,
            insert=(0, 0),
            font_family=font_family,
            font_size=font_size,
            **props,
        )
        if transform:
            text.attribs["transform"] = transform

        dwg.add(text)
        logger.warning("Text element added - should be converted to paths for accurate plotting")

    def _add_image(self, dwg: svgwrite.Drawing, obj: dict):
        """
        Add embedded raster image to SVG.

        If vectorize_images is enabled, converts the raster image to vector paths.
        Otherwise, embeds the raster image as-is (not plottable).

        Args:
            dwg: SVG drawing object
            obj: Fabric.js image object
        """
        from ..image.converter import ImageConverter
        from ..image.vectorizer import ImageVectorizer
        from xml.etree import ElementTree as ET

        # Get image source (data URL)
        src = obj.get("src", "")
        if not src:
            logger.warning("Image object has no src, skipping")
            return

        # Extract image data from data URL
        # Format: data:image/png;base64,iVBORw0KG...
        data_url_match = re.match(r"data:image/([^;]+);base64,(.+)", src)
        if not data_url_match:
            logger.warning("Image src is not a data URL, skipping")
            return

        image_format = data_url_match.group(1)
        base64_data = data_url_match.group(2)

        try:
            # Decode base64 image data
            image_bytes = base64.b64decode(base64_data)

            # If vectorization is enabled, convert image to paths
            if self.vectorize_images:
                logger.info("Vectorizing raster image to SVG paths")
                try:
                    vectorized_svg = ImageVectorizer.vectorize(image_bytes, turdsize=2, opttolerance=0.2)

                    # Parse the vectorized SVG and extract paths
                    vector_root = ET.fromstring(vectorized_svg)

                    # Get image position and scaling
                    left = obj.get("left", 0)
                    top = obj.get("top", 0)
                    width = obj.get("width", 100)
                    height = obj.get("height", 100)
                    scaleX = obj.get("scaleX", 1)
                    scaleY = obj.get("scaleY", 1)
                    angle = obj.get("angle", 0)

                    # Calculate actual dimensions
                    actual_width = width * scaleX
                    actual_height = height * scaleY

                    # Adjust for origin
                    origin_x = obj.get("originX", "left")
                    origin_y = obj.get("originY", "top")
                    x = left - (actual_width / 2 if origin_x == "center" else 0)
                    y = top - (actual_height / 2 if origin_y == "center" else 0)

                    # Create group for transformed paths
                    group = dwg.g()

                    # Find all path elements in vectorized SVG
                    for path_elem in vector_root.iter("{http://www.w3.org/2000/svg}path"):
                        path_d = path_elem.get("d", "")
                        if path_d:
                            # Create path with stroke only (no fill for plotting)
                            path = dwg.path(d=path_d, fill="none", stroke="black", stroke_width=1)
                            group.add(path)

                    # Apply transform to group (position, scale, rotation)
                    transforms = []
                    if x != 0 or y != 0:
                        transforms.append(f"translate({x},{y})")

                    # Get viewBox from vectorized SVG for scaling
                    viewBox = vector_root.get("viewBox")
                    if viewBox:
                        parts = viewBox.split()
                        if len(parts) == 4:
                            vb_width = float(parts[2])
                            vb_height = float(parts[3])
                            scale_x = actual_width / vb_width
                            scale_y = actual_height / vb_height
                            transforms.append(f"scale({scale_x},{scale_y})")

                    if angle != 0:
                        center_x = actual_width / 2
                        center_y = actual_height / 2
                        transforms.append(f"rotate({angle} {center_x} {center_y})")

                    if transforms:
                        group.attribs["transform"] = " ".join(transforms)

                    dwg.add(group)
                    logger.info("Image successfully vectorized and added as paths")
                    return

                except Exception as e:
                    logger.error(f"Failed to vectorize image: {e}")
                    logger.warning("Falling back to raster embedding")

            # Convert to PNG for consistent embedding (if not already PNG)
            detected_format = ImageConverter.detect_format(image_bytes)
            logger.info(f"Embedding image in SVG: format={detected_format}")

            if detected_format != "PNG":
                logger.info(f"Converting {detected_format} to PNG for SVG embedding")
                image_bytes = ImageConverter.convert_to_png(image_bytes)
                image_format = "png"

            # Re-encode as base64
            base64_encoded = base64.b64encode(image_bytes).decode("ascii")
            embedded_data = f"data:image/{image_format};base64,{base64_encoded}"

        except Exception as e:
            logger.error(f"Failed to process image for SVG embedding: {e}")
            # Fallback: use original data URL
            embedded_data = src

        # Get image dimensions and position (in pixels from Fabric.js)
        width = obj.get("width", 100)
        height = obj.get("height", 100)
        scaleX = obj.get("scaleX", 1)
        scaleY = obj.get("scaleY", 1)

        # Calculate actual dimensions with scaling (still in pixels)
        actual_width_px = width * scaleX
        actual_height_px = height * scaleY

        # Convert to millimeters
        actual_width = self._px_to_mm(actual_width_px)
        actual_height = self._px_to_mm(actual_height_px)

        # Get position (in pixels) and convert to mm
        left = self._px_to_mm(obj.get("left", 0))
        top = self._px_to_mm(obj.get("top", 0))

        # Adjust for origin
        origin_x = obj.get("originX", "left")
        origin_y = obj.get("originY", "top")

        x = left - (actual_width / 2 if origin_x == "center" else 0)
        y = top - (actual_height / 2 if origin_y == "center" else 0)

        # Get rotation
        angle = obj.get("angle", 0)

        # Create image element
        image = dwg.image(
            href=embedded_data,
            insert=(x, y),
            size=(actual_width, actual_height),
        )

        # Apply rotation if needed
        if angle != 0:
            # Rotate around the center of the image
            center_x = x + actual_width / 2
            center_y = y + actual_height / 2
            image.attribs["transform"] = f"rotate({angle} {center_x} {center_y})"

        dwg.add(image)
        logger.warning(
            "Raster image embedded in SVG. For best plotting results, "
            "consider vectorizing the image first (convert to paths)."
        )
