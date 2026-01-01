import { useState, useRef, useCallback } from 'react';
import { X, Sparkles, Loader2, Upload, ImageIcon, Wand2, Check, ChevronDown, RotateCcw, Bookmark } from 'lucide-react';
import { processImageForPlotter } from '../../lib/gemini/geminiClient';
import { preprocessImage } from '../../lib/imageProcessing';
import { useImageGalleryStore } from '../../stores/imageGalleryStore';

interface Props {
  open: boolean;
  onClose: () => void;
  imageDataUrl: string;
  onAddToCanvas: (processedDataUrl: string) => void;
}

const STYLE_OPTIONS = [
  // Classic styles
  { value: 'line_art', label: 'Line Art', description: 'Clean outlines, bold lines', icon: '✏️' },
  { value: 'sketch', label: 'Sketch', description: 'Varied line weights, artistic', icon: '🎨' },
  { value: 'minimal', label: 'Minimal', description: 'Simple shapes, essential lines', icon: '◯' },
  { value: 'detailed', label: 'Detailed', description: 'Cross-hatching, intricate shading', icon: '🖋️' },
  // Advanced styles
  { value: 'continuous', label: 'Continuous Line', description: 'Single line, never lifts', icon: '〰️' },
  { value: 'geometric', label: 'Geometric', description: 'Triangles, circles, polygons', icon: '△' },
  { value: 'spiral', label: 'Spiral', description: 'Vinyl record spiral effect', icon: '🌀' },
  { value: 'stippling', label: 'Stippling', description: 'Dots and pointillism', icon: '∴' },
  { value: 'hatching', label: 'Hatching', description: 'Parallel lines, engraving style', icon: '▤' },
  { value: 'contour', label: 'Contour', description: 'Topographic elevation lines', icon: '◠' },
  { value: 'ascii', label: 'ASCII Art', description: 'Text characters as pixels', icon: '#' },
  { value: 'cubist', label: 'Cubist', description: 'Fragmented, Picasso-style', icon: '◇' },
  { value: 'wireframe', label: 'Wireframe', description: '3D mesh, retro graphics', icon: '⬡' },
  { value: 'circuit', label: 'Circuit Board', description: 'Electronic, technical lines', icon: '⏚' },
];

