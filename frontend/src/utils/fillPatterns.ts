/**
 * Fill Pattern Frames for Pen Plotter
 *
 * Neo-Brutalist and Memphis style patterns that fill the area
 * between the inner border and the paper edge.
 *
 * All patterns properly clip lines to the border frame region
 * using geometric line clipping (suitable for pen plotters).
 */

import { Group, Path, Circle, Rect } from 'fabric';

const SCALE = 3; // pixels per mm

export interface FillPatternOptions {
  /** Canvas width in mm */
  canvasWidthMm: number;
  /** Canvas height in mm */
  canvasHeightMm: number;
  /** Inner border margin from edge in mm (default: 10) */
  borderMarginMm?: number;
  /** Fill area width in mm (default: 8) - the thickness of the pattern area */
  fillWidthMm?: number;
  /** Pattern spacing in mm (default: 3) */
  spacingMm?: number;
  /** Stroke width in pixels (default: 1) */
  strokeWidth?: number;
  /** Stroke color (default: '#000000') */
  stroke?: string;
  /** Whether to draw a border rectangle (default: true) */
  drawBorder?: boolean;
  /** Rotation angle in degrees (default: 0) */
  rotation?: number;
  /** Gap between chevrons in mm (default: 0 for continuous, applies to chevron pattern only) */
  chevronGap?: number;
}

/**
 * Helper function to calculate dimensions needed to fill canvas at any rotation
 * When a pattern is rotated, we need to generate it large enough so that when rotated,
 * it still fills the entire canvas. This calculates the minimum bounding box needed.
 */
function getPatternDimensionsForRotation(
  canvasWidthMm: number,
  canvasHeightMm: number,
  rotation: number
): { width: number; height: number } {
  // Convert rotation to radians
  const angleRad = (rotation * Math.PI) / 180;

  // To ensure the rotated pattern covers the entire canvas, we need to calculate
  // the bounding box of the canvas when rotated backwards by the same angle.
  // This ensures that when we rotate the pattern forward, it covers everything.
  const cosAngle = Math.abs(Math.cos(angleRad));
  const sinAngle = Math.abs(Math.sin(angleRad));

  // Calculate the dimensions needed for the pattern to cover the canvas after rotation
  const patternWidth = canvasWidthMm * cosAngle + canvasHeightMm * sinAngle;
  const patternHeight = canvasWidthMm * sinAngle + canvasHeightMm * cosAngle;

  return { width: patternWidth, height: patternHeight };
}

/**
 * Border region definition - defines the 4 rectangular regions that make up the border frame
 */
interface BorderRegion {
  top: { x1: number; y1: number; x2: number; y2: number };
  bottom: { x1: number; y1: number; x2: number; y2: number };
  left: { x1: number; y1: number; x2: number; y2: number };
  right: { x1: number; y1: number; x2: number; y2: number };
}

/**
 * Get the border frame regions (the donut-shaped area between outer edge and inner border)
 */
function getBorderRegions(
  canvasWidthMm: number,
  canvasHeightMm: number,
  borderMarginMm: number
): BorderRegion {
  return {
    // Top: full width, from 0 to borderMargin
    top: { x1: 0, y1: 0, x2: canvasWidthMm, y2: borderMarginMm },
    // Bottom: full width, from (height - borderMargin) to height
    bottom: { x1: 0, y1: canvasHeightMm - borderMarginMm, x2: canvasWidthMm, y2: canvasHeightMm },
    // Left: from borderMargin to (height - borderMargin), excluding corners
    left: { x1: 0, y1: borderMarginMm, x2: borderMarginMm, y2: canvasHeightMm - borderMarginMm },
    // Right: from borderMargin to (height - borderMargin), excluding corners
    right: { x1: canvasWidthMm - borderMarginMm, y1: borderMarginMm, x2: canvasWidthMm, y2: canvasHeightMm - borderMarginMm },
  };
}

/**
 * Check if a point is inside the border frame (the region to fill)
 */
function isPointInBorderFrame(
  x: number,
  y: number,
  canvasWidthMm: number,
  canvasHeightMm: number,
  borderMarginMm: number
): boolean {
  // Point is in border frame if it's outside the inner rectangle but inside the outer (canvas) rectangle
  const outsideInner = x < borderMarginMm || x > canvasWidthMm - borderMarginMm ||
                       y < borderMarginMm || y > canvasHeightMm - borderMarginMm;
  const insideOuter = x >= 0 && x <= canvasWidthMm && y >= 0 && y <= canvasHeightMm;
  return outsideInner && insideOuter;
}

