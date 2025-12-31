import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Square, Check, RotateCcw, Mail, Home } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { usePlotterStore } from '../stores/plotterStore';
import { useWorkflowStore } from '../stores/workflowStore';
import { WorkflowStepper } from '../components/workflow/WorkflowStepper';
import { PlotProgress } from '../components/workflow/PlotProgress';
import { PlotterControls } from '../components/workflow/PlotterControls';
import { canvasApi } from '../services/api';

export function PlotPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentProject, loadProject, isLoading: projectLoading } = useProjectStore();
  const { status: plotterStatus, startPlot, pausePlot, resumePlot, cancelPlot, plotProgress, fetchPlotStatus, home } = usePlotterStore();
  const { currentStep, setStep, resetWorkflow, loadWorkflow, saveWorkflow } = useWorkflowStore();

  const [svgPreview, setSvgPreview] = useState<string | null>(null);
  const [isLoadingSvg, setIsLoadingSvg] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (projectId) {
      loadProject(projectId).catch((err) => {
        if (err?.response?.status === 404) {
          console.error('Project not found, redirecting to home');
          navigate('/');
        }
      });
      loadWorkflow(projectId);
    }
  }, [projectId, loadProject, loadWorkflow, navigate]);

  // Poll plot status during plotting
  useEffect(() => {
    if (currentStep.includes('plotting')) {
      intervalRef.current = setInterval(() => {
        fetchPlotStatus();
      }, 500);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentStep, fetchPlotStatus]);

  // Check if plot completed
  useEffect(() => {
    if (plotProgress?.status === 'completed' && currentStep.includes('plotting')) {
      // Move to confirm step
      if (currentStep === 'plotting_side1') setStep('confirm_side1');
      else if (currentStep === 'plotting_side2') setStep('confirm_side2');
      else if (currentStep === 'plotting_envelope') setStep('confirm_envelope');
    }
  }, [plotProgress, currentStep, setStep]);

  const getCurrentSide = useCallback((): 'front' | 'back' | 'envelope' => {
    if (currentStep.includes('side1') || currentStep === 'editing' || currentStep === 'idle') {
      return 'front';
    }
    if (currentStep.includes('side2') || currentStep === 'flip_paper') {
      return 'back';
    }
    return 'envelope';
  }, [currentStep]);

  const loadSvgPreview = useCallback(async () => {
    if (!projectId) return;
    setIsLoadingSvg(true);
    try {
      const side = getCurrentSide();
      const svg = await canvasApi.exportSvg(projectId, side);
      setSvgPreview(svg);
    } catch (err) {
      console.error('Failed to load SVG preview:', err);
    } finally {
      setIsLoadingSvg(false);
    }
  }, [projectId, getCurrentSide]);

  // Load SVG preview when entering preview step
  useEffect(() => {
    if (currentStep.includes('preview') && projectId) {
      loadSvgPreview();
    }
  }, [currentStep, projectId, loadSvgPreview]);

  // Initialize workflow on mount
  useEffect(() => {
    if (currentProject && (currentStep === 'idle' || currentStep === 'editing')) {
      setStep('preview_side1');
      saveWorkflow(currentProject.id);
    }
  }, [currentProject, currentStep, setStep, saveWorkflow]);

  const handleStartPlot = async () => {
    if (!projectId) return;
    const side = getCurrentSide();

    if (currentStep === 'preview_side1') setStep('plotting_side1');
    else if (currentStep === 'preview_side2') setStep('plotting_side2');
    else if (currentStep === 'preview_envelope') setStep('plotting_envelope');

    await startPlot(projectId, side);
    if (projectId) saveWorkflow(projectId);
  };

  const handlePause = async () => {
    await pausePlot();
  };

  const handleResume = async () => {
    await resumePlot();
  };

  const handleCancel = async () => {
    await cancelPlot();
    // Go back to preview
    if (currentStep === 'plotting_side1') setStep('preview_side1');
    else if (currentStep === 'plotting_side2') setStep('preview_side2');
    else if (currentStep === 'plotting_envelope') setStep('preview_envelope');
    if (projectId) saveWorkflow(projectId);
  };

  const handleConfirmAndContinue = () => {
    if (!currentProject || !projectId) return;

    if (currentStep === 'confirm_side1') {
      if (currentProject.is_double_sided) {
        setStep('flip_paper');
      } else if (currentProject.include_envelope) {
        setStep('insert_envelope');
      } else {
        setStep('completed');
      }
    } else if (currentStep === 'confirm_side2') {
      if (currentProject.include_envelope) {
        setStep('insert_envelope');
      } else {
        setStep('completed');
      }
    } else if (currentStep === 'confirm_envelope') {
      setStep('completed');
    }
    saveWorkflow(projectId);
  };

  const handlePaperReady = () => {
    if (!projectId) return;
    if (currentStep === 'flip_paper') {
      setStep('preview_side2');
    } else if (currentStep === 'insert_envelope') {
      setStep('preview_envelope');
    }
    saveWorkflow(projectId);
  };

  const handleBackToEditor = () => {
    navigate(`/editor/${projectId}`);
  };

  const handleReset = () => {
    if (!projectId) return;
    resetWorkflow();
    setStep('preview_side1');
    saveWorkflow(projectId);
  };

  const handleHome = async () => {
    await home();
  };

  if (projectLoading || !currentProject) {
    return (
      <div className="page">
        <p>Loading project...</p>
      </div>
    );
  }

  const isPlotting = currentStep.includes('plotting');
  const isPreview = currentStep.includes('preview');
  const isConfirm = currentStep.includes('confirm');
  const isPaperAction = currentStep === 'flip_paper' || currentStep === 'insert_envelope';
  const isCompleted = currentStep === 'completed';

  return (
    <div className="plot-layout">
      {/* Header */}
      <div className="plot-header">
        <div className="flex items-center gap-4">
          <button className="btn btn-secondary btn-icon" onClick={handleBackToEditor}>
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{currentProject.name}</h1>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            {currentProject.width_mm}x{currentProject.height_mm}mm
            {currentProject.is_double_sided && ' • Double-sided'}
            {currentProject.include_envelope && ' • With envelope'}
          </span>
          {plotProgress?.status === 'paused' && plotterStatus?.connected && (
            <button
              className="btn btn-secondary"
              onClick={handleHome}
              title="Return plotter to home position"
            >
              <Home size={16} />
              Home
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="plot-content">
        {/* Left: Workflow stepper and controls */}
        <div className="plot-sidebar">
          <WorkflowStepper
            currentStep={currentStep}
            isDoubleSided={currentProject.is_double_sided}
            includeEnvelope={currentProject.include_envelope}
          />

          <div style={{ marginTop: 24 }}>
            <PlotterControls />
          </div>
        </div>

        {/* Center: Preview and actions */}
        <div className="plot-main">
          {/* Preview area */}
          <div className="preview-container">
            <h3 style={{ marginBottom: 16, fontSize: '0.875rem', fontWeight: 600 }}>
              {isPreview && 'Preview'}
              {isPlotting && 'Plotting'}
              {isConfirm && 'Complete'}
              {isPaperAction && 'Action Required'}
              {isCompleted && 'All Done!'}
            </h3>

            {(isPreview || isPlotting || isConfirm) && (
              <div className="svg-preview">
                {isLoadingSvg ? (
                  <p>Loading preview...</p>
                ) : svgPreview ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: svgPreview }}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 400,
                      background: 'white',
                      borderRadius: 'var(--radius)',
                      padding: 16,
                    }}
                  />
                ) : (
                  <p style={{ color: 'var(--color-text-secondary)' }}>No content to preview</p>
                )}
              </div>
            )}

            {isPaperAction && (
              <div className="paper-action">
                <div
                  style={{
                    padding: 32,
                    background: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: 'var(--radius)',
                    textAlign: 'center',
                  }}
                >
                  {currentStep === 'flip_paper' ? (
                    <>
                      <RotateCcw size={48} style={{ marginBottom: 16, color: 'var(--color-primary)' }} />
                      <h4 style={{ marginBottom: 8 }}>Flip the Paper</h4>
                      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>
                        Remove the paper from the plotter, flip it over, and reinsert it in the same
                        position.
                      </p>
                    </>
                  ) : (
                    <>
                      <Mail size={48} style={{ marginBottom: 16, color: 'var(--color-primary)' }} />
                      <h4 style={{ marginBottom: 8 }}>Insert Envelope</h4>
                      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>
                        Remove the paper and insert the envelope into the plotter.
                      </p>
                    </>
                  )}
                  <button className="btn btn-primary" onClick={handlePaperReady}>
                    <Check size={16} />
                    Ready to Continue
                  </button>
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="completed-message">
                <div
                  style={{
                    padding: 32,
                    background: 'rgba(34, 197, 94, 0.1)',
                    borderRadius: 'var(--radius)',
                    textAlign: 'center',
                  }}
                >
                  <Check size={48} style={{ marginBottom: 16, color: 'var(--color-success)' }} />
                  <h4 style={{ marginBottom: 8 }}>Plotting Complete!</h4>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>
                    All sides have been plotted successfully.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button className="btn btn-secondary" onClick={handleReset}>
                      <RotateCcw size={16} />
                      Plot Again
                    </button>
                    <button className="btn btn-primary" onClick={handleBackToEditor}>
                      Back to Editor
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {isPlotting && (
            <div style={{ marginTop: 24 }}>
              <PlotProgress progress={plotProgress} />
            </div>
          )}

          {/* Action buttons */}
          <div className="plot-actions" style={{ marginTop: 24 }}>
            {isPreview && (
              <button
                className="btn btn-primary"
                onClick={handleStartPlot}
                disabled={!plotterStatus?.connected}
                style={{ minWidth: 200 }}
              >
                <Play size={16} />
                Start Plotting
              </button>
            )}

            {isPlotting && (
              <div className="flex gap-2">
                {plotProgress?.status === 'paused' ? (
                  <button className="btn btn-primary" onClick={handleResume}>
                    <Play size={16} />
                    Resume
                  </button>
                ) : (
                  <button className="btn btn-secondary" onClick={handlePause}>
                    <Pause size={16} />
                    Pause
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={handleCancel}
                  style={{ color: 'var(--color-error)' }}
                >
                  <Square size={16} />
                  Cancel
                </button>
              </div>
            )}

            {isConfirm && (
              <button className="btn btn-primary" onClick={handleConfirmAndContinue}>
                <Check size={16} />
                {currentStep === 'confirm_envelope' ||
                 (!currentProject.is_double_sided && currentStep === 'confirm_side1' && !currentProject.include_envelope) ||
                 (!currentProject.include_envelope && currentStep === 'confirm_side2')
                  ? 'Finish'
                  : 'Continue to Next Step'}
              </button>
            )}

            {!plotterStatus?.connected && isPreview && (
              <p
                style={{
                  color: 'var(--color-warning)',
                  fontSize: '0.875rem',
                  marginTop: 8,
                }}
              >
                Connect the plotter to start plotting
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
