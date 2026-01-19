/**
 * Canvas selection hook
 * Handles canvas object selection and keyboard shortcuts
 */

import { useEffect } from 'react';
import { Canvas, FabricObject } from 'fabric';

export function useCanvasSelection(
  canvas: Canvas | null,
  selectedObject: FabricObject | null,
  onDelete: () => void,
  onSetDirty: (dirty: boolean) => void
) {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      const isEditingText = activeElement?.tagName === 'INPUT' ||
                            activeElement?.tagName === 'TEXTAREA' ||
                            activeElement?.isContentEditable;

      // Don't handle keyboard shortcuts while editing text
      if (isEditingText) return;

      // Handle delete/backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (canvas && selectedObject) {
          e.preventDefault();
          onDelete();
        }
      }

      // Handle arrow keys for moving objects
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (canvas && selectedObject) {
          e.preventDefault();

          // Determine step size: 10px with Shift, 1px otherwise
          const step = e.shiftKey ? 10 : 1;

          const currentLeft = selectedObject.left || 0;
          const currentTop = selectedObject.top || 0;

          switch (e.key) {
            case 'ArrowUp':
              selectedObject.set('top', currentTop - step);
              break;
            case 'ArrowDown':
              selectedObject.set('top', currentTop + step);
              break;
            case 'ArrowLeft':
              selectedObject.set('left', currentLeft - step);
              break;
            case 'ArrowRight':
              selectedObject.set('left', currentLeft + step);
              break;
          }

          selectedObject.setCoords();
          canvas.requestRenderAll();
          onSetDirty(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canvas, selectedObject, onDelete, onSetDirty]);
}
