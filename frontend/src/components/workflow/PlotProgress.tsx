import { Loader2, AlertTriangle } from 'lucide-react';
import type { PlotProgress as OldPlotProgressType } from '../../types';
import type { PlotProgress as NewPlotProgressType } from '../../lib/plotter';
import type { PlotterError, RecoveryAction } from '../../types/errors';
import { ErrorAlert } from '../errors/ErrorAlert';

// Union type to support both old and new progress formats
type PlotProgressUnion = OldPlotProgressType | NewPlotProgressType | null;

interface Props {
  progress: PlotProgressUnion;
  error?: PlotterError | null;
  onRecoveryAction?: (action: RecoveryAction) => void;
  onReportProblem?: () => void;
}

// Helper to normalize progress data from either format
function normalizeProgress(progress: PlotProgressUnion): {
  status: string;
  currentCommand: number;
  totalCommands: number;
  percentage: number;
  elapsedTime?: number;
  estimatedRemaining?: number;
  errorMessage?: string;
  errorCode?: string;
} | null {
  if (!progress) return null;

  // Check if it's the new format (has 'state' field)
  if ('state' in progress) {
    return {
      status: progress.state,
      currentCommand: progress.currentCommand,
      totalCommands: progress.totalCommands,
      percentage: progress.percentage,
      errorMessage: progress.errorMessage,
      errorCode: progress.errorCode,
    };
  }

  // Old format (has 'status' field)
  const oldProgress = progress as OldPlotProgressType;
  const percentage = oldProgress.total_commands > 0
    ? Math.round((oldProgress.current_command / oldProgress.total_commands) * 100)
    : 0;

  return {
    status: oldProgress.status,
    currentCommand: oldProgress.current_command,
    totalCommands: oldProgress.total_commands,
    percentage,
    elapsedTime: oldProgress.elapsed_time,
    estimatedRemaining: oldProgress.estimated_remaining,
    errorMessage: oldProgress.error_message,
    errorCode: oldProgress.error_code,
  };
}

export function PlotProgress({ progress, error, onRecoveryAction, onReportProblem }: Props) {
  const normalized = normalizeProgress(progress);

  if (!normalized) {
    return (
      <div className="plot-progress">
        <p style={{ color: 'var(--color-text-secondary)' }}>No plot in progress</p>
      </div>
    );
  }

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
          {normalized.status === 'plotting' && <Loader2 size={16} className="animate-spin" />}
          {normalized.status === 'paused' && <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />}
          <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{normalized.status}</span>
        </div>
        <span style={{ fontWeight: 600 }}>{normalized.percentage}%</span>
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar"
          style={{
            width: `${normalized.percentage}%`,
            backgroundColor:
              normalized.status === 'completed'
                ? 'var(--color-success)'
                : normalized.status === 'error'
                  ? 'var(--color-error)'
                  : normalized.status === 'paused'
                    ? 'var(--color-warning)'
                    : 'var(--color-primary)',
          }}
        />
      </div>

      <div className="progress-stats">
        <div>
          <span style={{ color: 'var(--color-text-secondary)' }}>Commands: </span>
          <span>
            {normalized.currentCommand} / {normalized.totalCommands}
          </span>
        </div>
        {normalized.elapsedTime !== undefined && normalized.elapsedTime > 0 && (
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>Elapsed: </span>
            <span>{formatTime(normalized.elapsedTime)}</span>
          </div>
        )}
        {normalized.estimatedRemaining !== undefined && normalized.estimatedRemaining > 0 && normalized.status === 'plotting' && (
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>Remaining: </span>
            <span>{formatTime(normalized.estimatedRemaining)}</span>
          </div>
        )}
      </div>

      {/* Report Problem button - shown during plotting or paused state */}
      {(normalized.status === 'plotting' || normalized.status === 'paused') && onReportProblem && (
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
      {!error && normalized.errorMessage && (
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
          {normalized.errorCode && (
            <span style={{ fontWeight: 600, marginRight: 8 }}>{normalized.errorCode}</span>
          )}
          {normalized.errorMessage}
        </div>
      )}
    </div>
  );
}
