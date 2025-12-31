import { Group, Path, Circle } from 'fabric';

// Canvas scale: 3 pixels per mm
const SCALE = 3;

/**
 * Options for generating decorative frames
 */
export interface FrameOptions {
  /** Width of the frame area in mm */
  widthMm: number;
  /** Height of the frame area in mm */
  heightMm: number;
  /** Stroke width in pixels (default: 2) */
  strokeWidth?: number;
  /** Stroke color (default: '#000000') */
  strokeColor?: string;
  /** Margin from edge in mm (default: 5) */
  marginMm?: number;
  /** Whether to draw the border (default: true) */
  drawBorder?: boolean;
}

/**
 * Creates corner bracket frames - L-shaped brackets at each corner
 */
export function createCornerBrackets(options: FrameOptions): Group | null {
  const {
    widthMm,
    heightMm,
    strokeWidth = 2,
    strokeColor = '#000000',
    marginMm = 5,
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  // Convert mm to pixels
  const width = widthMm * SCALE;
  const height = heightMm * SCALE;
  const margin = marginMm * SCALE;
  const bracketLength = 15 * SCALE; // 15mm bracket arms

  const paths: Path[] = [];

  // Top-left bracket
  paths.push(
    new Path(`M ${margin + bracketLength} ${margin} L ${margin} ${margin} L ${margin} ${margin + bracketLength}`, {
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      fill: '',
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
    })
  );

  // Top-right bracket
  paths.push(
    new Path(
      `M ${width - margin - bracketLength} ${margin} L ${width - margin} ${margin} L ${width - margin} ${margin + bracketLength}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      }
    )
  );

  // Bottom-left bracket
  paths.push(
    new Path(
      `M ${margin} ${height - margin - bracketLength} L ${margin} ${height - margin} L ${margin + bracketLength} ${height - margin}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      }
    )
  );

  // Bottom-right bracket
  paths.push(
    new Path(
      `M ${width - margin} ${height - margin - bracketLength} L ${width - margin} ${height - margin} L ${width - margin - bracketLength} ${height - margin}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      }
    )
  );

  const group = new Group(paths, {
    left: 0,
    top: 0,
    selectable: true,
  });

  return group;
}

/**
 * Creates corner flourish frames - Simple curved flourishes at corners
 */
export function createCornerFlourish(options: FrameOptions): Group | null {
  const {
    widthMm,
    heightMm,
    strokeWidth = 2,
    strokeColor = '#000000',
    marginMm = 5,
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  // Convert mm to pixels
  const width = widthMm * SCALE;
  const height = heightMm * SCALE;
  const margin = marginMm * SCALE;
  const size = 20 * SCALE; // 20mm flourish size

  const paths: Path[] = [];

  // Top-left flourish (curved spiral)
  paths.push(
    new Path(
      `M ${margin + size} ${margin} Q ${margin} ${margin} ${margin} ${margin + size} Q ${margin + size * 0.3} ${margin + size * 0.5} ${margin + size * 0.6} ${margin + size * 0.3}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'round',
      }
    )
  );

  // Top-right flourish
  paths.push(
    new Path(
      `M ${width - margin - size} ${margin} Q ${width - margin} ${margin} ${width - margin} ${margin + size} Q ${width - margin - size * 0.3} ${margin + size * 0.5} ${width - margin - size * 0.6} ${margin + size * 0.3}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'round',
      }
    )
  );

  // Bottom-left flourish
  paths.push(
    new Path(
      `M ${margin} ${height - margin - size} Q ${margin} ${height - margin} ${margin + size} ${height - margin} Q ${margin + size * 0.5} ${height - margin - size * 0.3} ${margin + size * 0.3} ${height - margin - size * 0.6}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'round',
      }
    )
  );

  // Bottom-right flourish
  paths.push(
    new Path(
      `M ${width - margin - size} ${height - margin} Q ${width - margin} ${height - margin} ${width - margin} ${height - margin - size} Q ${width - margin - size * 0.5} ${height - margin - size * 0.3} ${width - margin - size * 0.3} ${height - margin - size * 0.6}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'round',
      }
    )
  );

  const group = new Group(paths, {
    left: 0,
    top: 0,
    selectable: true,
  });

  return group;
}

/**
 * Creates Art Deco corner frames - Geometric art deco corner pieces
 */
export function createArtDecoCorners(options: FrameOptions): Group | null {
  const {
    widthMm,
    heightMm,
    strokeWidth = 2,
    strokeColor = '#000000',
    marginMm = 5,
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  // Convert mm to pixels
  const width = widthMm * SCALE;
  const height = heightMm * SCALE;
  const margin = marginMm * SCALE;
  const size = 18 * SCALE; // 18mm art deco element size

  const paths: Path[] = [];

  // Top-left art deco corner (stepped lines)
  paths.push(
    new Path(
      `M ${margin + size} ${margin} L ${margin} ${margin} L ${margin} ${margin + size}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'square',
        strokeLineJoin: 'miter',
      }
    )
  );
  paths.push(
    new Path(
      `M ${margin + size * 0.7} ${margin + size * 0.3} L ${margin + size * 0.3} ${margin + size * 0.3} L ${margin + size * 0.3} ${margin + size * 0.7}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'square',
        strokeLineJoin: 'miter',
      }
    )
  );

  // Top-right art deco corner
  paths.push(
    new Path(
      `M ${width - margin - size} ${margin} L ${width - margin} ${margin} L ${width - margin} ${margin + size}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'square',
        strokeLineJoin: 'miter',
      }
    )
  );
  paths.push(
    new Path(
      `M ${width - margin - size * 0.7} ${margin + size * 0.3} L ${width - margin - size * 0.3} ${margin + size * 0.3} L ${width - margin - size * 0.3} ${margin + size * 0.7}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'square',
        strokeLineJoin: 'miter',
      }
    )
  );

  // Bottom-left art deco corner
  paths.push(
    new Path(
      `M ${margin} ${height - margin - size} L ${margin} ${height - margin} L ${margin + size} ${height - margin}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'square',
        strokeLineJoin: 'miter',
      }
    )
  );
  paths.push(
    new Path(
      `M ${margin + size * 0.3} ${height - margin - size * 0.7} L ${margin + size * 0.3} ${height - margin - size * 0.3} L ${margin + size * 0.7} ${height - margin - size * 0.3}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'square',
        strokeLineJoin: 'miter',
      }
    )
  );

  // Bottom-right art deco corner
  paths.push(
    new Path(
      `M ${width - margin} ${height - margin - size} L ${width - margin} ${height - margin} L ${width - margin - size} ${height - margin}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'square',
        strokeLineJoin: 'miter',
      }
    )
  );
  paths.push(
    new Path(
      `M ${width - margin - size * 0.3} ${height - margin - size * 0.7} L ${width - margin - size * 0.3} ${height - margin - size * 0.3} L ${width - margin - size * 0.7} ${height - margin - size * 0.3}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: '',
        strokeLineCap: 'square',
        strokeLineJoin: 'miter',
      }
    )
  );

  const group = new Group(paths, {
    left: 0,
    top: 0,
    selectable: true,
  });

  return group;
}

/**
 * Creates dotted border frame - Evenly spaced dots/circles along the border
 */
export function createDottedBorder(options: FrameOptions): Group | null {
  const {
    widthMm,
    heightMm,
    strokeColor = '#000000',
    marginMm = 5,
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  // Convert mm to pixels
  const width = widthMm * SCALE;
  const height = heightMm * SCALE;
  const margin = marginMm * SCALE;
  const dotRadius = 1.5; // 1.5px radius for dots
  const spacing = 8 * SCALE; // 8mm spacing between dots

  const objects: Circle[] = [];

  // Top border dots
  for (let x = margin; x <= width - margin; x += spacing) {
    objects.push(
      new Circle({
        left: x,
        top: margin,
        radius: dotRadius,
        fill: strokeColor,
        stroke: '',
        originX: 'center',
        originY: 'center',
      })
    );
  }

  // Bottom border dots
  for (let x = margin; x <= width - margin; x += spacing) {
    objects.push(
      new Circle({
        left: x,
        top: height - margin,
        radius: dotRadius,
        fill: strokeColor,
        stroke: '',
        originX: 'center',
        originY: 'center',
      })
    );
  }

  // Left border dots (excluding corners already drawn)
  for (let y = margin + spacing; y < height - margin; y += spacing) {
    objects.push(
      new Circle({
        left: margin,
        top: y,
        radius: dotRadius,
        fill: strokeColor,
        stroke: '',
        originX: 'center',
        originY: 'center',
      })
    );
  }

  // Right border dots (excluding corners already drawn)
  for (let y = margin + spacing; y < height - margin; y += spacing) {
    objects.push(
      new Circle({
        left: width - margin,
        top: y,
        radius: dotRadius,
        fill: strokeColor,
        stroke: '',
        originX: 'center',
        originY: 'center',
      })
    );
  }

  const group = new Group(objects, {
    left: 0,
    top: 0,
    selectable: true,
  });

  return group;
}

/**
 * Helper function to create all frame types - useful for testing or UI selection
 */
export const FRAME_TYPES = [
  { id: 'corner-brackets', name: 'Corner Brackets', fn: createCornerBrackets },
  { id: 'corner-flourish', name: 'Corner Flourish', fn: createCornerFlourish },
  { id: 'art-deco-corners', name: 'Art Deco Corners', fn: createArtDecoCorners },
  { id: 'dotted-border', name: 'Dotted Border', fn: createDottedBorder },
] as const;

export type FrameType = typeof FRAME_TYPES[number]['id'];
