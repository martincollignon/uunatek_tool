import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  XCircle,
  ChevronDown,
  ChevronUp,
  Unplug,
  Radio,
  Cog,
  Pen,
  FileText,
  Zap,
  Hand,
} from 'lucide-react';
import type { PlotterError, RecoveryAction, ErrorCategory, ErrorSeverity } from '../../types/errors';
import { SEVERITY_COLORS, CATEGORY_LABELS, RECOVERY_ACTION_LABELS } from '../../types/errors';

interface Props {
  error: PlotterError;
  onRecoveryAction?: (action: RecoveryAction) => void;
  onDismiss?: () => void;
}

// Get icon for category
function getCategoryIcon(category: ErrorCategory) {
  switch (category) {
    case 'connection':
      return Unplug;
    case 'power':
      return Zap;
    case 'communication':
      return Radio;
    case 'motion':
      return Cog;
    case 'user_input':
      return Hand;
    case 'pen':
      return Pen;
    case 'paper':
    case 'quality':
      return FileText;
    default:
      return AlertCircle;
  }
}

// Get icon for severity
function getSeverityIcon(severity: ErrorSeverity) {
  switch (severity) {
    case 'critical':
      return XCircle;
    case 'error':
      return AlertCircle;
    case 'warning':
      return AlertTriangle;
    case 'info':
      return Info;
  }
}

export function ErrorAlert({ error, onRecoveryAction, onDismiss }: Props) {
  const [isExpanded, setIsExpanded] = useState(error.severity === 'critical' || error.severity === 'error');

  const colors = SEVERITY_COLORS[error.severity];
  const SeverityIcon = getSeverityIcon(error.severity);
  const CategoryIcon = getCategoryIcon(error.category);

  return (
    <div
      className="error-alert"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: colors.text,
          }}
        >
          <SeverityIcon size={20} />
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: '0.875rem',
                color: colors.text,
              }}
            >
              {error.code}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '2px 6px',
                background: 'rgba(0,0,0,0.1)',
                borderRadius: '4px',
                color: 'var(--color-text-secondary)',
              }}
            >
              <CategoryIcon size={12} style={{ marginRight: 4, display: 'inline' }} />
              {CATEGORY_LABELS[error.category]}
            </span>
          </div>

          <h4
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: 'var(--color-text)',
            }}
          >
            {error.name}
          </h4>

          <p
            style={{
              margin: '4px 0 0',
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)',
            }}
          >
            {error.message}
          </p>
        </div>

        {onDismiss && (
          <button
            className="btn btn-icon"
            onClick={onDismiss}
            style={{ marginTop: -4, marginRight: -4 }}
          >
            <XCircle size={16} />
          </button>
        )}
      </div>

      {/* Expandable Details */}
      {error.remediation_steps.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary)',
            }}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {isExpanded ? 'Hide steps' : 'Show how to fix'}
          </button>

          {isExpanded && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: 'rgba(0,0,0,0.05)',
                borderRadius: 'var(--radius)',
              }}
            >
              {error.detail && (
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-secondary)',
                    marginTop: 0,
                    marginBottom: 12,
                    fontStyle: 'italic',
                  }}
                >
                  {error.detail}
                </p>
              )}

              <ol
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  fontSize: '0.8125rem',
                  color: 'var(--color-text)',
                }}
              >
                {error.remediation_steps.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: 6 }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Recovery Actions */}
      {onRecoveryAction && error.recovery_actions.length > 0 && (
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {error.recovery_actions.map((action) => (
            <button
              key={action}
              className={action === 'abort' ? 'btn btn-secondary' : 'btn btn-primary'}
              onClick={() => onRecoveryAction(action)}
              style={{ fontSize: '0.8125rem' }}
            >
              {RECOVERY_ACTION_LABELS[action]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
