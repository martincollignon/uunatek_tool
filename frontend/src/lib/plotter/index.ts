/**
 * Plotter module.
 *
 * High-level plotter service and utilities.
 */

export { PlotterService, getPlotterService } from './PlotterService';
export type {
  PlotterStatus,
  PlotterServiceState,
  PlotterServiceEvents,
} from './PlotterService';

// SVG conversion utilities
export {
  svgToPlotCommands,
  fabricCanvasToPlotCommands,
} from './svgToCommands';
export type { SvgToCommandsOptions } from './svgToCommands';

// Re-export useful types from grbl
export type { PlotCommand, PlotProgress, PlotState } from '../grbl';
