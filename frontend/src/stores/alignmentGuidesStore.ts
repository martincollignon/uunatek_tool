import { create } from 'zustand';

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

  // Actions
  toggleStaticGuides: () => void;
  toggleSmartGuides: () => void;
  toggleCenter: () => void;
  toggleThirds: () => void;
  toggleHalves: () => void;
  toggleSnapToGuides: () => void;
  setSnapThreshold: (threshold: number) => void;
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

  toggleStaticGuides: () => set((state) => ({ showStaticGuides: !state.showStaticGuides })),
  toggleSmartGuides: () => set((state) => ({ showSmartGuides: !state.showSmartGuides })),
  toggleCenter: () => set((state) => ({ showCenter: !state.showCenter })),
  toggleThirds: () => set((state) => ({ showThirds: !state.showThirds })),
  toggleHalves: () => set((state) => ({ showHalves: !state.showHalves })),
  toggleSnapToGuides: () => set((state) => ({ snapToGuides: !state.snapToGuides })),
  setSnapThreshold: (threshold: number) => set({ snapThreshold: threshold }),
}));
