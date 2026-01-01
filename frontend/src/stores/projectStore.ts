import { create } from 'zustand';
import type { Project, ProjectCreate } from '../types';
import * as projectDB from '../services/projectDB';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadProjects: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  createProject: (data: ProjectCreate) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await projectDB.getAllProjects();
      set({ projects, isLoading: false });
    } catch (err) {
      console.error('Failed to load projects:', err);
      set({ error: 'Failed to load projects', isLoading: false });
    }
  },

  loadProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const project = await projectDB.getProject(id);
      if (!project) {
        set({ error: 'Project not found', isLoading: false });
        throw new Error('Project not found');
      }
      set({ currentProject: project, isLoading: false });
    } catch (err: any) {
      const errorMessage = err?.message === 'Project not found'
        ? 'Project not found'
        : 'Failed to load project';
      console.error('Failed to load project:', err);
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  createProject: async (data: ProjectCreate) => {
    set({ isLoading: true, error: null });
    try {
      const project = await projectDB.createProject(data);
      set((state) => ({
        projects: [project, ...state.projects],
        currentProject: project,
        isLoading: false,
      }));
      return project;
    } catch (err) {
      console.error('Failed to create project:', err);
      set({ error: 'Failed to create project', isLoading: false });
      throw err;
    }
  },

  updateProject: async (id: string, data: Partial<Project>) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await projectDB.updateProject(id, data);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? updated : p)),
        currentProject: state.currentProject?.id === id ? updated : state.currentProject,
        isLoading: false,
      }));
    } catch (err) {
      console.error('Failed to update project:', err);
      set({ error: 'Failed to update project', isLoading: false });
    }
  },

  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await projectDB.deleteProject(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        isLoading: false,
      }));
    } catch (err) {
      console.error('Failed to delete project:', err);
      set({ error: 'Failed to delete project', isLoading: false });
    }
  },

  setCurrentProject: (project) => set({ currentProject: project }),
  clearError: () => set({ error: null }),
}));
