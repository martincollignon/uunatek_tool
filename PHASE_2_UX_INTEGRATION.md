# Phase 2 UX Features - Integration Guide

This document describes the Phase 2 core UX features that have been implemented and how to integrate them into the EditorPage.

## Features Implemented

### 1. Undo/Redo System (historyStore.ts)
- Stack-based state management with 50-state limit
- Prevents recursive saves during state restoration
- Keyboard shortcuts: Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo)

### 2. Comprehensive Keyboard Shortcuts (useKeyboardShortcuts.ts)
- **Clipboard**: Cmd/Ctrl+C (copy), Cmd/Ctrl+X (cut), Cmd/Ctrl+V (paste)
- **Duplicate**: Cmd/Ctrl+D
- **Group/Ungroup**: Cmd/Ctrl+G, Cmd/Ctrl+Shift+G
- **Layer ordering**: Cmd/Ctrl+[ and ], Cmd/Ctrl+Shift+[ and ]
- **Select all**: Cmd/Ctrl+A
- **Zoom**: Cmd/Ctrl++ (zoom in), Cmd/Ctrl+- (zoom out), Cmd/Ctrl+0 (reset)
- **Pan**: Shift+Drag or Middle mouse button
- **Arrow keys**: Move objects (1px normal, 10px with Shift)
- **Alt+Drag**: Duplicate while dragging

### 3. Simplified Canvas Boundary Management (FabricCanvas.tsx)
- Centralized boundary management function
- Non-selectable, locked, and non-serializable boundary
- Removed redundant safety nets
- Uses `makeNonInteractive()` utility for consistent behavior

### 4. Context Menu (ContextMenu.tsx)
Right-click menu with:
- Cut, Copy, Paste, Duplicate
- Delete
- Bring to Front, Send to Back
- Lock/Unlock
- Group/Ungroup (when applicable)
- Shows keyboard shortcuts

### 5. Object Locking (LayerPanel.tsx)
- Lock/unlock toggle button for each layer
- Locked objects: non-selectable, non-draggable, visually dimmed
- Lock icon indicator

### 6. Alignment Tools (AlignmentToolbar.tsx + alignment.ts)
- **Horizontal**: Align left, center, right
- **Vertical**: Align top, middle, bottom
- **Distribute**: Horizontal and vertical distribution (3+ objects)
- Works on single objects (align to canvas) or multiple objects (align to selection)

## Quick Integration to EditorPage

### Step 1: Import the hook
```typescript
import { useEditorUX } from '../hooks/useEditorUX';
import { Undo2, Redo2, AlignJustify } from 'lucide-react';
import { ContextMenu } from '../components/canvas/ContextMenu';
import { AlignmentToolbar } from '../components/toolbar/AlignmentToolbar';
```

### Step 2: Use the hook in the component
```typescript
const editorUX = useEditorUX({
  canvas: fabricCanvas,
  selectedObject,
  zoomControls,
  onDelete: canvasOps?.deleteSelected,
  onDuplicate: canvasOps?.duplicateSelected,
});
```

### Step 3: Add undo/redo buttons to toolbar
Add after the side tabs in the toolbar:
```tsx
{/* Undo/Redo buttons */}
<button
  className="btn btn-secondary btn-icon"
  onClick={editorUX.handleUndo}
  disabled={!editorUX.canUndo}
  title="Undo (Cmd/Ctrl+Z)"
>
  <Undo2 size={18} />
</button>
<button
  className="btn btn-secondary btn-icon"
  onClick={editorUX.handleRedo}
  disabled={!editorUX.canRedo}
  title="Redo (Cmd/Ctrl+Shift+Z)"
>
  <Redo2 size={18} />
</button>

<div style={{ width: 1, height: 24, background: 'var(--color-border)', margin: '0 8px' }} />
```

### Step 4: Add alignment toolbar
Add below the canvas or in a sidebar:
```tsx
{/* Alignment Toolbar */}
<div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
  <AlignmentToolbar
    canvas={fabricCanvas}
    selectedObject={selectedObject}
    canvasWidth={currentProject?.width_mm || 0}
    canvasHeight={currentProject?.height_mm || 0}
  />
</div>
```

### Step 5: Add context menu
Add at the end of the component (before closing div):
```tsx
{/* Context Menu */}
{editorUX.contextMenu.visible && (
  <ContextMenu
    x={editorUX.contextMenu.x}
    y={editorUX.contextMenu.y}
    selectedObject={selectedObject}
    hasClipboard={editorUX.hasClipboard}
    onCopy={editorUX.handleCopy}
    onCut={editorUX.handleCut}
    onPaste={editorUX.handlePaste}
    onDuplicate={editorUX.handleDuplicate}
    onDelete={editorUX.handleDelete}
    onBringToFront={editorUX.handleBringToFront}
    onSendToBack={editorUX.handleSendToBack}
    onLock={editorUX.handleLock}
    onUnlock={editorUX.handleUnlock}
    onGroup={editorUX.handleGroup}
    onUngroup={editorUX.handleUngroup}
    onClose={editorUX.closeContextMenu}
  />
)}
```

## File Structure

```
frontend/src/
├── stores/
│   └── historyStore.ts              # Undo/redo state management
├── hooks/
│   ├── useKeyboardShortcuts.ts      # Keyboard shortcuts handler
│   └── useEditorUX.ts               # Unified UX features hook
├── components/
│   ├── canvas/
│   │   ├── FabricCanvas.tsx         # Simplified boundary management
│   │   ├── ContextMenu.tsx          # Right-click context menu
│   │   └── LayerPanel.tsx           # Enhanced with lock feature
│   └── toolbar/
│       └── AlignmentToolbar.tsx     # Alignment controls
└── utils/
    └── alignment.ts                 # Alignment calculation utilities
```

## Features Overview

All features work together seamlessly:
- **Keyboard shortcuts** trigger undo/redo, alignment, and other operations
- **Context menu** provides quick access to common operations
- **History** automatically tracks all modifications
- **Layer locking** prevents accidental edits
- **Alignment tools** enable precise positioning
- **Canvas boundary** remains non-interactive throughout

## Testing Checklist

- [ ] Undo/redo works with Cmd/Ctrl+Z and buttons
- [ ] All keyboard shortcuts function correctly
- [ ] Context menu appears on right-click
- [ ] Lock/unlock works from layer panel
- [ ] Alignment tools work for single and multiple objects
- [ ] Canvas boundary cannot be selected or moved
- [ ] Alt+Drag duplicates objects
- [ ] Arrow keys move objects (1px/10px)
- [ ] Group/ungroup operations work
- [ ] History persists through all operations
