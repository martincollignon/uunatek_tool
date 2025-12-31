import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Play, Type, Image, Layers, Trash2, Sparkles, QrCode, Square, ChevronDown, ZoomIn, ZoomOut, Maximize2, Grid3x3, RotateCw } from 'lucide-react';
import { Canvas, FabricObject, IText, FabricImage, util, loadSVGFromString } from 'fabric';
import { useProjectStore } from '../stores/projectStore';
import { useCanvasStore } from '../stores/canvasStore';
import { useAlignmentGuidesStore } from '../stores/alignmentGuidesStore';
import { FabricCanvas, ZoomControls } from '../components/canvas/FabricCanvas';
import { LayerPanel } from '../components/canvas/LayerPanel';
import { GeminiDialog } from '../components/dialogs/GeminiDialog';
import { QRCodeDialog } from '../components/dialogs/QRCodeDialog';
import { FrameGalleryDialog } from '../components/dialogs/FrameGalleryDialog';
import ImageProcessDialog from '../components/dialogs/ImageProcessDialog';
import { validateImageFile, fileToDataURL, needsConversion } from '../utils/imageUtils';
import { createSimpleFrame, createDoubleFrame, createRoundedFrame, createOvalFrame } from '../utils/frameGenerator';
import {
  createPolkaDotFill,
  createDiagonalStripeFill,
  createChevronFill,
  createCheckerboardFill,
  createGraphGridFill,
  createPlusGridFill,
  createSquiggleFill,
} from '../utils/fillPatterns';
import type { CanvasSide } from '../types';

