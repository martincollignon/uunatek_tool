import { Rect, Group, Ellipse } from 'fabric';

const SCALE = 3; // pixels per mm

export type FrameType = 'simple' | 'double' | 'rounded' | 'oval';

export interface FrameOptions {
  canvasWidthMm: number;
  canvasHeightMm: number;
  marginMm?: number;      // default: 10mm
  strokeWidthMm?: number; // default: 0.5mm
  strokeColor?: string;   // default: '#000000'
  cornerRadiusMm?: number; // for rounded, default: 5mm
  doubleGapMm?: number;   // for double, default: 3mm
  drawBorder?: boolean;   // default: true - if false, border is invisible (only used as boundary)
}

/**
 * Creates a simple rectangular frame
 */
export function createSimpleFrame(options: FrameOptions): Rect | null {
  const {
    canvasWidthMm,
    canvasHeightMm,
    marginMm = 10,
    strokeWidthMm = 0.5,
    strokeColor = '#000000',
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  const frame = new Rect({
    left: marginMm * SCALE,
    top: marginMm * SCALE,
    width: (canvasWidthMm - marginMm * 2) * SCALE,
    height: (canvasHeightMm - marginMm * 2) * SCALE,
    stroke: strokeColor,
    strokeWidth: strokeWidthMm * SCALE,
    fill: 'transparent',
    strokeUniform: true,
    // Custom metadata for identification
    data: { isFrame: true, frameType: 'simple' },
  });

  return frame;
}

/**
 * Creates a double rectangular frame (two nested rectangles)
 */
export function createDoubleFrame(options: FrameOptions): Group | null {
  const {
    canvasWidthMm,
    canvasHeightMm,
    marginMm = 10,
    strokeWidthMm = 0.5,
    strokeColor = '#000000',
    doubleGapMm = 3,
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  // Outer rectangle
  const outerRect = new Rect({
    left: 0,
    top: 0,
    width: (canvasWidthMm - marginMm * 2) * SCALE,
    height: (canvasHeightMm - marginMm * 2) * SCALE,
    stroke: strokeColor,
    strokeWidth: strokeWidthMm * SCALE,
    fill: 'transparent',
    strokeUniform: true,
  });

  // Inner rectangle (offset by gap)
  const innerRect = new Rect({
    left: doubleGapMm * SCALE,
    top: doubleGapMm * SCALE,
    width: (canvasWidthMm - marginMm * 2 - doubleGapMm * 2) * SCALE,
    height: (canvasHeightMm - marginMm * 2 - doubleGapMm * 2) * SCALE,
    stroke: strokeColor,
    strokeWidth: strokeWidthMm * SCALE,
    fill: 'transparent',
    strokeUniform: true,
  });

  // Group both rectangles
  const group = new Group([outerRect, innerRect], {
    left: marginMm * SCALE,
    top: marginMm * SCALE,
  });

  return group;
}

/**
 * Creates a rounded rectangular frame
 */
export function createRoundedFrame(options: FrameOptions): Rect | null {
  const {
    canvasWidthMm,
    canvasHeightMm,
    marginMm = 10,
    strokeWidthMm = 0.5,
    strokeColor = '#000000',
    cornerRadiusMm = 5,
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  const frame = new Rect({
    left: marginMm * SCALE,
    top: marginMm * SCALE,
    width: (canvasWidthMm - marginMm * 2) * SCALE,
    height: (canvasHeightMm - marginMm * 2) * SCALE,
    stroke: strokeColor,
    strokeWidth: strokeWidthMm * SCALE,
    fill: 'transparent',
    strokeUniform: true,
    rx: cornerRadiusMm * SCALE,
    ry: cornerRadiusMm * SCALE,
    // Custom metadata for identification
    data: { isFrame: true, frameType: 'rounded' },
  });

  return frame;
}

/**
 * Creates an oval frame
 */
export function createOvalFrame(options: FrameOptions): Ellipse | null {
  const {
    canvasWidthMm,
    canvasHeightMm,
    marginMm = 10,
    strokeWidthMm = 0.5,
    strokeColor = '#000000',
    drawBorder = true,
  } = options;

  // If drawBorder is false, return null (no visible border)
  if (!drawBorder) {
    return null;
  }

  // Calculate radii (half of the available width/height after margins)
  const rx = ((canvasWidthMm - marginMm * 2) / 2) * SCALE;
  const ry = ((canvasHeightMm - marginMm * 2) / 2) * SCALE;

  const frame = new Ellipse({
    left: marginMm * SCALE,
    top: marginMm * SCALE,
    rx: rx,
    ry: ry,
    stroke: strokeColor,
    strokeWidth: strokeWidthMm * SCALE,
    fill: 'transparent',
    strokeUniform: true,
    originX: 'left',
    originY: 'top',
    // Custom metadata for identification
    data: { isFrame: true, frameType: 'oval' },
  });

  return frame;
}
