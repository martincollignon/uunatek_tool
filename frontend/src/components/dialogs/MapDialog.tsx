/**
 * Map Dialog - Import OpenStreetMap data for plotting
 */

import { useState } from 'react';
import { X, MapPin, Loader2, Search } from 'lucide-react';
import { MapPreview } from './MapPreview';
import {
  searchLocation,
  fetchOSMData,
  type BoundingBox,
  type NominatimResult,
} from '../../lib/osm/osmClient';
import { renderOSMToSVG } from '../../lib/osm/osmRenderer';
import { calculateOptimalPaperSize } from '../../lib/osm/mapProjection';
import { MAP_STYLE_PRESETS, type MapStyle } from '../../lib/osm/mapStyles';

interface Props {
  onClose: () => void;
  onSvgGenerated: (svg: string, widthMm: number, heightMm: number) => void;
  maxWidthMm: number;
  maxHeightMm: number;
}

export function MapDialog({ onClose, onSvgGenerated, maxWidthMm, maxHeightMm }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lon: number;
    name: string;
  } | null>(null);

  const [mapCenter, setMapCenter] = useState<[number, number]>([51.505, -0.09]); // Default: London
  const [mapZoom, setMapZoom] = useState(13);
  const [currentBounds, setCurrentBounds] = useState<BoundingBox | null>(null);

  const [selectedStyle, setSelectedStyle] = useState<MapStyle>(MAP_STYLE_PRESETS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Search for locations
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const results = await searchLocation(searchQuery);
      setSearchResults(results);
      setShowResults(true);

      if (results.length > 0) {
        // Auto-select first result
        const first = results[0];
        handleSelectLocation(first);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to search location';
      setError(message);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle location selection
  const handleSelectLocation = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    setSelectedLocation({
      lat,
      lon,
      name: result.display_name,
    });

    setMapCenter([lat, lon]);
    setMapZoom(15);
    setShowResults(false);
  };

  // Handle map bounds change
  const handleBoundsChange = (bounds: BoundingBox) => {
    setCurrentBounds(bounds);
  };

  // Generate map SVG
  const handleGenerate = async () => {
    if (!currentBounds) {
      setError('Please wait for map to load');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Fetch OSM data
      const data = await fetchOSMData(currentBounds, selectedStyle.layers);

      // Calculate optimal paper size maintaining aspect ratio
      const paperSize = calculateOptimalPaperSize(currentBounds, maxWidthMm, maxHeightMm);

      // Render to SVG
      const svg = renderOSMToSVG(data, currentBounds, paperSize, selectedStyle);

      setPreviewSvg(svg);
      setDimensions({ width: paperSize.widthMm, height: paperSize.heightMm });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate map';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (previewSvg && dimensions) {
      onSvgGenerated(previewSvg, dimensions.width, dimensions.height);
      onClose();
    }
  };

  // Handle Enter key for search
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      handleSearch();
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog"
        style={{ maxWidth: 700, maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header flex justify-between items-center">
          <h2 className="dialog-title">
            <MapPin size={20} style={{ marginRight: 8, display: 'inline' }} />
            Import Map
          </h2>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="dialog-content">
          {/* Location Search */}
          <div className="form-group">
            <label className="form-label">Search Location</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="City, address, or landmark..."
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-secondary"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
              </button>
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-background)',
                  maxHeight: '200px',
                  overflow: 'auto',
                }}
              >
                {searchResults.map((result) => (
                  <button
                    key={result.place_id}
                    onClick={() => handleSelectLocation(result)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-sm)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-background-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            )}

            {selectedLocation && (
              <p
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  marginTop: 8,
                }}
              >
                📍 {selectedLocation.name}
              </p>
            )}
          </div>

          {/* Map Preview */}
          <div className="form-group">
            <label className="form-label">Select Area</label>
            <MapPreview
              center={mapCenter}
              zoom={mapZoom}
              onBoundsChange={handleBoundsChange}
            />
            <p
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
                marginTop: 8,
              }}
            >
              The visible map area will be plotted. Pan and zoom to adjust.
            </p>
          </div>

          {/* Style Presets */}
          <div className="form-group">
            <label className="form-label">Map Style</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
              }}
            >
              {MAP_STYLE_PRESETS.map((style) => (
                <button
                  key={style.id}
                  className={`btn ${selectedStyle.id === style.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedStyle(style)}
                  style={{
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{style.icon}</span>
                  <span style={{ fontWeight: 500 }}>{style.name}</span>
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {style.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div
              style={{
                padding: 12,
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 16,
                color: 'var(--color-error)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {error}
            </div>
          )}

          {/* Preview */}
          {previewSvg && (
            <div className="form-group">
              <label className="form-label">Preview</label>
              <div
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  background: 'white',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  maxHeight: '400px',
                  overflow: 'auto',
                }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />
              </div>
              {dimensions && (
                <p
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-secondary)',
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  {dimensions.width.toFixed(1)}mm × {dimensions.height.toFixed(1)}mm
                </p>
              )}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleGenerate}
            disabled={isGenerating || !currentBounds}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </button>
          <button className="btn btn-primary" onClick={handleApply} disabled={!previewSvg}>
            Add to Canvas
          </button>
        </div>
      </div>
    </div>
  );
}
