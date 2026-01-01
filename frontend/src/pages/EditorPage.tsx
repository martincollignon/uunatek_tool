import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Play, Type, Image, Layers, Trash2, Sparkles, QrCode, Square, ChevronDown, ZoomIn, ZoomOut, Maximize2, Grid3x3, RotateCw, Undo2, Redo2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Canvas, FabricObject, FabricImage, loadSVGFromString, util } from 'fabric';
import { useProjectStore } from '../stores/projectStore';
import { useCanvasStore } from '../stores/canvasStore';
import { useAlignmentGuidesStore } from '../stores/alignmentGuidesStore';
import { FabricCanvas, ZoomControls } from '../components/canvas/FabricCanvas';
import { LayerPanel } from '../components/layers/LayerPanel';
import { SaveIndicator } from '../components/SaveIndicator';
import { GeminiDialog } from '../components/dialogs/GeminiDialog';
import { QRCodeDialog } from '../components/dialogs/QRCodeDialog';
import { FrameGalleryDialog } from '../components/dialogs/FrameGalleryDialog';
import ImageProcessDialog from '../components/dialogs/ImageProcessDialog';
import { validateImageFile, fileToDataURL, needsConversion } from '../utils/imageUtils';
import { createSimpleFrame, createDoubleFrame, createRoundedFrame, createOvalFrame } from '../utils/frameGenerator';
import { useCanvasOperations } from '../hooks/useCanvasOperations';
import { useCanvasSave } from '../hooks/useCanvasSave';
import { useCanvasSelection } from '../hooks/useCanvasSelection';
import { usePatternGeneration } from '../hooks/usePatternGeneration';
import { useEditorUX } from '../hooks/useEditorUX';
import { ContextMenu } from '../components/canvas/ContextMenu';
import { AlignmentToolbar } from '../components/toolbar/AlignmentToolbar';
import type { CanvasSide } from '../types';
import { ErrorBoundary, InlineErrorBoundary } from '../components/ErrorBoundary';
import { CanvasSkeleton, LayerPanelSkeleton, PropertiesPanelSkeleton } from '../components/skeletons';
import { GridControls, GridOverlay } from '../components/canvas/GridOverlay';
import { Ruler } from '../components/canvas/Ruler';

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentProject, loadProject, isLoading: projectLoading } = useProjectStore();
  const { currentSide, setSide, isDirty, setDirty, isRotated, setRotated } = useCanvasStore();
  const {
    showStaticGuides,
    showSmartGuides,
    showCenter,
    showThirds,
    showHalves,
    snapToGuides,
    gridConfig,
    toggleStaticGuides,
    toggleSmartGuides,
    toggleCenter,
    toggleThirds,
    toggleHalves,
    toggleSnapToGuides,
    setGridConfig,
  } = useAlignmentGuidesStore();

  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [showGeminiDialog, setShowGeminiDialog] = useState(false);
  const [showQRCodeDialog, setShowQRCodeDialog] = useState(false);
  const [showFrameGalleryDialog, setShowFrameGalleryDialog] = useState(false);
  const [showImageProcessDialog, setShowImageProcessDialog] = useState(false);
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | null>(null);
  const [frameMenuOpen, setFrameMenuOpen] = useState(false);
  const frameMenuRef = useRef<HTMLDivElement>(null);
  const [zoomControls, setZoomControls] = useState<ZoomControls | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });

  // Use custom hooks for canvas operations
  const canvasOps = useCanvasOperations(fabricCanvas);
  const { handleSave } = useCanvasSave(fabricCanvas, projectId, currentSide);
  const { regenerateFillPattern } = usePatternGeneration(
    fabricCanvas,
    currentProject?.width_mm || 0,
    currentProject?.height_mm || 0,
    setSelectedObject,
    setDirty
  );

  // Use canvas selection hook
  useCanvasSelection(fabricCanvas, selectedObject, canvasOps.deleteSelected, setDirty);

  // Phase 2 UX hook - integrates undo/redo, context menu, keyboard shortcuts
  const editorUX = useEditorUX({
    canvas: fabricCanvas,
    selectedObject,
    zoomControls,
    onDelete: canvasOps?.deleteSelected,
    // onDuplicate not provided - useEditorUX will use its built-in duplicate handler
  });

  useEffect(() => {
    if (projectId) {
      loadProject(projectId).catch((err) => {
        if (err?.response?.status === 404) {
          console.error('Project not found, redirecting to home');
          navigate('/');
        }
      });
    }
  }, [projectId, loadProject, navigate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (frameMenuRef.current && !frameMenuRef.current.contains(event.target as Node)) {
        setFrameMenuOpen(false);
      }
    };
    if (frameMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [frameMenuOpen]);

  const handleAddText = () => {
    canvasOps.addText();
  };

  const handleAddImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !fabricCanvas) return;

      try {
        // Validate image format
        const validation = await validateImageFile(file);

        if (!validation.valid) {
          alert(`Invalid image: ${validation.message}`);
          return;
        }

        // Show info for HEIC/formats that need conversion
        if (needsConversion(validation.format)) {
          console.log(`Format conversion: ${validation.message}`);
        }

        // Read image and show process dialog
        const dataUrl = await fileToDataURL(file);
        setPendingImageDataUrl(dataUrl);
        setShowImageProcessDialog(true);
      } catch (error) {
        console.error('Failed to load image:', error);
        alert(`Failed to load image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    input.click();
  };

  const handleAddImageToCanvas = async (dataUrl: string) => {
    try {
      await canvasOps.addImageToCanvas(dataUrl);
      // Auto-save after adding image to ensure preview shows it
      if (projectId) {
        await handleSave();
      }
    } catch (error) {
      console.error('Failed to add image to canvas:', error);
      alert(`Failed to add image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteSelected = () => {
    const deleted = canvasOps.deleteSelected();
    if (deleted) {
      setSelectedObject(null);
    }
  };

  const handleBringToFront = () => {
    if (selectedObject) {
      canvasOps.bringToFront(selectedObject);
    }
  };

  const handleSendToBack = () => {
    if (selectedObject) {
      canvasOps.sendToBack(selectedObject);
    }
  };

  const handleStartPlot = () => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Save before plotting?')) {
        handleSave().then(() => navigate(`/plot/${projectId}`));
        return;
      }
    }
    navigate(`/plot/${projectId}`);
  };

  const handleGeminiImageGenerated = async (imageBase64: string) => {
    if (!fabricCanvas) return;

    const dataUrl = `data:image/png;base64,${imageBase64}`;
    const img = await FabricImage.fromURL(dataUrl);

    // Scale to fit
    const maxDim = Math.max(fabricCanvas.width!, fabricCanvas.height!) * 0.8;
    if (img.width! > maxDim || img.height! > maxDim) {
      const scale = maxDim / Math.max(img.width!, img.height!);
      img.scale(scale);
    }

    img.set({
      left: fabricCanvas.width! / 2,
      top: fabricCanvas.height! / 2,
      originX: 'center',
      originY: 'center',
    });

    fabricCanvas.add(img);
    fabricCanvas.setActiveObject(img);
    fabricCanvas.requestRenderAll();

    // Auto-save after adding image to ensure preview shows it
    if (projectId) {
      await handleSave();
    }
  };

  const handleQRCodeGenerated = async (svg: string, widthMm: number, heightMm: number) => {
    if (!fabricCanvas) return;

    // Canvas scale: 3 pixels per mm
    const SCALE = 3;

    // Parse SVG and load into fabric
    const { objects } = await loadSVGFromString(svg);

    // Filter out null objects
    const validObjects = objects.filter((obj): obj is FabricObject => obj !== null);

    if (validObjects.length > 0) {
      // Group all SVG objects together
      const group = util.groupSVGElements(validObjects);

      // Scale from mm to canvas pixels
      const targetWidth = widthMm * SCALE;
      const targetHeight = heightMm * SCALE;
      const scaleX = targetWidth / (group.width || 1);
      const scaleY = targetHeight / (group.height || 1);

      group.set({
        left: fabricCanvas.width! / 2,
        top: fabricCanvas.height! / 2,
        originX: 'center',
        originY: 'center',
        scaleX: scaleX,
        scaleY: scaleY,
      });

      fabricCanvas.add(group);
      fabricCanvas.setActiveObject(group);
      fabricCanvas.requestRenderAll();

      // Auto-save after adding QR code to ensure preview shows it
      if (projectId) {
        await handleSave();
      }
    }
  };

  const handleAddSimpleFrame = async () => {
    if (!fabricCanvas || !currentProject) return;

    const frame = createSimpleFrame({
      canvasWidthMm: currentProject.width_mm,
      canvasHeightMm: currentProject.height_mm,
    });

    if (frame) {
      fabricCanvas.add(frame);
      fabricCanvas.setActiveObject(frame);
      fabricCanvas.requestRenderAll();

      // Auto-save after adding frame
      if (projectId) {
        await handleSave();
      }
    }
    setFrameMenuOpen(false);
  };

  const handleAddDoubleFrame = async () => {
    if (!fabricCanvas || !currentProject) return;

    const frame = createDoubleFrame({
      canvasWidthMm: currentProject.width_mm,
      canvasHeightMm: currentProject.height_mm,
    });

    if (frame) {
      fabricCanvas.add(frame);
      fabricCanvas.setActiveObject(frame);
      fabricCanvas.requestRenderAll();

      // Auto-save after adding frame
      if (projectId) {
        await handleSave();
      }
    }
    setFrameMenuOpen(false);
  };

  const handleAddRoundedFrame = async () => {
    if (!fabricCanvas || !currentProject) return;

    const frame = createRoundedFrame({
      canvasWidthMm: currentProject.width_mm,
      canvasHeightMm: currentProject.height_mm,
    });

    if (frame) {
      fabricCanvas.add(frame);
      fabricCanvas.setActiveObject(frame);
      fabricCanvas.requestRenderAll();

      // Auto-save after adding frame
      if (projectId) {
        await handleSave();
      }
    }
    setFrameMenuOpen(false);
  };

  const handleAddOvalFrame = async () => {
    if (!fabricCanvas || !currentProject) return;

    const frame = createOvalFrame({
      canvasWidthMm: currentProject.width_mm,
      canvasHeightMm: currentProject.height_mm,
    });

    if (frame) {
      fabricCanvas.add(frame);
      fabricCanvas.setActiveObject(frame);
      fabricCanvas.requestRenderAll();

      // Auto-save after adding frame
      if (projectId) {
        await handleSave();
      }
    }
    setFrameMenuOpen(false);
  };

  const handleFrameGallerySelected = async (frame: any) => {
    if (!fabricCanvas) return;
    fabricCanvas.add(frame);
    fabricCanvas.setActiveObject(frame);
    fabricCanvas.requestRenderAll();

    // Auto-save after adding frame
    if (projectId) {
      await handleSave();
    }
  };

  if (projectLoading || !currentProject) {
    return (
      <div className="editor-layout">
        {/* Toolbar skeleton */}
        <div className="editor-toolbar">
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '100px', height: '36px', backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius)' }} />
            <div style={{ width: '100px', height: '36px', backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius)' }} />
          </div>
        </div>

        {/* Left sidebar skeleton */}
        <div className="editor-sidebar-left">
          <h3 style={{ marginBottom: 16, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            <Layers size={16} style={{ marginRight: 8, display: 'inline' }} />
            Layers
          </h3>
          <LayerPanelSkeleton />
        </div>

        {/* Canvas skeleton */}
        <div className="editor-canvas-container">
          <CanvasSkeleton />
        </div>

        {/* Right sidebar skeleton */}
        <div className="editor-sidebar-right">
          <h3 style={{ marginBottom: 16, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Properties</h3>
          <PropertiesPanelSkeleton />
        </div>

        {/* Footer */}
        <div className="editor-footer">
          <div>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Loading project...
            </span>
          </div>
        </div>
      </div>
    );
  }

  const sides: { key: CanvasSide; label: string; visible: boolean }[] = [
    { key: 'front', label: 'Side 1', visible: true },
    { key: 'back', label: 'Side 2', visible: currentProject.is_double_sided },
    { key: 'envelope', label: 'Envelope', visible: currentProject.include_envelope },
  ];

  return (
    <div className="editor-layout">
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="flex items-center gap-2">
          {/* Side tabs */}
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
            {sides
              .filter((s) => s.visible)
              .map((side) => (
                <button
                  key={side.key}
                  className={`tab ${currentSide === side.key ? 'active' : ''}`}
                  onClick={() => setSide(side.key)}
                >
                  {side.label}
                </button>
              ))}
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--color-border)', margin: '0 8px' }} />

          {/* Undo/Redo buttons */}
          <button
            className="btn btn-secondary btn-icon"
            onClick={editorUX.handleUndo}
            disabled={!editorUX.canUndo}
            title={`Undo (${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Z)`}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="btn btn-secondary btn-icon"
            onClick={editorUX.handleRedo}
            disabled={!editorUX.canRedo}
            title={`Redo (${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Shift+Z)`}
          >
            <Redo2 size={18} />
          </button>

          <div style={{ width: 1, height: 24, background: 'var(--color-border)', margin: '0 8px' }} />

          {/* Tools */}
          <button className="btn btn-secondary btn-icon" onClick={handleAddText} title="Add Text">
            <Type size={18} />
          </button>
          <button className="btn btn-secondary btn-icon" onClick={handleAddImage} title="Add Image">
            <Image size={18} />
          </button>
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => setShowGeminiDialog(true)}
            title="Generate with AI"
          >
            <Sparkles size={18} />
          </button>
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => setShowQRCodeDialog(true)}
            title="Generate QR Code"
          >
            <QrCode size={18} />
          </button>

          <div className="dropdown-container" ref={frameMenuRef}>
            <button
              className="btn btn-secondary btn-icon-with-text"
              onClick={() => setFrameMenuOpen(!frameMenuOpen)}
              title="Add Frame"
            >
              <Square size={18} />
              <ChevronDown size={14} />
            </button>
            {frameMenuOpen && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={handleAddSimpleFrame}>
                  Simple Border
                </button>
                <button className="dropdown-item" onClick={handleAddDoubleFrame}>
                  Double Border
                </button>
                <button className="dropdown-item" onClick={handleAddRoundedFrame}>
                  Rounded Border
                </button>
                <button className="dropdown-item" onClick={handleAddOvalFrame}>
                  Oval Border
                </button>
                <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setFrameMenuOpen(false);
                    setShowFrameGalleryDialog(true);
                  }}
                >
                  More Frames...
                </button>
              </div>
            )}
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--color-border)', margin: '0 8px' }} />

          <button
            className="btn btn-secondary btn-icon"
            onClick={handleDeleteSelected}
            disabled={!selectedObject}
            title="Delete Selected"
          >
            <Trash2 size={18} />
          </button>

          <div style={{ width: 1, height: 24, background: 'var(--color-border)', margin: '0 8px' }} />

          {/* Alignment Toolbar */}
          <AlignmentToolbar
            canvas={fabricCanvas}
            selectedObject={selectedObject}
            canvasWidth={currentProject?.width_mm || 0}
            canvasHeight={currentProject?.height_mm || 0}
          />
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-secondary" onClick={handleSave} disabled={!isDirty}>
            <Save size={18} />
            Save
          </button>
          <button className="btn btn-primary" onClick={handleStartPlot}>
            <Play size={18} />
            Start Plotting
          </button>
        </div>
      </div>

      {/* Left sidebar - Layers */}
      <div className="editor-sidebar-left">
        <h3 style={{ marginBottom: 16, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          <Layers size={16} style={{ marginRight: 8, display: 'inline' }} />
          Layers
        </h3>
        <InlineErrorBoundary
          fallback={(_error, reset) => (
            <div style={{
              padding: '16px',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              textAlign: 'center'
            }}>
              <AlertTriangle size={20} color="var(--color-error)" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: '0.875rem', marginBottom: 8, color: 'var(--color-text-secondary)' }}>
                Failed to load layers
              </p>
              <button className="btn btn-secondary btn-sm" onClick={reset}>
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          )}
        >
          <LayerPanel
            canvas={fabricCanvas}
            selectedObject={selectedObject}
            onSelect={(obj) => {
              if (fabricCanvas && obj) {
                fabricCanvas.setActiveObject(obj);
                fabricCanvas.requestRenderAll();
                setSelectedObject(obj);
              } else {
                fabricCanvas?.discardActiveObject();
                fabricCanvas?.requestRenderAll();
                setSelectedObject(null);
              }
            }}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
          />
        </InlineErrorBoundary>
      </div>

      {/* Canvas */}
      <div className="editor-canvas-container">
        <ErrorBoundary
          fallback={
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--color-bg)'
            }}>
              <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
                <AlertTriangle size={48} color="var(--color-error)" style={{ marginBottom: 16 }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>
                  Canvas Error
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                  Failed to load the canvas. Please try refreshing the page.
                </p>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>
                  <RefreshCw size={16} />
                  Reload Page
                </button>
              </div>
            </div>
          }
        >
          {/* Ruler - Horizontal */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 30,
            right: 0,
            height: 30,
            zIndex: 10
          }}>
            <Ruler
              orientation="horizontal"
              canvasWidthMm={currentProject.width_mm}
              canvasHeightMm={currentProject.height_mm}
              zoom={zoomLevel}
              offset={viewportOffset}
              pixelsPerMm={3}
            />
          </div>

          {/* Ruler - Vertical */}
          <div style={{
            position: 'absolute',
            top: 30,
            left: 0,
            bottom: 0,
            width: 30,
            zIndex: 10
          }}>
            <Ruler
              orientation="vertical"
              canvasWidthMm={currentProject.width_mm}
              canvasHeightMm={currentProject.height_mm}
              zoom={zoomLevel}
              offset={viewportOffset}
              pixelsPerMm={3}
            />
          </div>

          {/* Canvas with Grid Overlay */}
          <div style={{ position: 'absolute', top: 30, left: 30, right: 0, bottom: 0 }}>
            <FabricCanvas
              width={currentProject.width_mm}
              height={currentProject.height_mm}
              projectId={currentProject.id}
              side={currentSide}
              onCanvasReady={setFabricCanvas}
              onSelectionChange={setSelectedObject}
              onZoomControlsReady={setZoomControls}
              onZoomChange={setZoomLevel}
              onViewportChange={setViewportOffset}
            />

            {/* Grid Overlay */}
            {fabricCanvas && (
              <GridOverlay
                canvas={fabricCanvas}
                config={gridConfig}
                canvasWidthMm={currentProject.width_mm}
                canvasHeightMm={currentProject.height_mm}
                pixelsPerMm={3}
                zoom={zoomLevel}
              />
            )}
          </div>

        </ErrorBoundary>

        {/* Zoom controls */}
        <div className="zoom-controls">
          <button
            className="btn btn-icon btn-secondary"
            onClick={() => zoomControls?.zoomIn()}
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button
            className="btn btn-icon btn-secondary"
            onClick={() => zoomControls?.zoomOut()}
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <button
            className="btn btn-icon btn-secondary"
            onClick={() => zoomControls?.resetZoom()}
            title="Reset Zoom"
          >
            <Maximize2 size={18} />
          </button>
          <button
            className={`btn btn-icon btn-secondary ${showStaticGuides ? 'active' : ''}`}
            onClick={toggleStaticGuides}
            title="Toggle Static Guides"
            style={{
              backgroundColor: showStaticGuides ? 'var(--color-primary)' : undefined,
              color: showStaticGuides ? 'white' : undefined,
            }}
          >
            <Grid3x3 size={18} />
          </button>
          <button
            className={`btn btn-icon ${isRotated ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRotated(!isRotated)}
            title="Rotate Canvas View (Landscape/Portrait)"
          >
            <RotateCw size={18} />
          </button>
          <div className="zoom-level">
            {Math.round(zoomLevel * 100)}%
          </div>
        </div>
      </div>

      {/* Right sidebar - Properties */}
      <div className="editor-sidebar-right">
        <h3 style={{ marginBottom: 16, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Properties</h3>

        <InlineErrorBoundary
          fallback={(_error, reset) => (
            <div style={{
              padding: '16px',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              textAlign: 'center',
              marginBottom: 16
            }}>
              <AlertTriangle size={20} color="var(--color-error)" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: '0.875rem', marginBottom: 8, color: 'var(--color-text-secondary)' }}>
                Failed to load properties
              </p>
              <button className="btn btn-secondary btn-sm" onClick={reset}>
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          )}
        >
          {/* Grid Controls */}
          <div style={{ marginBottom: 20 }}>
            <GridControls
              config={gridConfig}
              onChange={setGridConfig}
            />
          </div>

          {/* Alignment Guides Settings */}
          <div style={{ marginBottom: 20, padding: 12, background: 'var(--color-bg)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <h4 style={{ marginBottom: 12, fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-primary)' }}>
              <Grid3x3 size={14} />
              Alignment Guides
            </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8rem' }}>
              <input
                type="checkbox"
                checked={showStaticGuides}
                onChange={toggleStaticGuides}
                style={{ cursor: 'pointer' }}
              />
              Show Static Guides
            </label>

            {showStaticGuides && (
              <div style={{ marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={showCenter}
                    onChange={toggleCenter}
                    style={{ cursor: 'pointer' }}
                  />
                  Center Lines
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={showThirds}
                    onChange={toggleThirds}
                    style={{ cursor: 'pointer' }}
                  />
                  Rule of Thirds
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={showHalves}
                    onChange={toggleHalves}
                    style={{ cursor: 'pointer' }}
                  />
                  Quarter Lines
                </label>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8rem' }}>
              <input
                type="checkbox"
                checked={showSmartGuides}
                onChange={toggleSmartGuides}
                style={{ cursor: 'pointer' }}
              />
              Smart Guides (while dragging)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8rem' }}>
              <input
                type="checkbox"
                checked={snapToGuides}
                onChange={toggleSnapToGuides}
                style={{ cursor: 'pointer' }}
              />
              Snap to Guides
            </label>
          </div>
        </div>

        {selectedObject ? (
          <div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{selectedObject.type}</p>
            </div>

            {/* Text-specific properties */}
            {(selectedObject.type === 'i-text' || selectedObject.type === 'text' || selectedObject.type === 'textbox') && (
              <>
                <div className="form-group">
                  <label className="form-label">Font Family</label>
                  <select
                    className="form-input"
                    value={(selectedObject as any).fontFamily || 'Arial'}
                    onChange={(e) => {
                      (selectedObject as any).set('fontFamily', e.target.value);
                      fabricCanvas?.requestRenderAll();
                    }}
                  >
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Monaco">Monaco</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Trebuchet MS">Trebuchet MS</option>
                    <option value="Comic Sans MS">Comic Sans MS</option>
                    <option value="Impact">Impact</option>
                    <option value="Palatino">Palatino</option>
                    <option value="Garamond">Garamond</option>
                    <option value="Bookman">Bookman</option>
                    <option value="Avant Garde">Avant Garde</option>
                    <option value="Optima">Optima</option>
                    <option value="Gill Sans">Gill Sans</option>
                    <option value="Baskerville">Baskerville</option>
                    <option value="Didot">Didot</option>
                    <option value="Futura">Futura</option>
                    <option value="Hoefler Text">Hoefler Text</option>
                    <option value="American Typewriter">American Typewriter</option>
                    <option value="Copperplate">Copperplate</option>
                    <option value="Papyrus">Papyrus</option>
                    <option value="Brush Script MT">Brush Script MT</option>
                    <option value="-apple-system">SF Pro (System)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Font Size</label>
                  <input
                    type="number"
                    className="form-input"
                    value={(selectedObject as any).fontSize || 24}
                    onChange={(e) => {
                      (selectedObject as any).set('fontSize', parseInt(e.target.value) || 24);
                      fabricCanvas?.requestRenderAll();
                    }}
                    min="1"
                    max="500"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Text Color</label>
                  <input
                    type="color"
                    className="form-input"
                    value={(selectedObject as any).fill || '#000000'}
                    onChange={(e) => {
                      (selectedObject as any).set('fill', e.target.value);
                      fabricCanvas?.requestRenderAll();
                    }}
                    style={{ height: '40px', padding: '4px' }}
                  />
                </div>
              </>
            )}

            {/* Stroke properties for rect/path objects (simple borders) */}
            {(selectedObject.type === 'rect' || selectedObject.type === 'path') && (
              <>
                <div className="form-group">
                  <label className="form-label">Stroke Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={(selectedObject as any).stroke || '#000000'}
                      onChange={(e) => {
                        selectedObject.set('stroke', e.target.value);
                        fabricCanvas?.requestRenderAll();
                        setDirty(true);
                      }}
                      style={{ width: '50px', height: '38px', cursor: 'pointer', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                    />
                    <input
                      type="text"
                      value={(selectedObject as any).stroke || '#000000'}
                      onChange={(e) => {
                        selectedObject.set('stroke', e.target.value);
                        fabricCanvas?.requestRenderAll();
                        setDirty(true);
                      }}
                      placeholder="#000000"
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        fontSize: '0.875rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Stroke Width</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={(selectedObject as any).strokeWidth || 1}
                      onChange={(e) => {
                        const newWidth = parseFloat(e.target.value) || 1;
                        selectedObject.set('strokeWidth', newWidth);
                        fabricCanvas?.requestRenderAll();
                        setDirty(true);
                      }}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      value={(selectedObject as any).strokeWidth || 1}
                      onChange={(e) => {
                        const newWidth = parseFloat(e.target.value) || 1;
                        selectedObject.set('strokeWidth', newWidth);
                        fabricCanvas?.requestRenderAll();
                        setDirty(true);
                      }}
                      min="0.5"
                      max="10"
                      step="0.5"
                      style={{
                        width: '70px',
                        padding: '4px 8px',
                        fontSize: '0.875rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Frame/Border-specific properties (groups without fillPatternType) */}
            {selectedObject.type === 'group' && !(selectedObject as any).fillPatternType && (
              <>
                <div className="form-group">
                  <label className="form-label">Stroke Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={(() => {
                        const group = selectedObject as any;
                        const objects = group.getObjects?.() || [];
                        const firstWithStroke = objects.find((o: any) => o.stroke);
                        return firstWithStroke?.stroke || '#000000';
                      })()}
                      onChange={(e) => {
                        const group = selectedObject as any;
                        const objects = group.getObjects?.() || [];
                        objects.forEach((obj: any) => {
                          if (obj.stroke) {
                            obj.set('stroke', e.target.value);
                          }
                        });
                        fabricCanvas?.requestRenderAll();
                        setDirty(true);
                      }}
                      style={{ width: '50px', height: '38px', cursor: 'pointer', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                    />
                    <input
                      type="text"
                      value={(() => {
                        const group = selectedObject as any;
                        const objects = group.getObjects?.() || [];
                        const firstWithStroke = objects.find((o: any) => o.stroke);
                        return firstWithStroke?.stroke || '#000000';
                      })()}
                      onChange={(e) => {
                        const group = selectedObject as any;
                        const objects = group.getObjects?.() || [];
                        objects.forEach((obj: any) => {
                          if (obj.stroke) {
                            obj.set('stroke', e.target.value);
                          }
                        });
                        fabricCanvas?.requestRenderAll();
                        setDirty(true);
                      }}
                      placeholder="#000000"
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        fontSize: '0.875rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Stroke Width</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={(() => {
                        const group = selectedObject as any;
                        const objects = group.getObjects?.() || [];
                        const firstWithStroke = objects.find((o: any) => o.strokeWidth);
                        return firstWithStroke?.strokeWidth || 1;
                      })()}
                      onChange={(e) => {
                        const newWidth = parseFloat(e.target.value) || 1;
                        const group = selectedObject as any;
                        const objects = group.getObjects?.() || [];
                        objects.forEach((obj: any) => {
                          obj.set('strokeWidth', newWidth);
                        });
                        fabricCanvas?.requestRenderAll();
                        setDirty(true);
                      }}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      value={(() => {
                        const group = selectedObject as any;
                        const objects = group.getObjects?.() || [];
                        const firstWithStroke = objects.find((o: any) => o.strokeWidth);
                        return firstWithStroke?.strokeWidth || 1;
                      })()}
                      onChange={(e) => {
                        const newWidth = parseFloat(e.target.value) || 1;
                        const group = selectedObject as any;
                        const objects = group.getObjects?.() || [];
                        objects.forEach((obj: any) => {
                          obj.set('strokeWidth', newWidth);
                        });
                        fabricCanvas?.requestRenderAll();
                        setDirty(true);
                      }}
                      min="0.5"
                      max="10"
                      step="0.5"
                      style={{
                        width: '70px',
                        padding: '4px 8px',
                        fontSize: '0.875rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Fill Pattern-specific properties */}
            {selectedObject.type === 'group' && (selectedObject as any).fillPatternType && (
              <>
                <div className="form-group">
                  <label className="form-label">Pattern Type</label>
                  <p style={{ fontSize: '0.875rem', textTransform: 'capitalize', color: 'var(--color-text-primary)' }}>
                    {(selectedObject as any).fillPatternType?.replace('-', ' ') || 'Fill Pattern'}
                  </p>
                </div>
                <div className="form-group">
                  <label className="form-label">Pattern Spacing (mm)</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="range"
                      min="2"
                      max="15"
                      step="0.5"
                      value={(selectedObject as any).fillPatternSpacing || 4}
                      onChange={(e) => {
                        const newSpacing = parseFloat(e.target.value) || 4;
                        regenerateFillPattern(selectedObject, { spacing: newSpacing });
                      }}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      value={(selectedObject as any).fillPatternSpacing || 4}
                      onChange={(e) => {
                        const newSpacing = parseFloat(e.target.value) || 4;
                        regenerateFillPattern(selectedObject, { spacing: newSpacing });
                      }}
                      min="2"
                      max="15"
                      step="0.5"
                      style={{
                        width: '70px',
                        padding: '4px 8px',
                        fontSize: '0.875rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    Adjusts pattern density. Higher = more spaced out.
                  </p>
                </div>
                <div className="form-group">
                  <label className="form-label">Stroke Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={(selectedObject as any).fillPatternStroke || '#000000'}
                      onChange={(e) => {
                        regenerateFillPattern(selectedObject, { strokeColor: e.target.value });
                      }}
                      style={{ width: '50px', height: '38px', cursor: 'pointer', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                    />
                    <input
                      type="text"
                      value={(selectedObject as any).fillPatternStroke || '#000000'}
                      onChange={(e) => {
                        regenerateFillPattern(selectedObject, { strokeColor: e.target.value });
                      }}
                      placeholder="#000000"
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        fontSize: '0.875rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Stroke Width (mm)</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={(selectedObject as any).fillPatternStrokeWidth || 0.5}
                      onChange={(e) => {
                        const newWidth = parseFloat(e.target.value) || 0.5;
                        regenerateFillPattern(selectedObject, { strokeWidth: newWidth });
                      }}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      value={(selectedObject as any).fillPatternStrokeWidth || 0.5}
                      onChange={(e) => {
                        const newWidth = parseFloat(e.target.value) || 0.5;
                        regenerateFillPattern(selectedObject, { strokeWidth: newWidth });
                      }}
                      min="0.1"
                      max="3"
                      step="0.1"
                      style={{
                        width: '70px',
                        padding: '4px 8px',
                        fontSize: '0.875rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Position</label>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                X: {Math.round(selectedObject.left || 0)}, Y: {Math.round(selectedObject.top || 0)}
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Size</label>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                {Math.round((selectedObject.width || 0) * (selectedObject.scaleX || 1))} x{' '}
                {Math.round((selectedObject.height || 0) * (selectedObject.scaleY || 1))}
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Rotation</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={Math.round(selectedObject.angle || 0)}
                  onChange={(e) => {
                    if (fabricCanvas) {
                      const angle = parseFloat(e.target.value) || 0;
                      selectedObject.set('angle', angle);
                      fabricCanvas.requestRenderAll();
                      setDirty(true);
                    }
                  }}
                  style={{
                    width: '80px',
                    padding: '4px 8px',
                    fontSize: '0.875rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)'
                  }}
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  (Alt+drag to snap)
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Select an object to see its properties
          </p>
        )}
        </InlineErrorBoundary>
      </div>

      {/* Footer */}
      <div className="editor-footer">
        <div>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            {currentProject.name} • {currentProject.width_mm}x{currentProject.height_mm}mm
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-warning)' }}>Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Gemini Dialog */}
      {showGeminiDialog && (
        <GeminiDialog
          onClose={() => setShowGeminiDialog(false)}
          onImageGenerated={handleGeminiImageGenerated}
        />
      )}

      {/* QR Code Dialog */}
      {showQRCodeDialog && (
        <QRCodeDialog
          onClose={() => setShowQRCodeDialog(false)}
          onSvgGenerated={handleQRCodeGenerated}
        />
      )}

      {/* Frame Gallery Dialog */}
      {showFrameGalleryDialog && currentProject && (
        <FrameGalleryDialog
          onClose={() => setShowFrameGalleryDialog(false)}
          onFrameSelected={handleFrameGallerySelected}
          canvasWidthMm={currentProject.width_mm}
          canvasHeightMm={currentProject.height_mm}
          canvas={fabricCanvas}
        />
      )}

      {/* Image Process Dialog */}
      {showImageProcessDialog && pendingImageDataUrl && (
        <ImageProcessDialog
          open={showImageProcessDialog}
          onClose={() => {
            setShowImageProcessDialog(false);
            setPendingImageDataUrl(null);
          }}
          imageDataUrl={pendingImageDataUrl}
          onAddToCanvas={handleAddImageToCanvas}
        />
      )}

      {/* Save Indicator */}
      <SaveIndicator />

      {/* Context Menu */}
      {editorUX.contextMenu.visible && (
        <ContextMenu
          x={editorUX.contextMenu.x}
          y={editorUX.contextMenu.y}
          selectedObject={selectedObject}
          hasClipboard={editorUX.hasClipboard}
          onCopy={editorUX.handleCopy}
          onCut={editorUX.handleCut}
          onPaste={editorUX.handlePaste}
          onDuplicate={editorUX.handleDuplicate}
          onDelete={editorUX.handleDelete}
          onBringToFront={editorUX.handleBringToFront}
          onSendToBack={editorUX.handleSendToBack}
          onLock={editorUX.handleLock}
          onUnlock={editorUX.handleUnlock}
          onGroup={editorUX.handleGroup}
          onUngroup={editorUX.handleUngroup}
          onClose={editorUX.closeContextMenu}
        />
      )}
    </div>
  );
}
