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

    def __init__(self, width_mm: float, height_mm: float, vectorize_images: bool = False, include_boundary: bool = True, safety_margin_mm: float = 0.0):
        """
        Initialize generator.

        Args:
            width_mm: Canvas width in millimeters
            height_mm: Canvas height in millimeters
            vectorize_images: If True, automatically vectorize raster images to paths
            include_boundary: If True, include canvas boundary in output (for preview). If False, exclude it (for plotting).
            safety_margin_mm: Safety margin in mm - content is clipped to stay this distance from paper edges.
        """
        self.width_mm = width_mm
        self.height_mm = height_mm
        self.vectorize_images = vectorize_images
        self.include_boundary = include_boundary
        self.safety_margin_mm = safety_margin_mm
        self.warnings: list[str] = []

    def generate(self, canvas_json: dict) -> str:
        """
        Generate SVG from fabric.js canvas JSON.

        Args:
            canvas_json: Canvas state from fabric.js toJSON()

        Returns:
            SVG document as string
        """
        # Reset warnings for this generation
        self.warnings = []

        dwg = svgwrite.Drawing(
            size=(f"{self.width_mm}mm", f"{self.height_mm}mm"),
            viewBox=f"0 0 {self.width_mm} {self.height_mm}",
        )

        objects = canvas_json.get("objects", [])

        # If safety margin is specified, create a clip path and wrap content in a clipped group
        content_target = dwg  # Default: add directly to drawing
        if self.safety_margin_mm > 0:
            # Create defs section with clip path
            clip_path = dwg.clipPath(id="safetyMargin")
            clip_rect = dwg.rect(
                insert=(self.safety_margin_mm, self.safety_margin_mm),
                size=(
                    self.width_mm - 2 * self.safety_margin_mm,
                    self.height_mm - 2 * self.safety_margin_mm
                )
            )
            clip_path.add(clip_rect)
            dwg.defs.add(clip_path)

            # Create a group with the clip path applied - all content goes here
            clipped_group = dwg.g(clip_path="url(#safetyMargin)")
            content_target = clipped_group

        for obj in objects:
            # Skip canvas boundary and safety boundary if not including them (for plotting)
            obj_name = obj.get("name", "")
            if obj_name in ("canvas-boundary", "safety-boundary") and not self.include_boundary:
                continue

            obj_type = obj.get("type", "").lower()  # Case-insensitive comparison for all types

            if obj_type == "path":
                self._add_path(content_target, obj)
            elif obj_type == "rect":
                self._add_rect(content_target, obj)
            elif obj_type == "circle":
                self._add_circle(content_target, obj)
            elif obj_type == "ellipse":
                self._add_ellipse(content_target, obj)
            elif obj_type == "line":
                self._add_line(content_target, obj)
            elif obj_type == "polyline":
                self._add_polyline(content_target, obj)
            elif obj_type == "polygon":
                self._add_polygon(content_target, obj)
            elif obj_type in ("text", "i-text", "textbox"):
                self._add_text(content_target, obj)
            elif obj_type == "image":
                self._add_image(content_target, obj)
            elif obj_type == "group":
                self._add_group(content_target, obj)
            else:
                logger.debug(f"Unknown object type: {obj_type}")

        # If using safety margin, add the clipped group to the drawing
        if self.safety_margin_mm > 0:
            dwg.add(clipped_group)

        return dwg.tostring()

    def generate_with_warnings(self, canvas_json: dict) -> tuple[str, list[str]]:
        """
        Generate SVG from fabric.js canvas JSON and return warnings.

        Args:
            canvas_json: Canvas state from fabric.js toJSON()

        Returns:
            Tuple of (SVG document as string, list of warning messages)
        """
        svg_content = self.generate(canvas_json)
        return svg_content, self.warnings

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

        # Handle fill: respect transparent, otherwise use none for plotter
        fill = obj.get("fill")
        if fill == "transparent" or fill == "none":
            props["fill"] = "none"
        elif fill:
            props["fill"] = fill
        else:
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
            path['transform'] = transform

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
            rect['transform'] = transform

        dwg.add(rect)

    def _add_circle(self, dwg: svgwrite.Drawing, obj: dict):
        """Add circle element."""
        radius = self._px_to_mm(obj.get("radius", 0))

        props = self._get_stroke_props(obj)
        transform = self._get_transform(obj)

        circle = dwg.circle(center=(0, 0), r=radius, **props)
        if transform:
            circle['transform'] = transform

        dwg.add(circle)

    def _add_ellipse(self, dwg: svgwrite.Drawing, obj: dict):
        """Add ellipse element."""
        rx = self._px_to_mm(obj.get("rx", 0))
        ry = self._px_to_mm(obj.get("ry", 0))

        props = self._get_stroke_props(obj)
        transform = self._get_transform(obj)

        ellipse = dwg.ellipse(center=(0, 0), r=(rx, ry), **props)
        if transform:
            ellipse['transform'] = transform

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
            line['transform'] = transform

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
            polyline['transform'] = transform

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
            polygon['transform'] = transform

        dwg.add(polygon)

    def _add_text(self, dwg: svgwrite.Drawing, obj: dict):
        """
        Add text element converted to paths.

        Converts text to vector paths using text rendering so it can be plotted accurately.
        """
        try:
            from ..svg.text_to_path import convert_text_to_path

            text_content = obj.get("text", "")
            font_family = obj.get("fontFamily", "Arial")
            # Convert font size from pixels to mm
            font_size = self._px_to_mm(obj.get("fontSize", 12))
            font_weight = obj.get("fontWeight", "normal")
            font_style = obj.get("fontStyle", "normal")

            # Get transform and position
            transform = self._get_transform(obj)
            stroke = obj.get("stroke") or obj.get("fill", "black")
            stroke_width = obj.get("strokeWidth", 1)

            # Convert text to path (returns tuple of path_data, warning)
            path_data, warning = convert_text_to_path(
                text_content,
                font_family,
                font_size,
                font_weight,
                font_style,
            )

            if path_data:
                # Create path element
                path = dwg.path(
                    d=path_data,
                    stroke=stroke,
                    stroke_width=stroke_width,
                    fill="none",
                )
                if transform:
                    path['transform'] = transform

                dwg.add(path)
                logger.info(f"Text '{text_content[:20]}...' converted to path")

                # Add warning if there was a partial failure
                if warning:
                    self.warnings.append(f"Text conversion warning: {warning}")
            else:
                # Fallback: add as text element with stroke
                self._add_text_fallback(dwg, obj)
                # Add the specific warning from conversion
                if warning:
                    self.warnings.append(f"Text conversion failed: {warning}")
                else:
                    self.warnings.append("Text may not plot accurately - consider converting to paths")

        except Exception as e:
            logger.error(f"Failed to convert text to path: {e}")
            # Fallback to text element
            self._add_text_fallback(dwg, obj)
            self.warnings.append(f"Text conversion error: {str(e)}")

    def _add_text_fallback(self, dwg: svgwrite.Drawing, obj: dict):
        """
        Add text element as fallback when path conversion fails.
        Uses SVG text element with stroke so plotter can trace the outline.
        """
        text_content = obj.get("text", "")
        font_family = obj.get("fontFamily", "Arial")
        # Convert font size from pixels to mm
        font_size = self._px_to_mm(obj.get("fontSize", 12))
        font_weight = obj.get("fontWeight", "normal")
        font_style = obj.get("fontStyle", "normal")

        transform = self._get_transform(obj)
        stroke = obj.get("stroke") or obj.get("fill", "black")
        stroke_width = obj.get("strokeWidth", 1)

        # Create text element with stroke for plotter
        text = dwg.text(
            text_content,
            insert=(0, 0),
            font_family=font_family,
            font_size=f"{font_size}mm",
            font_weight=font_weight,
            font_style=font_style,
            stroke=stroke,
            stroke_width=stroke_width,
            fill="none",  # Only stroke for plotter
        )
        if transform:
            text['transform'] = transform

        dwg.add(text)
        logger.warning(
            f"Text element '{text_content[:20]}...' added as SVG text - "
            "path conversion unavailable. For best plotting results, convert text to paths."
        )

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

                    # Get image dimensions (convert from pixels to mm)
                    width = self._px_to_mm(obj.get("width", 100))
                    height = self._px_to_mm(obj.get("height", 100))

                    # Adjust for origin
                    origin_x = obj.get("originX", "left")
                    origin_y = obj.get("originY", "top")

                    x = -width / 2 if origin_x == "center" else 0
                    y = -height / 2 if origin_y == "center" else 0

                    # Create group for transformed paths
                    group = dwg.g()

                    # Find all path elements in vectorized SVG
                    for path_elem in vector_root.iter("{http://www.w3.org/2000/svg}path"):
                        path_d = path_elem.get("d", "")
                        if path_d:
                            # Preserve fill from vectorized SVG, or use black if not specified
                            fill = path_elem.get("fill", "black")
                            stroke = path_elem.get("stroke", "none")
                            stroke_width = path_elem.get("stroke-width", "0")

                            # Create path preserving original fill/stroke
                            path = dwg.path(
                                d=path_d,
                                fill=fill,
                                stroke=stroke,
                                stroke_width=stroke_width
                            )
                            group.add(path)

                    # Get viewBox from vectorized SVG and apply scaling to match desired size
                    viewBox = vector_root.get("viewBox")
                    if viewBox:
                        parts = viewBox.split()
                        if len(parts) == 4:
                            vb_width = float(parts[2])
                            vb_height = float(parts[3])
                            # Scale vectorized SVG to match the image dimensions
                            scale_x = width / vb_width
                            scale_y = height / vb_height

                            # Build transform: first scale to size, then position at origin offset
                            inner_transforms = []
                            inner_transforms.append(f"scale({scale_x},{scale_y})")
                            if x != 0 or y != 0:
                                inner_transforms.append(f"translate({x/scale_x},{y/scale_y})")

                            group['transform'] = " ".join(inner_transforms)

                    # Apply the standard Fabric.js transform (position, rotation, scale)
                    outer_transform = self._get_transform(obj)
                    if outer_transform:
                        # Wrap in another group for the outer transform
                        outer_group = dwg.g()
                        outer_group['transform'] = outer_transform
                        outer_group.add(group)
                        dwg.add(outer_group)
                    else:
                        dwg.add(group)

                    logger.info("Image successfully vectorized and added as paths")
                    return

                except Exception as e:
                    logger.error(f"Failed to vectorize image: {e}")
                    logger.warning("Falling back to raster embedding")
                    # Don't add warning here, will add it in raster fallback section

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

        # Get image dimensions (in pixels from Fabric.js, without scaling)
        width = self._px_to_mm(obj.get("width", 100))
        height = self._px_to_mm(obj.get("height", 100))

        # Adjust for origin - image element always starts at top-left
        # but Fabric.js might use a different origin
        origin_x = obj.get("originX", "left")
        origin_y = obj.get("originY", "top")

        x = -width / 2 if origin_x == "center" else 0
        y = -height / 2 if origin_y == "center" else 0

        # Create image element at origin-adjusted position
        image = dwg.image(
            href=embedded_data,
            insert=(x, y),
            size=(width, height),
        )

        # Apply the standard Fabric.js transform (position, rotation, scale)
        transform = self._get_transform(obj)
        if transform:
            image['transform'] = transform

        dwg.add(image)
        logger.warning(
            "Raster image embedded in SVG. For best plotting results, "
            "consider vectorizing the image first (convert to paths)."
        )
        # Add warning since we're using raster fallback
        self.warnings.append("Raster image detected - may not plot")

    def _add_group(self, dwg: svgwrite.Drawing, obj: dict):
        """
        Add group element.

        Groups in Fabric.js contain multiple objects positioned relative to the group.
        We need to handle the group's transform and then recursively add each child object.
        """
        # Get group's objects
        objects = obj.get("objects", [])
        if not objects:
            return

        # Debug: Log group properties
        logger.info(f"Processing group: left={obj.get('left')}, top={obj.get('top')}, "
                   f"originX={obj.get('originX')}, originY={obj.get('originY')}, "
                   f"angle={obj.get('angle')}, scaleX={obj.get('scaleX')}, scaleY={obj.get('scaleY')}")
        logger.info(f"Group has {len(objects)} children")

        # Create SVG group
        group = dwg.g()

        # IMPORTANT: For Fabric.js groups, child coordinates are already absolute
        # The group's left/top/angle are handled by Fabric.js internally
        # but when serialized, children retain absolute coordinates
        # So we should NOT apply the group's transform - children are already positioned correctly
        logger.info(f"Group: NOT applying transform, children have absolute coordinates")

        # Process each child object
        for i, child_obj in enumerate(objects):
            child_type = child_obj.get("type", "").lower()  # Case-insensitive comparison

            # Debug: Log first child's path data
            if i == 0 and child_type == "path":
                path_data = child_obj.get("path", [])
                if path_data and len(path_data) > 0:
                    logger.info(f"First child path starts at: {path_data[0]}")

            if child_type == "path":
                self._add_path_to_group(dwg, group, child_obj)
            elif child_type == "rect":
                self._add_rect_to_group(dwg, group, child_obj)
            elif child_type == "circle":
                self._add_circle_to_group(dwg, group, child_obj)
            elif child_type == "ellipse":
                self._add_ellipse_to_group(dwg, group, child_obj)
            elif child_type == "line":
                self._add_line_to_group(dwg, group, child_obj)
            elif child_type == "polyline":
                self._add_polyline_to_group(dwg, group, child_obj)
            elif child_type == "polygon":
                self._add_polygon_to_group(dwg, group, child_obj)
            elif child_type == "image":
                self._add_image_to_group(dwg, group, child_obj)
            else:
                logger.debug(f"Unknown group child type: {child_type}")

        dwg.add(group)

    def _add_path_to_group(self, dwg: svgwrite.Drawing, group: svgwrite.container.Group, obj: dict):
        """Add path element to a group."""
        path_data = obj.get("path", [])
        if not path_data:
            return

        # Convert fabric.js path array to SVG d string with pixel-to-mm conversion
        d_parts = []
        for segment in path_data:
            if isinstance(segment, list) and segment:
                cmd = segment[0]
                params = segment[1:]
                converted_params = [self._px_to_mm(p) if isinstance(p, (int, float)) else p for p in params]
                d_parts.append(f"{cmd} {' '.join(str(p) for p in converted_params)}")

        d = " ".join(d_parts)
        props = self._get_stroke_props(obj)

        # NOTE: Child objects in a group should NOT have their individual transforms applied
        # The group's transform handles positioning. Child coordinates are relative to the group.

        path = dwg.path(d=d, **props)
        group.add(path)

    def _add_rect_to_group(self, dwg: svgwrite.Drawing, group: svgwrite.container.Group, obj: dict):
        """Add rectangle element to a group."""
        width = self._px_to_mm(obj.get("width", 0))
        height = self._px_to_mm(obj.get("height", 0))

        props = self._get_stroke_props(obj)

        origin_x = obj.get("originX", "left")
        origin_y = obj.get("originY", "top")

        x = -width / 2 if origin_x == "center" else 0
        y = -height / 2 if origin_y == "center" else 0

        rect = dwg.rect(insert=(x, y), size=(width, height), **props)
        group.add(rect)

    def _add_circle_to_group(self, dwg: svgwrite.Drawing, group: svgwrite.container.Group, obj: dict):
        """Add circle element to a group."""
        radius = self._px_to_mm(obj.get("radius", 0))

        props = self._get_stroke_props(obj)

        circle = dwg.circle(center=(0, 0), r=radius, **props)
        group.add(circle)

    def _add_ellipse_to_group(self, dwg: svgwrite.Drawing, group: svgwrite.container.Group, obj: dict):
        """Add ellipse element to a group."""
        rx = self._px_to_mm(obj.get("rx", 0))
        ry = self._px_to_mm(obj.get("ry", 0))

        props = self._get_stroke_props(obj)

        ellipse = dwg.ellipse(center=(0, 0), r=(rx, ry), **props)
        group.add(ellipse)

    def _add_line_to_group(self, dwg: svgwrite.Drawing, group: svgwrite.container.Group, obj: dict):
        """Add line element to a group."""
        x1 = self._px_to_mm(obj.get("x1", 0))
        y1 = self._px_to_mm(obj.get("y1", 0))
        x2 = self._px_to_mm(obj.get("x2", 0))
        y2 = self._px_to_mm(obj.get("y2", 0))

        props = self._get_stroke_props(obj)

        line = dwg.line(start=(x1, y1), end=(x2, y2), **props)
        group.add(line)

    def _add_polyline_to_group(self, dwg: svgwrite.Drawing, group: svgwrite.container.Group, obj: dict):
        """Add polyline element to a group."""
        points = obj.get("points", [])
        if not points:
            return

        point_tuples = [(self._px_to_mm(p.get("x", 0)), self._px_to_mm(p.get("y", 0))) for p in points]

        props = self._get_stroke_props(obj)

        polyline = dwg.polyline(points=point_tuples, **props)
        group.add(polyline)

    def _add_polygon_to_group(self, dwg: svgwrite.Drawing, group: svgwrite.container.Group, obj: dict):
        """Add polygon element to a group."""
        points = obj.get("points", [])
        if not points:
            return

        point_tuples = [(self._px_to_mm(p.get("x", 0)), self._px_to_mm(p.get("y", 0))) for p in points]

        props = self._get_stroke_props(obj)

        polygon = dwg.polygon(points=point_tuples, **props)
        group.add(polygon)

    def _add_image_to_group(self, dwg: svgwrite.Drawing, group: svgwrite.container.Group, obj: dict):
        """
        Add image element to a group.

        If vectorize_images is enabled, converts the raster image to vector paths.
        Otherwise, embeds the raster image as-is.
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
                logger.info("Vectorizing raster image in group to SVG paths")
                try:
                    vectorized_svg = ImageVectorizer.vectorize(image_bytes, turdsize=2, opttolerance=0.2)

                    # Parse the vectorized SVG and extract paths
                    vector_root = ET.fromstring(vectorized_svg)

                    # Get image dimensions (convert from pixels to mm)
                    width = self._px_to_mm(obj.get("width", 100))
                    height = self._px_to_mm(obj.get("height", 100))

                    # Adjust for origin
                    origin_x = obj.get("originX", "left")
                    origin_y = obj.get("originY", "top")

                    x = -width / 2 if origin_x == "center" else 0
                    y = -height / 2 if origin_y == "center" else 0

                    # Create nested group for vectorized paths
                    img_group = dwg.g()

                    # Find all path elements in vectorized SVG
                    for path_elem in vector_root.iter("{http://www.w3.org/2000/svg}path"):
                        path_d = path_elem.get("d", "")
                        if path_d:
                            # Preserve fill from vectorized SVG, or use black if not specified
                            fill = path_elem.get("fill", "black")
                            stroke = path_elem.get("stroke", "none")
                            stroke_width = path_elem.get("stroke-width", "0")

                            # Create path preserving original fill/stroke
                            path = dwg.path(
                                d=path_d,
                                fill=fill,
                                stroke=stroke,
                                stroke_width=stroke_width
                            )
                            img_group.add(path)

                    # Get viewBox from vectorized SVG and apply scaling
                    viewBox = vector_root.get("viewBox")
                    if viewBox:
                        parts = viewBox.split()
                        if len(parts) == 4:
                            vb_width = float(parts[2])
                            vb_height = float(parts[3])
                            scale_x = width / vb_width
                            scale_y = height / vb_height

                            # Build transform: scale to size, then position at origin offset
                            inner_transforms = []
                            inner_transforms.append(f"scale({scale_x},{scale_y})")
                            if x != 0 or y != 0:
                                inner_transforms.append(f"translate({x/scale_x},{y/scale_y})")

                            img_group['transform'] = " ".join(inner_transforms)

                    # Apply the standard Fabric.js transform for the image
                    outer_transform = self._get_transform(obj)
                    if outer_transform:
                        # Wrap in another group for outer transform
                        wrapper = dwg.g()
                        wrapper['transform'] = outer_transform
                        wrapper.add(img_group)
                        group.add(wrapper)
                    else:
                        group.add(img_group)

                    logger.info("Image in group successfully vectorized and added as paths")
                    return

                except Exception as e:
                    logger.error(f"Failed to vectorize image in group: {e}")
                    logger.warning("Falling back to raster embedding")
                    self.warnings.append("Raster image detected - may not plot")

            # Fallback: embed as raster image
            detected_format = ImageConverter.detect_format(image_bytes)
            logger.info(f"Embedding image in group as raster: format={detected_format}")

            if detected_format != "PNG":
                logger.info(f"Converting {detected_format} to PNG for SVG embedding")
                image_bytes = ImageConverter.convert_to_png(image_bytes)
                image_format = "png"

            # Re-encode as base64
            base64_encoded = base64.b64encode(image_bytes).decode("ascii")
            embedded_data = f"data:image/{image_format};base64,{base64_encoded}"

        except Exception as e:
            logger.error(f"Failed to process image for group embedding: {e}")
            embedded_data = src

        # Get image dimensions (without scaling)
        width = self._px_to_mm(obj.get("width", 100))
        height = self._px_to_mm(obj.get("height", 100))

        # Adjust for origin
        origin_x = obj.get("originX", "left")
        origin_y = obj.get("originY", "top")

        x = -width / 2 if origin_x == "center" else 0
        y = -height / 2 if origin_y == "center" else 0

        # Create image element
        image = dwg.image(
            href=embedded_data,
            insert=(x, y),
            size=(width, height),
        )

        # NOTE: Child objects in a group should NOT have their individual transforms applied
        group.add(image)

        logger.warning("Raster image embedded in group - may not plot correctly")
        if not self.vectorize_images:
            self.warnings.append("Raster image detected - may not plot")