/**
 * Cohen-Sutherland line clipping algorithm
 * Clips a line segment to a rectangular region
 */
function clipLineToRect(
  x1: number, y1: number, x2: number, y2: number,
  xmin: number, ymin: number, xmax: number, ymax: number
): { x1: number; y1: number; x2: number; y2: number } | null {
  // Outcodes
  const INSIDE = 0;
  const LEFT = 1;
  const RIGHT = 2;
  const BOTTOM = 4;
  const TOP = 8;

  const computeOutCode = (x: number, y: number): number => {
    let code = INSIDE;
    if (x < xmin) code |= LEFT;
    else if (x > xmax) code |= RIGHT;
    if (y < ymin) code |= TOP;
    else if (y > ymax) code |= BOTTOM;
    return code;
  };

  let outcode1 = computeOutCode(x1, y1);
  let outcode2 = computeOutCode(x2, y2);
  let accept = false;

  while (true) {
    if (!(outcode1 | outcode2)) {
      // Both points inside
      accept = true;
      break;
    } else if (outcode1 & outcode2) {
      // Both points share an outside region
      break;
    } else {
      // Some segment is inside
      let x = 0, y = 0;
      const outcodeOut = outcode1 ? outcode1 : outcode2;

      if (outcodeOut & BOTTOM) {
        x = x1 + (x2 - x1) * (ymax - y1) / (y2 - y1);
        y = ymax;
      } else if (outcodeOut & TOP) {
        x = x1 + (x2 - x1) * (ymin - y1) / (y2 - y1);
        y = ymin;
      } else if (outcodeOut & RIGHT) {
        y = y1 + (y2 - y1) * (xmax - x1) / (x2 - x1);
        x = xmax;
      } else if (outcodeOut & LEFT) {
        y = y1 + (y2 - y1) * (xmin - x1) / (x2 - x1);
        x = xmin;
      }

      if (outcodeOut === outcode1) {
        x1 = x;
        y1 = y;
        outcode1 = computeOutCode(x1, y1);
      } else {
        x2 = x;
        y2 = y;
        outcode2 = computeOutCode(x2, y2);
      }
    }
  }

  return accept ? { x1, y1, x2, y2 } : null;
}

/**
 * Clip a line to the border frame (the donut-shaped region)
 * Returns array of line segments that are within the border frame
 */
function clipLineToBorderFrame(
  x1: number, y1: number, x2: number, y2: number,
  canvasWidthMm: number, canvasHeightMm: number, borderMarginMm: number
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const regions = getBorderRegions(canvasWidthMm, canvasHeightMm, borderMarginMm);
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  // Clip the line against each of the 4 border regions
  for (const region of [regions.top, regions.bottom, regions.left, regions.right]) {
    const clipped = clipLineToRect(x1, y1, x2, y2, region.x1, region.y1, region.x2, region.y2);
    if (clipped) {
      segments.push(clipped);
    }
  }

  return segments;
}

/**
 * Polka Dot Pattern - Uniform circles in a grid
 * Only places dots whose centers are within the border frame
 * Memphis style: small dots with generous spacing
 */
export function createPolkaDotFill(options: FillPatternOptions): Group {
  const {
    canvasWidthMm,
    canvasHeightMm,
    borderMarginMm = 10,
    spacingMm = 3,
    strokeWidth = 1,
    stroke = '#000000',
    rotation = 0,
  } = options;

  // Calculate pattern dimensions needed to fill canvas when rotated
  const { width: adjustedWidth, height: adjustedHeight } = getPatternDimensionsForRotation(
    canvasWidthMm,
    canvasHeightMm,
    rotation
  );

  const objects: Circle[] = [];
  const dotRadius = 0.6; // mm - small dots for Memphis look
  const gridSpacing = spacingMm * 1.8; // Generous spacing between dots

  // Iterate over the entire canvas grid and only place dots in the border frame
  for (let x = gridSpacing / 2; x <= adjustedWidth; x += gridSpacing) {
    for (let y = gridSpacing / 2; y <= adjustedHeight; y += gridSpacing) {
      if (isPointInBorderFrame(x, y, adjustedWidth, adjustedHeight, borderMarginMm)) {
        objects.push(new Circle({
          left: x * SCALE,
          top: y * SCALE,
          radius: dotRadius * SCALE,
          stroke,
          strokeWidth,
          fill: '',
          originX: 'center',
          originY: 'center',
        }));
      }
    }
  }

  const group = new Group(objects, {
    left: (canvasWidthMm * SCALE) / 2,
    top: (canvasHeightMm * SCALE) / 2,
    originX: 'center',
    originY: 'center',
    angle: rotation,
    selectable: true,
  });

  group.setCoords();
  return group;
}

