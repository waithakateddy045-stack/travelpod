import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    HiOutlineArrowLeft, HiOutlineHeart, HiHeart,
    HiOutlineBookmark, HiBookmark, HiOutlineMapPin,
    HiOutlineCheckBadge, HiOutlinePlay, HiOutlineUserPlus, HiUserPlus,
    HiOutlineChatBubbleOvalLeft, HiOutlineTrash
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import AuthPromptModal from '../../components/auth/AuthPromptModal';
import api from '../../services/api';
import './BoardDetailPage.css';

export default function BoardDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [board, setBoard] = useState(null);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [authModal, setAuthModal] = useState({ isOpen: false, message: '' });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [boardRes, commentsRes] = await Promise.all([
                api.get(`/boards/${id}`),
                api.get(`/boards/${id}/comments`),
            ]);
            setBoard(boardRes.data.board);
            setComments(commentsRes.data.comments || []);
        } catch {
            setBoard(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const toggleLike = async () => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Like trip boards to save them for later' });
            return;
        }
        try {
            const { data } = await api.post(`/boards/${id}/like`);
            setBoard(prev => ({ ...prev, isLiked: data.liked, likeCount: prev.likeCount + (data.liked ? 1 : -1) }));
        } catch { }
    };

    const toggleSave = async () => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Save videos to your trip boards' });
            return;
        }
        try {
            const { data } = await api.post(`/boards/${id}/save`);
            setBoard(prev => ({ ...prev, isSaved: data.saved, saveCount: prev.saveCount + (data.saved ? 1 : -1) }));
        } catch { }
    };

    const toggleFollow = async () => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Follow creators and never miss their content' });
            return;
        }
        try {
            const { data } = await api.post(`/boards/${id}/follow`);
            setBoard(prev => ({ ...prev, isFollowed: data.followed, followerCount: prev.followerCount + (data.followed ? 1 : -1) }));
        } catch { }
    };

    const postComment = async (e) => {
        e.preventDefault();
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Join the conversation' });
            return;
        }
        if (!commentText.trim() || posting) return;
        setPosting(true);
        try {
            const { data } = await api.post(`/boards/${id}/comments`, { content: commentText.trim() });
            setComments(prev => [data.comment, ...prev]);
            setCommentText('');
        } catch { }
        finally { setPosting(false); }
    };

    const deleteComment = async (commentId) => {
        try {
            await api.delete(`/boards/${id}/comments/${commentId}`);
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch { }
    };

    if (loading) return <div className="board-detail-loading"><div className="bd-spinner" /><p>Loading board...</p></div>;
    if (!board) return <div className="board-detail-loading"><p>Board not found</p><button onClick={() => navigate('/boards')}>← Back to Boards</button></div>;

    const profile = board.user?.profile;
    const isVerified = profile?.businessProfile?.verificationStatus === 'APPROVED';

    return (
        <div className="board-detail-page">
            {/* Header with cover */}
            <div className="bd-hero" style={{ backgroundImage: board.coverImage ? `url(${board.coverImage})` : undefined }}>
                <div className="bd-hero-overlay" />
                <nav className="bd-nav">
                    <button className="bd-back" onClick={() => navigate(-1)}>
                        <HiOutlineArrowLeft />
                    </button>
                </nav>
                <div className="bd-hero-content">
                    <h1 className="bd-title">{board.title}</h1>
                    {board.destination && (
                        <div className="bd-destination"><HiOutlineMapPin /> {board.destination}</div>
                    )}
                </div>
            </div>

            {/* Creator info */}
            <div className="bd-creator-section">
                <Link to={`/profile/${profile?.handle}`} className="bd-creator-link">
                    <div className="bd-creator-avatar">
                        {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>👤</span>}
                    </div>
                    <div>
                        <div className="bd-creator-name">
                            {profile?.displayName || 'Unknown'}
                            {isVerified && <HiOutlineCheckBadge className="bd-verified-badge" />}
                        </div>
                        <div className="bd-creator-handle">@{profile?.handle || '—'}</div>
                    </div>
                </Link>

                <div className="bd-actions">
                    <button className={`bd-action-btn ${board.isFollowed ? 'active' : ''}`} onClick={toggleFollow}>
                        {board.isFollowed ? <><HiUserPlus /> Following</> : <><HiOutlineUserPlus /> Follow</>}
                    </button>
                    <button className={`bd-action-icon ${board.isLiked ? 'liked' : ''}`} onClick={toggleLike}>
                        {board.isLiked ? <HiHeart /> : <HiOutlineHeart />}
                        <span>{board.likeCount}</span>
                    </button>
                    <button className={`bd-action-icon ${board.isSaved ? 'saved' : ''}`} onClick={toggleSave}>
                        {board.isSaved ? <HiBookmark /> : <HiOutlineBookmark />}
                        <span>{board.saveCount}</span>
                    </button>
                </div>
            </div>

            {/* Description */}
            {board.description && (
                <div className="bd-description">{board.description}</div>
            )}

            {/* Stats */}
            <div className="bd-stats-bar">
                <span>{board.videoCount || 0} videos</span>
                <span>·</span>
                <span>{board.followerCount || 0} followers</span>
                <span>·</span>
                <span>{board.saveCount || 0} saves</span>
            </div>

            {/* Video grid */}
            <div className="bd-section-title">Videos in this Board</div>
            {board.videos?.length > 0 ? (
                <div className="bd-video-grid">
                    {board.videos.map(v => (
                        <Link key={v.id} to={`/post/${v.post?.id}`} className="bd-video-card">
                            <div className="bd-video-thumb">
                                {v.post?.thumbnailUrl
                                    ? <img src={v.post.thumbnailUrl} alt={v.post.title} />
                                    : <div className="bd-thumb-placeholder"><HiOutlinePlay /></div>}
                                {v.post?.duration > 0 && <span className="bd-video-duration">{Math.floor(v.post.duration / 60)}:{String(v.post.duration % 60).padStart(2, '0')}</span>}
                            </div>
                            <div className="bd-video-info">
                                <h4>{v.post?.title}</h4>
                                {v.post?.author?.profile && <span className="bd-video-author">@{v.post.author.profile.handle}</span>}
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="bd-empty-videos">
                    <p>No videos in this board yet</p>
                </div>
            )}

            {/* Comments */}
            <div className="bd-section-title">
                <HiOutlineChatBubbleOvalLeft /> Comments ({comments.length})
            </div>
            <div className="bd-comments">
                <form className="bd-comment-form" onSubmit={postComment}>
                    <input
                        type="text"
                        placeholder="Add a comment..."
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        className="bd-comment-input"
                    />
                    <button type="submit" disabled={!commentText.trim() || posting} className="bd-comment-submit">Post</button>
                </form>
                {comments.map(c => (
                    <div key={c.id} className="bd-comment-item">
                        <div className="bd-comment-avatar">
                            {c.user?.profile?.avatarUrl ? <img src={c.user.profile.avatarUrl} alt="" /> : <span>👤</span>}
                        </div>
                        <div className="bd-comment-body">
                            <Link to={`/profile/${c.user?.profile?.handle}`} className="bd-comment-author">{c.user?.profile?.displayName || 'User'}</Link>
                            <p className="bd-comment-text">{c.content}</p>
                            <span className="bd-comment-time">{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        {user && user.id === c.userId && (
                            <button className="bd-comment-delete" onClick={() => deleteComment(c.id)}>
                                <HiOutlineTrash />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <AuthPromptModal
                isOpen={authModal.isOpen}
                onClose={() => setAuthModal({ isOpen: false, message: '' })}
                message={authModal.message}
            />
        </div>
    );
}
