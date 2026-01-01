/**
 * SVG to PlotCommands converter.
 *
 * Converts SVG path data to PlotCommand[] for the plotter.
 * Handles path parsing, transformation, and optimization.
 */

import { PlotCommand } from '../grbl';

/**
 * A point in 2D space (in mm).
 */
interface Point {
  x: number;
  y: number;
}

/**
 * A path segment with start point and subsequent points.
 */
interface PathSegment {
  points: Point[];
}

/**
 * Options for SVG to commands conversion.
 */
export interface SvgToCommandsOptions {
  /** Canvas width in mm */
  canvasWidthMm: number;
  /** Canvas height in mm */
  canvasHeightMm: number;
  /** Safety margin from paper edges in mm (default: 3mm) */
  safetyMarginMm?: number;
  /** Whether to optimize path order for faster plotting */
  optimizePaths?: boolean;
}

/**
 * Parse an SVG path's `d` attribute into an array of points.
 * Supports M, L, H, V, Z commands (absolute and relative).
 */
function parsePathD(d: string): Point[] {
  const points: Point[] = [];
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;

  // Normalize path data: ensure space after commands
  const normalized = d
    .replace(/([MmLlHhVvZzCcSsQqTtAa])/g, ' $1 ')
    .replace(/,/g, ' ')
    .replace(/-/g, ' -')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = normalized.split(' ').filter((t) => t !== '');
  let i = 0;

  while (i < tokens.length) {
    const cmd = tokens[i];
    i++;

    switch (cmd) {
      case 'M': // Move to (absolute)
        currentX = parseFloat(tokens[i++]);
        currentY = parseFloat(tokens[i++]);
        startX = currentX;
        startY = currentY;
        points.push({ x: currentX, y: currentY });
        // Implicit line-to after first point
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          currentX = parseFloat(tokens[i++]);
          currentY = parseFloat(tokens[i++]);
          points.push({ x: currentX, y: currentY });
        }
        break;

      case 'm': // Move to (relative)
        currentX += parseFloat(tokens[i++]);
        currentY += parseFloat(tokens[i++]);
        startX = currentX;
        startY = currentY;
        points.push({ x: currentX, y: currentY });
        // Implicit line-to after first point
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          currentX += parseFloat(tokens[i++]);
          currentY += parseFloat(tokens[i++]);
          points.push({ x: currentX, y: currentY });
        }
        break;

      case 'L': // Line to (absolute)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          currentX = parseFloat(tokens[i++]);
          currentY = parseFloat(tokens[i++]);
          points.push({ x: currentX, y: currentY });
        }
        break;

      case 'l': // Line to (relative)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          currentX += parseFloat(tokens[i++]);
          currentY += parseFloat(tokens[i++]);
          points.push({ x: currentX, y: currentY });
        }
        break;

      case 'H': // Horizontal line (absolute)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          currentX = parseFloat(tokens[i++]);
          points.push({ x: currentX, y: currentY });
        }
        break;

      case 'h': // Horizontal line (relative)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          currentX += parseFloat(tokens[i++]);
          points.push({ x: currentX, y: currentY });
        }
        break;

      case 'V': // Vertical line (absolute)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          currentY = parseFloat(tokens[i++]);
          points.push({ x: currentX, y: currentY });
        }
        break;

      case 'v': // Vertical line (relative)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          currentY += parseFloat(tokens[i++]);
          points.push({ x: currentX, y: currentY });
        }
        break;

      case 'Z':
      case 'z': // Close path
        if (currentX !== startX || currentY !== startY) {
          currentX = startX;
          currentY = startY;
          points.push({ x: currentX, y: currentY });
        }
        break;

      case 'C': // Cubic bezier (absolute) - approximate with line segments
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const x1 = parseFloat(tokens[i++]);
          const y1 = parseFloat(tokens[i++]);
          const x2 = parseFloat(tokens[i++]);
          const y2 = parseFloat(tokens[i++]);
          const x = parseFloat(tokens[i++]);
          const y = parseFloat(tokens[i++]);
          // Approximate cubic bezier with line segments
          const bezierPoints = approximateCubicBezier(
            currentX, currentY, x1, y1, x2, y2, x, y, 8
          );
          points.push(...bezierPoints.slice(1)); // Skip first point (current position)
          currentX = x;
          currentY = y;
        }
        break;

      case 'c': // Cubic bezier (relative)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const dx1 = parseFloat(tokens[i++]);
          const dy1 = parseFloat(tokens[i++]);
          const dx2 = parseFloat(tokens[i++]);
          const dy2 = parseFloat(tokens[i++]);
          const dx = parseFloat(tokens[i++]);
          const dy = parseFloat(tokens[i++]);
          const bezierPoints = approximateCubicBezier(
            currentX, currentY,
            currentX + dx1, currentY + dy1,
            currentX + dx2, currentY + dy2,
            currentX + dx, currentY + dy,
            8
          );
          points.push(...bezierPoints.slice(1));
          currentX += dx;
          currentY += dy;
        }
        break;

      case 'S': // Smooth cubic bezier (absolute)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const x2 = parseFloat(tokens[i++]);
          const y2 = parseFloat(tokens[i++]);
          const x = parseFloat(tokens[i++]);
          const y = parseFloat(tokens[i++]);
          // First control point is reflection of previous second control point
          // For simplicity, use current point as control
          const x1 = currentX;
          const y1 = currentY;
          const bezierPoints = approximateCubicBezier(
            currentX, currentY, x1, y1, x2, y2, x, y, 8
          );
          points.push(...bezierPoints.slice(1));
          currentX = x;
          currentY = y;
        }
        break;

      case 's': // Smooth cubic bezier (relative)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const dx2 = parseFloat(tokens[i++]);
          const dy2 = parseFloat(tokens[i++]);
          const dx = parseFloat(tokens[i++]);
          const dy = parseFloat(tokens[i++]);
          const x1 = currentX;
          const y1 = currentY;
          const bezierPoints = approximateCubicBezier(
            currentX, currentY, x1, y1,
            currentX + dx2, currentY + dy2,
            currentX + dx, currentY + dy, 8
          );
          points.push(...bezierPoints.slice(1));
          currentX += dx;
          currentY += dy;
        }
        break;

      case 'Q': // Quadratic bezier (absolute)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const x1 = parseFloat(tokens[i++]);
          const y1 = parseFloat(tokens[i++]);
          const x = parseFloat(tokens[i++]);
          const y = parseFloat(tokens[i++]);
          const bezierPoints = approximateQuadraticBezier(
            currentX, currentY, x1, y1, x, y, 8
          );
          points.push(...bezierPoints.slice(1));
          currentX = x;
          currentY = y;
        }
        break;

      case 'q': // Quadratic bezier (relative)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const dx1 = parseFloat(tokens[i++]);
          const dy1 = parseFloat(tokens[i++]);
          const dx = parseFloat(tokens[i++]);
          const dy = parseFloat(tokens[i++]);
          const bezierPoints = approximateQuadraticBezier(
            currentX, currentY,
            currentX + dx1, currentY + dy1,
            currentX + dx, currentY + dy,
            8
          );
          points.push(...bezierPoints.slice(1));
          currentX += dx;
          currentY += dy;
        }
        break;

      case 'T': // Smooth quadratic bezier (absolute)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const x = parseFloat(tokens[i++]);
          const y = parseFloat(tokens[i++]);
          // Control point is reflection of previous control point
          // For simplicity, use current point
          const x1 = currentX;
          const y1 = currentY;
          const bezierPoints = approximateQuadraticBezier(
            currentX, currentY, x1, y1, x, y, 8
          );
          points.push(...bezierPoints.slice(1));
          currentX = x;
          currentY = y;
        }
        break;

      case 't': // Smooth quadratic bezier (relative)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const dx = parseFloat(tokens[i++]);
          const dy = parseFloat(tokens[i++]);
          const x1 = currentX;
          const y1 = currentY;
          const bezierPoints = approximateQuadraticBezier(
            currentX, currentY, x1, y1,
            currentX + dx, currentY + dy, 8
          );
          points.push(...bezierPoints.slice(1));
          currentX += dx;
          currentY += dy;
        }
        break;

      case 'A': // Elliptical arc (absolute)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const rx = parseFloat(tokens[i++]);
          const ry = parseFloat(tokens[i++]);
          const xAxisRotation = parseFloat(tokens[i++]);
          const largeArcFlag = parseFloat(tokens[i++]);
          const sweepFlag = parseFloat(tokens[i++]);
          const x = parseFloat(tokens[i++]);
          const y = parseFloat(tokens[i++]);

          const arcPoints = approximateEllipticalArc(
            currentX, currentY, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y, 16
          );
          points.push(...arcPoints.slice(1));
          currentX = x;
          currentY = y;
        }
        break;

      case 'a': // Elliptical arc (relative)
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const rx = parseFloat(tokens[i++]);
          const ry = parseFloat(tokens[i++]);
          const xAxisRotation = parseFloat(tokens[i++]);
          const largeArcFlag = parseFloat(tokens[i++]);
          const sweepFlag = parseFloat(tokens[i++]);
          const dx = parseFloat(tokens[i++]);
          const dy = parseFloat(tokens[i++]);

          const arcPoints = approximateEllipticalArc(
            currentX, currentY, rx, ry, xAxisRotation, largeArcFlag, sweepFlag,
            currentX + dx, currentY + dy, 16
          );
          points.push(...arcPoints.slice(1));
          currentX += dx;
          currentY += dy;
        }
        break;

      default:
        // Skip unknown commands
        console.warn('[SVG Parser] Unsupported command:', cmd);
        break;
    }
  }

  return points;
}

