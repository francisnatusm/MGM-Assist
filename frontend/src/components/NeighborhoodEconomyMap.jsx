import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Map, RefreshCw } from 'lucide-react';
import MapGL, {
  Marker,
  Popup,
  NavigationControl,
  Source,
  Layer
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiUrl } from '../lib/api';

/** Rough Montgomery metro outline when no API markers yet */
const MONTGOMERY_FALLBACK_POLYGON = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-86.48, 32.22],
        [-86.08, 32.22],
        [-86.08, 32.52],
        [-86.48, 32.52],
        [-86.48, 32.22]
      ]
    ]
  }
};

function highlightGeoJSON(markers) {
  if (!markers.length) {
    return { type: 'FeatureCollection', features: [MONTGOMERY_FALLBACK_POLYGON] };
  }
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const m of markers) {
    minLat = Math.min(minLat, m.lat);
    maxLat = Math.max(maxLat, m.lat);
    minLng = Math.min(minLng, m.lng);
    maxLng = Math.max(maxLng, m.lng);
  }
  const pad = 0.045;
  const feature = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [minLng - pad, minLat - pad],
          [maxLng + pad, minLat - pad],
          [maxLng + pad, maxLat + pad],
          [minLng - pad, maxLat + pad],
          [minLng - pad, minLat - pad]
        ]
      ]
    }
  };
  return { type: 'FeatureCollection', features: [feature] };
}

/** Public vector style that supports labels + OSM buildings (no API key). */
const BASE_MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

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

  const highlightData = useMemo(() => highlightGeoJSON(markers), [markers]);

  const activePopup =
    popupIndex !== null ? markers.find((m) => m.index === popupIndex) : null;

  const onMapLoad = useCallback((e) => {
    const map = e.target;
    try {
      if (!map.getLayer('economy-3d-buildings')) {
        map.addLayer({
          id: 'economy-3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#d6d0c5',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.93
          }
        });
      }

      map.setLight({
        anchor: 'viewport',
        color: '#fff6e5',
        intensity: 0.45,
        position: [1.5, 160, 70]
      });

      map.setFog({
        color: '#f3efe6',
        'high-color': '#e2ddd1',
        'horizon-blend': 0.1
      });

      if (map.getSource('terrain-dem')) return;
      map.addSource('terrain-dem', {
        type: 'raster-dem',
        url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
        tileSize: 256
      });
      map.setTerrain({ source: 'terrain-dem', exaggeration: 1.08 });
      if (!map.getLayer('sky')) {
        map.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0.7, 145.0],
            'sky-atmosphere-sun-intensity': 6,
            'sky-atmosphere-color': '#dbe3ef',
            'sky-atmosphere-halo-color': '#f8f3e8'
          }
        });
      }
    } catch (err) {
      console.warn('Economy map: terrain/sky unavailable.', err);
    }
  }, []);

  return (
    <div className="bg-mgm-card rounded-xl p-6 shadow-lg border border-gray-800 flex flex-col min-h-96 h-auto">
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
              3D city map style with clean buildings and labels. Pan, zoom, and rotate for the
              same perspective look.
            </p>

            <div className="economy-map-panel relative w-full h-[288px] shrink-0 rounded-b-md overflow-hidden ring-1 ring-gray-600/50 bg-[#1e293b]">
              <MapGL
                mapStyle={BASE_MAP_STYLE_URL}
                onLoad={onMapLoad}
                initialViewState={{
                  longitude: montgomeryCenter.lng,
                  latitude: montgomeryCenter.lat,
                  zoom: 15.2,
                  pitch: 63,
                  bearing: -36
                }}
                maxPitch={85}
                minPitch={0}
                dragRotate
                touchPitch
                style={{ width: '100%', height: '100%' }}
                attributionControl={{ compact: true }}
              >
                <NavigationControl position="top-left" showCompass showZoom />

                <Source id="economy-highlight" type="geojson" data={highlightData}>
                  <Layer
                    id="economy-highlight-fill"
                    type="fill"
                    paint={{
                      'fill-color': '#3b82f6',
                      'fill-opacity': 0.18
                    }}
                  />
                  <Layer
                    id="economy-highlight-line"
                    type="line"
                    paint={{
                      'line-color': '#1e3a8a',
                      'line-width': 2,
                      'line-opacity': 0.95
                    }}
                  />
                </Source>

                {!loading &&
                  markers.map((n) => (
                    <Marker
                      key={n.index}
                      longitude={n.lng}
                      latitude={n.lat}
                      anchor="center"
                    >
                      <button
                        type="button"
                        aria-label={`${n.name} data`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPopupIndex((cur) => (cur === n.index ? null : n.index));
                        }}
                        className="block h-[22px] w-[22px] rounded-full bg-red-500 border-[3px] border-white shadow-[0_2px_14px_rgba(0,0,0,0.55)] hover:scale-110 transition-transform cursor-pointer"
                      />
                    </Marker>
                  ))}
                {activePopup && (
                  <Popup
                    longitude={activePopup.lng}
                    latitude={activePopup.lat}
                    anchor="bottom"
                    offset={20}
                    onClose={() => setPopupIndex(null)}
                    closeButton
                    closeOnClick={false}
                    maxWidth="280px"
                  >
                    <div className="text-sm text-gray-200 min-w-[200px]">
                      <p className="font-semibold text-mgm-cyan mb-1.5">{activePopup.name}</p>
                      <p className="text-xs text-gray-400">
                        <span className="text-gray-300">Unemployment</span>{' '}
                        {activePopup.unemployment}%
                      </p>
                      <p className="text-xs text-gray-400">
                        <span className="text-gray-300">Avg income</span> $
                        {(activePopup.avgIncome / 1000).toFixed(0)}k
                      </p>
                      <p className="text-xs text-gray-400">
                        <span className="text-gray-300">Poverty rate</span>{' '}
                        {activePopup.povertyRate}%
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
                    No neighborhood metrics yet — outline shows the Montgomery study area.
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
