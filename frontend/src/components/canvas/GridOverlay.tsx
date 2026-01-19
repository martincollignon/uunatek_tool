import { useEffect, useRef } from 'react';
import type { Canvas, FabricObject } from 'fabric';

export interface GridConfig {
  enabled: boolean;
  spacing: number; // in mm (1, 5, or 10)
  snapEnabled: boolean;
  color: string;
  opacity: number;
}

interface GridOverlayProps {
  canvas: Canvas | null;
  config: GridConfig;
  canvasWidthMm: number;
  canvasHeightMm: number;
  pixelsPerMm: number;
  zoom: number;
  isRotated?: boolean;
}

export function GridOverlay({
  canvas,
  config,
  canvasWidthMm,
  canvasHeightMm,
  pixelsPerMm,
  zoom,
  isRotated = false
}: GridOverlayProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const snapThreshold = 5; // pixels

  // Draw grid on overlay canvas
  useEffect(() => {
    const overlayCanvas = overlayRef.current;
    if (!overlayCanvas || !config.enabled) return;

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Calculate grid spacing in pixels
    const spacingPx = config.spacing * pixelsPerMm * zoom;

    // Set grid style
    ctx.strokeStyle = config.color;
    ctx.globalAlpha = config.opacity;
    ctx.lineWidth = 1;

    // Draw vertical lines - when rotated, the grid orientation swaps
    const verticalDimension = isRotated ? canvasHeightMm : canvasWidthMm;
    const numVerticalLines = Math.ceil(verticalDimension / config.spacing);
    for (let i = 0; i <= numVerticalLines; i++) {
      const x = i * spacingPx;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, overlayCanvas.height);
      ctx.stroke();
    }

    // Draw horizontal lines - when rotated, the grid orientation swaps
    const horizontalDimension = isRotated ? canvasWidthMm : canvasHeightMm;
    const numHorizontalLines = Math.ceil(horizontalDimension / config.spacing);
    for (let i = 0; i <= numHorizontalLines; i++) {
      const y = i * spacingPx;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(overlayCanvas.width, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }, [config, canvasWidthMm, canvasHeightMm, pixelsPerMm, zoom, isRotated]);

  // Setup snap-to-grid functionality
  useEffect(() => {
    if (!canvas || !config.enabled || !config.snapEnabled) return;

    const gridSizePx = config.spacing * pixelsPerMm;

    // Track if object is currently snapped to prevent jitter
    const snappedObjects = new WeakMap<FabricObject, { x: number; y: number }>();

    const snapToGrid = (value: number): number => {
      return Math.round(value / gridSizePx) * gridSizePx;
    };

    const handleObjectMoving = (e: any) => {
      const obj = e.target as FabricObject;
      if (!obj) return;

      const left = obj.left || 0;
      const top = obj.top || 0;

      // Find the nearest grid point
      const snappedLeft = snapToGrid(left);
      const snappedTop = snapToGrid(top);

      // Calculate distance to nearest grid point
      const distanceLeft = Math.abs(left - snappedLeft);
      const distanceTop = Math.abs(top - snappedTop);

      // Check if object was previously snapped
      const wasSnapped = snappedObjects.get(obj);

      // Use smaller snap distance and larger break-away distance to prevent jitter
      const snapDistance = gridSizePx * 0.15; // Snap when within 15% of grid spacing
      const breakAwayDistance = gridSizePx * 0.4; // Need to move 40% away to break snap

      let newLeft = left;
      let newTop = top;
      let isSnappedX = false;
      let isSnappedY = false;

      // Handle X-axis snapping
      if (wasSnapped && Math.abs(wasSnapped.x - left) < breakAwayDistance) {
        // Stay snapped until user moves far enough away
        newLeft = wasSnapped.x;
        isSnappedX = true;
      } else if (distanceLeft <= snapDistance) {
        // Snap to grid
        newLeft = snappedLeft;
        isSnappedX = true;
      }

      // Handle Y-axis snapping
      if (wasSnapped && Math.abs(wasSnapped.y - top) < breakAwayDistance) {
        // Stay snapped until user moves far enough away
        newTop = wasSnapped.y;
        isSnappedY = true;
      } else if (distanceTop <= snapDistance) {
        // Snap to grid
        newTop = snappedTop;
        isSnappedY = true;
      }

      // Update snap tracking
      if (isSnappedX || isSnappedY) {
        snappedObjects.set(obj, { x: newLeft, y: newTop });
      } else {
        snappedObjects.delete(obj);
      }

      obj.set({
        left: newLeft,
        top: newTop
      });

      obj.setCoords();
    };

    const handleObjectModified = (e: any) => {
      const obj = e.target as FabricObject;
      if (obj) {
        // Clear snap tracking when object is released
        snappedObjects.delete(obj);
      }
    };

    const handleObjectScaling = (e: any) => {
      const obj = e.target as FabricObject;
      if (!obj) return;

      const width = (obj.width || 0) * (obj.scaleX || 1);
      const height = (obj.height || 0) * (obj.scaleY || 1);

      const gridSizePx = config.spacing * pixelsPerMm;

      // Snap dimensions to grid
      const snappedWidth = Math.round(width / gridSizePx) * gridSizePx;
      const snappedHeight = Math.round(height / gridSizePx) * gridSizePx;

      if (Math.abs(width - snappedWidth) <= snapThreshold && obj.width) {
        obj.scaleX = snappedWidth / obj.width;
      }
      if (Math.abs(height - snappedHeight) <= snapThreshold && obj.height) {
        obj.scaleY = snappedHeight / obj.height;
      }

      obj.setCoords();
    };

    canvas.on('object:moving', handleObjectMoving);
    canvas.on('object:scaling', handleObjectScaling);
    canvas.on('object:modified', handleObjectModified);

    return () => {
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('object:scaling', handleObjectScaling);
      canvas.off('object:modified', handleObjectModified);
    };
  }, [canvas, config, pixelsPerMm]);

  if (!config.enabled) return null;

  // Swap dimensions when rotated to match the rotated canvas visual
  const width = isRotated
    ? canvasHeightMm * pixelsPerMm * zoom
    : canvasWidthMm * pixelsPerMm * zoom;
  const height = isRotated
    ? canvasWidthMm * pixelsPerMm * zoom
    : canvasHeightMm * pixelsPerMm * zoom;

  return (
    <canvas
      ref={overlayRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 1
      }}
    />
  );
}

