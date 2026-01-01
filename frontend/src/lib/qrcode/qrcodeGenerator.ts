/**
 * Client-side QR code generation
 * Replaces the backend QR code API
 */

import QRCode from 'qrcode';

export interface QRCodeResult {
  svg: string;
  width_mm: number;
  height_mm: number;
}

/**
 * Generate a QR code as SVG
 */
export async function generateQRCode(
  content: string,
  errorCorrection: 'L' | 'M' | 'Q' | 'H' = 'H',
  sizeMm: number = 40
): Promise<QRCodeResult> {
  try {
    // Generate QR code as SVG string
    const svg = await QRCode.toString(content, {
      type: 'svg',
      errorCorrectionLevel: errorCorrection,
      margin: 1,
      width: sizeMm * 3.7795, // Convert mm to pixels (1mm ≈ 3.7795px at 96 DPI)
    });

    // QR codes are square
    return {
      svg,
      width_mm: sizeMm,
      height_mm: sizeMm,
    };
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}