/**
 * Diagonal Stripe Pattern - 45-degree parallel lines
 * Properly clips lines to the border frame region
 * Memphis style: well-spaced diagonal lines
 */
export function createDiagonalStripeFill(options: FillPatternOptions): Group {
  const {
    canvasWidthMm,
    canvasHeightMm,
    borderMarginMm = 10,
    spacingMm = 3,
    strokeWidth = 1,
    stroke = '#000000',
    rotation = 0,
  } = options;

  // Calculate pattern dimensions needed to fill canvas when rotated
  const { width: adjustedWidth, height: adjustedHeight } = getPatternDimensionsForRotation(
    canvasWidthMm,
    canvasHeightMm,
    rotation
  );

  const paths: Path[] = [];
  const lineSpacing = spacingMm * 1.5; // Good spacing for Memphis look

  // Calculate diagonal lines that span the entire canvas
  // Lines go from bottom-left to top-right at 45 degrees
  const maxDimension = Math.max(adjustedWidth, adjustedHeight) * 2;

  for (let offset = -maxDimension; offset <= maxDimension; offset += lineSpacing) {
    // Create diagonal line from edge to edge
    const startX = offset;
    const startY = 0;
    const endX = offset + adjustedHeight; // 45 degrees means dx = dy
    const endY = adjustedHeight;

    // Clip this line to the border frame regions
    const clippedSegments = clipLineToBorderFrame(
      startX, startY, endX, endY,
      adjustedWidth, adjustedHeight, borderMarginMm
    );

    // Create path for each clipped segment
    for (const seg of clippedSegments) {
      const path = `M ${seg.x1 * SCALE} ${seg.y1 * SCALE} L ${seg.x2 * SCALE} ${seg.y2 * SCALE}`;
      paths.push(new Path(path, { stroke, strokeWidth, fill: '' }));
    }
  }

  const group = new Group(paths, {
    left: (canvasWidthMm * SCALE) / 2,
    top: (canvasHeightMm * SCALE) / 2,
    originX: 'center',
    originY: 'center',
    angle: rotation,
    selectable: true,
    excludeFromExport: false,  // Ensure group is included in toJSON() serialization
  });

  group.setCoords();
  return group;
}

/**
 * Chevron Pattern - Horizontal zig-zag lines filling the border frame
 * Uses consistent horizontal chevrons and clips them to the border region
 * Memphis style: generous spacing between chevron rows
 */
