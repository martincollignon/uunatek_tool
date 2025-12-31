import { useState, useEffect } from 'react';
import { X, AlertTriangle, Pen, FileText, CheckCircle, ChevronRight } from 'lucide-react';
import type { ErrorCategory, UserReportableError } from '../../types/errors';
import { USER_PROBLEM_CATEGORIES, CATEGORY_LABELS } from '../../types/errors';
import { plotterApi } from '../../services/api';

interface Props {
  onClose: () => void;
  onReportProblem: (errorCode: string) => void;
}

type Step = 'category' | 'problem' | 'confirming';

export function ReportProblemDialog({ onClose, onReportProblem }: Props) {
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<ErrorCategory | null>(null);
  const [availableErrors, setAvailableErrors] = useState<UserReportableError[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch available errors for category
  useEffect(() => {
    if (selectedCategory) {
      setIsLoading(true);
      plotterApi
        .getErrorsByCategory(selectedCategory)
        .then((errors) => {
          // Filter to only user-reportable errors
          setAvailableErrors(errors.filter((e: { is_auto_detected: boolean }) => !e.is_auto_detected));
        })
        .catch(() => {
          setAvailableErrors([]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [selectedCategory]);

  const getCategoryIcon = (category: ErrorCategory) => {
    switch (category) {
      case 'pen':
        return Pen;
      case 'paper':
      case 'quality':
        return FileText;
      default:
        return AlertTriangle;
    }
  };

  const handleCategorySelect = (category: ErrorCategory) => {
    setSelectedCategory(category);
    setStep('problem');
  };

  const handleProblemSelect = (errorCode: string) => {
    setStep('confirming');
    onReportProblem(errorCode);
  };

  const handleBack = () => {
    if (step === 'problem') {
      setStep('category');
      setSelectedCategory(null);
    }
  };

  // Category selection step
  const renderCategoryStep = () => (
    <>
      <div className="dialog-content">
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '0.875rem',
            marginBottom: 16,
          }}
        >
          What type of problem are you experiencing? Select a category to see specific issues.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {USER_PROBLEM_CATEGORIES.map((cat) => {
            const Icon = getCategoryIcon(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.background = 'var(--color-bg)';
                }}
              >
                <Icon size={24} style={{ color: 'var(--color-primary)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{cat.label}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    {cat.description}
                  </div>
                </div>
                <ChevronRight size={20} style={{ color: 'var(--color-text-secondary)' }} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="dialog-footer">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </>
  );

  // Problem selection step
  const renderProblemStep = () => (
    <>
      <div className="dialog-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button
            className="btn btn-icon"
            onClick={handleBack}
            style={{ marginLeft: -8 }}
          >
            <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <span style={{ fontWeight: 500 }}>
            {selectedCategory && CATEGORY_LABELS[selectedCategory]}
          </span>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-secondary)' }}>
            Loading problems...
          </div>
        ) : availableErrors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-secondary)' }}>
            No problems available for this category.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {availableErrors.map((error) => (
              <button
                key={error.code}
                onClick={() => handleProblemSelect(error.code)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 12,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
              >
                <AlertTriangle size={18} style={{ color: '#eab308', marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: 2 }}>
                    {error.name}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    {error.message}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="dialog-footer">
        <button className="btn btn-secondary" onClick={handleBack}>
          Back
        </button>
      </div>
    </>
  );

  // Confirming step
  const renderConfirmingStep = () => (
    <div className="dialog-content" style={{ textAlign: 'center' }}>
      <CheckCircle size={48} style={{ color: 'var(--color-success)', marginBottom: 16 }} />
      <h3 style={{ marginBottom: 8, fontWeight: 500 }}>Problem Reported</h3>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
        The plot has been paused. Follow the remediation steps shown to fix the issue.
      </p>
    </div>
  );

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, width: '90%' }}
      >
        <div className="dialog-header flex justify-between items-center">
          <h2 className="dialog-title">Report a Problem</h2>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {step === 'category' && renderCategoryStep()}
        {step === 'problem' && renderProblemStep()}
        {step === 'confirming' && renderConfirmingStep()}
      </div>
    </div>
  );
}
