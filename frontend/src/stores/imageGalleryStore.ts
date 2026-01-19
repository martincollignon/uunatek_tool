import { create } from 'zustand';
import type { GalleryImage } from '../types';
import * as imageGalleryDB from '../services/imageGalleryDB';

// Helper function to generate a UUID
function generateId(): string {
  return crypto.randomUUID();
}

// Helper function to convert data URL to Blob
function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// Helper function to generate a 150x150 thumbnail from an image
async function generateThumbnail(
  imageDataUrl: string,
  size: number = 150
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Calculate dimensions to maintain aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > size) {
          height = (height * size) / width;
          width = size;
        }
      } else {
        if (height > size) {
          width = (width * size) / height;
          height = size;
        }
      }

      canvas.width = size;
      canvas.height = size;

      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      // Center the image
      const x = (size - width) / 2;
      const y = (size - height) / 2;

      ctx.drawImage(img, x, y, width, height);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageDataUrl;
  });
}

// Helper function to get image dimensions
async function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = dataUrl;
  });
}

interface ImageGalleryState {
  images: GalleryImage[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  addImage: (
    imageDataUrl: string,
    source: 'gemini' | 'upload' | 'processed',
    metadata?: {
      prompt?: string;
      style?: string;
      originalFilename?: string;
    }
  ) => Promise<GalleryImage>;
  removeImage: (id: string) => Promise<void>;
  getImageBlob: (id: string) => Promise<Blob | null>;
  clearError: () => void;
}

export const useImageGalleryStore = create<ImageGalleryState>((set, get) => ({
  images: [],
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    if (get().isInitialized) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const images = await imageGalleryDB.getAllImages();
      set({ images, isInitialized: true, isLoading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to initialize gallery';
      set({ error: errorMessage, isLoading: false });
      console.error('Failed to initialize image gallery:', error);
    }
  },

  addImage: async (imageDataUrl, source, metadata = {}) => {
    set({ isLoading: true, error: null });

    try {
      // Get image dimensions
      const { width, height } = await getImageDimensions(imageDataUrl);

      // Generate thumbnail
      const thumbnailDataUrl = await generateThumbnail(imageDataUrl);

      // Convert data URL to blob
      const blob = dataURLtoBlob(imageDataUrl);

      // Create the gallery image object
      const galleryImage: GalleryImage = {
        id: generateId(),
        blob,
        thumbnailDataUrl,
        source,
        createdAt: Date.now(),
        metadata: {
          ...metadata,
          width,
          height,
        },
      };

      // Save to IndexedDB
      await imageGalleryDB.saveImage(galleryImage);

      // Update in-memory cache
      set((state) => ({
        images: [galleryImage, ...state.images],
        isLoading: false,
      }));

      return galleryImage;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to add image';
      set({ error: errorMessage, isLoading: false });
      console.error('Failed to add image to gallery:', error);
      throw error;
    }
  },

  removeImage: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      // Remove from IndexedDB
      await imageGalleryDB.deleteImage(id);

      // Update in-memory cache
      set((state) => ({
        images: state.images.filter((img) => img.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to remove image';
      set({ error: errorMessage, isLoading: false });
      console.error('Failed to remove image from gallery:', error);
      throw error;
    }
  },

  getImageBlob: async (id: string) => {
    try {
      // First check in-memory cache
      const cachedImage = get().images.find((img) => img.id === id);
      if (cachedImage) {
        return cachedImage.blob;
      }

      // If not in cache, fetch from IndexedDB
      const image = await imageGalleryDB.getImage(id);
      return image?.blob || null;
    } catch (error) {
      console.error('Failed to get image blob:', error);
      return null;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
