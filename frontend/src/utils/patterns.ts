import type { Canvas, FabricObject } from 'fabric';
import {
  createPolkaDotFill,
  createDiagonalStripeFill,
  createChevronFill,
  createCheckerboardFill,
  createGraphGridFill,
  createPlusGridFill,
  createSquiggleFill,
} from './fillPatterns';

// Map pattern IDs to their creation functions
export const FILL_PATTERN_CREATORS: Record<string, (options: any) => any> = {
  'polkadot': createPolkaDotFill,
  'diagonal': createDiagonalStripeFill,
  'chevron-fill': createChevronFill,
  'checkerboard': createCheckerboardFill,
  'graph': createGraphGridFill,
  'plus': createPlusGridFill,
  'squiggle': createSquiggleFill,
};

interface PatternUpdateOptions {
  spacing?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

interface ProjectDimensions {
  width_mm: number;
  height_mm: number;
}

/**
 * Debounce helper function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Update pattern properties in-place when possible
 * This avoids recreating the entire pattern for simple property changes
 */
export function updatePatternPropertiesInPlace(
  obj: FabricObject,
  updates: PatternUpdateOptions
): boolean {
  let updated = false;

  // Update stroke color if changed
  if (updates.strokeColor !== undefined) {
    const currentColor = (obj as any).fillPatternStroke;
    if (currentColor !== updates.strokeColor) {
      obj.set('stroke', updates.strokeColor);
      (obj as any).fillPatternStroke = updates.strokeColor;
      updated = true;
    }
  }

  // Update stroke width if changed
  if (updates.strokeWidth !== undefined) {
    const currentWidth = (obj as any).fillPatternStrokeWidth;
    if (currentWidth !== updates.strokeWidth) {
      obj.set('strokeWidth', updates.strokeWidth * 3);
      (obj as any).fillPatternStrokeWidth = updates.strokeWidth;
      updated = true;
    }
  }

  // Note: spacing requires full regeneration
  return updated;
}

/**
 * Check if an update requires full pattern regeneration
 */
export function requiresFullRegeneration(updates: PatternUpdateOptions): boolean {
  return updates.spacing !== undefined;
}

/**
 * Regenerate fill pattern with updated properties
 * This creates a new pattern object with the updated settings
 */
export function regenerateFillPattern(
  canvas: Canvas,
  obj: FabricObject,
  currentProject: ProjectDimensions,
  updates: PatternUpdateOptions,
  onComplete?: (newPattern: FabricObject) => void
): FabricObject | null {
  if (!canvas || !currentProject) return null;

  const patternType = (obj as any).fillPatternType;
  const createFn = FILL_PATTERN_CREATORS[patternType];
  if (!createFn) return null;

  // Get existing properties, applying updates
  const borderMargin = (obj as any).fillPatternBorderMargin || 10;
  const spacing = updates.spacing ?? (obj as any).fillPatternSpacing ?? 4;
  const strokeColor = updates.strokeColor ?? (obj as any).fillPatternStroke ?? '#000000';
  const strokeWidth = updates.strokeWidth ?? (obj as any).fillPatternStrokeWidth ?? 0.5;
  const rotation = obj.angle || 0;

  // Store position before removing
  const left = obj.left;
  const top = obj.top;

  // Create new pattern with updated properties
  const newPattern = createFn({
    canvasWidthMm: currentProject.width_mm,
    canvasHeightMm: currentProject.height_mm,
    borderMarginMm: borderMargin,
    spacingMm: spacing,
    strokeWidth: strokeWidth * 3,
    stroke: strokeColor,
    rotation: 0, // We'll set rotation after
  });

  // Copy metadata to new pattern
  newPattern.set('fillPatternType', patternType);
  newPattern.set('fillPatternSpacing', spacing);
  newPattern.set('fillPatternBorderMargin', borderMargin);
  newPattern.set('fillPatternStroke', strokeColor);
  newPattern.set('fillPatternStrokeWidth', strokeWidth);
  newPattern.set('angle', rotation);
  newPattern.set('left', left);
  newPattern.set('top', top);

  // Remove old pattern and add new one
  canvas.remove(obj);
  canvas.add(newPattern);
  canvas.setActiveObject(newPattern);
  canvas.requestRenderAll();

  if (onComplete) {
    onComplete(newPattern);
  }

  return newPattern;
}

/**
 * Create a debounced version of pattern regeneration
 * Use this to avoid excessive regeneration when rapidly changing properties
 */
export function createDebouncedPatternRegeneration(
  canvas: Canvas,
  currentProject: ProjectDimensions,
  onComplete?: (newPattern: FabricObject) => void,
  debounceMs: number = 300
) {
  return debounce(
    (obj: FabricObject, updates: PatternUpdateOptions) => {
      regenerateFillPattern(canvas, obj, currentProject, updates, onComplete);
    },
    debounceMs
  );
}

/**
 * Smart pattern update that chooses between in-place update and full regeneration
 */
export function updatePattern(
  canvas: Canvas,
  obj: FabricObject,
  currentProject: ProjectDimensions,
  updates: PatternUpdateOptions,
  onComplete?: (obj: FabricObject) => void
): FabricObject {
  // Check if we need full regeneration
  if (requiresFullRegeneration(updates)) {
    const newPattern = regenerateFillPattern(canvas, obj, currentProject, updates, onComplete);
    return newPattern || obj;
  }

  // Try in-place update
  const updated = updatePatternPropertiesInPlace(obj, updates);
  if (updated) {
    canvas.requestRenderAll();
    if (onComplete) {
      onComplete(obj);
    }
  }

  return obj;
}

/**
 * Batch update multiple pattern properties with debouncing
 */
export class PatternUpdateManager {
  private pendingUpdates: Map<FabricObject, PatternUpdateOptions> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private canvas: Canvas;
  private currentProject: ProjectDimensions;
  private onComplete?: (obj: FabricObject) => void;
  private debounceMs: number;

  constructor(
    canvas: Canvas,
    currentProject: ProjectDimensions,
    debounceMs: number = 300,
    onComplete?: (obj: FabricObject) => void
  ) {
    this.canvas = canvas;
    this.currentProject = currentProject;
    this.debounceMs = debounceMs;
    this.onComplete = onComplete;
  }

  /**
   * Queue a pattern update
   */
  queueUpdate(obj: FabricObject, updates: PatternUpdateOptions) {
    // Merge with existing pending updates for this object
    const existing = this.pendingUpdates.get(obj) || {};
    this.pendingUpdates.set(obj, { ...existing, ...updates });

    // Reset debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }

  /**
   * Immediately apply all pending updates
   */
  flush() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.pendingUpdates.forEach((updates, obj) => {
      updatePattern(this.canvas, obj, this.currentProject, updates, this.onComplete);
    });

    this.pendingUpdates.clear();
  }

  /**
   * Cancel all pending updates
   */
  cancel() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingUpdates.clear();
  }

  /**
   * Check if there are pending updates
   */
  hasPending(): boolean {
    return this.pendingUpdates.size > 0;
  }
}
