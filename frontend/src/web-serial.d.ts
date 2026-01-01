/**
 * Type declarations for the Web Serial API
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API
 * @see https://wicg.github.io/serial/
 */

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;

  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;

  addEventListener(type: 'connect', listener: (this: SerialPort, ev: Event) => void): void;
  addEventListener(type: 'disconnect', listener: (this: SerialPort, ev: Event) => void): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;

  removeEventListener(type: 'connect', listener: (this: SerialPort, ev: Event) => void): void;
  removeEventListener(type: 'disconnect', listener: (this: SerialPort, ev: Event) => void): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

interface Serial extends EventTarget {
  getPorts(): Promise<SerialPort[]>;
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;

  addEventListener(type: 'connect', listener: (this: Serial, ev: Event) => void): void;
  addEventListener(type: 'disconnect', listener: (this: Serial, ev: Event) => void): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;

  removeEventListener(type: 'connect', listener: (this: Serial, ev: Event) => void): void;
  removeEventListener(type: 'disconnect', listener: (this: Serial, ev: Event) => void): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

interface Navigator {
  readonly serial: Serial;
}