export function createChevronFill(options: FillPatternOptions): Group {
  const {
    canvasWidthMm,
    canvasHeightMm,
    borderMarginMm = 10,
    spacingMm = 4,
    strokeWidth = 1,
    stroke = '#000000',
    rotation = 0,
    chevronGap = 0,
  } = options;

  // Calculate pattern dimensions needed to fill canvas when rotated
  const { width: adjustedWidth, height: adjustedHeight } = getPatternDimensionsForRotation(
    canvasWidthMm,
    canvasHeightMm,
    rotation
  );

  const paths: Path[] = [];
  const chevronWidth = spacingMm * 1.5; // Width of each V shape
  const chevronAmplitude = spacingMm * 0.6; // Height of V peaks/valleys
  const rowSpacing = spacingMm * 2.5; // Generous spacing between rows for Memphis look

  // Generate horizontal chevron lines across the entire canvas height
  // and clip each line segment to the border frame
  for (let y = 0; y <= adjustedHeight; y += rowSpacing) {
    // Generate points along the chevron line
    const points: Array<{ x: number; y: number }> = [];
    for (let x = 0; x <= adjustedWidth + chevronWidth; x += chevronWidth / 2) {
      // Alternate between peak and valley
      const isUp = Math.floor(x / (chevronWidth / 2)) % 2 === 0;
      const offsetY = isUp ? -chevronAmplitude : chevronAmplitude;
      points.push({ x, y: y + offsetY });
    }

    if (chevronGap > 0) {
      // Draw each V as separate segments (two lines per chevron) with gaps
      // Each chevron consists of point i (peak/valley), i+1 (middle), i+2 (valley/peak)
      for (let i = 0; i < points.length - 2; i += 2) {
        // Left arm of V (from point i to i+1)
        const leftArmSegments = clipLineToBorderFrame(
          points[i].x, points[i].y,
          points[i + 1].x - chevronGap / 2, points[i + 1].y,
          adjustedWidth, adjustedHeight, borderMarginMm
        );
        for (const seg of leftArmSegments) {
          const path = `M ${seg.x1 * SCALE} ${seg.y1 * SCALE} L ${seg.x2 * SCALE} ${seg.y2 * SCALE}`;
          paths.push(new Path(path, { stroke, strokeWidth, fill: '' }));
        }

        // Right arm of V (from point i+1 to i+2)
        const rightArmSegments = clipLineToBorderFrame(
          points[i + 1].x + chevronGap / 2, points[i + 1].y,
          points[i + 2].x, points[i + 2].y,
          adjustedWidth, adjustedHeight, borderMarginMm
        );
        for (const seg of rightArmSegments) {
          const path = `M ${seg.x1 * SCALE} ${seg.y1 * SCALE} L ${seg.x2 * SCALE} ${seg.y2 * SCALE}`;
          paths.push(new Path(path, { stroke, strokeWidth, fill: '' }));
        }
      }
    } else {
      // Draw continuous chevron line (original behavior)
      for (let i = 0; i < points.length - 1; i++) {
        const clippedSegments = clipLineToBorderFrame(
          points[i].x, points[i].y,
          points[i + 1].x, points[i + 1].y,
          adjustedWidth, adjustedHeight, borderMarginMm
        );

        for (const seg of clippedSegments) {
          const path = `M ${seg.x1 * SCALE} ${seg.y1 * SCALE} L ${seg.x2 * SCALE} ${seg.y2 * SCALE}`;
          paths.push(new Path(path, { stroke, strokeWidth, fill: '' }));
        }
      }
    }
  }

  const group = new Group(paths, {
    left: (canvasWidthMm * SCALE) / 2,
    top: (canvasHeightMm * SCALE) / 2,
    originX: 'center',
    originY: 'center',
    angle: rotation,
    selectable: true,
    excludeFromExport: false,  // Ensure group is included in toJSON() serialization
  });

  group.setCoords();
  return group;
}

/**
 * Checkerboard Pattern - Alternating squares
 * Places squares whose centers are within the border frame
 * Memphis style: small squares with visible gaps
 */
export function createCheckerboardFill(options: FillPatternOptions): Group {
  const {
    canvasWidthMm,
    canvasHeightMm,
    borderMarginMm = 10,
    spacingMm = 4,
    strokeWidth = 1,
    stroke = '#000000',
    rotation = 0,
  } = options;

  // Calculate pattern dimensions needed to fill canvas when rotated
  const { width: adjustedWidth, height: adjustedHeight } = getPatternDimensionsForRotation(
    canvasWidthMm,
    canvasHeightMm,
    rotation
  );

  const objects: Rect[] = [];
  const squareSize = spacingMm * 0.8; // Smaller squares
  const gridSpacing = spacingMm * 1.5; // Grid cell size (larger than square for gaps)

  // Iterate over the entire canvas grid using gridSpacing
  for (let col = 0; col * gridSpacing <= adjustedWidth; col++) {
    for (let row = 0; row * gridSpacing <= adjustedHeight; row++) {
      // Alternate pattern (checkerboard)
      if ((col + row) % 2 === 0) {
        // Center the smaller square within the grid cell
        const cellX = col * gridSpacing;
        const cellY = row * gridSpacing;
        const x = cellX + (gridSpacing - squareSize) / 2;
        const y = cellY + (gridSpacing - squareSize) / 2;
        // Check if the center of the square is in the border frame
        const centerX = x + squareSize / 2;
        const centerY = y + squareSize / 2;

        if (isPointInBorderFrame(centerX, centerY, adjustedWidth, adjustedHeight, borderMarginMm)) {
          objects.push(new Rect({
            left: x * SCALE,
            top: y * SCALE,
            width: squareSize * SCALE,
            height: squareSize * SCALE,
            stroke,
            strokeWidth,
            fill: '',
          }));
        }
      }
    }
  }

  const group = new Group(objects, {
    left: (canvasWidthMm * SCALE) / 2,
    top: (canvasHeightMm * SCALE) / 2,
    originX: 'center',
    originY: 'center',
    angle: rotation,
    selectable: true,
  });

  group.setCoords();
  return group;
}

