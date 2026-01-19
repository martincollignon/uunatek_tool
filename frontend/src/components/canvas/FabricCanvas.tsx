import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, FabricObject, IText, Point, Rect } from 'fabric';
import { useCanvasStore } from '../../stores/canvasStore';
import { useAlignmentGuidesStore } from '../../stores/alignmentGuidesStore';
import {
  calculateAlignmentGuides,
  drawAlignmentGuides,
  clearAlignmentGuides,
  drawStaticGuides,
  AnchorMode,
  HorizontalAnchor,
  VerticalAnchor,
} from '../../utils/alignmentGuides';
import {
  applyCanvasOptimizations,
  makeNonInteractive,
  optimizeForZoomPan,
  restoreAfterZoomPan,
  batchRemoveObjects,
} from '../../utils/fabricOptimizations';
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
  onViewportChange?: (offset: { x: number; y: number }) => void;
}

// Scale factor: pixels per mm for display
const SCALE = 3;

// Safety margin in mm - matches backend config.safety_margin_mm
const SAFETY_MARGIN_MM = 3;

export function FabricCanvas({ width, height, projectId, side, onCanvasReady, onSelectionChange, onZoomChange, onZoomControlsReady, onViewportChange }: Props) {
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
    isSnappedHorizontal,
    isSnappedVertical,
    currentVerticalSnapPos,
    currentHorizontalSnapPos,
    setSnapState,
    resetSnapState,
  } = useAlignmentGuidesStore();
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const dragAnchorModeRef = useRef<AnchorMode | undefined>(undefined);
  const [rotationAngle, setRotationAngle] = useState<number | null>(null);
  const [rotationPosition, setRotationPosition] = useState<{ x: number; y: number } | null>(null);

  // Refs to avoid stale closures in event handlers
  const propsRef = useRef({
    showSmartGuides,
    snapToGuides,
    width,
    height,
    onZoomChange,
    onViewportChange,
    isSnappedHorizontal,
    isSnappedVertical,
    currentVerticalSnapPos,
    currentHorizontalSnapPos,
    setSnapState,
    resetSnapState,
  });

  // Update refs whenever values change
  useEffect(() => {
    propsRef.current = {
      showSmartGuides,
      snapToGuides,
      width,
      height,
      onZoomChange,
      onViewportChange,
      isSnappedHorizontal,
      isSnappedVertical,
      currentVerticalSnapPos,
      currentHorizontalSnapPos,
      setSnapState,
      resetSnapState,
    };
  }, [
    showSmartGuides,
    snapToGuides,
    width,
    height,
    onZoomChange,
    onViewportChange,
    isSnappedHorizontal,
    isSnappedVertical,
    currentVerticalSnapPos,
    currentHorizontalSnapPos,
    setSnapState,
    resetSnapState,
  ]);

  /**
   * Calculate which anchor region was clicked based on pointer position
   */
  const calculateAnchorMode = useCallback((
    pointer: Point,
    objectBounds: { left: number; top: number; width: number; height: number }
  ): AnchorMode => {
    const relativeX = (pointer.x - objectBounds.left) / objectBounds.width;
    const relativeY = (pointer.y - objectBounds.top) / objectBounds.height;

    const horizontal: HorizontalAnchor =
      relativeX < 0.33 ? 'left' : relativeX > 0.67 ? 'right' : 'center';

    const vertical: VerticalAnchor =
      relativeY < 0.33 ? 'top' : relativeY > 0.67 ? 'bottom' : 'center';

    return { horizontal, vertical };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Calculate canvas dimensions in pixels (3px per mm)
    const canvasWidth = width * SCALE;
    const canvasHeight = height * SCALE;

    console.log('[FabricCanvas] Setting up canvas:', { canvasWidth, canvasHeight, width, height, SCALE });

    // For Fabric 7.x and React 19: Set canvas element dimensions
    // Must happen BEFORE creating Fabric instance
    const canvasEl = canvasRef.current;
    canvasEl.width = canvasWidth;
    canvasEl.height = canvasHeight;

    console.log('[FabricCanvas] Canvas element dimensions set:', {
      elementWidth: canvasEl.width,
      elementHeight: canvasEl.height,
      clientWidth: canvasEl.clientWidth,
      clientHeight: canvasEl.clientHeight
    });

    // Create fabric canvas - pass dimensions to ensure Fabric knows the canvas size
    const canvas = new Canvas(canvasEl, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
    });

    // Apply performance optimizations
    applyCanvasOptimizations(canvas);

    // Add canvas boundary rectangle (outer - full paper size)
    // Position center at canvas center to align with Fabric 7 coordinate system
    const boundary = new Rect({
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      width: canvasWidth,
      height: canvasHeight,
      fill: 'transparent',
      stroke: '#3b82f6',
      strokeWidth: 2,
      excludeFromExport: true,  // Exclude from canvas JSON - this is a UI-only element
      name: 'canvas-boundary',
      originX: 'center',
      originY: 'center',
    });

    // Make boundary non-interactive for performance
    makeNonInteractive(boundary);

    canvas.add(boundary);
    canvas.sendObjectToBack(boundary);

    // Add safety boundary rectangle (inner - safe drawing area)
    // This shows where content will be clipped to prevent pen catching paper edge
    const safetyMarginPx = SAFETY_MARGIN_MM * SCALE;
    const safetyBoundary = new Rect({
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      width: canvasWidth - 2 * safetyMarginPx,
      height: canvasHeight - 2 * safetyMarginPx,
      fill: 'transparent',
      stroke: '#f97316',  // Orange color to differentiate from outer boundary
      strokeWidth: 1,
      strokeDashArray: [8, 4],  // Dashed line
      excludeFromExport: true,  // Exclude from canvas JSON - this is a UI-only element
      name: 'safety-boundary',
      originX: 'center',
      originY: 'center',
    });

    // Make safety boundary non-interactive for performance
    makeNonInteractive(safetyBoundary);

    canvas.add(safetyBoundary);
    canvas.sendObjectToBack(safetyBoundary);

    fabricRef.current = canvas;
    onCanvasReady(canvas);

    // Helper to notify viewport changes
    const notifyViewportChange = () => {
      const { onViewportChange } = propsRef.current;
      if (onViewportChange) {
        const vpt = canvas.viewportTransform;
        if (vpt) {
          // In rotated mode, vpt[5] includes canvasHeight*zoom for rotation
          // Subtract the rotation baseline to get actual pan offset
          const canvasHeightPx = height * SCALE;
          const zoom = isRotated ? Math.abs(vpt[1]) : Math.abs(vpt[0]);

          const panX = vpt[4];
          const panY = isRotated ? vpt[5] - (canvasHeightPx * zoom) : vpt[5];

          onViewportChange({ x: panX, y: panY });
        }
      }
    };

    // Helper to get current zoom from viewport transform
    const getCurrentZoom = () => {
      const vpt = canvas.viewportTransform;
      if (!vpt) return 1;
      // Extract zoom from the transform matrix
      // For normal: zoom is vpt[0]
      // For rotated: zoom is vpt[1] (since rotation swaps x and y)
      return isRotated ? Math.abs(vpt[1]) : Math.abs(vpt[0]);
    };

    // Helper to apply zoom while preserving rotation
    const applyZoom = (newZoom: number) => {
      const canvasHeight = height * SCALE;
      if (isRotated) {
        canvas.viewportTransform = [
          0, newZoom, 0,
          -newZoom, 0, canvasHeight * newZoom,
        ];
      } else {
        canvas.viewportTransform = [newZoom, 0, 0, newZoom, 0, 0];
      }
    };

    // Setup zoom controls
    const zoomControls: ZoomControls = {
      zoomIn: () => {
        let zoom = getCurrentZoom();
        zoom = Math.min(zoom * 1.2, 5);
        applyZoom(zoom);
        canvas.requestRenderAll();
        notifyViewportChange();
        if (onZoomChange) onZoomChange(zoom);
      },
      zoomOut: () => {
        let zoom = getCurrentZoom();
        zoom = Math.max(zoom / 1.2, 0.1);
        applyZoom(zoom);
        canvas.requestRenderAll();
        notifyViewportChange();
        if (onZoomChange) onZoomChange(zoom);
      },
      resetZoom: () => {
        applyZoom(1);
        canvas.requestRenderAll();
        notifyViewportChange();
        if (onZoomChange) onZoomChange(1);
      },
      getZoom: () => getCurrentZoom(),
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

    canvas.on('object:added', (e) => {
      // Ensure boundary stays at the back when new objects are added
      const addedObj = e.target;
      if (addedObj && (addedObj as any).name !== 'canvas-boundary') {
        const boundary = canvas.getObjects().find((obj) => (obj as any).name === 'canvas-boundary');
        if (boundary) {
          canvas.sendObjectToBack(boundary);
        }
      }
      setDirty(true);
    });

    canvas.on('object:removed', () => {
      setDirty(true);
    });

    // Track last snap positions to prevent jitter
    let lastSnapLeft: number | undefined;
    let lastSnapTop: number | undefined;

    // Capture anchor mode when drag starts
    canvas.on('mouse:down:before', (opt) => {
      const target = opt.target;
      if (!target || !opt.scenePoint) return;

      // Calculate which anchor region was clicked
      const objectBounds = target.getBoundingRect();
      const anchorMode = calculateAnchorMode(opt.scenePoint, objectBounds);
      dragAnchorModeRef.current = anchorMode;
    });

    // Handle object moving for alignment guides
    canvas.on('object:moving', (e) => {
      const target = e.target;
      if (!target) return;

      const { width, height, showSmartGuides, snapToGuides, isSnappedHorizontal, isSnappedVertical, currentVerticalSnapPos, currentHorizontalSnapPos, setSnapState } = propsRef.current;
      const canvasWidth = width * SCALE;
      const canvasHeight = height * SCALE;

      // Only show/calculate guides if smart guides are enabled
      if (showSmartGuides) {
        const result = calculateAlignmentGuides(canvas, target, canvasWidth, canvasHeight, {
          isSnappedHorizontal,
          isSnappedVertical,
          currentVerticalSnapPos,
          currentHorizontalSnapPos,
        }, dragAnchorModeRef.current);

        // Update snap state in store
        setSnapState(result.newSnapState);

        // Apply snapping if enabled
        if (snapToGuides) {
          // Only update position if the snap target changed to prevent jitter
          const snapLeftChanged = result.snapLeft !== lastSnapLeft;
          const snapTopChanged = result.snapTop !== lastSnapTop;

          if (snapLeftChanged && result.snapLeft !== undefined) {
            target.set('left', result.snapLeft);
            lastSnapLeft = result.snapLeft;
          } else if (result.snapLeft === undefined && lastSnapLeft !== undefined) {
            // Clear last snap when no longer snapping
            lastSnapLeft = undefined;
          }

          if (snapTopChanged && result.snapTop !== undefined) {
            target.set('top', result.snapTop);
            lastSnapTop = result.snapTop;
          } else if (result.snapTop === undefined && lastSnapTop !== undefined) {
            // Clear last snap when no longer snapping
            lastSnapTop = undefined;
          }

          if (snapLeftChanged || snapTopChanged) {
            target.setCoords();
          }
        }

        // Draw alignment guides
        drawAlignmentGuides(canvas, result.guides, canvasWidth, canvasHeight);
      }
    });

    // Clear alignment guides when object stops moving
    canvas.on('object:modified', () => {
      clearAlignmentGuides(canvas);
      propsRef.current.resetSnapState(); // Reset snap state for next drag
      lastSnapLeft = undefined; // Reset tracking
      lastSnapTop = undefined;
      dragAnchorModeRef.current = undefined; // Clear anchor mode
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

    // Zoom with mouse wheel - optimized with skipTargetFind
    canvas.on('mouse:wheel', (opt) => {
      const evt = opt.e as WheelEvent;
      const delta = evt.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;

      // Limit zoom level
      if (zoom > 5) zoom = 5;
      if (zoom < 0.1) zoom = 0.1;

      // Optimize for zoom operation
      optimizeForZoomPan(canvas);

      // Zoom towards mouse cursor
      const point = new Point(evt.offsetX, evt.offsetY);
      canvas.zoomToPoint(point, zoom);

      // Restore after zoom
      restoreAfterZoomPan(canvas);

      notifyViewportChange();
      const { onZoomChange } = propsRef.current;
      if (onZoomChange) {
        onZoomChange(zoom);
      }

      evt.preventDefault();
      evt.stopPropagation();
    });

    // Panning with Shift+drag or middle mouse button - optimized
    canvas.on('mouse:down', (opt) => {
      const evt = opt.e as MouseEvent;
      // Check if Shift key is pressed or middle mouse button
      if (evt.button === 1 || (evt.button === 0 && evt.shiftKey)) {
        isPanningRef.current = true;
        lastPosRef.current = { x: evt.clientX, y: evt.clientY };
        // Optimize for pan operation
        optimizeForZoomPan(canvas);
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
          notifyViewportChange();
          lastPosRef.current = { x: evt.clientX, y: evt.clientY };
        }
        canvas.defaultCursor = 'grabbing';
      }
    });

    canvas.on('mouse:up', () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        // Restore after pan operation
        restoreAfterZoomPan(canvas);
        canvas.defaultCursor = 'default';
      }
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [width, height, onCanvasReady, onSelectionChange, setDirty, calculateAnchorMode]);

  // Centralized boundary management - single source of truth
  const ensureBoundary = useCallback((canvas: Canvas) => {
    const canvasWidth = width * SCALE;
    const canvasHeight = height * SCALE;
    const safetyMarginPx = SAFETY_MARGIN_MM * SCALE;

    // Handle outer canvas boundary - ALWAYS remove and recreate to fix Fabric 7 origin issues
    const existingBoundary = canvas.getObjects().find((obj) => (obj as any).name === 'canvas-boundary');
    if (existingBoundary) {
      canvas.remove(existingBoundary);
    }

    // Create boundary centered at canvas center
    const boundary = new Rect({
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      width: canvasWidth,
      height: canvasHeight,
      fill: 'transparent',
      stroke: '#3b82f6',
      strokeWidth: 2,
      excludeFromExport: true,  // Exclude from canvas JSON - this is a UI-only element
      name: 'canvas-boundary',
      originX: 'center',
      originY: 'center',
    });
    makeNonInteractive(boundary);
    canvas.add(boundary);
    canvas.sendObjectToBack(boundary);

    // Handle inner safety boundary - ALWAYS remove and recreate
    const existingSafetyBoundary = canvas.getObjects().find((obj) => (obj as any).name === 'safety-boundary');
    if (existingSafetyBoundary) {
      canvas.remove(existingSafetyBoundary);
    }

    // Create safety boundary centered at canvas center
    const safetyBoundary = new Rect({
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      width: canvasWidth - 2 * safetyMarginPx,
      height: canvasHeight - 2 * safetyMarginPx,
      fill: 'transparent',
      stroke: '#f97316',  // Orange color to differentiate from outer boundary
      strokeWidth: 1,
      strokeDashArray: [8, 4],  // Dashed line
      excludeFromExport: true,  // Exclude from canvas JSON - this is a UI-only element
      name: 'safety-boundary',
      originX: 'center',
      originY: 'center',
    });
    makeNonInteractive(safetyBoundary);
    canvas.add(safetyBoundary);
    canvas.sendObjectToBack(safetyBoundary);
  }, [width, height]);

  // Load canvas data when side changes
  useEffect(() => {
    const load = async () => {
      if (!fabricRef.current) return;

      const canvas = fabricRef.current;
      const data = await loadCanvas(projectId, side);

      // Check if canvas still exists after async operation
      if (!fabricRef.current || fabricRef.current !== canvas) return;

      if (data && data.objects) {
        try {
          // Use Promise-based API (Fabric.js 6.x)
          await fabricRef.current.loadFromJSON(data);

          // Re-add boundary after loading
          if (fabricRef.current) {
            ensureBoundary(fabricRef.current);
            fabricRef.current.requestRenderAll();
            setDirty(false);
          }
        } catch (error) {
          console.error('Failed to load canvas from JSON:', error);
          // Clear canvas and show boundary on error
          if (fabricRef.current) {
            fabricRef.current.clear();
            fabricRef.current.backgroundColor = '#ffffff';
            ensureBoundary(fabricRef.current);
            fabricRef.current.requestRenderAll();
          }
        }
      } else {
        // Clear canvas for new side
        if (fabricRef.current) {
          fabricRef.current.clear();
          fabricRef.current.backgroundColor = '#ffffff';
          // Re-add boundary after clearing
          ensureBoundary(fabricRef.current);
          fabricRef.current.requestRenderAll();
          setDirty(false);
        }
      }
    };

    load();
  }, [projectId, side, loadCanvas, setDirty, width, height, ensureBoundary]);

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
      // Remove static guides with batch operation
      const staticGuides = canvas.getObjects().filter((obj) => (obj as any).name === 'staticGuide');
      if (staticGuides.length > 0) {
        batchRemoveObjects(canvas, staticGuides);
      }
    }
  }, [showStaticGuides, showCenter, showThirds, showHalves, width, height]);

  // Handle canvas rotation for easier editing
  // This only rotates the VIEWPORT, not the actual objects, so saved data remains in portrait
  useEffect(() => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    const canvasHeight = height * SCALE;

    // Get current zoom level from viewport transform
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const currentZoom = Math.abs(vpt[0] || vpt[1] || 1);

    if (isRotated) {
      // Rotate viewport 90° clockwise for landscape editing
      // Objects remain in their original positions, only the view rotates
      canvas.viewportTransform = [
        0, currentZoom, 0,           // Rotate 90° CW: x' = y, scaled by zoom
        -currentZoom, 0, canvasHeight * currentZoom, // y' = -x + height, scaled by zoom
      ];
    } else {
      // Reset to normal portrait view, preserving zoom
      canvas.viewportTransform = [currentZoom, 0, 0, currentZoom, 0, 0];
    }

    // Boundary is managed automatically after rotation
    ensureBoundary(canvas);
    canvas.requestRenderAll();

    // Notify viewport change after rotation
    if (onViewportChange) {
      const vpt = canvas.viewportTransform;
      if (vpt) {
        onViewportChange({ x: vpt[4], y: vpt[5] });
      }
    }
  }, [isRotated, width, height, ensureBoundary, onViewportChange]);

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
