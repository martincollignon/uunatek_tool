/**
 * Client-side Gemini AI integration
 * Works in both web browser and Tauri desktop app
 */

import { GoogleGenAI } from '@google/genai';

export interface GeminiStatusResponse {
  configured: boolean;
  message: string;
}

export interface GeminiGenerateResponse {
  image_base64: string;
  prompt_used: string;
}

/**
 * Check if Gemini API is configured
 */
export async function checkGeminiStatus(): Promise<GeminiStatusResponse> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      configured: false,
      message: 'Gemini API key not configured. Please set your API key in settings.',
    };
  }

  return {
    configured: true,
    message: 'Gemini API is configured',
  };
}

/**
 * Generate image from text prompt using Nano Banana (Gemini 2.5 Flash Image)
 */
export async function generateImage(
  prompt: string,
  style?: string,
  _width: number = 512,
  _height: number = 512
): Promise<GeminiGenerateResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Enhance prompt for pen plotter output
  const enhancedPrompt = enhancePromptForPlotter(prompt, style);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: enhancedPrompt,
      config: {
        generationConfig: {
          imageConfig: {
            imageSize: '2K',
          },
        },
      } as any,
    });

    // Get the generated image from the response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No image generated');
    }

    // Extract image data from the first candidate
    const candidate = candidates[0];
    const content = candidate.content;
    if (!content) {
      throw new Error('No content in candidate');
    }
    const parts = content.parts;
    if (!parts) {
      throw new Error('No parts in content');
    }

    // Find the inline data part with the image
    const imagePart = parts.find((part: any) => part.inlineData);
    if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
      throw new Error('No image data in response');
    }

    // Return base64 image data
    return {
      image_base64: imagePart.inlineData.data,
      prompt_used: enhancedPrompt,
    };
  } catch (error) {
    console.error('Failed to generate image:', error);
    throw error;
  }
}

/**
 * Process image for plotter (convert to line art) using Nano Banana
 */
export async function processImageForPlotter(
  imageBase64: string,
  style?: string,
  customPrompt?: string
): Promise<GeminiGenerateResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Create prompt for image conversion
  const stylePrompt = customPrompt || getStylePrompt(style);
  const fullPrompt = `Convert this image to a pen plotter drawing. ${stylePrompt}

IMPORTANT: Generate a NEW image with these specifications:
- ONLY black lines on a COMPLETELY WHITE background
- Vector-style line drawing, NOT a raster image
- No gradients, no fills, no solid black areas
- All shading must use line techniques (hatching, cross-hatching, stippling)
- Clear, continuous lines that a physical pen can draw
- Preserve the main subject and key features
- Suitable for a pen plotter machine to physically draw`;

  try {
    // Convert base64 to proper format
    const imageData = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    // Detect MIME type from base64 data
    let mimeType = 'image/png';
    if (imageBase64.startsWith('data:image/jpeg') || imageBase64.startsWith('data:image/jpg')) {
      mimeType = 'image/jpeg';
    } else if (imageBase64.startsWith('data:image/webp')) {
      mimeType = 'image/webp';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [
        {
          inlineData: {
            data: imageData,
            mimeType: mimeType,
          },
        },
        fullPrompt,
      ],
      config: {
        generationConfig: {
          imageConfig: {
            imageSize: '2K',
          },
        },
      } as any,
    });

    // Get the generated image from the response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No image generated from processing');
    }

    // Extract image data from the first candidate
    const candidate = candidates[0];
    const content = candidate.content;
    if (!content) {
      throw new Error('No content in candidate');
    }
    const parts = content.parts;
    if (!parts) {
      throw new Error('No parts in content');
    }

    // Find the inline data part with the image
    const imagePart = parts.find((part: any) => part.inlineData);
    if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
      throw new Error('No processed image data in response');
    }

    // Return base64 image data
    return {
      image_base64: imagePart.inlineData.data,
      prompt_used: fullPrompt,
    };
  } catch (error) {
    console.error('Failed to process image:', error);
    throw error;
  }
}

/**
 * Get API key from various sources
 * Priority: Environment variable > Tauri (desktop) > localStorage (user-provided)
 */
