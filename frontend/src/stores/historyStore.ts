import { create } from 'zustand';
import type { Canvas } from 'fabric';

interface HistoryState {
  undoStack: string[];
  redoStack: string[];
  maxStates: number;
  isRestoring: boolean;

  // Actions
  saveState: (canvas: Canvas) => void;
  undo: (canvas: Canvas) => Promise<void>;
  redo: (canvas: Canvas) => Promise<void>;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  setRestoring: (restoring: boolean) => void;
}

const MAX_HISTORY_STATES = 50;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxStates: MAX_HISTORY_STATES,
  isRestoring: false,

  saveState: (canvas: Canvas) => {
    const { isRestoring, maxStates } = get();

    // Don't save state during restoration to prevent recursive saves
    if (isRestoring) return;

    try {
      const json = JSON.stringify(canvas.toJSON());

      set((state) => {
        const newUndoStack = [...state.undoStack, json];

        // Limit stack size
        if (newUndoStack.length > maxStates) {
          newUndoStack.shift();
        }

        return {
          undoStack: newUndoStack,
          redoStack: [], // Clear redo stack when new state is saved
        };
      });
    } catch (error) {
      console.error('Failed to save canvas state:', error);
    }
  },

  undo: async (canvas: Canvas) => {
    const { undoStack } = get();

    if (undoStack.length === 0) return;

    // Save current state to redo stack
    const currentState = JSON.stringify(canvas.toJSON());

    // Get previous state
    const previousState = undoStack[undoStack.length - 1];

    // Set restoring flag to prevent recursive saves
    set({ isRestoring: true });

    try {
      // Use Promise-based API (Fabric.js 6.x)
      await canvas.loadFromJSON(JSON.parse(previousState));
      canvas.requestRenderAll();

      set((state) => ({
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, currentState],
        isRestoring: false,
      }));
    } catch (error) {
      console.error('Failed to undo:', error);
      set({ isRestoring: false });
    }
  },

  redo: async (canvas: Canvas) => {
    const redoStack = get().redoStack;

    if (redoStack.length === 0) return;

    // Save current state to undo stack
    const currentState = JSON.stringify(canvas.toJSON());

    // Get next state
    const nextState = redoStack[redoStack.length - 1];

    // Set restoring flag to prevent recursive saves
    set({ isRestoring: true });

    try {
      // Use Promise-based API (Fabric.js 6.x)
      await canvas.loadFromJSON(JSON.parse(nextState));
      canvas.requestRenderAll();

      set((state) => ({
        undoStack: [...state.undoStack, currentState],
        redoStack: state.redoStack.slice(0, -1),
        isRestoring: false,
      }));
    } catch (error) {
      console.error('Failed to redo:', error);
      set({ isRestoring: false });
    }
  },

  clear: () => {
    set({ undoStack: [], redoStack: [] });
  },

  canUndo: () => {
    return get().undoStack.length > 0;
  },

  canRedo: () => {
    return get().redoStack.length > 0;
  },

  setRestoring: (restoring: boolean) => {
    set({ isRestoring: restoring });
  },
}));
