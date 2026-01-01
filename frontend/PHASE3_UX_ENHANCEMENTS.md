# Phase 3 UX Enhancements - Integration Guide

This document describes the Phase 3 enhanced UX features and how to integrate them into the canvas editor.

## Features Implemented

### 1. Enhanced Layer Panel
**Location:** `frontend/src/components/canvas/LayerPanel.tsx`

Features:
- **Layer Naming/Renaming**: Double-click any layer to rename it
- **Layer Search/Filter**: Search box at the top filters layers by name
- **Drag-and-Drop Reordering**: Drag layers to reorder them in the stack
- **Lock/Unlock**: Lock layers to prevent accidental editing
- **Nested Groups**: Support for expandable/collapsible layer groups (structure in place)

Usage:
```tsx
import { LayerPanel } from '../components/canvas/LayerPanel';

// In your component
<LayerPanel
  canvas={fabricCanvas}
  selectedObject={selectedObject}
  onSelect={setSelectedObject}
  onBringToFront={handleBringToFront}
  onSendToBack={handleSendToBack}
/>
```

### 2. Ruler Component
**Location:** `frontend/src/components/canvas/Ruler.tsx`

Features:
- Shows measurements in millimeters
- Adapts tick spacing based on zoom level
- Horizontal and vertical orientations
- Clear, readable labels

Usage:
```tsx
import { Ruler } from '../components/canvas/Ruler';

const pixelsPerMm = 3.7795275591; // 96 DPI

<div style={{ display: 'grid', gridTemplateColumns: '30px 1fr' }}>
  {/* Vertical ruler */}
  <Ruler
    orientation="vertical"
    canvasWidthMm={currentProject.width_mm}
    canvasHeightMm={currentProject.height_mm}
    zoom={zoom}
    offset={{ x: 0, y: 0 }}
    pixelsPerMm={pixelsPerMm}
  />

  <div>
    {/* Horizontal ruler */}
    <Ruler
      orientation="horizontal"
      canvasWidthMm={currentProject.width_mm}
      canvasHeightMm={currentProject.height_mm}
      zoom={zoom}
      offset={{ x: 0, y: 0 }}
      pixelsPerMm={pixelsPerMm}
    />

    {/* Canvas */}
    <FabricCanvas ... />
  </div>
</div>
```

### 3. Grid Overlay with Snap
**Location:** `frontend/src/components/canvas/GridOverlay.tsx`

Features:
- Configurable grid spacing (1mm, 5mm, 10mm)
- Snap-to-grid functionality
- Adjustable color and opacity
- Toggle on/off

Usage:
```tsx
import { GridOverlay, GridControls, GridConfig } from '../components/canvas/GridOverlay';

// State management
const [gridConfig, setGridConfig] = useState<GridConfig>({
  enabled: false,
  spacing: 5,
  snapEnabled: true,
  color: '#cccccc',
  opacity: 0.3
});

// In sidebar
<GridControls config={gridConfig} onChange={setGridConfig} />

// Over canvas (in canvas wrapper)
<div style={{ position: 'relative' }}>
  <FabricCanvas ... />
  <GridOverlay
    canvas={fabricCanvas}
    config={gridConfig}
    canvasWidthMm={currentProject.width_mm}
    canvasHeightMm={currentProject.height_mm}
    pixelsPerMm={pixelsPerMm}
    zoom={zoom}
  />
</div>
```

### 4. Optimized Pattern Regeneration
**Location:** `frontend/src/utils/patterns.ts`

Features:
- **Debouncing (300ms)**: Prevents excessive regeneration during rapid changes
- **In-place updates**: Color and stroke width changes applied immediately without full regeneration
- **Smart regeneration**: Only full regeneration when spacing changes
- **Batch updates**: PatternUpdateManager for handling multiple simultaneous updates

The pattern generation hook (`frontend/src/hooks/usePatternGeneration.ts`) has been updated to use these optimizations automatically.

Usage is unchanged:
```tsx
const { regenerateFillPattern, flushUpdates } = usePatternGeneration(
  canvas,
  currentProject.width_mm,
  currentProject.height_mm,
  setSelectedObject,
  setDirty
);

// Use as before - now with automatic debouncing
regenerateFillPattern(selectedObject, { spacing: 5 });
regenerateFillPattern(selectedObject, { strokeColor: '#ff0000' }); // In-place update
regenerateFillPattern(selectedObject, { strokeWidth: 1.5 }); // In-place update

// Force immediate update (e.g., on blur)
flushUpdates();
```

### 5. Error Boundaries
**Location:** `frontend/src/components/ErrorBoundary.tsx`

Features:
- **Full page error boundary**: Catches errors in entire app sections
- **Inline error boundary**: For specific components
- **Error details**: Expandable error information for debugging
- **Recovery options**: Try again or reload page

Usage:
```tsx
import { ErrorBoundary, InlineErrorBoundary } from '../components/ErrorBoundary';

// Wrap entire page
<ErrorBoundary>
  <EditorPage />
</ErrorBoundary>

// Wrap specific section
<InlineErrorBoundary
  fallback={(error, reset) => (
    <div>
      <p>Failed to load: {error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  )}
>
  <ComplexComponent />
</InlineErrorBoundary>
```

### 6. Loading States
**Location:** `frontend/src/components/canvas/CanvasLoader.tsx`

