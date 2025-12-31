import { create } from 'zustand';
import type { PlotterStatus, PlotProgress, SerialPort } from '../types';
import type { PlotterError, RecoveryAction } from '../types/errors';
import { plotterApi } from '../services/api';

interface PlotterState {
  status: PlotterStatus | null;
  plotProgress: PlotProgress | null;
  availablePorts: SerialPort[];
  isConnecting: boolean;
  error: string | null;
  // Structured error state
  currentError: PlotterError | null;
  showProblemDialog: boolean;

  // Actions
  fetchStatus: () => Promise<void>;
  listPorts: () => Promise<void>;
  connect: (port?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  home: () => Promise<void>;
  penUp: () => Promise<void>;
  penDown: () => Promise<void>;
  enableMotors: () => Promise<void>;
  disableMotors: () => Promise<void>;
  startPlot: (projectId: string, side: string) => Promise<void>;
  pausePlot: () => Promise<void>;
  resumePlot: () => Promise<void>;
  cancelPlot: () => Promise<void>;
  fetchPlotStatus: () => Promise<void>;
  updateProgress: (progress: PlotProgress) => void;
  clearError: () => void;
  // Error handling actions
  setCurrentError: (error: PlotterError | null) => void;
  handleRecoveryAction: (action: RecoveryAction) => Promise<void>;
  reportProblem: (errorCode: string) => Promise<void>;
  setShowProblemDialog: (show: boolean) => void;
}

const initialStatus: PlotterStatus = {
  connected: false,
  pen_state: 'unknown',
  motors_enabled: false,
};

// Helper to extract PlotterError from API response
const extractError = (err: unknown): PlotterError | null => {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { error?: PlotterError } } }).response;
    if (response?.data?.error) {
      return response.data.error;
    }
  }
  return null;
};

export const usePlotterStore = create<PlotterState>((set) => ({
  status: null,
  plotProgress: null,
  availablePorts: [],
  isConnecting: false,
  error: null,
  currentError: null,
  showProblemDialog: false,

  fetchStatus: async () => {
    try {
      const status = await plotterApi.getStatus();
      set({ status });
    } catch (err) {
      // Plotter might not be connected
    }
  },

  listPorts: async () => {
    try {
      const ports = await plotterApi.listPorts();
      set({ availablePorts: ports });
    } catch (err) {
      set({ error: 'Failed to list ports' });
    }
  },

  connect: async (port?: string) => {
    set({ isConnecting: true, error: null, currentError: null });
    try {
      await plotterApi.connect(port);
      const status = await plotterApi.getStatus();
      set({ status, isConnecting: false });
    } catch (err: unknown) {
      const plotterError = extractError(err);
      if (plotterError) {
        set({ currentError: plotterError, isConnecting: false, error: plotterError.message });
      } else {
        const message = err instanceof Error ? err.message : 'Failed to connect';
        set({ error: message, isConnecting: false });
      }
    }
  },

  disconnect: async () => {
    try {
      await plotterApi.disconnect();
      set({ status: initialStatus });
    } catch (err) {
      set({ error: 'Failed to disconnect' });
    }
  },

  home: async () => {
    try {
      await plotterApi.home();
    } catch (err) {
      set({ error: 'Failed to home' });
    }
  },

  penUp: async () => {
    try {
      await plotterApi.penUp();
      set((state) => ({
        status: state.status ? { ...state.status, pen_state: 'up' as const } : null,
      }));
    } catch (err) {
      set({ error: 'Failed to raise pen' });
    }
  },

  penDown: async () => {
    try {
      await plotterApi.penDown();
      set((state) => ({
        status: state.status ? { ...state.status, pen_state: 'down' as const } : null,
      }));
    } catch (err) {
      set({ error: 'Failed to lower pen' });
    }
  },

  enableMotors: async () => {
    try {
      await plotterApi.enableMotors();
      set((state) => ({
        status: state.status ? { ...state.status, motors_enabled: true } : null,
      }));
    } catch (err) {
      set({ error: 'Failed to enable motors' });
    }
  },

  disableMotors: async () => {
    try {
      await plotterApi.disableMotors();
      set((state) => ({
        status: state.status ? { ...state.status, motors_enabled: false } : null,
      }));
    } catch (err) {
      set({ error: 'Failed to disable motors' });
    }
  },

  startPlot: async (projectId: string, side: string) => {
    set({ error: null });
    try {
      await plotterApi.startPlot(projectId, side);
      set({
        plotProgress: {
          status: 'plotting',
          current_command: 0,
          total_commands: 0,
          elapsed_time: 0,
          estimated_remaining: 0,
          current_side: side,
        } as PlotProgress,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start plot';
      set({ error: message });
    }
  },

  pausePlot: async () => {
    try {
      await plotterApi.pausePlot();
    } catch (err) {
      set({ error: 'Failed to pause' });
    }
  },

  resumePlot: async () => {
    try {
      await plotterApi.resumePlot();
    } catch (err) {
      set({ error: 'Failed to resume' });
    }
  },

  cancelPlot: async () => {
    try {
      await plotterApi.cancelPlot();
      set({ plotProgress: null });
    } catch (err) {
      set({ error: 'Failed to cancel' });
    }
  },

  fetchPlotStatus: async () => {
    try {
      const progress = await plotterApi.getPlotStatus();
      set({ plotProgress: progress });
    } catch (err) {
      // Ignore errors during polling
    }
  },

  updateProgress: (progress) => set({ plotProgress: progress }),
  clearError: () => set({ error: null, currentError: null }),

  // Error handling actions
  setCurrentError: (error) => set({ currentError: error }),

  handleRecoveryAction: async (action: RecoveryAction) => {
    try {
      await plotterApi.executeRecoveryAction(action);

      // Clear error state after successful recovery action
      if (action === 'retry' || action === 'user_fix') {
        set({ currentError: null, error: null });
      }

      // Refresh status after certain actions
      if (action === 'reconnect' || action === 'home' || action === 'abort') {
        const status = await plotterApi.getStatus();
        set({ status, currentError: null, error: null });
      }

      // Resume clears error state
      if (action === 'resume') {
        set({ currentError: null, error: null });
      }
    } catch (err) {
      const plotterError = extractError(err);
      if (plotterError) {
        set({ currentError: plotterError, error: plotterError.message });
      } else {
        const message = err instanceof Error ? err.message : `Failed to ${action}`;
        set({ error: message });
      }
    }
  },

  reportProblem: async (errorCode: string) => {
    try {
      const result = await plotterApi.reportProblem(errorCode);
      set({
        currentError: result.error,
        showProblemDialog: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to report problem';
      set({ error: message, showProblemDialog: false });
    }
  },

  setShowProblemDialog: (show) => set({ showProblemDialog: show }),
}));
