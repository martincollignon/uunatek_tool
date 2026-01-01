import { Loader2 } from 'lucide-react';

interface CanvasLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  overlay?: boolean;
}

/**
 * Loading spinner for canvas operations
 */
export function CanvasLoader({
  message = 'Loading...',
  size = 'md',
  overlay = false
}: CanvasLoaderProps) {
  const sizes = {
    sm: 16,
    md: 32,
    lg: 48
  };

  const iconSize = sizes[size];

  const content = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '24px'
    }}>
      <Loader2
        size={iconSize}
        className="animate-spin"
        style={{ color: 'var(--color-primary)' }}
      />
      {message && (
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
          margin: 0
        }}>
          {message}
        </p>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        {content}
      </div>
    );
  }

  return content;
}

/**
 * Skeleton loader for canvas
 */
export function CanvasSkeleton() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '400px',
      backgroundColor: 'var(--color-bg)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Shimmer effect */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
          animation: 'shimmer 2s infinite'
        }}
      />

      {/* Skeleton content */}
      <div style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Toolbar skeleton */}
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'var(--color-border)',
                borderRadius: 'var(--radius)'
              }}
            />
          ))}
        </div>

        {/* Canvas area skeleton */}
        <div style={{
          flex: 1,
          backgroundColor: 'white',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border)',
          minHeight: '400px',
          position: 'relative'
        }}>
          {/* Sample shapes */}
          <div style={{
            position: 'absolute',
            top: '20%',
            left: '30%',
            width: '100px',
            height: '100px',
            backgroundColor: 'var(--color-border)',
            borderRadius: '4px'
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            right: '25%',
            width: '120px',
            height: '80px',
            backgroundColor: 'var(--color-border)',
            borderRadius: '50%'
          }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Layer panel skeleton loader
 */
export function LayerPanelSkeleton() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '16px'
    }}>
      {/* Search bar skeleton */}
      <div style={{
        height: '36px',
        backgroundColor: 'var(--color-border)',
        borderRadius: 'var(--radius)',
        marginBottom: '8px'
      }} />

      {/* Layer items skeleton */}
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: 'var(--color-bg)',
            borderRadius: 'var(--radius)'
          }}
        >
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: 'var(--color-border)',
            borderRadius: '4px'
          }} />
          <div style={{
            flex: 1,
            height: '16px',
            backgroundColor: 'var(--color-border)',
            borderRadius: '4px'
          }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Properties panel skeleton loader
 */
export function PropertiesPanelSkeleton() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '16px'
    }}>
      {/* Title skeleton */}
      <div style={{
        height: '20px',
        width: '60%',
        backgroundColor: 'var(--color-border)',
        borderRadius: '4px'
      }} />

      {/* Property groups */}
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            height: '14px',
            width: '40%',
            backgroundColor: 'var(--color-border)',
            borderRadius: '4px'
          }} />
          <div style={{
            height: '36px',
            backgroundColor: 'var(--color-border)',
            borderRadius: 'var(--radius)'
          }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Full page loading state
 */
export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg)'
    }}>
      <Loader2
        size={48}
        className="animate-spin"
        style={{ color: 'var(--color-primary)' }}
      />
      <p style={{
        marginTop: '16px',
        color: 'var(--color-text-secondary)',
        fontSize: '1rem'
      }}>
        {message}
      </p>
    </div>
  );
}

/**
 * Inline loading indicator for buttons and small areas
 */
export function InlineLoader({ size = 16 }: { size?: number }) {
  return (
    <Loader2
      size={size}
      className="animate-spin"
      style={{ color: 'currentColor' }}
    />
  );
}

/**
 * Progress bar component
 */
interface ProgressBarProps {
  progress: number; // 0-100
  message?: string;
  showPercentage?: boolean;
}

export function ProgressBar({
  progress,
  message,
  showPercentage = true
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div style={{ width: '100%' }}>
      {(message || showPercentage) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          {message && (
            <span style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)'
            }}>
              {message}
            </span>
          )}
          {showPercentage && (
            <span style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-text)'
            }}>
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

// Add shimmer animation to globals.css if not already present
const shimmerStyles = `
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
`;

// Inject shimmer animation styles
if (typeof document !== 'undefined') {
  const styleId = 'shimmer-animation-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = shimmerStyles;
    document.head.appendChild(style);
  }
}
