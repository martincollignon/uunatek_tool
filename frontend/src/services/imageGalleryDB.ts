import { openDB, IDBPDatabase } from 'idb';
import type { GalleryImage } from '../types';

const DB_NAME = 'zagreb-image-gallery';
const DB_VERSION = 1;
const STORE_NAME = 'images';

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
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

        // Create index for sorting by date
        store.createIndex('by-date', 'createdAt', { unique: false });
      }
    },
  });

  return dbInstance;
}

/**
 * Save an image to the database
 */
export async function saveImage(image: GalleryImage): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, image);
}

/**
 * Get a single image by ID
 */
export async function getImage(id: string): Promise<GalleryImage | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

/**
 * Delete an image by ID
 */
export async function deleteImage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/**
 * Get all images, sorted by creation date (newest first)
 */
export async function getAllImages(): Promise<GalleryImage[]> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const index = tx.store.index('by-date');

  // Get all images sorted by date descending
  const images = await index.getAll();

  // Sort in descending order (newest first)
  images.sort((a, b) => b.createdAt - a.createdAt);

  return images;
}