/**
 * Approximate a cubic bezier curve with line segments.
 */
function approximateCubicBezier(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  segments: number
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const x = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
    const y = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;
    points.push({ x, y });
  }
  return points;
}

/**
 * Approximate a quadratic bezier curve with line segments.
 */
function approximateQuadraticBezier(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  segments: number
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
    const y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
    points.push({ x, y });
  }
  return points;
}

/**
 * Approximate an elliptical arc with line segments.
 * Implements SVG elliptical arc algorithm from the spec:
 * https://www.w3.org/TR/SVG/implnotes.html#ArcImplementationNotes
 */
function approximateEllipticalArc(
  x1: number, y1: number,
  rx: number, ry: number,
  phi: number,
  fA: number,
  fS: number,
  x2: number, y2: number,
  segments: number
): Point[] {
  // Handle degenerate cases
  if (rx === 0 || ry === 0) {
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }

  // Ensure radii are positive
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  // Convert rotation angle to radians
  const phiRad = (phi * Math.PI) / 180;
  const cosPhi = Math.cos(phiRad);
  const sinPhi = Math.sin(phiRad);

  // Step 1: Compute (x1', y1')
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Step 2: Correct radii if needed
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }

  // Step 3: Compute center point (cx', cy')
  const rxSq = rx * rx;
  const rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  let sq = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq);
  sq = sq < 0 ? 0 : sq;

  const coef = (fA === fS ? -1 : 1) * Math.sqrt(sq);
  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * (-(ry * x1p) / rx);

  // Step 4: Compute center point (cx, cy)
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Step 5: Compute angles
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;

  // Calculate start angle
  const n = Math.sqrt(ux * ux + uy * uy);
  const p = ux;
  let theta1 = Math.acos(p / n);
  if (uy < 0) theta1 = -theta1;

  // Calculate angle extent
  const np = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  const pp = ux * vx + uy * vy;
  let dTheta = Math.acos(pp / np);
  if (ux * vy - uy * vx < 0) dTheta = -dTheta;

  // Adjust for sweep direction
  if (fS === 0 && dTheta > 0) {
    dTheta -= 2 * Math.PI;
  } else if (fS === 1 && dTheta < 0) {
    dTheta += 2 * Math.PI;
  }

  // Generate points along the arc
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = theta1 + t * dTheta;

    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    const x = cosPhi * rx * cosAngle - sinPhi * ry * sinAngle + cx;
    const y = sinPhi * rx * cosAngle + cosPhi * ry * sinAngle + cy;

    points.push({ x, y });
  }

  return points;
}

