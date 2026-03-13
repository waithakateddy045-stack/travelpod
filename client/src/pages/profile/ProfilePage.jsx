import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    HiOutlineGlobeAlt, HiOutlineMapPin, HiOutlineStar,
    HiOutlineCheckBadge, HiOutlineChatBubbleLeft,
    HiOutlinePlayCircle, HiOutlineHeart, HiOutlineUser,
    HiOutlineArrowLeft, HiOutlineCog6Tooth,
    HiOutlineChartBar, HiOutlineEnvelope,
    HiOutlineRectangleStack, HiOutlineFlag, HiCheckBadge,
    HiOutlineChartPie, HiOutlinePencilSquare, HiOutlineTrash,
    HiOutlineUserGroup, HiOutlineTrophy, HiOutlineSparkles,
    HiOutlineArrowLeftOnRectangle, HiOutlinePlus
} from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useFeatureFlag from '../../hooks/useFeatureFlag';
import api from '../../services/api';
import EnquiryModal from '../../components/enquiry/EnquiryModal';
import VerificationDetailsModal from '../../components/verification/VerificationDetailsModal';
import VerificationApplicationModal from '../../components/verification/VerificationApplicationModal';
import FollowListModal from '../../components/profile/FollowListModal';
import AuthPromptModal from '../../components/auth/AuthPromptModal';
import ReportModal from '../../components/common/ReportModal';
import PostMoreMenu from '../../components/post/PostMoreMenu';
import CollaborationRequestModal from '../../components/collaborations/CollaborationRequestModal';
import './ProfilePage.css';

const BUSINESS_TYPES = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];

