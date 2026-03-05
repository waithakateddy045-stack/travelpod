import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    HiOutlineHeart, HiHeart,
    HiOutlineChatBubbleOvalLeft, HiOutlineBookmark, HiBookmark,
    HiOutlinePlusCircle, HiOutlineMagnifyingGlass,
    HiOutlineBell, HiOutlineUser, HiOutlinePlayCircle,
    HiOutlineArrowPath, HiOutlineStar, HiOutlineEnvelope,
    HiOutlineChartBar, HiOutlineShare, HiOutlineEllipsisHorizontal,
    HiOutlineRectangleStack
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import VideoPlayer from '../../components/video/VideoPlayer';
import ReportModal from '../../components/common/ReportModal';
import EnquiryModal from '../../components/enquiry/EnquiryModal';
import './FeedPage.css';

const FILTER_CHIPS = [
    'All', 'Destinations', 'Hotels & Resorts', 'Restaurants & Food',
    'Adventures & Activities', 'Travel Tips', 'Safari', 'Beach', 'City Life',
];

const BUSINESS_TYPES = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];

export default function FeedPage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [activeChip, setActiveChip] = useState(
        () => localStorage.getItem('feedChip') || 'All'
    );
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [reportPostId, setReportPostId] = useState(null);
    const [enquiryTarget, setEnquiryTarget] = useState(null); // { userId, displayName }

    const handleShare = (id) => {
        const link = `${window.location.origin}/post/${id}`;
        navigator.clipboard.writeText(link)
            .then(() => toast.success('Link copied to clipboard!'))
            .catch(() => toast.error('Copy failed'));
    };

    const loadFeed = useCallback(async () => {
        try {
            const category = activeChip !== 'All' ? `&category=${encodeURIComponent(activeChip)}` : '';
            const { data } = await api.get(`/feed?page=${page}&limit=10${category}`);
            if (data.posts) {
                setPosts(prev => page === 1 ? data.posts : [...prev, ...data.posts]);
            }
        } catch {
            // Feed endpoint may not exist yet — show empty state
        } finally {
            setLoading(false);
        }
    }, [page, activeChip]);

    useEffect(() => { setPage(1); }, [activeChip]);
    useEffect(() => { loadFeed(); }, [loadFeed]);

    // Load unread notifications count
    useEffect(() => {
        if (!user) return;
        api.get('/notifications').then(res => {
            if (res.data?.unreadCount) setUnreadNotifications(res.data.unreadCount);
        }).catch(() => { });
    }, [user]);

    const handleLike = async (postId, isLiked) => {
        try {
            if (isLiked) {
                await api.delete(`/engagement/like/${postId}`);
            } else {
                await api.post(`/engagement/like/${postId}`);
            }
            setPosts(prev => prev.map(p =>
                p.id === postId ? { ...p, isLiked: !isLiked, likeCount: p.likeCount + (isLiked ? -1 : 1) } : p
            ));
        } catch (err) {
            toast.error('Failed to update like');
        }
    };

    const handleSave = async (postId, isSaved) => {
        try {
            if (isSaved) {
                await api.delete(`/engagement/save/${postId}`);
            } else {
                await api.post(`/engagement/save/${postId}`);
            }
            setPosts(prev => prev.map(p =>
                p.id === postId ? { ...p, isSaved: !isSaved } : p
            ));
        } catch {
            toast.error('Failed to update save');
        }
    };

    return (
        <div className="feed-page">
            <div className="feed-container">
                {/* Top nav */}
                <nav className="feed-nav">
                    <span className="feed-nav-logo">Travelpod</span>
                    <div className="feed-nav-actions">
                        <button className="feed-nav-btn" onClick={() => navigate('/upload')} title="Upload">
                            <HiOutlinePlusCircle />
                        </button>
                        {BUSINESS_TYPES.includes(user?.accountType) && (
                            <button className="feed-nav-btn" onClick={() => navigate('/analytics')} title="Analytics">
                                <HiOutlineChartBar />
                            </button>
                        )}
                        <button className="feed-nav-btn" onClick={() => navigate('/explore')} title="Explore">
                            <HiOutlineMagnifyingGlass />
                        </button>
                        <button className="feed-nav-btn" onClick={() => navigate('/messages')} title="Messages">
                            <HiOutlineEnvelope />
                        </button>
                        <button className="feed-nav-btn" onClick={() => navigate('/boards')} title="Trip Boards">
                            <HiOutlineRectangleStack />
                        </button>
                        {BUSINESS_TYPES.includes(user?.accountType) && (
                            <button className="feed-nav-btn" onClick={() => navigate('/enquiries')} title="Enquiries">
                                <span style={{ fontSize: '1.1rem' }}>✉️</span>
                            </button>
                        )}
                        <button className="feed-nav-btn" onClick={() => navigate('/notifications')} title="Notifications" style={{ position: 'relative' }}>
                            <HiOutlineBell />
                            {unreadNotifications > 0 && (
                                <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: 'var(--color-primary-light)', borderRadius: '50%' }} />
                            )}
                        </button>
                        <Link to={user?.profile?.handle ? `/profile/${user.profile.handle}` : '#'} className="feed-nav-btn" title="Profile">
                            <HiOutlineUser />
                        </Link>
                    </div>
                </nav>

                {/* Filter Chip Row */}
                <div id="feed-filter-chips" style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', padding: 'var(--space-3) var(--space-4)', scrollbarWidth: 'none', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-primary)' }}>
                    {FILTER_CHIPS.map(chip => (
                        <button
                            key={chip}
                            onClick={() => { setActiveChip(chip); localStorage.setItem('feed_filter', chip); }}
                            style={{
                                whiteSpace: 'nowrap', padding: '6px 16px', borderRadius: 'var(--radius-full)',
                                border: '1px solid', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 500,
                                background: activeChip === chip ? 'var(--color-primary)' : 'var(--bg-elevated)',
                                borderColor: activeChip === chip ? 'var(--color-primary)' : 'var(--border-primary)',
                                color: activeChip === chip ? 'white' : 'var(--text-secondary)',
                                transition: 'all 0.15s',
                            }}
                        >
                            {chip}
                        </button>
                    ))}
                </div>

                {/* Feed content */}
                {loading ? (
                    <div className="feed-empty">
                        <div style={{ width: 40, height: 40, border: '3px solid var(--border-primary)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="feed-empty">
                        <HiOutlinePlayCircle />
                        <h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Your feed is empty</h3>
                        <p>Follow travelers and businesses, or upload your first video!</p>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
                            <button
                                onClick={() => navigate('/upload')}
                                style={{ padding: '10px 24px', borderRadius: 'var(--radius-full)', background: 'var(--gradient-brand)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-glow)' }}
                            >
                                Upload Video
                            </button>
                            <button
                                onClick={() => navigate('/explore')}
                                style={{ padding: '10px 24px', borderRadius: 'var(--radius-full)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Explore
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {posts.map(post => (
                            <div key={post.id} className="feed-card">
                                {/* Header */}
                                <Link to={`/profile/${post.user?.profile?.handle || ''}`} className="feed-card-header" style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div className="feed-card-avatar">
                                        {post.user?.profile?.avatarUrl ? (
                                            <img src={post.user.profile.avatarUrl} alt="" />
                                        ) : (
                                            <HiOutlineUser />
                                        )}
                                    </div>
                                    <div className="feed-card-user">
                                        <div className="feed-card-name">{post.user?.profile?.displayName || 'User'}</div>
                                        <div className="feed-card-handle">@{post.user?.profile?.handle || '...'}</div>
                                    </div>
                                </Link>

                                {/* Video */}
                                <VideoPlayer src={post.videoUrl} poster={post.thumbnailUrl} />

                                {/* Actions */}
                                <div className="feed-card-actions">
                                    <button
                                        className={`feed-action-btn${post.isLiked ? ' liked' : ''}`}
                                        onClick={() => handleLike(post.id, post.isLiked)}
                                    >
                                        {post.isLiked ? <HiHeart /> : <HiOutlineHeart />}
                                        {post.likeCount || 0}
                                    </button>
                                    <button className="feed-action-btn" onClick={() => navigate(`/post/${post.id}`)}>
                                        <HiOutlineChatBubbleOvalLeft />
                                        {post.commentCount || 0}
                                    </button>
                                    <button className="feed-action-btn" onClick={() => handleShare(post.id)} title="Share">
                                        <HiOutlineShare />
                                    </button>
                                    <button
                                        className={`feed-action-btn${post.isSaved ? ' saved' : ''}`}
                                        onClick={() => handleSave(post.id, post.isSaved)}
                                        style={{ marginLeft: 'auto' }}
                                    >
                                        {post.isSaved ? <HiBookmark /> : <HiOutlineBookmark />}
                                    </button>
                                    <button className="feed-action-btn" onClick={() => setReportPostId(post.id)} title="Report">
                                        <HiOutlineEllipsisHorizontal />
                                    </button>
                                </div>

                                {/* Business CTAs (Enquire / Review links) */}
                                {BUSINESS_TYPES.includes(post.user?.accountType) && (
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', padding: '0 var(--space-4) var(--space-2)' }}>
                                        <button
                                            onClick={() => setEnquiryTarget({ userId: post.user?.id || post.userId, displayName: post.user?.profile?.displayName || 'Business' })}
                                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--color-primary-light)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            <HiOutlineEnvelope style={{ fontSize: '0.9rem' }} /> Enquire
                                        </button>
                                        <span style={{ color: 'var(--border-primary)', fontSize: 'var(--text-xs)' }}>·</span>
                                        <button
                                            onClick={() => navigate('/upload', { state: { reviewBusiness: post.user?.profile?.handle } })}
                                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            <HiOutlineStar style={{ fontSize: '0.9rem' }} /> Write Review
                                        </button>
                                    </div>
                                )}

                                {/* Title / description */}
                                <div className="feed-card-title">
                                    <strong>{post.user?.profile?.displayName}</strong>
                                    {post.title}
                                </div>
                            </div>
                        ))}

                        {/* Load more */}
                        <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                            <button
                                className="feed-action-btn"
                                onClick={() => setPage(p => p + 1)}
                                style={{ fontSize: 'var(--text-sm)', padding: '8px 20px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-full)' }}
                            >
                                <HiOutlineArrowPath /> Load more
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Report Modal */}
            {reportPostId && (
                <ReportModal postId={reportPostId} onClose={() => setReportPostId(null)} />
            )}

            {/* Enquiry Modal */}
            {enquiryTarget && (
                <EnquiryModal
                    businessId={enquiryTarget.userId}
                    businessName={enquiryTarget.displayName}
                    isOpen={true}
                    onClose={() => setEnquiryTarget(null)}
                />
            )}
        </div>
    );
}
