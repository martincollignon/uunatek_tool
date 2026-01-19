import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Square, Check, RotateCcw, Mail, Home, AlertCircle } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { usePlotterStore } from '../stores/plotterStore';
import { useWorkflowStore } from '../stores/workflowStore';
import { WorkflowStepper } from '../components/workflow/WorkflowStepper';
import { PlotProgress } from '../components/workflow/PlotProgress';
import { PlotterControls } from '../components/workflow/PlotterControls';
import { svgToPlotCommands } from '../lib/plotter';
import { exportCanvasSvg } from '../lib/canvas/fabricToSvg';
import * as projectDB from '../services/projectDB';
import { PAPER_DIMENSIONS } from '../types';

export function PlotPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentProject, loadProject, isLoading: projectLoading } = useProjectStore();
  const {
    status: plotterStatus,
    plotProgress,
    startPlot,
    pausePlot,
    resumePlot,
    cancelPlot,
    home,
    setCanvasSize,
    isSerialSupported,
  } = usePlotterStore();
  const { currentStep, setStep, resetWorkflow, loadWorkflow, saveWorkflow } = useWorkflowStore();

  const [svgPreview, setSvgPreview] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoadingSvg, setIsLoadingSvg] = useState(false);
  const [isStartingPlot, setIsStartingPlot] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Set canvas size when project loads
  useEffect(() => {
    if (currentProject) {
      setCanvasSize(currentProject.width_mm, currentProject.height_mm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject]);

  // Check if plot completed (using new progress format)
  // The new store uses event handlers, so plotProgress updates automatically
  useEffect(() => {
    if (!plotProgress) return;

    // Handle both old format (status) and new format (state)
    const progressState = 'state' in plotProgress
      ? plotProgress.state
      : (plotProgress as unknown as { status?: string }).status;

    if (progressState === 'completed' && currentStep.includes('plotting')) {
      // Move to confirm step
      if (currentStep === 'plotting_side1') setStep('confirm_side1');
      else if (currentStep === 'plotting_side2') setStep('confirm_side2');
      else if (currentStep === 'plotting_envelope') setStep('confirm_envelope');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotProgress, currentStep]);

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
    if (!projectId || !currentProject) return;
    setIsLoadingSvg(true);
    try {
      const side = getCurrentSide();

      // Get canvas data from IndexedDB
      const canvasJson = await projectDB.getCanvas(projectId, side as 'front' | 'back');

      // Get paper dimensions
      const paperSize = currentProject.paper_size;
      let widthMm = PAPER_DIMENSIONS[paperSize]?.width || 210;
      let heightMm = PAPER_DIMENSIONS[paperSize]?.height || 297;

      if (paperSize === 'custom') {
        widthMm = currentProject.custom_width_mm || 210;
        heightMm = currentProject.custom_height_mm || 297;
      }

      // Export to SVG
      const response = await exportCanvasSvg(canvasJson, widthMm, heightMm);
      setSvgPreview(response.svg);
      setWarnings(response.warnings);
    } catch (err) {
      console.error('Failed to load SVG preview:', err);
      setWarnings(['Failed to generate SVG preview']);
    } finally {
      setIsLoadingSvg(false);
    }
  }, [projectId, currentProject, getCurrentSide]);

  // Load SVG preview when entering preview step
  useEffect(() => {
    if (currentStep.includes('preview') && projectId) {
      loadSvgPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, projectId]);

  // Initialize workflow on mount
  useEffect(() => {
    if (currentProject && (currentStep === 'idle' || currentStep === 'editing')) {
      setStep('preview_side1');
      saveWorkflow(currentProject.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject, currentStep]);

  const handleStartPlot = async () => {
    if (!projectId || !svgPreview || !currentProject) return;

    setIsStartingPlot(true);
    try {
      const side = getCurrentSide();

      // Convert SVG to plot commands using the new TypeScript layer
      const commands = svgToPlotCommands(svgPreview, {
        canvasWidthMm: currentProject.width_mm,
        canvasHeightMm: currentProject.height_mm,
        safetyMarginMm: 3,
        optimizePaths: true,
      });

      if (commands.length === 0) {
        console.warn('No plottable content found in SVG');
        setIsStartingPlot(false);
        return;
      }

      // Update workflow step
      if (currentStep === 'preview_side1') setStep('plotting_side1');
      else if (currentStep === 'preview_side2') setStep('plotting_side2');
      else if (currentStep === 'preview_envelope') setStep('plotting_envelope');

      // Start plotting with the commands
      await startPlot(commands, side);
      if (projectId) saveWorkflow(projectId);
    } catch (err) {
      console.error('Failed to start plot:', err);
      // Revert to preview step on error
      if (currentStep === 'plotting_side1') setStep('preview_side1');
      else if (currentStep === 'plotting_side2') setStep('preview_side2');
      else if (currentStep === 'plotting_envelope') setStep('preview_envelope');
    } finally {
      setIsStartingPlot(false);
    }
  };

  const handlePause = () => {
    pausePlot();
  };

  const handleResume = () => {
    resumePlot();
  };

  const handleCancel = () => {
    cancelPlot();
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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{currentProject.name}</h1>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            {currentProject.width_mm}x{currentProject.height_mm}mm
            {currentProject.is_double_sided && ' • Double-sided'}
            {currentProject.include_envelope && ' • With envelope'}
          </span>
          {/* Check for paused state in both old and new format */}
          {(plotProgress && (
            ('state' in plotProgress && plotProgress.state === 'paused') ||
            ('status' in plotProgress && (plotProgress as { status?: string }).status === 'paused')
          )) && plotterStatus?.connected && (
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
            <h3 style={{ marginBottom: 16, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {isPreview && 'Preview'}
              {isPlotting && 'Plotting'}
              {isConfirm && 'Complete'}
              {isPaperAction && 'Action Required'}
              {isCompleted && 'All Done!'}
            </h3>

            {(isPreview || isPlotting || isConfirm) && (
              <>
                {warnings.length > 0 && (
                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: 'var(--radius)',
                      padding: '12px 16px',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgb(245, 158, 11)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 4, color: 'var(--color-warning)' }}>
                          Plottability Warnings
                        </h4>
                        <ul style={{ fontSize: '0.875rem', margin: 0, paddingLeft: 20, color: 'var(--color-warning)' }}>
                          {warnings.map((warning, index) => (
                            <li key={index} style={{ marginBottom: 4 }}>
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                <div className="svg-preview">
                  {isLoadingSvg ? (
                    <p>Loading preview...</p>
                  ) : svgPreview ? (
                    <div
                      style={{
                        width: '100%',
                        background: 'white',
                        borderRadius: 'var(--radius)',
                        padding: 16,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        dangerouslySetInnerHTML={{ __html: svgPreview }}
                        style={{
                          // Force SVG to render at our editor scale (3px per mm)
                          // This matches the canvas editor scale
                          width: currentProject ? `${currentProject.width_mm * 3}px` : 'auto',
                          height: currentProject ? `${currentProject.height_mm * 3}px` : 'auto',
                        }}
                      />
                    </div>
                  ) : (
                    <p style={{ color: 'var(--color-text-secondary)' }}>No content to preview</p>
                  )}
                </div>
              </>
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
              <>
                <button
                  className="btn btn-primary"
                  onClick={handleStartPlot}
                  disabled={!plotterStatus?.connected || isStartingPlot || !svgPreview}
                  style={{ minWidth: 200 }}
                >
                  <Play size={16} />
                  {isStartingPlot ? 'Preparing...' : 'Start Plotting'}
                </button>

                {!isSerialSupported && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: 'var(--radius)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertCircle size={16} style={{ color: 'var(--color-warning)' }} />
                    <span style={{ color: 'var(--color-warning)', fontSize: '0.8125rem' }}>
                      Your browser doesn't support serial connections. Use Chrome, Edge, or the desktop app.
                    </span>
                  </div>
                )}
              </>
            )}

            {isPlotting && (
              <div className="flex gap-2">
                {/* Check for paused state in both formats */}
                {(plotProgress && (
                  ('state' in plotProgress && plotProgress.state === 'paused') ||
                  ('status' in plotProgress && (plotProgress as { status?: string }).status === 'paused')
                )) ? (
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

            {!plotterStatus?.connected && isPreview && isSerialSupported && (
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

export default PlotPage;
