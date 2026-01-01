import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
} from 'lucide-react';
import type { Canvas } from 'fabric';
import {
  alignLeft,
  alignCenterHorizontal,
  alignRight,
  alignTop,
  alignMiddleVertical,
  alignBottom,
  distributeHorizontally,
  distributeVertically,
} from '../../utils/alignment';
import { useHistoryStore } from '../../stores/historyStore';

interface AlignmentToolbarProps {
  canvas: Canvas | null;
  selectedObject: any;
  canvasWidth: number;
  canvasHeight: number;
}

export function AlignmentToolbar({
  canvas,
  selectedObject,
  canvasWidth,
  canvasHeight,
}: AlignmentToolbarProps) {
  const { saveState } = useHistoryStore();

  const handleAlign = (alignFn: (canvas: Canvas, ...args: any[]) => void, ...args: any[]) => {
    if (!canvas) return;
    alignFn(canvas, ...args);
    saveState(canvas);
  };

  const hasSelection = selectedObject !== null;
  const hasThreeOrMore = canvas && canvas.getActiveObjects().length >= 3;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px',
        backgroundColor: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
      }}
    >
      {/* Horizontal alignment */}
      <div style={{ display: 'flex', gap: '2px' }}>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => handleAlign(alignLeft, canvas!)}
          disabled={!hasSelection}
          title="Align Left"
          style={{
            padding: '6px',
            opacity: hasSelection ? 1 : 0.5,
            cursor: hasSelection ? 'pointer' : 'not-allowed',
          }}
        >
          <AlignLeft size={16} />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => handleAlign(alignCenterHorizontal, canvas!, canvasWidth)}
          disabled={!hasSelection}
          title="Align Center Horizontally"
          style={{
            padding: '6px',
            opacity: hasSelection ? 1 : 0.5,
            cursor: hasSelection ? 'pointer' : 'not-allowed',
          }}
        >
          <AlignCenter size={16} />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => handleAlign(alignRight, canvas!)}
          disabled={!hasSelection}
          title="Align Right"
          style={{
            padding: '6px',
            opacity: hasSelection ? 1 : 0.5,
            cursor: hasSelection ? 'pointer' : 'not-allowed',
          }}
        >
          <AlignRight size={16} />
        </button>
      </div>

      <div
        style={{
          width: '1px',
          height: '20px',
          backgroundColor: 'var(--color-border)',
          margin: '0 4px',
        }}
      />

      {/* Vertical alignment */}
      <div style={{ display: 'flex', gap: '2px' }}>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => handleAlign(alignTop, canvas!)}
          disabled={!hasSelection}
          title="Align Top"
          style={{
            padding: '6px',
            opacity: hasSelection ? 1 : 0.5,
            cursor: hasSelection ? 'pointer' : 'not-allowed',
          }}
        >
          <AlignVerticalJustifyStart size={16} />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => handleAlign(alignMiddleVertical, canvas!, canvasHeight)}
          disabled={!hasSelection}
          title="Align Middle Vertically"
          style={{
            padding: '6px',
            opacity: hasSelection ? 1 : 0.5,
            cursor: hasSelection ? 'pointer' : 'not-allowed',
          }}
        >
          <AlignVerticalJustifyCenter size={16} />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => handleAlign(alignBottom, canvas!)}
          disabled={!hasSelection}
          title="Align Bottom"
          style={{
            padding: '6px',
            opacity: hasSelection ? 1 : 0.5,
            cursor: hasSelection ? 'pointer' : 'not-allowed',
          }}
        >
          <AlignVerticalJustifyEnd size={16} />
        </button>
      </div>

      <div
        style={{
          width: '1px',
          height: '20px',
          backgroundColor: 'var(--color-border)',
          margin: '0 4px',
        }}
      />

      {/* Distribution */}
      <div style={{ display: 'flex', gap: '2px' }}>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => handleAlign(distributeHorizontally, canvas!)}
          disabled={!hasThreeOrMore}
          title="Distribute Horizontally (3+ objects)"
          style={{
            padding: '6px',
            opacity: hasThreeOrMore ? 1 : 0.5,
            cursor: hasThreeOrMore ? 'pointer' : 'not-allowed',
          }}
        >
          <AlignHorizontalSpaceAround size={16} />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => handleAlign(distributeVertically, canvas!)}
          disabled={!hasThreeOrMore}
          title="Distribute Vertically (3+ objects)"
          style={{
            padding: '6px',
            opacity: hasThreeOrMore ? 1 : 0.5,
            cursor: hasThreeOrMore ? 'pointer' : 'not-allowed',
          }}
        >
          <AlignVerticalSpaceAround size={16} />
        </button>
      </div>
    </div>
  );
}
