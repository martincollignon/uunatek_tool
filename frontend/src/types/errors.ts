/**
 * Error types for iDraw 2.0 plotter error handling.
 * Mirrors backend error definitions.
 */

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

export type ErrorCategory =
  | 'connection'
  | 'power'
  | 'communication'
  | 'motion'
  | 'user_input'
  | 'pen'
  | 'paper'
  | 'quality';

export type RecoveryAction =
  | 'retry'
  | 'reconnect'
  | 'home'
  | 'emergency_stop'
  | 'pen_up'
  | 'disable_motors'
  | 'user_fix'
  | 'abort'
  | 'resume';

export interface PlotterError {
  code: string;
  name: string;
  message: string;
  detail: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  remediation_steps: string[];
  recovery_actions: RecoveryAction[];
  is_auto_detected: boolean;
  context?: Record<string, unknown>;
}

export interface UserReportableError {
  code: string;
  name: string;
  message: string;
  category: ErrorCategory;
}

// Severity colors
export const SEVERITY_COLORS: Record<ErrorSeverity, { bg: string; border: string; text: string }> = {
  critical: {
    bg: 'rgba(239, 68, 68, 0.15)',
    border: 'var(--color-error)',
    text: 'var(--color-error)',
  },
  error: {
    bg: 'rgba(249, 115, 22, 0.15)',
    border: '#f97316',
    text: '#f97316',
  },
  warning: {
    bg: 'rgba(234, 179, 8, 0.15)',
    border: '#eab308',
    text: '#eab308',
  },
  info: {
    bg: 'rgba(59, 130, 246, 0.15)',
    border: 'var(--color-primary)',
    text: 'var(--color-primary)',
  },
};

// Category labels
export const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  connection: 'Connection',
  power: 'Power',
  communication: 'Communication',
  motion: 'Motion',
  user_input: 'User Input',
  pen: 'Pen',
  paper: 'Paper',
  quality: 'Quality',
};

// Recovery action labels
export const RECOVERY_ACTION_LABELS: Record<RecoveryAction, string> = {
  retry: 'Try Again',
  reconnect: 'Reconnect',
  home: 'Home Plotter',
  emergency_stop: 'Emergency Stop',
  pen_up: 'Raise Pen',
  disable_motors: 'Disable Motors',
  user_fix: 'I Fixed It',
  abort: 'Cancel Plot',
  resume: 'Resume',
};

// Problem categories for user reporting
export interface ProblemCategory {
  id: ErrorCategory;
  label: string;
  description: string;
  errors: string[]; // Error codes
}

export const USER_PROBLEM_CATEGORIES: ProblemCategory[] = [
  {
    id: 'pen',
    label: 'Pen Issues',
    description: 'Problems with pen contact, ink, or drawing quality',
    errors: ['PLT-P001', 'PLT-P002', 'PLT-P003', 'PLT-P004'],
  },
  {
    id: 'paper',
    label: 'Paper Issues',
    description: 'Problems with paper position or condition',
    errors: ['PLT-S001', 'PLT-S002', 'PLT-S003'],
  },
  {
    id: 'quality',
    label: 'Quality Issues',
    description: 'Problems with plot output quality',
    errors: ['PLT-Q001', 'PLT-Q002', 'PLT-Q003'],
  },
];
