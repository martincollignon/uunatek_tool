/**
 * Coordinate transformation utilities
 * Converts lat/lon coordinates to paper millimeters for plotting
 */

import type { BoundingBox } from './osmClient';

export interface Point {
  x: number;
  y: number;
}

export interface PaperSize {
  widthMm: number;
  heightMm: number;
}

/**
 * Convert latitude/longitude to Web Mercator projection (normalized 0-1)
 */
function latLonToMercator(lat: number, lon: number): Point {
  const x = (lon + 180) / 360;
  const latRad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
  return { x, y };
}

/**
 * Calculate mercator bounds for a bounding box
 */
function calculateMercatorBounds(bbox: BoundingBox): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const sw = latLonToMercator(bbox.south, bbox.west);
  const ne = latLonToMercator(bbox.north, bbox.east);

  return {
    minX: sw.x,
    maxX: ne.x,
    minY: ne.y, // Note: Y is flipped in mercator
    maxY: sw.y,
  };
}

/**
 * Convert lat/lon to paper coordinates (mm) with proper scaling
 */
export function latLonToMm(
  lat: number,
  lon: number,
  bbox: BoundingBox,
  paperSize: PaperSize
): Point {
  // Convert to mercator
  const mercator = latLonToMercator(lat, lon);
  const bounds = calculateMercatorBounds(bbox);

  // Calculate position within bounds (0-1)
  const normalizedX = (mercator.x - bounds.minX) / (bounds.maxX - bounds.minX);
  const normalizedY = (mercator.y - bounds.minY) / (bounds.maxY - bounds.minY);

  // Scale to paper dimensions
  const paperX = normalizedX * paperSize.widthMm;
  const paperY = normalizedY * paperSize.heightMm;

  return { x: paperX, y: paperY };
}

/**
 * Calculate optimal paper size to maintain aspect ratio of the bounding box
 */
export function calculateOptimalPaperSize(
  bbox: BoundingBox,
  maxWidthMm: number,
  maxHeightMm: number
): PaperSize {
  const bounds = calculateMercatorBounds(bbox);
  const aspectRatio = (bounds.maxX - bounds.minX) / (bounds.maxY - bounds.minY);

  let widthMm = maxWidthMm;
  let heightMm = maxHeightMm;

  if (aspectRatio > maxWidthMm / maxHeightMm) {
    // Wider than tall
    heightMm = maxWidthMm / aspectRatio;
  } else {
    // Taller than wide
    widthMm = maxHeightMm * aspectRatio;
  }

  return { widthMm, heightMm };
}

/**
 * Douglas-Peucker line simplification algorithm
 * Reduces the number of points in a polyline while preserving shape
 */
export function simplifyPolyline(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from line segment
  let maxDistance = 0;
  let maxIndex = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = simplifyPolyline(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPolyline(points.slice(maxIndex), tolerance);

    // Concat arrays, removing duplicate point
    return [...left.slice(0, -1), ...right];
  } else {
    // If all points are within tolerance, return just start and end
    return [start, end];
  }
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    // Line segment is a point
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
    );
  }

  // Calculate the t parameter for the closest point on the line
  const t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);

  let closestX: number, closestY: number;

  if (t < 0) {
    // Closest point is lineStart
    closestX = lineStart.x;
    closestY = lineStart.y;
  } else if (t > 1) {
    // Closest point is lineEnd
    closestX = lineEnd.x;
    closestY = lineEnd.y;
  } else {
    // Closest point is on the line segment
    closestX = lineStart.x + t * dx;
    closestY = lineStart.y + t * dy;
  }

  return Math.sqrt(Math.pow(point.x - closestX, 2) + Math.pow(point.y - closestY, 2));
}
