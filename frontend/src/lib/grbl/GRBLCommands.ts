/**
 * GRBL command abstraction for iDraw 2.0 plotter with DrawCore firmware.
 *
 * Provides a high-level interface to the GRBL-based DrawCore firmware.
 * Port of Python backend/core/plotter/grbl_commands.py to TypeScript.
 *
 * Key differences from EBB protocol:
 * - Pen control uses Z-axis: Z0 = UP, Z5 = DOWN (inverted from typical CNC)
 * - Movement uses absolute coordinates with feed rate (mm/min)
 * - Status queries return detailed state information
 * - Does NOT support G2/G3 arc commands (use linear segments)
 */

import type { ISerialConnection } from '../serial/types';
import {
  GRBLStatus,
  GRBLState,
  PenState,
  GRBLError,
  PEN_HEIGHTS,
  SPEED_LIMITS,
  MACHINE_LIMITS,
  STEPS_PER_MM,
} from './types';

/**
 * High-level GRBL command interface for iDraw 2.0 with DrawCore firmware.
 */
export class GRBLCommands {
  private _conn: ISerialConnection;
  private _penState: PenState = 'unknown';
  private _currentX: number = 0;
  private _currentY: number = 0;
  private _currentZ: number = 0;
  private _isInitialized: boolean = false;

  // Configurable pen heights
  private _penUpZ: number = PEN_HEIGHTS.UP;
  private _penDownZ: number = PEN_HEIGHTS.DOWN;

  constructor(connection: ISerialConnection) {
    this._conn = connection;
  }

  // === Getters ===

  get penState(): PenState {
    return this._penState;
  }

