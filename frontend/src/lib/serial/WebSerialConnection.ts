/**
 * Web Serial API implementation for browser-based serial communication.
 *
 * This implementation uses the Web Serial API available in Chrome/Edge browsers
 * to connect directly to USB serial devices like the iDraw plotter.
 *
 * Browser support: Chrome 89+, Edge 89+, Opera 76+
 * NOT supported: Firefox, Safari (requires Tauri desktop app)
 *
 * @see https://developer.chrome.com/docs/capabilities/serial
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

/** Check if Web Serial API is available */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * Web Serial API-based serial connection.
 *
 * Uses the browser's native Web Serial API to communicate with USB serial devices.
 * Requires user gesture to request port access (security requirement).
 */
export class WebSerialConnection implements ISerialConnection {
  private _state: ConnectionState = 'disconnected';
  private _port: SerialPort | null = null;
  private _portPath: string | null = null;
  private _reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private _writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private _options: Required<SerialConnectionOptions> = { ...DEFAULT_SERIAL_OPTIONS };
  private _eventHandlers: SerialConnectionEvents = {};
  private _readBuffer: string = '';
  private _readLoopActive: boolean = false;

  // Encoder/decoder for text conversion
  private readonly _encoder = new TextEncoder();
  private readonly _decoder = new TextDecoder();

  get state(): ConnectionState {
    return this._state;
  }

  get portPath(): string | null {
    return this._portPath;
  }

  get isConnected(): boolean {
    return this._state === 'connected' && this._port !== null;
  }

  /**
   * List available serial ports that user has previously granted access to.
   *
   * Note: Web Serial API can only enumerate ports the user has already granted.
   * To discover new ports, use requestPort() which shows a browser picker.
   */
  async listPorts(): Promise<SerialPortInfo[]> {
    if (!isWebSerialSupported()) {
      throw createSerialError(
        'BROWSER_NOT_SUPPORTED',
        'Web Serial API not supported',
        'Your browser does not support the Web Serial API. Please use Chrome, Edge, or download the desktop app for Safari.'
      );
    }

    const ports = await navigator.serial.getPorts();
    return ports.map((port) => this._portToInfo(port));
  }

  /**
   * Find a compatible plotter port.
   *
   * First checks previously granted ports, then prompts user to select if none found.
   */
  async findPlotterPort(): Promise<string | null> {
    if (!isWebSerialSupported()) {
      return null;
    }

    // Check previously granted ports
    const ports = await navigator.serial.getPorts();
    for (const port of ports) {
      const info = port.getInfo();
      for (const device of SUPPORTED_DEVICES) {
        if (info.usbVendorId === device.vid && info.usbProductId === device.pid) {
          // Return a reference identifier (Web Serial doesn't have paths)
          return `webserial:${device.name}:${info.usbVendorId}:${info.usbProductId}`;
        }
      }
    }

    return null;
  }

