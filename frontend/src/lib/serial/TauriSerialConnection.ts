/**
 * Tauri serial plugin implementation for desktop serial communication.
 *
 * This implementation uses the tauri-plugin-serialplugin to communicate with
 * USB serial devices on macOS, Windows, and Linux.
 *
 * This is used when running as a Tauri desktop app, providing serial port
 * access on platforms where Web Serial API is not available (Safari, Firefox).
 *
 * IMPORTANT: This uses the event-driven listener API (startListening/listen/stopListening)
 * instead of polling reads to avoid blocking the UI thread.
 *
 * @see https://github.com/s00d/tauri-plugin-serialplugin
 */

import {
  ISerialConnection,
  SerialPortInfo,
  ConnectionState,
  SerialConnectionEvents,
  SerialConnectionOptions,
  SUPPORTED_DEVICES,
  DEFAULT_SERIAL_OPTIONS,
  createSerialError,
} from './types';

// Import types from the plugin
import type { UnlistenFn } from '@tauri-apps/api/event';

// Tauri plugin types - using the actual API from tauri-plugin-serialplugin
type TauriSerialPortStatic = {
  available_ports: () => Promise<Record<string, {
    port_name: string;
    port_type: string;
  }>>;
  available_ports_direct: () => Promise<Record<string, {
    port_name: string;
    port_type: string;
    vid?: number;
    pid?: number;
    serial_number?: string;
    manufacturer?: string;
    product?: string;
  }>>;
};

type TauriSerialPortInstance = {
  isOpen: boolean;
  open: () => Promise<void>;
  close: () => Promise<void>;
  write: (data: string) => Promise<number>;
  read: (options?: { timeout?: number; size?: number }) => Promise<string>;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  listen: (fn: (data: string) => void, isDecode?: boolean) => Promise<UnlistenFn>;
  cancelListen: () => Promise<void>;
};

type TauriSerialPortConstructor = {
  new(config: {
    path: string;
    baudRate: number;
    dataBits?: string;
    flowControl?: string;
    parity?: string;
    stopBits?: string;
    timeout?: number;
  }): TauriSerialPortInstance;
} & TauriSerialPortStatic;

// Pending command structure for non-blocking response handling
interface PendingCommand {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  buffer: string;
  command: string;
  startTime: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

// Queued command for character-counting streaming protocol
interface QueuedCommand {
  command: string;
  charCount: number;  // Length including newline
}

// GRBL RX buffer size (128 bytes, but we use 100 for safety margin with CH340 chips)
const GRBL_RX_BUFFER_SIZE = 100;

// Connection retry configuration
const MAX_CONNECTION_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;
const PORT_SETTLE_DELAY_MS = 150;
const CLEANUP_STEP_DELAY_MS = 50;

// Cache the Tauri detection result to avoid repeated checks
let _isTauriEnv: boolean | null = null;

/** Check if running in Tauri environment */
export function isTauriEnvironment(): boolean {
  // Return cached result if available
  if (_isTauriEnv !== null) {
    return _isTauriEnv;
  }

  if (typeof window === 'undefined') {
    _isTauriEnv = false;
    return false;
  }

  const windowObj = window as any;
  const hasTauriInternals = '__TAURI_INTERNALS__' in window;
  const hasTauri = '__TAURI__' in window;
  const hasTauriMetadata = windowObj.__TAURI_METADATA__ !== undefined;
  const hasTauriIpc = windowObj.__TAURI_IPC__ !== undefined;

  // Check for Tauri v2 internals (most reliable for v2)
  if (hasTauriInternals) {
    _isTauriEnv = true;
    return true;
  }

  // Check for IPC - this is the most reliable for Tauri v2
  if (hasTauriIpc) {
    _isTauriEnv = true;
    return true;
  }

  // Fallback check for legacy Tauri v1
  if (hasTauri) {
    _isTauriEnv = true;
    return true;
  }

  // Check if we can access Tauri metadata
  if (hasTauriMetadata) {
    _isTauriEnv = true;
    return true;
  }

  _isTauriEnv = false;
  return false;
}

/**
 * Get the Tauri serial plugin API with enums.
 * Throws if not in Tauri environment.
 */
async function getTauriSerial(): Promise<{
  SerialPort: TauriSerialPortConstructor;
  DataBits: any;
  FlowControl: any;
  Parity: any;
  StopBits: any;
}> {
  if (!isTauriEnvironment()) {
    throw createSerialError(
      'BROWSER_NOT_SUPPORTED',
      'Not running in Tauri',
      'This serial connection requires the Tauri desktop app.'
    );
  }

  // Dynamic import to avoid bundling issues
  const module = await import('tauri-plugin-serialplugin');
  return {
    SerialPort: module.SerialPort as unknown as TauriSerialPortConstructor,
    DataBits: module.DataBits,
    FlowControl: module.FlowControl,
    Parity: module.Parity,
    StopBits: module.StopBits,
  };
}

/**
 * Tauri serial plugin-based serial connection.
 *
 * Uses the Tauri serial plugin for native serial communication on all platforms.
 * This implementation uses event-driven listeners for non-blocking I/O.
 */
export class TauriSerialConnection implements ISerialConnection {
  private _state: ConnectionState = 'disconnected';
  private _portPath: string | null = null;
  private _port: TauriSerialPortInstance | null = null;
  private _options: Required<SerialConnectionOptions> = { ...DEFAULT_SERIAL_OPTIONS };
  private _eventHandlers: SerialConnectionEvents = {};

