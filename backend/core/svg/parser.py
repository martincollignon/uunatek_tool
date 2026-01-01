"""SVG parser - converts SVG paths to plotter commands."""

import re
import math
from typing import Generator, Optional
from xml.etree import ElementTree as ET
from dataclasses import dataclass
import logging
import numpy as np

try:
    from svgpathtools import parse_path, Line, CubicBezier, QuadraticBezier, Arc
    SVGPATHTOOLS_AVAILABLE = True
except ImportError:
    SVGPATHTOOLS_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class PlotCommand:
    """A single plotting command."""
    type: str  # 'move', 'line', 'pen_up', 'pen_down'
    x: float = 0  # mm
    y: float = 0  # mm


class SVGParser:
    """Parse SVG content into plotter commands."""

    SVG_NS = {"svg": "http://www.w3.org/2000/svg"}

    def __init__(self, scale_factor: float = 1.0):
        """
        Initialize parser.

        Args:
            scale_factor: Multiply all coordinates by this factor
        """
        self.scale_factor = scale_factor

    def _parse_transform(self, transform_str: str) -> np.ndarray:
        """
        Parse SVG transform attribute into a transformation matrix.

        Supports: translate(x, y), rotate(angle [cx, cy]), scale(x [y]), matrix(a, b, c, d, e, f)

        Args:
            transform_str: SVG transform attribute value

        Returns:
            3x3 transformation matrix (homogeneous coordinates)
        """
        # Start with identity matrix
        matrix = np.eye(3)

        if not transform_str:
            return matrix

        # Find all transform functions
        # Pattern matches: function_name(args)
        transform_pattern = r'(\w+)\s*\(([^)]+)\)'
        matches = re.findall(transform_pattern, transform_str)

        for func_name, args_str in matches:
            # Parse numeric arguments
            args = [float(x.strip()) for x in re.findall(r'-?[\d.]+', args_str)]

            if func_name == 'translate':
                # translate(x [y])
                tx = args[0] if len(args) > 0 else 0
                ty = args[1] if len(args) > 1 else 0
                transform_matrix = np.array([
                    [1, 0, tx],
                    [0, 1, ty],
                    [0, 0, 1]
                ])

            elif func_name == 'rotate':
                # rotate(angle [cx cy])
                # Angle is in degrees, convert to radians
                angle = math.radians(args[0])
                cos_a = math.cos(angle)
                sin_a = math.sin(angle)

                if len(args) == 3:
                    # rotate around center point (cx, cy)
                    cx, cy = args[1], args[2]
                    # Translate to origin, rotate, translate back
                    # T(cx, cy) * R(angle) * T(-cx, -cy)
                    transform_matrix = np.array([
                        [cos_a, -sin_a, -cx * cos_a + cy * sin_a + cx],
                        [sin_a, cos_a, -cx * sin_a - cy * cos_a + cy],
                        [0, 0, 1]
                    ])
                else:
                    # rotate around origin
                    transform_matrix = np.array([
                        [cos_a, -sin_a, 0],
                        [sin_a, cos_a, 0],
                        [0, 0, 1]
                    ])

            elif func_name == 'scale':
                # scale(x [y])
                sx = args[0] if len(args) > 0 else 1
                sy = args[1] if len(args) > 1 else sx
                transform_matrix = np.array([
                    [sx, 0, 0],
                    [0, sy, 0],
                    [0, 0, 1]
                ])

            elif func_name == 'matrix':
                # matrix(a b c d e f)
                # SVG matrix is: [a c e]
                #                [b d f]
                #                [0 0 1]
                if len(args) == 6:
                    a, b, c, d, e, f = args
                    transform_matrix = np.array([
                        [a, c, e],
                        [b, d, f],
                        [0, 0, 1]
                    ])
                else:
                    logger.warning(f"Invalid matrix transform: {args_str}")
                    continue

            else:
                logger.warning(f"Unsupported transform function: {func_name}")
                continue

            # Compose transforms: matrix = matrix * transform_matrix
            # Transforms are applied right-to-left in the string
            matrix = matrix @ transform_matrix

        return matrix

    def _apply_transform_to_point(self, x: float, y: float, transform_matrix: np.ndarray) -> tuple[float, float]:
        """
        Apply a transformation matrix to a point.

        Args:
            x: X coordinate
            y: Y coordinate
            transform_matrix: 3x3 transformation matrix

        Returns:
            Transformed (x, y) coordinates
        """
        # Convert to homogeneous coordinates
        point = np.array([x, y, 1])

        # Apply transformation
        transformed = transform_matrix @ point

        # Convert back to Cartesian coordinates
        return float(transformed[0]), float(transformed[1])

    def _get_element_transform(self, elem: ET.Element) -> np.ndarray:
        """
        Get the transformation matrix for an element.

        Args:
            elem: XML element

        Returns:
            3x3 transformation matrix
        """
        transform_str = elem.get('transform', '')
        return self._parse_transform(transform_str)

    def _compose_transforms(self, parent_matrix: np.ndarray, child_matrix: np.ndarray) -> np.ndarray:
        """
        Compose parent and child transformation matrices.

        Args:
            parent_matrix: Parent transformation matrix
            child_matrix: Child transformation matrix

        Returns:
            Composed transformation matrix (parent * child)
        """
        return parent_matrix @ child_matrix

    def parse(self, svg_content: str) -> list[PlotCommand]:
        """
        Parse SVG content and return list of plot commands.

        Args:
            svg_content: SVG document as string

        Returns:
            List of PlotCommand objects
        """
        commands = []

        try:
            root = ET.fromstring(svg_content)
        except ET.ParseError as e:
            logger.error(f"Failed to parse SVG: {e}")
            raise ValueError(f"Invalid SVG content: {e}")

        # Get viewBox for coordinate scaling
        viewbox = root.get("viewBox")
        if viewbox:
            parts = viewbox.split()
            if len(parts) == 4:
                # viewBox defines coordinate space
                pass  # Use as-is for now

        # Process elements recursively, tracking transforms
        identity_matrix = np.eye(3)
        self._process_element(root, identity_matrix, commands)

        # Ensure pen is up at the end
        if commands and commands[-1].type != "pen_up":
            commands.append(PlotCommand("pen_up"))

        logger.info(f"Parsed {len(commands)} commands from SVG")
        return commands

    def _process_element(self, elem: ET.Element, parent_transform: np.ndarray, commands: list[PlotCommand]):
        """
        Recursively process an SVG element and its children, tracking transforms.

        Args:
            elem: XML element to process
            parent_transform: Cumulative transform from parent elements
            commands: List to append commands to
        """
        # Get this element's transform and compose with parent
        element_transform = self._get_element_transform(elem)
        current_transform = self._compose_transforms(parent_transform, element_transform)

        # Get tag name without namespace
        tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag

        # Process element based on type
        if tag == 'path':
            d = elem.get("d", "")
            if d:
                path_commands = list(self._parse_path_d(d, current_transform))
                commands.extend(path_commands)

        elif tag == 'line':
            line_commands = list(self._parse_line(elem, current_transform))
            commands.extend(line_commands)

        elif tag == 'polyline':
            polyline_commands = list(self._parse_polyline(elem, current_transform))
            commands.extend(polyline_commands)

        elif tag == 'polygon':
            polygon_commands = list(self._parse_polygon(elem, current_transform))
            commands.extend(polygon_commands)

        elif tag == 'rect':
            rect_commands = list(self._parse_rect(elem, current_transform))
            commands.extend(rect_commands)

        elif tag == 'circle':
            circle_commands = list(self._parse_circle(elem, current_transform))
            commands.extend(circle_commands)

        elif tag == 'ellipse':
            ellipse_commands = list(self._parse_ellipse(elem, current_transform))
            commands.extend(ellipse_commands)

        # Recursively process child elements (important for <g> groups)
        for child in elem:
            self._process_element(child, current_transform, commands)

    def _find_all_paths(self, root: ET.Element) -> Generator[ET.Element, None, None]:
        """Find all path elements, handling namespaces."""
        # Try with namespace
        for elem in root.findall(".//svg:path", self.SVG_NS):
            yield elem
        # Try without namespace
        for elem in root.findall(".//path"):
            yield elem

    def _find_all_lines(self, root: ET.Element) -> Generator[ET.Element, None, None]:
        for elem in root.findall(".//svg:line", self.SVG_NS):
            yield elem
        for elem in root.findall(".//line"):
            yield elem

    def _find_all_polylines(self, root: ET.Element) -> Generator[ET.Element, None, None]:
        for elem in root.findall(".//svg:polyline", self.SVG_NS):
            yield elem
        for elem in root.findall(".//polyline"):
            yield elem

    def _find_all_polygons(self, root: ET.Element) -> Generator[ET.Element, None, None]:
        for elem in root.findall(".//svg:polygon", self.SVG_NS):
            yield elem
        for elem in root.findall(".//polygon"):
            yield elem

    def _find_all_rects(self, root: ET.Element) -> Generator[ET.Element, None, None]:
        for elem in root.findall(".//svg:rect", self.SVG_NS):
            yield elem
        for elem in root.findall(".//rect"):
            yield elem

    def _find_all_circles(self, root: ET.Element) -> Generator[ET.Element, None, None]:
        for elem in root.findall(".//svg:circle", self.SVG_NS):
            yield elem
        for elem in root.findall(".//circle"):
            yield elem

    def _find_all_ellipses(self, root: ET.Element) -> Generator[ET.Element, None, None]:
        for elem in root.findall(".//svg:ellipse", self.SVG_NS):
            yield elem
        for elem in root.findall(".//ellipse"):
            yield elem

    def _parse_path_d(self, d: str, transform_matrix: np.ndarray) -> Generator[PlotCommand, None, None]:
        """
        Parse SVG path 'd' attribute using svgpathtools for proper curve handling.

        Falls back to basic parsing if svgpathtools is not available.

        Args:
            d: Path data string
            transform_matrix: Transformation matrix to apply to all coordinates
        """
        if not SVGPATHTOOLS_AVAILABLE:
            logger.warning("svgpathtools not available - falling back to basic parser")
            yield from self._parse_path_d_basic(d, transform_matrix)
            return

        try:
            # Parse the path using svgpathtools
            path = parse_path(d)
        except Exception as e:
            logger.error(f"Failed to parse path with svgpathtools: {e}")
            # Fall back to basic parser
            yield from self._parse_path_d_basic(d, transform_matrix)
            return

        if len(path) == 0:
            return

        pen_down = False
        current_x, current_y = 0.0, 0.0

        for segment in path:
            # Get the start point of this segment
            start = segment.start
            start_x = start.real * self.scale_factor
            start_y = start.imag * self.scale_factor

            # Apply transform to start point
            start_x, start_y = self._apply_transform_to_point(start_x, start_y, transform_matrix)

            # If pen is down but we're starting a new disconnected segment, lift pen
            # (This handles move commands implicitly)
            if pen_down:
                # Check if this is a continuation (within tolerance)
                tolerance = 0.001
                if abs(start_x - current_x) > tolerance or abs(start_y - current_y) > tolerance:
                    yield PlotCommand("pen_up")
                    pen_down = False

            # Move to start if pen is up
            if not pen_down:
                yield PlotCommand("move", start_x, start_y)
                yield PlotCommand("pen_down")
                pen_down = True
                current_x, current_y = start_x, start_y

            # Handle different segment types
            if isinstance(segment, Line):
                # Direct line segment - use endpoints
                end = segment.end
                end_x = end.real * self.scale_factor
                end_y = end.imag * self.scale_factor
                end_x, end_y = self._apply_transform_to_point(end_x, end_y, transform_matrix)
                yield PlotCommand("line", end_x, end_y)
                current_x, current_y = end_x, end_y

            elif isinstance(segment, (CubicBezier, QuadraticBezier, Arc)):
                # Flatten curve using point sampling with 0.1mm tolerance
                try:
                    # Calculate the curve length in SVG units
                    length = segment.length()

                    # Determine number of points based on curve length and tolerance
                    # Use 0.1mm tolerance (converted to SVG units)
                    error_tolerance = 0.1 / self.scale_factor if self.scale_factor > 0 else 0.1
                    num_points = max(2, int(length / error_tolerance) + 1)

                    # Limit maximum points to avoid performance issues
                    num_points = min(num_points, 1000)

                    # Sample points along the curve
                    for i in range(1, num_points + 1):
                        t = i / num_points
                        point = segment.point(t)
                        x = point.real * self.scale_factor
                        y = point.imag * self.scale_factor
                        x, y = self._apply_transform_to_point(x, y, transform_matrix)
                        yield PlotCommand("line", x, y)
                        current_x, current_y = x, y

                except Exception as e:
                    logger.error(f"Failed to flatten curve segment: {e}")
                    # Fall back to just connecting start to end
                    end = segment.end
                    end_x = end.real * self.scale_factor
                    end_y = end.imag * self.scale_factor
                    end_x, end_y = self._apply_transform_to_point(end_x, end_y, transform_matrix)
                    yield PlotCommand("line", end_x, end_y)
                    current_x, current_y = end_x, end_y
            else:
                # Unknown segment type - connect start to end
                logger.warning(f"Unknown segment type: {type(segment)}")
                end = segment.end
                end_x = end.real * self.scale_factor
                end_y = end.imag * self.scale_factor
                end_x, end_y = self._apply_transform_to_point(end_x, end_y, transform_matrix)
                yield PlotCommand("line", end_x, end_y)
                current_x, current_y = end_x, end_y

        # Lift pen at end of path
        if pen_down:
            yield PlotCommand("pen_up")

    def _parse_path_d_basic(self, d: str, transform_matrix: np.ndarray) -> Generator[PlotCommand, None, None]:
        """
        Basic path parser for when svgpathtools is not available.
        Only handles M, L, H, V, Z commands - drops curves and arcs.

        Args:
            d: Path data string
            transform_matrix: Transformation matrix to apply to all coordinates
        """
        # Tokenize path data
        tokens = re.findall(r"([MmLlHhVvCcSsQqTtAaZz])|(-?[\d.]+)", d)

        current_x, current_y = 0.0, 0.0
        start_x, start_y = 0.0, 0.0
        pen_down = False
        current_cmd = None

        i = 0
        while i < len(tokens):
            token = tokens[i][0] or tokens[i][1]

            if token.isalpha():
                current_cmd = token
                i += 1
                continue

            # Get numeric value
            try:
                val = float(token)
            except ValueError:
                i += 1
                continue

            if current_cmd in ("M", "m"):
                # Move to
                if pen_down:
                    yield PlotCommand("pen_up")
                    pen_down = False

                if current_cmd == "M":
                    current_x = val * self.scale_factor
                    if i + 1 < len(tokens):
                        current_y = float(tokens[i + 1][1]) * self.scale_factor
                        i += 1
                else:  # relative
                    current_x += val * self.scale_factor
                    if i + 1 < len(tokens):
                        current_y += float(tokens[i + 1][1]) * self.scale_factor
                        i += 1

                # Apply transform
                tx, ty = self._apply_transform_to_point(current_x, current_y, transform_matrix)
                start_x, start_y = tx, ty
                current_x, current_y = tx, ty
                yield PlotCommand("move", tx, ty)

            elif current_cmd in ("L", "l"):
                # Line to
                if not pen_down:
                    yield PlotCommand("pen_down")
                    pen_down = True

                if current_cmd == "L":
                    current_x = val * self.scale_factor
                    if i + 1 < len(tokens):
                        current_y = float(tokens[i + 1][1]) * self.scale_factor
                        i += 1
                else:
                    current_x += val * self.scale_factor
                    if i + 1 < len(tokens):
                        current_y += float(tokens[i + 1][1]) * self.scale_factor
                        i += 1

                # Apply transform
                tx, ty = self._apply_transform_to_point(current_x, current_y, transform_matrix)
                yield PlotCommand("line", tx, ty)

            elif current_cmd in ("H", "h"):
                # Horizontal line
                if not pen_down:
                    yield PlotCommand("pen_down")
                    pen_down = True

                if current_cmd == "H":
                    current_x = val * self.scale_factor
                else:
                    current_x += val * self.scale_factor

                # Apply transform
                tx, ty = self._apply_transform_to_point(current_x, current_y, transform_matrix)
                yield PlotCommand("line", tx, ty)

            elif current_cmd in ("V", "v"):
                # Vertical line
                if not pen_down:
                    yield PlotCommand("pen_down")
                    pen_down = True

                if current_cmd == "V":
                    current_y = val * self.scale_factor
                else:
                    current_y += val * self.scale_factor

                # Apply transform
                tx, ty = self._apply_transform_to_point(current_x, current_y, transform_matrix)
                yield PlotCommand("line", tx, ty)

            elif current_cmd in ("Z", "z"):
                # Close path
                if pen_down:
                    yield PlotCommand("line", start_x, start_y)
                    yield PlotCommand("pen_up")
                    pen_down = False
                current_x, current_y = start_x, start_y

            i += 1

        if pen_down:
            yield PlotCommand("pen_up")

    def _parse_line(self, elem: ET.Element, transform_matrix: np.ndarray) -> Generator[PlotCommand, None, None]:
        """
        Parse SVG line element and apply transformation.

        Args:
            elem: XML element
            transform_matrix: Transformation matrix to apply
        """
        x1 = float(elem.get("x1", 0)) * self.scale_factor
        y1 = float(elem.get("y1", 0)) * self.scale_factor
        x2 = float(elem.get("x2", 0)) * self.scale_factor
        y2 = float(elem.get("y2", 0)) * self.scale_factor

        # Apply transform to both endpoints
        tx1, ty1 = self._apply_transform_to_point(x1, y1, transform_matrix)
        tx2, ty2 = self._apply_transform_to_point(x2, y2, transform_matrix)

        yield PlotCommand("move", tx1, ty1)
        yield PlotCommand("pen_down")
        yield PlotCommand("line", tx2, ty2)
        yield PlotCommand("pen_up")

    def _parse_polyline(self, elem: ET.Element, transform_matrix: np.ndarray) -> Generator[PlotCommand, None, None]:
        """
        Parse SVG polyline element and apply transformation.

        Args:
            elem: XML element
            transform_matrix: Transformation matrix to apply
        """
        points_str = elem.get("points", "")
        points = self._parse_points(points_str)

        if not points:
            return

        # Apply transform to all points
        transformed_points = [self._apply_transform_to_point(x, y, transform_matrix) for x, y in points]

        yield PlotCommand("move", transformed_points[0][0], transformed_points[0][1])
        yield PlotCommand("pen_down")

        for x, y in transformed_points[1:]:
            yield PlotCommand("line", x, y)

        yield PlotCommand("pen_up")

    def _parse_polygon(self, elem: ET.Element, transform_matrix: np.ndarray) -> Generator[PlotCommand, None, None]:
        """
        Parse SVG polygon element (closed polyline) and apply transformation.

        Args:
            elem: XML element
            transform_matrix: Transformation matrix to apply
        """
        points_str = elem.get("points", "")
        points = self._parse_points(points_str)

        if not points:
            return

        # Apply transform to all points
        transformed_points = [self._apply_transform_to_point(x, y, transform_matrix) for x, y in points]

        yield PlotCommand("move", transformed_points[0][0], transformed_points[0][1])
        yield PlotCommand("pen_down")

        for x, y in transformed_points[1:]:
            yield PlotCommand("line", x, y)

        # Close the polygon
        yield PlotCommand("line", transformed_points[0][0], transformed_points[0][1])
        yield PlotCommand("pen_up")

    def _parse_rect(self, elem: ET.Element, transform_matrix: np.ndarray) -> Generator[PlotCommand, None, None]:
        """
        Parse SVG rect element and apply transformation.

        Args:
            elem: XML element
            transform_matrix: Transformation matrix to apply
        """
        x = float(elem.get("x", 0)) * self.scale_factor
        y = float(elem.get("y", 0)) * self.scale_factor
        width = float(elem.get("width", 0)) * self.scale_factor
        height = float(elem.get("height", 0)) * self.scale_factor

        # Define rectangle corners
        corners = [
            (x, y),
            (x + width, y),
            (x + width, y + height),
            (x, y + height)
        ]

        # Apply transform to all corners
        transformed_corners = [self._apply_transform_to_point(cx, cy, transform_matrix) for cx, cy in corners]

        yield PlotCommand("move", transformed_corners[0][0], transformed_corners[0][1])
        yield PlotCommand("pen_down")
        for tx, ty in transformed_corners[1:]:
            yield PlotCommand("line", tx, ty)
        yield PlotCommand("line", transformed_corners[0][0], transformed_corners[0][1])
        yield PlotCommand("pen_up")

    def _parse_circle(self, elem: ET.Element, transform_matrix: np.ndarray, segments: int = 36) -> Generator[PlotCommand, None, None]:
        """
        Parse SVG circle element and apply transformation.
        Approximates circle with line segments.

        Args:
            elem: XML element
            transform_matrix: Transformation matrix to apply
            segments: Number of line segments to approximate the circle
        """
        cx = float(elem.get("cx", 0)) * self.scale_factor
        cy = float(elem.get("cy", 0)) * self.scale_factor
        r = float(elem.get("r", 0)) * self.scale_factor

        if r <= 0:
            return

        # Generate circle points
        points = []
        for i in range(segments):
            angle = 2 * math.pi * i / segments
            x = cx + r * math.cos(angle)
            y = cy + r * math.sin(angle)
            points.append((x, y))

        # Apply transform to all points
        transformed_points = [self._apply_transform_to_point(x, y, transform_matrix) for x, y in points]

        # Start at first point
        yield PlotCommand("move", transformed_points[0][0], transformed_points[0][1])
        yield PlotCommand("pen_down")

        for tx, ty in transformed_points[1:]:
            yield PlotCommand("line", tx, ty)

        # Close the circle
        yield PlotCommand("line", transformed_points[0][0], transformed_points[0][1])
        yield PlotCommand("pen_up")

    def _parse_ellipse(self, elem: ET.Element, transform_matrix: np.ndarray, segments: int = 36) -> Generator[PlotCommand, None, None]:
        """
        Parse SVG ellipse element and apply transformation.
        Approximates ellipse with line segments.

        Args:
            elem: XML element
            transform_matrix: Transformation matrix to apply
            segments: Number of line segments to approximate the ellipse
        """
        cx = float(elem.get("cx", 0)) * self.scale_factor
        cy = float(elem.get("cy", 0)) * self.scale_factor
        rx = float(elem.get("rx", 0)) * self.scale_factor
        ry = float(elem.get("ry", 0)) * self.scale_factor

        if rx <= 0 or ry <= 0:
            return

        # Generate ellipse points
        points = []
        for i in range(segments):
            angle = 2 * math.pi * i / segments
            x = cx + rx * math.cos(angle)
            y = cy + ry * math.sin(angle)
            points.append((x, y))

        # Apply transform to all points
        transformed_points = [self._apply_transform_to_point(x, y, transform_matrix) for x, y in points]

        # Start at first point
        yield PlotCommand("move", transformed_points[0][0], transformed_points[0][1])
        yield PlotCommand("pen_down")

        for tx, ty in transformed_points[1:]:
            yield PlotCommand("line", tx, ty)

        # Close the ellipse
        yield PlotCommand("line", transformed_points[0][0], transformed_points[0][1])
        yield PlotCommand("pen_up")

    def _parse_points(self, points_str: str) -> list[tuple[float, float]]:
        """Parse SVG points attribute (used in polyline/polygon)."""
        points = []
        nums = re.findall(r"-?[\d.]+", points_str)

        for i in range(0, len(nums) - 1, 2):
            x = float(nums[i]) * self.scale_factor
            y = float(nums[i + 1]) * self.scale_factor
            points.append((x, y))

        return points
