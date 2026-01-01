import { Canvas, FabricObject, Line } from 'fabric';

export interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  label?: string;
  color?: string;
  dash?: number[];
}

export interface SnapState {
  isSnappedHorizontal: boolean;
  isSnappedVertical: boolean;
  currentVerticalSnapPos: number | undefined;
  currentHorizontalSnapPos: number | undefined;
}

export interface SnapResult {
  snapLeft?: number;
  snapTop?: number;
  guides: AlignmentGuide[];
  newSnapState: SnapState;
}

const SNAP_THRESHOLD = 8; // pixels - increased for smoother snapping
const SNAP_RELEASE_THRESHOLD = 12; // pixels - hysteresis to prevent rapid toggling
const CENTER_SNAP_WEIGHT = 0.8; // Prioritize center snaps over edge snaps (lower = stronger)

/**
 * Calculate alignment guides for an object being moved on the canvas
 */
export function calculateAlignmentGuides(
  canvas: Canvas,
  activeObject: FabricObject,
  canvasWidth: number,
  canvasHeight: number,
  snapState: SnapState
): SnapResult {
  const guides: AlignmentGuide[] = [];
  let snapLeft: number | undefined;
  let snapTop: number | undefined;

  // Extract current snap state
  let { isSnappedHorizontal, isSnappedVertical, currentVerticalSnapPos, currentHorizontalSnapPos } = snapState;

  const objectBounds = activeObject.getBoundingRect();
  const objectCenterX = objectBounds.left + objectBounds.width / 2;
  const objectCenterY = objectBounds.top + objectBounds.height / 2;
  const objectLeft = objectBounds.left;
  const objectRight = objectBounds.left + objectBounds.width;
  const objectTop = objectBounds.top;
  const objectBottom = objectBounds.top + objectBounds.height;

  // Track closest snap point to avoid conflicts
  let closestVerticalSnap: { distance: number; left: number; guidePos: number; label?: string } | null = null;
  let closestHorizontalSnap: { distance: number; top: number; guidePos: number; label?: string } | null = null;

  // Canvas guide positions
  const canvasThirdX = canvasWidth / 3;
  const canvasTwoThirdsX = (canvasWidth * 2) / 3;
  const canvasThirdY = canvasHeight / 3;
  const canvasTwoThirdsY = (canvasHeight * 2) / 3;
  const canvasHalfX = canvasWidth / 2;
  const canvasHalfY = canvasHeight / 2;

  // Vertical alignment checks (for horizontal movement)
  const verticalChecks = [
    { pos: 0, label: 'Left Edge' },
    { pos: canvasThirdX, label: 'Left Third' },
    { pos: canvasHalfX, label: 'Center' },
    { pos: canvasTwoThirdsX, label: 'Right Third' },
    { pos: canvasWidth, label: 'Right Edge' },
  ];

  // Use hysteresis: if already snapped, require larger distance to unsnap
  const verticalThreshold = isSnappedVertical ? SNAP_RELEASE_THRESHOLD : SNAP_THRESHOLD;

  for (const check of verticalChecks) {
    // If we're snapped to a specific guide, only check that guide with the release threshold
    // This prevents competing with other nearby guides
    if (isSnappedVertical && currentVerticalSnapPos !== undefined && currentVerticalSnapPos !== check.pos) {
      continue; // Skip other guides when already snapped to a specific one
    }

    // Check object center - prioritize center snaps with weighting
    const centerDist = Math.abs(objectCenterX - check.pos);
    const adjustedCenterDist = centerDist * CENTER_SNAP_WEIGHT;
    if (centerDist < verticalThreshold) {
      if (!closestVerticalSnap || adjustedCenterDist < closestVerticalSnap.distance) {
        closestVerticalSnap = {
          distance: adjustedCenterDist,
          left: check.pos - objectBounds.width / 2,
          guidePos: check.pos,
          label: check.label,
        };
      }
    }

    // Check object left edge
    const leftDist = Math.abs(objectLeft - check.pos);
    if (leftDist < verticalThreshold) {
      if (!closestVerticalSnap || leftDist < closestVerticalSnap.distance) {
        closestVerticalSnap = {
          distance: leftDist,
          left: check.pos,
          guidePos: check.pos,
          label: check.label,
        };
      }
    }

    // Check object right edge
    const rightDist = Math.abs(objectRight - check.pos);
    if (rightDist < verticalThreshold) {
      if (!closestVerticalSnap || rightDist < closestVerticalSnap.distance) {
        closestVerticalSnap = {
          distance: rightDist,
          left: check.pos - objectBounds.width,
          guidePos: check.pos,
          label: check.label,
        };
      }
    }
  }

  // Apply closest vertical snap
  if (closestVerticalSnap) {
    snapLeft = closestVerticalSnap.left;
    isSnappedVertical = true;
    currentVerticalSnapPos = closestVerticalSnap.guidePos; // Remember which guide we're snapped to
    guides.push({
      type: 'vertical',
      position: closestVerticalSnap.guidePos,
      label: closestVerticalSnap.label,
      color: '#FF1744',
    });
  } else {
    isSnappedVertical = false;
    currentVerticalSnapPos = undefined; // Clear when not snapped
  }

  // Horizontal alignment checks (for vertical movement)
  const horizontalChecks = [
    { pos: 0, label: 'Top Edge' },
    { pos: canvasThirdY, label: 'Top Third' },
    { pos: canvasHalfY, label: 'Middle' },
    { pos: canvasTwoThirdsY, label: 'Bottom Third' },
    { pos: canvasHeight, label: 'Bottom Edge' },
  ];

  // Use hysteresis: if already snapped, require larger distance to unsnap
  const horizontalThreshold = isSnappedHorizontal ? SNAP_RELEASE_THRESHOLD : SNAP_THRESHOLD;

  for (const check of horizontalChecks) {
    // If we're snapped to a specific guide, only check that guide with the release threshold
    // This prevents competing with other nearby guides
    if (isSnappedHorizontal && currentHorizontalSnapPos !== undefined && currentHorizontalSnapPos !== check.pos) {
      continue; // Skip other guides when already snapped to a specific one
    }

    // Check object center - prioritize center snaps with weighting
    const centerDist = Math.abs(objectCenterY - check.pos);
    const adjustedCenterDist = centerDist * CENTER_SNAP_WEIGHT;
    if (centerDist < horizontalThreshold) {
      if (!closestHorizontalSnap || adjustedCenterDist < closestHorizontalSnap.distance) {
        closestHorizontalSnap = {
          distance: adjustedCenterDist,
          top: check.pos - objectBounds.height / 2,
          guidePos: check.pos,
          label: check.label,
        };
      }
    }

    // Check object top edge
    const topDist = Math.abs(objectTop - check.pos);
    if (topDist < horizontalThreshold) {
      if (!closestHorizontalSnap || topDist < closestHorizontalSnap.distance) {
        closestHorizontalSnap = {
          distance: topDist,
          top: check.pos,
          guidePos: check.pos,
          label: check.label,
        };
      }
    }

    // Check object bottom edge
    const bottomDist = Math.abs(objectBottom - check.pos);
    if (bottomDist < horizontalThreshold) {
      if (!closestHorizontalSnap || bottomDist < closestHorizontalSnap.distance) {
        closestHorizontalSnap = {
          distance: bottomDist,
          top: check.pos - objectBounds.height,
          guidePos: check.pos,
          label: check.label,
        };
      }
    }
  }

  // Apply closest horizontal snap
  if (closestHorizontalSnap) {
    snapTop = closestHorizontalSnap.top;
    isSnappedHorizontal = true;
    currentHorizontalSnapPos = closestHorizontalSnap.guidePos; // Remember which guide we're snapped to
    guides.push({
      type: 'horizontal',
      position: closestHorizontalSnap.guidePos,
      label: closestHorizontalSnap.label,
      color: '#FF1744',
    });
  } else {
    isSnappedHorizontal = false;
    currentHorizontalSnapPos = undefined; // Clear when not snapped
  }

  // Check alignment with other objects (only if no canvas alignment found)
  canvas.getObjects().forEach((obj) => {
    if (obj === activeObject || !obj.visible || obj.selectable === false) return;

    const otherBounds = obj.getBoundingRect();
    const otherCenterX = otherBounds.left + otherBounds.width / 2;
    const otherCenterY = otherBounds.top + otherBounds.height / 2;

    // Vertical alignment with other objects (only if no snap yet or closer)
    const centerXDist = Math.abs(objectCenterX - otherCenterX);
    if (centerXDist < SNAP_THRESHOLD) {
      if (!closestVerticalSnap || centerXDist < closestVerticalSnap.distance) {
        snapLeft = otherCenterX - objectBounds.width / 2;
        // Remove previous vertical guide
        const idx = guides.findIndex((g) => g.type === 'vertical');
        if (idx >= 0) guides.splice(idx, 1);
        guides.push({
          type: 'vertical',
          position: otherCenterX,
          color: '#00E676',
        });
      }
    }

    // Horizontal alignment with other objects (only if no snap yet or closer)
    const centerYDist = Math.abs(objectCenterY - otherCenterY);
    if (centerYDist < SNAP_THRESHOLD) {
      if (!closestHorizontalSnap || centerYDist < closestHorizontalSnap.distance) {
        snapTop = otherCenterY - objectBounds.height / 2;
        // Remove previous horizontal guide
        const idx = guides.findIndex((g) => g.type === 'horizontal');
        if (idx >= 0) guides.splice(idx, 1);
        guides.push({
          type: 'horizontal',
          position: otherCenterY,
          color: '#00E676',
        });
      }
    }

    // Left edge alignment
    const leftEdgeDist = Math.abs(objectLeft - otherBounds.left);
    if (leftEdgeDist < SNAP_THRESHOLD && (!closestVerticalSnap || leftEdgeDist < closestVerticalSnap.distance)) {
      snapLeft = otherBounds.left;
      const idx = guides.findIndex((g) => g.type === 'vertical');
      if (idx >= 0) guides.splice(idx, 1);
      guides.push({
        type: 'vertical',
        position: otherBounds.left,
        color: '#00E676',
      });
    }

    // Right edge alignment
    const rightEdgeDist = Math.abs(objectRight - (otherBounds.left + otherBounds.width));
    if (rightEdgeDist < SNAP_THRESHOLD && (!closestVerticalSnap || rightEdgeDist < closestVerticalSnap.distance)) {
      snapLeft = otherBounds.left + otherBounds.width - objectBounds.width;
      const idx = guides.findIndex((g) => g.type === 'vertical');
      if (idx >= 0) guides.splice(idx, 1);
      guides.push({
        type: 'vertical',
        position: otherBounds.left + otherBounds.width,
        color: '#00E676',
      });
    }

    // Top edge alignment
    const topEdgeDist = Math.abs(objectTop - otherBounds.top);
    if (topEdgeDist < SNAP_THRESHOLD && (!closestHorizontalSnap || topEdgeDist < closestHorizontalSnap.distance)) {
      snapTop = otherBounds.top;
      const idx = guides.findIndex((g) => g.type === 'horizontal');
      if (idx >= 0) guides.splice(idx, 1);
      guides.push({
        type: 'horizontal',
        position: otherBounds.top,
        color: '#00E676',
      });
    }

    // Bottom edge alignment
    const bottomEdgeDist = Math.abs(objectBottom - (otherBounds.top + otherBounds.height));
    if (bottomEdgeDist < SNAP_THRESHOLD && (!closestHorizontalSnap || bottomEdgeDist < closestHorizontalSnap.distance)) {
      snapTop = otherBounds.top + otherBounds.height - objectBounds.height;
      const idx = guides.findIndex((g) => g.type === 'horizontal');
      if (idx >= 0) guides.splice(idx, 1);
      guides.push({
        type: 'horizontal',
        position: otherBounds.top + otherBounds.height,
        color: '#00E676',
      });
    }
  });

  return {
    snapLeft,
    snapTop,
    guides,
    newSnapState: {
      isSnappedHorizontal,
      isSnappedVertical,
      currentVerticalSnapPos,
      currentHorizontalSnapPos,
    }
  };
}