Components:
- **CanvasLoader**: Spinner with optional overlay
- **CanvasSkeleton**: Skeleton loader for canvas
- **LayerPanelSkeleton**: Skeleton loader for layer panel
- **PropertiesPanelSkeleton**: Skeleton loader for properties panel
- **PageLoader**: Full page loader
- **InlineLoader**: Small inline spinner
- **ProgressBar**: Progress indicator with percentage

Usage:
```tsx
import {
  CanvasLoader,
  CanvasSkeleton,
  LayerPanelSkeleton,
  ProgressBar
} from '../components/canvas/CanvasLoader';

// Show loading overlay
{isLoading && <CanvasLoader message="Processing..." overlay />}

// Skeleton while loading
{projectLoading ? (
  <CanvasSkeleton />
) : (
  <FabricCanvas ... />
)}

// Progress bar
<ProgressBar
  progress={uploadProgress}
  message="Uploading image..."
  showPercentage
/>
```

## Complete Integration Example

```tsx
import { useState, useEffect } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LayerPanel } from '../components/canvas/LayerPanel';
import { Ruler } from '../components/canvas/Ruler';
import { GridOverlay, GridControls, GridConfig } from '../components/canvas/GridOverlay';
import { CanvasLoader, CanvasSkeleton } from '../components/canvas/CanvasLoader';
import { FabricCanvas } from '../components/canvas/FabricCanvas';
import { usePatternGeneration } from '../hooks/usePatternGeneration';

export function EditorPage() {
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    enabled: false,
    spacing: 5,
    snapEnabled: true,
    color: '#cccccc',
    opacity: 0.3
  });

  const { regenerateFillPattern } = usePatternGeneration(
    fabricCanvas,
    currentProject.width_mm,
    currentProject.height_mm,
    setSelectedObject,
    setDirty
  );

  const pixelsPerMm = 3.7795275591;

  return (
    <ErrorBoundary>
      <div className="editor-layout">
        {/* Left Sidebar - Layers */}
        <div className="editor-sidebar-left">
          <h3>Layers</h3>
          {loading ? (
            <LayerPanelSkeleton />
          ) : (
            <LayerPanel
              canvas={fabricCanvas}
              selectedObject={selectedObject}
              onSelect={setSelectedObject}
              onBringToFront={handleBringToFront}
              onSendToBack={handleSendToBack}
            />
          )}
        </div>

        {/* Canvas Area with Rulers and Grid */}
        <div className="editor-canvas-container">
          {loading ? (
            <CanvasSkeleton />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr' }}>
              <Ruler
                orientation="vertical"
                canvasWidthMm={currentProject.width_mm}
                canvasHeightMm={currentProject.height_mm}
                zoom={zoom}
                pixelsPerMm={pixelsPerMm}
              />

              <div>
                <Ruler
                  orientation="horizontal"
                  canvasWidthMm={currentProject.width_mm}
                  canvasHeightMm={currentProject.height_mm}
                  zoom={zoom}
                  pixelsPerMm={pixelsPerMm}
                />

                <div style={{ position: 'relative' }}>
                  <FabricCanvas
                    onCanvasReady={setFabricCanvas}
                    width={currentProject.width_mm * pixelsPerMm}
                    height={currentProject.height_mm * pixelsPerMm}
                  />

                  <GridOverlay
                    canvas={fabricCanvas}
                    config={gridConfig}
                    canvasWidthMm={currentProject.width_mm}
                    canvasHeightMm={currentProject.height_mm}
                    pixelsPerMm={pixelsPerMm}
                    zoom={zoom}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Properties */}
        <div className="editor-sidebar-right">
          <h3>Properties</h3>

          {/* Grid Controls */}
          <GridControls config={gridConfig} onChange={setGridConfig} />

          {/* Pattern Properties with Debounced Updates */}
          {selectedObject && (selectedObject as any).fillPatternType && (
            <div>
              <label>Spacing (mm)</label>
              <input
                type="range"
                min="1"
                max="20"
                value={(selectedObject as any).fillPatternSpacing}
                onChange={(e) => {
                  // This will be debounced automatically
                  regenerateFillPattern(selectedObject, {
                    spacing: Number(e.target.value)
                  });
                }}
              />
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
```

## Performance Benefits

1. **Pattern Regeneration**:
   - Before: Every property change triggered full regeneration (slow)
   - After: Color/stroke changes are instant, spacing changes are debounced

2. **Layer Panel**:
   - Before: Basic list
   - After: Full-featured with search, naming, and drag-and-drop

3. **User Feedback**:
   - Before: No loading states
   - After: Skeleton loaders and progress indicators

4. **Error Handling**:
   - Before: Errors could crash entire app
   - After: Graceful error boundaries with recovery options

## Testing Checklist

- [ ] Layer naming via double-click works
- [ ] Layer search filters correctly
- [ ] Drag-and-drop reordering works
- [ ] Layer lock prevents editing
- [ ] Rulers display correct measurements
- [ ] Ruler adapts to zoom level
- [ ] Grid displays with correct spacing
- [ ] Snap-to-grid functions properly
- [ ] Pattern color changes apply immediately
- [ ] Pattern spacing changes are debounced
- [ ] Error boundary catches and displays errors
- [ ] Loading states show during async operations
- [ ] Skeleton loaders display while loading

## Notes

- All components are fully typed with TypeScript
- Components follow existing design system (CSS variables)
- No breaking changes to existing APIs
- Backward compatible with current implementation