function getApiKey(): string | null {
  // 1. Check environment variable (web build-time or dev)
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey && envKey !== 'your_api_key_here') return envKey;

  // 2. Check if running in Tauri (desktop app)
  // The Tauri command will handle bundled keys
  // This is checked via the Tauri commands when needed

  // 3. Fall back to localStorage (user-provided key in UI)
  const storedKey = localStorage.getItem('gemini_api_key');
  if (storedKey) return storedKey;

  return null;
}

/**
 * Set API key in localStorage
 */
export function setGeminiApiKey(apiKey: string): void {
  localStorage.setItem('gemini_api_key', apiKey);
}

/**
 * Clear API key from localStorage
 */
export function clearGeminiApiKey(): void {
  localStorage.removeItem('gemini_api_key');
}

/**
 * Enhance prompt for pen plotter output
 */
function enhancePromptForPlotter(prompt: string, style?: string): string {
  const styleInstructions = getStylePrompt(style);

  return `${prompt}. ${styleInstructions}

IMPORTANT: This image will be used by a physical pen plotter machine.
- Use ONLY black line outlines on a COMPLETELY WHITE background
- Create vector-style line drawings, NOT raster images or photographs
- No gradients, no shading with fills, no solid black areas
- All shading must be done with line techniques (hatching, cross-hatching, stippling)
- Make lines clear, distinct, and continuous so a pen can physically draw them
- Think of it as a drawing made by a single pen on white paper
- Use moderate detail that preserves recognizability while being plotter-friendly`;
}

/**
 * Get style-specific prompt instructions
 */
function getStylePrompt(style?: string): string {
  const styleInstructions: Record<string, string> = {
    // Classic styles
    line_art: 'Create as clean line art with bold outlines, suitable for pen plotting.',
    sketch: 'Create as a sketch with varied line weights, suitable for pen plotting.',
    minimal: 'Create as minimal line drawing with simple shapes, suitable for pen plotting.',
    detailed: 'Create as detailed line illustration with cross-hatching for shading, suitable for pen plotting.',
    // Advanced styles
    continuous: 'Create as a CONTINUOUS SINGLE-LINE drawing where the pen NEVER lifts from the paper. The entire image must be ONE unbroken line that weaves and loops to form all shapes and shading. Like a TSP (traveling salesman) art piece - one continuous path that traces the entire drawing.',
    geometric: 'Recreate the image using ONLY geometric shapes - triangles, circles, squares, hexagons, and polygons. Create a low-poly or mosaic effect where the subject is built entirely from flat geometric primitives with clean edges.',
    spiral: 'Create as a SINGLE SPIRAL drawing starting from the center and spiraling outward. Vary the line thickness or waviness to represent light and dark areas. The result should look like a vinyl record or fingerprint pattern that reveals the image.',
    stippling: 'Create using ONLY DOTS (stippling/pointillism technique). No continuous lines - represent all shading and form through varying density of small dots. Darker areas have more densely packed dots, lighter areas have sparse dots.',
    hatching: 'Create using ONLY PARALLEL HATCHING LINES like an engraving or etching. Use different line angles and densities to create form and shading. Think of classic currency engraving or woodcut print style.',
    contour: 'Create as TOPOGRAPHIC CONTOUR LINES, like an elevation map. Draw concentric lines that follow the "elevation" of brightness in the image. Results should look like terrain contour maps or fingerprints.',
    ascii: 'Create as ASCII TEXT ART where the image is represented by text characters arranged in a grid. Use denser characters (@ # M W) for dark areas and lighter characters (. : -) for light areas. The result should be readable as monospace text art.',
    cubist: 'Create in CUBIST style like Picasso - fragment the subject into geometric angular planes, show multiple perspectives simultaneously, use bold intersecting lines. Abstract but recognizable, with fragmented overlapping forms.',
    wireframe: 'Create as a 3D WIREFRAME model - imagine the subject as a mesh of connected vertices. Draw grid-like lines over the 3D form surface, like retro computer graphics or CAD model visualization.',
    circuit: 'Create as a CIRCUIT BOARD design - use only straight lines with 90-degree angles, add connection points as small circles at intersections. Make it look like an electronic PCB schematic that forms the image.',
  };

  return styleInstructions[style || 'line_art'] || styleInstructions.line_art;
}
