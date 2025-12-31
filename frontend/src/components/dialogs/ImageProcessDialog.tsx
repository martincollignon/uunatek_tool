import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { geminiApi } from '../../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  imageDataUrl: string;
  onAddToCanvas: (processedDataUrl: string) => void;
}

const STYLE_OPTIONS = [
  { value: 'line_art', label: 'Line Art', description: 'Clean outlines, bold lines' },
  { value: 'sketch', label: 'Sketch', description: 'Varied line weights, artistic' },
  { value: 'minimal', label: 'Minimal', description: 'Simple shapes, essential lines' },
  { value: 'detailed', label: 'Detailed', description: 'Cross-hatching, intricate shading' },
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

  if (!open) return null;

  const handleAddRaw = () => {
    onAddToCanvas(imageDataUrl);
    onClose();
  };

  const handleProcess = async () => {
    setProcessing(true);
    setError(null);

    try {
      // Convert data URL to base64
      const base64 = imageDataUrl.split(',')[1];

      // Call Gemini API to process the image
      const result = await geminiApi.processImage(
        base64,
        useCustomPrompt ? undefined : style,
        useCustomPrompt ? customPrompt : undefined,
        removeBackground,
        threshold,
        padding
      );

      // Convert response to data URL
      // Add timestamp to ensure React sees this as a new value even if base64 is somehow cached
      const timestamp = Date.now();
      const processedDataUrl = `data:image/png;base64,${result.image_base64}`;
      console.log(`[ImageProcessDialog] Received processed image at ${timestamp}, length: ${result.image_base64.length}`);
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

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header flex justify-between items-center">
          <h2 className="dialog-title">Add Image to Canvas</h2>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="dialog-content">
          <div
            style={{
              padding: 12,
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: 'var(--radius)',
              marginBottom: 16,
              color: 'var(--color-text-secondary)',
              fontSize: '0.875rem',
            }}
          >
            Raw raster images are difficult to plot. You can add the image as-is (free), or optionally
            use AI to convert to line art suitable for pen plotting (requires Gemini API credits).
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {/* Original Image Preview */}
            <div style={{ flex: 1 }}>
              <label className="form-label">Original Image</label>
              <div
                style={{
                  width: '100%',
                  height: 200,
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'white',
                }}
              >
                <img
                  src={imageDataUrl}
                  alt="Original"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>
            </div>

            {/* Processed Image Preview */}
            <div style={{ flex: 1 }}>
              <label className="form-label">Processed Image</label>
              <div
                style={{
                  width: '100%',
                  height: 200,
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'white',
                }}
              >
                {processing ? (
                  <div style={{ textAlign: 'center' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      Processing...
                    </p>
                  </div>
                ) : processedImage ? (
                  <img
                    key={processedImage}
                    src={processedImage}
                    alt="Processed"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    Click "Process with AI" to convert
                  </p>
                )}
              </div>
            </div>
          </div>

          {!processedImage && (
            <>
              {/* Background Removal Options */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={removeBackground}
                    onChange={(e) => setRemoveBackground(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  Remove Background & Auto-Crop
                </label>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    marginTop: 4,
                    marginBottom: 8,
                  }}
                >
                  Automatically remove white background and crop to content after AI processing
                </p>

                {removeBackground && (
                  <div style={{ marginLeft: 24, marginTop: 8 }}>
                    <div style={{ marginBottom: 8 }}>
                      <label className="form-label" style={{ fontSize: '0.875rem' }}>
                        Threshold: {threshold} (higher = more aggressive)
                      </label>
                      <input
                        type="range"
                        min="200"
                        max="255"
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.875rem' }}>
                        Padding: {padding}px
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={padding}
                        onChange={(e) => setPadding(Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Processing Style</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      className={`btn ${!useCustomPrompt && style === option.value ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        setUseCustomPrompt(false);
                        setStyle(option.value);
                      }}
                      style={{ flex: '1 1 calc(50% - 4px)', minWidth: 140 }}
                    >
                      <div>
                        <div>{option.label}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{option.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  className={`btn ${useCustomPrompt ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setUseCustomPrompt(!useCustomPrompt)}
                  style={{ width: '100%' }}
                >
                  Custom Instructions
                </button>
              </div>

              {useCustomPrompt && (
                <div className="form-group">
                  <label className="form-label">Custom Processing Instructions</label>
                  <textarea
                    className="form-input"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g., Convert to manga-style line art with dramatic shadows"
                    rows={3}
                  />
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-secondary)',
                      marginTop: 4,
                    }}
                  >
                    Describe how you want the image converted for plotting
                  </p>
                </div>
              )}
            </>
          )}

          {error && (
            <div
              style={{
                padding: 12,
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 'var(--radius)',
                marginBottom: 16,
                color: 'var(--color-error)',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="dialog-footer flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {!processedImage ? (
            <>
              <button className="btn btn-primary" onClick={handleAddRaw}>
                Add as-is (Free)
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleProcess}
                disabled={processing || (useCustomPrompt && !customPrompt.trim())}
              >
                {processing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" style={{ marginRight: 4 }} />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} style={{ marginRight: 4 }} />
                    Process with AI (Costs Credits)
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={handleReset}>
                Try Different Style
              </button>
              <button className="btn btn-secondary" onClick={handleAddRaw}>
                Use Original Instead
              </button>
              <button className="btn btn-primary" onClick={handleAddProcessed}>
                Add Processed Image
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
