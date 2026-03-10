import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineUser, HiOutlineTrash, HiOutlineChatBubbleOvalLeft, HiOutlineFlag } from 'react-icons/hi2';
import ReportModal from '../common/ReportModal';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

export default function CommentItem({
    comment,
    user,
    postAuthorId,
    onDelete,
    level = 0,
    postId,
}) {
    const [isReplying, setIsReplying] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [replies, setReplies] = useState([]);
    const [showReplies, setShowReplies] = useState(false);
    const [loadingReplies, setLoadingReplies] = useState(false);
    const [hasLoadedReplies, setHasLoadedReplies] = useState(false);
    const [replyCount, setReplyCount] = useState(comment.replyCount || comment._count?.replies || 0);
    const [isReporting, setIsReporting] = useState(false);

    const isCreator = comment.userId === postAuthorId;
    const canDelete = user?.id === comment.userId || user?.accountType === 'ADMIN';

    const loadReplies = async () => {
        try {
            setLoadingReplies(true);
            const { data } = await api.get(`/engagement/comments/${comment.id}/replies`);
            setReplies(data.replies);
            setHasLoadedReplies(true);
            setShowReplies(true);
        } catch (err) {
            toast.error('Failed to load replies');
        } finally {
            setLoadingReplies(false);
        }
    };

    const handleToggleReplies = () => {
        if (!hasLoadedReplies && replyCount > 0) {
            loadReplies();
        } else {
            setShowReplies(!showReplies);
        }
    };

    const handleSubmitReply = async (e) => {
        e.preventDefault();
        if (!user) return toast.error('Please login to reply');
        if (!replyText.trim()) return;

        try {
            setSubmitting(true);
            const { data } = await api.post(`/engagement/comments/${postId}`, {
                content: replyText,
                parentCommentId: comment.id
            });

            setReplies(prev => [...prev, data.comment]);
            setReplyCount(prev => prev + 1);
            setReplyText('');
            setIsReplying(false);
            setShowReplies(true);
            toast.success('Reply added');
        } catch (err) {
            toast.error('Failed to add reply');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteReply = (replyId) => {
        setReplies(prev => prev.filter(r => r.id !== replyId));
        setReplyCount(prev => Math.max(0, prev - 1));
    };

    return (
        <div className={`comment-item-container ${level > 0 ? 'reply-item' : ''}`}>
            <div className={`comment-item ${isCreator ? 'is-creator' : ''}`}>
                <Link
                    to={`/profile/${comment.user?.profile?.handle}`}
                    className="comment-avatar"
                >
                    {comment.user?.profile?.avatarUrl ? (
                        <img src={comment.user.profile.avatarUrl} alt="" />
                    ) : (
                        <HiOutlineUser />
                    )}
                </Link>

                <div className="comment-content">
                    <div className="comment-header">
                        <Link
                            to={`/profile/${comment.user?.profile?.handle}`}
                            className="comment-author"
                        >
                            {comment.user?.profile?.displayName}
                            {isCreator && <span className="creator-badge">Creator</span>}
                        </Link>
                        <span className="comment-time">{new Date(comment.createdAt).toLocaleDateString()}</span>
                    </div>

                    <p className="comment-text">{comment.content}</p>

                    <div className="comment-footer">
                        <button
                            className="comment-footer-btn"
                            onClick={() => setIsReplying(!isReplying)}
                        >
                            <HiOutlineChatBubbleOvalLeft /> Reply
                        </button>

                        <button className="comment-footer-btn" onClick={() => setIsReporting(true)}>
                            <HiOutlineFlag /> Report
                        </button>

                        {canDelete && (
                            <button className="comment-footer-btn delete" onClick={() => onDelete(comment.id)}>
                                <HiOutlineTrash /> Delete
                            </button>
                        )}
                    </div>

                    {isReplying && (
                        <div className="reply-input-area">
                            <form onSubmit={handleSubmitReply} className="reply-form">
                                <input
                                    type="text"
                                    placeholder={`Reply to ${comment.user?.profile?.displayName}...`}
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    className="reply-input"
                                    autoFocus
                                    disabled={submitting}
                                />
                                <div className="reply-form-actions">
                                    <button
                                        type="button"
                                        className="reply-cancel"
                                        onClick={() => setIsReplying(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="reply-submit"
                                        disabled={!replyText.trim() || submitting}
                                    >
                                        Reply
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {replyCount > 0 && (
                        <button className="view-replies-btn" onClick={handleToggleReplies}>
                            {loadingReplies ? (
                                'Loading replies...'
                            ) : (
                                `${showReplies ? 'Hide' : 'View'} ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`
                            )}
                        </button>
                    )}
                </div>
            </div>

            {showReplies && replies.length > 0 && (
                <div className="replies-list">
                    {replies.map(reply => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            user={user}
                            postAuthorId={postAuthorId}
                            onDelete={() => {
                                onDelete(reply.id);
                                handleDeleteReply(reply.id);
                            }}
                            level={level + 1}
                            postId={postId}
                        />
                    ))}
                </div>
            )}
            {isReporting && (
                <ReportModal
                    entityId={comment.id}
                    entityType="COMMENT"
                    title="Comment"
                    onClose={() => setIsReporting(false)}
                />
            )}
        </div>
    );
}