export default function ProfilePage() {
    const { handle } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const [savedPosts, setSavedPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'boards' | 'saved'
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
    const [isVerificationAppModalOpen, setIsVerificationAppModalOpen] = useState(false);
    const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
    const [badges, setBadges] = useState([]);
    const [boards, setBoards] = useState([]);
    const [followModalType, setFollowModalType] = useState(null); // 'followers' | 'following' | null
    const [authModal, setAuthModal] = useState({ isOpen: false, message: '' });
    const [isReportingUser, setIsReportingUser] = useState(false);
    const [reportPostId, setReportPostId] = useState(null);
    const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);

    // Pagination states
    const [postsPage, setPostsPage] = useState(1);
    const [postsHasMore, setPostsHasMore] = useState(true);
    const [loadingMorePosts, setLoadingMorePosts] = useState(false);

    const [savedPage, setSavedPage] = useState(1);
    const [savedHasMore, setSavedHasMore] = useState(true);
    const [loadingMoreSaved, setLoadingMoreSaved] = useState(false);

    const [boardsPage, setBoardsPage] = useState(1);
    const [boardsHasMore, setBoardsHasMore] = useState(true);
    const [loadingMoreBoards, setLoadingMoreBoards] = useState(false);

    const observer = useRef();
    const lastElementRef = useCallback(node => {
        if (loading || loadingMorePosts || loadingMoreSaved || loadingMoreBoards) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                if (activeTab === 'posts' && postsHasMore && !loadingMorePosts) setPostsPage(prev => prev + 1);
                if (activeTab === 'saved' && savedHasMore && !loadingMoreSaved) setSavedPage(prev => prev + 1);
                if (activeTab === 'boards' && boardsHasMore && !loadingMoreBoards) setBoardsPage(prev => prev + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, loadingMorePosts, loadingMoreSaved, loadingMoreBoards, activeTab, postsHasMore, savedHasMore, boardsHasMore]);

    const { enabled: gamificationEnabled } = useFeatureFlag('gamification');
    const { enabled: collabEnabled } = useFeatureFlag('collaborations');

    const isOwn = user && profile && user.id === profile.userId;
    const isBusiness = profile && BUSINESS_TYPES.includes(profile.accountType);
    const isVerified = profile?.businessProfile?.verificationStatus === 'APPROVED' || profile?.verificationStatus === 'APPROVED';

    const loadProfile = useCallback(async () => {
        try {
            const { data } = await api.get(`/profile/${handle}`);
            setProfile(data.profile);
        } catch (err) {
            toast.error('Profile not found');
        }
    }, [handle]);

    const loadPosts = useCallback(async (isRefresh = false) => {
        const page = isRefresh ? 1 : postsPage;
        try {
            if (isRefresh) {
                setLoading(true);
                setPostsHasMore(true);
            } else {
                setLoadingMorePosts(true);
            }

            const { data } = await api.get(`/profile/${handle}/posts?page=${page}&limit=12`);
            const items = data.posts || [];

            if (items.length < 12) setPostsHasMore(false);
            setPosts(prev => isRefresh ? items : [...prev, ...items]);
        } catch {
            setPostsHasMore(false);
        } finally {
            setLoading(false);
            setLoadingMorePosts(false);
        }
    }, [handle, postsPage]);

    const loadSavedPosts = useCallback(async (isRefresh = false) => {
        if (!isOwn) return;
        const page = isRefresh ? 1 : savedPage;
        try {
            if (isRefresh) {
                setLoading(true);
                setSavedHasMore(true);
            } else {
                setLoadingMoreSaved(true);
            }

            const { data } = await api.get(`/engagement/saves?page=${page}&limit=12`);
            const items = data.posts || [];

            if (items.length < 12) setSavedHasMore(false);
            setSavedPosts(prev => isRefresh ? items : [...prev, ...items]);
        } catch {
            setSavedHasMore(false);
        } finally {
            setLoading(false);
            setLoadingMoreSaved(false);
        }
    }, [isOwn, savedPage]);

    const loadBadges = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await api.get('/badges');
            setBadges(data.badges || []);
        } catch { }
    }, [user]);

    const loadBoards = useCallback(async (isRefresh = false) => {
        const page = isRefresh ? 1 : boardsPage;
        try {
            if (isRefresh) {
                setLoading(true);
                setBoardsHasMore(true);
            } else {
                setLoadingMoreBoards(true);
            }

            const endpoint = isOwn ? '/boards/user/me' : `/boards/user/${handle}`;
            const { data } = await api.get(`${endpoint}?page=${page}&limit=12`);
            const items = data.boards || [];

            if (items.length < 12) setBoardsHasMore(false);
            setBoards(prev => isRefresh ? items : [...prev, ...items]);
        } catch {
            setBoardsHasMore(false);
        } finally {
            setLoading(false);
            setLoadingMoreBoards(false);
        }
    }, [handle, isOwn, boardsPage]);

    useEffect(() => {
        loadProfile();
        loadPosts(true);
        loadSavedPosts(true);
        loadBoards(true);
        loadBadges();
    }, [handle, isOwn]);

    useEffect(() => { if (postsPage > 1) loadPosts(); }, [postsPage]);
    useEffect(() => { if (savedPage > 1) loadSavedPosts(); }, [savedPage]);
    useEffect(() => { if (boardsPage > 1) loadBoards(); }, [boardsPage]);

    const handleFollow = async () => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Follow creators and never miss their content' });
            return;
        }
        setFollowLoading(true);
        try {
            if (profile.isFollowing) {
                await api.delete(`/follow/${profile.userId}`);
                setProfile(p => ({ ...p, isFollowing: false, followerCount: p.followerCount - 1 }));
            } else {
                await api.post(`/follow/${profile.userId}`);
                setProfile(p => ({ ...p, isFollowing: true, followerCount: p.followerCount + 1 }));
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed');
        } finally {
            setFollowLoading(false);
        }
    };

    const handleStartMessage = async () => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Message creators and friends' });
            return;
        }
        try {
            await api.post('/messages', {
                recipientId: profile.userId,
                content: `👋 Hi ${profile.displayName}, I'd like to connect!`
            });
            navigate('/messages');
        } catch (err) {
            toast.error('Failed to start conversation');
        }
    };

    if (loading) {
        return (
            <div className="profile-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 40, height: 40, border: '3px solid var(--border-primary)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="profile-page">
                <div className="profile-container">
                    <div className="empty-state">
                        <HiOutlineUser />
                        <p>Profile not found</p>
                        <Link to="/feed" style={{ color: 'var(--color-primary-light)', fontSize: 'var(--text-sm)' }}>← Back to feed</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="profile-container">
                {/* Back nav */}
                <Link to="/feed" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', textDecoration: 'none' }}>
                    <HiOutlineArrowLeft /> Back
                </Link>

                {/* Header Card */}
                <div className="profile-header">
                    <div className="profile-avatar">
                        {profile.avatarUrl ? (
                            <img src={profile.avatarUrl} alt={profile.displayName} />
                        ) : (
                            <HiOutlineUser />
                        )}
                    </div>
                    <div className="profile-info">
                        <h1 className="profile-name">
                            {profile.displayName}
                            {profile.isVerified && (
                                <HiCheckBadge
                                    className="verified-badge-icon interactive"
                                    onClick={() => setIsVerificationModalOpen(true)}
                                    title="Verified Business - Click for details"
                                />
                            )}
                        </h1>
                        <p className="profile-handle">@{profile.handle}</p>

                        <div className="profile-stats">
                            <div className="stat-item" onClick={() => setActiveTab('posts')}>
                                <span className="stat-value">{profile.postCount || 0}</span>
                                <span className="stat-label">Posts</span>
                            </div>
                            <div className="stat-item" onClick={() => setActiveTab('followers')}>
                                <span className="stat-value">{profile.followerCount || 0}</span>
                                <span className="stat-label">Followers</span>
                            </div>
                            <div className="stat-item" onClick={() => setActiveTab('following')}>
                                <span className="stat-value">{profile.followingCount || 0}</span>
                                <span className="stat-label">Following</span>
                            </div>
                            {profile.verifiedReviewCount > 0 && (
                                <div className="stat-item">
                                    <span className="stat-value">{profile.verifiedReviewCount}</span>
                                    <span className="stat-label">Reviews</span>
                                </div>
                            )}

                            {/* Dropdown rendered relative to profile-stats */}
                            <FollowListModal
                                isOpen={!!followModalType}
                                onClose={() => setFollowModalType(null)}
                                username={profile.handle}
                                type={followModalType}
                                title={followModalType === 'followers' ? 'Followers' : 'Following'}
                                asDropdown={true}
                            />
                        </div>

                        {/* Tags */}
                        {profile.personalityTags?.length > 0 && (
                            <div className="profile-tags">
                                {profile.personalityTags.map(tag => (
                                    <span key={tag} className="profile-tag">{tag}</span>
                                ))}
                            </div>
                        )}
                        {/* Community Badges */}
                        {isOwn && badges.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
                                {badges.map(b => (
                                    <span key={b.id} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '4px 10px', borderRadius: 'var(--radius-full)',
                                        background: 'var(--gradient-brand)', color: 'white',
                                        fontSize: 'var(--text-xs)', fontWeight: 700,
                                        letterSpacing: '0.03em',
                                    }}>
                                        🏅 {b.badgeType?.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Action buttons */}
                        {isOwn ? (
                            <div className="profile-actions">
                                <Link to="/upload" className="profile-action-btn primary icon-only-rounded" title="Create Post">
                                    <HiOutlinePlus />
                                </Link>
                                <Link to="/settings" className="profile-action-btn secondary">
                                    <HiOutlineCog6Tooth /> Settings
                                </Link>
                                {isBusiness && (
                                    <Link to="/analytics" className="profile-action-btn secondary">
                                        <HiOutlineChartBar /> Analytics
                                    </Link>
                                )}
                                {isBusiness && profile.businessProfile?.verificationStatus === 'PENDING' && (
                                    <div className="verification-status-pill">
                                        ⏳ Verification Pending
                                    </div>
                                )}
                                {isBusiness && profile.businessProfile?.verificationStatus === 'APPROVED' && (
                                    <button
                                        className="profile-action-btn accent pulse-broadcast"
                                        onClick={() => navigate('/upload?type=broadcast')}
                                    >
                                        <HiOutlineSparkles /> Create Broadcast
                                    </button>
                                )}
                                {isBusiness && !['APPROVED', 'PENDING'].includes(profile.businessProfile?.verificationStatus) && (
                                    <button
                                        className="profile-action-btn accent"
                                        onClick={() => setIsVerificationAppModalOpen(true)}
                                    >
                                        <HiOutlineCheckBadge /> Get Verified
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="profile-actions">
                                <button
                                    className={`profile-action-btn ${profile.isFollowing ? 'secondary' : 'primary'}`}
                                    onClick={handleFollow}
                                    disabled={followLoading}
                                >
                                    {profile.isFollowing ? 'Following' : 'Follow'}
                                </button>
                                {isBusiness && (
                                    <button
                                        className="profile-action-btn accent"
                                        onClick={() => setIsEnquiryModalOpen(true)}
                                    >
                                        <HiOutlineChatBubbleLeft /> Enquire Now
                                    </button>
                                )}
                                {collabEnabled && (
                                    <button
                                        className="profile-action-btn secondary"
                                        onClick={() => setIsCollabModalOpen(true)}
                                        title="Collaborate"
                                    >
                                        <HiOutlineUserGroup /> Collab
                                    </button>
                                )}
                                <button className="profile-action-btn icon-only" onClick={handleStartMessage} title="Message">
                                    <HiOutlineEnvelope />
                                </button>
                                <button className="profile-action-btn icon-only danger" onClick={() => setIsReportingUser(true)} title="Report">
                                    <HiOutlineFlag />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Business Info Card */}
                {isBusiness && (profile.businessProfile || profile.bio) && (
                    <div className="business-info">
                        <h3>{isBusiness ? 'Business Info' : 'About'}</h3>
                        {profile.businessProfile?.starRating && (
                            <div className="star-rating" style={{ marginBottom: 'var(--space-4)' }}>
                                <HiOutlineStar style={{ fill: '#f5a623' }} />
                                {Number(profile.businessProfile.starRating).toFixed(1)}
                                <span className="count">({profile.businessProfile.verifiedReviewCount} verified reviews)</span>
                            </div>
                        )}
                        {profile.businessProfile?.country && (
                            <div className="business-detail">
                                <HiOutlineMapPin /> {profile.businessProfile.country}
                            </div>
                        )}
                        {(profile.bio || profile.businessProfile?.description) && (
                            <div className="business-detail" style={{ alignItems: 'flex-start' }}>
                                <span>{profile.bio || profile.businessProfile?.description}</span>
                            </div>
                        )}
                        {profile.businessProfile?.websiteUrl && (
                            <div className="business-detail">
                                <HiOutlineGlobeAlt />
                                <a href={profile.businessProfile.websiteUrl} target="_blank" rel="noopener noreferrer"
                                    style={{ color: 'var(--color-primary-light)' }}>
                                    {profile.businessProfile.websiteUrl.replace(/^https?:\/\//, '')}
                                </a>
                            </div>
                        )}
                    </div>
                )}

                <div className="profile-tabs-nav">
                    <button
                        className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('posts')}
                    >
                        <HiOutlinePlayCircle />
                        <span>Posts</span>
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'boards' ? 'active' : ''}`}
                        onClick={() => setActiveTab('boards')}
                    >
                        <HiOutlineRectangleStack />
                        <span>Boards</span>
                    </button>
                    {isOwn && (
                        <button
                            className={`tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
                            onClick={() => setActiveTab('saved')}
                        >
                            <HiOutlineHeart />
                            <span>Saved</span>
                        </button>
                    )}
                    {gamificationEnabled && badges.length > 0 && (
                        <button
                            className={`tab-btn ${activeTab === 'achievements' ? 'active' : ''}`}
                            onClick={() => setActiveTab('achievements')}
                        >
                            <HiOutlineTrophy />
                            <span>Achievements</span>
                        </button>
                    )}
                </div>

                {/* Tab Content */}
                {(activeTab === 'followers' || activeTab === 'following') && (
                    <div className="tab-content-follow">
                        <FollowListModal
                            inline={true}
                            username={profile.handle}
                            type={activeTab}
                            title={activeTab === 'followers' ? 'Followers' : 'Following'}
                            isOpen={true} // Always "open" when in tab
                        />
                    </div>
                )}

                {/* Posts/Saved Grid */}
                {(activeTab === 'posts' || activeTab === 'saved') && (
                    <div className="post-grid">
                        {(activeTab === 'posts' ? posts : savedPosts).length > 0 ? (
                            (activeTab === 'posts' ? posts : savedPosts).map((post, index, array) => (
                                <Link
                                    key={post.id}
                                    to={`/post/${post.id}`}
                                    className={`post-grid-item ${!post.thumbnailUrl && !post.videoUrl ? 'text-only' : ''}`}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                    ref={index === array.length - 1 ? lastElementRef : null}
                                >
                                    {post.thumbnailUrl ? (
                                        <img src={post.thumbnailUrl} alt={post.title} />
                                    ) : post.videoUrl ? (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                                            <HiOutlinePlayCircle style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.5)' }} />
                                        </div>
                                    ) : post.mediaUrls && post.mediaUrls.length > 0 ? (
                                        <img src={post.mediaUrls[0]} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div className="text-preview" style={{ padding: '8px', width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(20,20,20,1) 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'inherit', boxSizing: 'border-box' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0 8px 0' }}>
                                                {profile?.avatarUrl ? (
                                                    <img src={profile.avatarUrl} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                                                ) : (
                                                    <HiOutlineUser style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#333', padding: '2px' }} />
                                                )}
                                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {profile?.displayName}
                                                        {isVerified && <HiCheckBadge style={{ color: '#00d2ff', marginLeft: '2px', fontSize: '0.65rem', verticalAlign: 'middle' }} />}
                                                    </span>
                                                    <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@{profile?.handle}</span>
                                                </div>
                                            </div>
                                            {post.title && <h4 style={{ fontSize: '0.8rem', color: '#fff', margin: '0 0 4px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.title}</h4>}
                                            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', display: '-webkit-box', WebkitLineClamp: post.title ? 2 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0, lineHeight: '1.3' }}>
                                                {post.textContent?.substring(0, 100) || post.description || "Text Post"}
                                            </p>
                                        </div>
                                    )}
                                    <div className="post-grid-overlay">
                                        <div className="overlay-stats">
                                            <span><HiOutlineHeart /> {post.likeCount}</span>
                                            <span><HiOutlinePlayCircle /> {post.viewCount}</span>
                                        </div>
                                        <div className="overlay-actions" onClick={e => e.preventDefault()}>
                                            <PostMoreMenu
                                                post={post}
                                                isOwner={isOwn}
                                                onAction={(type) => {
                                                    if (type === 'repost') {
                                                        api.post(`/posts/${post.id}/repost`).then(() => toast.success('Added to feed'));
                                                    } else if (type === 'recommend') {
                                                        // Handle recommend - maybe a generic modal or navigate?
                                                        toast.success('Recommend logic here');
                                                    } else if (type === 'board') {
                                                        // Trigger board modal
                                                    } else if (type === 'report') {
                                                        setReportPostId(post.id);
                                                    } else if (type === 'delete') {
                                                        if (window.confirm('Delete this post?')) {
                                                            api.delete(`/posts/${post.id}`).then(() => {
                                                                setPosts(prev => prev.filter(p => p.id !== post.id));
                                                                toast.success('Post deleted');
                                                            });
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                                {activeTab === 'posts' ? <HiOutlinePlayCircle /> : <HiOutlineHeart />}
                                <p>
                                    {activeTab === 'posts'
                                        ? (isOwn ? "You haven't posted yet" : 'No posts yet')
                                        : "You haven't saved any posts yet"
                                    }
                                </p>
                            </div>
                        )}
                        {(loadingMorePosts || loadingMoreSaved) && (
                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '20px' }}>
                                <div style={{ width: 24, height: 24, border: '2px solid var(--border-primary)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            </div>
                        )}
                    </div>
                )}

                {/* Achievements Grid */}
                {activeTab === 'achievements' && gamificationEnabled && (
                    <div className="post-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                        {badges.length > 0 ? badges.map(badge => (
                            <div key={badge.id} style={{
                                padding: 'var(--space-4)',
                                background: 'var(--bg-elevated)',
                                border: '1.5px solid var(--border-primary)',
                                borderRadius: 'var(--radius-lg)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)'
                            }}>
                                <div style={{ fontSize: '2rem' }}>{badge.icon || '🏆'}</div>
                                <div>
                                    <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 2 }}>{badge.name}</h4>
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{badge.description}</p>
                                    <span style={{
                                        fontSize: '0.6rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        padding: '1px 6px',
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-secondary)',
                                        borderRadius: 'var(--radius-full)'
                                    }}>
                                        {badge.tier}
                                    </span>
                                </div>
                            </div>
                        )) : (
                            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                                <HiOutlineTrophy />
                                <p>No achievements unlocked yet</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Boards Grid */}
                {activeTab === 'boards' && (
                    <div className="post-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                        {boards.length > 0 ? boards.map((board, index, array) => (
                            <Link
                                key={board.id}
                                to={`/boards/${board.id}`}
                                className="post-grid-item"
                                style={{ textDecoration: 'none', height: 200 }}
                                ref={index === array.length - 1 ? lastElementRef : null}
                            >
                                {board.coverImage ? (
                                    <img src={board.coverImage} alt={board.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', gap: 8 }}>
                                        <HiOutlineRectangleStack style={{ fontSize: '2rem', color: 'var(--text-tertiary)' }} />
                                    </div>
                                )}
                                <div className="post-grid-overlay" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: '12px', background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>{board.title}</span>
                                        {board.destination && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)' }}>📍 {board.destination}</span>}
                                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>{board.videoCount || 0} videos · {board.likeCount || 0} likes</span>
                                    </div>
                                    {isOwn && (
                                        <div onClick={e => e.preventDefault()}>
                                            <button
                                                className="action-btn-main"
                                                style={{ color: '#fff', fontSize: '1.2rem' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm('Delete this board?')) {
                                                        api.delete(`/boards/${board.id}`).then(() => {
                                                            setBoards(prev => prev.filter(b => b.id !== board.id));
                                                            toast.success('Board deleted');
                                                        });
                                                    }
                                                }}
                                            >
                                                <HiOutlineTrash />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </Link>
                        )) : (
                            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                                <HiOutlineRectangleStack />
                                <p>{isOwn ? "You haven't created any boards yet" : 'No boards yet'}</p>
                            </div>
                        )}
                        {loadingMoreBoards && (
                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '20px' }}>
                                <div style={{ width: 24, height: 24, border: '2px solid var(--border-primary)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Profile Modal */}
            {isEditModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Edit Profile</h2>
                            <button className="action-btn-main" onClick={() => setIsEditModalOpen(false)}>✕</button>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>Make changes to your public profile.</p>

                        <div className="form-field">
                            <label className="form-label">Display Name</label>
                            <input className="form-input" defaultValue={profile.displayName} />
                        </div>

                        {isBusiness && profile.businessProfile && (
                            <div className="form-field">
                                <label className="form-label">Description</label>
                                <textarea className="form-input" defaultValue={profile.businessProfile.description} />
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                            <button className="onboarding-btn secondary" onClick={() => setIsEditModalOpen(false)} style={{ flex: 1 }}>Cancel</button>
                            <button className="onboarding-btn primary" onClick={() => { setIsEditModalOpen(false); toast.success('Profile updated'); }} style={{ flex: 1 }}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Profile Modal Placeholder */}
            {isEditModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2>Edit Profile</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>Make changes to your public profile.</p>

                        <div className="form-field">
                            <label className="form-label">Display Name</label>
                            <input className="form-input" defaultValue={profile.displayName} />
                        </div>

                        {isBusiness && profile.businessProfile && (
                            <div className="form-field">
                                <label className="form-label">Description</label>
                                <textarea className="form-input" defaultValue={profile.businessProfile.description} />
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                            <button className="onboarding-btn secondary" onClick={() => setIsEditModalOpen(false)} style={{ flex: 1 }}>Cancel</button>
                            <button className="onboarding-btn primary" onClick={() => { setIsEditModalOpen(false); toast.success('Profile updated'); }} style={{ flex: 1 }}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Verification Details Modal */}
            <VerificationDetailsModal
                userId={profile.userId}
                businessName={profile.displayName}
                isOpen={isVerificationModalOpen}
                onClose={() => setIsVerificationModalOpen(false)}
                businessProfile={profile.businessProfile}
            />

            {/* Modals and Renderings */}
            <EnquiryModal
                businessId={profile.userId}
                businessName={profile.displayName}
                isOpen={isEnquiryModalOpen}
                onClose={() => setIsEnquiryModalOpen(false)}
            />

            <VerificationApplicationModal
                isOpen={isVerificationAppModalOpen}
                onClose={() => setIsVerificationAppModalOpen(false)}
                onApplySuccess={loadProfile}
            />

            {reportPostId && (
                <ReportModal
                    entityId={reportPostId}
                    entityType="POST"
                    onClose={() => setReportPostId(null)}
                />
            )}

            {isReportingUser && (
                <ReportModal
                    entityId={profile.userId}
                    entityType="USER"
                    title="Profile"
                    onClose={() => setIsReportingUser(false)}
                />
            )}

            <AuthPromptModal
                isOpen={authModal.isOpen}
                message={authModal.message}
                onClose={() => setAuthModal({ isOpen: false, message: '' })}
            />

            {isCollabModalOpen && profile && (
                <CollaborationRequestModal
                    receiverId={profile.userId}
                    receiverName={profile.displayName}
                    onClose={() => setIsCollabModalOpen(false)}
                />
            )}
        </div>
    );
}
