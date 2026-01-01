import { useEffect, useRef } from 'react';
import { Canvas, FabricObject, ActiveSelection, Group } from 'fabric';
import { useHistoryStore } from '../stores/historyStore';
import { useCanvasStore } from '../stores/canvasStore';

interface KeyboardShortcutsOptions {
  canvas: Canvas | null;
  selectedObject: FabricObject | null;
  onDelete?: () => void;
  onDuplicate?: () => void;
  zoomControls?: {
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
  } | null;
}

export function useKeyboardShortcuts({
  canvas,
  selectedObject,
  onDelete,
  onDuplicate,
  zoomControls,
}: KeyboardShortcutsOptions) {
  const { undo, redo, canUndo, canRedo, saveState } = useHistoryStore();
  const { setDirty } = useCanvasStore();
  const clipboardRef = useRef<FabricObject | null>(null);
  const isDraggingWithAltRef = useRef(false);

  useEffect(() => {
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      const isEditingText =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.isContentEditable;

      // Don't handle shortcuts while editing text (except undo/redo/save)
      const isMetaKey = e.metaKey || e.ctrlKey;

      // Always allow undo/redo/save
      if (isMetaKey && (e.key === 'z' || e.key === 's')) {
        // Continue to handle these
      } else if (isEditingText) {
        return;
      }

      // Undo (Cmd/Ctrl+Z)
      if (isMetaKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo(canvas).catch((error) => {
            console.error('Undo failed:', error);
          });
        }
        return;
      }

      // Redo (Cmd/Ctrl+Shift+Z)
      if (isMetaKey && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (canRedo()) {
          redo(canvas).catch((error) => {
            console.error('Redo failed:', error);
          });
        }
        return;
      }

      // Save (Cmd/Ctrl+S)
      if (isMetaKey && e.key === 's') {
        e.preventDefault();
        // Trigger save through canvas dirty state
        setDirty(true);
        return;
      }

      // Delete/Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObject) {
          e.preventDefault();
          if (onDelete) {
            onDelete();
          } else {
            const active = canvas.getActiveObjects();
            if (active.length > 0) {
              active.forEach((obj) => canvas.remove(obj));
              canvas.discardActiveObject();
              canvas.requestRenderAll();
              saveState(canvas);
            }
          }
        }
        return;
      }

      // Copy (Cmd/Ctrl+C)
      if (isMetaKey && e.key === 'c') {
        if (selectedObject) {
          e.preventDefault();
          selectedObject.clone().then((cloned: FabricObject) => {
            clipboardRef.current = cloned;
          });
        }
        return;
      }

      // Cut (Cmd/Ctrl+X)
      if (isMetaKey && e.key === 'x') {
        if (selectedObject) {
          e.preventDefault();
          selectedObject.clone().then((cloned: FabricObject) => {
            clipboardRef.current = cloned;
            const active = canvas.getActiveObjects();
            if (active.length > 0) {
              active.forEach((obj) => canvas.remove(obj));
              canvas.discardActiveObject();
              canvas.requestRenderAll();
              saveState(canvas);
            }
          });
        }
        return;
      }

      // Paste (Cmd/Ctrl+V)
      if (isMetaKey && e.key === 'v') {
        if (clipboardRef.current) {
          e.preventDefault();
          clipboardRef.current.clone().then((cloned: FabricObject) => {
            cloned.set({
              left: (cloned.left || 0) + 10,
              top: (cloned.top || 0) + 10,
            });
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.requestRenderAll();
            saveState(canvas);
            clipboardRef.current = cloned;
          });
        }
        return;
      }

      // Duplicate (Cmd/Ctrl+D)
      if (isMetaKey && e.key === 'd') {
        if (selectedObject) {
          e.preventDefault();
          if (onDuplicate) {
            onDuplicate();
          } else {
            selectedObject.clone().then((cloned: FabricObject) => {
              cloned.set({
                left: (cloned.left || 0) + 10,
                top: (cloned.top || 0) + 10,
              });
              canvas.add(cloned);
              canvas.setActiveObject(cloned);
              canvas.requestRenderAll();
              saveState(canvas);
            });
          }
        }
        return;
      }

      // Select All (Cmd/Ctrl+A)
      if (isMetaKey && e.key === 'a') {
        e.preventDefault();
        const objects = canvas.getObjects().filter(
          (obj) => obj.selectable !== false && (obj as any).name !== 'canvas-boundary'
        );
        if (objects.length > 0) {
          const selection = new ActiveSelection(objects, { canvas });
          canvas.setActiveObject(selection);
          canvas.requestRenderAll();
        }
        return;
      }

      // Group (Cmd/Ctrl+G)
      if (isMetaKey && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        const activeObj = canvas.getActiveObject();
        if (activeObj && activeObj.type === 'activeSelection') {
          const selection = activeObj as ActiveSelection;
          const objects = selection.getObjects();
          const group = new Group(objects);
          canvas.remove(...objects);
          canvas.add(group);
          canvas.setActiveObject(group);
          canvas.requestRenderAll();
          saveState(canvas);
        }
        return;
      }

      // Ungroup (Cmd/Ctrl+Shift+G)
      if (isMetaKey && e.key === 'g' && e.shiftKey) {
        e.preventDefault();
        const activeObj = canvas.getActiveObject();
        if (activeObj && activeObj.type === 'group') {
          const group = activeObj as Group;
          const items = group.getObjects();
          canvas.remove(group);
          items.forEach((item: FabricObject) => {
            canvas.add(item);
          });
          const selection = new ActiveSelection(items, { canvas });
          canvas.setActiveObject(selection);
          canvas.requestRenderAll();
          saveState(canvas);
        }
        return;
      }

      // Bring to Front (Cmd/Ctrl+])
      if (isMetaKey && e.key === ']') {
        if (selectedObject) {
          e.preventDefault();
          canvas.bringObjectToFront(selectedObject);
          canvas.requestRenderAll();
          saveState(canvas);
        }
        return;
      }

      // Send to Back (Cmd/Ctrl+[)
      if (isMetaKey && e.key === '[') {
        if (selectedObject) {
          e.preventDefault();
          canvas.sendObjectToBack(selectedObject);
          canvas.requestRenderAll();
          saveState(canvas);
        }
        return;
      }

      // Bring Forward (Cmd/Ctrl+Shift+])
      if (isMetaKey && e.shiftKey && e.key === ']') {
        if (selectedObject) {
          e.preventDefault();
          canvas.bringObjectForward(selectedObject);
          canvas.requestRenderAll();
          saveState(canvas);
        }
        return;
      }

      // Send Backward (Cmd/Ctrl+Shift+[)
      if (isMetaKey && e.shiftKey && e.key === '[') {
        if (selectedObject) {
          e.preventDefault();
          canvas.sendObjectBackwards(selectedObject);
          canvas.requestRenderAll();
          saveState(canvas);
        }
        return;
      }

      // Zoom In (Cmd/Ctrl++)
      if (isMetaKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        if (zoomControls) {
          zoomControls.zoomIn();
        }
        return;
      }

      // Zoom Out (Cmd/Ctrl+-)
      if (isMetaKey && e.key === '-') {
        e.preventDefault();
        if (zoomControls) {
          zoomControls.zoomOut();
        }
        return;
      }

      // Reset Zoom (Cmd/Ctrl+0)
      if (isMetaKey && e.key === '0') {
        e.preventDefault();
        if (zoomControls) {
          zoomControls.resetZoom();
        }
        return;
      }

      // Arrow keys for moving objects
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedObject) {
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
          saveState(canvas);
        }
      }
    };

    // Handle Alt+Drag for duplication
    const handleMouseDown = (e: any) => {
      if (e.e.altKey && canvas.getActiveObject()) {
        isDraggingWithAltRef.current = true;
      }
    };

    const handleMouseUp = () => {
      if (isDraggingWithAltRef.current && canvas.getActiveObject()) {
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
          activeObj.clone().then((cloned: FabricObject) => {
            cloned.set({
              left: activeObj.left,
              top: activeObj.top,
            });
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.requestRenderAll();
            saveState(canvas);
          });
        }
      }
      isDraggingWithAltRef.current = false;
    };

    document.addEventListener('keydown', handleKeyDown);
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [
    canvas,
    selectedObject,
    onDelete,
    onDuplicate,
    zoomControls,
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
    setDirty,
  ]);
}
