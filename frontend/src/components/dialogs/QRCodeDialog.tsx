import { useState } from 'react';
import { X, QrCode, Loader2 } from 'lucide-react';
import { generateQRCode } from '../../lib/qrcode/qrcodeGenerator';

interface Props {
  onClose: () => void;
  onSvgGenerated: (svg: string, widthMm: number, heightMm: number) => void;
}

type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

const ERROR_CORRECTION_OPTIONS: { value: ErrorCorrectionLevel; label: string; description: string }[] = [
  { value: 'L', label: 'Low', description: '~7% recovery' },
  { value: 'M', label: 'Medium', description: '~15% recovery' },
  { value: 'Q', label: 'Quartile', description: '~25% recovery' },
  { value: 'H', label: 'High', description: '~30% recovery' },
];

export function QRCodeDialog({ onClose, onSvgGenerated }: Props) {
  const [content, setContent] = useState('');
  const [errorCorrection, setErrorCorrection] = useState<ErrorCorrectionLevel>('H');
  const [sizeMm, setSizeMm] = useState(40);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  const handleGenerate = async () => {
    if (!content.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await generateQRCode(content, errorCorrection, sizeMm);
      setPreviewSvg(result.svg);
      setDimensions({ width: result.width_mm, height: result.height_mm });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate QR code';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (previewSvg && dimensions) {
      onSvgGenerated(previewSvg, dimensions.width, dimensions.height);
      onClose();
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header flex justify-between items-center">
          <h2 className="dialog-title">
            <QrCode size={20} style={{ marginRight: 8, display: 'inline' }} />
            Generate QR Code
          </h2>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="dialog-content">
          <div className="form-group">
            <label className="form-label">Content (URL or text)</label>
            <input
              type="text"
              className="form-input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Error Correction</label>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {ERROR_CORRECTION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`btn ${errorCorrection === option.value ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setErrorCorrection(option.value)}
                  title={option.description}
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
              High error correction recommended for pen plotters (tolerates line imperfections)
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Size: {sizeMm}mm</label>
            <input
              type="range"
              min={25}
              max={80}
              value={sizeMm}
              onChange={(e) => setSizeMm(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              <span>25mm</span>
              <span>80mm</span>
            </div>
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

          {previewSvg && (
            <div className="form-group">
              <label className="form-label">Preview</label>
              <div
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: 16,
                  background: 'white',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                  style={{ maxWidth: 200, maxHeight: 200 }}
                />
              </div>
              {dimensions && (
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  {dimensions.width}mm x {dimensions.height}mm
                </p>
              )}
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
            disabled={isLoading || !content.trim()}
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
          <button className="btn btn-primary" onClick={handleApply} disabled={!previewSvg}>
            Add to Canvas
          </button>
        </div>
      </div>
    </div>
  );
}
