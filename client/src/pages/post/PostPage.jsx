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
import RecommendModal from '../../components/feed/RecommendModal';
import AuthPromptModal from '../../components/auth/AuthPromptModal';
import './PostPage.css';

const BUSINESS_TYPES = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];

export default function PostPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
    const [saveToBoardOpen, setSaveToBoardOpen] = useState(false);
    const [authModal, setAuthModal] = useState({ isOpen: false, message: '' });
    const [authorPosts, setAuthorPosts] = useState([]);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [reposting, setReposting] = useState(false);
    const [recommendPost, setRecommendPost] = useState(null);
    const touchStart = useRef(0);

    const isBusiness = post && BUSINESS_TYPES.includes(post.author?.accountType);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [postRes, commentsRes] = await Promise.all([
                api.get(`/posts/${id}`),
                api.get(`/engagement/comments/${id}`)
            ]);
            setPost(postRes.data.post);
            setComments(commentsRes.data.comments);

            // Fetch author's other posts for swipe navigation
            const authorHandle = postRes.data.post.author?.profile?.handle;
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

    const handleLike = async () => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Like videos and save your favourites' });
            return;
        }
        try {
            if (post.isLiked) {
                await api.delete(`/engagement/like/${id}`);
            } else {
                await api.post(`/engagement/like/${id}`);
            }
            setPost(prev => ({ ...prev, isLiked: !prev.isLiked, likeCount: prev.likeCount + (prev.isLiked ? -1 : 1) }));
        } catch {
            toast.error('Failed to update like');
        }
    };

    const handleSave = () => {
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
            const { data } = await api.post(`/engagement/comments/${id}`, { text: commentText });
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

    const handleRepost = async () => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Log in to add to your feed' });
            return;
        }
        setReposting(true);
        try {
            await api.post(`/posts/${id}/repost`);
            toast.success('Added to your feed!');
            setShowMoreMenu(false);
        } catch (err) {
            toast.error('Failed to repost');
        } finally {
            setReposting(false);
        }
    };

    const handleRecommend = () => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Log in to recommend posts' });
            return;
        }
        setRecommendPost(post);
        setShowMoreMenu(false);
    };

    const handleAddToBoard = () => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Log in to save to trip boards' });
            return;
        }
        setSaveToBoardOpen(true);
        setShowMoreMenu(false);
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

            <div className={`post-container ${(!post.videoUrl && (!post.mediaUrls || post.mediaUrls.length === 0)) ? 'text-only' : ''}`}>
                {/* Left: Media or Text Card */}
                <div className="post-media-section">
                    {post.videoUrl ? (
                        <VideoPlayer src={post.videoUrl} poster={post.thumbnailUrl} autoPlay={true} />
                    ) : (post.mediaUrls && post.mediaUrls.length > 0) ? (
                        <div className={`post-image-grid grid-${Math.min(post.mediaUrls.length, 4)}`}>
                            {post.mediaUrls.slice(0, 4).map((url, i) => (
                                <img key={i} src={url} alt="" />
                            ))}
                        </div>
                    ) : (
                        <div className="post-text-card-wrapper">
                            <div className="text-post-card glass-card">
                                <h2 className="text-post-title">{post.title}</h2>
                                <p className="text-post-body">{post.description}</p>
                                {post.postTags?.length > 0 && (
                                    <div className="text-post-tags">
                                        {post.postTags.map(pt => (
                                            <span key={pt.id} className="text-post-tag">#{pt.tag.name}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Details & Comments */}
                <div className="post-details-section">
                    {/* Author Info */}
                    <Link to={`/profile/${post.author?.profile?.handle}`} className="post-author">
                        <div className="post-author-avatar">
                            {post.author?.profile?.avatarUrl ? (
                                <img src={post.author.profile.avatarUrl} alt="" />
                            ) : (
                                <HiOutlineUser />
                            )}
                        </div>
                        <div className="post-author-info">
                            <div className="post-author-name">{post.author?.profile?.displayName}</div>
                            <div className="post-author-handle">@{post.author?.profile?.handle}</div>
                        </div>
                    </Link>

                    {/* Post Content */}
                    <div className="post-content">
                        <h2 className="post-title">{post.title}</h2>
                        {post.description && <p className="post-desc">{post.description}</p>}

                        {post.postTags?.length > 0 && (
                            <div className="post-tags">
                                {post.postTags.map(pt => (
                                    <span key={pt.id} className="post-tag">#{pt.tag.name}</span>
                                ))}
                            </div>
                        )}

                        {isBusiness && post.author.id !== user?.id && (
                            <button
                                className="btn-primary"
                                style={{ width: '100%', marginTop: 'var(--space-4)', display: 'block' }}
                                onClick={() => {
                                    if (!user) {
                                        setAuthModal({ isOpen: true, message: 'Send booking enquiries to travel businesses' });
                                    } else {
                                        setIsEnquiryModalOpen(true);
                                    }
                                }}
                            >
                                Enquire Now
                            </button>
                        )}
                    </div>

                    {/* Engagement Bar */}
                    <div className="post-actions-refined">
                        <div className="actions-left">
                            <button className={`post-action-btn-main ${post.isLiked ? 'active' : ''}`} onClick={handleLike}>
                                {post.isLiked ? <HiHeart /> : <HiOutlineHeart />}
                                <span className="action-count">{post.likeCount || 0}</span>
                            </button>
                            <div className="post-action-btn-main">
                                <HiOutlineChatBubbleOvalLeft />
                                <span className="action-count">{post.commentCount || 0}</span>
                            </div>
                            <button
                                className="post-action-btn-main"
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    toast.success('Link copied!');
                                }}
                            >
                                <HiOutlinePaperAirplane style={{ transform: 'rotate(-20deg) translateY(-2px)' }} />
                            </button>
                        </div>

                        <div className="actions-right">
                            <button className={`post-action-btn-main ${post.isSaved ? 'active' : ''}`} onClick={handleSave}>
                                {post.isSaved ? <HiBookmark /> : <HiOutlineBookmark />}
                            </button>

                            <div className="more-menu-container">
                                <button
                                    className="post-action-btn-main"
                                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                                >
                                    <HiOutlineEllipsisHorizontal />
                                </button>

                                {showMoreMenu && (
                                    <div className="more-context-sheet glass-card animate-scaleIn">
                                        <div className="sheet-handle" />
                                        <button className="sheet-item" onClick={handleRepost} disabled={reposting}>
                                            <HiOutlineShare className="item-icon" /> {reposting ? 'Adding...' : 'Add to Feed'}
                                        </button>
                                        <button className="sheet-item" onClick={handleRecommend}>
                                            <HiOutlineStar className="item-icon" /> Recommend to Follower
                                        </button>
                                        <button className="sheet-item" onClick={handleAddToBoard}>
                                            <HiOutlineFolderPlus className="item-icon" /> Add to Trip Board
                                        </button>
                                        <button className="sheet-item" onClick={handleDownload} disabled={!post.videoUrl}>
                                            <HiOutlineArrowPath className="item-icon" /> Download Media
                                        </button>
                                        <div className="sheet-divider" />
                                        <button className="sheet-item danger" onClick={() => setReportPostId(post.id)}>
                                            <HiOutlineTrash className="item-icon" /> Report Content
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Comments List */}
                    <div className="post-comments">
                        <h3 className="comments-header">Comments ({post.commentCount || 0})</h3>
                        <div className="comments-list">
                            {comments.length === 0 ? (
                                <div className="comments-empty">No comments yet. Be the first to say something!</div>
                            ) : (
                                comments.map(comment => (
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
                    <div className="comment-input-area">
                        <form onSubmit={handleSubmitComment} className="comment-form">
                            <input
                                type="text"
                                placeholder="Add a comment..."
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                className="comment-input"
                                disabled={submitting}
                            />
                            <button type="submit" className="comment-submit" disabled={!commentText.trim() || submitting}>
                                Post
                            </button>
                        </form>
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
