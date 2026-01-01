import { useEffect, useRef, useState } from 'react';

interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  canvasWidthMm: number;
  canvasHeightMm: number;
  zoom: number;
  offset?: { x: number; y: number };
  pixelsPerMm: number;
  isRotated?: boolean;
}

export function Ruler({
  orientation,
  canvasWidthMm,
  canvasHeightMm,
  zoom,
  offset = { x: 0, y: 0 },
  pixelsPerMm,
  isRotated = false
}: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isHorizontal = orientation === 'horizontal';
  const RULER_SIZE = 30; // Height/width of ruler in pixels
  const [dimensions, setDimensions] = useState({ width: 1200, height: 1200 });

  // Transform offset for rotated coordinate system
  // When rotated 90° CW: visual X becomes original Y, visual Y becomes -original X
  // But since we want rulers to stay in portrait orientation, we need to map
  // the pan offset to match the ruler's coordinate system
  const effectiveOffset = isRotated
    ? { x: offset.y, y: -offset.x }
    : offset;

  // Scale font size based on zoom level for better readability
  const getFontSize = () => {
    if (zoom < 0.5) return 8;
    if (zoom < 0.75) return 9;
    if (zoom > 2) return 11;
    return 10;
  };
  const FONT_SIZE = getFontSize();

  // Update canvas dimensions when container resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height)
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get theme-aware colors from CSS variables
    const computedStyle = getComputedStyle(document.documentElement);
    const bgColor = computedStyle.getPropertyValue('--color-bg-tertiary').trim() || '#1C1C1C';
    const borderColor = computedStyle.getPropertyValue('--color-border-primary').trim() || '#333333';
    const textColor = computedStyle.getPropertyValue('--color-text-primary').trim() || '#F5F5F5';

    // Set styles
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = borderColor;
    ctx.fillStyle = textColor;
    ctx.font = `${FONT_SIZE}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`;

    // Calculate dimensions
    const lengthMm = isHorizontal ? canvasWidthMm : canvasHeightMm;

    // Determine tick spacing based on zoom level for better readability
    let majorTickMm = 10; // Major ticks every 10mm by default
    let minorTickMm = 1; // Minor ticks every 1mm

    if (zoom < 0.3) {
      majorTickMm = 100;
      minorTickMm = 50;
    } else if (zoom < 0.5) {
      majorTickMm = 50;
      minorTickMm = 10;
    } else if (zoom < 0.75) {
      majorTickMm = 25;
      minorTickMm = 5;
    } else if (zoom < 1.5) {
      majorTickMm = 10;
      minorTickMm = 5;
    } else if (zoom > 3) {
      majorTickMm = 5;
      minorTickMm = 1;
    }

    // Draw ticks
    for (let mm = 0; mm <= lengthMm; mm += minorTickMm) {
      const isMajor = mm % majorTickMm === 0;
      const pos = mm * pixelsPerMm * zoom;

      if (isHorizontal) {
        const x = pos + effectiveOffset.x;
        if (x < 0 || x > canvas.width) continue;

        const tickHeight = isMajor ? RULER_SIZE * 0.6 : RULER_SIZE * 0.3;
        ctx.beginPath();
        ctx.moveTo(x, RULER_SIZE);
        ctx.lineTo(x, RULER_SIZE - tickHeight);
        ctx.stroke();

        // Draw labels for major ticks
        if (isMajor && mm > 0) {
          const label = mm.toString();
          const metrics = ctx.measureText(label);
          ctx.fillText(label, x - metrics.width / 2, RULER_SIZE - tickHeight - 4);
        }
      } else {
        const y = pos + effectiveOffset.y;
        if (y < 0 || y > canvas.height) continue;

        const tickWidth = isMajor ? RULER_SIZE * 0.6 : RULER_SIZE * 0.3;
        ctx.beginPath();
        ctx.moveTo(RULER_SIZE, y);
        ctx.lineTo(RULER_SIZE - tickWidth, y);
        ctx.stroke();

        // Draw labels for major ticks
        if (isMajor && mm > 0) {
          const label = mm.toString();
          ctx.save();
          ctx.translate(RULER_SIZE - tickWidth - 4, y);
          ctx.rotate(-Math.PI / 2);
          const metrics = ctx.measureText(label);
          ctx.fillText(label, -metrics.width / 2, 0);
          ctx.restore();
        }
      }
    }

    // Draw border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

  }, [orientation, canvasWidthMm, canvasHeightMm, zoom, offset, pixelsPerMm, isHorizontal, dimensions, isRotated, effectiveOffset.x, effectiveOffset.y]);

  const width = isHorizontal ? '100%' : RULER_SIZE;
  const height = isHorizontal ? RULER_SIZE : '100%';

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        position: 'relative'
      }}
    >
      <canvas
        ref={canvasRef}
        width={isHorizontal ? dimensions.width : RULER_SIZE}
        height={isHorizontal ? RULER_SIZE : dimensions.height}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          backgroundColor: 'var(--color-bg-tertiary)'
        }}
      />
    </div>
  );
}
