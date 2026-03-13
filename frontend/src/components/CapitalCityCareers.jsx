import React, { useState, useEffect } from 'react';
import { Briefcase, TrendingUp, RefreshCw } from 'lucide-react';
import { apiUrl } from '../lib/api';

const CapitalCityCareers = () => {
    const [data, setData] = useState({
        jobs: [],
        totalCount: 0,
        topIndustry: 'Loading...',
        lastUpdated: null
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(apiUrl('/api/dashboard/careers'));
            if (!response.ok) throw new Error('Failed to fetch careers data');
            const result = await response.json();
            setData(result);
        } catch (err) {
            console.error('Error fetching careers data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Refresh every 30 minutes
        const interval = setInterval(fetchData, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const displayJobs = data.jobs?.slice(0, 3) || [];

    return (
        <div className="bg-mgm-card rounded-xl p-6 shadow-lg border border-gray-800 flex flex-col h-96">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-mgm-cyan flex items-center gap-2">
                    <Briefcase className="w-6 h-6" />
                    Capital City Careers
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-mgm-blue/20 text-mgm-blue px-2 py-1 rounded-full">
                        {loading ? 'Loading...' : 'Updates every 6h'}
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

            <div className="flex-1 overflow-auto">
                {error ? (
                    <p className="text-red-400 text-sm">Error: {error}</p>
                ) : (
                    <>
                        <p className="text-gray-400 text-sm mb-4">Live feed of jobs filtered to Montgomery, AL (USAJobs and optional Adzuna).</p>

                        {/* Metrics */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-mgm-navy p-4 rounded-lg">
                                <p className="text-xs text-gray-500">New Postings</p>
                                <p className="text-2xl font-bold text-mgm-gold">
                                    {loading ? '...' : data.totalCount || 0}
                                </p>
                            </div>
                            <div className="bg-mgm-navy p-4 rounded-lg">
                                <p className="text-xs text-gray-500">Top Industry</p>
                                <p className="text-2xl font-bold text-white">
                                    {loading ? '...' : data.topIndustry || 'N/A'}
                                </p>
                            </div>
                        </div>

                        {/* Job List */}
                        <ul className="space-y-3">
                            {displayJobs.length > 0 ? (
                                displayJobs.map((job, index) => (
                                    <li key={index} className="p-3 bg-mgm-navy rounded border border-gray-800 flex justify-between items-start hover:border-mgm-cyan transition-colors cursor-pointer">
                                        <div>
                                            <p className="font-medium text-gray-200">{job.title}</p>
                                            <p className="text-xs text-gray-500">{job.company}</p>
                                            <p className="text-xs text-gray-500">{job.location || 'Montgomery, AL'}</p>
                                        </div>
                                        <span className="text-xs text-mgm-gold">{job.postedTime || 'Recent'}</span>
                                    </li>
                                ))
                            ) : (
                                !loading && <p className="text-gray-500 text-sm text-center py-4">No jobs available yet</p>
                            )}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
};

export default CapitalCityCareers;
