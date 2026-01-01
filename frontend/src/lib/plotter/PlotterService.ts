/**
 * Plotter Service - High-level plotter control.
 *
 * Provides a unified interface for plotter operations that works in both
 * web (Web Serial API) and desktop (Tauri) environments.
 *
 * This replaces the previous Python backend API with direct browser/native communication.
 */

import {
  createSerialConnection,
  isSerialAvailable,
  ISerialConnection,
  SerialPortInfo,
  SerialError,
  isSerialError,
} from '../serial';
import { GRBLCommands, PlotExecutor, PlotCommand, PlotProgress, GRBLStatus } from '../grbl';

/** Plotter connection status */
export interface PlotterStatus {
  connected: boolean;
  penState: 'up' | 'down' | 'unknown';
  motorsEnabled: boolean;
  portName?: string;
  position?: { x: number; y: number };
}

/** Plotter service state */
export type PlotterServiceState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'plotting'
  | 'paused'
  | 'error';

/** Event callbacks */
export interface PlotterServiceEvents {
  onStateChange?: (state: PlotterServiceState) => void;
  onStatusUpdate?: (status: PlotterStatus) => void;
  onProgress?: (progress: PlotProgress) => void;
  onError?: (error: SerialError | Error) => void;
  onDisconnect?: () => void;
}

/**
 * High-level plotter service.
 *
 * Manages serial connection, GRBL commands, and plot execution.
 */
export class PlotterService {
  private _connection: ISerialConnection | null = null;
  private _grbl: GRBLCommands | null = null;
  private _executor: PlotExecutor | null = null;
  private _state: PlotterServiceState = 'disconnected';
  private _status: PlotterStatus = {
    connected: false,
    penState: 'unknown',
    motorsEnabled: false,
  };
  private _events: PlotterServiceEvents = {};

  // Canvas settings
  private _canvasWidthMm: number = 210;
  private _canvasHeightMm: number = 297;

  // Auto-reconnect settings
  private _lastPort: string | null = null;
  private _reconnectAttempts: number = 0;
  private _maxReconnectAttempts: number = 3;
  private _isReconnecting: boolean = false;

  get state(): PlotterServiceState {
    return this._state;
  }

  get status(): PlotterStatus {
    return { ...this._status };
  }

  get isConnected(): boolean {
    return this._state === 'connected' || this._state === 'plotting' || this._state === 'paused';
  }

  get isSerialSupported(): boolean {
    return isSerialAvailable();
  }

  // === Configuration ===

  setEventHandlers(events: PlotterServiceEvents): void {
    this._events = { ...this._events, ...events };
  }

  setCanvasSize(widthMm: number, heightMm: number): void {
    this._canvasWidthMm = widthMm;
    this._canvasHeightMm = heightMm;
    if (this._executor) {
      this._executor.setCanvasSize(widthMm, heightMm);
    }
  }

  // === Connection ===

  /**
   * List available serial ports.
   */
  async listPorts(): Promise<SerialPortInfo[]> {
    if (!this._connection) {
      this._connection = createSerialConnection();
    }
    return await this._connection.listPorts();
  }

  /**
   * Connect to the plotter.
   *
   * @param port - Optional port path. Auto-detects if not provided.
   */
  async connect(port?: string): Promise<void> {
    this._setState('connecting');

    try {
      if (!this._connection) {
        this._connection = createSerialConnection();
      }

      // Set up disconnect handler
      this._connection.setEventHandlers({
        onDisconnect: () => this._handleDisconnect(),
        onError: (err) => this._handleError(err),
      });

      await this._connection.connect(port);

      // Initialize GRBL commands
      this._grbl = new GRBLCommands(this._connection);
      await this._grbl.initialize();

      // Create executor
      this._executor = new PlotExecutor(this._grbl, this._canvasWidthMm, this._canvasHeightMm);

      // Update status
      this._status = {
        connected: true,
        penState: this._grbl.penState,
        motorsEnabled: true,
        portName: this._connection.portPath ?? undefined,
        position: this._grbl.currentPosition,
      };

      // Store port for potential reconnection
      this._lastPort = this._connection.portPath || port || null;
      this._reconnectAttempts = 0;
      this._isReconnecting = false;

      this._setState('connected');
      this._events.onStatusUpdate?.(this._status);
    } catch (err) {
      this._setState('error');
      this._handleError(err);
      throw err;
    }
  }

  /**
   * Disconnect from the plotter.
   */
  async disconnect(): Promise<void> {
    if (this._connection) {
      await this._connection.disconnect();
    }

    this._grbl = null;
    this._executor = null;
    this._status = {
      connected: false,
      penState: 'unknown',
      motorsEnabled: false,
    };

    this._setState('disconnected');
    this._events.onStatusUpdate?.(this._status);
  }

  // === Plotter Control ===

  /**
   * Query current plotter status.
   */
  async getStatus(): Promise<GRBLStatus> {
    this._ensureConnected();
    return await this._grbl!.queryStatus();
  }

  /**
   * Home the plotter.
   */
  async home(): Promise<void> {
    this._ensureConnected();
    await this._grbl!.home();
    this._status.position = this._grbl!.currentPosition;
    this._events.onStatusUpdate?.(this._status);
  }

  /**
   * Raise the pen.
   */
  async penUp(): Promise<void> {
    this._ensureConnected();
    await this._grbl!.penUp();
    this._status.penState = 'up';
    this._events.onStatusUpdate?.(this._status);
  }

