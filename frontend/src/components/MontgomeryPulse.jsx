import React, { useState, useEffect } from 'react';
import { Radio, Clock, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { apiUrl } from '../lib/api';

const MontgomeryPulse = () => {
    const [activeFilter, setActiveFilter] = useState('all');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [feedNote, setFeedNote] = useState(null);

    const categories = [
        { id: 'all', label: 'All', icon: '🔔' },
        { id: 'council', label: 'Council', icon: '🏛️' },
        { id: 'mayor', label: 'Mayor', icon: '👔' },
        { id: 'deadline', label: 'Deadlines', icon: '⏰' },
        { id: 'ordinance', label: 'Ordinances', icon: '📜' },
        { id: 'meeting', label: 'Meetings', icon: '🗓️' }
    ];

    const fetchData = async (resetPage = false) => {
        try {
            setLoading(true);
            setError(null);
            const currentPage = resetPage ? 1 : page;
            const categoryParam = activeFilter !== 'all' ? `&category=${activeFilter}` : '';
            const response = await fetch(apiUrl(`/api/montgomery-pulse?page=${currentPage}${categoryParam}`), {
                cache: 'no-store'
            });
            
            if (!response.ok) throw new Error('Failed to fetch Montgomery Pulse data');
            
            const result = await response.json();
            
            if (resetPage) {
                setItems(result.items || []);
                setPage(1);
                setFeedNote(result.feedNote || null);
            } else {
                setItems(prev => [...prev, ...(result.items || [])]);
            }
            
        } catch (err) {
            console.error('Error fetching Montgomery Pulse:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(true);
        // Refresh every 30 minutes
        const interval = setInterval(() => fetchData(true), 6 * 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [activeFilter]);

    const handleLoadMore = () => {
        setPage(prev => prev + 1);
        fetchData(false);
    };

    const getPostedLabel = (item) => {
        const raw = item?.publishedAt || item?.date;
        if (!raw) return 'Date unknown';
        const posted = new Date(raw);
        if (Number.isNaN(posted.getTime())) return 'Date unknown';

        const seconds = Math.floor((Date.now() - posted.getTime()) / 1000);
        const dateStr = posted.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        if (seconds < 60) return `Posted ${dateStr} · just now`;
        if (seconds < 3600) return `Posted ${dateStr} · ${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `Posted ${dateStr} · ${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 86400 * 14) return `Posted ${dateStr} · ${Math.floor(seconds / 86400)}d ago`;
        return `Posted ${dateStr}`;
    };

    const getDaysUntil = (deadline) => {
        if (!deadline) return null;
        const days = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
        return days;
    };

    const getCategoryIcon = (category) => {
        const cat = categories.find(c => c.id === category);
        return cat ? cat.icon : '📰';
    };

    return (
        <div className="bg-mgm-card rounded-xl p-6 shadow-lg border border-gray-800 flex flex-col h-96">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Radio className="w-6 h-6 text-mgm-cyan" />
                    Montgomery Pulse
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-mgm-green/20 text-mgm-green px-2 py-1 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-mgm-green rounded-full animate-pulse"></span>
                        Daily
                    </span>
                    <button 
                        onClick={() => fetchData(true)} 
                        className="text-mgm-cyan hover:text-mgm-gold transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <p className="text-xs text-gray-500 mb-3">City news and public notices — checked daily, sorted by publish date.</p>
            {feedNote && (
                <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mb-3">
                    {feedNote}
                </p>
            )}

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-gray-700">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveFilter(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            activeFilter === cat.id
                                ? 'bg-mgm-blue text-white'
                                : 'bg-mgm-navy text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                        }`}
                    >
                        <span className="mr-1">{cat.icon}</span>
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {error ? (
                    <p className="text-red-400 text-sm">Error: {error}</p>
                ) : items.length === 0 && !loading ? (
                    <p className="text-gray-500 text-sm text-center py-8">No updates yet</p>
                ) : (
                    items.map((item, index) => {
                        const daysUntil = getDaysUntil(item.deadline);
                        
                        return (
                            <div key={item.id || index} className="bg-mgm-navy p-3 rounded border border-gray-800 hover:border-mgm-cyan/30 transition">
                                {/* Category + Time */}
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                    <span>{getCategoryIcon(item.category)}</span>
                                    <span className="capitalize">{item.category}</span>
                                    <span>·</span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {getPostedLabel(item)}
                                        {(item.isDigest || / Update from Montgomery$/i.test(item.title || '')) && (
                                            <span className="text-[10px] text-gray-500">(source page)</span>
                                        )}
                                    </span>
                                </div>

                                {/* Title */}
                                <h3 className="font-semibold text-white text-sm mb-2">{item.title}</h3>

                                {/* Summary */}
                                <p className="text-gray-400 text-xs leading-relaxed mb-3">{item.summary}</p>

                                {/* Footer: Deadline + Action */}
                                <div className="flex items-center justify-between gap-2">
                                    {daysUntil !== null && daysUntil >= 0 && (
                                        <div className={`text-xs flex items-center gap-1 ${
                                            daysUntil <= 7 ? 'text-mgm-red' : 'text-yellow-500'
                                        }`}>
                                            <AlertCircle className="w-3 h-3" />
                                            <span>{daysUntil} days left</span>
                                        </div>
                                    )}
                                    
                                    {item.actionLink && item.actionLabel && (
                                        <a
                                            href={item.actionLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs bg-mgm-blue/20 text-mgm-blue hover:bg-mgm-blue hover:text-white px-3 py-1 rounded transition flex items-center gap-1 ml-auto"
                                        >
                                            {item.actionLabel}
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}

                {loading && items.length === 0 && (
                    <div className="text-center py-8">
                        <div className="inline-block w-6 h-6 border-2 border-mgm-blue border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-500 text-sm mt-2">Loading updates...</p>
                    </div>
                )}
            </div>

            {/* Load More */}
            {!loading && items.length > 0 && (
                <button
                    onClick={handleLoadMore}
                    className="mt-4 w-full py-2 text-xs bg-mgm-navy hover:bg-gray-700 text-gray-400 hover:text-white rounded transition"
                    disabled={loading}
                >
                    Load more updates...
                </button>
            )}
        </div>
    );
};

export default MontgomeryPulse;