// Grid configuration control component
interface GridControlsProps {
  config: GridConfig;
  onChange: (config: GridConfig) => void;
}

export function GridControls({ config, onChange }: GridControlsProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>
        Grid Settings
      </h4>

      <div className="form-group">
        <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
          />
          <span className="form-label" style={{ marginBottom: 0 }}>Show Grid</span>
        </label>
      </div>

      {config.enabled && (
        <>
          <div className="form-group">
            <label className="form-label">Grid Spacing</label>
            <select
              className="form-select"
              value={config.spacing}
              onChange={(e) => onChange({ ...config, spacing: Number(e.target.value) })}
            >
              <option value={1}>1mm</option>
              <option value={5}>5mm</option>
              <option value={10}>10mm</option>
            </select>
          </div>

          <div className="form-group">
            <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.snapEnabled}
                onChange={(e) => onChange({ ...config, snapEnabled: e.target.checked })}
              />
              <span className="form-label" style={{ marginBottom: 0 }}>Snap to Grid</span>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Grid Color</label>
            <input
              type="color"
              value={config.color}
              onChange={(e) => onChange({ ...config, color: e.target.value })}
              style={{ width: '100%', height: 32, cursor: 'pointer' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Opacity: {Math.round(config.opacity * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.opacity}
              onChange={(e) => onChange({ ...config, opacity: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>
        </>
      )}
    </div>
  );
}