/**
 * Graph Grid Pattern - Notebook-style grid lines
 * Clips horizontal and vertical lines to the border frame
 * Memphis style: well-spaced grid lines
 */
export function createGraphGridFill(options: FillPatternOptions): Group {
  const {
    canvasWidthMm,
    canvasHeightMm,
    borderMarginMm = 10,
    spacingMm = 3,
    strokeWidth = 1,
    stroke = '#000000',
    rotation = 0,
  } = options;

  // Calculate pattern dimensions needed to fill canvas when rotated
  const { width: adjustedWidth, height: adjustedHeight } = getPatternDimensionsForRotation(
    canvasWidthMm,
    canvasHeightMm,
    rotation
  );

  const paths: Path[] = [];
  const gridSpacing = spacingMm * 1.5; // Good spacing for Memphis look

  // Horizontal lines spanning the full width, clipped to border frame
  for (let y = 0; y <= adjustedHeight; y += gridSpacing) {
    const clippedSegments = clipLineToBorderFrame(
      0, y, adjustedWidth, y,
      adjustedWidth, adjustedHeight, borderMarginMm
    );
    for (const seg of clippedSegments) {
      const path = `M ${seg.x1 * SCALE} ${seg.y1 * SCALE} L ${seg.x2 * SCALE} ${seg.y2 * SCALE}`;
      paths.push(new Path(path, { stroke, strokeWidth, fill: '' }));
    }
  }

  // Vertical lines spanning the full height, clipped to border frame
  for (let x = 0; x <= adjustedWidth; x += gridSpacing) {
    const clippedSegments = clipLineToBorderFrame(
      x, 0, x, adjustedHeight,
      adjustedWidth, adjustedHeight, borderMarginMm
    );
    for (const seg of clippedSegments) {
      const path = `M ${seg.x1 * SCALE} ${seg.y1 * SCALE} L ${seg.x2 * SCALE} ${seg.y2 * SCALE}`;
      paths.push(new Path(path, { stroke, strokeWidth, fill: '' }));
    }
  }

  const group = new Group(paths, {
    left: (canvasWidthMm * SCALE) / 2,
    top: (canvasHeightMm * SCALE) / 2,
    originX: 'center',
    originY: 'center',
    angle: rotation,
    selectable: true,
    excludeFromExport: false,  // Ensure group is included in toJSON() serialization
  });

  group.setCoords();
  return group;
}

/**
 * Plus Grid Pattern - Repeating + signs
 * Places plus signs whose centers are within the border frame, with clipped arms
 * Memphis style: small plus signs with generous spacing
 */
export function createPlusGridFill(options: FillPatternOptions): Group {
  const {
    canvasWidthMm,
    canvasHeightMm,
    borderMarginMm = 10,
    spacingMm = 4,
    strokeWidth = 1,
    stroke = '#000000',
    rotation = 0,
  } = options;

  // Calculate pattern dimensions needed to fill canvas when rotated
  const { width: adjustedWidth, height: adjustedHeight } = getPatternDimensionsForRotation(
    canvasWidthMm,
    canvasHeightMm,
    rotation
  );

  const paths: Path[] = [];
  const plusSize = 1.0; // mm - size of each + arm (half-length)
  const gridSpacing = spacingMm * 2; // Generous spacing for Memphis look

  // Iterate over the entire canvas grid
  for (let x = gridSpacing / 2; x <= adjustedWidth; x += gridSpacing) {
    for (let y = gridSpacing / 2; y <= adjustedHeight; y += gridSpacing) {
      // Only place plus signs whose centers are in the border frame
      if (isPointInBorderFrame(x, y, adjustedWidth, adjustedHeight, borderMarginMm)) {
        // Horizontal line of the plus - clip to border frame
        const hSegments = clipLineToBorderFrame(
          x - plusSize, y, x + plusSize, y,
          adjustedWidth, adjustedHeight, borderMarginMm
        );
        for (const seg of hSegments) {
          paths.push(new Path(
            `M ${seg.x1 * SCALE} ${seg.y1 * SCALE} L ${seg.x2 * SCALE} ${seg.y2 * SCALE}`,
            { stroke, strokeWidth, fill: '' }
          ));
        }

        // Vertical line of the plus - clip to border frame
        const vSegments = clipLineToBorderFrame(
          x, y - plusSize, x, y + plusSize,
          adjustedWidth, adjustedHeight, borderMarginMm
        );
        for (const seg of vSegments) {
          paths.push(new Path(
            `M ${seg.x1 * SCALE} ${seg.y1 * SCALE} L ${seg.x2 * SCALE} ${seg.y2 * SCALE}`,
            { stroke, strokeWidth, fill: '' }
          ));
        }
      }
    }
  }

  const group = new Group(paths, {
    left: (canvasWidthMm * SCALE) / 2,
    top: (canvasHeightMm * SCALE) / 2,
    originX: 'center',
    originY: 'center',
    angle: rotation,
    selectable: true,
    excludeFromExport: false,  // Ensure group is included in toJSON() serialization
  });

  group.setCoords();
  return group;
}

