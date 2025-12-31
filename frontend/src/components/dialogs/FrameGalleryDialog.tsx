import { useState } from 'react';
import { X } from 'lucide-react';
import { createSimpleFrame, createDoubleFrame, createRoundedFrame, createOvalFrame } from '../../utils/frameGenerator';
import {
  createCornerBrackets,
  createCornerFlourish,
  createArtDecoCorners,
  createDottedBorder,
} from '../../utils/decorativeFrames';
import {
  createWaveFrame,
  createZigzagFrame,
  createScallopFrame,
  createDashFrame,
  createDotsFrame,
  createGreekKeyFrame,
} from '../../utils/patternFrames';
import {
  createPolkaDotFill,
  createDiagonalStripeFill,
  createChevronFill,
  createCheckerboardFill,
  createGraphGridFill,
  createPlusGridFill,
  createSquiggleFill,
} from '../../utils/fillPatterns';

type FrameCategory = 'all' | 'simple' | 'corners' | 'patterns' | 'fills';

interface FrameTemplate {
  id: string;
  name: string;
  category: 'simple' | 'corners' | 'patterns' | 'fills';
  icon: string;
  createFn: (options: any) => any;
}

const FRAME_TEMPLATES: FrameTemplate[] = [
  // Simple frames
  { id: 'simple', name: 'Simple', category: 'simple', icon: '▢', createFn: createSimpleFrame },
  { id: 'double', name: 'Double', category: 'simple', icon: '▢▢', createFn: createDoubleFrame },
  { id: 'rounded', name: 'Rounded', category: 'simple', icon: '◠', createFn: createRoundedFrame },
  { id: 'oval', name: 'Oval', category: 'simple', icon: '◯', createFn: createOvalFrame },

  // Corner frames
  { id: 'brackets', name: 'Brackets', category: 'corners', icon: '┌─┐', createFn: createCornerBrackets },
  { id: 'flourish', name: 'Flourish', category: 'corners', icon: '╭─╮', createFn: createCornerFlourish },
  { id: 'artdeco', name: 'Art Deco', category: 'corners', icon: '◢■◣', createFn: createArtDecoCorners },
  { id: 'dotted', name: 'Dotted', category: 'corners', icon: '• • •', createFn: createDottedBorder },

  // Pattern frames
  { id: 'wave', name: 'Wave', category: 'patterns', icon: '∿∿', createFn: createWaveFrame },
  { id: 'zigzag', name: 'Zigzag', category: 'patterns', icon: '⋀⋀', createFn: createZigzagFrame },
  { id: 'scallop', name: 'Scallop', category: 'patterns', icon: '⌢⌢', createFn: createScallopFrame },
  { id: 'dash', name: 'Dash', category: 'patterns', icon: '— —', createFn: createDashFrame },
  { id: 'dots', name: 'Dots', category: 'patterns', icon: '• • •', createFn: createDotsFrame },
  { id: 'greekkey', name: 'Greek Key', category: 'patterns', icon: '┌┐└┘', createFn: createGreekKeyFrame },

  // Fill patterns (Neo-Brutalist/Memphis style)
  { id: 'polkadot', name: 'Polka Dot', category: 'fills', icon: '• •', createFn: createPolkaDotFill },
  { id: 'diagonal', name: 'Diagonal Stripe', category: 'fills', icon: '/ /', createFn: createDiagonalStripeFill },
  { id: 'chevron-fill', name: 'Chevron', category: 'fills', icon: '⋁⋁', createFn: createChevronFill },
  { id: 'checkerboard', name: 'Checkerboard', category: 'fills', icon: '▦', createFn: createCheckerboardFill },
  { id: 'graph', name: 'Graph Grid', category: 'fills', icon: '⊞', createFn: createGraphGridFill },
  { id: 'plus', name: 'Plus Grid', category: 'fills', icon: '+ +', createFn: createPlusGridFill },
  { id: 'squiggle', name: 'Squiggle', category: 'fills', icon: '∿', createFn: createSquiggleFill },
];