  get currentPosition(): { x: number; y: number } {
    return { x: this._currentX, y: this._currentY };
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  // === Initialization ===

  /**
   * Initialize GRBL controller after connection.
   *
   * Sets up:
   * - G21: Millimeter units
   * - G90: Absolute positioning mode
   * - G17: XY plane selection
   * - Syncs current position from status query
   */
  async initialize(): Promise<void> {
    // Set millimeter units
    await this._sendGcode('G21');

    // Set absolute positioning mode
    await this._sendGcode('G90');

    // Set XY plane
    await this._sendGcode('G17');

    // Query current position
    const status = await this.queryStatus();
    this._currentX = status.machineX;
    this._currentY = status.machineY;
    this._currentZ = status.machineZ;

    // Determine pen state from Z position
    if (this._currentZ <= this._penUpZ + 0.5) {
      this._penState = 'up';
    } else {
      this._penState = 'down';
    }

    this._isInitialized = true;
    console.log(`GRBL initialized at position (${this._currentX}, ${this._currentY}, ${this._currentZ})`);
  }

  /**
   * Query firmware version.
   */
  async getVersion(): Promise<string> {
    return await this._conn.sendCommand('$I');
  }

  // === Pen Control ===

  /**
   * Raise the pen using Z-axis movement.
   *
   * @param _delayMs - Ignored for GRBL (provided for API compatibility with EBB)
   * @param useStreaming - If true and connection supports it, use streaming (default: false)
   */
  async penUp(_delayMs?: number, useStreaming: boolean = false): Promise<void> {
    // _delayMs parameter is ignored for GRBL (API compatibility only)
    const gcode = `G00 Z${this._penUpZ}`;
    if (useStreaming && this._conn.streamGcode) {
      await this._conn.streamGcode(gcode);
    } else {
      await this._sendGcode(gcode);
    }
    this._penState = 'up';
    this._currentZ = this._penUpZ;
    // Note: No _waitForIdle() here - GRBL's planner handles motion sequencing.
    // The pen Z movement is queued and will complete before subsequent XY moves start.
  }

  /**
   * Lower the pen using Z-axis movement.
   *
   * @param _delayMs - Ignored for GRBL (provided for API compatibility with EBB)
   * @param useStreaming - If true and connection supports it, use streaming (default: false)
   */
  async penDown(_delayMs?: number, useStreaming: boolean = false): Promise<void> {
    // _delayMs parameter is ignored for GRBL (API compatibility only)
    const gcode = `G00 Z${this._penDownZ}`;
    if (useStreaming && this._conn.streamGcode) {
      await this._conn.streamGcode(gcode);
    } else {
      await this._sendGcode(gcode);
    }
    this._penState = 'down';
    this._currentZ = this._penDownZ;
    // Note: No _waitForIdle() here - GRBL's planner handles motion sequencing.
    // The pen Z movement is queued and will complete before subsequent XY moves start.
  }

  /**
   * Configure pen heights.
   */
  setPenHeights(upHeightMm: number, downHeightMm: number): void {
    this._penUpZ = upHeightMm;
    this._penDownZ = downHeightMm;
    console.log(`Pen heights set: up=${upHeightMm}mm, down=${downHeightMm}mm`);
  }

  // === Motor Control ===

  /**
   * Enable stepper motors (unlock if in alarm state).
   *
   * @param _microstepMode - Ignored for GRBL (provided for API compatibility with EBB)
   */
  async enableMotors(_microstepMode: number = 1): Promise<void> {
    // _microstepMode parameter is ignored for GRBL (API compatibility only)
    // GRBL doesn't use microstep modes like EBB
    // Clear any alarm state with $X (kill alarm lock)
    await this._conn.sendCommand('$X');
    console.log('Motors enabled (GRBL unlocked)');
  }

  /**
   * Disable stepper motors (allows manual movement).
   */
  async disableMotors(): Promise<void> {
    try {
      await this._sendGcode('M18');
    } catch {
      // If M18 not supported, try sleep mode
      await this._conn.sendCommand('$SLP');
    }
    console.log('Motors disabled');
  }

  // === Movement ===

  /**
   * Move to absolute position.
   *
   * @param xMm - Target X position in mm
   * @param yMm - Target Y position in mm
   * @param feedRate - Feed rate in mm/min. If null, uses G00 rapid move.
   * @param useStreaming - If true and connection supports it, use character-counting streaming (default: false)
   */
  async moveAbsolute(xMm: number, yMm: number, feedRate: number | null = null, useStreaming: boolean = false): Promise<void> {
    // Clamp to machine limits
    const x = Math.max(0, Math.min(xMm, MACHINE_LIMITS.MAX_X_MM));
    const y = Math.max(MACHINE_LIMITS.MIN_Y_MM, Math.min(yMm, MACHINE_LIMITS.MAX_Y_MM));

    let gcode: string;
    if (feedRate === null) {
      // Rapid move (G00) - maximum speed
      gcode = `G00 X${x.toFixed(3)} Y${y.toFixed(3)}`;
    } else {
      // Linear move (G01) with feed rate
      const f = Math.max(SPEED_LIMITS.MIN_FEED_RATE, Math.min(feedRate, SPEED_LIMITS.MAX_FEED_RATE));
      gcode = `G01 X${x.toFixed(3)} Y${y.toFixed(3)} F${f.toFixed(1)}`;
    }

    // Use streaming if available and requested
    if (useStreaming && this._conn.streamGcode) {
      await this._conn.streamGcode(gcode);
    } else {
      await this._sendGcode(gcode);
    }

    this._currentX = x;
    this._currentY = y;
  }

  /**
   * Wait for all streamed commands to complete.
   * Call this after a batch of streaming moves to ensure they've finished.
   */
  async waitForStreamComplete(timeoutMs: number = 60000): Promise<void> {
    if (this._conn.waitForStreamComplete) {
      await this._conn.waitForStreamComplete(timeoutMs);
    }
  }

  /**
   * Move relative to current position.
   *
   * @param dxMm - X displacement in mm
   * @param dyMm - Y displacement in mm
   * @param durationMs - Target duration in ms (converted to feed rate)
   */
  async moveRelative(dxMm: number, dyMm: number, durationMs: number): Promise<void> {
    const targetX = this._currentX + dxMm;
    const targetY = this._currentY + dyMm;

    // Calculate distance and required feed rate
    const distance = Math.sqrt(dxMm * dxMm + dyMm * dyMm);
    let feedRate: number = SPEED_LIMITS.DEFAULT_DRAW_SPEED;

    if (distance > 0.01 && durationMs > 0) {
      // Convert duration to feed rate: F = distance / (duration/60000) mm/min
      feedRate = (distance * 60000) / durationMs;
      feedRate = Math.max(SPEED_LIMITS.MIN_FEED_RATE, Math.min(feedRate, SPEED_LIMITS.MAX_FEED_RATE));
    }

    await this.moveAbsolute(targetX, targetY, feedRate);
  }

  /**
   * Move relative using step counts (EBB compatibility).
   */
  async moveRelativeSteps(dxSteps: number, dySteps: number, durationMs: number): Promise<void> {
    const dxMm = dxSteps / STEPS_PER_MM;
    const dyMm = dySteps / STEPS_PER_MM;
    await this.moveRelative(dxMm, dyMm, durationMs);
  }

  // === Status and Queries ===

  /**
   * Query GRBL status.
   *
   * Sends the ? real-time command and parses the response.
   */
  async queryStatus(): Promise<GRBLStatus> {
    const response = await this._conn.sendCommand('?');
    return this._parseStatusResponse(response);
  }

  /**
   * Check if controller is idle.
   */
  async isIdle(): Promise<boolean> {
    const status = await this.queryStatus();
    return status.state === 'Idle';
  }

  /**
   * Wait for all movements to complete.
   */
  async waitForCompletion(timeoutMs: number = 60000): Promise<void> {
    await this._waitForIdle(timeoutMs);
  }

  // === Homing ===

  /**
   * Execute GRBL homing cycle.
   */
  async home(timeoutMs: number = 30000): Promise<void> {
    try {
      await this._conn.sendCommand('$H');
      await this._waitForIdle(timeoutMs);

      // After homing, sync position
      const status = await this.queryStatus();
      this._currentX = status.machineX;
      this._currentY = status.machineY;
      this._currentZ = status.machineZ;

      // Assume pen is up after homing
      this._penState = 'up';

      console.log(`Homing completed at (${this._currentX}, ${this._currentY}, ${this._currentZ})`);
    } catch (err) {
      throw this._createGRBLError('PLT-M001', 'Homing failed', String(err));
    }
  }

  // === Emergency Stop ===

  /**
   * Emergency stop - halt all motion immediately.
   */
  async emergencyStop(): Promise<void> {
    // Send feed hold (immediate stop) - real-time command
    await this._conn.sendCommandNoResponse('!');
    await this._delay(100);

    // Soft reset (Ctrl-X = 0x18)
    await this._conn.sendCommandNoResponse('\x18');
    await this._delay(500);

    // Clear alarm state
    try {
      await this._conn.sendCommand('$X');
    } catch {
      // May fail if in certain states
    }

    console.warn('Emergency stop executed');
  }

  // === Hardware Status ===

  /**
   * Query pause button state via Hold state check.
   *
   * @returns 1 if in Hold state, 0 otherwise, -1 on error
   */
  async queryPauseButton(): Promise<number> {
    try {
      const status = await this.queryStatus();
      return status.state === 'Hold' ? 1 : 0;
    } catch {
      return -1;
    }
  }

  /**
   * Check if pause was triggered (Hold state).
   *
   * @returns false if not paused
   * @throws GRBLError if in Hold state
   */
  async checkForPauseButton(): Promise<boolean> {
    const result = await this.queryPauseButton();
    if (result === 1) {
      throw this._createGRBLError('PLT-U001', 'Pause button pressed');
    }
    return false;
  }

  /**
   * Check voltage - no-op for GRBL (doesn't support voltage monitoring).
   */
  async checkVoltage(): Promise<void> {
    // GRBL doesn't support voltage monitoring
  }

  // === Calibration Methods ===

  /**
   * Move to position for calibration.
   *
   * @param xMm - Target X position in mm
   * @param yMm - Target Y position in mm
   * @param speedMmS - Speed in mm/s (converted to mm/min)
   */
  async moveToPosition(xMm: number, yMm: number, speedMmS: number = 50.0): Promise<void> {
    const feedRate = speedMmS * 60; // Convert mm/s to mm/min
    await this.moveAbsolute(xMm, yMm, feedRate);
    await this._waitForIdle(60000);
    console.log(`Moved to position (${xMm}, ${yMm}) mm`);
  }

  /**
   * Draw test pattern (square with X diagonals) for calibration.
   *
   * @param sizeMm - Size of the test pattern square in mm
   * @param speedMmS - Drawing speed in mm/s
   */
  async drawTestPattern(sizeMm: number = 10.0, speedMmS: number = 30.0): Promise<void> {
    const feedRate = speedMmS * 60; // Convert mm/s to mm/min
    const startX = this._currentX;
    const startY = this._currentY;

    // Draw square
    await this.penDown();

    // Right
    await this.moveAbsolute(startX + sizeMm, startY, feedRate);
    await this._waitForIdle(60000);

    // Down
    await this.moveAbsolute(startX + sizeMm, startY + sizeMm, feedRate);
    await this._waitForIdle(60000);

    // Left
    await this.moveAbsolute(startX, startY + sizeMm, feedRate);
    await this._waitForIdle(60000);

    // Up (back to start)
    await this.moveAbsolute(startX, startY, feedRate);
    await this._waitForIdle(60000);

    await this.penUp();

    // Draw first diagonal (top-left to bottom-right)
    await this.penDown();
    await this.moveAbsolute(startX + sizeMm, startY + sizeMm, feedRate);
    await this._waitForIdle(60000);
    await this.penUp();

    // Move to top-right corner
    await this.moveAbsolute(startX + sizeMm, startY, null); // Rapid
    await this._waitForIdle(60000);

    // Draw second diagonal (top-right to bottom-left)
    await this.penDown();
    await this.moveAbsolute(startX, startY + sizeMm, feedRate);
    await this._waitForIdle(60000);
    await this.penUp();

    // Return to start position
    await this.moveAbsolute(startX, startY, null); // Rapid
    await this._waitForIdle(60000);

    console.log(`Test pattern drawn (${sizeMm}mm square with X)`);
  }

  // === Utility ===

  mmToSteps(mm: number): number {
    return Math.round(mm * STEPS_PER_MM);
  }

  stepsToMm(steps: number): number {
    return steps / STEPS_PER_MM;
  }

  // === Private Methods ===

  private async _sendGcode(gcode: string, timeout: number = 5000): Promise<string> {
    const response = await this._conn.sendCommand(gcode, timeout);

    // Check for error response
    if (response.toLowerCase().includes('error:')) {
      const errorMatch = response.toLowerCase().match(/error:(\d+)/);
      const errorCode = errorMatch ? errorMatch[1] : 'unknown';
      throw this._createGRBLError('PLT-X003', 'Command rejected', response, gcode, errorCode);
    }

    // Check for alarm
    if (response.toUpperCase().includes('ALARM')) {
      const alarmMatch = response.toUpperCase().match(/ALARM:(\d+)/);
      const alarmCode = alarmMatch ? alarmMatch[1] : 'unknown';
      throw this._createGRBLError('PLT-G001', 'GRBL alarm triggered', response, gcode, undefined, alarmCode);
    }

    return response;
  }

  private _parseStatusResponse(response: string): GRBLStatus {
    let state: GRBLState = 'Unknown';
    let mx = 0, my = 0, mz = 0;
    let wx: number | undefined, wy: number | undefined, wz: number | undefined;
    let feed = 0, spindle = 0;
    let pins: string | undefined;

    // Extract state
    const stateMatch = response.match(/<(\w+)\|/);
    if (stateMatch) {
      state = stateMatch[1] as GRBLState;
    }

    // Extract machine position
    const mposMatch = response.match(/MPos:([-\d.]+),([-\d.]+),([-\d.]+)/);
    if (mposMatch) {
      mx = parseFloat(mposMatch[1]);
      my = parseFloat(mposMatch[2]);
      mz = parseFloat(mposMatch[3]);
    }

    // Extract work position (if present)
    const wposMatch = response.match(/WPos:([-\d.]+),([-\d.]+),([-\d.]+)/);
    if (wposMatch) {
      wx = parseFloat(wposMatch[1]);
      wy = parseFloat(wposMatch[2]);
      wz = parseFloat(wposMatch[3]);
    }

    // Extract feed rate and spindle speed
    const fsMatch = response.match(/FS:(\d+),(\d+)/);
    if (fsMatch) {
      feed = parseFloat(fsMatch[1]);
      spindle = parseFloat(fsMatch[2]);
    }

    // Extract pin states
    const pnMatch = response.match(/Pn:([XYZPDHRS]+)/);
    if (pnMatch) {
      pins = pnMatch[1];
    }

    return {
      state,
      machineX: mx,
      machineY: my,
      machineZ: mz,
      feedRate: feed,
      spindleSpeed: spindle,
      workX: wx,
      workY: wy,
      workZ: wz,
      pins,
    };
  }

  private async _waitForIdle(timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (true) {
      const status = await this.queryStatus();

      if (status.state === 'Idle') {
        return;
      }

      if (status.state === 'Alarm') {
        throw this._createGRBLError('PLT-G001', 'GRBL alarm state', JSON.stringify({
          alarmState: status.state,
          position: { x: status.machineX, y: status.machineY, z: status.machineZ },
        }));
      }

      if (Date.now() - startTime > timeoutMs) {
        throw this._createGRBLError('PLT-M002', 'Motion timeout', `Timeout after ${timeoutMs}ms`);
      }

      await this._delay(50);
    }
  }

  private _createGRBLError(
    code: string,
    message: string,
    response?: string,
    command?: string,
    grblErrorCode?: string,
    alarmCode?: string
  ): GRBLError {
    return {
      code,
      message,
      response,
      command,
      grblErrorCode,
      alarmCode,
    };
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