/**
 * Squiggle Pattern - Playful wavy lines filling the border frame
 * Creates consistent horizontal wave lines and clips them to the border region
 * For pen plotter: approximates curves as short line segments for proper clipping
 * Memphis style: generous spacing between wave rows
 */
export function createSquiggleFill(options: FillPatternOptions): Group {
  const {
    canvasWidthMm,
    canvasHeightMm,
    borderMarginMm = 10,
    spacingMm = 3,
    strokeWidth = 1,
    stroke = '#000000',
    rotation = 0,
  } = options;

  // Calculate pattern dimensions needed to fill canvas when rotated
  const { width: adjustedWidth, height: adjustedHeight } = getPatternDimensionsForRotation(
    canvasWidthMm,
    canvasHeightMm,
    rotation
  );

  const paths: Path[] = [];
  const waveAmplitude = 1.0; // mm - height of wave peaks
  const waveLength = 5; // mm - wavelength
  const rowSpacing = spacingMm * 2.5; // Generous spacing between rows for Memphis look
  const segmentStep = 0.5; // mm - step size for line approximation of curves

  // Generate horizontal wave lines across the entire canvas height
  // Approximate curves as line segments for proper clipping
  for (let y = 0; y <= adjustedHeight; y += rowSpacing) {
    // Generate points along the sine wave
    const points: Array<{ x: number; y: number }> = [];
    for (let x = 0; x <= adjustedWidth; x += segmentStep) {
      const offsetY = Math.sin((x / waveLength) * 2 * Math.PI) * waveAmplitude;
      points.push({ x, y: y + offsetY });
    }

    // Clip each small segment to the border frame
    for (let i = 0; i < points.length - 1; i++) {
      const clippedSegments = clipLineToBorderFrame(
        points[i].x, points[i].y,
        points[i + 1].x, points[i + 1].y,
        adjustedWidth, adjustedHeight, borderMarginMm
      );

      for (const seg of clippedSegments) {
        const path = `M ${seg.x1 * SCALE} ${seg.y1 * SCALE} L ${seg.x2 * SCALE} ${seg.y2 * SCALE}`;
        paths.push(new Path(path, { stroke, strokeWidth, fill: '' }));
      }
    }
  }

  const group = new Group(paths, {
    left: (canvasWidthMm * SCALE) / 2,
    top: (canvasHeightMm * SCALE) / 2,
    originX: 'center',
    originY: 'center',
    angle: rotation,
    selectable: true,
    excludeFromExport: false,  // Ensure group is included in toJSON() serialization
  });

  group.setCoords();
  return group;
}

/**
 * Pattern type registry for UI
 */
export const FILL_PATTERN_TYPES = [
  { id: 'polka-dot', name: 'Polka Dot', icon: '• •', createFn: createPolkaDotFill },
  { id: 'diagonal-stripe', name: 'Diagonal Stripe', icon: '/ /', createFn: createDiagonalStripeFill },
  { id: 'chevron', name: 'Chevron', icon: '⋁⋁', createFn: createChevronFill },
  { id: 'checkerboard', name: 'Checkerboard', icon: '▦', createFn: createCheckerboardFill },
  { id: 'graph-grid', name: 'Graph Grid', icon: '⊞', createFn: createGraphGridFill },
  { id: 'plus-grid', name: 'Plus Grid', icon: '+ +', createFn: createPlusGridFill },
  { id: 'squiggle', name: 'Squiggle', icon: '∿', createFn: createSquiggleFill },
] as const;

export type FillPatternType = typeof FILL_PATTERN_TYPES[number]['id'];