export default function ImageProcessDialog({ open, onClose, imageDataUrl, onAddToCanvas }: Props) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState('line_art');
  const [customPrompt, setCustomPrompt] = useState('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [threshold, setThreshold] = useState(250);
  const [padding, setPadding] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { addImage } = useImageGalleryStore();

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      if (processedImage) {
        handleAddProcessed();
      } else if (!processing) {
        handleProcess();
      }
    }
  }, [processedImage, processing]);

  if (!open) return null;

  const handleAddRaw = () => {
    onAddToCanvas(imageDataUrl);
    onClose();
  };

  const handleProcess = async () => {
    setProcessing(true);
    setError(null);

    try {
      // Step 1: Preprocess image (background removal, cropping)
      const preprocessedDataUrl = await preprocessImage(imageDataUrl, {
        removeBackground,
        threshold,
        padding,
      });

      // Step 2: Convert to line art using Gemini
      const base64 = preprocessedDataUrl.split(',')[1];
      const result = await processImageForPlotter(
        base64,
        useCustomPrompt ? undefined : style,
        useCustomPrompt ? customPrompt : undefined
      );
      const processedDataUrl = `data:image/png;base64,${result.image_base64}`;
      setProcessedImage(processedDataUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process image';
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddProcessed = () => {
    if (processedImage) {
      onAddToCanvas(processedImage);
      onClose();
    }
  };

  const handleReset = () => {
    setProcessedImage(null);
    setError(null);
  };

  const handleSaveToGallery = async () => {
    if (!processedImage) return;

    setIsSaving(true);
    try {
      // Determine source: 'processed' if Gemini was used, 'upload' otherwise
      const source = useCustomPrompt || style ? 'processed' : 'upload';

      await addImage(processedImage, source, {
        style: !useCustomPrompt ? style : undefined,
        originalFilename: undefined, // We don't have the filename here
      });

      console.log('Image saved to gallery successfully');
    } catch (err) {
      console.error('Failed to save to gallery:', err);
      setError('Failed to save image to gallery');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="linear-dialog-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        ref={dialogRef}
        className="linear-dialog linear-dialog-lg"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="linear-dialog-header">
          <div className="linear-dialog-header-content">
            <div className="linear-dialog-icon">
              <ImageIcon size={18} />
            </div>
            <div>
              <h2 className="linear-dialog-title">Add Image</h2>
              <p className="linear-dialog-subtitle">Add to canvas or convert to line art for plotting</p>
            </div>
          </div>
          <button className="linear-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="linear-dialog-content">
          {/* Info Banner */}
          <div className="linear-info-banner">
            <Sparkles size={16} className="linear-info-icon" />
            <span>Raster images work best when converted to line art for pen plotting</span>
          </div>

          {/* Image Comparison */}
          <div className="linear-image-compare">
            {/* Original */}
            <div className="linear-image-panel">
              <div className="linear-image-label">
                <span className="linear-label-dot original"></span>
                Original
              </div>
              <div className="linear-image-preview">
                <img src={imageDataUrl} alt="Original" />
              </div>
            </div>

            {/* Arrow */}
            <div className="linear-compare-arrow">
              <Wand2 size={20} />
            </div>

            {/* Processed */}
            <div className="linear-image-panel">
              <div className="linear-image-label">
                <span className="linear-label-dot processed"></span>
                Processed
              </div>
              <div className="linear-image-preview">
                {processing ? (
                  <div className="linear-loading-state">
                    <Loader2 size={24} className="animate-spin" />
                    <span>Converting to line art...</span>
                  </div>
                ) : processedImage ? (
                  <img key={processedImage} src={processedImage} alt="Processed" />
                ) : (
                  <div className="linear-empty-state">
                    <div className="linear-empty-icon">
                      <Wand2 size={24} />
                    </div>
                    <span>Click "Convert" to process</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Options - Only show when not processed */}
          {!processedImage && (
            <div className="linear-options-section">
              {/* Style Selection */}
              <div className="linear-form-group">
                <label className="linear-label">Style</label>
                <div className="linear-style-grid">
                  {STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      className={`linear-style-card ${!useCustomPrompt && style === option.value ? 'selected' : ''}`}
                      onClick={() => {
                        setUseCustomPrompt(false);
                        setStyle(option.value);
                      }}
                    >
                      <span className="linear-style-icon">{option.icon}</span>
                      <span className="linear-style-name">{option.label}</span>
                      <span className="linear-style-desc">{option.description}</span>
                      {!useCustomPrompt && style === option.value && (
                        <div className="linear-style-check">
                          <Check size={14} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Prompt Toggle */}
              <button
                className={`linear-custom-toggle ${useCustomPrompt ? 'active' : ''}`}
                onClick={() => setUseCustomPrompt(!useCustomPrompt)}
              >
                <span>Use custom instructions</span>
                <ChevronDown size={16} className={useCustomPrompt ? 'rotated' : ''} />
              </button>

              {useCustomPrompt && (
                <div className="linear-form-group">
                  <textarea
                    className="linear-textarea"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g., Convert to manga-style line art with dramatic shadows"
                    rows={3}
                  />
                </div>
              )}

              {/* Advanced Options */}
              <button
                className={`linear-advanced-toggle ${showAdvanced ? 'active' : ''}`}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>Advanced options</span>
                <ChevronDown size={16} className={showAdvanced ? 'rotated' : ''} />
              </button>

              {showAdvanced && (
                <div className="linear-advanced-options">
                  <label className="linear-checkbox-label">
                    <input
                      type="checkbox"
                      checked={removeBackground}
                      onChange={(e) => setRemoveBackground(e.target.checked)}
                    />
                    <span className="linear-checkbox-text">Remove background & auto-crop</span>
                  </label>

                  {removeBackground && (
                    <div className="linear-slider-group">
                      <div className="linear-slider-row">
                        <label className="linear-slider-label">
                          Threshold
                          <span className="linear-slider-value">{threshold}</span>
                        </label>
                        <input
                          type="range"
                          min="200"
                          max="255"
                          value={threshold}
                          onChange={(e) => setThreshold(Number(e.target.value))}
                          className="linear-slider"
                        />
                      </div>
                      <div className="linear-slider-row">
                        <label className="linear-slider-label">
                          Padding
                          <span className="linear-slider-value">{padding}px</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={padding}
                          onChange={(e) => setPadding(Number(e.target.value))}
                          className="linear-slider"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="linear-error-banner">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="linear-error-dismiss">
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="linear-dialog-footer">
          <div className="linear-footer-hint">
            <kbd>⌘</kbd> + <kbd>Enter</kbd> to confirm
          </div>
          <div className="linear-footer-actions">
            {!processedImage ? (
              <>
                <button className="linear-btn linear-btn-ghost" onClick={handleAddRaw}>
                  <Upload size={16} />
                  Add Original
                </button>
                <button
                  className="linear-btn linear-btn-primary"
                  onClick={handleProcess}
                  disabled={processing || (useCustomPrompt && !customPrompt.trim())}
                >
                  {processing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Convert to Line Art
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button className="linear-btn linear-btn-ghost" onClick={handleReset}>
                  <RotateCcw size={16} />
                  Try Again
                </button>
                <button
                  className="linear-btn linear-btn-secondary"
                  onClick={handleSaveToGallery}
                  disabled={isSaving}
                >
                  <Bookmark size={16} />
                  {isSaving ? 'Saving...' : 'Save to Gallery'}
                </button>
                <button className="linear-btn linear-btn-secondary" onClick={handleAddRaw}>
                  Use Original
                </button>
                <button className="linear-btn linear-btn-primary" onClick={handleAddProcessed}>
                  <Check size={16} />
                  Add to Canvas
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
