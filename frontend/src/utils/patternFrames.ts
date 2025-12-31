/**
 * Pattern Border Frames for Pen Plotter
 *
 * Simplified implementations of pattern frames for Phase 3.
 * These are basic versions that can be enhanced in the future.
 */

import { Group, Path, Circle } from 'fabric';

const SCALE = 3; // pixels per mm

export interface FrameOptions {
  width: number; // Canvas width in mm
  height: number; // Canvas height in mm
  thickness: number; // Frame thickness/width in mm
  margin: number; // Distance from canvas edge in mm
  strokeWidth?: number; // Stroke width in pixels (default: 1)
  stroke?: string; // Stroke color (default: 'black')
  drawBorder?: boolean; // Whether to draw the border (default: true)
}

/**
 * Wave Frame - Simplified wave pattern along top edge only
 */
export function createWaveFrame(options: FrameOptions): Group | null {
  const {
    width,
    margin,
    strokeWidth = 1,
    stroke = 'black',
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  const paths: Path[] = [];
  const waveLength = 10; // mm per wave cycle

  // Simple wave on top edge
  const topSegments = Math.ceil(width / waveLength);
  let topPath = `M ${margin * SCALE} ${margin * SCALE}`;
  for (let i = 0; i <= topSegments; i++) {
    const x = margin + (i * waveLength);
    const y = i % 2 === 0 ? margin : margin + 5;
    topPath += ` L ${Math.min(x, width - margin) * SCALE} ${y * SCALE}`;
  }
  paths.push(new Path(topPath, { stroke, strokeWidth, fill: '', selectable: false }));

  const group = new Group(paths, {
    selectable: true,
  });

  return group;
}

/**
 * Zigzag Frame - Sharp zigzag pattern on top edge
 */
export function createZigzagFrame(options: FrameOptions): Group | null {
  const {
    width,
    thickness,
    margin,
    strokeWidth = 1,
    stroke = 'black',
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  const paths: Path[] = [];
  const zigzagWidth = 8; // mm per zigzag segment

  const topSegments = Math.ceil(width / zigzagWidth);
  let topPath = `M ${margin * SCALE} ${margin * SCALE}`;
  for (let i = 0; i <= topSegments; i++) {
    const x = margin + (i * zigzagWidth);
    const y = i % 2 === 0 ? margin : margin + thickness;
    topPath += ` L ${Math.min(x, width - margin) * SCALE} ${y * SCALE}`;
  }
  paths.push(new Path(topPath, { stroke, strokeWidth, fill: '', selectable: false }));

  const group = new Group(paths, {
    selectable: true,
  });

  return group;
}

/**
 * Scallop Frame - Rounded scallop edges using arcs on top edge
 */
export function createScallopFrame(options: FrameOptions): Group | null {
  const {
    width,
    thickness,
    margin,
    strokeWidth = 1,
    stroke = 'black',
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  const paths: Path[] = [];
  const scallopWidth = 12; // mm per scallop
  const radius = scallopWidth / 2;

  const topSegments = Math.ceil(width / scallopWidth);
  let topPath = `M ${margin * SCALE} ${(margin + thickness) * SCALE}`;
  for (let i = 0; i < topSegments; i++) {
    const xEnd = margin + ((i + 1) * scallopWidth);
    topPath += ` A ${radius * SCALE} ${radius * SCALE} 0 0 1 ${Math.min(xEnd, width - margin) * SCALE} ${(margin + thickness) * SCALE}`;
  }
  paths.push(new Path(topPath, { stroke, strokeWidth, fill: '', selectable: false }));

  const group = new Group(paths, {
    selectable: true,
  });

  return group;
}

/**
 * Dash Frame - Dashed lines on top edge
 */
export function createDashFrame(options: FrameOptions): Group | null {
  const {
    width,
    margin,
    strokeWidth = 1,
    stroke = 'black',
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  const paths: Path[] = [];
  const dashLength = 10; // mm
  const gapLength = 5; // mm
  const segmentLength = dashLength + gapLength;

  const topSegments = Math.ceil(width / segmentLength);
  for (let i = 0; i < topSegments; i++) {
    const xStart = margin + (i * segmentLength);
    const xEnd = Math.min(xStart + dashLength, width - margin);
    const path = `M ${xStart * SCALE} ${margin * SCALE} L ${xEnd * SCALE} ${margin * SCALE}`;
    paths.push(new Path(path, { stroke, strokeWidth, fill: '', selectable: false }));
  }

  const group = new Group(paths, {
    selectable: true,
  });

  return group;
}

/**
 * Dots Frame - Evenly spaced dots on top edge
 */
export function createDotsFrame(options: FrameOptions): Group | null {
  const {
    width,
    thickness,
    margin,
    strokeWidth = 1,
    stroke = 'black',
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  const objects: Circle[] = [];
  const dotSpacing = 8; // mm between dot centers
  const dotRadius = 0.8; // mm

  const centerLine = margin + thickness / 2;

  const topDots = Math.floor(width / dotSpacing);
  for (let i = 0; i <= topDots; i++) {
    const x = margin + (i * dotSpacing);
    if (x <= width - margin) {
      objects.push(
        new Circle({
          left: x * SCALE,
          top: centerLine * SCALE,
          radius: dotRadius * SCALE,
          stroke,
          strokeWidth,
          fill: '',
          selectable: false,
          originX: 'center',
          originY: 'center',
        })
      );
    }
  }

  const group = new Group(objects, {
    selectable: true,
  });

  return group;
}

/**
 * Greek Key Frame - Simplified Greek key pattern on top edge
 */
export function createGreekKeyFrame(options: FrameOptions): Group | null {
  const {
    width,
    thickness,
    margin,
    strokeWidth = 1,
    stroke = 'black',
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  const paths: Path[] = [];
  const keyWidth = 15; // mm per Greek key unit
  const keyHeight = thickness;

  function createKeyUnit(x: number, y: number, size: number, flip: boolean): string {
    const s = size * SCALE;
    const px = x * SCALE;
    const py = y * SCALE;

    if (flip) {
      return `M ${px} ${py + s} L ${px} ${py} L ${px + s} ${py} L ${px + s} ${py + s * 0.66}`;
    } else {
      return `M ${px} ${py} L ${px} ${py + s} L ${px + s} ${py + s} L ${px + s} ${py + s * 0.33}`;
    }
  }

  const topSegments = Math.floor((width - 2 * margin) / keyWidth);
  for (let i = 0; i < topSegments; i++) {
    const x = margin + (i * keyWidth);
    const y = margin;
    const pathData = createKeyUnit(x, y, keyHeight, i % 2 === 0);
    paths.push(new Path(pathData, { stroke, strokeWidth, fill: '', selectable: false }));
  }

  const group = new Group(paths, {
    selectable: true,
  });

  return group;
}
