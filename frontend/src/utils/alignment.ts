import { Canvas, FabricObject } from 'fabric';

export interface AlignmentOptions {
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Align selected objects to the left edge
 */
export function alignLeft(canvas: Canvas): void {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length === 0) return;

  // Find leftmost position
  const leftmost = Math.min(...activeObjects.map((obj) => obj.left || 0));

  activeObjects.forEach((obj) => {
    obj.set('left', leftmost);
    obj.setCoords();
  });

  canvas.requestRenderAll();
}

/**
 * Align selected objects to horizontal center
 */
export function alignCenterHorizontal(canvas: Canvas, canvasWidth: number): void {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length === 0) return;

  if (activeObjects.length === 1) {
    // Align to canvas center
    const obj = activeObjects[0];
    const objWidth = (obj.width || 0) * (obj.scaleX || 1);
    obj.set('left', (canvasWidth - objWidth) / 2);
    obj.setCoords();
  } else {
    // Align to center of selection
    const bounds = getSelectionBounds(activeObjects);
    const centerX = bounds.left + bounds.width / 2;

    activeObjects.forEach((obj) => {
      const objWidth = (obj.width || 0) * (obj.scaleX || 1);
      obj.set('left', centerX - objWidth / 2);
      obj.setCoords();
    });
  }

  canvas.requestRenderAll();
}

/**
 * Align selected objects to the right edge
 */
export function alignRight(canvas: Canvas): void {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length === 0) return;

  // Find rightmost position
  const rightmost = Math.max(
    ...activeObjects.map((obj) => (obj.left || 0) + (obj.width || 0) * (obj.scaleX || 1))
  );

  activeObjects.forEach((obj) => {
    const objWidth = (obj.width || 0) * (obj.scaleX || 1);
    obj.set('left', rightmost - objWidth);
    obj.setCoords();
  });

  canvas.requestRenderAll();
}

/**
 * Align selected objects to the top edge
 */
export function alignTop(canvas: Canvas): void {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length === 0) return;

  // Find topmost position
  const topmost = Math.min(...activeObjects.map((obj) => obj.top || 0));

  activeObjects.forEach((obj) => {
    obj.set('top', topmost);
    obj.setCoords();
  });

  canvas.requestRenderAll();
}

/**
 * Align selected objects to vertical middle
 */
export function alignMiddleVertical(canvas: Canvas, canvasHeight: number): void {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length === 0) return;

  if (activeObjects.length === 1) {
    // Align to canvas middle
    const obj = activeObjects[0];
    const objHeight = (obj.height || 0) * (obj.scaleY || 1);
    obj.set('top', (canvasHeight - objHeight) / 2);
    obj.setCoords();
  } else {
    // Align to middle of selection
    const bounds = getSelectionBounds(activeObjects);
    const centerY = bounds.top + bounds.height / 2;

    activeObjects.forEach((obj) => {
      const objHeight = (obj.height || 0) * (obj.scaleY || 1);
      obj.set('top', centerY - objHeight / 2);
      obj.setCoords();
    });
  }

  canvas.requestRenderAll();
}

/**
 * Align selected objects to the bottom edge
 */
export function alignBottom(canvas: Canvas): void {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length === 0) return;

  // Find bottommost position
  const bottommost = Math.max(
    ...activeObjects.map((obj) => (obj.top || 0) + (obj.height || 0) * (obj.scaleY || 1))
  );

  activeObjects.forEach((obj) => {
    const objHeight = (obj.height || 0) * (obj.scaleY || 1);
    obj.set('top', bottommost - objHeight);
    obj.setCoords();
  });

  canvas.requestRenderAll();
}

/**
 * Distribute selected objects horizontally with equal spacing
 */
export function distributeHorizontally(canvas: Canvas): void {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length < 3) return;

  // Sort by left position
  const sorted = [...activeObjects].sort((a, b) => (a.left || 0) - (b.left || 0));

  // Calculate total width and spacing
  const leftmost = sorted[0].left || 0;
  const rightmost = (sorted[sorted.length - 1].left || 0) +
    (sorted[sorted.length - 1].width || 0) * (sorted[sorted.length - 1].scaleX || 1);
  const totalWidth = rightmost - leftmost;

  const objectsWidth = sorted.reduce(
    (sum, obj) => sum + (obj.width || 0) * (obj.scaleX || 1),
    0
  );
  const spacing = (totalWidth - objectsWidth) / (sorted.length - 1);

  // Distribute objects
  let currentLeft = leftmost;
  sorted.forEach((obj, index) => {
    if (index > 0 && index < sorted.length - 1) {
      obj.set('left', currentLeft);
      obj.setCoords();
    }
    currentLeft += (obj.width || 0) * (obj.scaleX || 1) + spacing;
  });

  canvas.requestRenderAll();
}

/**
 * Distribute selected objects vertically with equal spacing
 */
export function distributeVertically(canvas: Canvas): void {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length < 3) return;

  // Sort by top position
  const sorted = [...activeObjects].sort((a, b) => (a.top || 0) - (b.top || 0));

  // Calculate total height and spacing
  const topmost = sorted[0].top || 0;
  const bottommost = (sorted[sorted.length - 1].top || 0) +
    (sorted[sorted.length - 1].height || 0) * (sorted[sorted.length - 1].scaleY || 1);
  const totalHeight = bottommost - topmost;

  const objectsHeight = sorted.reduce(
    (sum, obj) => sum + (obj.height || 0) * (obj.scaleY || 1),
    0
  );
  const spacing = (totalHeight - objectsHeight) / (sorted.length - 1);

  // Distribute objects
  let currentTop = topmost;
  sorted.forEach((obj, index) => {
    if (index > 0 && index < sorted.length - 1) {
      obj.set('top', currentTop);
      obj.setCoords();
    }
    currentTop += (obj.height || 0) * (obj.scaleY || 1) + spacing;
  });

  canvas.requestRenderAll();
}

/**
 * Helper function to get bounds of multiple objects
 */
function getSelectionBounds(objects: FabricObject[]): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const lefts = objects.map((obj) => obj.left || 0);
  const tops = objects.map((obj) => obj.top || 0);
  const rights = objects.map((obj) => (obj.left || 0) + (obj.width || 0) * (obj.scaleX || 1));
  const bottoms = objects.map((obj) => (obj.top || 0) + (obj.height || 0) * (obj.scaleY || 1));

  const left = Math.min(...lefts);
  const top = Math.min(...tops);
  const right = Math.max(...rights);
  const bottom = Math.max(...bottoms);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}
