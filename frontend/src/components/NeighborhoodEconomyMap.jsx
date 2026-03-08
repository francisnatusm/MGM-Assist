import React, { useState, useEffect } from 'react';
import { Map, MapPin, RefreshCw } from 'lucide-react';
import { apiUrl } from '../lib/api';

const NeighborhoodEconomyMap = () => {
    const [data, setData] = useState({
        neighborhoods: [],
        lastUpdated: null
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                        {loading ? 'Loading...' : 'Monthly Census Data'}
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

            <div className="flex-1 overflow-auto flex flex-col relative w-full rounded-lg border border-gray-800 bg-mgm-navy overflow-hidden">
                {error ? (
                    <p className="text-red-400 text-sm p-4">Error: {error}</p>
                ) : (
                    <>
                        <p className="text-gray-500 p-4 pb-0 text-sm">Interactive map representing Unemployment, Income, Poverty rate.</p>

                        <div className="flex-1 w-full h-full relative flex items-center justify-center p-4">
                            <div className="bg-gray-800/50 w-full h-full rounded flex items-center justify-center border border-dashed border-gray-600 relative overflow-hidden">

                                {/* Map point overlays */}
                                {data.neighborhoods?.slice(0, 3).map((neighborhood, index) => {
                                    const positions = [
                                        { top: '30%', left: '40%' },
                                        { top: '50%', left: '60%' },
                                        { bottom: '20%', right: '30%' }
                                    ];
                                    const position = positions[index] || positions[0];
                                    
                                    return (
                                        <div 
                                            key={index} 
                                            className="absolute group cursor-pointer"
                                            style={position}
                                        >
                                            <MapPin className={`${index === 0 ? 'text-mgm-gold' : 'text-mgm-blue'} w-6 h-6`} />
                                            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-40 bg-mgm-card border border-mgm-gold p-2 rounded shadow-xl hidden group-hover:block transition z-10">
                                                <p className="text-xs font-bold text-white mb-1">{neighborhood.name}</p>
                                                <p className="text-[10px] text-gray-400">Unemployment: {neighborhood.unemployment}%</p>
                                                <p className="text-[10px] text-gray-400">Avg Income: ${(neighborhood.avgIncome / 1000).toFixed(0)}k</p>
                                                <p className="text-[10px] text-gray-400">Poverty: {neighborhood.povertyRate}%</p>
                                            </div>
                                        </div>
                                    );
                                })}

                                {!loading && data.neighborhoods?.length === 0 && (
                                    <p className="opacity-40 text-sm font-mono tracking-widest">[ AWAITING DATA ]</p>
                                )}
                                {loading && (
                                    <p className="opacity-40 text-sm font-mono tracking-widest">[ LOADING... ]</p>
                                )}
                                {!loading && data.neighborhoods?.length > 0 && (
                                    <p className="opacity-40 text-sm font-mono tracking-widest">[ HOVER OVER PINS ]</p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default NeighborhoodEconomyMap;
