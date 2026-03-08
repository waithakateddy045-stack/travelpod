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
    HiOutlineRectangleStack, HiOutlineSpeakerWave, HiOutlineSpeakerXMark,
    HiCheckBadge
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import VideoPlayer from '../../components/video/VideoPlayer';
import ReportModal from '../../components/common/ReportModal';
import EnquiryModal from '../../components/enquiry/EnquiryModal';
import AuthPromptModal from '../../components/auth/AuthPromptModal';
import './FeedPage.css';

const FILTER_CHIPS = ['All', 'Destinations', 'Hotels & Resorts', 'Safari', 'Beach', 'Adventures'];
const BUSINESS_TYPES = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];

export default function FeedPage() {
    const navigate = useNavigate();
    const { user, loadUser } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [feedMode, setFeedMode] = useState('FOR_YOU'); // 'FOR_YOU', 'FOLLOWING', 'BROADCASTS'
    const [activeChip, setActiveChip] = useState('All');
    const [hasMore, setHasMore] = useState(true);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [reportPostId, setReportPostId] = useState(null);
    const [enquiryTarget, setEnquiryTarget] = useState(null);
    const [authModal, setAuthModal] = useState({ isOpen: false, message: '' });

    // Global UI State
    const [isMuted, setIsMuted] = useState(true); // Browsers block sound by default, user must unmute
    const [activeVideoId, setActiveVideoId] = useState(null);
    const feedRef = useRef(null);
    const [sessionId] = useState(() => localStorage.getItem('travelpod_session_id') || `sid_${Math.random().toString(36).substring(7)}`);

    useEffect(() => {
        if (!localStorage.getItem('travelpod_session_id')) {
            localStorage.setItem('travelpod_session_id', sessionId);
        }
    }, [sessionId]);

    const loadFeed = useCallback(async (isRefresh = false) => {
        const currentPage = isRefresh ? 1 : page;
        try {
            let endpoint = `/feed?page=${currentPage}&limit=10&sessionId=${sessionId}`;
            if (feedMode === 'FOLLOWING') endpoint = `/feed/following?page=${currentPage}&limit=10`;
            if (feedMode === 'BROADCASTS') endpoint = `/broadcasts/inbox?page=${currentPage}&limit=10`;

            const category = activeChip !== 'All' && feedMode === 'FOR_YOU' ? `&category=${encodeURIComponent(activeChip)}` : '';
            const { data } = await api.get(`${endpoint}${category}`);

            const items = data.posts || data.broadcasts?.map(b => ({
                ...b.broadcast.post,
                author: b.broadcast.association,
                isBroadcast: true,
                broadcastId: b.broadcast.id,
                mediaUrls: b.broadcast.mediaUrls,
                mediaType: b.broadcast.mediaType,
                viewed: b.viewed
            })) || [];

            if (items.length < 10) setHasMore(false);
            setPosts(prev => isRefresh ? items : [...prev, ...items]);
        } catch {
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [page, activeChip, feedMode, sessionId]);

    useEffect(() => { loadFeed(true); }, [activeChip, feedMode]);
    useEffect(() => { if (page > 1) loadFeed(); }, [page]);

    // Intersection Observer for active video (Snap Scroll)
    useEffect(() => {
        const obsOptions = { threshold: 0.7 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const postId = entry.target.getAttribute('data-id');
                    setActiveVideoId(postId);

                    // Analytics: Record view if guest or logged in
                    api.post('/analytics/event', {
                        eventType: 'POST_VIEW',
                        postId,
                        sessionId
                    }).catch(() => { });

                    // Broadcast: Mark as viewed
                    const post = posts.find(p => p.id === postId);
                    if (post?.isBroadcast && !post.viewed) {
                        api.put(`/broadcasts/${post.broadcastId}/viewed`).catch(() => { });
                    }
                }
            });
        }, obsOptions);

        const cards = document.querySelectorAll('.feed-card');
        cards.forEach(c => observer.observe(c));
        return () => observer.disconnect();
    }, [posts, sessionId]);

    const handleAction = async (type, post) => {
        if (!user) {
            const msgs = {
                like: 'Log in to like videos and save your favourites',
                save: 'Save this spot to your trip boards',
                follow: 'Follow creators to see more of their content',
                comment: 'Join the conversation on Travelpod'
            };
            setAuthModal({ isOpen: true, message: msgs[type] || 'Join Travelpod to interact' });
            return;
        }

        try {
            if (type === 'like') {
                if (post.isLiked) await api.delete(`/engagement/like/${post.id}`);
                else await api.post(`/engagement/like/${post.id}`);
                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, isLiked: !p.isLiked, likeCount: p.likeCount + (p.isLiked ? -1 : 1) } : p));
            } else if (type === 'save') {
                if (post.isSaved) await api.delete(`/engagement/save/${post.id}`);
                else await api.post(`/engagement/save/${post.id}`);
                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, isSaved: !p.isSaved } : p));
            }
        } catch (err) {
            toast.error('Action failed');
        }
    };

    const toggleMute = (e) => {
        e?.stopPropagation();
        setIsMuted(prev => !prev);
    };

    const renderMedia = (post) => {
        const isActive = activeVideoId === post.id;

        if (!post.isBroadcast) {
            return (
                <div className="feed-video-container" onClick={toggleMute}>
                    <VideoPlayer
                        src={post.videoUrl}
                        poster={post.thumbnailUrl}
                        autoPlay={isActive}
                        muted={isMuted}
                        loop
                    />
                </div>
            );
        }

        // Broadcast Rich Media Grid
        const urls = post.mediaUrls || [];
        const hasVideo = !!post.videoUrl;

        return (
            <div className="feed-broadcast-layer" onClick={toggleMute}>
                {hasVideo && (
                    <div className="broadcast-video-wrap" style={{ height: urls.length > 0 ? '55%' : '100%', width: '100%' }}>
                        <VideoPlayer
                            src={post.videoUrl}
                            poster={post.thumbnailUrl}
                            autoPlay={isActive}
                            muted={isMuted}
                        />
                    </div>
                )}
                {urls.length > 0 && (
                    <div className={`broadcast-rich-media media-grid-${Math.min(urls.length, 4)}`} style={{ height: hasVideo ? '40%' : '60%' }}>
                        {urls.slice(0, 4).map((url, i) => (
                            <img key={i} src={url} alt="" loading="lazy" />
                        ))}
                    </div>
                )}
                {!hasVideo && urls.length === 0 && (
                    <div className="broadcast-text-only">
                        {post.description}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="feed-page" ref={feedRef} onClick={() => { if (isMuted) setIsMuted(false); }}>
            {/* Header Overlays */}
            <nav className="feed-nav">
                <span className="feed-nav-logo">travelpod</span>
                <div className="feed-nav-actions">
                    <button className="feed-nav-btn" onClick={(e) => { e.stopPropagation(); navigate('/explore'); }}><HiOutlineMagnifyingGlass /></button>
                    {user ? (
                        <button className="feed-nav-btn" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${user.profile.handle}`); }}>
                            <img src={user.profile.avatarUrl} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        </button>
                    ) : (
                        <button className="feed-guest-login-btn" onClick={(e) => { e.stopPropagation(); navigate('/auth/login'); }}>Join</button>
                    )}
                </div>
            </nav>

            <div className="feed-header-wrap">
                <div className="feed-tabs">
                    <button className={feedMode === 'FOR_YOU' ? 'feed-tab active' : 'feed-tab'} onClick={(e) => { e.stopPropagation(); setFeedMode('FOR_YOU'); }}>For You</button>
                    <button className={feedMode === 'FOLLOWING' ? 'feed-tab active' : 'feed-tab'} onClick={(e) => { e.stopPropagation(); setFeedMode('FOLLOWING'); }}>Following</button>
                    <button className={feedMode === 'BROADCASTS' ? 'feed-tab active' : 'feed-tab'} onClick={(e) => { e.stopPropagation(); setFeedMode('BROADCASTS'); }}>Broadcasts</button>
                </div>
                <div className="feed-filter-chips">
                    {FILTER_CHIPS.map(c => (
                        <button key={c} className={activeChip === c ? 'feed-chip active' : 'feed-chip'} onClick={(e) => { e.stopPropagation(); setActiveChip(c); }}>{c}</button>
                    ))}
                </div>
            </div>

            {/* Scrollable Container */}
            <div className="feed-container">
                {posts.map((post) => {
                    const author = post.user || post.author;
                    const isVerified = author?.profile?.businessProfile?.verificationStatus === 'APPROVED' || author?.profile?.verificationStatus === 'APPROVED';

                    return (
                        <div key={post.id} className="feed-card" data-id={post.id}>
                            {renderMedia(post)}

                            {/* Right Panel Interaction */}
                            <div className="feed-side-panel">
                                <Link to={`/profile/${author?.profile?.handle}`} className="feed-side-avatar" onClick={e => e.stopPropagation()}>
                                    {author?.profile?.avatarUrl ? (
                                        <img src={author.profile.avatarUrl} alt="" />
                                    ) : (
                                        <div className="avatar-placeholder">{author?.profile?.displayName?.[0]}</div>
                                    )}
                                    {!user && <div className="feed-follow-plus" onClick={() => handleAction('follow', post)}>+</div>}
                                </Link>

                                <button className={`feed-side-btn ${post.isLiked ? 'liked' : ''}`} onClick={(e) => { e.stopPropagation(); handleAction('like', post); }}>
                                    {post.isLiked ? <HiHeart /> : <HiOutlineHeart />}
                                    <span className="feed-side-count">{post.likeCount || 0}</span>
                                </button>

                                <button className="feed-side-btn" onClick={(e) => { e.stopPropagation(); navigate(`/post/${post.id}`); }}>
                                    <HiOutlineChatBubbleOvalLeft />
                                    <span className="feed-side-count">{post.commentCount || 0}</span>
                                </button>

                                <button className={`feed-side-btn ${post.isSaved ? 'saved' : ''}`} onClick={(e) => { e.stopPropagation(); handleAction('save', post); }}>
                                    {post.isSaved ? <HiBookmark /> : <HiOutlineBookmark />}
                                </button>

                                <button className="feed-side-btn" onClick={toggleMute}>
                                    {isMuted ? <HiOutlineSpeakerXMark /> : <HiOutlineSpeakerWave />}
                                </button>

                                <button className="feed-side-btn" onClick={(e) => { e.stopPropagation(); /* handleShare */ }}>
                                    <HiOutlineShare />
                                </button>
                            </div>

                            {/* Info Panel Overlay */}
                            <div className="feed-info-panel">
                                <div className="feed-info-user">
                                    @{author?.profile?.handle}
                                    {isVerified && (
                                        <HiCheckBadge className="feed-verified-badge" title="Verified Business" />
                                    )}
                                </div>
                                <div className="feed-info-title">{post.title}</div>
                                {post.isBroadcast && <div className="feed-info-desc">{post.description}</div>}
                                <div className="feed-info-music">
                                    🎵 <div className="music-scroller">Original sound - {author?.profile?.displayName}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {loading && (
                    <div className="feed-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="feed-spinner" />
                    </div>
                )}
            </div>

            {/* Guest Nudge */}
            {!user && posts.length > 5 && (
                <div className="feed-signup-nudge">
                    Enjoying Travelpod? Join to save your favorite spots
                    <button className="feed-guest-login-btn" onClick={() => navigate('/auth/register')}>Sign Up</button>
                </div>
            )}

            <AuthPromptModal
                isOpen={authModal.isOpen}
                onClose={() => setAuthModal({ isOpen: false, message: '' })}
                message={authModal.message}
            />
        </div>
    );
}
