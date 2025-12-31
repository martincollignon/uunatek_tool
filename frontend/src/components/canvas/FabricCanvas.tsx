import { useEffect, useRef, useState } from 'react';
import { Canvas, FabricObject, IText, Point, Rect } from 'fabric';
import { useCanvasStore } from '../../stores/canvasStore';
import { useAlignmentGuidesStore } from '../../stores/alignmentGuidesStore';
import {
  calculateAlignmentGuides,
  drawAlignmentGuides,
  clearAlignmentGuides,
  drawStaticGuides,
} from '../../utils/alignmentGuides';
import type { CanvasSide } from '../../types';

export interface ZoomControls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  getZoom: () => number;
}

interface Props {
  width: number; // mm
  height: number; // mm
  projectId: string;
  side: CanvasSide;
  onCanvasReady: (canvas: Canvas) => void;
  onSelectionChange: (object: FabricObject | null) => void;
  onZoomChange?: (zoom: number) => void;
  onZoomControlsReady?: (controls: ZoomControls) => void;
}

// Scale factor: pixels per mm for display
const SCALE = 3;

export function FabricCanvas({ width, height, projectId, side, onCanvasReady, onSelectionChange, onZoomChange, onZoomControlsReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const { loadCanvas, setDirty, isRotated } = useCanvasStore();
  const {
    showStaticGuides,
    showSmartGuides,
    showCenter,
    showThirds,
    showHalves,
    snapToGuides,
  } = useAlignmentGuidesStore();
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const [rotationAngle, setRotationAngle] = useState<number | null>(null);
  const [rotationPosition, setRotationPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Create fabric canvas
    const canvas = new Canvas(canvasRef.current, {
      width: width * SCALE,
      height: height * SCALE,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
    });

    // Add canvas boundary rectangle
    const boundary = new Rect({
      left: 0,
      top: 0,
      width: width * SCALE,
      height: height * SCALE,
      fill: 'transparent',
      stroke: '#3b82f6',
      strokeWidth: 2,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      name: 'canvas-boundary',
    });
    canvas.add(boundary);
    canvas.sendObjectToBack(boundary);

    fabricRef.current = canvas;
    onCanvasReady(canvas);

    // Setup zoom controls
    const zoomControls: ZoomControls = {
      zoomIn: () => {
        let zoom = canvas.getZoom();
        zoom = Math.min(zoom * 1.2, 5);
        canvas.setZoom(zoom);
        canvas.requestRenderAll();
        if (onZoomChange) onZoomChange(zoom);
      },
      zoomOut: () => {
        let zoom = canvas.getZoom();
        zoom = Math.max(zoom / 1.2, 0.1);
        canvas.setZoom(zoom);
        canvas.requestRenderAll();
        if (onZoomChange) onZoomChange(zoom);
      },
      resetZoom: () => {
        canvas.setZoom(1);
        canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
        canvas.requestRenderAll();
        if (onZoomChange) onZoomChange(1);
      },
      getZoom: () => canvas.getZoom(),
    };

    if (onZoomControlsReady) {
      onZoomControlsReady(zoomControls);
    }

    // Event handlers
    canvas.on('selection:created', (e) => {
      onSelectionChange(e.selected?.[0] || null);
    });

    canvas.on('selection:updated', (e) => {
      onSelectionChange(e.selected?.[0] || null);
    });

    canvas.on('object:added', () => {
      setDirty(true);
    });

    canvas.on('object:removed', () => {
      setDirty(true);
    });

    // Handle object moving for alignment guides
    canvas.on('object:moving', (e) => {
      const target = e.target;
      if (!target) return;

      const canvasWidth = width * SCALE;
      const canvasHeight = height * SCALE;

      // Only show/calculate guides if smart guides are enabled
      if (showSmartGuides) {
        const result = calculateAlignmentGuides(canvas, target, canvasWidth, canvasHeight);

        // Apply snapping if enabled
        if (snapToGuides) {
          if (result.snapLeft !== undefined) {
            target.set('left', result.snapLeft);
          }
          if (result.snapTop !== undefined) {
            target.set('top', result.snapTop);
          }
          target.setCoords();
        }

        // Draw alignment guides
        drawAlignmentGuides(canvas, result.guides, canvasWidth, canvasHeight);
      }
    });

    // Clear alignment guides when object stops moving
    canvas.on('object:modified', () => {
      clearAlignmentGuides(canvas);
      setDirty(true);
      setRotationAngle(null);
      setRotationPosition(null);
    });

    canvas.on('selection:cleared', () => {
      clearAlignmentGuides(canvas);
      onSelectionChange(null);
    });

    // Handle rotation events for angle display and snapping
    canvas.on('object:rotating', (e) => {
      const target = e.target;
      if (!target) return;

      let angle = target.angle || 0;

      // Normalize angle to 0-360 range
      while (angle < 0) angle += 360;
      while (angle >= 360) angle -= 360;

      // Only snap when Alt key is held
      const evt = e.e as MouseEvent;
      if (evt.altKey) {
        const snapAngle = 45;
        const nearestSnapAngle = Math.round(angle / snapAngle) * snapAngle;
        angle = nearestSnapAngle % 360;
        target.set('angle', angle);
      }

      // Display current angle near the object
      const center = target.getCenterPoint();
      const zoom = canvas.getZoom();
      const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];

      setRotationAngle(Math.round(angle * 10) / 10);
      setRotationPosition({
        x: center.x * zoom + vpt[4],
        y: center.y * zoom + vpt[5] - 40
      });
    });

    // Enable double-click to edit text
    canvas.on('mouse:dblclick', (e) => {
      const target = e.target;
      if (target && target instanceof IText) {
        target.enterEditing();
        target.selectAll();
      }
    });

    // Zoom with mouse wheel
    canvas.on('mouse:wheel', (opt) => {
      const evt = opt.e as WheelEvent;
      const delta = evt.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;

      // Limit zoom level
      if (zoom > 5) zoom = 5;
      if (zoom < 0.1) zoom = 0.1;

      // Zoom towards mouse cursor
      const point = new Point(evt.offsetX, evt.offsetY);
      canvas.zoomToPoint(point, zoom);

      if (onZoomChange) {
        onZoomChange(zoom);
      }

      evt.preventDefault();
      evt.stopPropagation();
    });

    // Panning with Shift+drag or middle mouse button
    canvas.on('mouse:down', (opt) => {
      const evt = opt.e as MouseEvent;
      // Check if Shift key is pressed or middle mouse button
      if (evt.button === 1 || (evt.button === 0 && evt.shiftKey)) {
        isPanningRef.current = true;
        lastPosRef.current = { x: evt.clientX, y: evt.clientY };
        canvas.selection = false;
        canvas.defaultCursor = 'grab';
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (isPanningRef.current) {
        const evt = opt.e as MouseEvent;
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += evt.clientX - lastPosRef.current.x;
          vpt[5] += evt.clientY - lastPosRef.current.y;
          canvas.requestRenderAll();
          lastPosRef.current = { x: evt.clientX, y: evt.clientY };
        }
        canvas.defaultCursor = 'grabbing';
      }
    });

    canvas.on('mouse:up', () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
      }
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [width, height, onCanvasReady, onSelectionChange, setDirty]);

  // Load canvas data when side changes
  useEffect(() => {
    const load = async () => {
      if (!fabricRef.current) return;

      const canvas = fabricRef.current;
      const data = await loadCanvas(projectId, side);

      // Check if canvas still exists after async operation
      if (!fabricRef.current || fabricRef.current !== canvas) return;

      if (data && data.objects) {
        fabricRef.current.loadFromJSON(data, () => {
          // Re-add boundary after loading
          if (fabricRef.current) {
            const boundary = new Rect({
              left: 0,
              top: 0,
              width: width * SCALE,
              height: height * SCALE,
              fill: 'transparent',
              stroke: '#3b82f6',
              strokeWidth: 2,
              selectable: false,
              evented: false,
              excludeFromExport: true,
              name: 'canvas-boundary',
            });
            fabricRef.current.add(boundary);
            fabricRef.current.sendObjectToBack(boundary);
            fabricRef.current.requestRenderAll();
            setDirty(false);
          }
        });
      } else {
        // Clear canvas for new side
        if (fabricRef.current) {
          fabricRef.current.clear();
          fabricRef.current.backgroundColor = '#ffffff';
          // Re-add boundary after clearing
          const boundary = new Rect({
            left: 0,
            top: 0,
            width: width * SCALE,
            height: height * SCALE,
            fill: 'transparent',
            stroke: '#3b82f6',
            strokeWidth: 2,
            selectable: false,
            evented: false,
            excludeFromExport: true,
            name: 'canvas-boundary',
          });
          fabricRef.current.add(boundary);
          fabricRef.current.sendObjectToBack(boundary);
          fabricRef.current.requestRenderAll();
          setDirty(false);
        }
      }
    };

    load();
  }, [projectId, side, loadCanvas, setDirty, width, height]);

  // Update static guides when settings change
  useEffect(() => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    const canvasWidth = width * SCALE;
    const canvasHeight = height * SCALE;

    if (showStaticGuides) {
      drawStaticGuides(canvas, canvasWidth, canvasHeight, {
        showCenter,
        showThirds,
        showHalves,
      });
    } else {
      // Remove static guides
      const staticGuides = canvas.getObjects().filter((obj) => (obj as any).name === 'staticGuide');
      staticGuides.forEach((guide) => canvas.remove(guide));
      canvas.requestRenderAll();
    }
  }, [showStaticGuides, showCenter, showThirds, showHalves, width, height]);

  // Handle canvas rotation for easier editing
  useEffect(() => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    const canvasHeight = height * SCALE;

    if (isRotated) {
      // Rotate canvas 90 degrees clockwise for landscape editing
      // The transformation matrix rotates around the top-left corner
      // then translates to position correctly
      canvas.viewportTransform = [
        0, 1, 0,           // Rotate 90° CW: x' = y
        -1, 0, canvasHeight, // y' = -x + height
      ];
    } else {
      // Reset to normal view (identity transform)
      canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    }

    canvas.requestRenderAll();
  }, [isRotated, width, height]);

  return (
    <div
      className="canvas-wrapper"
      style={{
        width: isRotated ? height * SCALE : width * SCALE,
        height: isRotated ? width * SCALE : height * SCALE,
        position: 'relative',
      }}
    >
      <canvas ref={canvasRef} />
      {rotationAngle !== null && rotationPosition && (
        <div
          style={{
            position: 'absolute',
            left: rotationPosition.x,
            top: rotationPosition.y,
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap',
          }}
        >
          {rotationAngle}°
        </div>
      )}
    </div>
  );
}
