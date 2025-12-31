import { useState } from 'react';
import { X, Check, ChevronRight, ChevronUp, Loader2, AlertCircle } from 'lucide-react';
import { plotterApi } from '../../services/api';

interface Props {
  onClose: () => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;
type TestResult = 'pending' | 'success' | 'retry';

export function CalibrationWizard({ onClose }: Props) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult>('pending');
  const [penIsDown, setPenIsDown] = useState(false);

  const handleClose = () => {
    if (currentStep > 1 && currentStep < 5) {
      if (!confirm('Calibration is not complete. Are you sure you want to exit?')) {
        return;
      }
      // Ensure pen is up before closing
      plotterApi.penUp().catch(() => {});
    }
    onClose();
  };

  const handleMoveToPosition = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await plotterApi.moveToTestPosition(50, 50);
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move to test position');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePenDown = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await plotterApi.penDown();
      setPenIsDown(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lower pen');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePenUp = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await plotterApi.penUp();
      setPenIsDown(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to raise pen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrawTestPattern = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await plotterApi.drawTestPattern(10);
      setTestResult('pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to draw test pattern');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSuccess = () => {
    setTestResult('success');
    setCurrentStep(5);
  };

  const handleTestRetry = () => {
    setTestResult('retry');
    setCurrentStep(3);
    setPenIsDown(false);
  };

  const handleComplete = async () => {
    // Ensure pen is up and return home
    try {
      await plotterApi.penUp();
      await plotterApi.home();
    } catch {
      // Ignore errors on completion
    }
    onClose();
  };

  const renderStepIndicator = () => {
    const steps = [1, 2, 3, 4, 5];
    return (
      <div className="flex items-center justify-center gap-2" style={{ marginBottom: 24 }}>
        {steps.map((step, idx) => (
          <div key={step} className="flex items-center">
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                background:
                  step < currentStep
                    ? 'var(--color-success)'
                    : step === currentStep
                      ? 'var(--color-primary)'
                      : 'var(--color-border)',
                color: step <= currentStep ? 'white' : 'var(--color-text-secondary)',
              }}
            >
              {step < currentStep ? <Check size={14} /> : step}
            </div>
            {idx < steps.length - 1 && (
              <div
                style={{
                  width: 24,
                  height: 2,
                  background: step < currentStep ? 'var(--color-success)' : 'var(--color-border)',
                  marginLeft: 4,
                  marginRight: 4,
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderError = () => {
    if (!error) return null;
    return (
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--color-error)',
          borderRadius: 'var(--radius)',
          padding: 12,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--color-error)',
          fontSize: '0.875rem',
        }}
      >
        <AlertCircle size={16} />
        {error}
      </div>
    );
  };

  // Step 1: Introduction
  const renderStep1 = () => (
    <>
      <div className="dialog-content">
        <h3 style={{ marginBottom: 12, fontSize: '1rem', fontWeight: 600 }}>
          Pen Height Calibration
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, fontSize: '0.875rem' }}>
          This wizard will help you adjust your pen height for optimal plotting. The pen will move
          to a test position where you can physically adjust its height.
        </p>

        <div
          style={{
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius)',
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 500, marginBottom: 8, fontSize: '0.875rem' }}>
            Before starting, make sure:
          </div>
          <ul style={{ paddingLeft: 20, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            <li style={{ marginBottom: 4 }}>Paper is loaded on the plotter bed</li>
            <li style={{ marginBottom: 4 }}>Pen is installed in the pen holder</li>
            <li>You can reach the thumbscrew to adjust pen height</li>
          </ul>
        </div>
      </div>
      <div className="dialog-footer">
        <button className="btn btn-secondary" onClick={handleClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={() => setCurrentStep(2)}>
          Start Calibration
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );

  // Step 2: Move to test position
  const renderStep2 = () => (
    <>
      <div className="dialog-content">
        {renderError()}
        <h3 style={{ marginBottom: 12, fontSize: '1rem', fontWeight: 600 }}>
          Moving to Test Position
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, fontSize: '0.875rem' }}>
          The pen will now move to the center of the paper (50mm, 50mm from home) where you can
          adjust its height.
        </p>

        {isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              gap: 12,
            }}
          >
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            <span>Moving pen to test position...</span>
          </div>
        )}
      </div>
      <div className="dialog-footer">
        <button className="btn btn-secondary" onClick={() => setCurrentStep(1)} disabled={isLoading}>
          Back
        </button>
        <button className="btn btn-primary" onClick={handleMoveToPosition} disabled={isLoading}>
          {isLoading ? 'Moving...' : 'Move to Position'}
          {!isLoading && <ChevronRight size={16} />}
        </button>
      </div>
    </>
  );

