import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    HiOutlineHeart, HiHeart,
    HiOutlineChatBubbleOvalLeft, HiOutlineBookmark, HiBookmark,
    HiOutlineUser, HiOutlineArrowLeft, HiOutlineTrash, HiOutlineShare, HiOutlineArrowPath,
    HiOutlineEllipsisHorizontal, HiOutlinePaperAirplane, HiOutlineStar, HiOutlineFolderPlus
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import VideoPlayer from '../../components/video/VideoPlayer';
import CommentItem from '../../components/post/CommentItem';
import EnquiryModal from '../../components/enquiry/EnquiryModal';
import AddToBoardModal from '../../components/boards/AddToBoardModal';
import AuthPromptModal from '../../components/auth/AuthPromptModal';
import EngagementBar from '../../components/post/EngagementBar';
import { useEngagement } from '../../hooks/useEngagement';
import './PostPage.css';

const BUSINESS_TYPES = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];

export default function PostPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, isMuted, setIsMuted } = useAuth();

    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
    const [saveToBoardOpen, setSaveToBoardOpen] = useState(false);
    const [authModal, setAuthModal] = useState({ isOpen: false, message: '' });
    const [authorPosts, setAuthorPosts] = useState([]);
    const [recommendPost, setRecommendPost] = useState(null);
    const [reportPostId, setReportPostId] = useState(null);
    const lastTap = useRef(0);
    const touchStart = useRef(0);

    const { 
        post, 
        setPost, 
        handleLike, 
        handleSave, 
        handleRepost 
    } = useEngagement(null);

    const isBusiness = post && BUSINESS_TYPES.includes(post.author?.accountType);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [postRes, commentsRes] = await Promise.all([
                api.get(`/posts/${id}`),
                api.get(`/engagement/comments/${id}`)
            ]);
            const rawPost = postRes.data.post;
            const baseAuthor = rawPost.author || rawPost.user || {};
            const author = {
                ...baseAuthor,
                profile: baseAuthor.profile || {
                    displayName: baseAuthor.displayName || baseAuthor.username || 'Traveler',
                    handle: baseAuthor.username,
                    avatarUrl: baseAuthor.avatarUrl,
                },
            };

            setPost({ ...rawPost, author });
            setComments(commentsRes.data.comments);

            // Fetch author's other posts for swipe navigation
            const authorHandle = author.profile?.handle;
            if (authorHandle) {
                const authorPostsRes = await api.get(`/profile/${authorHandle}/posts`);
                setAuthorPosts(authorPostsRes.data.posts || []);
            }
        } catch {
            toast.error('Failed to load post');
            navigate('/feed');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    // Swipe Navigation
    const handleTouchStart = (e) => {
        touchStart.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e) => {
        const touchEnd = e.changedTouches[0].clientX;
        const diff = touchStart.current - touchEnd;

        if (Math.abs(diff) > 70) {
            const currentIndex = authorPosts.findIndex(p => p.id === id);
            if (currentIndex === -1 || authorPosts.length === 0) return;

            if (diff > 0 && currentIndex < authorPosts.length - 1) {
                navigate(`/post/${authorPosts[currentIndex + 1].id}`);
            } else if (diff < 0 && currentIndex > 0) {
                navigate(`/post/${authorPosts[currentIndex - 1].id}`);
            }
        }
    };

    useEffect(() => { loadData(); }, [loadData]);

    const onSaveAction = () => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Save videos to your trip boards' });
            return;
        }
        setSaveToBoardOpen(true);
    };

    const handleDownload = () => {
        if (!post?.videoUrl) return;
        const link = document.createElement('a');
        link.href = post.videoUrl;
        link.setAttribute('download', `travelpod-${id}.mp4`);
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Download started!');
    };

    const handleSubmitComment = async (e) => {
        e.preventDefault();
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Join the conversation' });
            return;
        }
        if (!commentText.trim()) return;

        try {
            setSubmitting(true);
            const { data } = await api.post(`/engagement/comments/${id}`, { content: commentText });
            setComments(prev => [data.comment, ...prev]);
            setPost(prev => ({ ...prev, commentCount: prev.commentCount + 1 }));
            setCommentText('');
            toast.success('Comment added');
        } catch (err) {
            toast.error('Failed to add comment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteComment = async (commentId) => {
        try {
            await api.delete(`/engagement/comments/${commentId}`);
            setComments(prev => prev.filter(comment => comment.id !== commentId));
            setPost(prev => ({ ...prev, commentCount: prev.commentCount - 1 }));
            toast.success('Comment deleted');
        } catch (err) {
            toast.error('Failed to delete comment');
        }
    };

    const onRepostAction = async () => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Log in to add to your feed' });
            return;
        }
        handleRepost();
    };

    const toggleMute = (e) => {
        e?.stopPropagation();
        setIsMuted(prev => !prev);
    };

    const handlePostClick = (e) => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        if (now - lastTap.current < DOUBLE_TAP_DELAY) {
            if (!post.isLiked) {
                handleLike();
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
            toggleMute(e);
        }
        lastTap.current = now;
    };

    if (loading) return <div className="post-page-loading"><div className="spinner"></div></div>;
    if (!post) return null;

    return (
        <div className="post-page" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {/* Top nav */}
            <nav className="post-nav">
                <button className="post-nav-btn" onClick={() => navigate(-1)}>
                    <HiOutlineArrowLeft /> Back
                </button>
                <span className="post-nav-title">Post</span>
                <div style={{ width: 40 }}></div>
            </nav>

            <div className={`post-container-linear ${(!post.videoUrl && (!post.mediaUrls || post.mediaUrls.length === 0)) ? 'text-only' : ''}`}>
                <div className="post-main-content">
                    {/* Media Section */}
                    <div className="post-media-wrapper" onClick={handlePostClick}>
                        {post.videoUrl ? (
                            <VideoPlayer src={post.videoUrl} poster={post.thumbnailUrl} autoPlay={true} muted={isMuted} onClick={handlePostClick} />
                        ) : (post.mediaUrls && post.mediaUrls.length > 0) ? (
                            <div className={`post-image-grid grid-${Math.min(post.mediaUrls.length, 4)}`}>
                                {post.mediaUrls.slice(0, 4).map((url, i) => (
                                    <img key={i} src={url} alt="" />
                                ))}
                            </div>
                        ) : post.postType === 'VIDEO' ? (
                            <div className="processing-placeholder" style={{ 
                                width: '100%', 
                                aspectRatio: '9/16', 
                                background: '#000', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                gap: 'var(--space-4)'
                            }}>
                                <HiOutlineArrowPath className="spin" style={{ fontSize: '3rem', color: 'var(--color-primary)' }} />
                                <p style={{ color: 'var(--text-secondary)' }}>Processing your video...</p>
                            </div>
                        ) : null
                        }
                    </div>

                    {/* Post Details (Below Media) */}
                    <div className="post-info-section">
                        {/* Author Info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                            <Link to={`/profile/${post.author?.profile?.handle}`} className="post-author-minimal">
                                <div className="post-author-avatar-sm">
                                    {post.author?.profile?.avatarUrl ? (
                                        <img src={post.author.profile.avatarUrl} alt="" />
                                    ) : (
                                        <HiOutlineUser />
                                    )}
                                </div>
                                <div className="post-author-text">
                                    <div className="post-author-name-sm">{post.author?.profile?.displayName}</div>
                                    <div className="post-author-handle-sm">@{post.author?.profile?.handle}</div>
                                </div>
                            </Link>

                            {isBusiness && post.author.id !== user?.id && (
                                <button
                                    className="enquire-now-bar-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!user) setAuthModal({ isOpen: true, message: 'Send booking enquiries' });
                                        else setIsEnquiryModalOpen(true);
                                    }}
                                >
                                    Enquire Now
                                </button>
                            )}
                        </div>

                        <div className="post-text-content">
                            <h2 className="post-detail-title">{post.title}</h2>
                            {post.description && <p className="post-detail-desc">{post.description}</p>}
                        </div>

                        {/* Engagement Bar */}
                        <EngagementBar 
                            post={post}
                            isOwner={user?.id === post.author?.id}
                            onLike={() => {
                                if (!user) setAuthModal({ isOpen: true, message: 'Like videos and save your favourites' });
                                else handleLike();
                            }}
                            onSave={onSaveAction}
                            onComment={() => {
                                document.querySelector('.comment-input-linear')?.focus();
                            }}
                            onReview={isBusiness && post.author.id !== user?.id ? () => {
                                if (!user) setAuthModal({ isOpen: true, message: 'Log in to write a review' });
                                else navigate(`/upload?linkedBusinessId=${post.author.id}&businessName=${encodeURIComponent(post.author.profile?.displayName || '')}`);
                            } : null}
                            onAction={(type) => {
                                if (!user && type !== 'download') {
                                    setAuthModal({ isOpen: true, message: 'Log in to perform this action' });
                                    return;
                                }
                                if (type === 'repost') onRepostAction();
                                else if (type === 'recommend') setRecommendPost(post);
                                else if (type === 'board') setSaveToBoardOpen(true);
                                else if (type === 'download') handleDownload();
                                else if (type === 'report') setReportPostId(post.id);
                                else if (type === 'delete') {
                                    if (window.confirm('Are you sure you want to delete this post?')) {
                                        api.delete(`/posts/${post.id}`).then(() => {
                                            toast.success('Post deleted');
                                            navigate('/feed');
                                        }).catch(err => toast.error('Failed to delete'));
                                    }
                                }
                            }}
                        />

                        {/* Comments List */}
                        <div className="post-comments-section">
                            <div className="comments-header-row">
                                <h3 className="comments-header-sm">Comments ({post.commentCount || 0})</h3>
                                {isBusiness && (
                                    <button 
                                        className="write-review-btn-sm"
                                        onClick={() => navigate(`/upload?linkedBusinessId=${post.author.id}&businessName=${encodeURIComponent(post.author.profile?.displayName)}`)}
                                    >
                                        <HiOutlineStar /> Write a Review
                                    </button>
                                )}
                            </div>
                            <div className="comments-list-sm">
                                {comments.length === 0 ? (
                                    <div className="comments-empty-sm">No comments yet.</div>
                                ) : (
                                    comments.slice(0, 10).map(comment => (
                                        <CommentItem
                                            key={comment.id}
                                            comment={comment}
                                            user={user}
                                            postAuthorId={post.author?.id}
                                            onDelete={handleDeleteComment}
                                            postId={id}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Comment Input */}
                        <div className="comment-input-area-linear">
                            <form onSubmit={handleSubmitComment} className="comment-form-linear">
                                <input
                                    type="text"
                                    placeholder="Add a comment..."
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    className="comment-input-linear"
                                    disabled={submitting}
                                />
                                <button type="submit" className="comment-submit-linear" disabled={!commentText.trim() || submitting}>
                                    Post
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {post && (
                <EnquiryModal
                    businessId={post.author.id}
                    businessName={post.author.profile?.displayName}
                    isOpen={isEnquiryModalOpen}
                    onClose={() => setIsEnquiryModalOpen(false)}
                />
            )}

            {saveToBoardOpen && (
                <AddToBoardModal
                    postId={id}
                    onClose={() => setSaveToBoardOpen(false)}
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
