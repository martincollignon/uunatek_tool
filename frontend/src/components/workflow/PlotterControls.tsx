import { useState, useEffect, useRef } from 'react';
import { Plug, Unplug, Home, ChevronUp, ChevronDown, RefreshCw, Crosshair } from 'lucide-react';
import { usePlotterStore } from '../../stores/plotterStore';
import { CalibrationWizard } from '../calibration/CalibrationWizard';

export function PlotterControls() {
  const {
    status,
    availablePorts,
    isConnecting,
    fetchStatus,
    listPorts,
    connect,
    disconnect,
    home,
    penUp,
    penDown,
  } = usePlotterStore();

  const [selectedPort, setSelectedPort] = useState<string>('');
  const [showCalibration, setShowCalibration] = useState(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial fetch on mount
  useEffect(() => {
    fetchStatus();
    listPorts();
  }, [fetchStatus, listPorts]);

  // Auto-select first available port
  useEffect(() => {
    if (availablePorts.length > 0 && !selectedPort) {
      setSelectedPort(availablePorts[0].device);
    }
  }, [availablePorts, selectedPort]);

  // Auto-connect to first available device
  useEffect(() => {
    if (availablePorts.length > 0 && !status?.connected && !isConnecting && selectedPort) {
      // Automatically connect to the selected port
      connect(selectedPort);
    }
  }, [availablePorts, status?.connected, isConnecting, selectedPort, connect]);

  // Automatic hardware polling when disconnected
  useEffect(() => {
    // Only poll when disconnected
    if (!status?.connected) {
      // Poll every 2 seconds for hardware changes
      pollingIntervalRef.current = setInterval(() => {
        listPorts();
      }, 2000);
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
      }
    };
  }, [status?.connected, listPorts]);

  const handleConnect = async () => {
    await connect(selectedPort || undefined);
  };

  const handleRefreshPorts = () => {
    listPorts();
  };

  return (
    <div className="plotter-controls">
      <h3 style={{ marginBottom: 16, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Plotter Connection</h3>

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
                    <option key={port.device} value={port.device}>
                      {port.device} {port.description && `(${port.description})`}
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
            <div style={{ color: 'var(--color-text-secondary)' }}>{status.port}</div>
            {status.firmware_version && (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                Firmware: {status.firmware_version}
              </div>
            )}
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
            fetchStatus();
          }}
        />
      )}
    </div>
  );
}