interface FrameGalleryDialogProps {
  onClose: () => void;
  onFrameSelected: (frame: any) => void;
  canvasWidthMm: number;
  canvasHeightMm: number;
  canvas?: any; // Fabric canvas instance to detect existing borders
}

export function FrameGalleryDialog({
  onClose,
  onFrameSelected,
  canvasWidthMm,
  canvasHeightMm,
  canvas,
}: FrameGalleryDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<FrameCategory>('all');
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);
  const [strokeWidthMm, setStrokeWidthMm] = useState(0.5);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [drawBorder, setDrawBorder] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [spacingMm, setSpacingMm] = useState(4); // Pattern spacing for fills

  const filteredFrames = FRAME_TEMPLATES.filter(
    (frame) => selectedCategory === 'all' || frame.category === selectedCategory
  );

  // Detect the innermost border margin from existing rectangles on canvas
  const detectBorderMargin = (): number => {
    if (!canvas) return 10; // Default if no canvas provided

    const SCALE = 3; // pixels per mm
    let minMargin = 10; // Default border margin

    // Get all objects on canvas
    const objects = canvas.getObjects();

    // Look for rectangles that might be borders
    for (const obj of objects) {
      if (obj.type === 'rect' || obj.type === 'path') {
        // Calculate the margin from the edge
        // A border rect typically has left/top near 0 and width/height near canvas size
        const left = (obj.left || 0) / SCALE;
        const top = (obj.top || 0) / SCALE;
        const width = ((obj.width || 0) * (obj.scaleX || 1)) / SCALE;
        const height = ((obj.height || 0) * (obj.scaleY || 1)) / SCALE;

        // Check if this looks like a border (close to edges and nearly full canvas size)
        const isLikelyBorder =
          left < 5 && // Near left edge
          top < 5 && // Near top edge
          width > canvasWidthMm * 0.8 && // At least 80% of canvas width
          height > canvasHeightMm * 0.8; // At least 80% of canvas height

        if (isLikelyBorder) {
          // Calculate margin from all four sides
          const leftMargin = left;
          const topMargin = top;
          const rightMargin = canvasWidthMm - (left + width);
          const bottomMargin = canvasHeightMm - (top + height);

          // Find the maximum margin (innermost border)
          const maxMargin = Math.max(leftMargin, topMargin, rightMargin, bottomMargin);

          // Update minMargin if we found a larger border
          if (maxMargin > minMargin) {
            minMargin = maxMargin;
          }
        }
      }
    }

    return minMargin;
  };

  const handleAddFrame = () => {
    if (!selectedFrame) return;

    const template = FRAME_TEMPLATES.find((f) => f.id === selectedFrame);
    if (!template) return;

    // Detect existing border margin for fill patterns
    const detectedBorderMargin = template.category === 'fills' ? detectBorderMargin() : 10;

    let frame;
    if (template.category === 'simple') {
      // Simple frames use frameGenerator options
      frame = template.createFn({
        canvasWidthMm,
        canvasHeightMm,
        strokeWidthMm,
        strokeColor,
        drawBorder,
      });
    } else if (template.category === 'corners') {
      // Decorative frames use decorativeFrames options
      frame = template.createFn({
        widthMm: canvasWidthMm,
        heightMm: canvasHeightMm,
        strokeWidth: strokeWidthMm * 3, // Convert mm to pixels
        strokeColor,
        drawBorder,
      });
    } else if (template.category === 'fills') {
      // Fill patterns use fillPatterns options with detected border
      frame = template.createFn({
        canvasWidthMm,
        canvasHeightMm,
        borderMarginMm: detectedBorderMargin,
        spacingMm,
        strokeWidth: strokeWidthMm * 3, // Convert mm to pixels
        stroke: strokeColor,
        drawBorder,
        rotation,
      });
      // Store metadata on the group for later editing
      if (frame) {
        frame.set('fillPatternType', template.id);
        frame.set('fillPatternSpacing', spacingMm);
        frame.set('fillPatternBorderMargin', detectedBorderMargin);
        frame.set('fillPatternStroke', strokeColor);
        frame.set('fillPatternStrokeWidth', strokeWidthMm);
      }
    } else {
      // Pattern frames use patternFrames options
      frame = template.createFn({
        width: canvasWidthMm,
        height: canvasHeightMm,
        thickness: 5,
        margin: 10,
        strokeWidth: strokeWidthMm * 3, // Convert mm to pixels
        stroke: strokeColor,
        drawBorder,
      });
    }

    // Only add frame if it's not null (drawBorder might be false)
    if (frame !== null && frame !== undefined) {
      onFrameSelected(frame);
    }
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog frame-gallery-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="dialog-title">Add Frame</h2>
          <button className="btn btn-icon" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="dialog-content">
          {/* Category Tabs */}
          <div className="tabs" style={{ marginBottom: 24 }}>
            <button
              className={`tab ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </button>
            <button
              className={`tab ${selectedCategory === 'simple' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('simple')}
            >
              Simple
            </button>
            <button
              className={`tab ${selectedCategory === 'corners' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('corners')}
            >
              Corners
            </button>
            <button
              className={`tab ${selectedCategory === 'patterns' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('patterns')}
            >
              Patterns
            </button>
            <button
              className={`tab ${selectedCategory === 'fills' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('fills')}
            >
              Fills
            </button>
          </div>

          {/* Frame Grid */}
          <div className="frame-grid">
            {filteredFrames.map((frame) => (
              <button
                key={frame.id}
                className={`frame-card ${selectedFrame === frame.id ? 'selected' : ''}`}
                onClick={() => setSelectedFrame(frame.id)}
              >
                <div className="frame-icon">{frame.icon}</div>
                <div className="frame-name">{frame.name}</div>
              </button>
            ))}
          </div>

          {/* Options */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 16 }}>Options</h3>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={drawBorder}
                  onChange={(e) => setDrawBorder(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Draw Border</span>
              </label>
              <p style={{ fontSize: '0.75rem', color: '#666', marginTop: 4 }}>
                Uncheck to use border only as a boundary for fills
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Stroke Width (mm)</label>
              <input
                type="number"
                className="form-input"
                value={strokeWidthMm}
                onChange={(e) => setStrokeWidthMm(parseFloat(e.target.value) || 0.5)}
                min="0.1"
                max="5"
                step="0.1"
                disabled={!drawBorder}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Stroke Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  style={{ width: 50, height: 38, cursor: 'pointer' }}
                  disabled={!drawBorder}
                />
                <input
                  type="text"
                  className="form-input"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  placeholder="#000000"
                  disabled={!drawBorder}
                />
              </div>
            </div>

            {selectedFrame && FRAME_TEMPLATES.find((f) => f.id === selectedFrame)?.category === 'fills' && (
              <>
                <div className="form-group">
                  <label className="form-label">Pattern Spacing (mm)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="range"
                      min="2"
                      max="15"
                      step="0.5"
                      value={spacingMm}
                      onChange={(e) => setSpacingMm(parseFloat(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      className="form-input"
                      value={spacingMm}
                      onChange={(e) => setSpacingMm(parseFloat(e.target.value) || 4)}
                      min="2"
                      max="15"
                      step="0.5"
                      style={{ width: 80 }}
                    />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#666', marginTop: 4 }}>
                    Controls density of the pattern. Higher = more spaced out.
                  </p>
                </div>
                <div className="form-group">
                  <label className="form-label">Rotation (degrees)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="15"
                      value={rotation}
                      onChange={(e) => setRotation(parseInt(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      className="form-input"
                      value={rotation}
                      onChange={(e) => setRotation(parseInt(e.target.value) || 0)}
                      min="0"
                      max="360"
                      step="15"
                      style={{ width: 80 }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Preview */}
          {selectedFrame && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 16 }}>Preview</h3>
              <div className="frame-preview">
                <div className="frame-preview-box">
                  <div className="frame-preview-icon">
                    {FRAME_TEMPLATES.find((f) => f.id === selectedFrame)?.icon}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAddFrame}
            disabled={!selectedFrame}
          >
            Add Frame
          </button>
        </div>
      </div>
    </div>
  );
}