/**
 * Extract all paths from SVG string.
 */
function extractPathsFromSvg(svgString: string): string[] {
  const paths: string[] = [];

  // Match <path d="..."/> elements
  const pathRegex = /<path[^>]*\sd=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = pathRegex.exec(svgString)) !== null) {
    paths.push(match[1]);
  }

  // Match <line> elements
  const lineRegex = /<line[^>]*x1=["']([^"']+)["'][^>]*y1=["']([^"']+)["'][^>]*x2=["']([^"']+)["'][^>]*y2=["']([^"']+)["'][^>]*>/gi;
  while ((match = lineRegex.exec(svgString)) !== null) {
    const [, x1, y1, x2, y2] = match;
    paths.push(`M${x1},${y1}L${x2},${y2}`);
  }

  // Match <polyline> elements
  const polylineRegex = /<polyline[^>]*points=["']([^"']+)["'][^>]*>/gi;
  while ((match = polylineRegex.exec(svgString)) !== null) {
    const pointsStr = match[1].trim();
    const coords = pointsStr.split(/[\s,]+/).filter((c) => c !== '');
    if (coords.length >= 4) {
      let d = `M${coords[0]},${coords[1]}`;
      for (let i = 2; i < coords.length; i += 2) {
        d += `L${coords[i]},${coords[i + 1]}`;
      }
      paths.push(d);
    }
  }

  // Match <polygon> elements
  const polygonRegex = /<polygon[^>]*points=["']([^"']+)["'][^>]*>/gi;
  while ((match = polygonRegex.exec(svgString)) !== null) {
    const pointsStr = match[1].trim();
    const coords = pointsStr.split(/[\s,]+/).filter((c) => c !== '');
    if (coords.length >= 4) {
      let d = `M${coords[0]},${coords[1]}`;
      for (let i = 2; i < coords.length; i += 2) {
        d += `L${coords[i]},${coords[i + 1]}`;
      }
      d += 'Z';
      paths.push(d);
    }
  }

  // Match <rect> elements
  const rectRegex = /<rect[^>]*x=["']([^"']+)["'][^>]*y=["']([^"']+)["'][^>]*width=["']([^"']+)["'][^>]*height=["']([^"']+)["'][^>]*>/gi;
  while ((match = rectRegex.exec(svgString)) !== null) {
    const [, x, y, w, h] = match;
    const xf = parseFloat(x);
    const yf = parseFloat(y);
    const wf = parseFloat(w);
    const hf = parseFloat(h);
    paths.push(`M${xf},${yf}L${xf + wf},${yf}L${xf + wf},${yf + hf}L${xf},${yf + hf}Z`);
  }

  // Match <circle> elements - approximate with polygon
  const circleRegex = /<circle[^>]*cx=["']([^"']+)["'][^>]*cy=["']([^"']+)["'][^>]*r=["']([^"']+)["'][^>]*>/gi;
  while ((match = circleRegex.exec(svgString)) !== null) {
    const [, cx, cy, r] = match;
    const cxf = parseFloat(cx);
    const cyf = parseFloat(cy);
    const rf = parseFloat(r);
    const segments = Math.max(16, Math.ceil(rf * 2)); // More segments for larger circles
    let d = '';
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      const px = cxf + rf * Math.cos(angle);
      const py = cyf + rf * Math.sin(angle);
      if (i === 0) {
        d += `M${px},${py}`;
      } else {
        d += `L${px},${py}`;
      }
    }
    paths.push(d);
  }

  // Match <ellipse> elements - approximate with polygon
  const ellipseRegex = /<ellipse[^>]*cx=["']([^"']+)["'][^>]*cy=["']([^"']+)["'][^>]*rx=["']([^"']+)["'][^>]*ry=["']([^"']+)["'][^>]*>/gi;
  while ((match = ellipseRegex.exec(svgString)) !== null) {
    const [, cx, cy, rx, ry] = match;
    const cxf = parseFloat(cx);
    const cyf = parseFloat(cy);
    const rxf = parseFloat(rx);
    const ryf = parseFloat(ry);
    const segments = Math.max(16, Math.ceil(Math.max(rxf, ryf) * 2));
    let d = '';
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      const px = cxf + rxf * Math.cos(angle);
      const py = cyf + ryf * Math.sin(angle);
      if (i === 0) {
        d += `M${px},${py}`;
      } else {
        d += `L${px},${py}`;
      }
    }
    paths.push(d);
  }

  return paths;
}