  // Event-driven listener state
  private _unlistenFn: UnlistenFn | null = null;
  private _pendingCommand: PendingCommand | null = null;
  private _incomingBuffer: string = '';

  // Character-counting streaming protocol state
  private _streamingEnabled: boolean = false;
  private _streamQueue: QueuedCommand[] = [];  // Commands sent but not yet acknowledged
  private _streamBufferUsed: number = 0;       // Characters currently in GRBL's RX buffer
  private _streamWaiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  private _streamResponseBuffer: string = '';  // Buffer for streaming responses

  get state(): ConnectionState {
    return this._state;
  }

  get portPath(): string | null {
    return this._portPath;
  }

  get isConnected(): boolean {
    return this._state === 'connected' && this._portPath !== null;
  }

  /**
   * List available serial ports.
   */
  async listPorts(): Promise<SerialPortInfo[]> {
    try {
      console.log('[TauriSerial] Listing ports...');
      const { SerialPort } = await getTauriSerial();
      const ports = await SerialPort.available_ports_direct();
      console.log('[TauriSerial] Raw ports from Tauri:', Object.keys(ports).length, 'ports');

      const portList = Object.entries(ports).map(([path, info]) => {
        let isCompatible = false;
        let deviceName: string | undefined;

        // Enhanced logging for all USB devices
        console.log('[TauriSerial] Port:', path, {
          vid: info.vid,
          pid: info.pid,
          manufacturer: info.manufacturer,
          product: info.product,
          port_type: info.port_type
        });

        // Check if this matches a supported device
        if (info.vid !== undefined && info.pid !== undefined) {
          for (const device of SUPPORTED_DEVICES) {
            if (info.vid === device.vid && info.pid === device.pid) {
              isCompatible = true;
              deviceName = device.name;
              console.log('[TauriSerial] ✓ Matched device:', device.name, 'at', path);
              break;
            }
          }
        } else {
          // Log ports without VID/PID for debugging
          if (path.includes('usb') || path.includes('usbmodem')) {
            console.warn('[TauriSerial] USB port without VID/PID:', path);
          }
        }

        return {
          path,
          description: info.product || info.manufacturer || info.port_type || 'Unknown Device',
          hwid: info.vid && info.pid ? `VID:${info.vid.toString(16).toUpperCase()} PID:${info.pid.toString(16).toUpperCase()}` : undefined,
          isCompatible,
          deviceName,
        };
      });

      console.log('[TauriSerial] Processed', portList.length, 'ports,', portList.filter(p => p.isCompatible).length, 'compatible');

      // On macOS, prefer /dev/cu.* over /dev/tty.* for outgoing connections
      // Filter to only show cu.* devices if both exist for the same device
      const cuPorts = portList.filter(p => p.path.includes('/dev/cu.'));
      const ttyPorts = portList.filter(p => p.path.includes('/dev/tty.'));

      if (cuPorts.length > 0 && ttyPorts.length > 0) {
        console.log('[TauriSerial] Filtering to prefer', cuPorts.length, 'cu.* ports over', ttyPorts.length, 'tty.* ports on macOS');
        return cuPorts;
      }

      return portList;
    } catch (error) {
      console.error('[TauriSerial] Failed to list ports:', error);
      throw error;
    }
  }

