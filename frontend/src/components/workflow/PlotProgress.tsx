import { Loader2, AlertTriangle } from 'lucide-react';
import type { PlotProgress as PlotProgressType } from '../../types';
import type { PlotterError, RecoveryAction } from '../../types/errors';
import { ErrorAlert } from '../errors/ErrorAlert';

interface Props {
  progress: PlotProgressType | null;
  error?: PlotterError | null;
  onRecoveryAction?: (action: RecoveryAction) => void;
  onReportProblem?: () => void;
}

export function PlotProgress({ progress, error, onRecoveryAction, onReportProblem }: Props) {
  if (!progress) {
    return (
      <div className="plot-progress">
        <p style={{ color: 'var(--color-text-secondary)' }}>No plot in progress</p>
      </div>
    );
  }

  const percentage = progress.total_commands > 0
    ? Math.round((progress.current_command / progress.total_commands) * 100)
    : 0;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="plot-progress">
      <div className="progress-header">
        <div className="flex items-center gap-2">
          {progress.status === 'plotting' && <Loader2 size={16} className="animate-spin" />}
          {progress.status === 'paused' && <AlertTriangle size={16} style={{ color: '#eab308' }} />}
          <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{progress.status}</span>
        </div>
        <span style={{ fontWeight: 600 }}>{percentage}%</span>
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar"
          style={{
            width: `${percentage}%`,
            backgroundColor:
              progress.status === 'completed'
                ? 'var(--color-success)'
                : progress.status === 'error'
                  ? 'var(--color-error)'
                  : progress.status === 'paused'
                    ? '#eab308'
                    : 'var(--color-primary)',
          }}
        />
      </div>

      <div className="progress-stats">
        <div>
          <span style={{ color: 'var(--color-text-secondary)' }}>Commands: </span>
          <span>
            {progress.current_command} / {progress.total_commands}
          </span>
        </div>
        {progress.elapsed_time > 0 && (
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>Elapsed: </span>
            <span>{formatTime(progress.elapsed_time)}</span>
          </div>
        )}
        {progress.estimated_remaining > 0 && progress.status === 'plotting' && (
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>Remaining: </span>
            <span>{formatTime(progress.estimated_remaining)}</span>
          </div>
        )}
      </div>

      {/* Report Problem button - shown during plotting or paused state */}
      {(progress.status === 'plotting' || progress.status === 'paused') && onReportProblem && (
        <div style={{ marginTop: 12 }}>
          <button
            className="btn btn-secondary"
            onClick={onReportProblem}
            style={{ fontSize: '0.8125rem' }}
          >
            <AlertTriangle size={14} />
            Report a Problem
          </button>
        </div>
      )}

      {/* Structured error display with remediation */}
      {error && (
        <div style={{ marginTop: 16 }}>
          <ErrorAlert
            error={error}
            onRecoveryAction={onRecoveryAction}
            onDismiss={onRecoveryAction ? () => onRecoveryAction('user_fix') : undefined}
          />
        </div>
      )}

      {/* Fallback simple error display if no structured error */}
      {!error && progress.error_message && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 'var(--radius)',
            color: 'var(--color-error)',
            fontSize: '0.875rem',
          }}
        >
          {progress.error_code && (
            <span style={{ fontWeight: 600, marginRight: 8 }}>{progress.error_code}</span>
          )}
          {progress.error_message}
        </div>
      )}
    </div>
  );
}
