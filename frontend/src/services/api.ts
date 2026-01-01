import axios from 'axios';
import type { Project, ProjectCreate, PlotterStatus, PlotProgress, SerialPort } from '../types';
import type { PlotterError, RecoveryAction, ErrorCategory } from '../types/errors';

// Extend Window interface to include electron API
declare global {
  interface Window {
    electron?: {
      getBackendPort: () => Promise<number>;
    };
  }
}

// In development with Vite dev server, use proxy. In Electron or production, connect directly to backend.
const isDevelopment = import.meta.env.DEV;
const isViteDevServer = isDevelopment && window.location.port === '5173';

// Get backend URL - will be updated dynamically in Electron
let backendBaseURL = isViteDevServer ? '/api' : 'http://localhost:8000/api';

const api = axios.create({
  baseURL: backendBaseURL,
});

// Promise to track backend initialization
let backendInitialized: Promise<void> = Promise.resolve();

// If running in Electron, get the actual backend port
if (window.electron?.getBackendPort) {
  backendInitialized = window.electron.getBackendPort().then((port) => {
    const newBaseURL = `http://localhost:${port}/api`;
    console.log(`Using dynamic backend URL: ${newBaseURL}`);
    api.defaults.baseURL = newBaseURL;
    backendBaseURL = newBaseURL;
  }).catch((err) => {
    console.error('Failed to get backend port from Electron:', err);
  });
}

// Add request interceptor to wait for backend initialization
api.interceptors.request.use(async (config) => {
  await backendInitialized;
  return config;
});

// Projects
export const projectsApi = {
  list: () => api.get<Project[]>('/projects').then((r) => r.data),
  get: (id: string) => api.get<Project>(`/projects/${id}`).then((r) => r.data),
  create: (data: ProjectCreate) => api.post<Project>('/projects', data).then((r) => r.data),
  update: (id: string, data: Partial<Project>) => api.put<Project>(`/projects/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

// Canvas
export const canvasApi = {
  get: (projectId: string, side: string = 'front') =>
    api.get(`/canvas/${projectId}`, { params: { side } }).then((r) => r.data),
  save: (projectId: string, canvasJson: Record<string, unknown>, side: string = 'front') =>
    api.put(`/canvas/${projectId}`, { canvas_json: canvasJson, side }),
  uploadImage: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/canvas/${projectId}/upload`, formData).then((r) => r.data);
  },
  exportSvg: (projectId: string, side: string = 'front') =>
    api.get<{ svg: string; warnings: string[] }>(`/canvas/${projectId}/export/svg`, { params: { side } }).then((r) => r.data),
};

// Plotter
export const plotterApi = {
  listPorts: () => api.get<{ ports: SerialPort[] }>('/plotter/ports').then((r) => r.data.ports),
  getStatus: () => api.get<PlotterStatus>('/plotter/status').then((r) => r.data),
  connect: (port?: string) => api.post('/plotter/connect', null, { params: { port } }),
  disconnect: () => api.post('/plotter/disconnect'),
  home: () => api.post('/plotter/home'),
  penUp: () => api.post('/plotter/pen/up'),
  penDown: () => api.post('/plotter/pen/down'),
  enableMotors: () => api.post('/plotter/motors/enable'),
  disableMotors: () => api.post('/plotter/motors/disable'),
  startPlot: (projectId: string, side: string) =>
    api.post('/plotter/plot/start', { project_id: projectId, side }),
  pausePlot: () => api.post('/plotter/plot/pause'),
  resumePlot: () => api.post('/plotter/plot/resume'),
  cancelPlot: () => api.post('/plotter/plot/cancel'),
  getPlotStatus: () => api.get<PlotProgress>('/plotter/plot/status').then((r) => r.data),
  // Calibration
  moveToTestPosition: (x_mm?: number, y_mm?: number) =>
    api.post('/plotter/calibration/move-to-test-position', { x_mm, y_mm }),
  drawTestPattern: (size_mm?: number) =>
    api.post('/plotter/calibration/draw-test-pattern', { size_mm }),
  // Error handling
  getErrorDetails: (errorCode: string) =>
    api.get<PlotterError>(`/plotter/errors/${errorCode}`).then((r) => r.data),
  getErrorsByCategory: (category: ErrorCategory) =>
    api.get<{ errors: PlotterError[] }>(`/plotter/errors/by-category/${category}`).then((r) => r.data.errors),
  getUserReportableErrors: () =>
    api.get<{ errors: PlotterError[] }>('/plotter/errors/user-reportable').then((r) => r.data.errors),
  reportProblem: (errorCode: string, context?: Record<string, unknown>) =>
    api.post<{ status: string; error: PlotterError }>('/plotter/report-problem', {
      error_code: errorCode,
      context,
    }).then((r) => r.data),
  executeRecoveryAction: (action: RecoveryAction) =>
    api.post(`/plotter/recovery/${action}`),
};

// Gemini
export const geminiApi = {
  checkStatus: () => api.get<{ configured: boolean; message: string }>('/gemini/status').then((r) => r.data),
  generate: (prompt: string, style?: string) =>
    api.post<{ image_base64: string; prompt_used: string }>('/gemini/generate', {
      prompt,
      style,
      width: 512,
      height: 512,
    }).then((r) => r.data),
  edit: (imageBase64: string, prompt: string) =>
    api.post<{ image_base64: string; prompt_used: string }>('/gemini/edit', {
      image_base64: imageBase64,
      prompt,
    }).then((r) => r.data),
  processImage: (
    imageBase64: string,
    style?: string,
    customPrompt?: string,
    removeBackground?: boolean,
    threshold?: number,
    padding?: number
  ) =>
    api.post<{ image_base64: string; prompt_used: string }>('/gemini/process-image', {
      image_base64: imageBase64,
      style: style || 'line_art',
      custom_prompt: customPrompt,
      remove_background: removeBackground ?? false,
      threshold: threshold ?? 250,
      padding: padding ?? 10,
    }).then((r) => r.data),
};

// QR Code
export const qrcodeApi = {
  generate: (
    content: string,
    errorCorrection: 'L' | 'M' | 'Q' | 'H' = 'H',
    sizeMm: number = 40
  ) =>
    api
      .post<{ svg: string; width_mm: number; height_mm: number }>('/qrcode/generate', {
        content,
        error_correction: errorCorrection,
        size_mm: sizeMm,
      })
      .then((r) => r.data),
};

export default api;
