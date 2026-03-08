import React, { useState, useEffect } from 'react';
import { Target, Calendar, RefreshCw } from 'lucide-react';
import { apiUrl } from '../lib/api';

const OpportunityFinder = () => {
    const [activeTab, setActiveTab] = useState('grants');
    const [data, setData] = useState({
        grants: [],
        training: [],
        fairs: [],
        lastUpdated: null
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const tabs = [
        { id: 'grants', label: 'Grants' },
        { id: 'training', label: 'Training' },
        { id: 'fairs', label: 'Job Fairs' },
    ];

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(apiUrl('/api/dashboard/opportunities'));
            if (!response.ok) throw new Error('Failed to fetch opportunities data');
            const result = await response.json();
            setData(result);
        } catch (err) {
            console.error('Error fetching opportunities data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Refresh every 6 hours
        const interval = setInterval(fetchData, 6 * 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const currentData = data[activeTab] || [];

    return (
        <div className="bg-mgm-card rounded-xl p-6 shadow-lg border border-gray-800 flex flex-col h-96">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Target className="w-6 h-6 text-mgm-cyan" />
                    Opportunity Finder
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-mgm-cyan/20 text-mgm-cyan px-2 py-1 rounded-full">
                        {loading ? 'Loading...' : 'Scraped Daily'}
                    </span>
                    <button 
                        onClick={fetchData} 
                        className="text-mgm-cyan hover:text-mgm-gold transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col max-h-full">
                {error ? (
                    <p className="text-red-400 text-sm">Error: {error}</p>
                ) : (
                    <>
                        {/* Tabs */}
                        <div className="flex space-x-2 border-b border-gray-700 pb-2 mb-4">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${activeTab === tab.id
                                            ? 'bg-mgm-cyan/10 text-mgm-cyan border-b-2 border-mgm-cyan'
                                            : 'text-gray-400 hover:text-gray-200'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content list */}
                        <div className="overflow-y-auto flex-1 pr-1 space-y-3">
                            {currentData.length > 0 ? (
                                currentData.map((item, index) => (
                                    <div key={index} className="bg-mgm-navy p-4 rounded border border-gray-800 hover:border-mgm-cyan/50 transition flex flex-col justify-between">
                                        <h3 className="font-medium text-white text-sm mb-2">{item.name}</h3>
                                        <div className="flex justify-between items-end mt-auto">
                                            <div className="flex items-center gap-1 text-xs text-mgm-gold">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>{item.deadline}</span>
                                            </div>
                                            <a 
                                                href={item.link} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-xs text-mgm-blue hover:text-mgm-cyan underline"
                                            >
                                                View Details
                                            </a>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                !loading && <p className="text-sm text-gray-500 text-center py-6">No current opportunities found.</p>
                            )}
                            {loading && <p className="text-sm text-gray-500 text-center py-6">Loading opportunities...</p>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default OpportunityFinder;
