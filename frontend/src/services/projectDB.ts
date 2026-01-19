import { openDB, IDBPDatabase } from 'idb';
import type { Project, ProjectCreate } from '../types';
import { PAPER_DIMENSIONS } from '../types';

const DB_NAME = 'zagreb-projects';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const CANVAS_STORE_NAME = 'canvas';

let dbInstance: IDBPDatabase | null = null;

/**
 * Initialize and return the IndexedDB database instance
 */
export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create projects store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by-date', 'created_at', { unique: false });
      }

      // Create canvas store for storing canvas JSON per project
      if (!db.objectStoreNames.contains(CANVAS_STORE_NAME)) {
        db.createObjectStore(CANVAS_STORE_NAME, { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

/**
 * Generate a unique ID for a project
 */
function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new project
 */
export async function createProject(data: ProjectCreate): Promise<Project> {
  const db = await getDB();

  // Calculate width and height from paper size
  let width_mm: number;
  let height_mm: number;

  if (data.paper_size === 'custom') {
    width_mm = data.custom_width_mm || 210;
    height_mm = data.custom_height_mm || 297;
  } else {
    const dimensions = PAPER_DIMENSIONS[data.paper_size];
    width_mm = dimensions.width;
    height_mm = dimensions.height;
  }

  const project: Project = {
    id: generateId(),
    name: data.name,
    paper_size: data.paper_size,
    width_mm,
    height_mm,
    custom_width_mm: data.custom_width_mm,
    custom_height_mm: data.custom_height_mm,
    is_double_sided: data.is_double_sided || false,
    include_envelope: data.include_envelope || false,
    envelope_address: data.envelope_address,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await db.put(STORE_NAME, project);
  return project;
}

/**
 * Get all projects
 */
export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const index = tx.store.index('by-date');

  const projects = await index.getAll();

  // Sort in descending order (newest first)
  projects.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return projects;
}

/**
 * Get a single project by ID
 */
export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

/**
 * Update a project
 */
export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  const db = await getDB();
  const existing = await db.get(STORE_NAME, id);

  if (!existing) {
    throw new Error('Project not found');
  }

  const updated: Project = {
    ...existing,
    ...data,
    id, // Ensure ID doesn't change
    updated_at: new Date().toISOString(),
  };

  await db.put(STORE_NAME, updated);
  return updated;
}

/**
 * Delete a project and its associated canvas data
 */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();

  // Delete project from projects store
  await db.delete(STORE_NAME, id);

  // Delete associated canvas data
  await db.delete(CANVAS_STORE_NAME, `${id}_front`);
  await db.delete(CANVAS_STORE_NAME, `${id}_back`);
}

/**
 * Save canvas JSON for a project side
 */
export async function saveCanvas(
  projectId: string,
  canvasJson: Record<string, unknown>,
  side: 'front' | 'back' = 'front'
): Promise<void> {
  const db = await getDB();
  const id = `${projectId}_${side}`;

  await db.put(CANVAS_STORE_NAME, {
    id,
    projectId,
    side,
    canvas_json: canvasJson,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Get canvas JSON for a project side
 */
export async function getCanvas(
  projectId: string,
  side: 'front' | 'back' = 'front'
): Promise<Record<string, unknown> | null> {
  const db = await getDB();
  const id = `${projectId}_${side}`;
  const data = await db.get(CANVAS_STORE_NAME, id);

  return data?.canvas_json || null;
}
