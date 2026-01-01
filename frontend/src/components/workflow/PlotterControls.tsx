import { useState, useEffect, useRef } from 'react';
import { Plug, Unplug, Home, ChevronUp, ChevronDown, RefreshCw, Crosshair, AlertCircle } from 'lucide-react';
import { usePlotterStore } from '../../stores/plotterStore';
import { isSerialAvailable, getSerialSupportMessage } from '../../lib/serial';
import { CalibrationWizard } from '../calibration/CalibrationWizard';

export function PlotterControls() {
  const {
    status,
    availablePorts,
    isConnecting,
    error,
    initialize,
    listPorts,
    connect,
    disconnect,
    home,
    penUp,
    penDown,
    clearError,
  } = usePlotterStore();

  const [selectedPort, setSelectedPort] = useState<string>('');
  const [showCalibration, setShowCalibration] = useState(false);
  const [hasAttemptedAutoConnect, setHasAttemptedAutoConnect] = useState(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingErrorCountRef = useRef(0);

  // Check if serial is supported
  const serialSupported = isSerialAvailable();
  const supportMessage = getSerialSupportMessage();

  // Initialize plotter store on mount
  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial port listing on mount
  useEffect(() => {
    if (serialSupported) {
      listPorts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialSupported]);

  // Auto-select first available port
  useEffect(() => {
    if (availablePorts.length > 0 && !selectedPort) {
      setSelectedPort(availablePorts[0].path);
    }
  }, [availablePorts, selectedPort]);

  // Safe auto-connect with debouncing - only attempts once per session
  useEffect(() => {
    // Only attempt once
    if (hasAttemptedAutoConnect) return;

    // Check all conditions
    if (serialSupported && availablePorts.length > 0 && !status?.connected && !isConnecting && selectedPort) {
      // Debounce: wait 1 second after ports are discovered
      const timeoutId = setTimeout(async () => {
        try {
          console.log('[PlotterControls] Auto-connecting to:', selectedPort);
          await connect(selectedPort);
          setHasAttemptedAutoConnect(true);
        } catch (err) {
          console.error('[PlotterControls] Auto-connect failed:', err);
          // Still mark as attempted to prevent infinite retries
          setHasAttemptedAutoConnect(true);
        }
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialSupported, availablePorts.length, status?.connected, isConnecting, selectedPort, hasAttemptedAutoConnect]);

  // Safe hardware polling with safeguards (5-second interval, error handling)
  useEffect(() => {
    if (!serialSupported) return;

    // Only poll when disconnected
    if (!status?.connected) {
      // Reset error count when starting fresh polling
      pollingErrorCountRef.current = 0;

      // Poll every 5 seconds for hardware changes (increased from 2s to reduce load)
      pollingIntervalRef.current = setInterval(async () => {
        try {
          await listPorts();
          // Reset error count on success
          pollingErrorCountRef.current = 0;
        } catch (err) {
          console.error('[PlotterControls] Port listing failed:', err);
          pollingErrorCountRef.current++;

          // Stop polling after 3 consecutive errors to prevent infinite retry loops
          if (pollingErrorCountRef.current >= 3) {
            console.warn('[PlotterControls] Stopping polling due to repeated errors');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }
        }
      }, 5000);
    } else {
      // Clear polling when connected
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialSupported, status?.connected]);

  const handleConnect = async () => {
    clearError();
    await connect(selectedPort || undefined);
  };

  const handleRefreshPorts = () => {
    listPorts();
  };

  // Unsupported browser UI
  if (!serialSupported) {
    return (
      <div className="plotter-controls">
        <h3 style={{ marginBottom: 16, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Plotter Connection
        </h3>
        <div
          style={{
            padding: 16,
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <AlertCircle size={20} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-warning)' }}>
                Browser Not Supported
              </h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                {supportMessage}
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                Please use <strong>Chrome</strong>, <strong>Edge</strong>, or <strong>Opera</strong> for web plotting,
                or download the desktop app for full browser support.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="plotter-controls">
      <h3 style={{ marginBottom: 16, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
        Plotter Connection
      </h3>

      {/* Error display */}
      {error && (
        <div
          style={{
            padding: 12,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius)',
            marginBottom: 16,
            fontSize: '0.8125rem',
            color: 'var(--color-error)',
          }}
        >
          {error}
          <button
            onClick={clearError}
            style={{
              marginLeft: 8,
              background: 'none',
              border: 'none',
              color: 'var(--color-error)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {!status?.connected ? (
        <div className="connection-controls">
          <div className="form-group">
            <label className="form-label">Serial Port</label>
            <div className="flex gap-2">
              <select
                className="form-select"
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                style={{ flex: 1 }}
              >
                {availablePorts.length === 0 ? (
                  <option value="">No ports found</option>
                ) : (
                  availablePorts.map((port) => (
                    <option key={port.path} value={port.path}>
                      {port.path} {port.description && `(${port.description})`}
                    </option>
                  ))
                )}
              </select>
              <button
                className="btn btn-secondary btn-icon"
                onClick={handleRefreshPorts}
                title="Refresh ports"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={isConnecting || availablePorts.length === 0}
            style={{ width: '100%' }}
          >
            <Plug size={16} />
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      ) : (
        <div className="connected-controls">
          <div
            style={{
              padding: 12,
              background: 'rgba(34, 197, 94, 0.1)',
              borderRadius: 'var(--radius)',
              marginBottom: 16,
              fontSize: '0.875rem',
            }}
          >
            <div style={{ color: 'var(--color-success)', fontWeight: 500, marginBottom: 4 }}>
              Connected
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>{status.portName}</div>
          </div>

          <div className="flex gap-2" style={{ marginBottom: 12 }}>
            <button className="btn btn-secondary" onClick={home} style={{ flex: 1 }}>
              <Home size={16} />
              Home
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowCalibration(true)}
              style={{ flex: 1 }}
            >
              <Crosshair size={16} />
              Calibrate
            </button>
          </div>

          <div className="flex gap-2" style={{ marginBottom: 16 }}>
            <button className="btn btn-secondary" onClick={penUp} style={{ flex: 1 }}>
              <ChevronUp size={16} />
              Pen Up
            </button>
            <button className="btn btn-secondary" onClick={penDown} style={{ flex: 1 }}>
              <ChevronDown size={16} />
              Pen Down
            </button>
          </div>

          <button
            className="btn btn-secondary"
            onClick={disconnect}
            style={{ width: '100%', color: 'var(--color-error)' }}
          >
            <Unplug size={16} />
            Disconnect
          </button>
        </div>
      )}

      {showCalibration && (
        <CalibrationWizard
          onClose={() => {
            setShowCalibration(false);
          }}
        />
      )}
    </div>
  );
}
