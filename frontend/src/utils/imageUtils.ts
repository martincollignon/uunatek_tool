/**
 * Image utilities for format detection and validation
 */

/**
 * Detect image format from file signature (magic bytes)
 */
export const detectImageFormat = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const arr = new Uint8Array(e.target?.result as ArrayBuffer);

      // SVG signature: Check for XML/SVG tags (check first 200 bytes)
      try {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(arr).toLowerCase();
        if (text.includes('<svg') || (text.includes('<?xml') && text.includes('<svg'))) {
          resolve('SVG');
          return;
        }
      } catch (e) {
        // Not text, continue with binary checks
      }

      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      if (
        arr[0] === 0x89 &&
        arr[1] === 0x50 &&
        arr[2] === 0x4e &&
        arr[3] === 0x47 &&
        arr[4] === 0x0d &&
        arr[5] === 0x0a &&
        arr[6] === 0x1a &&
        arr[7] === 0x0a
      ) {
        resolve('PNG');
        return;
      }

      // JPEG signature: FF D8
      if (arr[0] === 0xff && arr[1] === 0xd8) {
        resolve('JPEG');
        return;
      }

      // GIF signature: 47 49 46
      if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46) {
        resolve('GIF');
        return;
      }

      // WebP signature: RIFF....WEBP
      if (
        arr[0] === 0x52 &&
        arr[1] === 0x49 &&
        arr[2] === 0x46 &&
        arr[3] === 0x46 &&
        arr[8] === 0x57 &&
        arr[9] === 0x45 &&
        arr[10] === 0x42 &&
        arr[11] === 0x50
      ) {
        resolve('WEBP');
        return;
      }

      // HEIC/HEIF signature: ftyp at offset 4
      if (arr[4] === 0x66 && arr[5] === 0x74 && arr[6] === 0x79 && arr[7] === 0x70) {
        const brand = String.fromCharCode(arr[8], arr[9], arr[10], arr[11]);
        if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
          resolve('HEIC');
          return;
        }
      }

      // Fallback to file extension
      const ext = file.name.split('.').pop()?.toUpperCase();
      resolve(ext || 'UNKNOWN');
    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    // Read first 200 bytes for format detection (increased for SVG detection)
    reader.readAsArrayBuffer(file.slice(0, 200));
  });
};

/**
 * Check if image format is supported by canvas (browser)
 */
export const isCanvasCompatible = (format: string): boolean => {
  const compatible = ['PNG', 'JPEG', 'JPG', 'WEBP', 'GIF', 'SVG'];
  return compatible.includes(format.toUpperCase());
};

/**
 * Check if image format needs conversion
 */
export const needsConversion = (format: string): boolean => {
  const formatUpper = format.toUpperCase();
  return formatUpper === 'HEIC' || formatUpper === 'HEIF' || formatUpper === 'SVG';
};

/**
 * Get user-friendly format message
 */
export const getFormatMessage = (format: string): string => {
  const formatUpper = format.toUpperCase();

  if (formatUpper === 'HEIC' || formatUpper === 'HEIF') {
    return 'HEIC format detected. This will be automatically converted to PNG for compatibility.';
  }

  if (formatUpper === 'SVG') {
    return 'SVG format detected. This will be automatically converted to PNG for canvas display.';
  }

  if (!isCanvasCompatible(format)) {
    return `${format} format detected. This will be converted to a compatible format.`;
  }

  return `${format} format - compatible`;
};

/**
 * Validate image file before processing
 */
export const validateImageFile = async (
  file: File
): Promise<{ valid: boolean; format: string; message: string }> => {
  try {
    const format = await detectImageFormat(file);

    if (format === 'UNKNOWN') {
      return {
        valid: false,
        format,
        message: 'Unknown image format. Please use PNG, JPEG, WebP, GIF, or HEIC.',
      };
    }

    const message = getFormatMessage(format);

    return {
      valid: true,
      format,
      message,
    };
  } catch (error) {
    return {
      valid: false,
      format: 'ERROR',
      message: `Failed to read file: ${error}`,
    };
  }
};

/**
 * Convert file to data URL (for immediate canvas display)
 * Note: For HEIC files, this may not work in all browsers
 */
export const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Check if browser supports a specific image format
 */
export const browserSupportsFormat = (format: string): boolean => {
  const formatUpper = format.toUpperCase();

  // Create a test canvas
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  // Try to export in the specified format
  try {
    const mimeType = `image/${formatUpper.toLowerCase()}`;
    const dataUrl = canvas.toDataURL(mimeType);
    return dataUrl.indexOf(mimeType) !== -1;
  } catch {
    return false;
  }
};
