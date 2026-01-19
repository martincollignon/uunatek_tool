// Paper sizes
export type PaperSize = 'business_card' | 'a6' | 'a5' | 'a4' | 'a3' | 'custom';

export const PAPER_DIMENSIONS: Record<PaperSize, { width: number; height: number; label: string }> = {
  business_card: { width: 85, height: 55, label: 'Business Card (85x55mm)' },
  a6: { width: 105, height: 148, label: 'A6 (105x148mm)' },
  a5: { width: 148, height: 210, label: 'A5 (148x210mm)' },
  a4: { width: 210, height: 297, label: 'A4 (210x297mm)' },
  a3: { width: 297, height: 420, label: 'A3 (297x420mm)' },
  custom: { width: 210, height: 297, label: 'Custom' },
};

// Envelope sizes
export type EnvelopeSize = 'c7' | 'c7_6' | 'dl' | 'c6' | 'c5' | 'c4';

export const ENVELOPE_DIMENSIONS: Record<EnvelopeSize, { width: number; height: number; label: string }> = {
  c7: { width: 81, height: 114, label: 'C7 (81x114mm)' },
  c7_6: { width: 81, height: 162, label: 'C7/6 (81x162mm)' },
  dl: { width: 220, height: 110, label: 'DL (220x110mm)' },
  c6: { width: 162, height: 114, label: 'C6 (162x114mm)' },
  c5: { width: 229, height: 162, label: 'C5 (229x162mm)' },
  c4: { width: 324, height: 229, label: 'C4 (324x229mm)' },
};

export const ENVELOPE_SIZES: Record<string, { name: string; width: number; height: number }> = {
  c7: { name: 'C7', width: 81, height: 114 },
  c7_6: { name: 'C7/6', width: 81, height: 162 },
  dl: { name: 'DL', width: 220, height: 110 },
  c6: { name: 'C6', width: 162, height: 114 },
  c5: { name: 'C5', width: 229, height: 162 },
  c4: { name: 'C4', width: 324, height: 229 },
  us_standard: { name: 'US Standard (#10)', width: 241, height: 105 },
  a2: { name: 'A2', width: 146, height: 111 },
};

// Project
export interface EnvelopeAddress {
  recipient_name: string;
  recipient_street?: string;
  recipient_city: string;
  recipient_country?: string;
  sender_name?: string;
  sender_street?: string;
  sender_city?: string;
  sender_country?: string;
}

export interface Project {
  id: string;
  name: string;
  paper_size: PaperSize;
  width_mm: number;
  height_mm: number;
  custom_width_mm?: number;
  custom_height_mm?: number;
  is_double_sided: boolean;
  include_envelope: boolean;
  envelope_address?: EnvelopeAddress;
  canvas_front?: Record<string, unknown>;
  canvas_back?: Record<string, unknown>;
  canvas_envelope?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  paper_size: PaperSize;
  custom_width_mm?: number;
  custom_height_mm?: number;
  is_double_sided: boolean;
  include_envelope: boolean;
  envelope_address?: EnvelopeAddress;
}

// Plotter
export type PlotState = 'idle' | 'connecting' | 'plotting' | 'paused' | 'completed' | 'error' | 'cancelled';
export type PenState = 'up' | 'down' | 'unknown';

export interface PlotterStatus {
  connected: boolean;
  port?: string;
  firmware_version?: string;
  pen_state: PenState;
  motors_enabled: boolean;
}

export interface PlotProgress {
  status: PlotState;
  current_command: number;
  total_commands: number;
  elapsed_time: number;
  estimated_remaining: number;
  current_side?: string;
  error_message?: string;
  error_code?: string;  // Structured error code (e.g., PLT-C004)
}

export interface SerialPort {
  device: string;
  description: string;
  hwid: string;
  is_compatible: boolean;
  device_name?: string;
}

// Workflow
export type WorkflowStep =
  | 'idle'
  | 'editing'
  | 'preview_side1'
  | 'plotting_side1'
  | 'confirm_side1'
  | 'flip_paper'
  | 'preview_side2'
  | 'plotting_side2'
  | 'confirm_side2'
  | 'insert_envelope'
  | 'preview_envelope'
  | 'plotting_envelope'
  | 'confirm_envelope'
  | 'completed';

// Canvas
export type CanvasSide = 'front' | 'back' | 'envelope';

// Gallery
export interface GalleryImage {
  id: string;                    // UUID
  blob: Blob;                    // Full image as PNG blob
  thumbnailDataUrl: string;      // Base64 thumbnail (150x150)
  source: 'gemini' | 'upload' | 'processed';
  createdAt: number;             // Unix timestamp
  metadata: {
    prompt?: string;
    style?: string;
    originalFilename?: string;
    width: number;
    height: number;
  };
}