// Map pattern IDs to their creation functions
const FILL_PATTERN_CREATORS: Record<string, (options: any) => any> = {
  'polkadot': createPolkaDotFill,
  'diagonal': createDiagonalStripeFill,
  'chevron-fill': createChevronFill,
  'checkerboard': createCheckerboardFill,
  'graph': createGraphGridFill,
  'plus': createPlusGridFill,
  'squiggle': createSquiggleFill,
};

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentProject, loadProject, isLoading: projectLoading } = useProjectStore();
  const { currentSide, setSide, saveCanvas, isDirty, setDirty, isRotated, setRotated } = useCanvasStore();
  const {
    showStaticGuides,
    showSmartGuides,
    showCenter,
    showThirds,
    showHalves,
    snapToGuides,
    toggleStaticGuides,
    toggleSmartGuides,
    toggleCenter,
    toggleThirds,
    toggleHalves,
    toggleSnapToGuides,
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      const isEditingText = activeElement?.tagName === 'INPUT' ||
                            activeElement?.tagName === 'TEXTAREA' ||
                            activeElement?.isContentEditable;

      // Don't handle keyboard shortcuts while editing text
      if (isEditingText) return;

      // Handle delete/backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (fabricCanvas && selectedObject) {
          e.preventDefault();
          const active = fabricCanvas.getActiveObjects();
          if (active.length > 0) {
            active.forEach((obj) => fabricCanvas.remove(obj));
            fabricCanvas.discardActiveObject();
            fabricCanvas.requestRenderAll();
            setSelectedObject(null);
          }
        }
      }

      // Handle arrow keys for moving objects
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (fabricCanvas && selectedObject) {
          e.preventDefault();

          // Determine step size: 10px with Shift, 1px otherwise
          const step = e.shiftKey ? 10 : 1;

          const currentLeft = selectedObject.left || 0;
          const currentTop = selectedObject.top || 0;

          switch (e.key) {
            case 'ArrowUp':
              selectedObject.set('top', currentTop - step);
              break;
            case 'ArrowDown':
              selectedObject.set('top', currentTop + step);
              break;
            case 'ArrowLeft':
              selectedObject.set('left', currentLeft - step);
              break;
            case 'ArrowRight':
              selectedObject.set('left', currentLeft + step);
              break;
          }

          selectedObject.setCoords();
          fabricCanvas.requestRenderAll();
          setDirty(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [fabricCanvas, selectedObject, setDirty]);

  const handleSave = async () => {
    if (!fabricCanvas || !projectId) return;
    const json = fabricCanvas.toJSON();
    await saveCanvas(projectId, json as Record<string, unknown>, currentSide);
  };

  // Auto-save when canvas becomes dirty
  useEffect(() => {
    if (!isDirty || !fabricCanvas || !projectId) return;

    // Debounce auto-save by 500ms to avoid excessive saves
    const timeoutId = setTimeout(async () => {
      const json = fabricCanvas.toJSON();
      await saveCanvas(projectId, json as Record<string, unknown>, currentSide);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [isDirty, fabricCanvas, projectId, currentSide, saveCanvas]);

  const handleAddText = () => {
    if (!fabricCanvas) return;
    const text = new IText('Double-click to edit', {
      left: fabricCanvas.width! / 2,
      top: fabricCanvas.height! / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: 'Arial',
      fontSize: 24,
      fill: '#000000',
      editable: true,
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.requestRenderAll();
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
    if (!fabricCanvas) return;

    try {
      const img = await FabricImage.fromURL(dataUrl);

      // Scale to fit canvas if too large
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
    } catch (error) {
      console.error('Failed to add image to canvas:', error);
      alert(`Failed to add image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteSelected = () => {
    if (!fabricCanvas) return;
    const active = fabricCanvas.getActiveObjects();
    if (active.length > 0) {
      active.forEach((obj) => fabricCanvas.remove(obj));
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
      setSelectedObject(null);
    }
  };

  const handleBringToFront = () => {
    if (!fabricCanvas || !selectedObject) return;
    fabricCanvas.bringObjectToFront(selectedObject);
    fabricCanvas.requestRenderAll();
    // Trigger a modified event to update the layer panel
    fabricCanvas.fire('object:modified', { target: selectedObject });
  };

  const handleSendToBack = () => {
    if (!fabricCanvas || !selectedObject) return;
    fabricCanvas.sendObjectToBack(selectedObject);
    fabricCanvas.requestRenderAll();
    // Trigger a modified event to update the layer panel
    fabricCanvas.fire('object:modified', { target: selectedObject });
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

  // Regenerate fill pattern with updated properties
  const regenerateFillPattern = (
    obj: FabricObject,
    updates: {
      spacing?: number;
      strokeColor?: string;
      strokeWidth?: number;
    }
  ) => {
    if (!fabricCanvas || !currentProject) return;

    const patternType = (obj as any).fillPatternType;
    const createFn = FILL_PATTERN_CREATORS[patternType];
    if (!createFn) return;

    // Get existing properties, applying updates
    const borderMargin = (obj as any).fillPatternBorderMargin || 10;
    const spacing = updates.spacing ?? (obj as any).fillPatternSpacing ?? 4;
    const strokeColor = updates.strokeColor ?? (obj as any).fillPatternStroke ?? '#000000';
    const strokeWidth = updates.strokeWidth ?? (obj as any).fillPatternStrokeWidth ?? 0.5;
    const rotation = obj.angle || 0;

    // Store position before removing
    const left = obj.left;
    const top = obj.top;

    // Create new pattern with updated properties
    const newPattern = createFn({
      canvasWidthMm: currentProject.width_mm,
      canvasHeightMm: currentProject.height_mm,
      borderMarginMm: borderMargin,
      spacingMm: spacing,
      strokeWidth: strokeWidth * 3,
      stroke: strokeColor,
      rotation: 0, // We'll set rotation after
    });

    // Copy metadata to new pattern
    newPattern.set('fillPatternType', patternType);
    newPattern.set('fillPatternSpacing', spacing);
    newPattern.set('fillPatternBorderMargin', borderMargin);
    newPattern.set('fillPatternStroke', strokeColor);
    newPattern.set('fillPatternStrokeWidth', strokeWidth);
    newPattern.set('angle', rotation);
    newPattern.set('left', left);
    newPattern.set('top', top);

    // Remove old pattern and add new one
    fabricCanvas.remove(obj);
    fabricCanvas.add(newPattern);
    fabricCanvas.setActiveObject(newPattern);
    setSelectedObject(newPattern);
    fabricCanvas.requestRenderAll();
    setDirty(true);
  };

  if (projectLoading || !currentProject) {
    return (
      <div className="page">
        <p>Loading project...</p>
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
        <h3 style={{ marginBottom: 16, fontSize: '0.875rem', fontWeight: 600 }}>
          <Layers size={16} style={{ marginRight: 8, display: 'inline' }} />
          Layers
        </h3>
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
      </div>

      {/* Canvas */}
      <div className="editor-canvas-container">
        <FabricCanvas
          width={currentProject.width_mm}
          height={currentProject.height_mm}
          projectId={currentProject.id}
          side={currentSide}
          onCanvasReady={setFabricCanvas}
          onSelectionChange={setSelectedObject}
          onZoomControlsReady={setZoomControls}
          onZoomChange={setZoomLevel}
        />

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
        <h3 style={{ marginBottom: 16, fontSize: '0.875rem', fontWeight: 600 }}>Properties</h3>

        {/* Alignment Guides Settings */}
        <div style={{ marginBottom: 20, padding: 12, background: 'var(--color-bg)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <h4 style={{ marginBottom: 12, fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
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
              <p style={{ fontSize: '0.875rem' }}>{selectedObject.type}</p>
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
                  <p style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>
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
              <p style={{ fontSize: '0.875rem' }}>
                X: {Math.round(selectedObject.left || 0)}, Y: {Math.round(selectedObject.top || 0)}
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Size</label>
              <p style={{ fontSize: '0.875rem' }}>
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
    </div>
  );
}
