import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkflowStep } from '../types';

interface WorkflowState {
  currentStep: WorkflowStep;
  projectId: string | null;
  isDoubleSided: boolean;
  hasEnvelope: boolean;
  side1Completed: boolean;
  side2Completed: boolean;
  envelopeCompleted: boolean;

  // Actions
  startWorkflow: (projectId: string, isDoubleSided: boolean, hasEnvelope: boolean) => void;
  setStep: (step: WorkflowStep) => void;
  confirmStep: () => void;
  cancelWorkflow: () => void;
  resetWorkflow: () => void;
  loadWorkflow: (projectId: string) => void;
  saveWorkflow: (projectId: string) => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      currentStep: 'idle',
      projectId: null,
      isDoubleSided: false,
      hasEnvelope: false,
      side1Completed: false,
      side2Completed: false,
      envelopeCompleted: false,

      startWorkflow: (projectId, isDoubleSided, hasEnvelope) => {
        set({
          projectId,
          isDoubleSided,
          hasEnvelope,
          currentStep: 'preview_side1',
          side1Completed: false,
          side2Completed: false,
          envelopeCompleted: false,
        });
      },

      setStep: (step) => set({ currentStep: step }),

      confirmStep: () => {
        const state = get();

        const transitions: Record<WorkflowStep, WorkflowStep> = {
          idle: 'editing',
          editing: 'preview_side1',
          preview_side1: 'plotting_side1',
          plotting_side1: 'confirm_side1',
          confirm_side1: state.isDoubleSided
            ? 'flip_paper'
            : state.hasEnvelope
              ? 'insert_envelope'
              : 'completed',
          flip_paper: 'preview_side2',
          preview_side2: 'plotting_side2',
          plotting_side2: 'confirm_side2',
          confirm_side2: state.hasEnvelope ? 'insert_envelope' : 'completed',
          insert_envelope: 'preview_envelope',
          preview_envelope: 'plotting_envelope',
          plotting_envelope: 'confirm_envelope',
          confirm_envelope: 'completed',
          completed: 'idle',
        };

        const updates: Partial<WorkflowState> = {
          currentStep: transitions[state.currentStep],
        };

        if (state.currentStep === 'confirm_side1') {
          updates.side1Completed = true;
        } else if (state.currentStep === 'confirm_side2') {
          updates.side2Completed = true;
        } else if (state.currentStep === 'confirm_envelope') {
          updates.envelopeCompleted = true;
        }

        set(updates);
      },

      cancelWorkflow: () => {
        set({ currentStep: 'editing' });
      },

      resetWorkflow: () => {
        set({
          currentStep: 'idle',
          projectId: null,
          isDoubleSided: false,
          hasEnvelope: false,
          side1Completed: false,
          side2Completed: false,
          envelopeCompleted: false,
        });
      },

      loadWorkflow: (projectId: string) => {
        const state = get();
        if (state.projectId !== projectId) {
          set({
            projectId,
            currentStep: 'idle',
            side1Completed: false,
            side2Completed: false,
            envelopeCompleted: false,
          });
        }
      },

      saveWorkflow: () => {
        // Automatically persisted via zustand middleware
      },
    }),
    {
      name: 'plotter-workflow',
      partialize: (state) => ({
        currentStep: state.currentStep,
        projectId: state.projectId,
        isDoubleSided: state.isDoubleSided,
        hasEnvelope: state.hasEnvelope,
        side1Completed: state.side1Completed,
        side2Completed: state.side2Completed,
        envelopeCompleted: state.envelopeCompleted,
      }),
    }
  )
);
