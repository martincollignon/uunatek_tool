export function PropertiesPanelSkeleton() {
  const formGroups = Array.from({ length: 4 });

  return (
    <div>
      {formGroups.map((_, index) => (
        <div
          key={index}
          className="form-group"
          style={{
            marginBottom: '20px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Label skeleton */}
          <div
            style={{
              height: '14px',
              width: '40%',
              backgroundColor: 'var(--color-border)',
              borderRadius: '3px',
              marginBottom: '8px'
            }}
          />

          {/* Input skeleton */}
          <div
            style={{
              height: '38px',
              width: '100%',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Shimmer effect */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                animation: `shimmer 2s infinite ${index * 0.3}s`
              }}
            />
          </div>
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
