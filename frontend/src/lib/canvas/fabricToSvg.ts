/**
 * Convert Fabric.js canvas JSON to SVG
 * This replaces the backend API call for SVG export
 */

import { Canvas } from 'fabric';

export interface SvgExportResult {
  svg: string;
  warnings: string[];
}

// Scale factor used in the editor canvas (pixels per mm)
// This must match the SCALE constant in FabricCanvas.tsx
const EDITOR_SCALE = 3;

/**
 * Export Fabric canvas JSON to SVG string
 */
export async function fabricCanvasToSvg(
  canvasJson: Record<string, unknown>,
  widthMm: number,
  heightMm: number
): Promise<SvgExportResult> {
  const warnings: string[] = [];

  try {
    // The canvas JSON contains objects in pixel coordinates (scaled by EDITOR_SCALE)
    // We need to create a temp canvas with the same pixel dimensions
    const widthPx = widthMm * EDITOR_SCALE;
    const heightPx = heightMm * EDITOR_SCALE;

    console.log('[fabricToSvg] Creating temp canvas:', widthPx, 'x', heightPx, 'px');
    console.log('[fabricToSvg] Target dimensions:', widthMm, 'x', heightMm, 'mm');

    // Create an offscreen canvas element
    // For Fabric 7.x: Set ONLY element dimensions, NOT style
    const canvasElement = document.createElement('canvas');
    canvasElement.width = widthPx;
    canvasElement.height = heightPx;

    // Create a temporary canvas to load the JSON with pixel dimensions
    const tempCanvas = new Canvas(canvasElement, {
      width: widthPx,
      height: heightPx,
    });

    // Load the canvas JSON
    await tempCanvas.loadFromJSON(canvasJson);

    // Check for unsupported features
    tempCanvas.getObjects().forEach((obj: any) => {
      if (obj.type === 'image' && obj.filters && obj.filters.length > 0) {
        warnings.push('Image filters may not render correctly in SVG export');
      }
      if (obj.shadow) {
        warnings.push('Shadows are not supported in plotter output');
      }
      if (obj.fill && typeof obj.fill === 'object' && obj.fill.type === 'gradient') {
        warnings.push('Gradients are not supported in plotter output');
      }
    });

    // Export to SVG with mm dimensions for plotter, but px viewBox for coordinate system
    // The viewBox uses pixel coordinates (matching our EDITOR_SCALE)
    // The width/height are in mm (the actual paper size for plotting)
    // The plotter reads the viewBox dimensions and scales to mm
    console.log('[fabricToSvg] Exporting with viewBox:', widthPx, 'x', heightPx, 'px');
    console.log('[fabricToSvg] SVG dimensions:', widthMm, 'x', heightMm, 'mm');

    const svg = tempCanvas.toSVG({
      suppressPreamble: false,
      width: `${widthMm}mm`,
      height: `${heightMm}mm`,
      viewBox: {
        x: 0,
        y: 0,
        width: widthPx,
        height: heightPx,
      },
    });

    // Clean up
    tempCanvas.dispose();

    return {
      svg,
      warnings,
    };
  } catch (error) {
    console.error('Error exporting canvas to SVG:', error);
    throw new Error('Failed to export canvas to SVG');
  }
}

/**
 * Export canvas with paper dimensions from project
 */
export async function exportCanvasSvg(
  canvasJson: Record<string, unknown> | null,
  paperWidthMm: number,
  paperHeightMm: number
): Promise<SvgExportResult> {
  if (!canvasJson) {
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${paperWidthMm}" height="${paperHeightMm}"><rect width="100%" height="100%" fill="white"/></svg>`,
      warnings: ['No canvas data available'],
    };
  }

  return fabricCanvasToSvg(canvasJson, paperWidthMm, paperHeightMm);
}
