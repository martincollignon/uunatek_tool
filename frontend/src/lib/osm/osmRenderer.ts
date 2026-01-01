/**
 * OSM data renderer - converts OSM elements to plotter-friendly SVG
 */

import type { BoundingBox, OverpassResponse } from './osmClient';
import type { MapStyle } from './mapStyles';
import { latLonToMm, simplifyPolyline, type Point, type PaperSize } from './mapProjection';
import { HIGHWAY_WIDTHS } from './mapStyles';

interface SVGPath {
  d: string; // SVG path data
  stroke: string;
  strokeWidth: number;
  fill?: string;
}

/**
 * Render OSM data to SVG paths
 */
export function renderOSMToSVG(
  data: OverpassResponse,
  bbox: BoundingBox,
  paperSize: PaperSize,
  style: MapStyle
): string {
  // Build lookup table for nodes
  const nodes = new Map<number, { lat: number; lon: number }>();
  for (const element of data.elements) {
    if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
      nodes.set(element.id, { lat: element.lat, lon: element.lon });
    }
  }

  // Convert ways to SVG paths
  const paths: SVGPath[] = [];

  for (const element of data.elements) {
    if (element.type !== 'way' || !element.nodes || !element.tags) continue;

    // Convert node IDs to coordinates
    const coords: Point[] = [];
    for (const nodeId of element.nodes) {
      const node = nodes.get(nodeId);
      if (node) {
        const point = latLonToMm(node.lat, node.lon, bbox, paperSize);
        coords.push(point);
      }
    }

    if (coords.length < 2) continue;

    // Simplify the polyline
    const simplified = simplifyPolyline(coords, style.simplification);

    // Determine feature type and render accordingly
    const tags = element.tags;

    if (tags.highway && style.layers.roads) {
      paths.push(...renderRoad(simplified, tags.highway, style));
    } else if (tags.building && style.layers.buildings) {
      paths.push(...renderBuilding(simplified, style));
    } else if ((tags.waterway || tags.natural === 'water') && style.layers.water) {
      paths.push(...renderWater(simplified, style));
    } else if ((tags.leisure === 'park' || tags.landuse === 'grass' || tags.landuse === 'forest') && style.layers.parks) {
      paths.push(...renderPark(simplified));
    } else if (tags.railway && style.layers.railways) {
      paths.push(...renderRailway(simplified));
    }
  }

  // Generate SVG
  return generateSVG(paths, paperSize);
}

/**
 * Render a road as a simple polyline
 */
function renderRoad(coords: Point[], highwayType: string, style: MapStyle): SVGPath[] {
  const widthMultiplier = HIGHWAY_WIDTHS[highwayType] || HIGHWAY_WIDTHS.default;
  const strokeWidth = style.roadWidth * widthMultiplier;

  const pathData = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ');

  return [
    {
      d: pathData,
      stroke: '#000000',
      strokeWidth,
    },
  ];
}

/**
 * Render a building
 */
function renderBuilding(coords: Point[], style: MapStyle): SVGPath[] {
  const paths: SVGPath[] = [];

  // Close the polygon if not already closed
  const isClosed = coords.length > 2 &&
    coords[0].x === coords[coords.length - 1].x &&
    coords[0].y === coords[coords.length - 1].y;

  const buildingCoords = isClosed ? coords : [...coords, coords[0]];

  switch (style.buildingStyle) {
    case 'outline': {
      const pathData = buildingCoords
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
        .join(' ') + ' Z';

      paths.push({
        d: pathData,
        stroke: '#000000',
        strokeWidth: 0.2,
      });
      break;
    }

    case 'crosshatch': {
      // Outline
      const pathData = buildingCoords
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
        .join(' ') + ' Z';

      paths.push({
        d: pathData,
        stroke: '#000000',
        strokeWidth: 0.2,
      });

      // Add crosshatch pattern
      paths.push(...generateCrosshatch(buildingCoords, 2));
      break;
    }

    case 'none':
    default:
      break;
  }

  return paths;
}

/**
 * Render water features
 */
