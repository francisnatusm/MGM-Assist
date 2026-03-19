import React, { useState, useEffect } from 'react';
import { Store, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { apiUrl } from '../lib/api';

const BusinessSignals = () => {
    const [data, setData] = useState({
        newBusinesses: 0,
        closedBusinesses: 0,
        hotNeighborhoods: [],
        lastUpdated: null
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(apiUrl('/api/dashboard/business'));
            if (!response.ok) throw new Error('Failed to fetch business data');
            const result = await response.json();
            setData(result);
        } catch (err) {
            console.error('Error fetching business data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Refresh every hour
        const interval = setInterval(fetchData, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-mgm-card rounded-xl p-6 shadow-lg border border-gray-800 flex flex-col h-96">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-mgm-gold flex items-center gap-2">
                    <Store className="w-6 h-6" />
                    Business Signals
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-mgm-gold/20 text-mgm-gold px-2 py-1 rounded-full">
                        {loading ? 'Loading...' : 'Daily'}
                    </span>
                    <button 
                        onClick={fetchData} 
                        className="text-mgm-gold hover:text-mgm-cyan transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                {error ? (
                    <p className="text-red-400 text-sm">Error: {error}</p>
                ) : (
                    <>
                        <p className="text-gray-400 text-sm mb-4">Tracking new business licenses and Montgomery Chamber news.</p>

                        {/* Metrics */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-mgm-navy p-4 rounded-lg flex flex-col justify-center border border-mgm-green/20">
                                <p className="text-xs text-gray-500">New Businesses This Week</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-2xl font-bold text-mgm-green">
                                        {loading ? '...' : data.newBusinesses || 0}
                                    </p>
                                    <TrendingUp className="w-5 h-5 text-mgm-green" />
                                </div>
                            </div>
                            <div className="bg-mgm-navy p-4 rounded-lg flex flex-col justify-center border border-mgm-red/20 border-opacity-50">
                                <p className="text-xs text-gray-500">Closed Businesses</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-2xl font-bold text-mgm-red">
                                        {loading ? '...' : data.closedBusinesses || 0}
                                    </p>
                                    <TrendingDown className="w-5 h-5 text-mgm-red opacity-60" />
                                </div>
                            </div>
                        </div>

                        {/* Hot Neighborhoods */}
                        <div className="mb-4 space-y-2">
                            <h3 className="text-sm font-semibold text-gray-300">Hot Neighborhoods</h3>
                            {data.hotNeighborhoods?.length > 0 ? (
                                data.hotNeighborhoods.map((neighborhood, index) => (
                                    <div key={index} className="flex items-center gap-3 bg-mgm-navy/50 p-2 rounded">
                                        <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-mgm-green' : 'bg-yellow-400'}`}></div>
                                        <span className="text-sm font-medium">{neighborhood.name}</span>
                                        <span className="text-xs text-gray-400 ml-auto">+{neighborhood.count} open</span>
                                    </div>
                                ))
                            ) : (
                                !loading && <p className="text-gray-500 text-xs">No data available yet</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BusinessSignals;
