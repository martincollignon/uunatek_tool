/**
 * Canvas save hook
 * Handles canvas save operations and auto-save functionality
 */

import { useEffect, useCallback } from 'react';
import { Canvas } from 'fabric';
import { useCanvasStore } from '../stores/canvasStore';
import type { CanvasSide } from '../types';

export function useCanvasSave(
  canvas: Canvas | null,
  projectId: string | undefined,
  currentSide: CanvasSide
) {
  const { isDirty, saveCanvas, setDirty } = useCanvasStore();

  const handleSave = useCallback(async () => {
    if (!canvas || !projectId) return;

    // Debug: Log all canvas objects before serialization
    const objects = canvas.getObjects();
    console.log('Canvas objects before toJSON:', objects.length, objects.map((o: any) => ({
      type: o.type,
      name: o.name,
      selectable: o.selectable,
      evented: o.evented,
      excludeFromExport: o.excludeFromExport
    })));

    // Include ALL properties in serialization (including custom pattern properties)
    const json = (canvas as any).toJSON([
      'name',
      'selectable',
      'evented',
      'excludeFromExport',
      'fillPatternType',
      'fillPatternSpacing',
      'fillPatternBorderMargin',
      'fillPatternStroke',
      'fillPatternStrokeWidth'
    ]);

    console.log('Canvas JSON objects after toJSON:', json.objects?.length);
    console.log('Canvas JSON full:', JSON.stringify(json, null, 2));

    await saveCanvas(projectId, json as Record<string, unknown>, currentSide);
  }, [canvas, projectId, currentSide, saveCanvas]);

  // Auto-save when canvas becomes dirty
  useEffect(() => {
    if (!isDirty || !canvas || !projectId) return;

    // Debounce auto-save by 2000ms to give user time to finish their edits
    const timeoutId = setTimeout(async () => {
      // Debug: Log all canvas objects before serialization (auto-save)
      const objects = canvas.getObjects();
      console.log('[AUTO-SAVE] Canvas objects before toJSON:', objects.length, objects.map((o: any) => ({
        type: o.type,
        name: o.name,
        selectable: o.selectable,
        evented: o.evented,
        excludeFromExport: o.excludeFromExport
      })));

      // Include ALL properties in serialization (including custom pattern properties)
      const json = (canvas as any).toJSON([
        'name',
        'selectable',
        'evented',
        'excludeFromExport',
        'fillPatternType',
        'fillPatternSpacing',
        'fillPatternBorderMargin',
        'fillPatternStroke',
        'fillPatternStrokeWidth'
      ]);

      console.log('[AUTO-SAVE] Canvas JSON objects after toJSON:', json.objects?.length);
      console.log('[AUTO-SAVE] Full JSON structure:', JSON.stringify(json, null, 2));

      await saveCanvas(projectId, json as Record<string, unknown>, currentSide);
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [isDirty, canvas, projectId, currentSide, saveCanvas]);

  return {
    handleSave,
    isDirty,
    setDirty,
  };
}
