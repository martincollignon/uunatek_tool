/**
 * GRBL types and interfaces.
 *
 * Defines types for GRBL controller state, status, and commands.
 */

/** GRBL machine states */
export type GRBLState =
  | 'Idle'
  | 'Run'
  | 'Hold'
  | 'Jog'
  | 'Alarm'
  | 'Door'
  | 'Check'
  | 'Home'
  | 'Sleep'
  | 'Unknown';

/** Pen state */
export type PenState = 'up' | 'down' | 'unknown';

/** Parsed GRBL status response */
export interface GRBLStatus {
  state: GRBLState;
  machineX: number;
  machineY: number;
  machineZ: number;
  feedRate: number;
  spindleSpeed: number;
  workX?: number;
  workY?: number;
  workZ?: number;
  pins?: string;  // Triggered pin states (X, Y, Z, P, D, H, R, S)
}

/** GRBL error codes */
export interface GRBLError {
  code: string;
  grblErrorCode?: string;
  alarmCode?: string;
  command?: string;
  response?: string;
  message: string;
}

/** Machine limits for iDraw 2.0 */
export const MACHINE_LIMITS = {
  MAX_X_MM: 297.0,    // A3 width (GRBL $130)
  MAX_Y_MM: 420.0,    // A3 height (GRBL $131)
  MIN_Y_MM: -420.0,   // Front edge (negative Y toward front)
  MAX_Z_MM: 10.0,
} as const;

/** Pen heights (Z-axis positions in mm) */
export const PEN_HEIGHTS = {
  UP: 0.0,     // Z position for pen up
  DOWN: 5.0,   // Z position for pen down (DrawCore: higher Z = pen down)
} as const;

/** Speed limits (mm/min) */
export const SPEED_LIMITS = {
  MAX_FEED_RATE: 2500.0,
  MIN_FEED_RATE: 50.0,
  DEFAULT_RAPID_SPEED: 2500.0,   // G00 moves (pen up travel)
  DEFAULT_DRAW_SPEED: 2000.0,    // G01 moves (pen down drawing)
} as const;

/** Steps per mm for iDraw 2.0 (from GRBL $100/$101) */
export const STEPS_PER_MM = 80;

/** Plot command types */
export type PlotCommandType = 'move' | 'line' | 'pen_up' | 'pen_down';

/** A single plot command */
export interface PlotCommand {
  type: PlotCommandType;
  x?: number;  // mm
  y?: number;  // mm
}

/** Plot execution state */
export type PlotState =
  | 'idle'
  | 'plotting'
  | 'paused'
  | 'completed'
  | 'error'
  | 'cancelled';

/** Plot progress information */
export interface PlotProgress {
  state: PlotState;
  currentCommand: number;
  totalCommands: number;
  percentage: number;
  currentSide?: string;
  errorMessage?: string;
  errorCode?: string;
}

/** Paper size configurations */
export interface PaperConfig {
  name: string;
  width: number;   // mm
  height: number;  // mm
  topRightX: number;   // Machine X at paper top-right
  topRightY: number;   // Machine Y at paper top-right
}

/** Predefined paper configurations */
export const PAPER_CONFIGS: Record<string, PaperConfig> = {
  A4: {
    name: 'A4',
    width: 210,
    height: 297,
    topRightX: 290.0,
    topRightY: 0.0,
  },
  A3: {
    name: 'A3',
    width: 297,
    height: 420,
    topRightX: 290.0,
    topRightY: 0.0,
  },
};
