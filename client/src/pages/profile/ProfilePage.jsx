import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    HiOutlineGlobeAlt, HiOutlineMapPin, HiOutlineStar,
    HiOutlineCheckBadge, HiOutlineChatBubbleLeft,
    HiOutlinePlayCircle, HiOutlineHeart, HiOutlineUser,
    HiOutlineArrowLeft, HiOutlineCog6Tooth,
    HiOutlineChartBar, HiOutlineEnvelope,
    HiOutlineRectangleStack
} from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import EnquiryModal from '../../components/enquiry/EnquiryModal';
import VerificationDetailsModal from '../../components/verification/VerificationDetailsModal';
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
    const [activeTab, setActiveTab] = useState('posts'); // 'posts', 'saved', or 'boards'
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
    const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
    const [badges, setBadges] = useState([]);
    const [boards, setBoards] = useState([]);

    const isOwn = user && profile && user.id === profile.userId;
    const isBusiness = profile && BUSINESS_TYPES.includes(profile.accountType);

    const loadProfile = useCallback(async () => {
        try {
            const { data } = await api.get(`/profile/${handle}`);
            setProfile(data.profile);
        } catch (err) {
            toast.error('Profile not found');
        }
    }, [handle]);

    const loadPosts = useCallback(async () => {
        try {
            const { data } = await api.get(`/profile/${handle}/posts`);
            setPosts(data.posts);
        } catch { } // Error silently, profile might just have no posts
    }, [handle]);

    const loadSavedPosts = useCallback(async () => {
        if (!isOwn) return;
        try {
            const { data } = await api.get('/engagement/saves');
            setSavedPosts(data.saved?.map(s => s.post) || []);
        } catch { }
    }, [isOwn]);

    const loadBadges = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await api.get('/badges');
            setBadges(data.badges || []);
        } catch { }
    }, [user]);

    const loadBoards = useCallback(async () => {
        try {
            const { data } = await api.get(`/boards/user/${handle}`);
            setBoards(data.boards || []);
        } catch { }
    }, [handle]);

    useEffect(() => {
        setLoading(true);
        Promise.all([loadProfile(), loadPosts(), loadSavedPosts(), loadBadges(), loadBoards()]).finally(() => setLoading(false));
    }, [loadProfile, loadPosts, loadSavedPosts, loadBadges, loadBoards]);

    const handleFollow = async () => {
        if (!user) { toast.error('Please sign in to follow'); return; }
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
        if (!user) { toast.error('Please sign in to message'); return; }
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
                            {profile.businessProfile?.verificationStatus === 'APPROVED' && (
                                <button
                                    className="profile-badge verified"
                                    onClick={() => setIsVerificationModalOpen(true)}
                                    style={{ cursor: 'pointer', border: 'none', background: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-primary-light)', fontWeight: 600, fontSize: 'var(--text-xs)' }}
                                >
                                    <HiOutlineCheckBadge /> Verified
                                </button>
                            )}
                        </h1>
                        <p className="profile-handle">@{profile.handle}</p>

                        <div className="profile-stats">
                            <div className="stat-item">
                                <span className="stat-value">{profile.postCount || 0}</span>
                                <span className="stat-label">Posts</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{profile.followerCount || 0}</span>
                                <span className="stat-label">Followers</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{profile.followingCount || 0}</span>
                                <span className="stat-label">Following</span>
                            </div>
                            {profile.verifiedReviewCount > 0 && (
                                <div className="stat-item">
                                    <span className="stat-value">{profile.verifiedReviewCount}</span>
                                    <span className="stat-label">Reviews</span>
                                </div>
                            )}
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
                                {isBusiness && (
                                    <Link
                                        to="/analytics"
                                        className="profile-btn follow" style={{ background: 'var(--color-primary-light)', border: 'none', color: 'white', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 16px', fontWeight: 600 }}
                                    >
                                        <HiOutlineChartBar style={{ marginRight: 6, fontSize: '1.2rem' }} /> Analytics
                                    </Link>
                                )}
                                <Link
                                    to="/settings"
                                    className="profile-btn follow" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <HiOutlineCog6Tooth style={{ marginRight: 6, fontSize: '1.2rem' }} /> Settings
                                </Link>
                                <button
                                    className="profile-btn follow" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                                    onClick={() => setIsEditModalOpen(true)}
                                >
                                    Edit Profile
                                </button>
                                {isBusiness && profile.businessProfile?.verificationStatus !== 'APPROVED' && (
                                    <button
                                        className="profile-btn primary"
                                        style={{ background: 'var(--color-primary-light)', padding: '6px 16px', fontSize: 'var(--text-xs)' }}
                                        onClick={() => setIsVerificationModalOpen(true)}
                                    >
                                        Get Verified
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="profile-actions">
                                <button
                                    className={`profile-btn ${profile.isFollowing ? 'following' : 'follow'}`}
                                    onClick={handleFollow}
                                    disabled={followLoading}
                                >
                                    {profile.isFollowing ? 'Following' : 'Follow'}
                                </button>
                                {isBusiness && (
                                    <button
                                        className="profile-btn message"
                                        style={{ background: 'var(--color-primary)', color: 'white', borderColor: 'transparent' }}
                                        onClick={() => setIsEnquiryModalOpen(true)}
                                    >
                                        Enquire Now
                                    </button>
                                )}
                                <button className="profile-btn message" onClick={handleStartMessage}>
                                    <HiOutlineEnvelope style={{ marginRight: 4 }} /> Message
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Business Info Card */}
                {isBusiness && profile.businessProfile && (
                    <div className="business-info">
                        <h3>Business Info</h3>
                        {profile.businessProfile.starRating && (
                            <div className="star-rating" style={{ marginBottom: 'var(--space-4)' }}>
                                <HiOutlineStar style={{ fill: '#f5a623' }} />
                                {Number(profile.businessProfile.starRating).toFixed(1)}
                                <span className="count">({profile.businessProfile.verifiedReviewCount} verified reviews)</span>
                            </div>
                        )}
                        {profile.businessProfile.country && (
                            <div className="business-detail">
                                <HiOutlineMapPin /> {profile.businessProfile.country}
                            </div>
                        )}
                        {profile.businessProfile.description && (
                            <div className="business-detail" style={{ alignItems: 'flex-start' }}>
                                <span>{profile.businessProfile.description}</span>
                            </div>
                        )}
                        {profile.businessProfile.websiteUrl && (
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

                {/* Content Tabs */}
                <div className="profile-tabs" style={{ display: 'flex', gap: 'var(--space-4)', borderBottom: '1px solid var(--border-primary)', marginBottom: 'var(--space-4)' }}>
                    <button
                        className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('posts')}
                        style={{ padding: 'var(--space-2) 0', background: 'none', border: 'none', borderBottom: activeTab === 'posts' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'posts' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                    >
                        <HiOutlinePlayCircle style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Posts
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'boards' ? 'active' : ''}`}
                        onClick={() => setActiveTab('boards')}
                        style={{ padding: 'var(--space-2) 0', background: 'none', border: 'none', borderBottom: activeTab === 'boards' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'boards' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                    >
                        <HiOutlineRectangleStack style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Boards
                    </button>
                    {isOwn && (
                        <button
                            className={`tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
                            onClick={() => setActiveTab('saved')}
                            style={{ padding: 'var(--space-2) 0', background: 'none', border: 'none', borderBottom: activeTab === 'saved' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'saved' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                        >
                            <HiOutlineHeart style={{ marginRight: 6, verticalAlign: 'middle' }} />
                            Saved
                        </button>
                    )}
                </div>

                {/* Posts Grid */}
                {activeTab !== 'boards' ? (
                    <div className="post-grid">
                        {(activeTab === 'posts' ? posts : savedPosts).length > 0 ? (
                            (activeTab === 'posts' ? posts : savedPosts).map(post => (
                                <Link key={post.id} to={`/post/${post.id}`} className="post-grid-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                                    {post.thumbnailUrl ? (
                                        <img src={post.thumbnailUrl} alt={post.title} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)' }}>
                                            <HiOutlinePlayCircle style={{ fontSize: '2rem', color: 'var(--text-tertiary)' }} />
                                        </div>
                                    )}
                                    <div className="post-grid-overlay">
                                        <span><HiOutlineHeart /> {post.likeCount}</span>
                                        <span><HiOutlinePlayCircle /> {post.viewCount}</span>
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
                    </div>
                ) : (
                    /* Boards Grid */
                    <div className="post-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                        {boards.length > 0 ? boards.map(board => (
                            <Link key={board.id} to={`/boards/${board.id}`} className="post-grid-item" style={{ textDecoration: 'none', height: 200 }}>
                                {board.coverImage ? (
                                    <img src={board.coverImage} alt={board.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', gap: 8 }}>
                                        <HiOutlineRectangleStack style={{ fontSize: '2rem', color: 'var(--text-tertiary)' }} />
                                    </div>
                                )}
                                <div className="post-grid-overlay" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '12px', background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>{board.title}</span>
                                    {board.destination && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)' }}>📍 {board.destination}</span>}
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>{board.videoCount || 0} videos · {board.likeCount || 0} likes</span>
                                </div>
                            </Link>
                        )) : (
                            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                                <HiOutlineRectangleStack />
                                <p>{isOwn ? "You haven't created any boards yet" : 'No boards yet'}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

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
            />

            {/* Modals and Renderings */}
            <EnquiryModal
                businessId={profile.userId}
                businessName={profile.displayName}
                isOpen={isEnquiryModalOpen}
                onClose={() => setIsEnquiryModalOpen(false)}
            />
        </div>
    );
}
