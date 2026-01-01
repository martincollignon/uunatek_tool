/**
 * Serial connection module.
 *
 * Provides a unified interface for serial communication that works in both
 * browser (Web Serial API) and desktop (Tauri) environments.
 */

export * from './types';
export { WebSerialConnection, isWebSerialSupported, getWebSerialConnection } from './WebSerialConnection';
export { TauriSerialConnection, isTauriEnvironment, getTauriSerialConnection } from './TauriSerialConnection';

// Re-export types for convenience
export type {
  ISerialConnection,
  SerialPortInfo,
  ConnectionState,
  SerialConnectionEvents,
  SerialConnectionOptions,
  SerialError,
  SerialErrorCode,
  SupportedDevice,
} from './types';

import { ISerialConnection } from './types';
import { WebSerialConnection, isWebSerialSupported } from './WebSerialConnection';
import { TauriSerialConnection, isTauriEnvironment } from './TauriSerialConnection';

/**
 * Detect the runtime environment and return appropriate connection type.
 */
export type RuntimeEnvironment = 'web' | 'tauri' | 'unsupported';

export function detectEnvironment(): RuntimeEnvironment {
  // Check for Tauri first (takes priority)
  if (isTauriEnvironment()) {
    return 'tauri';
  }

  // Check for Web Serial support
  if (isWebSerialSupported()) {
    return 'web';
  }

  return 'unsupported';
}

/**
 * Create a serial connection appropriate for the current environment.
 *
 * @returns ISerialConnection instance
 * @throws Error if no supported environment detected
 */
export function createSerialConnection(): ISerialConnection {
  const env = detectEnvironment();

  switch (env) {
    case 'tauri':
      return new TauriSerialConnection();

    case 'web':
      return new WebSerialConnection();

    case 'unsupported':
    default:
      throw new Error(
        'Serial communication not supported in this browser. ' +
        'Please use Chrome, Edge, or download the desktop app.'
      );
  }
}

/**
 * Check if serial communication is available in the current environment.
 */
export function isSerialAvailable(): boolean {
  return detectEnvironment() !== 'unsupported';
}

/**
 * Get a human-readable message about serial support in current environment.
 */
export function getSerialSupportMessage(): string {
  const env = detectEnvironment();

  switch (env) {
    case 'tauri':
      return 'Using Tauri native serial (desktop app)';
    case 'web':
      return 'Using Web Serial API (Chrome/Edge)';
    case 'unsupported':
      return 'Serial not supported - please use Chrome, Edge, or download the desktop app';
  }
}
