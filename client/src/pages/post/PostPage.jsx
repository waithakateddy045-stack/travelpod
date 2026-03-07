import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    HiOutlineHeart, HiHeart,
    HiOutlineChatBubbleOvalLeft, HiOutlineBookmark, HiBookmark,
    HiOutlineUser, HiOutlineArrowLeft, HiOutlineTrash, HiOutlineShare
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import VideoPlayer from '../../components/video/VideoPlayer';
import CommentItem from '../../components/post/CommentItem';
import EnquiryModal from '../../components/enquiry/EnquiryModal';
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
    const [authModal, setAuthModal] = useState({ isOpen: false, message: '' });

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
        } catch (err) {
            toast.error('Failed to load post');
            navigate('/feed');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

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

    const handleSave = async () => {
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Save videos to your trip boards' });
            return;
        }
        try {
            if (post.isSaved) {
                await api.delete(`/engagement/save/${id}`);
            } else {
                await api.post(`/engagement/save/${id}`);
            }
            setPost(prev => ({ ...prev, isSaved: !prev.isSaved, saveCount: prev.saveCount + (prev.isSaved ? -1 : 1) }));
        } catch {
            toast.error('Failed to update save');
        }
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

    const handleDeleteComment = async (commentId) => {
        try {
            await api.delete(`/engagement/comments/${commentId}`);
            setComments(prev => prev.filter(c => c.id !== commentId));
            setPost(prev => ({ ...prev, commentCount: Math.max(0, prev.commentCount - 1) }));
            toast.success('Comment deleted');
        } catch {
            toast.error('Failed to delete comment');
        }
    };

    if (loading) return <div className="post-page-loading"><div className="spinner"></div></div>;
    if (!post) return null;

    return (
        <div className="post-page">
            {/* Top nav */}
            <nav className="post-nav">
                <button className="post-nav-btn" onClick={() => navigate(-1)}>
                    <HiOutlineArrowLeft /> Back
                </button>
                <span className="post-nav-title">Post</span>
                <div style={{ width: 40 }}></div>
            </nav>

            <div className="post-container">
                {/* Left: Video */}
                <div className="post-video-section">
                    <VideoPlayer src={post.videoUrl} poster={post.thumbnailUrl} />
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
                    <div className="post-actions">
                        <button className={`post-action-btn ${post.isLiked ? 'active' : ''}`} onClick={handleLike}>
                            {post.isLiked ? <HiHeart /> : <HiOutlineHeart />}
                            <span>{post.likeCount || 0}</span>
                        </button>
                        <div className="post-action-btn">
                            <HiOutlineChatBubbleOvalLeft />
                            <span>{post.commentCount || 0}</span>
                        </div>
                        <button
                            className="post-action-btn"
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                toast.success('Link copied!');
                            }}
                            title="Share"
                        >
                            <HiOutlineShare />
                            <span>Share</span>
                        </button>
                        <button className={`post-action-btn ml-auto ${post.isSaved ? 'active' : ''}`} onClick={handleSave}>
                            {post.isSaved ? <HiBookmark /> : <HiOutlineBookmark />}
                            <span>Save</span>
                        </button>
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

            <AuthPromptModal
                isOpen={authModal.isOpen}
                onClose={() => setAuthModal({ isOpen: false, message: '' })}
                message={authModal.message}
            />
        </div>
    );
}
