/**
 * Plot execution engine for GRBL-based plotters.
 *
 * Converts plot commands to GRBL G-code and sends them to the plotter.
 * Port of Python backend/core/plotter/executor.py to TypeScript.
 */

import { GRBLCommands } from './GRBLCommands';
import {
  PlotCommand,
  PlotProgress,
  PAPER_CONFIGS,
  PaperConfig,
} from './types';

/** Progress callback function type */
export type ProgressCallback = (progress: PlotProgress) => void;

/** Execution options */
export interface ExecuteOptions {
  side?: string;
  checkVoltage?: boolean;
  pollPauseButton?: boolean;
  onProgress?: ProgressCallback;
}

/**
 * Execute plot commands on the GRBL-based plotter.
 *
 * Converts PlotCommand objects to GRBL G-code commands and handles
 * motion planning, speed control, and progress reporting.
 */
export class PlotExecutor {
  private _cmd: GRBLCommands;

  // Paper/canvas configuration
  private _canvasWidthMm: number;
  private _canvasHeightMm: number;

  // Speed settings (mm/s)
  private _penDownSpeed: number = 33.3;   // ~2000 mm/min for drawing

  // Current state
  private _currentX: number = 0;  // mm (machine coordinates)
  private _currentY: number = 0;  // mm (machine coordinates)
  private _penDown: boolean = false;

  // Origin tracking (set at plot start based on paper position)
  private _originX: number = 0;  // Machine X at paper top-right corner
  private _originY: number = 0;  // Machine Y at paper top-right corner

  // Control flags
  private _cancelRequested: boolean = false;
  private _pauseRequested: boolean = false;
  private _currentCommandIndex: number = 0;

  // Streaming mode flag - uses character-counting protocol for much faster execution
  private _useStreaming: boolean = true;

  constructor(
    commands: GRBLCommands,
    canvasWidthMm: number = 210,   // A4 width
    canvasHeightMm: number = 297,  // A4 height
  ) {
    this._cmd = commands;
    this._canvasWidthMm = canvasWidthMm;
    this._canvasHeightMm = canvasHeightMm;
  }

  // === Configuration ===

  setCanvasSize(widthMm: number, heightMm: number): void {
    this._canvasWidthMm = widthMm;
    this._canvasHeightMm = heightMm;
  }

  setSpeeds(penDownMmS: number, _penUpMmS: number): void {
    this._penDownSpeed = penDownMmS;
    // penUpMmS is unused - GRBL uses G00 rapid moves for pen up (maximum speed)
  }

  /**
   * Reset internal position tracking to origin.
   */
  resetPosition(): void {
    this._currentX = 0;
    this._currentY = 0;
    this._penDown = false;
  }

  // === Control ===

  /**
   * Request pause of current plot.
   */
  pause(): void {
    this._pauseRequested = true;
    console.log('Pause requested');
  }

  /**
   * Resume paused plot.
   */
  resume(): void {
    this._pauseRequested = false;
    console.log('Resume requested');
  }

  /**
   * Cancel current plot.
   */
  cancel(): void {
    this._cancelRequested = true;
    this._pauseRequested = false;
    console.log('Cancel requested');
  }

  get isPaused(): boolean {
    return this._pauseRequested;
  }

  get isCancelled(): boolean {
    return this._cancelRequested;
  }

  // === Execution ===