function renderWater(coords: Point[], style: MapStyle): SVGPath[] {
  const paths: SVGPath[] = [];

  // Check if this is a closed polygon (area) or open polyline (river/stream)
  const isClosed = coords.length > 2 &&
    coords[0].x === coords[coords.length - 1].x &&
    coords[0].y === coords[coords.length - 1].y;

  if (isClosed && style.waterStyle === 'waves') {
    // Closed water body - render with wave pattern
    const waterCoords = coords;
    const pathData = waterCoords
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
      .join(' ') + ' Z';

    paths.push({
      d: pathData,
      stroke: '#000000',
      strokeWidth: 0.2,
    });

    // Add wave pattern lines
    paths.push(...generateWavePattern(waterCoords, 3));
  } else {
    // Open waterway or simple outline
    const pathData = coords
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
      .join(' ');

    paths.push({
      d: pathData,
      stroke: '#0066cc',
      strokeWidth: 0.3,
    });
  }

  return paths;
}

/**
 * Render parks
 */
function renderPark(coords: Point[]): SVGPath[] {
  // Simple outline for parks
  const isClosed = coords.length > 2 &&
    coords[0].x === coords[coords.length - 1].x &&
    coords[0].y === coords[coords.length - 1].y;

  const parkCoords = isClosed ? coords : [...coords, coords[0]];

  const pathData = parkCoords
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
    .join(' ') + ' Z';

  return [
    {
      d: pathData,
      stroke: '#00aa00',
      strokeWidth: 0.2,
    },
  ];
}

/**
 * Render railways
 */
function renderRailway(coords: Point[]): SVGPath[] {
  const pathData = coords
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
    .join(' ');

  return [
    {
      d: pathData,
      stroke: '#666666',
      strokeWidth: 0.4,
    },
  ];
}

/**
 * Generate crosshatch pattern for polygons
 */
function generateCrosshatch(coords: Point[], spacing: number): SVGPath[] {
  const paths: SVGPath[] = [];

  // Find bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of coords) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  // Generate horizontal lines
  for (let y = minY; y <= maxY; y += spacing) {
    const intersections = findLineIntersections(coords, minX, y, maxX, y);
    for (let i = 0; i < intersections.length; i += 2) {
      if (i + 1 < intersections.length) {
        paths.push({
          d: `M ${intersections[i].x.toFixed(3)} ${intersections[i].y.toFixed(3)} L ${intersections[i + 1].x.toFixed(3)} ${intersections[i + 1].y.toFixed(3)}`,
          stroke: '#000000',
          strokeWidth: 0.1,
        });
      }
    }
  }

  return paths;
}

/**
 * Generate wave pattern for water bodies
 */
function generateWavePattern(coords: Point[], spacing: number): SVGPath[] {
  const paths: SVGPath[] = [];

  // Find bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of coords) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  // Generate wavy horizontal lines
  for (let y = minY; y <= maxY; y += spacing) {
    const intersections = findLineIntersections(coords, minX, y, maxX, y);
    for (let i = 0; i < intersections.length; i += 2) {
      if (i + 1 < intersections.length) {
        paths.push({
          d: `M ${intersections[i].x.toFixed(3)} ${intersections[i].y.toFixed(3)} L ${intersections[i + 1].x.toFixed(3)} ${intersections[i + 1].y.toFixed(3)}`,
          stroke: '#0066cc',
          strokeWidth: 0.1,
        });
      }
    }
  }

  return paths;
}

/**
 * Find intersections of a horizontal line with a polygon
 */
function findLineIntersections(
  polygon: Point[],
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Point[] {
  const intersections: Point[] = [];

  for (let i = 0; i < polygon.length - 1; i++) {
    const p1 = polygon[i];
    const p2 = polygon[i + 1];

    const intersection = lineSegmentIntersection(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y);
    if (intersection) {
      intersections.push(intersection);
    }
  }

  // Sort by x coordinate
  return intersections.sort((a, b) => a.x - b.x);
}

/**
 * Calculate intersection point of two line segments
 */
function lineSegmentIntersection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): Point | null {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return null;

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: x1 + ua * (x2 - x1),
      y: y1 + ua * (y2 - y1),
    };
  }

  return null;
}

/**
 * Generate final SVG string
 */
function generateSVG(paths: SVGPath[], paperSize: PaperSize): string {
  const pathElements = paths
    .map(
      (p) =>
        `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill || 'none'}" stroke-linecap="round" stroke-linejoin="round" />`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${paperSize.widthMm}mm" height="${paperSize.heightMm}mm" viewBox="0 0 ${paperSize.widthMm} ${paperSize.heightMm}">
${pathElements}
</svg>`;
}
