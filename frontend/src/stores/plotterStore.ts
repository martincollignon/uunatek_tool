/**
 * Plotter Store - Zustand store for plotter state management.
 *
 * This version uses the TypeScript serial layer instead of the Python backend API.
 * It can be used in both web (Web Serial API) and desktop (Tauri) environments.
 */

import { create } from 'zustand';
import {
  getPlotterService,
  PlotterService,
  PlotterStatus,
  PlotterServiceState,
  PlotCommand,
  PlotProgress,
} from '../lib/plotter';
import { SerialPortInfo, isSerialAvailable, getSerialSupportMessage } from '../lib/serial';

interface PlotterState {
  // Connection state
  status: PlotterStatus | null;
  serviceState: PlotterServiceState;
  availablePorts: SerialPortInfo[];
  isConnecting: boolean;

  // Plot state
  plotProgress: PlotProgress | null;
  isPlotting: boolean;

  // Error state
  error: string | null;

  // Environment info
  isSerialSupported: boolean;
  serialSupportMessage: string;

  // Service reference
  service: PlotterService;

  // Actions
  initialize: () => void;
  listPorts: () => Promise<void>;
  connect: (port?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  home: () => Promise<void>;
  penUp: () => Promise<void>;
  penDown: () => Promise<void>;
  enableMotors: () => Promise<void>;
  disableMotors: () => Promise<void>;
  moveTo: (x: number, y: number, feedRate?: number) => Promise<void>;
  emergencyStop: () => Promise<void>;
  startPlot: (commands: PlotCommand[], side?: string) => Promise<boolean>;
  pausePlot: () => void;
  resumePlot: () => void;
  cancelPlot: () => void;
  clearError: () => void;
  setCanvasSize: (widthMm: number, heightMm: number) => void;
}

export const usePlotterStore = create<PlotterState>((set) => {
  // Get singleton service instance
  const service = getPlotterService();

  return {
    // Initial state
    status: null,
    serviceState: 'disconnected',
    availablePorts: [],
    isConnecting: false,
    plotProgress: null,
    isPlotting: false,
    error: null,
    isSerialSupported: isSerialAvailable(),
    serialSupportMessage: getSerialSupportMessage(),
    service,

    // Initialize event handlers
    initialize: () => {
      service.setEventHandlers({
        onStateChange: (state) => {
          set({
            serviceState: state,
            isPlotting: state === 'plotting' || state === 'paused',
            isConnecting: state === 'connecting',
          });
        },
        onStatusUpdate: (status) => {
          set({ status });
        },
        onProgress: (progress) => {
          set({ plotProgress: progress });
        },
        onError: (err) => {
          console.error('[PlotterStore] Error:', err.message);
          set({ error: err.message });
        },
        onDisconnect: () => {
          set({
            status: null,
            serviceState: 'disconnected',
            isConnecting: false,
            isPlotting: false,
          });
        },
      });
    },

    listPorts: async () => {
      try {
        const ports = await service.listPorts();
        set({ availablePorts: ports, error: null });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        set({ error: `Failed to list ports: ${errorMessage}` });
      }
    },

    connect: async (port?: string) => {
      set({ isConnecting: true, error: null });
      try {
        await service.connect(port);
        set({
          status: service.status,
          serviceState: service.state,
          isConnecting: false,
        });
      } catch (err) {
        // Extract detailed error information
        let errorMsg = 'Failed to connect';
        if (err && typeof err === 'object') {
          if ('detail' in err && err.detail) {
            errorMsg = String(err.detail);
          } else if ('message' in err && err.message) {
            errorMsg = String(err.message);
          }
        } else if (err instanceof Error) {
          errorMsg = err.message;
        }
        set({
          error: errorMsg,
          isConnecting: false,
        });
      }
    },

    disconnect: async () => {
      try {
        await service.disconnect();
        set({
          status: null,
          serviceState: 'disconnected',
          plotProgress: null,
        });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to disconnect' });
      }
    },

    home: async () => {
      try {
        await service.home();
        set({ error: null });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to home' });
      }
    },

    penUp: async () => {
      try {
        await service.penUp();
        set({ error: null });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to raise pen' });
      }
    },

    penDown: async () => {
      try {
        await service.penDown();
        set({ error: null });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to lower pen' });
      }
    },

    enableMotors: async () => {
      try {
        await service.enableMotors();
        set({ error: null });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to enable motors' });
      }
    },

    disableMotors: async () => {
      try {
        await service.disableMotors();
        set({ error: null });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to disable motors' });
      }
    },

    moveTo: async (x: number, y: number, feedRate?: number) => {
      try {
        await service.moveTo(x, y, feedRate);
        set({ error: null });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to move' });
      }
    },

    emergencyStop: async () => {
      try {
        await service.emergencyStop();
        set({
          plotProgress: null,
          isPlotting: false,
          error: null,
        });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to stop' });
      }
    },

    startPlot: async (commands: PlotCommand[], side: string = 'front') => {
      set({ error: null, isPlotting: true });
      try {
        const result = await service.startPlot(commands, side);
        set({ isPlotting: false });
        return result;
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Plot failed',
          isPlotting: false,
        });
        return false;
      }
    },

    pausePlot: () => {
      service.pausePlot();
    },

    resumePlot: () => {
      service.resumePlot();
    },

    cancelPlot: () => {
      service.cancelPlot();
      set({ plotProgress: null, isPlotting: false });
    },

    clearError: () => {
      set({ error: null });
    },

    setCanvasSize: (widthMm: number, heightMm: number) => {
      service.setCanvasSize(widthMm, heightMm);
    },
  };
});

// Initialize the store on first import
// This sets up the event handlers
// DISABLED: This was causing the app to freeze on launch
// The initialize() will be called manually when needed
// if (typeof window !== 'undefined') {
//   // Only run in browser environment
//   setTimeout(() => {
//     usePlotterStore.getState().initialize();
//   }, 0);
// }
