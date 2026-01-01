/**
 * OSM data fetching via Overpass API and Nominatim geocoding
 */

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
}

export interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: Array<{ type: string; ref: number; role: string }>;
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  elements: OSMElement[];
}

/**
 * Search for a location using Nominatim geocoding API
 */
export async function searchLocation(query: string): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    addressdetails: '1',
  });

  const response = await fetch(`${NOMINATIM_API}?${params}`, {
    headers: {
      'User-Agent': 'Zagreb-Plotter-App/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch OSM data for a bounding box via Overpass API
 */
export async function fetchOSMData(
  bbox: BoundingBox,
  layers: {
    roads: boolean;
    buildings: boolean;
    water: boolean;
    parks: boolean;
    railways: boolean;
  }
): Promise<OverpassResponse> {
  const { south, west, north, east } = bbox;

  // Build query based on selected layers
  const queries: string[] = [];

  if (layers.roads) {
    queries.push('way["highway"];');
  }
  if (layers.buildings) {
    queries.push('way["building"];');
  }
  if (layers.water) {
    queries.push('way["waterway"];');
    queries.push('way["natural"="water"];');
  }
  if (layers.parks) {
    queries.push('way["leisure"="park"];');
    queries.push('way["landuse"="grass"];');
    queries.push('way["landuse"="forest"];');
  }
  if (layers.railways) {
    queries.push('way["railway"];');
  }

  if (queries.length === 0) {
    throw new Error('At least one layer must be selected');
  }

  const query = `
[out:json][bbox:${south},${west},${north},${east}][timeout:25];
(
  ${queries.join('\n  ')}
);
out body;
>;
out skel qt;
  `.trim();

  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Convert Nominatim bounding box to our BoundingBox format
 */
export function nominatimBBoxToBBox(bbox: [string, string, string, string]): BoundingBox {
  return {
    south: parseFloat(bbox[0]),
    north: parseFloat(bbox[1]),
    west: parseFloat(bbox[2]),
    east: parseFloat(bbox[3]),
  };
}

/**
 * Calculate bounding box from center point and radius (in kilometers)
 */
export function calculateBBox(lat: number, lon: number, radiusKm: number): BoundingBox {
  // Approximate degrees per kilometer at this latitude
  const latDegreesPerKm = 1 / 111.32;
  const lonDegreesPerKm = 1 / (111.32 * Math.cos((lat * Math.PI) / 180));

  const latDelta = (radiusKm / 2) * latDegreesPerKm;
  const lonDelta = (radiusKm / 2) * lonDegreesPerKm;

  return {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lon - lonDelta,
    east: lon + lonDelta,
  };
}
