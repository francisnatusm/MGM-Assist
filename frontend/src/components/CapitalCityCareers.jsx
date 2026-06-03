import React, { useState, useEffect } from 'react';
import { Briefcase, RefreshCw } from 'lucide-react';
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
            const response = await fetch(apiUrl('/api/dashboard/careers'), { cache: 'no-store' });
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
        // Re-fetch every 6 hours (server runs full daily sync via Vercel cron + 24h backup)
        const interval = setInterval(fetchData, 6 * 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const formatLastSync = (value) => {
        if (!value) return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    const displayJobs = [...(data.jobs || [])].sort((a, b) => {
        const aTime = a?.postedTime ? new Date(a.postedTime).getTime() : 0;
        const bTime = b?.postedTime ? new Date(b.postedTime).getTime() : 0;
        return bTime - aTime;
    });

    const formatPostedTime = (value) => {
        if (!value) return 'Recent';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;

        const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffDays = Math.floor((startOfDay(new Date()) - startOfDay(parsed)) / 86400000);
        if (diffDays < 1) return 'Today';
        if (diffDays === 1) return '1 day ago';
        if (diffDays < 30) return `${diffDays} days ago`;

        return parsed.toLocaleDateString();
    };

    const locationBadge = (tier) => {
        const map = {
            montgomery: { label: 'Montgomery', className: 'bg-mgm-cyan/20 text-mgm-cyan border-mgm-cyan/40' },
            'river-region': { label: 'River Region', className: 'bg-mgm-blue/20 text-mgm-blue border-mgm-blue/40' },
            alabama: { label: 'Alabama', className: 'bg-gray-600/30 text-gray-300 border-gray-600' },
            remote: { label: 'Remote', className: 'bg-amber-500/15 text-amber-300 border-amber-500/35' },
            other: { label: 'Regional', className: 'bg-gray-600/30 text-gray-300 border-gray-600' }
        };
        return map[tier] || map.other;
    };

    return (
        <div className="bg-mgm-card rounded-xl p-6 shadow-lg border border-gray-800 flex flex-col h-96">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-mgm-cyan flex items-center gap-2">
                    <Briefcase className="w-6 h-6" />
                    Capital City Careers
                </h2>
                <div className="flex items-center gap-2">
                    <span
                        className="text-xs bg-mgm-green/20 text-mgm-green px-2 py-1 rounded-full flex items-center gap-1"
                        title={formatLastSync(data.lastUpdated) ? `Last sync: ${formatLastSync(data.lastUpdated)}` : 'Auto-updates daily'}
                    >
                        <span className="w-1.5 h-1.5 bg-mgm-green rounded-full"></span>
                        {loading ? 'Loading...' : 'Daily'}
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
                        {data.configError && (
                            <p className="text-xs text-red-200 bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
                                {data.configError}
                            </p>
                        )}
                        {data.feedStaleWarning && (
                            <p className="text-xs text-amber-300/95 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mb-3">
                                {data.feedStaleWarning}
                            </p>
                        )}
                        <p className="text-gray-400 text-sm mb-3">Federal Jobs</p>

                        {/* Metrics */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-mgm-navy p-4 rounded-lg">
                                <p className="text-xs text-gray-500">Open Postings</p>
                                <p className="text-2xl font-bold text-mgm-gold">
                                    {loading ? '...' : data.totalCount || 0}
                                </p>
                            </div>
                            <div className="bg-mgm-navy p-4 rounded-lg">
                                <p className="text-xs text-gray-500">In Montgomery</p>
                                <p className="text-2xl font-bold text-white">
                                    {loading ? '...' : (data.montgomeryCount ?? '—')}
                                </p>
                                {!loading && data.postedLast7Days != null && (
                                    <p className="text-[10px] text-gray-500 mt-1">{data.postedLast7Days} posted this week (all areas)</p>
                                )}
                            </div>
                        </div>

                        {/* Job List */}
                        <ul className="space-y-3">
                            {displayJobs.length > 0 ? (
                                displayJobs.map((job, index) => {
                                    const badge = locationBadge(job.locationTier);
                                    return (
                                    <li key={job.url || index}>
                                        <a
                                            href={job.url || '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-3 bg-mgm-navy rounded border border-gray-800 flex justify-between items-start gap-2 hover:border-mgm-cyan transition-colors block"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-200">{job.title}</p>
                                                <p className="text-xs text-gray-500">{job.company}</p>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${badge.className}`}>
                                                        {badge.label}
                                                    </span>
                                                    <p className="text-xs text-gray-500 truncate">{job.location || 'Montgomery, AL'}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-mgm-gold shrink-0">{formatPostedTime(job.postedTime)}</span>
                                        </a>
                                    </li>
                                    );
                                })
                            ) : (
                                !loading && (
                                    <div className="text-center py-4 space-y-2">
                                        <p className="text-gray-500 text-sm">No jobs in the feed right now.</p>
                                        {!data.configError && (
                                            <p className="text-xs text-gray-600 max-w-md mx-auto">
                                                If keys are set on Vercel, try the refresh control or check deployment logs.
                                            </p>
                                        )}
                                    </div>
                                )
                            )}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
};

export default CapitalCityCareers;