/**
 * Draw alignment guides on the canvas
 */
export function drawAlignmentGuides(
  canvas: Canvas,
  guides: AlignmentGuide[],
  canvasWidth: number,
  canvasHeight: number
) {
  // Remove existing guide lines
  const existingGuides = canvas.getObjects().filter((obj) => (obj as any).name === 'alignmentGuide');
  existingGuides.forEach((guide) => canvas.remove(guide));

  // Draw new guides
  guides.forEach((guide) => {
    let line: Line;

    if (guide.type === 'vertical') {
      line = new Line([guide.position, 0, guide.position, canvasHeight], {
        stroke: guide.color || '#FF1744',
        strokeWidth: 1,
        strokeDashArray: guide.dash || [5, 5],
        selectable: false,
        evented: false,
        name: 'alignmentGuide',
      });
    } else {
      line = new Line([0, guide.position, canvasWidth, guide.position], {
        stroke: guide.color || '#FF1744',
        strokeWidth: 1,
        strokeDashArray: guide.dash || [5, 5],
        selectable: false,
        evented: false,
        name: 'alignmentGuide',
      });
    }

    canvas.add(line);
    canvas.sendObjectToBack(line);
  });

  canvas.requestRenderAll();
}

/**
 * Clear all alignment guides from the canvas
 */