  /**
   * Find a compatible plotter port automatically.
   */
  async findPlotterPort(): Promise<string | null> {
    const ports = await this.listPorts();
    const compatible = ports.find((p) => p.isCompatible);
    return compatible?.path || null;
  }

  /**
   * Connect to serial port with automatic retry on failure.
   */
  async connect(port?: string, options?: SerialConnectionOptions): Promise<void> {
    console.log('[TauriSerial] connect() called, port:', port, 'state:', this._state);

    if (this.isConnected) {
      console.log('[TauriSerial] Already connected, returning');
      return; // Already connected
    }

    this._options = { ...DEFAULT_SERIAL_OPTIONS, ...options };
    let lastError: Error | null = null;

    // Retry loop with exponential backoff
    for (let attempt = 1; attempt <= MAX_CONNECTION_RETRIES; attempt++) {
      try {
        console.log(`[TauriSerial] Connection attempt ${attempt}/${MAX_CONNECTION_RETRIES}`);
        await this._attemptConnect(port);
        console.log('[TauriSerial] Connection successful');
        return; // Success!
      } catch (err) {
        lastError = err as Error;
        console.warn(`[TauriSerial] Connection attempt ${attempt} failed:`, err);

        // Don't retry for certain errors
        if (err && typeof err === 'object' && 'code' in err) {
          const code = (err as any).code;
          if (code === 'NO_DEVICE_FOUND' || code === 'PERMISSION_DENIED') {
            throw err; // No point retrying these
          }
        }

        if (attempt < MAX_CONNECTION_RETRIES) {
          // Clean up before retry
          await this._cleanup();

          // Exponential backoff
          const delay = BASE_RETRY_DELAY_MS * attempt;
          console.log(`[TauriSerial] Waiting ${delay}ms before retry...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // All retries failed
    this._state = 'error';
    throw lastError || createSerialError(
      'NO_DEVICE_FOUND',
      'Connection failed',
      'Failed to connect after multiple attempts'
    );
  }

  /**
   * Single connection attempt (internal).
   */
  private async _attemptConnect(port?: string): Promise<void> {
    // Clean up any previous connection
    await this._cleanup();

    this._state = 'connecting';

    // Declare portPath outside try-catch so it's accessible in catch block
    let portPath: string | null = port || null;

    try {
      const { SerialPort, DataBits, FlowControl, Parity, StopBits } = await getTauriSerial();

      // Find port to connect to if not provided
      if (!portPath) {
        portPath = await this.findPlotterPort();
        if (!portPath) {
          throw createSerialError(
            'NO_DEVICE_FOUND',
            'No compatible plotter found',
            'Could not find an iDraw or compatible device. Please check the connection.'
          );
        }
      }

      // Allow port to settle after enumeration (helps with macOS race conditions)
      await new Promise(r => setTimeout(r, PORT_SETTLE_DELAY_MS));

      // Create a new SerialPort instance with configuration using enums
      this._port = new SerialPort({
        path: portPath,
        baudRate: this._options.baudRate,
        dataBits: DataBits.Eight,
        flowControl: FlowControl.None,
        parity: Parity.None,
        stopBits: StopBits.One,
        timeout: this._options.timeout
      });

      console.log('[TauriSerial] Opening port...');
      await this._port.open();
      console.log('[TauriSerial] Port opened successfully');

      this._portPath = portPath;

      // Small delay after open to let port stabilize
      await new Promise(r => setTimeout(r, CLEANUP_STEP_DELAY_MS));

      // Start event-driven listening (non-blocking)
      console.log('[TauriSerial] Starting event-driven listener');
      await this._port.startListening();

      // Subscribe to incoming data via callback
      this._unlistenFn = await this._port.listen((data: string) => {
        this._handleIncomingData(data);
      }, true); // isDecode=true to get string data

      console.log('[TauriSerial] Listener started successfully');

      this._state = 'connected';
      this._eventHandlers.onConnect?.();
    } catch (err) {
      this._state = 'error';
      console.error('[TauriSerial] Connection failed:', err);

      // Clean up on failure
      await this._cleanup();

      if (err && typeof err === 'object' && 'code' in err) {
        throw err; // Already a SerialError
      }

      // Extract error message
      let errorMsg = String(err);
      if (err && typeof err === 'object' && 'message' in err) {
        errorMsg = String(err.message);
      }

      if (errorMsg.includes('Permission denied')) {
        throw createSerialError(
          'PERMISSION_DENIED',
          'Permission denied',
          'Access to the serial port was denied.'
        );
      }
      if (errorMsg.includes('busy') || errorMsg.includes('in use')) {
        throw createSerialError(
          'PORT_IN_USE',
          'Port already in use',
          'The serial port is already open in another application.'
        );
      }
      if (errorMsg.includes('Resource temporarily unavailable') || errorMsg.includes('EAGAIN')) {
        throw createSerialError(
          'PORT_IN_USE',
          'Port temporarily unavailable',
          'The serial port may still be releasing. Please wait a moment and try again.'
        );
      }

      throw createSerialError(
        'NO_DEVICE_FOUND',
        'Connection failed',
        `${errorMsg} (Port: ${portPath || 'unknown'})`
      );
    }
  }

  async disconnect(): Promise<void> {
    console.log('[TauriSerial] disconnect() called');
    await this._cleanup();
    this._state = 'disconnected';
    this._eventHandlers.onDisconnect?.();
    console.log('[TauriSerial] Disconnect complete');
  }

  /**
   * Clean up all resources (listeners, port, pending commands).
   *
   * IMPORTANT: The order and delays here are critical to avoid issue #21
   * (TypeError on port.close() with active listener). We must:
   * 1. Unsubscribe listener FIRST
   * 2. Add small delays between steps to let operations complete
   * 3. Check port.isOpen before closing
   */
  private async _cleanup(): Promise<void> {
    console.log('[TauriSerial] _cleanup() starting...');

    // Cancel any pending command FIRST
    if (this._pendingCommand) {
      clearTimeout(this._pendingCommand.timeoutId);
      const err = new Error('Connection closed while waiting for response.');
      (err as any).code = 'DEVICE_DISCONNECTED';
      this._pendingCommand.reject(err);
      this._pendingCommand = null;
    }

    // Cancel any streaming waiters
    for (const waiter of this._streamWaiters) {
      const err = new Error('Connection closed during streaming.');
      (err as any).code = 'DEVICE_DISCONNECTED';
      waiter.reject(err);
    }
    this._streamWaiters = [];
    this._streamQueue = [];
    this._streamBufferUsed = 0;
    this._streamingEnabled = false;
    this._streamResponseBuffer = '';

    // Unsubscribe from listener BEFORE any port operations (critical for issue #21)
    if (this._unlistenFn) {
      try {
        this._unlistenFn();
        console.log('[TauriSerial] Listener unsubscribed');
      } catch (err) {
        console.warn('[TauriSerial] Error unsubscribing listener:', err);
      }
      this._unlistenFn = null;
    }

    // Small delay to let unsubscribe propagate
    await new Promise(r => setTimeout(r, CLEANUP_STEP_DELAY_MS));

    // Stop listening and close port with delays between each step
    if (this._port) {
      try {
        await this._port.cancelListen();
        console.log('[TauriSerial] cancelListen completed');
      } catch (err) {
        // Ignore - might already be cancelled
      }

      await new Promise(r => setTimeout(r, CLEANUP_STEP_DELAY_MS));

      try {
        await this._port.stopListening();
        console.log('[TauriSerial] stopListening completed');
      } catch (err) {
        // Ignore - might already be stopped
      }

      await new Promise(r => setTimeout(r, CLEANUP_STEP_DELAY_MS));

      // Only close if port is still open (avoids issue #21)
      try {
        if (this._port.isOpen) {
          await this._port.close();
          console.log('[TauriSerial] Port closed');
        }
      } catch (err) {
        console.warn('[TauriSerial] Error closing port:', err);
      }
    }

    this._port = null;
    this._portPath = null;
    this._incomingBuffer = '';
    console.log('[TauriSerial] _cleanup() complete');
  }

  async sendCommand(command: string, timeout: number = 5000): Promise<string> {
    console.log('[TauriSerial] sendCommand called:', command, 'timeout:', timeout);

    if (!this.isConnected || !this._port) {
      console.error('[TauriSerial] Not connected!');
      throw createSerialError(
        'DEVICE_DISCONNECTED',
        'Not connected',
        'Cannot send command: not connected to plotter.'
      );
    }

    // Wait for any pending command to complete
    if (this._pendingCommand) {
      console.error('[TauriSerial] Command already in progress');
      throw createSerialError(
        'INVALID_RESPONSE',
        'Command in progress',
        'Another command is already waiting for a response.'
      );
    }

    // Determine command type and line ending
    const isGrblRealtime = ['?', '!', '~', '\x18'].includes(command);
    const isGrblCommand = command.startsWith('$') || command.startsWith('G') || command.startsWith('M') || isGrblRealtime;

    let cmdToSend: string;
    if (isGrblRealtime) {
      cmdToSend = command;
    } else if (isGrblCommand) {
      cmdToSend = `${command}\n`;
    } else {
      cmdToSend = `${command}\r`;
    }

    console.log('[TauriSerial] Will send:', JSON.stringify(cmdToSend));

    // Create promise that will be resolved when response is complete
    return new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this._pendingCommand) {
          const partialResponse = this._pendingCommand.buffer;
          this._pendingCommand = null;
          reject(
            createSerialError(
              'RESPONSE_TIMEOUT',
              'Response timeout',
              `No response received within ${timeout}ms`,
              { command, partialResponse }
            )
          );
        }
      }, timeout);

      // Store pending command info
      this._pendingCommand = {
        resolve,
        reject,
        buffer: '',
        command,
        startTime: Date.now(),
        timeoutId,
      };

      // Send command (non-blocking)
      this._port!.write(cmdToSend).catch((err) => {
        if (this._pendingCommand) {
          clearTimeout(this._pendingCommand.timeoutId);
          this._pendingCommand = null;
        }
        reject(
          createSerialError(
            'INVALID_RESPONSE',
            'Write failed',
            `Failed to send command: ${err}`
          )
        );
      });
    });
  }

  async sendCommandNoResponse(command: string): Promise<void> {
    if (!this.isConnected || !this._port) {
      throw createSerialError(
        'DEVICE_DISCONNECTED',
        'Not connected',
        'Cannot send command: not connected to plotter.'
      );
    }

    // Real-time commands don't need line ending
    const isRealtime = ['!', '~', '?', '\x18'].includes(command);
    let cmdToSend: string;

    if (isRealtime) {
      cmdToSend = command;
    } else {
      const isGrbl = command.startsWith('$') || command.startsWith('G') || command.startsWith('M');
      const terminator = isGrbl ? '\n' : '\r';
      cmdToSend = `${command}${terminator}`;
    }

    await this._port.write(cmdToSend);
  }

  setEventHandlers(events: SerialConnectionEvents): void {
    this._eventHandlers = { ...this._eventHandlers, ...events };
  }

  // === Private Methods ===

  /**
   * Handle incoming data from the event-driven listener.
   * This is called asynchronously whenever data arrives.
   */
  private _handleIncomingData(data: string): void {
    // Always notify event handlers of incoming data
    this._eventHandlers.onData?.(data);

    // Route to streaming handler if in streaming mode
    if (this._streamingEnabled && !this._pendingCommand) {
      this._processStreamingResponse(data);
      return;
    }

    // If no command is pending, just buffer for potential later use
    if (!this._pendingCommand) {
      this._incomingBuffer += data;
      return;
    }

    // Append to pending command buffer
    this._pendingCommand.buffer += data;
    const response = this._pendingCommand.buffer;

    // Check if response is complete based on command type
    if (this._isResponseComplete(this._pendingCommand.command, response)) {
      // Clear timeout and resolve
      clearTimeout(this._pendingCommand.timeoutId);
      const resolvedResponse = response.trim();
      const pendingResolve = this._pendingCommand.resolve;
      this._pendingCommand = null;
      pendingResolve(resolvedResponse);
    }
  }

  /**
   * Check if a response is complete based on the command type.
   */
  private _isResponseComplete(command: string, response: string): boolean {
    const trimmed = response.trim();
    const lower = trimmed.toLowerCase();

    // GRBL status query (?) ends with >
    if (command === '?') {
      return trimmed.endsWith('>');
    }

    // GRBL real-time commands (!, ~, Ctrl-X) - these typically have no response
    // We shouldn't be using sendCommand() for these anyway, but handle gracefully
    const isGrblRealtime = ['!', '~', '\x18'].includes(command);
    if (isGrblRealtime) {
      // Only complete if we get 'ok', otherwise timeout will handle it
      return lower.includes('ok');
    }

    // GRBL/G-code commands - wait for ok, error, or alarm
    const isGrblCommand = command.startsWith('$') || command.startsWith('G') || command.startsWith('M');
    if (isGrblCommand) {
      return lower.includes('ok') || lower.includes('error:') || lower.includes('alarm:');
    }

    // EBB/legacy commands - wait for proper line ending
    return response.endsWith('\r\n') || response.endsWith('OK\r');
  }

  // === Character-Counting Streaming Protocol ===
  // See: https://github.com/gnea/grbl/wiki/Grbl-v1.1-Interface

  /**
   * Stream a G-code command using character-counting protocol.
   * This method only blocks if the RX buffer is too full.
   * Much faster than sendCommand() for continuous motion commands.
   */
  async streamGcode(command: string): Promise<void> {
    if (!this.isConnected || !this._port) {
      throw createSerialError(
        'DEVICE_DISCONNECTED',
        'Not connected',
        'Cannot stream command: not connected to plotter.'
      );
    }

    // Cannot use streaming while a regular command is pending
    if (this._pendingCommand) {
      throw createSerialError(
        'INVALID_RESPONSE',
        'Command in progress',
        'Cannot stream while a blocking command is pending. Use sendCommand() or streaming, not both.'
      );
    }

    // Enable streaming mode
    this._streamingEnabled = true;

    const cmdToSend = `${command}\n`;
    const charCount = cmdToSend.length;

    // Wait if buffer would overflow
    while (this._streamBufferUsed + charCount > GRBL_RX_BUFFER_SIZE) {
      // Wait for at least one response to free buffer space
      await this._waitForStreamResponse();
    }

    // Send command and track buffer usage
    this._streamQueue.push({ command, charCount });
    this._streamBufferUsed += charCount;

    try {
      await this._port.write(cmdToSend);
    } catch (err) {
      // Remove from queue on send failure
      this._streamQueue.pop();
      this._streamBufferUsed -= charCount;
      throw createSerialError(
        'INVALID_RESPONSE',
        'Write failed',
        `Failed to stream command: ${err}`
      );
    }
  }

  /**
   * Wait for all streamed commands to complete.
   */
  async waitForStreamComplete(timeoutMs: number = 60000): Promise<void> {
    if (!this._streamingEnabled || this._streamQueue.length === 0) {
      this._streamingEnabled = false;
      return;
    }

    const startTime = Date.now();

    while (this._streamQueue.length > 0) {
      if (Date.now() - startTime > timeoutMs) {
        throw createSerialError(
          'RESPONSE_TIMEOUT',
          'Stream timeout',
          `Timeout waiting for ${this._streamQueue.length} commands to complete`
        );
      }
      await this._waitForStreamResponse();
    }

    this._streamingEnabled = false;
  }

  /**
   * Get current streaming buffer status.
   */
  getStreamingStatus(): { bufferUsed: number; bufferMax: number; pendingCommands: number } | undefined {
    if (!this._streamingEnabled) {
      return undefined;
    }
    return {
      bufferUsed: this._streamBufferUsed,
      bufferMax: GRBL_RX_BUFFER_SIZE,
      pendingCommands: this._streamQueue.length,
    };
  }

  /**
   * Wait for a single streaming response.
   */
  private _waitForStreamResponse(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Set a timeout
      const timeoutId = setTimeout(() => {
        const idx = this._streamWaiters.findIndex(w => w.resolve === resolve);
        if (idx >= 0) {
          this._streamWaiters.splice(idx, 1);
        }
        reject(createSerialError(
          'RESPONSE_TIMEOUT',
          'Stream response timeout',
          'Timeout waiting for GRBL response during streaming'
        ));
      }, 10000);

      this._streamWaiters.push({
        resolve: () => {
          clearTimeout(timeoutId);
          resolve();
        },
        reject: (err) => {
          clearTimeout(timeoutId);
          reject(err);
        },
      });
    });
  }

  /**
   * Process streaming response data.
   * Called from _handleIncomingData when in streaming mode.
   */
  private _processStreamingResponse(data: string): void {
    this._streamResponseBuffer += data;

    // Process complete responses (ok, error:X, ALARM:X)
    const lines = this._streamResponseBuffer.split('\n');

    // Keep incomplete line in buffer
    this._streamResponseBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const lower = trimmed.toLowerCase();

      if (lower === 'ok') {
        // Command completed successfully - free buffer space
        if (this._streamQueue.length > 0) {
          const completed = this._streamQueue.shift()!;
          this._streamBufferUsed -= completed.charCount;

          // Notify one waiter
          if (this._streamWaiters.length > 0) {
            const waiter = this._streamWaiters.shift()!;
            waiter.resolve();
          }
        }
      } else if (lower.startsWith('error:')) {
        // Error response - free buffer space but log warning
        console.warn('[TauriSerial] Streaming error:', trimmed);
        if (this._streamQueue.length > 0) {
          const failed = this._streamQueue.shift()!;
          this._streamBufferUsed -= failed.charCount;
          console.warn('[TauriSerial] Failed command:', failed.command);

          // Still notify waiter (let higher level handle errors)
          if (this._streamWaiters.length > 0) {
            const waiter = this._streamWaiters.shift()!;
            waiter.resolve();  // Resolve, don't reject - error handling is at higher level
          }
        }
      } else if (lower.startsWith('alarm:')) {
        // Alarm - reject all waiters
        console.error('[TauriSerial] ALARM during streaming:', trimmed);
        const err = createSerialError('COMMAND_REJECTED', 'GRBL Alarm', trimmed);
        for (const waiter of this._streamWaiters) {
          waiter.reject(err as unknown as Error);
        }
        this._streamWaiters = [];
        this._streamQueue = [];
        this._streamBufferUsed = 0;
      }
      // Ignore status responses (<...>) and other messages during streaming
    }
  }
}

// Singleton instance
let _defaultConnection: TauriSerialConnection | null = null;

export function getTauriSerialConnection(): TauriSerialConnection {
  if (!_defaultConnection) {
    _defaultConnection = new TauriSerialConnection();
  }
  return _defaultConnection;
}
