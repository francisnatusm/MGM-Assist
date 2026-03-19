import React, { useState, useEffect } from 'react';
import { Map, RefreshCw } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { apiUrl } from '../lib/api';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const NeighborhoodEconomyMap = () => {
    const [data, setData] = useState({
        neighborhoods: [],
        lastUpdated: null
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Montgomery, Alabama coordinates
    const montgomeryCenter = [32.3668, -86.2999];

    // Approximate neighborhood coordinates for Montgomery, AL
    const getNeighboroodCoordinates = (index, name) => {
        // Real approximate coordinates for Montgomery neighborhoods
        const coords = {
            'Downtown MGM': [32.3782, -86.3077],
            'East Chase': [32.3669, -86.1655],
            'Central MGM': [32.3668, -86.2999],
            'Cloverdale': [32.3541, -86.2844],
            'Old Cloverdale': [32.3521, -86.2964],
            'Garden District': [32.3826, -86.2990],
        };
        
        // If we have real coordinates for this name, use them
        if (coords[name]) return coords[name];
        
        // Otherwise distribute around Montgomery
        const offsets = [
            [0.015, -0.008],   // Northeast
            [-0.002, 0.035],   // East
            [-0.012, -0.012],  // Southwest
        ];
        const offset = offsets[index % 3];
        return [montgomeryCenter[0] + offset[0], montgomeryCenter[1] + offset[1]];
    };

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
        // Refresh every 24 hours
        const interval = setInterval(fetchData, 24 * 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-mgm-card rounded-xl p-6 shadow-lg border border-gray-800 flex flex-col h-96">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-mgm-blue flex items-center gap-2">
                    <Map className="w-6 h-6" />
                    Economy Map
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-mgm-blue/20 text-mgm-blue px-2 py-1 rounded-full">
                        {loading ? 'Loading...' : 'Monthly'}
                    </span>
                    <button 
                        onClick={fetchData} 
                        className="text-mgm-blue hover:text-mgm-cyan transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col relative w-full rounded-lg border border-gray-800 bg-mgm-navy">
                {error ? (
                    <p className="text-red-400 text-sm p-4">Error: {error}</p>
                ) : (
                    <>
                        <p className="text-gray-500 p-4 pb-2 text-sm">Interactive map representing Unemployment, Income, Poverty rate.</p>

                        <div className="flex-1 w-full h-full relative rounded-b-lg overflow-hidden">
                            <MapContainer 
                                center={montgomeryCenter} 
                                zoom={12} 
                                style={{ height: '100%', width: '100%' }}
                                zoomControl={true}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                
                                {!loading && data.neighborhoods?.map((neighborhood, index) => {
                                    const position = getNeighboroodCoordinates(index, neighborhood.name);
                                    
                                    return (
                                        <Marker key={index} position={position}>
                                            <Popup>
                                                <div className="text-sm">
                                                    <p className="font-bold text-mgm-blue mb-1">{neighborhood.name}</p>
                                                    <p className="text-xs text-gray-700">
                                                        <strong>Unemployment:</strong> {neighborhood.unemployment}%
                                                    </p>
                                                    <p className="text-xs text-gray-700">
                                                        <strong>Avg Income:</strong> ${(neighborhood.avgIncome / 1000).toFixed(0)}k
                                                    </p>
                                                    <p className="text-xs text-gray-700">
                                                        <strong>Poverty Rate:</strong> {neighborhood.povertyRate}%
                                                    </p>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    );
                                })}
                            </MapContainer>

                            {loading && (
                                <div className="absolute inset-0 bg-mgm-navy/80 flex items-center justify-center z-[1000]">
                                    <p className="text-gray-400 text-sm font-mono tracking-widest">[ LOADING MAP... ]</p>
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
