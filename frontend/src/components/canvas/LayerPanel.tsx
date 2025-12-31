import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import type { Canvas, FabricObject } from 'fabric';

interface Props {
  canvas: Canvas | null;
  selectedObject: FabricObject | null;
  onSelect: (obj: FabricObject | null) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

export function LayerPanel({ canvas, selectedObject, onSelect, onBringToFront, onSendToBack }: Props) {
  const [objects, setObjects] = useState<FabricObject[]>([]);

  useEffect(() => {
    if (!canvas) return;

    const updateObjects = () => {
      const objs = canvas.getObjects();
      // Filter out canvas boundary from layer list (but keep it visible on canvas)
      const filteredObjs = objs.filter(obj => (obj as any).name !== 'canvas-boundary');
      setObjects([...filteredObjs].reverse()); // Reverse so top layer is first
    };

    updateObjects();

    canvas.on('object:added', updateObjects);
    canvas.on('object:removed', updateObjects);
    canvas.on('object:modified', updateObjects);

    return () => {
      canvas.off('object:added', updateObjects);
      canvas.off('object:removed', updateObjects);
      canvas.off('object:modified', updateObjects);
    };
  }, [canvas]);

  const getObjectLabel = (obj: FabricObject, index: number): string => {
    const type = obj.type || 'Object';
    if (type === 'i-text' || type === 'text' || type === 'textbox') {
      const text = (obj as unknown as { text: string }).text || '';
      return text.substring(0, 20) + (text.length > 20 ? '...' : '');
    }
    if (type === 'image') {
      return `Image ${objects.length - index}`;
    }
    return `${type} ${objects.length - index}`;
  };

  const toggleVisibility = (obj: FabricObject) => {
    if (!canvas) return;
    obj.set('visible', !obj.visible);
    canvas.requestRenderAll();
    setObjects([...objects]); // Force re-render
  };

  if (objects.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
        No objects on canvas. Add text or images to get started.
      </p>
    );
  }

  return (
    <div>
      <div className="flex gap-2" style={{ marginBottom: 12 }}>
        <button
          className="btn btn-secondary btn-icon"
          onClick={onBringToFront}
          disabled={!selectedObject}
          title="Bring to Front"
        >
          <ChevronUp size={16} />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={onSendToBack}
          disabled={!selectedObject}
          title="Send to Back"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      <div className="layer-list">
        {objects.map((obj, index) => (
          <div
            key={index}
            className={`layer-item ${selectedObject === obj ? 'selected' : ''}`}
            onClick={() => onSelect(obj)}
          >
            <button
              className="btn btn-icon"
              onClick={(e) => {
                e.stopPropagation();
                toggleVisibility(obj);
              }}
              style={{ padding: 4 }}
            >
              {obj.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <span className="layer-name">{getObjectLabel(obj, index)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