  /**
   * Request user to select a serial port.
   *
   * This must be called from a user gesture (click, keypress) due to Web Serial security.
   * Shows a browser-native port picker dialog.
   */
  async requestPort(): Promise<SerialPort> {
    if (!isWebSerialSupported()) {
      throw createSerialError(
        'BROWSER_NOT_SUPPORTED',
        'Web Serial API not supported',
        'Your browser does not support the Web Serial API.'
      );
    }

    try {
      // Filter to only show compatible devices in the picker
      const port = await navigator.serial.requestPort({
        filters: SUPPORTED_DEVICES.map((d) => ({
          usbVendorId: d.vid,
          usbProductId: d.pid,
        })),
      });
      return port;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        throw createSerialError(
          'USER_CANCELLED',
          'Port selection cancelled',
          'No port was selected. Please try again and select your plotter.'
        );
      }
      throw err;
    }
  }

  async connect(port?: string, options?: SerialConnectionOptions): Promise<void> {
    if (!isWebSerialSupported()) {
      throw createSerialError(
        'BROWSER_NOT_SUPPORTED',
        'Web Serial API not supported',
        'Please use Chrome, Edge, or download the desktop app.'
      );
    }

    if (this.isConnected) {
      return; // Already connected
    }

    this._state = 'connecting';
    this._options = { ...DEFAULT_SERIAL_OPTIONS, ...options };

    try {
      let serialPort: SerialPort;

      if (port) {
        // Try to find a previously granted port matching the identifier
        const ports = await navigator.serial.getPorts();
        const found = ports.find((p) => {
          const info = p.getInfo();
          return port.includes(`${info.usbVendorId}:${info.usbProductId}`);
        });

        if (found) {
          serialPort = found;
        } else {
          // Need to request a new port
          serialPort = await this.requestPort();
        }
      } else {
        // Auto-detect: check granted ports first, then request
        const foundPath = await this.findPlotterPort();
        if (foundPath) {
          const ports = await navigator.serial.getPorts();
          const found = ports.find((p) => {
            const info = p.getInfo();
            return foundPath.includes(`${info.usbVendorId}:${info.usbProductId}`);
          });
          if (found) {
            serialPort = found;
          } else {
            serialPort = await this.requestPort();
          }
        } else {
          serialPort = await this.requestPort();
        }
      }

      // Open the port
      await serialPort.open({
        baudRate: this._options.baudRate,
      });

      this._port = serialPort;
      const info = serialPort.getInfo();
      this._portPath = `webserial:${info.usbVendorId}:${info.usbProductId}`;

      // Set up reader and writer
      if (serialPort.readable && serialPort.writable) {
        this._reader = serialPort.readable.getReader();
        this._writer = serialPort.writable.getWriter();
      } else {
        throw new Error('Port streams not available');
      }

      // Start read loop
      this._startReadLoop();

      // Verify connection by sending identification command
      const verified = await this._verifyConnection();
      if (!verified) {
        await this.disconnect();
        throw createSerialError(
          'NOT_RESPONDING',
          'Plotter connected but not responding',
          'The device was found but is not responding. Check that the plotter is powered on.'
        );
      }

      this._state = 'connected';
      this._eventHandlers.onConnect?.();

      // Set up disconnect detection
      serialPort.addEventListener('disconnect', () => {
        this._handleDisconnect();
      });
    } catch (err) {
      this._state = 'error';
      if (err instanceof DOMException) {
        if (err.name === 'SecurityError') {
          throw createSerialError(
            'PERMISSION_DENIED',
            'Permission denied',
            'Access to the serial port was denied. This may be due to browser security restrictions.',
            undefined,
            err
          );
        }
        if (err.name === 'InvalidStateError') {
          throw createSerialError(
            'PORT_IN_USE',
            'Port already in use',
            'The serial port is already open in another tab or application.',
            undefined,
            err
          );
        }
      }
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this._readLoopActive = false;

    try {
      if (this._reader) {
        await this._reader.cancel();
        this._reader.releaseLock();
        this._reader = null;
      }

      if (this._writer) {
        await this._writer.close();
        this._writer.releaseLock();
        this._writer = null;
      }

      if (this._port) {
        await this._port.close();
        this._port = null;
      }
    } catch (err) {
      // Ignore errors during cleanup
      console.warn('Error during disconnect:', err);
    }

    this._state = 'disconnected';
    this._portPath = null;
    this._readBuffer = '';
  }

  async sendCommand(command: string, timeout: number = 5000): Promise<string> {
    if (!this.isConnected || !this._writer) {
      throw createSerialError(
        'DEVICE_DISCONNECTED',
        'Not connected',
        'Cannot send command: not connected to plotter.'
      );
    }

    // Determine command type for response parsing
    const isGrblStatusQuery = command === '?';
    const isGrblRealtime = ['?', '!', '~', '\x18'].includes(command);
    const isGrblCommand = command.startsWith('$') || command.startsWith('G') || command.startsWith('M') || isGrblRealtime;

    // Clear read buffer
    this._readBuffer = '';

    // Send command with appropriate line ending
    let cmdBytes: Uint8Array;
    if (isGrblRealtime) {
      cmdBytes = this._encoder.encode(command);
    } else if (isGrblCommand) {
      cmdBytes = this._encoder.encode(`${command}\n`);
    } else {
      cmdBytes = this._encoder.encode(`${command}\r`);
    }

    await this._writer.write(cmdBytes);

    // Wait for response
    const startTime = Date.now();
    while (true) {
      const response = this._readBuffer.trim();

      // Check for complete response based on protocol
      if (isGrblStatusQuery) {
        if (response.endsWith('>')) {
          return response;
        }
      } else if (isGrblCommand) {
        if (response.toLowerCase().includes('ok') ||
            response.toLowerCase().includes('error:') ||
            response.toLowerCase().includes('alarm:')) {
          return response;
        }
      } else {
        // EBB legacy response
        if (response.endsWith('\r\n') || response.includes('OK')) {
          return response;
        }
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        throw createSerialError(
          'RESPONSE_TIMEOUT',
          'Response timeout',
          `No response received within ${timeout}ms`,
          { command, partialResponse: response }
        );
      }

      // Small delay before checking again
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  async sendCommandNoResponse(command: string): Promise<void> {
    if (!this.isConnected || !this._writer) {
      throw createSerialError(
        'DEVICE_DISCONNECTED',
        'Not connected',
        'Cannot send command: not connected to plotter.'
      );
    }

    // Real-time commands don't need line ending
    const isRealtime = ['!', '~', '?', '\x18'].includes(command);
    let cmdBytes: Uint8Array;

    if (isRealtime) {
      cmdBytes = this._encoder.encode(command);
    } else {
      const isGrbl = command.startsWith('$') || command.startsWith('G') || command.startsWith('M');
      const terminator = isGrbl ? '\n' : '\r';
      cmdBytes = this._encoder.encode(`${command}${terminator}`);
    }

    await this._writer.write(cmdBytes);
  }

  setEventHandlers(events: SerialConnectionEvents): void {
    this._eventHandlers = { ...this._eventHandlers, ...events };
  }

  // === Private Methods ===

  private _portToInfo(port: SerialPort): SerialPortInfo {
    const info = port.getInfo();
    let isCompatible = false;
    let deviceName: string | undefined;

    for (const device of SUPPORTED_DEVICES) {
      if (info.usbVendorId === device.vid && info.usbProductId === device.pid) {
        isCompatible = true;
        deviceName = device.name;
        break;
      }
    }

    return {
      path: `webserial:${info.usbVendorId ?? 'unknown'}:${info.usbProductId ?? 'unknown'}`,
      description: deviceName ?? 'Unknown Device',
      hwid: `VID:${info.usbVendorId?.toString(16)} PID:${info.usbProductId?.toString(16)}`,
      isCompatible,
      deviceName,
    };
  }

  private async _startReadLoop(): Promise<void> {
    if (!this._reader) return;

    this._readLoopActive = true;

    try {
      while (this._readLoopActive && this._reader) {
        const { value, done } = await this._reader.read();

        if (done) {
          break;
        }

        if (value) {
          const text = this._decoder.decode(value);
          this._readBuffer += text;
          this._eventHandlers.onData?.(text);
        }
      }
    } catch (err) {
      if (this._readLoopActive) {
        // Unexpected error during read
        console.error('Read loop error:', err);
        this._handleDisconnect();
      }
    }
  }

  private async _verifyConnection(): Promise<boolean> {
    try {
      // Try GRBL identification first
      const response = await this.sendCommand('$I', 3000);
      if (response && response.length > 0) {
        console.log('GRBL device identified:', response);
        return true;
      }
    } catch {
      // Try EBB version command as fallback
      try {
        const response = await this.sendCommand('V', 3000);
        if (response && response.length > 0) {
          console.log('EBB device identified:', response);
          return true;
        }
      } catch {
        // Both failed
      }
    }
    return false;
  }

  private _handleDisconnect(): void {
    this._state = 'disconnected';
    this._readLoopActive = false;
    this._port = null;
    this._reader = null;
    this._writer = null;
    this._portPath = null;

    this._eventHandlers.onDisconnect?.();
    this._eventHandlers.onError?.(
      createSerialError(
        'DEVICE_DISCONNECTED',
        'USB connection lost',
        'The plotter was unexpectedly disconnected.'
      )
    );
  }
}

// Singleton instance for convenience
let _defaultConnection: WebSerialConnection | null = null;

export function getWebSerialConnection(): WebSerialConnection {
  if (!_defaultConnection) {
    _defaultConnection = new WebSerialConnection();
  }
  return _defaultConnection;
}
