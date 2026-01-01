export function CanvasSkeleton() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg)',
        position: 'relative'
      }}
    >
      <div
        style={{
          width: '80%',
          maxWidth: '600px',
          height: '80%',
          maxHeight: '600px',
          backgroundColor: 'var(--color-surface)',
          border: '2px dashed var(--color-border)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
            animation: 'shimmer 2s infinite'
          }}
        />
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '1rem', marginBottom: 8 }}>Loading canvas...</div>
          <div style={{ fontSize: '0.75rem' }}>Please wait</div>
        </div>
      </div>

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
