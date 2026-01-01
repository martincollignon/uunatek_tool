/**
 * Map style presets for OSM rendering
 */

export interface MapStyle {
  id: string;
  name: string;
  description: string;
  icon: string;
  layers: {
    roads: boolean;
    buildings: boolean;
    water: boolean;
    parks: boolean;
    railways: boolean;
  };
  roadWidth: number; // Base stroke width in mm
  buildingStyle: 'outline' | 'crosshatch' | 'none';
  waterStyle: 'outline' | 'waves' | 'none';
  simplification: number; // Douglas-Peucker tolerance
}

export const MAP_STYLE_PRESETS: MapStyle[] = [
  {
    id: 'roads_only',
    name: 'Roads Only',
    description: 'Clean street network',
    icon: '🛣️',
    layers: {
      roads: true,
      buildings: false,
      water: false,
      parks: false,
      railways: false,
    },
    roadWidth: 0.5,
    buildingStyle: 'none',
    waterStyle: 'none',
    simplification: 0.0001,
  },
  {
    id: 'full_city',
    name: 'Full City',
    description: 'Roads, buildings, water',
    icon: '🏙️',
    layers: {
      roads: true,
      buildings: true,
      water: true,
      parks: true,
      railways: true,
    },
    roadWidth: 0.3,
    buildingStyle: 'outline',
    waterStyle: 'waves',
    simplification: 0.00005,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Major roads only',
    icon: '◯',
    layers: {
      roads: true,
      buildings: false,
      water: true,
      parks: false,
      railways: false,
    },
    roadWidth: 0.4,
    buildingStyle: 'none',
    waterStyle: 'outline',
    simplification: 0.0002,
  },
  {
    id: 'artistic',
    name: 'Artistic',
    description: 'Detailed with hatching',
    icon: '🎨',
    layers: {
      roads: true,
      buildings: true,
      water: true,
      parks: true,
      railways: true,
    },
    roadWidth: 0.25,
    buildingStyle: 'crosshatch',
    waterStyle: 'waves',
    simplification: 0.00002,
  },
];

export const HIGHWAY_WIDTHS: Record<string, number> = {
  motorway: 1.2,
  trunk: 1.0,
  primary: 0.8,
  secondary: 0.6,
  tertiary: 0.5,
  residential: 0.4,
  service: 0.3,
  footway: 0.2,
  path: 0.2,
  cycleway: 0.2,
  default: 0.4,
};
