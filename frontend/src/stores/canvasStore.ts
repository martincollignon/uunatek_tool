import { create } from 'zustand';
import type { CanvasSide } from '../types';
import { canvasApi } from '../services/api';

// Save queue to prevent overlapping saves
interface SaveQueueItem {
  projectId: string;
  canvasJson: Record<string, unknown>;
  side: CanvasSide;
  retries: number;
}

// Save state tracking
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface CanvasState {
  currentSide: CanvasSide;
  canvasData: Record<CanvasSide, Record<string, unknown> | null>;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  isRotated: boolean;
  saveState: SaveState;
  saveError: string | null;

  // Actions
  setSide: (side: CanvasSide) => void;
  loadCanvas: (projectId: string, side: CanvasSide) => Promise<Record<string, unknown> | null>;
  saveCanvas: (projectId: string, canvasJson: Record<string, unknown>, side: CanvasSide) => Promise<void>;
  setCanvasData: (side: CanvasSide, data: Record<string, unknown>) => void;
  setDirty: (dirty: boolean) => void;
  clearError: () => void;
  setRotated: (rotated: boolean) => void;
  getSaveState: () => SaveState;
}

// Save queue management (outside Zustand to avoid race conditions)
let saveQueue: SaveQueueItem[] = [];
let isProcessingSave = false;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Process save queue with single-flight guarantee
async function processSaveQueue(getState: () => CanvasState, setState: (partial: Partial<CanvasState>) => void) {
  if (isProcessingSave || saveQueue.length === 0) {
    return;
  }

  isProcessingSave = true;
  setState({ saveState: 'saving', saveError: null });

  // Get the most recent save request for each project/side combo
  // This deduplicates rapid consecutive saves
  const uniqueSaves = new Map<string, SaveQueueItem>();
  for (const item of saveQueue) {
    const key = `${item.projectId}-${item.side}`;
    uniqueSaves.set(key, item);
  }

  // Clear the queue since we're processing everything
  saveQueue = [];

  // Process each unique save
  for (const [_, item] of Array.from(uniqueSaves.entries())) {
    try {
      await canvasApi.save(item.projectId, item.canvasJson, item.side);

      // Update state on successful save
      setState({
        canvasData: {
          ...getState().canvasData,
          [item.side]: item.canvasJson,
        },
        isDirty: false,
        saveState: 'saved',
        saveError: null,
      });

      console.log(`Successfully saved canvas for project ${item.projectId}, side ${item.side}`);

      // Reset to idle after a brief delay
      setTimeout(() => {
        if (getState().saveState === 'saved') {
          setState({ saveState: 'idle' });
        }
      }, 2000);

    } catch (err: any) {
      console.error('Canvas save error:', err);

      // Retry logic
      if (item.retries < MAX_RETRIES) {
        console.log(`Retrying save (${item.retries + 1}/${MAX_RETRIES})...`);
        saveQueue.push({ ...item, retries: item.retries + 1 });

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        // Max retries exceeded
        const errorMessage = err?.response?.status === 404
          ? 'Project not found'
          : 'Failed to save canvas';

        setState({
          error: errorMessage,
          saveState: 'error',
          saveError: errorMessage,
        });

        console.error(`Failed to save after ${MAX_RETRIES} retries:`, errorMessage);
      }
    }
  }

  isProcessingSave = false;

  // Process any new items that were added while we were saving
  if (saveQueue.length > 0) {
    processSaveQueue(getState, setState);
  }
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  currentSide: 'front',
  canvasData: { front: null, back: null, envelope: null },
  isDirty: false,
  isLoading: false,
  error: null,
  isRotated: false,
  saveState: 'idle',
  saveError: null,

  setSide: (side) => set({ currentSide: side }),

  loadCanvas: async (projectId, side) => {
    set({ isLoading: true, error: null });
    try {
      const response = await canvasApi.get(projectId, side);
      const data = response.canvas_json;
      set((state) => ({
        canvasData: { ...state.canvasData, [side]: data },
        isLoading: false,
      }));
      return data;
    } catch (err: any) {
      const errorMessage = err?.response?.status === 404
        ? 'Canvas not found'
        : 'Failed to load canvas';
      set({ error: errorMessage, isLoading: false });
      console.error('Canvas load error:', err);
      return null;
    }
  },

  saveCanvas: async (projectId, canvasJson, side) => {
    // Add to queue instead of saving directly
    saveQueue.push({
      projectId,
      canvasJson,
      side,
      retries: 0,
    });

    // Start processing if not already processing
    if (!isProcessingSave) {
      processSaveQueue(get, set);
    }
  },

  setCanvasData: (side, data) =>
    set((state) => ({
      canvasData: { ...state.canvasData, [side]: data },
      isDirty: true,
    })),

  setDirty: (dirty) => set({ isDirty: dirty }),
  clearError: () => set({ error: null, saveError: null }),
  setRotated: (rotated) => set({ isRotated: rotated }),
  getSaveState: () => get().saveState,
}));
