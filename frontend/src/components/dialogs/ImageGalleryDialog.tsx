import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Sparkles, Upload, ImageIcon, Trash2 } from 'lucide-react';
import { useImageGalleryStore } from '../../stores/imageGalleryStore';
import type { GalleryImage } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onImageSelected: (dataUrl: string) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  gemini: 'AI Generated',
  upload: 'Uploaded',
  processed: 'Processed',
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  gemini: <Sparkles size={12} />,
  upload: <Upload size={12} />,
  processed: <ImageIcon size={12} />,
};

export function ImageGalleryDialog({ open, onClose, onImageSelected }: Props) {
  const { images, initialize, removeImage, getImageBlob } = useImageGalleryStore();
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isAddingToCanvas, setIsAddingToCanvas] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Load images on mount
  useEffect(() => {
    if (open) {
      initialize();
    }
  }, [open, initialize]);

  // Auto-focus dialog when opened for keyboard events
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [open]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && selectedImageId) {
        handleAddToCanvas();
      }
    },
    [selectedImageId, onClose]
  );

  const handleImageClick = (image: GalleryImage) => {
    setSelectedImageId(image.id);
  };

  const handleDeleteImage = async (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();
    try {
      await removeImage(imageId);
      if (selectedImageId === imageId) {
        setSelectedImageId(null);
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  const handleAddToCanvas = async () => {
    if (!selectedImageId) return;

    setIsAddingToCanvas(true);

    try {
      // Get the full image blob from the store
      const blob = await getImageBlob(selectedImageId);
      if (!blob) {
        console.error('Failed to get image blob');
        return;
      }

      // Convert blob to data URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        onImageSelected(dataUrl);
        onClose();
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Failed to add image to canvas:', error);
    } finally {
      setIsAddingToCanvas(false);
    }
  };

  if (!open) return null;

  return (
    <div className="linear-dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="linear-dialog linear-dialog-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Header */}
        <div className="linear-dialog-header">
          <div className="linear-dialog-header-content">
            <div className="linear-dialog-icon">
              <ImageIcon size={18} />
            </div>
            <div>
              <h2 className="linear-dialog-title">Image Gallery</h2>
              <p className="linear-dialog-subtitle">
                Select an image to add to your canvas
              </p>
            </div>
          </div>
          <button className="linear-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="linear-dialog-content">
          {images.length === 0 ? (
            <div className="gallery-empty">
              <div className="linear-empty-icon">
                <ImageIcon size={32} />
              </div>
              <p>No saved images.</p>
              <p className="gallery-empty-hint">
                Generate or process an image to save it here.
              </p>
            </div>
          ) : (
            <div className="gallery-grid">
              {images.map((image) => (
                <div
                  key={image.id}
                  className={`gallery-card ${selectedImageId === image.id ? 'gallery-card-selected' : ''}`}
                  onClick={() => handleImageClick(image)}
                >
                  <img
                    src={image.thumbnailDataUrl}
                    alt="Gallery item"
                    className="gallery-thumbnail"
                  />
                  <div className="gallery-badge">
                    {SOURCE_ICONS[image.source]}
                    <span>{SOURCE_LABELS[image.source]}</span>
                  </div>
                  <button
                    className="gallery-delete-btn"
                    onClick={(e) => handleDeleteImage(e, image.id)}
                    aria-label="Delete image"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="linear-dialog-footer">
          <div className="linear-footer-hint">
            <kbd>Enter</kbd> to add • <kbd>Esc</kbd> to cancel
          </div>
          <div className="linear-footer-actions">
            <button className="linear-btn linear-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="linear-btn linear-btn-primary"
              onClick={handleAddToCanvas}
              disabled={!selectedImageId || isAddingToCanvas}
            >
              {isAddingToCanvas ? 'Adding...' : 'Add to Canvas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
