import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, Bookmark, Settings } from 'lucide-react';
import { checkGeminiStatus, setGeminiApiKey } from '../../lib/gemini/geminiClient';
import { useImageGalleryStore } from '../../stores/imageGalleryStore';

interface Props {
  onClose: () => void;
  onImageGenerated: (imageBase64: string) => void;
}

const STYLE_OPTIONS = [
  // Classic styles
  { value: 'line_art', label: 'Line Art' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'detailed', label: 'Detailed' },
  // Advanced styles
  { value: 'continuous', label: 'Continuous Line' },
  { value: 'geometric', label: 'Geometric' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'stippling', label: 'Stippling' },
  { value: 'hatching', label: 'Hatching' },
  { value: 'contour', label: 'Contour' },
  { value: 'ascii', label: 'ASCII Art' },
  { value: 'cubist', label: 'Cubist' },
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'circuit', label: 'Circuit Board' },
];

export function GeminiDialog({ onClose, onImageGenerated }: Props) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('line_art');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const { addImage } = useImageGalleryStore();

  useEffect(() => {
    checkGeminiStatus().then((status) => {
      setIsConfigured(status.configured);
      if (!status.configured) {
        setError(status.message);
      }
    });
  }, []);

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setGeminiApiKey(apiKeyInput.trim());
      setIsConfigured(true);
      setShowApiKeyInput(false);
      setError(null);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError('Image generation with Gemini is coming soon. This requires Imagen API integration which is in development. For now, please use the "Process Image" feature to convert existing images to plotter-friendly line art.');
    setIsLoading(false);

    // Image generation will be implemented when Imagen API is available
    // const result = await generateImage(prompt, style);
    // setPreviewImage(`data:image/png;base64,${result.image_base64}`);
  };

  const handleApply = () => {
    if (previewImage) {
      // Extract base64 from data URL
      const base64 = previewImage.split(',')[1];
      onImageGenerated(base64);
      onClose();
    }
  };

  const handleSaveToGallery = async () => {
    if (!previewImage) return;

    setIsSaving(true);
    try {
      await addImage(previewImage, 'gemini', {
        prompt,
        style,
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
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header flex justify-between items-center">
          <h2 className="dialog-title">
            <Sparkles size={20} style={{ marginRight: 8, display: 'inline' }} />
            Generate Image with AI
          </h2>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="dialog-content">
          {!isConfigured && !showApiKeyInput && (
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
              <p style={{ marginBottom: 8 }}>
                Gemini API is not configured. Click below to add your API key.
              </p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowApiKeyInput(true)}
              >
                <Settings size={14} style={{ marginRight: 4 }} />
                Configure API Key
              </button>
            </div>
          )}

          {showApiKeyInput && (
            <div className="form-group">
              <label className="form-label">Gemini API Key</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  className="form-input"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter your Gemini API key"
                />
                <button className="btn btn-primary" onClick={handleSaveApiKey}>
                  Save
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                Get your API key from{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Google AI Studio
                </a>
              </p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Describe what you want to generate</label>
            <textarea
              className="form-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A simple flower with geometric petals..."
              rows={3}
              disabled={!isConfigured}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Style</label>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`btn ${style === option.value ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStyle(option.value)}
                  disabled={!isConfigured}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
                marginTop: 8,
              }}
            >
              Images are generated as line art suitable for pen plotting
            </p>
          </div>

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

          {previewImage && (
            <div className="form-group">
              <label className="form-label">Preview</label>
              <div
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: 8,
                  background: 'white',
                }}
              >
                <img
                  src={previewImage}
                  alt="Generated preview"
                  style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }}
                />
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSaveToGallery}
                disabled={isSaving}
                style={{ marginTop: 8 }}
              >
                <Bookmark size={14} />
                {isSaving ? 'Saving...' : 'Save to Gallery'}
              </button>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim() || !isConfigured}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </button>
          <button className="btn btn-primary" onClick={handleApply} disabled={!previewImage}>
            Add to Canvas
          </button>
        </div>
      </div>
    </div>
  );
}
