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
    HiCheckBadge, HiOutlinePaperAirplane, HiOutlineTrash, HiOutlineFolderPlus
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import VideoPlayer from '../../components/video/VideoPlayer';
import ReportModal from '../../components/common/ReportModal';
import EnquiryModal from '../../components/enquiry/EnquiryModal';
import AddToBoardModal from '../../components/boards/AddToBoardModal';
import RecommendModal from '../../components/feed/RecommendModal';
import AuthPromptModal from '../../components/auth/AuthPromptModal';
import PostMoreMenu from '../../components/post/PostMoreMenu';
import './FeedPage.css';

const FILTER_CHIPS = ['All', 'Destinations', 'Hotels & Resorts', 'Safari', 'Beach', 'Adventures'];
const BUSINESS_TYPES = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];

export default function FeedPage() {
    const navigate = useNavigate();
    const { user, isMuted, setIsMuted, unreadCount } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [feedMode, setFeedMode] = useState('FOR_YOU'); // 'FOR_YOU', 'FOLLOWING', 'BROADCASTS', 'BOARDS'
    const [activeChip, setActiveChip] = useState('All');
    const [hasMore, setHasMore] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeVideoId, setActiveVideoId] = useState(null);
    const [showMoreMenu, setShowMoreMenu] = useState(null);
    const [authModal, setAuthModal] = useState({ isOpen: false, message: '' });

    const feedRef = useRef(null);
    const observer = useRef();
    const lastTap = useRef(0);
    const touchStart = useRef(0);
    const [sessionId] = useState(() => localStorage.getItem('travelpod_session_id') || Math.random().toString(36).substring(2, 11));
    const [reportPostId, setReportPostId] = useState(null);
    const [enquiryPost, setEnquiryPost] = useState(null);
    const [saveToBoardPostId, setSaveToBoardPostId] = useState(null);
    const [recommendPost, setRecommendPost] = useState(null);
    const [reposting, setReposting] = useState(null);

    const lastPostElementRef = useCallback(node => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    // Pull to refresh detection
    const handleTouchStart = (e) => {
        if (feedRef.current?.scrollTop === 0) {
            touchStart.current = e.touches[0].clientY;
        }
    };
    const handleTouchEnd = (e) => {
        const touchEnd = e.changedTouches[0].clientY;
        if (touchEnd - touchStart.current > 100 && feedRef.current?.scrollTop === 0) {
            loadFeed(true);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('travelpod_session_id')) {
            localStorage.setItem('travelpod_session_id', sessionId);
        }
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, [sessionId]);

    const loadFeed = useCallback(async (isRefresh = false) => {
        const currentPage = isRefresh ? 1 : page;
        try {
            if (isRefresh) {
                setRefreshing(true);
                setHasMore(true);
            } else {
                setLoading(true);
            }

            let endpoint = `/feed?page=${currentPage}&limit=10&sessionId=${sessionId}`;
            if (feedMode === 'FOLLOWING') endpoint = `/feed/following?page=${currentPage}&limit=10`;
            if (feedMode === 'BROADCASTS') endpoint = `/broadcasts/inbox?page=${currentPage}&limit=10`;
            if (feedMode === 'BOARDS') endpoint = `/boards/feed?page=${currentPage}&limit=10`;

            const category = activeChip !== 'All' && feedMode === 'FOR_YOU' ? `&category=${encodeURIComponent(activeChip)}` : '';
            const { data } = await api.get(`${endpoint}${category}`);

            let items = [];
            if (feedMode === 'BROADCASTS') {
                items = (data.broadcasts || []).map(b => ({
                    ...(b.post || {}),
                    author: b.sender,
                    isBroadcast: true,
                    broadcastId: b.id,
                    mediaUrls: b.mediaUrls || [],
                    mediaType: b.mediaType || 'TEXT',
                    viewed: b.viewed
                }));
            } else if (feedMode === 'BOARDS') {
                items = (data.boards || []).map(b => ({ ...b, isBoard: true }));
            } else {
                items = data.posts || [];
            }

            if (items.length < 10) setHasMore(false);
            setPosts(prev => isRefresh ? items : [...prev, ...items]);
        } catch {
            setHasMore(false);
            toast.error('Failed to load feed');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [page, activeChip, feedMode, sessionId, loading]);

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

    const handleShare = (post) => {
        const url = `${window.location.origin}/post/${post.id}`;
        navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
        setShowMoreMenu(null);
    };

    const handleDownload = (post) => {
        if (!post.videoUrl) return;

        // Try direct browser download if possible
        const link = document.createElement('a');
        link.href = post.videoUrl;
        link.setAttribute('download', `travelpod-${post.id}.mp4`);
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success('Download started!');
        setShowMoreMenu(null);
    };

    const handleRecommend = (post) => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Log in to recommend posts' });
            return;
        }
        setRecommendPost(post);
        setShowMoreMenu(null);
    };

    const handleRepost = async (post) => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Log in to add to your feed' });
            return;
        }
        setReposting(post.id);
        try {
            await api.post(`/posts/${post.id}/repost`);
            toast.success('Added to your feed!');
            setShowMoreMenu(null);
        } catch (err) {
            toast.error('Failed to repost');
        } finally {
            setReposting(null);
        }
    };

    const handleAddToBoard = (postId) => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Log in to save to trip boards' });
            return;
        }
        setSaveToBoardPostId(postId);
        setShowMoreMenu(null);
    };

    const handlePostClick = (e, post) => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        if (now - lastTap.current < DOUBLE_TAP_DELAY) {
            // Double tap detected
            if (!post.isLiked) {
                handleAction('like', post);
                // Visual feedback (optional but good for "IG meets X")
                const heart = document.createElement('div');
                heart.className = 'double-tap-heart';
                heart.innerHTML = '❤️';
                heart.style.position = 'absolute';
                heart.style.top = '50%';
                heart.style.left = '50%';
                heart.style.transform = 'translate(-50%, -50%) scale(0)';
                heart.style.fontSize = '80px';
                heart.style.zIndex = '1000';
                heart.style.pointerEvents = 'none';
                heart.style.animation = 'heart-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
                e.currentTarget.appendChild(heart);
                setTimeout(() => heart.remove(), 700);
            }
        } else {
            // Single tap: toggle mute
            toggleMute(e);
        }
        lastTap.current = now;
    };

    const toggleMute = (e) => {
        e?.stopPropagation();
        setIsMuted(prev => !prev);
    };

    const renderMedia = (post) => {
        const isActive = activeVideoId === post.id;
        const hasVideo = !!post.videoUrl;
        const mediaUrls = post.mediaUrls || [];

        // CASE 1: Text-Only Post (X-Style)
        if (!hasVideo && mediaUrls.length === 0) {
            return (
                <div className="feed-text-post-container" onClick={(e) => handlePostClick(e, post)}>
                    <div className="text-post-card glass-card animate-scaleIn">
                        <div className="text-post-header">
                            <div className="text-post-avatar">
                                <img src={post.author?.profile?.avatarUrl} alt="" />
                            </div>
                            <div className="text-post-user-info">
                                <span className="text-post-name">{post.author?.profile?.displayName}</span>
                                <span className="text-post-handle">@{post.author?.profile?.handle}</span>
                            </div>
                        </div>
                        <div className="text-post-content">
                            <h3 className="text-post-title">{post.title}</h3>
                            <p className="text-post-body">{post.description}</p>
                        </div>
                        {post.postTags?.length > 0 && (
                            <div className="text-post-tags">
                                {post.postTags.map(pt => (
                                    <span key={pt.id} className="text-post-tag">#{pt.tag.name}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // CASE 2: Standard Post (Video)
        if (!post.isBroadcast) {
            return (
                <div className="feed-video-container" onClick={(e) => handlePostClick(e, post)}>
                    <VideoPlayer
                        src={post.videoUrl}
                        poster={post.thumbnailUrl}
                        autoPlay={isActive}
                        muted={isMuted}
                        loop
                        onClick={(e) => handlePostClick(e, post)}
                    />
                </div>
            );
        }

        // CASE 3: Broadcast (Mixed Media)
        return (
            <div className="feed-broadcast-layer" onClick={(e) => handlePostClick(e, post)}>
                {hasVideo && (
                    <div className="broadcast-video-wrap" style={{ height: mediaUrls.length > 0 ? '55%' : '100%', width: '100%' }}>
                        <VideoPlayer
                            src={post.videoUrl}
                            poster={post.thumbnailUrl}
                            autoPlay={isActive}
                            muted={isMuted}
                        />
                    </div>
                )}
                {mediaUrls.length > 0 && (
                    <div className={`broadcast-rich-media media-grid-${Math.min(mediaUrls.length, 4)}`} style={{ height: hasVideo ? '40%' : '60%' }}>
                        {mediaUrls.slice(0, 4).map((url, i) => (
                            <img key={i} src={url} alt="" loading="lazy" />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderActions = (post) => {
        const author = post.user || post.author;
        const isBusiness = author?.profile?.accountType === 'BUSINESS' || author?.profile?.businessProfile;

        return (
            <div className="feed-actions-linear-integrated">
                <div className="actions-left">
                    <button
                        className={`action-btn-main ${post.isLiked ? 'liked' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleAction('like', post); }}
                    >
                        {post.isLiked ? <HiHeart /> : <HiOutlineHeart />}
                    </button>

                    <button
                        className="action-btn-main"
                        onClick={(e) => { e.stopPropagation(); navigate(`/post/${post.id}`); }}
                    >
                        <HiOutlineChatBubbleOvalLeft />
                    </button>

                    <button
                        className="action-btn-main"
                        onClick={(e) => { e.stopPropagation(); handleShare(post); }}
                    >
                        <HiOutlinePaperAirplane style={{ transform: 'rotate(-20deg) translateY(-2px)' }} />
                    </button>

                    {isBusiness && (
                        <button
                            className="enquire-pill-btn"
                            onClick={(e) => { e.stopPropagation(); setEnquiryPost(post); }}
                        >
                            <HiOutlineStar />
                            <span>Enquire</span>
                        </button>
                    )}
                </div>

                <div className="actions-right">
                    <button
                        className={`action-btn-main ${post.isSaved ? 'saved' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleAddToBoard(post.id); }}
                    >
                        {post.isSaved ? <HiBookmark /> : <HiOutlineBookmark />}
                    </button>

                    <PostMoreMenu
                        post={post}
                        isOwner={user?.id === (post.user?.id || post.author?.id)}
                        onAction={(type) => {
                            if (type === 'repost') handleRepost(post);
                            else if (type === 'recommend') handleRecommend(post);
                            else if (type === 'board') handleAddToBoard(post.id);
                            else if (type === 'download') handleDownload(post);
                            else if (type === 'report') setReportPostId(post.id);
                            else if (type === 'delete') {
                                if (window.confirm('Are you sure you want to delete this post?')) {
                                    api.delete(`/posts/${post.id}`).then(() => {
                                        setPosts(prev => prev.filter(p => p.id !== post.id));
                                        toast.success('Post deleted');
                                    }).catch(err => toast.error('Failed to delete'));
                                }
                            }
                        }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div
            className="feed-page"
            ref={feedRef}
            onClick={() => { if (isMuted) setIsMuted(false); }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {refreshing && (
                <div className="pull-to-refresh-indicator">
                    <HiOutlineArrowPath className="animate-spin" />
                </div>
            )}
            {/* Header Restored to Top */}
            <nav className="feed-top-nav">
                <div className="feed-nav-upper">
                    <span className="feed-nav-logo">travelpod</span>
                    <div className="feed-nav-icons">
                        <button className="feed-nav-icon" onClick={() => navigate('/upload')} title="Post">
                            <HiOutlinePlusCircle />
                        </button>
                        <button className="feed-nav-icon" onClick={() => navigate('/explore')} title="Search">
                            <HiOutlineMagnifyingGlass />
                        </button>
                        <button className="feed-nav-icon inbox-btn" onClick={() => navigate('/messages')} title="Messages">
                            <HiOutlineEnvelope />
                            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                        </button>
                        {user ? (
                            <button className="feed-nav-icon profile-btn" onClick={() => navigate(`/profile/${user.profile.handle}`)}>
                                <img src={user.profile.avatarUrl} alt="" />
                            </button>
                        ) : (
                            <button className="feed-nav-icon" onClick={() => navigate('/auth/login')}><HiOutlineUser /></button>
                        )}
                    </div>
                </div>

                <div className="feed-tabs-container">
                    <div className="feed-tabs">
                        <button className={feedMode === 'FOR_YOU' ? 'feed-tab active' : 'feed-tab'} onClick={() => setFeedMode('FOR_YOU')}>Discover</button>
                        <button className={feedMode === 'FOLLOWING' ? 'feed-tab active' : 'feed-tab'} onClick={() => {
                            if (!user) setAuthModal({ isOpen: true, message: 'Follow creators to see their latest posts here' });
                            else setFeedMode('FOLLOWING');
                        }}>Following</button>
                        <button className={feedMode === 'BROADCASTS' ? 'feed-tab active' : 'feed-tab'} onClick={() => {
                            if (!user) setAuthModal({ isOpen: true, message: 'Log in to see exclusive travel broadcasts' });
                            else setFeedMode('BROADCASTS');
                        }}>Broadcasts</button>
                        <button className={feedMode === 'BOARDS' ? 'feed-tab active' : 'feed-tab'} onClick={() => {
                            if (!user) setAuthModal({ isOpen: true, message: 'Save videos to your trip boards' });
                            else setFeedMode('BOARDS');
                        }}>Trip Boards</button>
                    </div>
                </div>

                <div className="feed-filter-chips">
                    {FILTER_CHIPS.map(c => (
                        <button key={c} className={activeChip === c ? 'feed-chip active' : 'feed-chip'} onClick={() => setActiveChip(c)}>{c}</button>
                    ))}
                </div>
            </nav>

            {/* Scrollable Container */}
            <div className="feed-container">
                {posts.map((post, index) => {
                    const author = post.user || post.author;
                    const isVerified = author?.profile?.businessProfile?.verificationStatus === 'APPROVED' || author?.profile?.verificationStatus === 'APPROVED';
                    const isLast = index === posts.length - 1;

                    return (
                        <div
                            key={post.id}
                            ref={isLast ? lastPostElementRef : null}
                            className="feed-card-linear"
                            data-id={post.id}
                        >
                            {/* Card Header: Author Info */}
                            <div className="feed-card-header">
                                <Link to={`/profile/${author?.profile?.handle}`} className="feed-card-author">
                                    <div className="feed-card-avatar">
                                        {author?.profile?.avatarUrl ? (
                                            <img src={author.profile.avatarUrl} alt="" />
                                        ) : (
                                            <HiOutlineUser />
                                        )}
                                    </div>
                                    <div className="feed-card-author-info">
                                        <div className="feed-card-name">
                                            {author?.profile?.displayName}
                                            {isVerified && <HiCheckBadge className="verified-badge-inline" />}
                                        </div>
                                        <div className="feed-card-handle">@{author?.profile?.handle}</div>
                                    </div>
                                </Link>
                                <PostMoreMenu
                                    post={post}
                                    isOwner={user?.id === (post.user?.id || post.author?.id)}
                                    onAction={(type) => {
                                        if (type === 'repost') handleRepost(post);
                                        else if (type === 'recommend') handleRecommend(post);
                                        else if (type === 'board') handleAddToBoard(post.id);
                                        else if (type === 'download') handleDownload(post);
                                        else if (type === 'report') setReportPostId(post.id);
                                        else if (type === 'delete') {
                                            if (window.confirm('Are you sure you want to delete this post?')) {
                                                api.delete(`/posts/${post.id}`).then(() => {
                                                    setPosts(prev => prev.filter(p => p.id !== post.id));
                                                    toast.success('Post deleted');
                                                }).catch(err => toast.error('Failed to delete'));
                                            }
                                        }
                                    }}
                                />
                            </div>

                            {/* Media Section */}
                            <div className="feed-card-media">
                                {renderMedia(post)}
                                <button className="feed-mute-corner" onClick={toggleMute}>
                                    {isMuted ? <HiOutlineSpeakerXMark /> : <HiOutlineSpeakerWave />}
                                </button>
                            </div>

                            {/* Engagement Bar */}
                            {renderActions(post)}

                            {/* Info Panel (Below Actions) */}
                            <div className="feed-card-info">
                                <div className="feed-card-title">{post.title}</div>
                                {post.description && <div className="feed-card-desc">{post.description}</div>}
                                <div className="feed-card-music">
                                    🎵 Original sound - {author?.profile?.displayName}
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

            {reportPostId && (
                <ReportModal
                    entityId={reportPostId}
                    entityType="POST"
                    onClose={() => setReportPostId(null)}
                />
            )}

            {enquiryPost && (
                <EnquiryModal
                    isOpen={!!enquiryPost}
                    onClose={() => setEnquiryPost(null)}
                    businessId={enquiryPost.userId}
                    businessName={enquiryPost.user?.profile?.displayName || 'Business'}
                />
            )}

            {saveToBoardPostId && (
                <AddToBoardModal
                    postId={saveToBoardPostId}
                    onClose={() => setSaveToBoardPostId(null)}
                />
            )}

            {recommendPost && (
                <RecommendModal
                    post={recommendPost}
                    onClose={() => setRecommendPost(null)}
                />
            )}

            <AuthPromptModal
                isOpen={authModal.isOpen}
                onClose={() => setAuthModal({ isOpen: false, message: '' })}
                message={authModal.message}
            />
        </div>
    );
}
