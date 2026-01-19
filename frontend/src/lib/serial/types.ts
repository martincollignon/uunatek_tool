/**
 * Serial connection abstraction types.
 *
 * This module defines the interface that both Web Serial API and Tauri serial plugin
 * implementations must conform to, enabling the same frontend code to work in both
 * browser and desktop environments.
 */

/** Supported device identifiers for auto-detection */
export interface SupportedDevice {
  vid: number;  // USB Vendor ID
  pid: number;  // USB Product ID
  name: string; // Human-readable name
}

/** Information about an available serial port */
export interface SerialPortInfo {
  path: string;           // Device path (e.g., /dev/tty.usbserial-1234)
  description: string;    // Device description
  hwid?: string;         // Hardware ID string
  isCompatible: boolean;  // Whether device matches known plotter hardware
  deviceName?: string;    // Name of detected device (e.g., "CH340", "EiBotBoard")
}

/** Connection state */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Serial connection events */
export interface SerialConnectionEvents {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: SerialError) => void;
  onData?: (data: string) => void;
}

/** Error codes for serial operations */
export type SerialErrorCode =
  | 'NO_DEVICE_FOUND'      // PLT-C001
  | 'PORT_IN_USE'          // PLT-C002
  | 'PERMISSION_DENIED'    // PLT-C003
  | 'DEVICE_DISCONNECTED'  // PLT-C004
  | 'NOT_RESPONDING'       // PLT-C005
  | 'RESPONSE_TIMEOUT'     // PLT-X001
  | 'INVALID_RESPONSE'     // PLT-X002
  | 'COMMAND_REJECTED'     // PLT-X003
  | 'BROWSER_NOT_SUPPORTED'// Web Serial not available
  | 'USER_CANCELLED';      // User cancelled port selection

/** Serial operation error */
export interface SerialError {
  code: SerialErrorCode;
  message: string;
  detail?: string;
  context?: Record<string, unknown>;
  cause?: Error;
}

/** Serial connection options */
export interface SerialConnectionOptions {
  baudRate?: number;       // Default: 115200
  timeout?: number;        // Default: 1000ms
  autoReconnect?: boolean; // Default: false
}

/**
 * Abstract serial connection interface.
 *
 * Both WebSerialConnection and TauriSerialConnection must implement this interface.
 */
export interface ISerialConnection {
  /** Current connection state */
  readonly state: ConnectionState;

  /** Currently connected port path (if any) */
  readonly portPath: string | null;

  /** Whether the connection is active */
  readonly isConnected: boolean;

  /**
   * List available serial ports.
   * @returns Promise resolving to array of port info objects
   */
  listPorts(): Promise<SerialPortInfo[]>;

  /**
   * Find a compatible plotter port automatically.
   * @returns Promise resolving to port path, or null if not found
   */
  findPlotterPort(): Promise<string | null>;

  /**
   * Connect to a serial port.
   * @param port - Port path to connect to. If not provided, auto-detects.
   * @param options - Connection options
   * @throws SerialError on failure
   */
  connect(port?: string, options?: SerialConnectionOptions): Promise<void>;

  /**
   * Disconnect from the current port.
   */
  disconnect(): Promise<void>;

  /**
   * Send a command and wait for response.
   * @param command - Command string to send (without line terminator)
   * @param timeout - Response timeout in milliseconds (default: 5000)
   * @returns Promise resolving to response string
   * @throws SerialError on timeout or communication error
   */
  sendCommand(command: string, timeout?: number): Promise<string>;

  /**
   * Send a command without waiting for response.
   * Used for real-time commands like GRBL's !, ~, ?, Ctrl-X.
   * @param command - Command to send
   */
  sendCommandNoResponse(command: string): Promise<void>;

  /**
   * Stream a G-code command using character-counting protocol.
   * This method only blocks if the RX buffer is too full.
   * Much faster than sendCommand() for continuous motion commands.
   * @param command - G-code command to stream
   * @returns Promise that resolves when command is sent (not when executed)
   */
  streamGcode?(command: string): Promise<void>;

  /**
   * Wait for all streamed commands to complete.
   * Call this after streaming to ensure all commands have been executed.
   * @param timeoutMs - Maximum time to wait
   */
  waitForStreamComplete?(timeoutMs?: number): Promise<void>;

  /**
   * Get current streaming buffer status.
   * @returns Object with buffer usage info, or undefined if not streaming
   */
  getStreamingStatus?(): { bufferUsed: number; bufferMax: number; pendingCommands: number } | undefined;

  /**
   * Set event handlers for connection events.
   * @param events - Event handler callbacks
   */
  setEventHandlers(events: SerialConnectionEvents): void;
}

/** USB Vendor/Product IDs for supported devices */
export const SUPPORTED_DEVICES: SupportedDevice[] = [
  { vid: 0x1A86, pid: 0x7523, name: 'CH340' },     // iDraw CH340
  { vid: 0x1A86, pid: 0x8040, name: 'CH340K' },    // iDraw CH340K
  { vid: 0x04D8, pid: 0xFD92, name: 'EiBotBoard' }, // AxiDraw
];

/** Default serial connection settings */
export const DEFAULT_SERIAL_OPTIONS: Required<SerialConnectionOptions> = {
  baudRate: 115200,
  timeout: 3000, // Increased from 1000ms for CH340 chip stability
  autoReconnect: false,
};

/**
 * Create a SerialError object.
 */
export function createSerialError(
  code: SerialErrorCode,
  message: string,
  detail?: string,
  context?: Record<string, unknown>,
  cause?: Error
): SerialError {
  return { code, message, detail, context, cause };
}

/**
 * Check if an error is a SerialError.
 */
export function isSerialError(error: unknown): error is SerialError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}