export function clearAlignmentGuides(canvas: Canvas) {
  const guides = canvas.getObjects().filter((obj) => (obj as any).name === 'alignmentGuide');
  guides.forEach((guide) => canvas.remove(guide));
  canvas.requestRenderAll();
}

/**
 * Draw static guide lines (always visible)
 */
export function drawStaticGuides(
  canvas: Canvas,
  canvasWidth: number,
  canvasHeight: number,
  options: {
    showCenter?: boolean;
    showThirds?: boolean;
    showHalves?: boolean;
  } = {}
) {
  const { showCenter = true, showThirds = true, showHalves = false } = options;

  // Remove existing static guides
  const existingStaticGuides = canvas.getObjects().filter((obj) => (obj as any).name === 'staticGuide');
  existingStaticGuides.forEach((guide) => canvas.remove(guide));

  const guides: AlignmentGuide[] = [];

  // Center guides
  if (showCenter) {
    guides.push(
      { type: 'vertical', position: canvasWidth / 2, color: '#2196F3', dash: [10, 5] },
      { type: 'horizontal', position: canvasHeight / 2, color: '#2196F3', dash: [10, 5] }
    );
  }

  // Third guides
  if (showThirds) {
    guides.push(
      { type: 'vertical', position: canvasWidth / 3, color: '#9E9E9E', dash: [5, 5] },
      { type: 'vertical', position: (canvasWidth * 2) / 3, color: '#9E9E9E', dash: [5, 5] },
      { type: 'horizontal', position: canvasHeight / 3, color: '#9E9E9E', dash: [5, 5] },
      { type: 'horizontal', position: (canvasHeight * 2) / 3, color: '#9E9E9E', dash: [5, 5] }
    );
  }

  // Half guides (in addition to center)
  if (showHalves) {
    guides.push(
      { type: 'vertical', position: canvasWidth / 4, color: '#BDBDBD', dash: [3, 3] },
      { type: 'vertical', position: (canvasWidth * 3) / 4, color: '#BDBDBD', dash: [3, 3] },
      { type: 'horizontal', position: canvasHeight / 4, color: '#BDBDBD', dash: [3, 3] },
      { type: 'horizontal', position: (canvasHeight * 3) / 4, color: '#BDBDBD', dash: [3, 3] }
    );
  }

  // Draw static guides
  guides.forEach((guide) => {
    let line: Line;

    if (guide.type === 'vertical') {
      line = new Line([guide.position, 0, guide.position, canvasHeight], {
        stroke: guide.color || '#9E9E9E',
        strokeWidth: 1,
        strokeDashArray: guide.dash || [5, 5],
        selectable: false,
        evented: false,
        name: 'staticGuide',
        opacity: 0.4,
      });
    } else {
      line = new Line([0, guide.position, canvasWidth, guide.position], {
        stroke: guide.color || '#9E9E9E',
        strokeWidth: 1,
        strokeDashArray: guide.dash || [5, 5],
        selectable: false,
        evented: false,
        name: 'staticGuide',
        opacity: 0.4,
      });
    }

    canvas.add(line);
    canvas.sendObjectToBack(line);
  });

  canvas.requestRenderAll();
}