  /**
   * Lower the pen.
   */
  async penDown(): Promise<void> {
    this._ensureConnected();
    await this._grbl!.penDown();
    this._status.penState = 'down';
    this._events.onStatusUpdate?.(this._status);
  }

  /**
   * Enable motors.
   */
  async enableMotors(): Promise<void> {
    this._ensureConnected();
    await this._grbl!.enableMotors();
    this._status.motorsEnabled = true;
    this._events.onStatusUpdate?.(this._status);
  }

  /**
   * Disable motors (allows manual movement).
   */
  async disableMotors(): Promise<void> {
    this._ensureConnected();
    await this._grbl!.disableMotors();
    this._status.motorsEnabled = false;
    this._events.onStatusUpdate?.(this._status);
  }

  /**
   * Move to absolute position.
   */
  async moveTo(xMm: number, yMm: number, feedRate?: number): Promise<void> {
    this._ensureConnected();
    await this._grbl!.moveAbsolute(xMm, yMm, feedRate ?? null);
    await this._grbl!.waitForCompletion();
    this._status.position = this._grbl!.currentPosition;
    this._events.onStatusUpdate?.(this._status);
  }

  /**
   * Emergency stop.
   */
  async emergencyStop(): Promise<void> {
    if (this._grbl) {
      await this._grbl.emergencyStop();
    }
    if (this._executor) {
      this._executor.cancel();
    }
    this._setState('connected');
  }

  // === Plotting ===

  /**
   * Start plotting.
   *
   * @param commands - Plot commands to execute
   * @param side - Which side is being plotted (for progress reporting)
   */
  async startPlot(commands: PlotCommand[], side: string = 'front'): Promise<boolean> {
    this._ensureConnected();

    if (!this._executor) {
      throw new Error('Executor not initialized');
    }

    this._setState('plotting');

    try {
      const result = await this._executor.execute(commands, {
        side,
        onProgress: (progress) => {
          this._events.onProgress?.(progress);

          if (progress.state === 'paused') {
            this._setState('paused');
          } else if (progress.state === 'plotting') {
            this._setState('plotting');
          }
        },
      });

      this._setState('connected');
      return result;
    } catch (err) {
      this._setState('error');
      this._handleError(err);
      throw err;
    }
  }

  /**
   * Pause current plot.
   */
  pausePlot(): void {
    if (this._executor) {
      this._executor.pause();
      this._setState('paused');
    }
  }

  /**
   * Resume paused plot.
   */
  resumePlot(): void {
    if (this._executor) {
      this._executor.resume();
      this._setState('plotting');
    }
  }

  /**
   * Cancel current plot.
   */
  cancelPlot(): void {
    if (this._executor) {
      this._executor.cancel();
      this._setState('connected');
    }
  }

  // === Private Methods ===

  private _ensureConnected(): void {
    if (!this.isConnected || !this._grbl) {
      throw new Error('Not connected to plotter');
    }
  }

  private _setState(state: PlotterServiceState): void {
    if (this._state !== state) {
      this._state = state;
      this._events.onStateChange?.(state);
    }
  }

  private async _handleDisconnect(): Promise<void> {
    // Prevent multiple simultaneous reconnection attempts
    if (this._isReconnecting) {
      console.log('[PlotterService] Already reconnecting, ignoring disconnect');
      return;
    }

    // Try to reconnect if we have a last known port
    if (this._lastPort && this._reconnectAttempts < this._maxReconnectAttempts) {
      this._isReconnecting = true;
      this._reconnectAttempts++;

      console.log(`[PlotterService] Attempting reconnect ${this._reconnectAttempts}/${this._maxReconnectAttempts} to ${this._lastPort}`);

      // Wait before reconnecting (exponential backoff)
      const delay = 1000 * this._reconnectAttempts;
      await new Promise(r => setTimeout(r, delay));

      try {
        // Clean up old connection
        this._grbl = null;
        this._executor = null;
        this._connection = null;

        // Try to reconnect
        await this.connect(this._lastPort);
        console.log('[PlotterService] Reconnected successfully');
        this._isReconnecting = false;
        return;
      } catch (err) {
        console.warn(`[PlotterService] Reconnect attempt ${this._reconnectAttempts} failed:`, err);
        this._isReconnecting = false;

        // Try again if we haven't exhausted attempts
        if (this._reconnectAttempts < this._maxReconnectAttempts) {
          // Trigger another reconnect attempt
          this._handleDisconnect();
          return;
        }
      }
    }

    // No reconnection possible or all attempts exhausted
    console.log('[PlotterService] Disconnected permanently');
    this._grbl = null;
    this._executor = null;
    this._isReconnecting = false;
    this._status = {
      connected: false,
      penState: 'unknown',
      motorsEnabled: false,
    };
    this._setState('disconnected');
    this._events.onDisconnect?.();
    this._events.onStatusUpdate?.(this._status);
  }

  private _handleError(err: unknown): void {
    if (isSerialError(err)) {
      this._events.onError?.(err);
    } else if (err instanceof Error) {
      this._events.onError?.(err);
    } else {
      this._events.onError?.(new Error(String(err)));
    }
  }
}

// Singleton instance
let _defaultService: PlotterService | null = null;

/**
 * Get the default PlotterService instance.
 */
export function getPlotterService(): PlotterService {
  if (!_defaultService) {
    _defaultService = new PlotterService();
  }
  return _defaultService;
}
