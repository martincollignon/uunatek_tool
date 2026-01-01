/**
 * Fabric.js performance optimization utilities
 *
 * This module provides performance optimization configurations and utilities
 * for Fabric.js canvas operations to improve rendering and interaction performance.
 */

import { Canvas, FabricObject } from 'fabric';

/**
 * Configuration for batch operations that add/remove multiple objects
 * Disables automatic rendering during batch operations
 */
export const batchOperationConfig = {
  renderOnAddRemove: false,
};

/**
 * Apply performance optimizations to a canvas instance
 */
export function applyCanvasOptimizations(canvas: Canvas): void {
  // Enable object caching for better performance with complex paths
  canvas.enableRetinaScaling = true;

  // Optimize selection for better performance
  canvas.selection = true;
  canvas.preserveObjectStacking = true;
}

/**
 * Configure an object for non-interactive use (guide lines, boundaries, etc.)
 * Disables selection and events for objects that should not be interactive
 */
export function makeNonInteractive(obj: FabricObject): void {
  obj.set({
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
  });
}

/**
 * Enable object caching for complex paths to improve rendering performance
 * Call this after creating or modifying complex path objects
 */
export function enableObjectCaching(obj: FabricObject): void {
  obj.set({
    objectCaching: true,
    statefullCache: true,
    noScaleCache: false,
  });
}

/**
 * Disable object caching for objects that change frequently
 * Use for objects with animations or frequent updates
 */
export function disableObjectCaching(obj: FabricObject): void {
  obj.set({
    objectCaching: false,
  });
}

/**
 * Optimize canvas for zoom/pan operations
 * Call before starting zoom or pan to improve performance
 */
export function optimizeForZoomPan(canvas: Canvas): void {
  // Disable target finding during zoom/pan for better performance
  canvas.skipTargetFind = true;
  canvas.selection = false;
}

/**
 * Restore canvas after zoom/pan operations
 * Call after completing zoom or pan to restore normal behavior
 */
export function restoreAfterZoomPan(canvas: Canvas): void {
  canvas.skipTargetFind = false;
  canvas.selection = true;
}

/**
 * Batch add multiple objects to canvas with optimized rendering
 * More efficient than adding objects one at a time
 */
export function batchAddObjects(canvas: Canvas, objects: FabricObject[]): void {
  canvas.renderOnAddRemove = false;

  objects.forEach(obj => canvas.add(obj));

  canvas.renderOnAddRemove = true;
  canvas.requestRenderAll();
}

/**
 * Batch remove multiple objects from canvas with optimized rendering
 * More efficient than removing objects one at a time
 */
export function batchRemoveObjects(canvas: Canvas, objects: FabricObject[]): void {
  canvas.renderOnAddRemove = false;

  objects.forEach(obj => canvas.remove(obj));

  canvas.renderOnAddRemove = true;
  canvas.requestRenderAll();
}

/**
 * Optimize group objects for better performance
 */
export function optimizeGroup(group: FabricObject): void {
  // Enable caching for groups
  enableObjectCaching(group);

  // Optimize all objects in the group
  const objects = (group as any).getObjects?.() || [];
  objects.forEach((obj: FabricObject) => {
    enableObjectCaching(obj);
  });
}

/**
 * Create a debounced render function for canvas
 * Useful for preventing excessive renders during rapid property changes
 */
export function createDebouncedRender(canvas: Canvas, delay: number = 16): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      canvas.requestRenderAll();
      timeoutId = null;
    }, delay);
  };
}

/**
 * Performance monitoring utility for canvas operations
 */
export class CanvasPerformanceMonitor {
  private startTime: number = 0;
  private label: string = '';

  start(label: string): void {
    this.label = label;
    this.startTime = performance.now();
  }

  end(): void {
    const duration = performance.now() - this.startTime;
    console.log(`[Canvas Performance] ${this.label}: ${duration.toFixed(2)}ms`);
  }

  measure<T>(label: string, fn: () => T): T {
    this.start(label);
    const result = fn();
    this.end();
    return result;
  }

  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    const result = await fn();
    this.end();
    return result;
  }
}
