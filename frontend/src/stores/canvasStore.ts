import { create } from 'zustand';
import type { CanvasSide } from '../types';
import { canvasApi } from '../services/api';

interface CanvasState {
  currentSide: CanvasSide;
  canvasData: Record<CanvasSide, Record<string, unknown> | null>;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  isRotated: boolean;

  // Actions
  setSide: (side: CanvasSide) => void;
  loadCanvas: (projectId: string, side: CanvasSide) => Promise<Record<string, unknown> | null>;
  saveCanvas: (projectId: string, canvasJson: Record<string, unknown>, side: CanvasSide) => Promise<void>;
  setCanvasData: (side: CanvasSide, data: Record<string, unknown>) => void;
  setDirty: (dirty: boolean) => void;
  clearError: () => void;
  setRotated: (rotated: boolean) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  currentSide: 'front',
  canvasData: { front: null, back: null, envelope: null },
  isDirty: false,
  isLoading: false,
  error: null,
  isRotated: false,

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
    set({ isLoading: true, error: null });
    try {
      await canvasApi.save(projectId, canvasJson, side);
      set((state) => ({
        canvasData: { ...state.canvasData, [side]: canvasJson },
        isDirty: false,
        isLoading: false,
      }));
    } catch (err: any) {
      const errorMessage = err?.response?.status === 404
        ? 'Project not found'
        : 'Failed to save canvas';
      set({ error: errorMessage, isLoading: false });
      console.error('Canvas save error:', err);
      throw err;
    }
  },

  setCanvasData: (side, data) =>
    set((state) => ({
      canvasData: { ...state.canvasData, [side]: data },
      isDirty: true,
    })),

  setDirty: (dirty) => set({ isDirty: dirty }),
  clearError: () => set({ error: null }),
  setRotated: (rotated) => set({ isRotated: rotated }),
}));
