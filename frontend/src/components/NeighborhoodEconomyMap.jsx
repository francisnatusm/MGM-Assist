import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Map, RefreshCw } from 'lucide-react';
import MapGL, { Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiUrl } from '../lib/api';

/**
 * Basemap only (reliable). Terrain is added in onLoad when the DEM source responds.
 * OSM.org tiles often block or throttle non-browser clients; CARTO CDN works more consistently.
 */
const BASE_MAP_STYLE = {
  version: 8,
  name: 'economy-base',
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © CARTO'
    }
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#0a0f1e' }
    },
    {
      id: 'basemap',
      type: 'raster',
      source: 'carto',
      paint: {
        'raster-saturation': -0.15,
        'raster-brightness-min': 0.08,
        'raster-brightness-max': 0.92
      }
    }
  ]
};

const NeighborhoodEconomyMap = () => {
  const [data, setData] = useState({
    neighborhoods: [],
    lastUpdated: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popupIndex, setPopupIndex] = useState(null);

  const montgomeryCenter = useMemo(() => ({ lat: 32.3668, lng: -86.2999 }), []);

  const getNeighboroodCoordinates = useCallback(
    (index, name) => {
      const coords = {
        'Downtown MGM': [32.3782, -86.3077],
        'East Chase': [32.3669, -86.1655],
        'Central MGM': [32.3668, -86.2999],
        Cloverdale: [32.3541, -86.2844],
        'Old Cloverdale': [32.3521, -86.2964],
        'Garden District': [32.3826, -86.299]
      };

      if (coords[name]) return coords[name];

      const offsets = [
        [0.015, -0.008],
        [-0.002, 0.035],
        [-0.012, -0.012]
      ];
      const offset = offsets[index % 3];
      return [
        montgomeryCenter.lat + offset[0],
        montgomeryCenter.lng + offset[1]
      ];
    },
    [montgomeryCenter.lat, montgomeryCenter.lng]
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiUrl('/api/dashboard/economy'));
      if (!response.ok) throw new Error('Failed to fetch economy data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching economy data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const markers = useMemo(() => {
    if (!data.neighborhoods?.length) return [];
    return data.neighborhoods.map((n, index) => {
      const [lat, lng] = getNeighboroodCoordinates(index, n.name);
      return { ...n, lat, lng, index };
    });
  }, [data.neighborhoods, getNeighboroodCoordinates]);

  const activePopup =
    popupIndex !== null ? markers.find((m) => m.index === popupIndex) : null;

  const onMapLoad = useCallback((e) => {
    const map = e.target;
    try {
      if (map.getSource('terrain-dem')) return;
      map.addSource('terrain-dem', {
        type: 'raster-dem',
        url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
        tileSize: 256
      });
      map.setTerrain({ source: 'terrain-dem', exaggeration: 1.15 });
      if (!map.getLayer('sky')) {
        map.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0.0, 75.0],
            'sky-atmosphere-sun-intensity': 10,
            'sky-atmosphere-color': '#1e293b'
          }
        });
      }
    } catch (err) {
      console.warn('Economy map: 3D terrain unavailable, using tilted 2D.', err);
    }
  }, []);

  return (
    <div className="bg-mgm-card rounded-xl p-6 shadow-lg border border-gray-800 flex flex-col h-96">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h2 className="text-xl font-semibold text-mgm-blue flex items-center gap-2">
          <Map className="w-6 h-6" />
          Economy Map
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-mgm-blue/20 text-mgm-blue px-2 py-1 rounded-full">
            {loading ? 'Loading...' : 'Monthly'}
          </span>
          <button
            type="button"
            onClick={fetchData}
            className="text-mgm-blue hover:text-mgm-cyan transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 min-w-0 rounded-lg border border-gray-800 bg-mgm-navy overflow-hidden">
        {error ? (
          <p className="text-red-400 text-sm p-4">Error: {error}</p>
        ) : (
          <>
            <p className="text-gray-500 px-3 py-2 text-sm shrink-0 border-b border-gray-800/80">
              Tilted map of Montgomery (3D terrain when available). Drag to rotate; use
              compass to reset north.
            </p>

            {/* Fixed height so WebGL canvas always gets pixels (flex alone often collapsed to 0). */}
            <div className="relative w-full h-[252px] shrink-0 bg-mgm-navy">
              <MapGL
                mapStyle={BASE_MAP_STYLE}
                onLoad={onMapLoad}
                initialViewState={{
                  longitude: montgomeryCenter.lng,
                  latitude: montgomeryCenter.lat,
                  zoom: 11.4,
                  pitch: 48,
                  bearing: -28
                }}
                maxPitch={85}
                minPitch={0}
                dragRotate
                touchPitch
                style={{ width: '100%', height: '100%' }}
                attributionControl={{ compact: true }}
              >
                <NavigationControl position="top-left" showCompass showZoom />
                {!loading &&
                  markers.map((n) => (
                    <Marker
                      key={n.index}
                      longitude={n.lng}
                      latitude={n.lat}
                      anchor="bottom"
                    >
                      <button
                        type="button"
                        aria-label={`${n.name} data`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPopupIndex((cur) => (cur === n.index ? null : n.index));
                        }}
                        className="block w-4 h-4 rounded-full bg-mgm-blue border-2 border-white shadow-lg hover:scale-110 transition-transform cursor-pointer"
                      />
                    </Marker>
                  ))}
                {activePopup && (
                  <Popup
                    longitude={activePopup.lng}
                    latitude={activePopup.lat}
                    anchor="bottom"
                    offset={18}
                    onClose={() => setPopupIndex(null)}
                    closeButton
                    closeOnClick={false}
                    maxWidth="280px"
                  >
                    <div className="text-sm text-gray-800 min-w-[200px]">
                      <p className="font-bold text-mgm-blue mb-1">{activePopup.name}</p>
                      <p className="text-xs">
                        <strong>Unemployment:</strong> {activePopup.unemployment}%
                      </p>
                      <p className="text-xs">
                        <strong>Avg Income:</strong> $
                        {(activePopup.avgIncome / 1000).toFixed(0)}k
                      </p>
                      <p className="text-xs">
                        <strong>Poverty Rate:</strong> {activePopup.povertyRate}%
                      </p>
                    </div>
                  </Popup>
                )}
              </MapGL>

              {loading && (
                <div className="absolute inset-0 bg-mgm-navy/70 flex items-center justify-center z-10 pointer-events-none">
                  <p className="text-gray-400 text-sm font-mono tracking-widest">
                    [ LOADING DATA... ]
                  </p>
                </div>
              )}

              {!loading && markers.length === 0 && (
                <div className="absolute bottom-2 left-2 right-2 rounded-md bg-mgm-navy/90 border border-gray-700 px-2 py-1.5 text-center pointer-events-none z-[5]">
                  <p className="text-xs text-gray-400">
                    No neighborhood rows from the server yet — map still shows Montgomery.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NeighborhoodEconomyMap;
