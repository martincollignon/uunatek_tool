/**
 * Shape Fill Patterns for Pen Plotter
 *
 * Simple fill patterns for rectangles and circles that can be plotted.
 */

import { Line, Circle as FabricCircle } from 'fabric';

const SCALE = 3; // pixels per mm

export type ShapeFillType = 'none' | 'horizontal-lines' | 'vertical-lines' | 'diagonal-lines' | 'cross-hatch' | 'dots';

interface ShapeFillOptions {
  width: number;  // in pixels
  height: number; // in pixels
  spacingMm?: number;
  strokeWidth?: number;
  stroke?: string;
}

interface CircleFillOptions {
  radius: number; // in pixels
  spacingMm?: number;
  strokeWidth?: number;
  stroke?: string;
}

/**
 * Create horizontal line fill for a rectangle
 */
export function createHorizontalLinesFill(options: ShapeFillOptions): Line[] {
  const { width, height, spacingMm = 2, strokeWidth = 1, stroke = '#000000' } = options;
  const spacing = spacingMm * SCALE;
  const lines: Line[] = [];

  for (let y = spacing; y < height; y += spacing) {
    lines.push(new Line([0, y, width, y], {
      stroke,
      strokeWidth,
      selectable: false,
      evented: false,
    }));
  }

  return lines;
}

/**
 * Create vertical line fill for a rectangle
 */
export function createVerticalLinesFill(options: ShapeFillOptions): Line[] {
  const { width, height, spacingMm = 2, strokeWidth = 1, stroke = '#000000' } = options;
  const spacing = spacingMm * SCALE;
  const lines: Line[] = [];

  for (let x = spacing; x < width; x += spacing) {
    lines.push(new Line([x, 0, x, height], {
      stroke,
      strokeWidth,
      selectable: false,
      evented: false,
    }));
  }

  return lines;
}

/**
 * Create diagonal line fill for a rectangle
 */
export function createDiagonalLinesFill(options: ShapeFillOptions): Line[] {
  const { width, height, spacingMm = 2, strokeWidth = 1, stroke = '#000000' } = options;
  const spacing = spacingMm * SCALE;
  const lines: Line[] = [];
  const diagonal = Math.sqrt(width * width + height * height);

  // Diagonal lines from top-left to bottom-right
  for (let offset = -diagonal; offset < diagonal; offset += spacing) {
    const x1 = Math.max(0, offset);
    const y1 = Math.max(0, -offset);
    const x2 = Math.min(width, offset + diagonal);
    const y2 = Math.min(height, -offset + diagonal);

    if (x2 > x1 && y2 > y1) {
      lines.push(new Line([x1, y1, x2, y2], {
        stroke,
        strokeWidth,
        selectable: false,
        evented: false,
      }));
    }
  }

  return lines;
}

/**
 * Create cross-hatch fill for a rectangle
 */
export function createCrossHatchFill(options: ShapeFillOptions): Line[] {
  const horizontal = createHorizontalLinesFill(options);
  const vertical = createVerticalLinesFill(options);
  return [...horizontal, ...vertical];
}

/**
 * Create dot pattern fill for a rectangle
 */
export function createDotsFill(options: ShapeFillOptions): FabricCircle[] {
  const { width, height, spacingMm = 3, strokeWidth = 1, stroke = '#000000' } = options;
  const spacing = spacingMm * SCALE;
  const dotRadius = 0.5 * SCALE;
  const dots: FabricCircle[] = [];

  for (let x = spacing; x < width; x += spacing) {
    for (let y = spacing; y < height; y += spacing) {
      dots.push(new FabricCircle({
        left: x,
        top: y,
        radius: dotRadius,
        stroke,
        strokeWidth,
        fill: '',
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      }));
    }
  }

  return dots;
}

/**
 * Create horizontal line fill for a circle
 */
export function createCircleHorizontalLinesFill(options: CircleFillOptions): Line[] {
  const { radius, spacingMm = 2, strokeWidth = 1, stroke = '#000000' } = options;
  const spacing = spacingMm * SCALE;
  const lines: Line[] = [];

  for (let y = -radius + spacing; y < radius; y += spacing) {
    // Calculate chord length at this y position
    const chordHalfWidth = Math.sqrt(radius * radius - y * y);
    if (chordHalfWidth > 0) {
      lines.push(new Line([-chordHalfWidth, y, chordHalfWidth, y], {
        stroke,
        strokeWidth,
        selectable: false,
        evented: false,
      }));
    }
  }

  return lines;
}

/**
 * Create vertical line fill for a circle
 */
export function createCircleVerticalLinesFill(options: CircleFillOptions): Line[] {
  const { radius, spacingMm = 2, strokeWidth = 1, stroke = '#000000' } = options;
  const spacing = spacingMm * SCALE;
  const lines: Line[] = [];

  for (let x = -radius + spacing; x < radius; x += spacing) {
    // Calculate chord length at this x position
    const chordHalfHeight = Math.sqrt(radius * radius - x * x);
    if (chordHalfHeight > 0) {
      lines.push(new Line([x, -chordHalfHeight, x, chordHalfHeight], {
        stroke,
        strokeWidth,
        selectable: false,
        evented: false,
      }));
    }
  }

  return lines;
}

/**
 * Create cross-hatch fill for a circle
 */
export function createCircleCrossHatchFill(options: CircleFillOptions): Line[] {
  const horizontal = createCircleHorizontalLinesFill(options);
  const vertical = createCircleVerticalLinesFill(options);
  return [...horizontal, ...vertical];
}

/**
 * Create dot pattern fill for a circle
 */
export function createCircleDotsFill(options: CircleFillOptions): FabricCircle[] {
  const { radius, spacingMm = 3, strokeWidth = 1, stroke = '#000000' } = options;
  const spacing = spacingMm * SCALE;
  const dotRadius = 0.5 * SCALE;
  const dots: FabricCircle[] = [];

  for (let x = -radius + spacing; x < radius; x += spacing) {
    for (let y = -radius + spacing; y < radius; y += spacing) {
      // Only add dot if it's inside the circle
      if (x * x + y * y <= radius * radius) {
        dots.push(new FabricCircle({
          left: x,
          top: y,
          radius: dotRadius,
          stroke,
          strokeWidth,
          fill: '',
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        }));
      }
    }
  }

  return dots;
}
