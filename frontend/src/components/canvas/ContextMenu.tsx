import { useEffect, useRef } from 'react';
import {
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  Lock,
  Unlock,
  Layers,
  ChevronsUp,
  ChevronsDown,
  Files,
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  selectedObject: any;
  hasClipboard: boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  selectedObject,
  hasClipboard,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
  onLock,
  onUnlock,
  onGroup,
  onUngroup,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('wheel', handleScroll);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('wheel', handleScroll);
    };
  }, [onClose]);

  const isLocked = selectedObject && selectedObject.selectable === false;
  const isGroup = selectedObject && selectedObject.type === 'group';
  const isMultipleSelection = selectedObject && selectedObject.type === 'activeSelection';

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 10000,
        backgroundColor: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        padding: '4px',
        minWidth: '200px',
      }}
    >
      {selectedObject && (
        <>
          <button
            className="context-menu-item"
            onClick={() => {
              onCut();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              borderRadius: '4px',
              color: 'var(--color-text)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Scissors size={16} />
            Cut
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6, color: 'var(--color-text-secondary)' }}>
              {navigator.platform.includes('Mac') ? '⌘X' : 'Ctrl+X'}
            </span>
          </button>

          <button
            className="context-menu-item"
            onClick={() => {
              onCopy();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              borderRadius: '4px',
              color: 'var(--color-text)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Copy size={16} />
            Copy
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6, color: 'var(--color-text-secondary)' }}>
              {navigator.platform.includes('Mac') ? '⌘C' : 'Ctrl+C'}
            </span>
          </button>
        </>
      )}

      <button
        className="context-menu-item"
        onClick={() => {
          onPaste();
          onClose();
        }}
        disabled={!hasClipboard}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '8px 12px',
          border: 'none',
          background: 'transparent',
          cursor: hasClipboard ? 'pointer' : 'not-allowed',
          fontSize: '0.875rem',
          borderRadius: '4px',
          color: hasClipboard ? 'var(--color-text)' : 'var(--color-text-secondary)',
          opacity: hasClipboard ? 1 : 0.5,
        }}
        onMouseEnter={(e) => {
          if (hasClipboard) {
            e.currentTarget.style.backgroundColor = 'var(--color-hover)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Clipboard size={16} />
        Paste
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6, color: 'var(--color-text-secondary)' }}>
          {navigator.platform.includes('Mac') ? '⌘V' : 'Ctrl+V'}
        </span>
      </button>

      {selectedObject && (
        <>
          <button
            className="context-menu-item"
            onClick={() => {
              onDuplicate();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              borderRadius: '4px',
              color: 'var(--color-text)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Files size={16} />
            Duplicate
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6, color: 'var(--color-text-secondary)' }}>
              {navigator.platform.includes('Mac') ? '⌘D' : 'Ctrl+D'}
            </span>
          </button>

          <button
            className="context-menu-item"
            onClick={() => {
              onDelete();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              borderRadius: '4px',
              color: 'var(--color-error)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Trash2 size={16} />
            Delete
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6, color: 'var(--color-text-secondary)' }}>Del</span>
          </button>

          <div
            style={{
              height: '1px',
              backgroundColor: 'var(--color-border)',
              margin: '4px 0',
            }}
          />

          <button
            className="context-menu-item"
            onClick={() => {
              onBringToFront();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              borderRadius: '4px',
              color: 'var(--color-text)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ChevronsUp size={16} />
            Bring to Front
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6, color: 'var(--color-text-secondary)' }}>
              {navigator.platform.includes('Mac') ? '⌘]' : 'Ctrl+]'}
            </span>
          </button>

          <button
            className="context-menu-item"
            onClick={() => {
              onSendToBack();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              borderRadius: '4px',
              color: 'var(--color-text)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ChevronsDown size={16} />
            Send to Back
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6, color: 'var(--color-text-secondary)' }}>
              {navigator.platform.includes('Mac') ? '⌘[' : 'Ctrl+['}
            </span>
          </button>

          <div
            style={{
              height: '1px',
              backgroundColor: 'var(--color-border)',
              margin: '4px 0',
            }}
          />

          {isLocked ? (
            <button
              className="context-menu-item"
              onClick={() => {
                onUnlock();
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '0.875rem',
                borderRadius: '4px',
                color: 'var(--color-text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Unlock size={16} />
              Unlock
            </button>
          ) : (
            <button
              className="context-menu-item"
              onClick={() => {
                onLock();
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '0.875rem',
                borderRadius: '4px',
                color: 'var(--color-text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Lock size={16} />
              Lock
            </button>
          )}

          {(isMultipleSelection || isGroup) && (
            <>
              <div
                style={{
                  height: '1px',
                  backgroundColor: 'var(--color-border)',
                  margin: '4px 0',
                }}
              />

              {isMultipleSelection && (
                <button
                  className="context-menu-item"
                  onClick={() => {
                    onGroup();
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    borderRadius: '4px',
                    color: 'var(--color-text)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Layers size={16} />
                  Group
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6, color: 'var(--color-text-secondary)' }}>
                    {navigator.platform.includes('Mac') ? '⌘G' : 'Ctrl+G'}
                  </span>
                </button>
              )}

              {isGroup && (
                <button
                  className="context-menu-item"
                  onClick={() => {
                    onUngroup();
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    borderRadius: '4px',
                    color: 'var(--color-text)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Layers size={16} />
                  Ungroup
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6, color: 'var(--color-text-secondary)' }}>
                    {navigator.platform.includes('Mac') ? '⌘⇧G' : 'Ctrl+Shift+G'}
                  </span>
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
