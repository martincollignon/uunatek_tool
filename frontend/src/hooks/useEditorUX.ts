import { useEffect, useState, useCallback } from 'react';
import { Canvas, FabricObject, ActiveSelection, Group } from 'fabric';
import { useHistoryStore } from '../stores/historyStore';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import type { ZoomControls } from '../components/canvas/FabricCanvas';

interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
}

interface EditorUXOptions {
  canvas: Canvas | null;
  selectedObject: FabricObject | null;
  zoomControls: ZoomControls | null;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

export function useEditorUX({
  canvas,
  selectedObject,
  zoomControls,
  onDelete,
  onDuplicate,
}: EditorUXOptions) {
  const { saveState, undo, redo, canUndo, canRedo, isRestoring } = useHistoryStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false });
  const [clipboard, setClipboard] = useState<FabricObject | null>(null);

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    canvas,
    selectedObject,
    onDelete,
    onDuplicate,
    zoomControls,
  });

  // Setup canvas event handlers for history
  useEffect(() => {
    if (!canvas) return;

    const handleModified = () => {
      if (!isRestoring) {
        saveState(canvas);
      }
    };

    const handleAdded = () => {
      if (!isRestoring) {
        saveState(canvas);
      }
    };

    const handleRemoved = () => {
      if (!isRestoring) {
        saveState(canvas);
      }
    };

    canvas.on('object:modified', handleModified);
    canvas.on('object:added', handleAdded);
    canvas.on('object:removed', handleRemoved);

    // Save initial state
    if (!isRestoring) {
      saveState(canvas);
    }

    return () => {
      canvas.off('object:modified', handleModified);
      canvas.off('object:added', handleAdded);
      canvas.off('object:removed', handleRemoved);
    };
  }, [canvas, saveState, isRestoring]);

  // Context menu handler
  useEffect(() => {
    if (!canvas) return;

    const handleContextMenu = (e: any) => {
      const evt = e.e as MouseEvent;
      evt.preventDefault();
      setContextMenu({ x: evt.clientX, y: evt.clientY, visible: true });
    };

    const handleMouseDown = (e: any) => {
      if ((e.e as MouseEvent).button === 2) {
        handleContextMenu(e);
      }
    };

    canvas.on('mouse:down', handleMouseDown);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
    };
  }, [canvas]);

  // Context menu actions
  const handleCopy = useCallback(() => {
    if (!selectedObject) return;
    selectedObject.clone().then((cloned: FabricObject) => {
      setClipboard(cloned);
    });
  }, [selectedObject]);

  const handleCut = useCallback(() => {
    if (!canvas || !selectedObject) return;
    selectedObject.clone().then((cloned: FabricObject) => {
      setClipboard(cloned);
      const active = canvas.getActiveObjects();
      if (active.length > 0) {
        active.forEach((obj) => canvas.remove(obj));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        saveState(canvas);
      }
    });
  }, [canvas, selectedObject, saveState]);

  const handlePaste = useCallback(() => {
    if (!canvas || !clipboard) return;
    clipboard.clone().then((cloned: FabricObject) => {
      cloned.set({
        left: (cloned.left || 0) + 10,
        top: (cloned.top || 0) + 10,
      });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
      saveState(canvas);
      setClipboard(cloned);
    });
  }, [canvas, clipboard, saveState]);

  const handleDuplicate = useCallback(() => {
    if (!canvas || !selectedObject) return;
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
  }, [canvas, selectedObject, onDuplicate, saveState]);

  const handleDelete = useCallback(() => {
    if (!canvas) return;
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
  }, [canvas, onDelete, saveState]);

  const handleBringToFront = useCallback(() => {
    if (!canvas || !selectedObject) return;
    canvas.bringObjectToFront(selectedObject);
    canvas.requestRenderAll();
    saveState(canvas);
  }, [canvas, selectedObject, saveState]);

  const handleSendToBack = useCallback(() => {
    if (!canvas || !selectedObject) return;
    canvas.sendObjectToBack(selectedObject);
    canvas.requestRenderAll();
    saveState(canvas);
  }, [canvas, selectedObject, saveState]);

  const handleLock = useCallback(() => {
    if (!canvas || !selectedObject) return;
    selectedObject.set({
      selectable: false,
      evented: false,
    });
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    saveState(canvas);
  }, [canvas, selectedObject, saveState]);

  const handleUnlock = useCallback(() => {
    if (!canvas || !selectedObject) return;
    selectedObject.set({
      selectable: true,
      evented: true,
    });
    canvas.requestRenderAll();
    saveState(canvas);
  }, [canvas, selectedObject, saveState]);

  const handleGroup = useCallback(() => {
    if (!canvas) return;
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
  }, [canvas, saveState]);

  const handleUngroup = useCallback(() => {
    if (!canvas) return;
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
  }, [canvas, saveState]);

  const handleUndo = useCallback(async () => {
    if (canvas && canUndo()) {
      try {
        await undo(canvas);
      } catch (error) {
        console.error('Undo failed:', error);
      }
    }
  }, [canvas, undo, canUndo]);

  const handleRedo = useCallback(async () => {
    if (canvas && canRedo()) {
      try {
        await redo(canvas);
      } catch (error) {
        console.error('Redo failed:', error);
      }
    }
  }, [canvas, redo, canRedo]);

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  return {
    // History
    canUndo: canUndo(),
    canRedo: canRedo(),
    handleUndo,
    handleRedo,

    // Context menu
    contextMenu,
    closeContextMenu,

    // Clipboard
    hasClipboard: clipboard !== null,

    // Context menu actions
    handleCopy,
    handleCut,
    handlePaste,
    handleDuplicate,
    handleDelete,
    handleBringToFront,
    handleSendToBack,
    handleLock,
    handleUnlock,
    handleGroup,
    handleUngroup,
  };
}
