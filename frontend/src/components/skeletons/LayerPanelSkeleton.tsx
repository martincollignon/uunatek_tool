export function LayerPanelSkeleton() {
  const skeletonItems = Array.from({ length: 5 });

  return (
    <div style={{ padding: '8px 0' }}>
      {skeletonItems.map((_, index) => (
        <div
          key={index}
          style={{
            padding: '12px',
            marginBottom: '4px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--color-border)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Icon skeleton */}
            <div
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: 'var(--color-border)',
                borderRadius: '3px'
              }}
            />

            {/* Text skeleton */}
            <div
              style={{
                flex: 1,
                height: '14px',
                backgroundColor: 'var(--color-border)',
                borderRadius: '3px',
                width: `${60 + Math.random() * 30}%`
              }}
            />
          </div>

          {/* Shimmer effect */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
              animation: `shimmer 2s infinite ${index * 0.2}s`
            }}
          />
        </div>
      ))}

      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
