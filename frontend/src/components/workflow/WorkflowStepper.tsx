import { Check, Circle, Loader2 } from 'lucide-react';
import type { WorkflowStep } from '../../types';

interface StepInfo {
  key: string;
  label: string;
  description: string;
}

interface Props {
  currentStep: WorkflowStep;
  isDoubleSided: boolean;
  includeEnvelope: boolean;
}

export function WorkflowStepper({ currentStep, isDoubleSided, includeEnvelope }: Props) {
  const allSteps: StepInfo[] = [
    { key: 'side1', label: 'Side 1', description: 'Plot the front side' },
    ...(isDoubleSided
      ? [{ key: 'side2', label: 'Side 2', description: 'Flip paper and plot back' }]
      : []),
    ...(includeEnvelope
      ? [{ key: 'envelope', label: 'Envelope', description: 'Insert and plot envelope' }]
      : []),
  ];

  const getStepStatus = (stepKey: string): 'completed' | 'current' | 'upcoming' => {
    const stepMapping: Record<string, WorkflowStep[]> = {
      side1: ['preview_side1', 'plotting_side1', 'confirm_side1'],
      side2: ['flip_paper', 'preview_side2', 'plotting_side2', 'confirm_side2'],
      envelope: ['insert_envelope', 'preview_envelope', 'plotting_envelope', 'confirm_envelope'],
    };

    const completedMapping: Record<string, WorkflowStep[]> = {
      side1: [
        'flip_paper',
        'preview_side2',
        'plotting_side2',
        'confirm_side2',
        'insert_envelope',
        'preview_envelope',
        'plotting_envelope',
        'confirm_envelope',
        'completed',
      ],
      side2: [
        'insert_envelope',
        'preview_envelope',
        'plotting_envelope',
        'confirm_envelope',
        'completed',
      ],
      envelope: ['completed'],
    };

    if (completedMapping[stepKey]?.includes(currentStep)) {
      return 'completed';
    }
    if (stepMapping[stepKey]?.includes(currentStep)) {
      return 'current';
    }
    return 'upcoming';
  };

  return (
    <div className="workflow-stepper">
      {allSteps.map((step, index) => {
        const status = getStepStatus(step.key);
        return (
          <div key={step.key} className={`workflow-step ${status}`}>
            <div className="step-indicator">
              {status === 'completed' ? (
                <Check size={16} />
              ) : status === 'current' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Circle size={16} />
              )}
            </div>
            <div className="step-content">
              <div className="step-label">{step.label}</div>
              <div className="step-description">{step.description}</div>
            </div>
            {index < allSteps.length - 1 && <div className="step-connector" />}
          </div>
        );
      })}
    </div>
  );
}
