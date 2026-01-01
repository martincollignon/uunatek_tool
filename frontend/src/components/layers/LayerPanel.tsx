import { useEffect, useState, useRef } from 'react';
import { ChevronUp, ChevronDown, Eye, EyeOff, Search, ChevronRight, GripVertical, FolderOpen, Folder, Lock, Unlock } from 'lucide-react';
import type { Canvas, FabricObject } from 'fabric';

interface Props {
  canvas: Canvas | null;
  selectedObject: FabricObject | null;
  onSelect: (obj: FabricObject | null) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

interface LayerGroup {
  id: string;
  name: string;
  expanded: boolean;
  objects: FabricObject[];
}

export function LayerPanel({ canvas, selectedObject, onSelect, onBringToFront, onSendToBack }: Props) {
  const [objects, setObjects] = useState<FabricObject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [groups, setGroups] = useState<LayerGroup[]>([]);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!canvas) return;

    const updateObjects = () => {
      const objs = canvas.getObjects();
      // Filter out guide elements from layer list (but keep them visible on canvas)
      const filteredObjs = objs.filter(obj => {
        const name = (obj as any).name;
        return name !== 'canvas-boundary' &&
               name !== 'safety-boundary' &&
               name !== 'alignmentGuide' &&
               name !== 'staticGuide';
      });
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

  useEffect(() => {
    if (editingIndex !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingIndex]);

  const getObjectLabel = (obj: FabricObject, index: number): string => {
    // Check for custom name
    const customName = (obj as any).layerName;
    if (customName) return customName;

    const type = obj.type || 'Object';
    if (type === 'i-text' || type === 'text' || type === 'textbox') {
      const text = (obj as unknown as { text: string }).text || '';
      return text.substring(0, 20) + (text.length > 20 ? '...' : '');
    }
    if (type === 'image') {
      return `Image ${objects.length - index}`;
    }
    // Check for pattern type
    const patternType = (obj as any).fillPatternType;
    if (patternType) {
      return `Pattern: ${patternType}`;
    }
    return `${type} ${objects.length - index}`;
  };

  const toggleVisibility = (obj: FabricObject, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvas) return;
    obj.set('visible', !obj.visible);
    canvas.requestRenderAll();
    setObjects([...objects]); // Force re-render
  };

  const toggleLock = (obj: FabricObject, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvas) return;
    const isLocked = obj.selectable === false;
    obj.set({
      selectable: !isLocked,
      evented: !isLocked,
    });
    if (isLocked && canvas.getActiveObject() === obj) {
      canvas.discardActiveObject();
    }
    canvas.requestRenderAll();
    setObjects([...objects]); // Force re-render
  };

  const handleDoubleClick = (obj: FabricObject, index: number) => {
    setEditingIndex(index);
    setEditingName(getObjectLabel(obj, index));
  };

  const handleRename = (obj: FabricObject) => {
    if (!canvas || editingName.trim() === '') {
      setEditingIndex(null);
      return;
    }
    (obj as any).layerName = editingName.trim();
    setEditingIndex(null);
    setObjects([...objects]); // Force re-render
    canvas.requestRenderAll();
  };

  const handleKeyDown = (e: React.KeyboardEvent, obj: FabricObject) => {
    if (e.key === 'Enter') {
      handleRename(obj);
    } else if (e.key === 'Escape') {
      setEditingIndex(null);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!canvas || draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder objects in canvas
    const allObjs = canvas.getObjects();
    const draggedObj = objects[draggedIndex];
    const targetObj = objects[targetIndex];
    const targetCanvasIndex = allObjs.indexOf(targetObj);

    // Move object to new position
    canvas.remove(draggedObj);
    canvas.insertAt(targetCanvasIndex, draggedObj);
    canvas.requestRenderAll();

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const toggleGroup = (groupId: string) => {
    setGroups(groups.map(g =>
      g.id === groupId ? { ...g, expanded: !g.expanded } : g
    ));
  };

  // Filter objects by search query
  const filteredObjects = objects.filter((obj, index) => {
    const label = getObjectLabel(obj, index).toLowerCase();
    return label.includes(searchQuery.toLowerCase());
  });

  if (objects.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
        No objects on canvas. Add text or images to get started.
      </p>
    );
  }

  return (
    <div>
      {/* Search bar */}
      <div className="form-group" style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-secondary)'
          }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search layers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
      </div>

      {/* Layer ordering controls */}
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

      {/* Layer list */}
      <div className="layer-list">
        {filteredObjects.map((obj, index) => {
          const isLocked = obj.selectable === false;
          return (
            <div
              key={index}
              className={`layer-item ${selectedObject === obj ? 'selected' : ''} ${
                dragOverIndex === index ? 'drag-over' : ''
              }`}
              draggable={editingIndex !== index && !isLocked}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onClick={() => !isLocked && onSelect(obj)}
              onDoubleClick={() => !isLocked && handleDoubleClick(obj, index)}
              style={{
                opacity: draggedIndex === index ? 0.5 : isLocked ? 0.6 : 1,
                cursor: editingIndex === index ? 'text' : isLocked ? 'not-allowed' : 'grab'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <GripVertical size={14} style={{ color: 'var(--color-text-secondary)', cursor: isLocked ? 'not-allowed' : 'grab' }} />
                <button
                  className="btn btn-icon"
                  onClick={(e) => toggleVisibility(obj, e)}
                  style={{ padding: 4 }}
                >
                  {obj.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                {editingIndex === index ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    className="form-input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRename(obj)}
                    onKeyDown={(e) => handleKeyDown(e, obj)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.875rem',
                      minWidth: 0
                    }}
                  />
                ) : (
                  <span className="layer-name" title="Double-click to rename">
                    {getObjectLabel(obj, index)}
                  </span>
                )}
                <button
                  className="btn btn-icon"
                  onClick={(e) => toggleLock(obj, e)}
                  style={{ padding: 4, marginLeft: 'auto' }}
                  title={isLocked ? 'Unlock' : 'Lock'}
                >
                  {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {searchQuery && filteredObjects.length === 0 && (
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
          textAlign: 'center',
          marginTop: 16
        }}>
          No layers match "{searchQuery}"
        </p>
      )}

      {/* Groups section (for future enhancement) */}
      {groups.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 8 }}>
            Groups
          </h4>
          {groups.map(group => (
            <div key={group.id} style={{ marginBottom: 8 }}>
              <div
                className="layer-item"
                onClick={() => toggleGroup(group.id)}
                style={{ cursor: 'pointer' }}
              >
                {group.expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
                <span className="layer-name">{group.name}</span>
                <ChevronRight
                  size={14}
                  style={{
                    transform: group.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}
                />
              </div>
              {group.expanded && (
                <div style={{ paddingLeft: 24 }}>
                  {group.objects.map((obj, idx) => (
                    <div
                      key={idx}
                      className={`layer-item ${selectedObject === obj ? 'selected' : ''}`}
                      onClick={() => onSelect(obj)}
                    >
                      <span className="layer-name">{getObjectLabel(obj, idx)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
