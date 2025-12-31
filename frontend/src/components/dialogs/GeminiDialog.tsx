import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { geminiApi } from '../../services/api';

interface Props {
  onClose: () => void;
  onImageGenerated: (imageBase64: string) => void;
}

const STYLE_OPTIONS = [
  { value: 'line_art', label: 'Line Art' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'detailed', label: 'Detailed' },
];

export function GeminiDialog({ onClose, onImageGenerated }: Props) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('line_art');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    geminiApi.checkStatus().then((status) => {
      setIsConfigured(status.configured);
      if (!status.configured) {
        setError(status.message);
      }
    });
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await geminiApi.generate(prompt, style);
      setPreviewImage(`data:image/png;base64,${result.image_base64}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate image';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (previewImage) {
      // Extract base64 from data URL
      const base64 = previewImage.split(',')[1];
      onImageGenerated(base64);
      onClose();
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
          {!isConfigured && (
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
              Gemini API is not configured. Set the GEMINI_API_KEY environment variable to enable AI
              image generation.
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
