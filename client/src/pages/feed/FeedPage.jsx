import { useState, useEffect, useCallback, useRef } from 'react';
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
import AuthPromptModal from '../../components/auth/AuthPromptModal';
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
    const [feedMode, setFeedMode] = useState('FOR_YOU'); // 'FOR_YOU', 'FOLLOWING', 'BROADCASTS'
    const [hasMore, setHasMore] = useState(true);
    const [activeChip, setActiveChip] = useState(
        () => localStorage.getItem('feedChip') || 'All'
    );
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [reportPostId, setReportPostId] = useState(null);
    const [enquiryTarget, setEnquiryTarget] = useState(null); // { userId, displayName }
    const [authModal, setAuthModal] = useState({ isOpen: false, message: '' });

    // Nudge State
    const [videosViewed, setVideosViewed] = useState(0);
    const [showNudge, setShowNudge] = useState(false);

    const handleShare = (id) => {
        const link = `${window.location.origin}/post/${id}`;
        navigator.clipboard.writeText(link)
            .then(() => toast.success('Link copied to clipboard!'))
            .catch(() => toast.error('Copy failed'));
    };

    const loadFeed = useCallback(async () => {
        try {
            let endpoint = `/feed?page=${page}&limit=10`;
            if (feedMode === 'FOLLOWING') endpoint = `/feed/following?page=${page}&limit=10`;
            if (feedMode === 'BROADCASTS') endpoint = `/broadcasts/inbox?page=${page}&limit=10`;

            const category = activeChip !== 'All' && feedMode === 'FOR_YOU' ? `&category=${encodeURIComponent(activeChip)}` : '';
            const { data } = await api.get(`${endpoint}${category}`);

            if (data.posts || data.broadcasts) {
                const newItems = data.posts || data.broadcasts.map(b => ({
                    ...b.broadcast.post,
                    author: b.broadcast.association,
                    isBroadcast: true,
                    broadcastId: b.broadcast.id
                }));

                if (newItems.length < 10) setHasMore(false); else setHasMore(true);
                setPosts(prev => page === 1 ? newItems : [...prev, ...newItems]);
            } else {
                setHasMore(false);
            }
        } catch {
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [page, activeChip, feedMode]);

    useEffect(() => { setPage(1); setHasMore(true); }, [activeChip, feedMode]);
    useEffect(() => { loadFeed(); }, [loadFeed]);

    // Load unread notifications count
    useEffect(() => {
        if (!user) return;
        api.get('/notifications').then(res => {
            if (res.data?.unreadCount) setUnreadNotifications(res.data.unreadCount);
        }).catch(() => { });
    }, [user]);

    const handleLike = async (postId, isLiked) => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Like videos and save your favourites' });
            return;
        }
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
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Save videos to your trip boards' });
            return;
        }
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

    const observer = useRef();
    const lastPostElementRef = useCallback(node => {
        if (loading) return;

        // Track unique video views for nudge
        if (node && !user && !sessionStorage.getItem('travelpod_nudged')) {
            setVideosViewed(prev => {
                const next = prev + 1;
                if (next === 5) {
                    setShowNudge(true);
                    sessionStorage.setItem('travelpod_nudged', 'true');
                    setTimeout(() => setShowNudge(false), 8000);
                }
                return next;
            });
        }

        if (!hasMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                setPage(prevPage => prevPage + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore, user]);

    return (
        <div className="feed-page">
            <div className="feed-container">
                {/* Top nav */}
                <nav className="feed-nav">
                    <span className="feed-nav-logo">Travelpod</span>
                    <div className="feed-nav-actions">
                        {user ? (
                            <>
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
                            </>
                        ) : (
                            <>
                                <button className="feed-nav-btn" onClick={() => navigate('/explore')} title="Explore">
                                    <HiOutlineMagnifyingGlass />
                                </button>
                                <button className="feed-guest-login-btn" onClick={() => navigate('/auth/login')}>Log In</button>
                                <button className="feed-guest-signup-btn" onClick={() => navigate('/auth/register')}>Sign Up</button>
                            </>
                        )}
                    </div>
                </nav>

                {/* Feed Tabs */}
                <div className="feed-tabs">
                    <button
                        className={`feed-tab${feedMode === 'FOR_YOU' ? ' active' : ''}`}
                        onClick={() => setFeedMode('FOR_YOU')}
                    >
                        For You
                    </button>
                    <button
                        className={`feed-tab${feedMode === 'FOLLOWING' ? ' active' : ''}`}
                        onClick={() => setFeedMode('FOLLOWING')}
                    >
                        Following
                    </button>
                    <button
                        className={`feed-tab${feedMode === 'BROADCASTS' ? ' active' : ''}`}
                        onClick={() => setFeedMode('BROADCASTS')}
                    >
                        Broadcasts
                    </button>
                </div>

                {/* Filter Chip Row */}
                <div className="feed-filter-chips">
                    {FILTER_CHIPS.map(chip => (
                        <button
                            key={chip}
                            className={`feed-chip${activeChip === chip ? ' active' : ''}`}
                            onClick={() => { setActiveChip(chip); localStorage.setItem('feed_filter', chip); }}
                        >
                            {chip}
                        </button>
                    ))}
                </div>

                {/* Feed content */}
                {loading ? (
                    <div className="feed-empty">
                        <div className="feed-spinner" />
                    </div>
                ) : posts.length === 0 ? (
                    <div className="feed-empty">
                        <HiOutlinePlayCircle />
                        <h3 className="feed-empty-title">Your feed is empty</h3>
                        <p>{feedMode === 'BROADCASTS' ? 'No broadcasts targeted at you yet.' : 'Follow travelers and businesses, or upload your first video!'}</p>
                        <div className="feed-empty-actions">
                            <button className="feed-empty-cta-primary" onClick={() => navigate('/upload')}>Upload Video</button>
                            <button className="feed-empty-cta-secondary" onClick={() => navigate('/explore')}>Explore</button>
                        </div>
                    </div>
                ) : (
                    <>
                        {posts.map(post => (
                            <div key={post.id} className="feed-card">
                                {/* Header */}
                                <Link to={`/profile/${post.user?.profile?.handle || post.author?.profile?.handle || ''}`} className="feed-card-header">
                                    <div className="feed-card-avatar">
                                        {(post.user?.profile?.avatarUrl || post.author?.profile?.avatarUrl) ? (
                                            <img src={post.user?.profile?.avatarUrl || post.author?.profile?.avatarUrl} alt="" />
                                        ) : (
                                            <HiOutlineUser />
                                        )}
                                    </div>
                                    <div className="feed-card-user">
                                        <div className="feed-card-name">{post.user?.profile?.displayName || post.author?.profile?.displayName || 'User'}</div>
                                        <div className="feed-card-handle">@{post.user?.profile?.handle || post.author?.profile?.handle || '...'}</div>
                                    </div>
                                    {post.isBroadcast && <span className="feed-card-badge">Broadcast</span>}
                                </Link>

                                {/* Content */}
                                {post.isBroadcast ? (
                                    <div className="feed-broadcast-content">
                                        <h3>{post.title}</h3>
                                        <p>{post.description}</p>
                                        {post.videoUrl && (
                                            <div style={{ marginTop: 'var(--space-3)' }}>
                                                <VideoPlayer src={post.videoUrl} poster={post.thumbnailUrl} />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <VideoPlayer src={post.videoUrl} poster={post.thumbnailUrl} />
                                )}

                                {/* Actions */}
                                <div className="feed-card-actions">
                                    <button
                                        className={`feed-action-btn${post.isLiked ? ' liked' : ''}`}
                                        onClick={() => handleLike(post.id, post.isLiked)}
                                    >
                                        {post.isLiked ? <HiHeart /> : <HiOutlineHeart />}
                                        {post.likeCount || 0}
                                    </button>
                                    <button
                                        type="button"
                                        className="feed-action-btn"
                                        onClick={() => {
                                            if (!user) {
                                                setAuthModal({ isOpen: true, message: 'Join the conversation' });
                                                return;
                                            }
                                            navigate(`/post/${post.id}`)
                                        }}
                                    >
                                        <HiOutlineChatBubbleOvalLeft />
                                        {post.commentCount || 0}
                                    </button>
                                    <button className="feed-action-btn" onClick={() => handleShare(post.id)} title="Share">
                                        <HiOutlineShare />
                                    </button>
                                    <button
                                        className={`feed-action-btn${post.isSaved ? ' saved' : ''}`}
                                        onClick={() => handleSave(post.id, post.isSaved)}

                                    >
                                        {post.isSaved ? <HiBookmark /> : <HiOutlineBookmark />}
                                    </button>
                                    <button className="feed-action-btn" onClick={() => {
                                        if (!user) {
                                            setAuthModal({ isOpen: true, message: 'Log in to report content and help keep Travelpod safe' });
                                            return;
                                        }
                                        setReportPostId(post.id);
                                    }} title="Report">
                                        <HiOutlineEllipsisHorizontal />
                                    </button>
                                </div>

                                {/* Business CTAs (Enquire / Review links) */}
                                {(BUSINESS_TYPES.includes(post.user?.accountType) || post.isBroadcast) && !post.isBroadcast && (
                                    <div className="feed-business-ctas">
                                        <button
                                            className="feed-biz-btn feed-biz-btn-primary"
                                            onClick={() => {
                                                if (!user) {
                                                    setAuthModal({ isOpen: true, message: 'Send booking enquiries to travel businesses' });
                                                    return;
                                                }
                                                setEnquiryTarget({ userId: post.user?.id || post.userId, displayName: post.user?.profile?.displayName || 'Business' });
                                            }}
                                        >
                                            <HiOutlineEnvelope /> Enquire
                                        </button>
                                        <span className="feed-biz-dot">·</span>
                                        <button
                                            className="feed-biz-btn"
                                            onClick={() => navigate('/upload', { state: { reviewBusiness: post.user?.profile?.handle } })}
                                        >
                                            <HiOutlineStar /> Write Review
                                        </button>
                                    </div>
                                )}

                                {/* Title / description */}
                                {!post.isBroadcast && (
                                    <div className="feed-card-title">
                                        <strong>{post.user?.profile?.displayName}</strong>
                                        {post.title}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Infinite scroll loader */}
                        {hasMore && (
                            <div ref={lastPostElementRef} className="feed-scroll-status">
                                {loading && posts.length > 0 ? "Loading more..." : ""}
                            </div>
                        )}
                        {!hasMore && posts.length > 0 && (
                            <div className="feed-scroll-status">
                                You've reached the end!
                            </div>
                        )}
                    </>
                )}
            </div>

            {reportPostId && (
                <ReportModal
                    entityId={reportPostId}
                    entityType="POST"
                    onClose={() => setReportPostId(null)}
                />
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

            <AuthPromptModal
                isOpen={authModal.isOpen}
                onClose={() => setAuthModal({ isOpen: false, message: '' })}
                message={authModal.message}
            />

            {/* Subtle Signup Nudge */}
            {showNudge && !user && (
                <div className="feed-signup-nudge animate-slideUp">
                    <div className="nudge-content">
                        <span className="nudge-icon">✈️</span>
                        <div className="nudge-text">
                            <strong>Enjoying Travelpod?</strong>
                            <p>Create a free account to save favourites.</p>
                        </div>
                    </div>
                    <div className="nudge-actions">
                        <button
                            className="nudge-btn"
                            onClick={() => {
                                sessionStorage.setItem('returnUrl', window.location.pathname + window.location.search);
                                navigate('/auth/register');
                            }}
                        >
                            Sign Up
                        </button>
                        <button className="nudge-close" onClick={() => setShowNudge(false)}>×</button>
                    </div>
                </div>
            )}
        </div>
    );
}
