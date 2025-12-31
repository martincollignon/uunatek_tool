"""SVG parser - converts SVG paths to plotter commands."""

import re
import math
from typing import Generator
from xml.etree import ElementTree as ET
from dataclasses import dataclass
import logging

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

        # Process all path elements
        for path_elem in self._find_all_paths(root):
            d = path_elem.get("d", "")
            if d:
                path_commands = list(self._parse_path_d(d))
                commands.extend(path_commands)

        # Process line elements
        for line_elem in self._find_all_lines(root):
            line_commands = list(self._parse_line(line_elem))
            commands.extend(line_commands)

        # Process polyline elements
        for polyline in self._find_all_polylines(root):
            polyline_commands = list(self._parse_polyline(polyline))
            commands.extend(polyline_commands)

        # Process polygon elements
        for polygon in self._find_all_polygons(root):
            polygon_commands = list(self._parse_polygon(polygon))
            commands.extend(polygon_commands)

        # Process rect elements
        for rect in self._find_all_rects(root):
            rect_commands = list(self._parse_rect(rect))
            commands.extend(rect_commands)

        # Process circle elements
        for circle in self._find_all_circles(root):
            circle_commands = list(self._parse_circle(circle))
            commands.extend(circle_commands)

        # Process ellipse elements
        for ellipse in self._find_all_ellipses(root):
            ellipse_commands = list(self._parse_ellipse(ellipse))
            commands.extend(ellipse_commands)

        # Ensure pen is up at the end
        if commands and commands[-1].type != "pen_up":
            commands.append(PlotCommand("pen_up"))

        logger.info(f"Parsed {len(commands)} commands from SVG")
        return commands

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

    def _parse_path_d(self, d: str) -> Generator[PlotCommand, None, None]:
        """Parse SVG path 'd' attribute."""
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

                start_x, start_y = current_x, current_y
                yield PlotCommand("move", current_x, current_y)

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

                yield PlotCommand("line", current_x, current_y)

            elif current_cmd in ("H", "h"):
                # Horizontal line
                if not pen_down:
                    yield PlotCommand("pen_down")
                    pen_down = True

                if current_cmd == "H":
                    current_x = val * self.scale_factor
                else:
                    current_x += val * self.scale_factor

                yield PlotCommand("line", current_x, current_y)

            elif current_cmd in ("V", "v"):
                # Vertical line
                if not pen_down:
                    yield PlotCommand("pen_down")
                    pen_down = True

                if current_cmd == "V":
                    current_y = val * self.scale_factor
                else:
                    current_y += val * self.scale_factor

                yield PlotCommand("line", current_x, current_y)

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

    def _parse_line(self, elem: ET.Element) -> Generator[PlotCommand, None, None]:
        """Parse SVG line element."""
        x1 = float(elem.get("x1", 0)) * self.scale_factor
        y1 = float(elem.get("y1", 0)) * self.scale_factor
        x2 = float(elem.get("x2", 0)) * self.scale_factor
        y2 = float(elem.get("y2", 0)) * self.scale_factor

        yield PlotCommand("move", x1, y1)
        yield PlotCommand("pen_down")
        yield PlotCommand("line", x2, y2)
        yield PlotCommand("pen_up")

    def _parse_polyline(self, elem: ET.Element) -> Generator[PlotCommand, None, None]:
        """Parse SVG polyline element."""
        points_str = elem.get("points", "")
        points = self._parse_points(points_str)

        if not points:
            return

        yield PlotCommand("move", points[0][0], points[0][1])
        yield PlotCommand("pen_down")

        for x, y in points[1:]:
            yield PlotCommand("line", x, y)

        yield PlotCommand("pen_up")

    def _parse_polygon(self, elem: ET.Element) -> Generator[PlotCommand, None, None]:
        """Parse SVG polygon element (closed polyline)."""
        points_str = elem.get("points", "")
        points = self._parse_points(points_str)

        if not points:
            return

        yield PlotCommand("move", points[0][0], points[0][1])
        yield PlotCommand("pen_down")

        for x, y in points[1:]:
            yield PlotCommand("line", x, y)

        # Close the polygon
        yield PlotCommand("line", points[0][0], points[0][1])
        yield PlotCommand("pen_up")

    def _parse_rect(self, elem: ET.Element) -> Generator[PlotCommand, None, None]:
        """Parse SVG rect element."""
        x = float(elem.get("x", 0)) * self.scale_factor
        y = float(elem.get("y", 0)) * self.scale_factor
        width = float(elem.get("width", 0)) * self.scale_factor
        height = float(elem.get("height", 0)) * self.scale_factor

        yield PlotCommand("move", x, y)
        yield PlotCommand("pen_down")
        yield PlotCommand("line", x + width, y)
        yield PlotCommand("line", x + width, y + height)
        yield PlotCommand("line", x, y + height)
        yield PlotCommand("line", x, y)
        yield PlotCommand("pen_up")

    def _parse_circle(self, elem: ET.Element, segments: int = 36) -> Generator[PlotCommand, None, None]:
        """Parse SVG circle element - approximate with line segments."""
        cx = float(elem.get("cx", 0)) * self.scale_factor
        cy = float(elem.get("cy", 0)) * self.scale_factor
        r = float(elem.get("r", 0)) * self.scale_factor

        if r <= 0:
            return

        # Start at rightmost point
        yield PlotCommand("move", cx + r, cy)
        yield PlotCommand("pen_down")

        for i in range(1, segments + 1):
            angle = 2 * math.pi * i / segments
            x = cx + r * math.cos(angle)
            y = cy + r * math.sin(angle)
            yield PlotCommand("line", x, y)

        yield PlotCommand("pen_up")

    def _parse_ellipse(self, elem: ET.Element, segments: int = 36) -> Generator[PlotCommand, None, None]:
        """Parse SVG ellipse element - approximate with line segments."""
        cx = float(elem.get("cx", 0)) * self.scale_factor
        cy = float(elem.get("cy", 0)) * self.scale_factor
        rx = float(elem.get("rx", 0)) * self.scale_factor
        ry = float(elem.get("ry", 0)) * self.scale_factor

        if rx <= 0 or ry <= 0:
            return

        yield PlotCommand("move", cx + rx, cy)
        yield PlotCommand("pen_down")

        for i in range(1, segments + 1):
            angle = 2 * math.pi * i / segments
            x = cx + rx * math.cos(angle)
            y = cy + ry * math.sin(angle)
            yield PlotCommand("line", x, y)

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