/**
 * Get the SVG viewBox dimensions.
 */
function getSvgDimensions(svgString: string): { width: number; height: number } | null {
  // Try viewBox first
  const viewBoxMatch = svgString.match(/viewBox=["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/[\s,]+/).map(parseFloat);
    if (parts.length >= 4) {
      return { width: parts[2], height: parts[3] };
    }
  }

  // Try width/height attributes
  const widthMatch = svgString.match(/width=["']([0-9.]+)/i);
  const heightMatch = svgString.match(/height=["']([0-9.]+)/i);
  if (widthMatch && heightMatch) {
    return {
      width: parseFloat(widthMatch[1]),
      height: parseFloat(heightMatch[1]),
    };
  }

  return null;
}

/**
 * Convert path segments to PlotCommands.
 */
function pathSegmentsToCommands(segments: PathSegment[]): PlotCommand[] {
  const commands: PlotCommand[] = [];

  for (const segment of segments) {
    if (segment.points.length === 0) continue;

    // Pen up and move to start
    commands.push({ type: 'pen_up' });
    commands.push({ type: 'move', x: segment.points[0].x, y: segment.points[0].y });

    // Pen down
    commands.push({ type: 'pen_down' });

    // Draw lines to remaining points
    for (let i = 1; i < segment.points.length; i++) {
      commands.push({ type: 'line', x: segment.points[i].x, y: segment.points[i].y });
    }
  }

  // Final pen up
  if (commands.length > 0) {
    commands.push({ type: 'pen_up' });
  }

  return commands;
}

/**
 * Optimize path order to minimize travel distance (greedy nearest neighbor).
 */
function optimizePathOrder(segments: PathSegment[]): PathSegment[] {
  if (segments.length <= 1) return segments;

  const result: PathSegment[] = [];
  const remaining = [...segments];
  let currentPos: Point = { x: 0, y: 0 };

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    let reversed = false;

    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i];
      if (seg.points.length === 0) continue;

      // Check distance to start of path
      const startDist = Math.hypot(
        seg.points[0].x - currentPos.x,
        seg.points[0].y - currentPos.y
      );
      if (startDist < nearestDist) {
        nearestDist = startDist;
        nearestIdx = i;
        reversed = false;
      }

      // Check distance to end of path (can draw in reverse)
      const endDist = Math.hypot(
        seg.points[seg.points.length - 1].x - currentPos.x,
        seg.points[seg.points.length - 1].y - currentPos.y
      );
      if (endDist < nearestDist) {
        nearestDist = endDist;
        nearestIdx = i;
        reversed = true;
      }
    }

    const chosen = remaining.splice(nearestIdx, 1)[0];
    if (reversed) {
      chosen.points.reverse();
    }
    result.push(chosen);

    if (chosen.points.length > 0) {
      currentPos = chosen.points[chosen.points.length - 1];
    }
  }

  return result;
}

/**
 * Convert SVG string to PlotCommand array.
 *
 * @param svgString - The SVG markup string
 * @param options - Conversion options including canvas dimensions
 * @returns Array of PlotCommands ready for the plotter
 */
export function svgToPlotCommands(
  svgString: string,
  options: SvgToCommandsOptions
): PlotCommand[] {
  const { canvasWidthMm, canvasHeightMm, safetyMarginMm = 3, optimizePaths = true } = options;

  // Extract paths from SVG
  const pathStrings = extractPathsFromSvg(svgString);
  if (pathStrings.length === 0) {
    return [];
  }

  // Get SVG dimensions for scaling
  const svgDims = getSvgDimensions(svgString);

  // Parse paths to point arrays
  let segments: PathSegment[] = [];
  for (const pathD of pathStrings) {
    const points = parsePathD(pathD);
    if (points.length > 0) {
      segments.push({ points });
    }
  }

  // Apply scaling if SVG has different dimensions than canvas
  if (svgDims) {
    const scaleX = canvasWidthMm / svgDims.width;
    const scaleY = canvasHeightMm / svgDims.height;

    // Only apply scaling if dimensions are significantly different (tolerance: 0.001)
    const needsScaling = Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001;

    if (needsScaling) {
      const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio

      // Calculate offset to center the design
      const scaledWidth = svgDims.width * scale;
      const scaledHeight = svgDims.height * scale;
      const offsetX = (canvasWidthMm - scaledWidth) / 2;
      const offsetY = (canvasHeightMm - scaledHeight) / 2;

      for (const segment of segments) {
        for (const point of segment.points) {
          point.x = point.x * scale + offsetX;
          point.y = point.y * scale + offsetY;
        }
      }
    }
  }

  // Apply safety margin (clip points to safe area)
  const minX = safetyMarginMm;
  const minY = safetyMarginMm;
  const maxX = canvasWidthMm - safetyMarginMm;
  const maxY = canvasHeightMm - safetyMarginMm;

  for (const segment of segments) {
    for (const point of segment.points) {
      point.x = Math.max(minX, Math.min(maxX, point.x));
      point.y = Math.max(minY, Math.min(maxY, point.y));
    }
  }

  // Optimize path order
  if (optimizePaths) {
    segments = optimizePathOrder(segments);
  }

  // Convert to PlotCommands
  return pathSegmentsToCommands(segments);
}

/**
 * Convert Fabric.js canvas JSON to PlotCommands.
 *
 * Fabric.js stores objects with their own coordinates and transformations.
 * This function extracts path data from Fabric objects.
 */
export function fabricCanvasToPlotCommands(
  canvasJson: Record<string, unknown>,
  options: SvgToCommandsOptions
): PlotCommand[] {
  const objects = canvasJson.objects as Array<Record<string, unknown>> | undefined;
  if (!objects || objects.length === 0) {
    return [];
  }

  const { canvasWidthMm, canvasHeightMm, safetyMarginMm = 3, optimizePaths = true } = options;
  let segments: PathSegment[] = [];

  for (const obj of objects) {
    const type = obj.type as string;

    // Get transformation values
    const left = (obj.left as number) || 0;
    const top = (obj.top as number) || 0;
    const scaleX = (obj.scaleX as number) || 1;
    const scaleY = (obj.scaleY as number) || 1;
    const angle = (obj.angle as number) || 0;

    // Apply transformation to a point
    const transformPoint = (x: number, y: number): Point => {
      // Scale
      x *= scaleX;
      y *= scaleY;

      // Rotate
      if (angle !== 0) {
        const radians = (angle * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        x = rx;
        y = ry;
      }

      // Translate
      x += left;
      y += top;

      return { x, y };
    };

    switch (type) {
      case 'path': {
        const path = obj.path as Array<Array<string | number>> | undefined;
        if (path) {
          // Convert Fabric path array to SVG d string
          let d = '';
          for (const cmd of path) {
            d += cmd.join(' ') + ' ';
          }
          const points = parsePathD(d);
          if (points.length > 0) {
            const transformedPoints = points.map((p) => transformPoint(p.x, p.y));
            segments.push({ points: transformedPoints });
          }
        }
        break;
      }

      case 'line': {
        const x1 = (obj.x1 as number) || 0;
        const y1 = (obj.y1 as number) || 0;
        const x2 = (obj.x2 as number) || 0;
        const y2 = (obj.y2 as number) || 0;
        segments.push({
          points: [transformPoint(x1, y1), transformPoint(x2, y2)],
        });
        break;
      }

      case 'polyline':
      case 'polygon': {
        const pointsData = obj.points as Array<{ x: number; y: number }> | undefined;
        if (pointsData && pointsData.length > 0) {
          const points = pointsData.map((p) => transformPoint(p.x, p.y));
          if (type === 'polygon' && points.length > 1) {
            // Close polygon
            points.push({ ...points[0] });
          }
          segments.push({ points });
        }
        break;
      }

      case 'rect': {
        const width = (obj.width as number) || 0;
        const height = (obj.height as number) || 0;
        const points = [
          transformPoint(0, 0),
          transformPoint(width, 0),
          transformPoint(width, height),
          transformPoint(0, height),
          transformPoint(0, 0), // Close
        ];
        segments.push({ points });
        break;
      }

      case 'circle': {
        const radius = (obj.radius as number) || 0;
        const numSegments = Math.max(16, Math.ceil(radius * 2));
        const points: Point[] = [];
        for (let i = 0; i <= numSegments; i++) {
          const theta = (i / numSegments) * 2 * Math.PI;
          const px = radius * Math.cos(theta);
          const py = radius * Math.sin(theta);
          points.push(transformPoint(px, py));
        }
        segments.push({ points });
        break;
      }

      case 'ellipse': {
        const rx = (obj.rx as number) || 0;
        const ry = (obj.ry as number) || 0;
        const numSegments = Math.max(16, Math.ceil(Math.max(rx, ry) * 2));
        const points: Point[] = [];
        for (let i = 0; i <= numSegments; i++) {
          const theta = (i / numSegments) * 2 * Math.PI;
          const px = rx * Math.cos(theta);
          const py = ry * Math.sin(theta);
          points.push(transformPoint(px, py));
        }
        segments.push({ points });
        break;
      }

      case 'i-text':
      case 'textbox':
      case 'text': {
        // Text objects need to be converted to paths first
        // This is typically done in the canvas before export
        // Skip for now - warn if text found
        console.warn('Text object found - convert to path before plotting');
        break;
      }

      default:
        // Skip unknown object types
        break;
    }
  }

  // Apply safety margin
  const minX = safetyMarginMm;
  const minY = safetyMarginMm;
  const maxX = canvasWidthMm - safetyMarginMm;
  const maxY = canvasHeightMm - safetyMarginMm;

  for (const segment of segments) {
    for (const point of segment.points) {
      point.x = Math.max(minX, Math.min(maxX, point.x));
      point.y = Math.max(minY, Math.min(maxY, point.y));
    }
  }

  // Optimize path order
  if (optimizePaths) {
    segments = optimizePathOrder(segments);
  }

  return pathSegmentsToCommands(segments);
}