  // Step 3: Adjust pen height (key step)
  const renderStep3 = () => (
    <>
      <div className="dialog-content">
        {renderError()}
        <h3 style={{ marginBottom: 12, fontSize: '1rem', fontWeight: 600 }}>Adjust Pen Height</h3>

        <div
          style={{
            background: penIsDown ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            border: `1px solid ${penIsDown ? 'var(--color-error)' : 'var(--color-success)'}`,
            borderRadius: 'var(--radius)',
            padding: 12,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>
            Pen is {penIsDown ? 'DOWN' : 'UP'}
          </span>
          {penIsDown ? (
            <button className="btn btn-secondary" onClick={handlePenUp} disabled={isLoading}>
              <ChevronUp size={16} />
              Lift Pen
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handlePenDown} disabled={isLoading}>
              Lower Pen
            </button>
          )}
        </div>

        {penIsDown && (
          <div
            style={{
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius)',
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 12, fontSize: '0.875rem' }}>
              While the pen is down:
            </div>
            <ol
              style={{
                paddingLeft: 20,
                color: 'var(--color-text-secondary)',
                fontSize: '0.875rem',
              }}
            >
              <li style={{ marginBottom: 8 }}>
                <strong>Loosen</strong> the thumbscrew on the pen holder
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Slide the pen down</strong> until it just touches the paper
              </li>
              <li style={{ marginBottom: 8 }}>
                Apply <strong>slight pressure</strong> for good ink contact
              </li>
              <li>
                <strong>Tighten</strong> the thumbscrew to lock the position
              </li>
            </ol>
          </div>
        )}

        {!penIsDown && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Lower the pen to begin adjusting its height. The pen will stay down while you make
            adjustments.
          </p>
        )}
      </div>
      <div className="dialog-footer">
        <button className="btn btn-secondary" onClick={() => setCurrentStep(2)} disabled={isLoading}>
          Back
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            handlePenUp().then(() => setCurrentStep(4));
          }}
          disabled={isLoading || !penIsDown}
        >
          Pen is Adjusted
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );

  // Step 4: Draw test mark
  const renderStep4 = () => (
    <>
      <div className="dialog-content">
        {renderError()}
        <h3 style={{ marginBottom: 12, fontSize: '1rem', fontWeight: 600 }}>Draw Test Mark</h3>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, fontSize: '0.875rem' }}>
          A small test pattern (10mm square with X) will be drawn to verify the pen makes proper
          contact with the paper.
        </p>

        <div
          style={{
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius)',
            padding: 24,
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {/* Test pattern preview */}
          <svg width="80" height="80" viewBox="0 0 80 80" style={{ opacity: 0.6 }}>
            <rect
              x="10"
              y="10"
              width="60"
              height="60"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line x1="10" y1="10" x2="70" y2="70" stroke="currentColor" strokeWidth="2" />
            <line x1="70" y1="10" x2="10" y2="70" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        {isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              gap: 12,
            }}
          >
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            <span>Drawing test pattern...</span>
          </div>
        )}

        {!isLoading && testResult === 'pending' && (
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-primary" onClick={handleDrawTestPattern}>
              Draw Test Pattern
            </button>
          </div>
        )}

        {!isLoading && testResult === 'pending' && (
          <div style={{ marginTop: 16 }}>
            <p
              style={{
                fontWeight: 500,
                marginBottom: 8,
                fontSize: '0.875rem',
                textAlign: 'center',
              }}
            >
              Did the test mark draw correctly?
            </p>
            <div className="flex gap-2 justify-center">
              <button className="btn btn-secondary" onClick={handleTestRetry}>
                No, adjust again
              </button>
              <button className="btn btn-primary" onClick={handleTestSuccess}>
                <Check size={16} />
                Yes, looks good
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="dialog-footer">
        <button className="btn btn-secondary" onClick={() => setCurrentStep(3)} disabled={isLoading}>
          Back
        </button>
      </div>
    </>
  );

  // Step 5: Complete
  const renderStep5 = () => (
    <>
      <div className="dialog-content" style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(34, 197, 94, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Check size={32} style={{ color: 'var(--color-success)' }} />
        </div>
        <h3 style={{ marginBottom: 12, fontSize: '1.125rem', fontWeight: 600 }}>
          Calibration Complete!
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Your pen is now calibrated and ready for plotting.
        </p>
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '0.75rem',
            marginTop: 12,
            fontStyle: 'italic',
          }}
        >
          Tip: If you change pens, run calibration again.
        </p>
      </div>
      <div className="dialog-footer" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={handleComplete}>
          Done
        </button>
      </div>
    </>
  );

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, width: '90%' }}
      >
        <div className="dialog-header flex justify-between items-center">
          <h2 className="dialog-title">Calibrate Pen</h2>
          <button className="btn btn-icon" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {renderStepIndicator()}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
      </div>
    </div>
  );
}
