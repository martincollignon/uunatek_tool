/**
 * Interactive map preview using Leaflet
 * Allows user to pan/zoom and select an area for map generation
 */

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  center: [number, number]; // [lat, lon]
  zoom: number;
  onBoundsChange: (bounds: {
    south: number;
    north: number;
    west: number;
    east: number;
  }) => void;
}

/**
 * Component to track and display map bounds
 */
function BoundsTracker({ onBoundsChange }: { onBoundsChange: Props['onBoundsChange'] }) {
  const map = useMap();

  useEffect(() => {
    const updateBounds = () => {
      const bounds = map.getBounds();
      onBoundsChange({
        south: bounds.getSouth(),
        north: bounds.getNorth(),
        west: bounds.getWest(),
        east: bounds.getEast(),
      });
    };

    // Initial bounds
    updateBounds();

    // Update on move
    map.on('moveend', updateBounds);
    map.on('zoomend', updateBounds);

    return () => {
      map.off('moveend', updateBounds);
      map.off('zoomend', updateBounds);
    };
  }, [map, onBoundsChange]);

  return null;
}

export function MapPreview({ center, zoom, onBoundsChange }: Props) {
  const mapRef = useRef<L.Map | null>(null);

  return (
    <div style={{ height: '300px', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BoundsTracker onBoundsChange={onBoundsChange} />
      </MapContainer>
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-xs)',
          pointerEvents: 'none',
          zIndex: 1000,
        }}
      >
        Pan and zoom to select area
      </div>
    </div>
  );
}
