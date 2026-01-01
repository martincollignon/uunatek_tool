import { useEffect, useState } from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { useCanvasStore } from '../stores/canvasStore';
import '../styles/SaveIndicator.css';

export function SaveIndicator() {
  const saveState = useCanvasStore((state) => state.saveState);
  const saveError = useCanvasStore((state) => state.saveError);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show indicator when saving, saved, or error
    if (saveState !== 'idle') {
      setVisible(true);
    }

    // Auto-hide "saved" state after 3 seconds
    if (saveState === 'saved') {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);

      return () => clearTimeout(timer);
    }

    // Keep error visible until dismissed
    if (saveState === 'error') {
      setVisible(true);
    }
  }, [saveState]);

  if (!visible) {
    return null;
  }

  const getIndicatorContent = () => {
    switch (saveState) {
      case 'saving':
        return {
          icon: <Loader2 size={16} className="save-indicator-spinner" />,
          text: 'Saving...',
          className: 'save-indicator-saving',
        };

      case 'saved':
        return {
          icon: <Check size={16} />,
          text: 'All changes saved',
          className: 'save-indicator-saved',
        };

      case 'error':
        return {
          icon: <AlertCircle size={16} />,
          text: saveError || 'Failed to save',
          className: 'save-indicator-error',
        };

      default:
        return null;
    }
  };

  const content = getIndicatorContent();
  if (!content) {
    return null;
  }

  return (
    <div className={`save-indicator ${content.className}`}>
      {content.icon}
      <span className="save-indicator-text">{content.text}</span>
      {saveState === 'error' && (
        <button
          className="save-indicator-dismiss"
          onClick={() => setVisible(false)}
          title="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
