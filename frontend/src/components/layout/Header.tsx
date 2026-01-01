import { Link } from 'react-router-dom';
import { Printer, Wifi, WifiOff } from 'lucide-react';
import { usePlotterStore } from '../../stores/plotterStore';
import { useEffect } from 'react';
import { ThemeToggle } from '../ThemeToggle';

export function Header() {
  const { status, fetchStatus } = usePlotterStore();

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const isConnected = status?.connected ?? false;

  return (
    <header className="header">
      <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="flex items-center gap-2">
          <Printer size={24} />
          <h1>Pen Plotter App</h1>
        </div>
      </Link>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={`status-dot ${isConnected ? 'status-connected' : 'status-disconnected'}`}
          />
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            {isConnected ? (
              <>
                <Wifi size={16} style={{ marginRight: 4, display: 'inline' }} />
                Connected
                {status?.port && ` (${status.port})`}
              </>
            ) : (
              <>
                <WifiOff size={16} style={{ marginRight: 4, display: 'inline' }} />
                Disconnected
              </>
            )}
          </span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
