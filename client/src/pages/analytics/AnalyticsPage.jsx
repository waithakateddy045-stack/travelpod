import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    HiOutlineChartBar, HiOutlineEye, HiOutlineHeart,
    HiOutlineUsers, HiOutlineCursorArrowRays, HiOutlineArrowLeft
} from 'react-icons/hi2';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './AnalyticsPage.css';

export default function AnalyticsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'].includes(user.accountType)) {
            toast.error('Analytics is only available for business accounts');
            navigate('/');
            return;
        }

        const fetchAnalytics = async () => {
            try {
                const res = await api.get('/analytics/dashboard');
                setData(res.data.dashboard);
            } catch (err) {
                toast.error('Failed to load analytics');
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [user, navigate]);

    if (loading) {
        return (
            <div className="analytics-loading">
                <div className="spinner" />
                <style>{`.spinner { width: 40px; height: 40px; border: 3px solid var(--border-primary); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!data) return null;

    // Helper to extract specific event counts from the grouped aggregation
    const getEventCount = (type) => {
        const event = data.last30DaysEvents?.find(e => e.eventType === type);
        return event ? event._count : 0;
    };

    const linkClicks = getEventCount('LINK_CLICK');
    const watchTimeEvts = getEventCount('WATCH_TIME'); // Approximate as raw events

    const isPremium = user.profile?.accountTier === 'PREMIUM';

    return (
        <div className="analytics-page">
            <div className="analytics-container">
                {/* Header */}
                <div className="analytics-header">
                    <button onClick={() => navigate(-1)} className="back-btn">
                        <HiOutlineArrowLeft />
                    </button>
                    <h1>Business Analytics</h1>
                    {!isPremium && <span className="tier-badge">Base Tier</span>}
                    {isPremium && <span className="tier-badge premium">Premium Tier</span>}
                </div>

                <p className="analytics-subtitle">Lifetime performance of your content on Travelpod.</p>

                {/* Core Metric Cards */}
                <div className="metrics-grid">
                    <div className="metric-card">
                        <div className="metric-icon"><HiOutlineEye /></div>
                        <div className="metric-info">
                            <span className="metric-label">Total Video Views</span>
                            <span className="metric-value">{data.totalViews.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-icon"><HiOutlineHeart /></div>
                        <div className="metric-info">
                            <span className="metric-label">Total Post Likes</span>
                            <span className="metric-value">{data.totalLikes.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-icon"><HiOutlineUsers /></div>
                        <div className="metric-info">
                            <span className="metric-label">Total Followers</span>
                            <span className="metric-value">{data.totalFollowers.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-icon"><HiOutlineCursorArrowRays /></div>
                        <div className="metric-info">
                            <span className="metric-label">Link Clicks (30d)</span>
                            <span className="metric-value">{linkClicks.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Premium Charts Area */}
                <div className="analytics-charts">
                    <h2>Audience Engagement (Last 30 Days)</h2>
                    {isPremium ? (
                        <div className="premium-chart-placeholder">
                            {/* Simple CSS-based bar chart approximation */}
                            <div className="chart-bars">
                                {data.last30DaysEvents?.length > 0 ? (
                                    data.last30DaysEvents.map((evt, i) => (
                                        <div key={i} className="chart-bar-group">
                                            <div className="bar" style={{ height: Math.max(10, Math.min(200, evt._count * 10)) + 'px' }}></div>
                                            <span className="bar-label">{evt.eventType.replace('_', ' ')}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-events">No specific engagement events recorded in the last 30 days.</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="upsell-container">
                            <HiOutlineChartBar className="upsell-icon" />
                            <h3>Unlock Advanced Insights</h3>
                            <p>Upgrade to Premium to see historical engagement charts, demographic breakdowns, and watch-time completion rates.</p>
                            <button className="upsell-btn">Upgrade to Premium</button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
