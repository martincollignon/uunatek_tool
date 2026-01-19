/**
 * Pattern generation hook with optimized debouncing and in-place updates
 * Handles fill pattern regeneration with updated properties
 */

import { useRef, useCallback, useEffect } from 'react';
import { Canvas, FabricObject } from 'fabric';
import {
  PatternUpdateManager,
  requiresFullRegeneration,
  updatePatternPropertiesInPlace,
} from '../utils/patterns';

interface PatternUpdates {
  spacing?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export function usePatternGeneration(
  canvas: Canvas | null,
  canvasWidthMm: number,
  canvasHeightMm: number,
  onObjectUpdate: (obj: FabricObject) => void,
  onSetDirty: (dirty: boolean) => void
) {
  const updateManagerRef = useRef<PatternUpdateManager | null>(null);

  // Initialize or update the pattern update manager
  useEffect(() => {
    if (!canvas) return;

    const currentProject = {
      width_mm: canvasWidthMm,
      height_mm: canvasHeightMm,
    };

    updateManagerRef.current = new PatternUpdateManager(
      canvas,
      currentProject,
      300, // 300ms debounce delay
      (obj) => {
        onObjectUpdate(obj);
        onSetDirty(true);
      }
    );

    return () => {
      updateManagerRef.current?.cancel();
    };
  }, [canvas, canvasWidthMm, canvasHeightMm, onObjectUpdate, onSetDirty]);

  /**
   * Regenerate fill pattern with updated properties
   * Uses intelligent batching and debouncing for optimal performance
   */
  const regenerateFillPattern = useCallback(
    (obj: FabricObject, updates: PatternUpdates) => {
      if (!canvas || !updateManagerRef.current) return;

      // Check if this requires full regeneration
      if (requiresFullRegeneration(updates)) {
        // Queue for debounced regeneration
        updateManagerRef.current.queueUpdate(obj, updates);
      } else {
        // Apply in-place update immediately for better UX
        const updated = updatePatternPropertiesInPlace(obj, updates);
        if (updated) {
          canvas.requestRenderAll();
          onObjectUpdate(obj);
          onSetDirty(true);
        }
      }
    },
    [canvas, onObjectUpdate, onSetDirty]
  );

  /**
   * Force immediate update (bypass debouncing)
   * Useful for when user explicitly commits a change (e.g., blur event)
   */
  const flushUpdates = useCallback(() => {
    updateManagerRef.current?.flush();
  }, []);

  /**
   * Cancel pending updates
   * Useful for cleanup or when user cancels an operation
   */
  const cancelUpdates = useCallback(() => {
    updateManagerRef.current?.cancel();
  }, []);

  /**
   * Check if there are pending updates
   */
  const hasPendingUpdates = useCallback(() => {
    return updateManagerRef.current?.hasPending() ?? false;
  }, []);

  return {
    regenerateFillPattern,
    flushUpdates,
    cancelUpdates,
    hasPendingUpdates,
  };
}
