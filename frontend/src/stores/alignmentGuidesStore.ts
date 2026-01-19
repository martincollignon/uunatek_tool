import { create } from 'zustand';
import type { GridConfig } from '../components/canvas/GridOverlay';

interface AlignmentGuidesState {
  // Visibility settings
  showStaticGuides: boolean;
  showSmartGuides: boolean;
  showCenter: boolean;
  showThirds: boolean;
  showHalves: boolean;

  // Snap settings
  snapToGuides: boolean;
  snapThreshold: number;

  // Snap state (moved from global variables in alignmentGuides.ts)
  isSnappedHorizontal: boolean;
  isSnappedVertical: boolean;
  currentVerticalSnapPos: number | undefined;
  currentHorizontalSnapPos: number | undefined;

  // Grid settings
  gridConfig: GridConfig;

  // Actions
  toggleStaticGuides: () => void;
  toggleSmartGuides: () => void;
  toggleCenter: () => void;
  toggleThirds: () => void;
  toggleHalves: () => void;
  toggleSnapToGuides: () => void;
  setSnapThreshold: (threshold: number) => void;
  setGridConfig: (config: GridConfig) => void;
  setSnapState: (state: {
    isSnappedHorizontal: boolean;
    isSnappedVertical: boolean;
    currentVerticalSnapPos: number | undefined;
    currentHorizontalSnapPos: number | undefined;
  }) => void;
  resetSnapState: () => void;
}

export const useAlignmentGuidesStore = create<AlignmentGuidesState>((set) => ({
  // Default settings - smart guides on, static guides off by default
  showStaticGuides: false,
  showSmartGuides: true,
  showCenter: true,
  showThirds: true,
  showHalves: false,
  snapToGuides: true,
  snapThreshold: 5,

  // Default snap state
  isSnappedHorizontal: false,
  isSnappedVertical: false,
  currentVerticalSnapPos: undefined,
  currentHorizontalSnapPos: undefined,

  // Default grid settings
  gridConfig: {
    enabled: false,
    spacing: 5,
    snapEnabled: false,
    color: '#e0e0e0',
    opacity: 0.5,
  },

  toggleStaticGuides: () => set((state) => ({ showStaticGuides: !state.showStaticGuides })),
  toggleSmartGuides: () => set((state) => ({ showSmartGuides: !state.showSmartGuides })),
  toggleCenter: () => set((state) => ({ showCenter: !state.showCenter })),
  toggleThirds: () => set((state) => ({ showThirds: !state.showThirds })),
  toggleHalves: () => set((state) => ({ showHalves: !state.showHalves })),
  toggleSnapToGuides: () => set((state) => ({ snapToGuides: !state.snapToGuides })),
  setSnapThreshold: (threshold: number) => set({ snapThreshold: threshold }),
  setGridConfig: (config: GridConfig) => set({ gridConfig: config }),
  setSnapState: (state) => set(state),
  resetSnapState: () => set({
    isSnappedHorizontal: false,
    isSnappedVertical: false,
    currentVerticalSnapPos: undefined,
    currentHorizontalSnapPos: undefined,
  }),
}));