  /**
   * Execute a list of plot commands.
   *
   * @param plotCommands - List of PlotCommand objects
   * @param options - Execution options
   * @returns True if completed successfully, false if cancelled
   */
  async execute(plotCommands: PlotCommand[], options: ExecuteOptions = {}): Promise<boolean> {
    const {
      side = 'front',
      checkVoltage = true,
      pollPauseButton = true,
      onProgress,
    } = options;

    this._cancelRequested = false;
    this._pauseRequested = false;
    const total = plotCommands.length;
    this._currentCommandIndex = 0;

    try {
      // Check voltage before starting
      if (checkVoltage) {
        await this._cmd.checkVoltage();
      }

      // Initialize and home the plotter
      await this._cmd.enableMotors();
      await this._cmd.penUp();
      this._penDown = false;

      // Auto-home to establish absolute coordinates
      console.log('Homing plotter to establish absolute coordinates...');
      try {
        await this._cmd.home(60000);
        await this._delay(5000);  // Wait for homing to complete
      } catch (err) {
        console.warn('Homing timeout (may be normal):', err);
        await this._delay(5000);
      }

      // Query position after homing
      const status = await this._cmd.queryStatus();
      console.log(`After homing: machine position (${status.machineX.toFixed(1)}, ${status.machineY.toFixed(1)})`);

      // Move to paper top-right corner (back-right)
      // Get paper configuration based on canvas size
      const paperConfig = this._getPaperConfig();
      this._originX = paperConfig.topRightX;
      this._originY = paperConfig.topRightY;

      console.log(`Moving to paper top-right corner: (${this._originX.toFixed(1)}, ${this._originY.toFixed(1)})`);
      await this._cmd.moveAbsolute(this._originX, this._originY, null);
      await this._delay(1000);

      // Confirm position
      const posStatus = await this._cmd.queryStatus();
      console.log(`Pen positioned at: (${posStatus.machineX.toFixed(1)}, ${posStatus.machineY.toFixed(1)})`);
      console.log(`This is SVG coordinate (${this._canvasWidthMm.toFixed(0)}, 0) - top-right corner of paper`);

      // Initialize current position tracking
      this._currentX = this._originX;
      this._currentY = this._originY;

      // Execute commands using streaming for fast execution
      // With streaming, commands are queued to GRBL's buffer rather than waiting for each response
      console.log(`Starting plot execution with ${total} commands (streaming: ${this._useStreaming})`);

      for (let i = 0; i < plotCommands.length; i++) {
        this._currentCommandIndex = i;
        const cmd = plotCommands[i];

        // Check for cancel
        if (this._cancelRequested) {
          console.log('Plot cancelled by user');
          // Wait for any pending streamed commands before pen up
          if (this._useStreaming) {
            await this._cmd.waitForStreamComplete(5000).catch(() => {});
          }
          await this._cmd.penUp();
          return false;
        }

        // Poll physical pause button less frequently when streaming
        // (every 100 commands instead of 10, since streaming is much faster)
        const pollInterval = this._useStreaming ? 100 : 10;
        if (pollPauseButton && i % pollInterval === 0) {
          // When streaming, wait for pending commands before checking status
          if (this._useStreaming) {
            await this._cmd.waitForStreamComplete(10000).catch(() => {});
          }
          try {
            await this._cmd.checkForPauseButton();
          } catch (err: unknown) {
            if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'PLT-U001') {
              // Pause button pressed - enter pause state
              this._pauseRequested = true;
              console.log('Physical pause button pressed');
            } else {
              throw err;
            }
          }
        }

        // Handle pause
        while (this._pauseRequested) {
          // Wait for pending commands before pausing
          if (this._useStreaming) {
            await this._cmd.waitForStreamComplete(10000).catch(() => {});
          }
          if (onProgress) {
            onProgress({
              state: 'paused',
              currentCommand: i,
              totalCommands: total,
              percentage: (i / total) * 100,
              currentSide: side,
            });
          }
          await this._delay(100);
          if (this._cancelRequested) {
            await this._cmd.penUp();
            return false;
          }
        }

        // Execute command (streams to GRBL buffer, doesn't block)
        await this._executeCommand(cmd);

        // Report progress
        if (onProgress) {
          onProgress({
            state: 'plotting',
            currentCommand: i + 1,
            totalCommands: total,
            percentage: ((i + 1) / total) * 100,
            currentSide: side,
          });
        }
      }

      // Finish up - wait for all streamed commands to complete
      if (this._useStreaming) {
        console.log('Waiting for streamed commands to complete...');
        await this._cmd.waitForStreamComplete();
      }
      await this._cmd.penUp();
      await this._cmd.waitForCompletion();

      if (onProgress) {
        onProgress({
          state: 'completed',
          currentCommand: total,
          totalCommands: total,
          percentage: 100,
          currentSide: side,
        });
      }

      return true;
    } catch (err) {
      console.error('Plot execution error:', err);

      try {
        await this._cmd.penUp();
      } catch {
        // Best effort pen up
      }

      if (onProgress) {
        onProgress({
          state: 'error',
          currentCommand: this._currentCommandIndex,
          totalCommands: total,
          percentage: (this._currentCommandIndex / total) * 100,
          errorMessage: err instanceof Error ? err.message : String(err),
          errorCode: err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : undefined,
          currentSide: side,
        });
      }

      throw err;
    }
  }

  // === Private Methods ===

  /**
   * Transform SVG coordinates to plotter machine coordinates.
   *
   * Coordinate system mapping:
   * - Machine: origin (0,0) at back-left after $H homing
   * - Machine: +X goes RIGHT, -Y goes toward FRONT
   * - SVG: (0,0) at top-left, +X goes RIGHT, +Y goes DOWN
   * - Paper positioned flush top-right (back-right) of bed
   */
  private _transformCoordinates(svgX: number, svgY: number): { x: number; y: number } {
    // X: offset from top-right corner (negative = left of start)
    const relativeX = svgX - this._canvasWidthMm;

    // Y: SVG +Y down = machine -Y (both go toward front/user)
    const relativeY = -svgY;

    // Add origin offset to get absolute machine coordinates
    const machineX = this._originX + relativeX;
    const machineY = this._originY + relativeY;

    return { x: machineX, y: machineY };
  }

  /**
   * Execute a single plot command.
   * Uses streaming mode for fast execution when available.
   */
  private async _executeCommand(cmd: PlotCommand): Promise<void> {
    switch (cmd.type) {
      case 'pen_up':
        if (this._penDown) {
          await this._cmd.penUp(undefined, this._useStreaming);
          this._penDown = false;
        }
        break;

      case 'pen_down':
        if (!this._penDown) {
          await this._cmd.penDown(undefined, this._useStreaming);
          this._penDown = true;
        }
        break;

      case 'move':
      case 'line': {
        if (cmd.x === undefined || cmd.y === undefined) {
          return;
        }

        // Transform SVG coordinates to plotter coordinates
        const { x: plotterX, y: plotterY } = this._transformCoordinates(cmd.x, cmd.y);

        // Calculate distance for skip check
        const dx = plotterX - this._currentX;
        const dy = plotterY - this._currentY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.01) {
          return;  // Less than 0.01mm, skip
        }

        // Move with appropriate feed rate
        // Use streaming mode for fast execution - commands are queued to GRBL's buffer
        // instead of waiting for each "ok" response
        if (this._penDown) {
          // Drawing move - G01 with feed rate
          const feedRate = this._penDownSpeed * 60;  // Convert mm/s to mm/min
          await this._cmd.moveAbsolute(plotterX, plotterY, feedRate, this._useStreaming);
        } else {
          // Rapid move (pen up) - G00
          await this._cmd.moveAbsolute(plotterX, plotterY, null, this._useStreaming);
        }

        // Update internal position tracking
        this._currentX = plotterX;
        this._currentY = plotterY;
        break;
      }
    }
  }

  /**
   * Get paper configuration based on canvas size.
   */
  private _getPaperConfig(): PaperConfig {
    if (this._canvasWidthMm === 210 && this._canvasHeightMm === 297) {
      return PAPER_CONFIGS.A4;
    }
    if (this._canvasWidthMm === 297 && this._canvasHeightMm === 420) {
      return PAPER_CONFIGS.A3;
    }

    // Custom size - use A4 positioning as default
    return {
      name: 'Custom',
      width: this._canvasWidthMm,
      height: this._canvasHeightMm,
      topRightX: 290.0,
      topRightY: 0.0,
    };
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
