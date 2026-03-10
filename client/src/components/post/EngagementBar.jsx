import { Heart, MessageCircle, Bookmark, Send, Star } from 'lucide-react';
import PostMoreMenu from './PostMoreMenu';
import { toast } from 'react-hot-toast';

export default function EngagementBar({ post, onLike, onSave, onComment, onReview, isOwner, onAction }) {
    if (!post) return null;

    return (
        <div className="post-actions-refined-linear">
            <div className="actions-left">
                <button 
                    className={`post-action-btn-main ${post.isLiked ? 'active' : ''}`} 
                    onClick={(e) => { e.preventDefault(); onLike(); }}
                >
                    <Heart fill={post.isLiked ? 'currentColor' : 'none'} />
                    <span className="action-count">{post.likeCount || 0}</span>
                </button>
                <button 
                    className="post-action-btn-main"
                    onClick={(e) => { e.preventDefault(); onComment?.(); }}
                >
                    <MessageCircle />
                    <span className="action-count">{post.commentCount || 0}</span>
                </button>
                {onReview && (
                    <button 
                        className="post-action-btn-main review-btn-linear"
                        onClick={(e) => { e.preventDefault(); onReview(); }}
                        title="Write a Review"
                    >
                        <Star />
                        <span className="action-label">Review</span>
                    </button>
                )}
                <button
                    className="post-action-btn-main"
                    onClick={(e) => {
                        e.preventDefault();
                        onAction?.('share');
                    }}
                >
                    <Send style={{ transform: 'rotate(-20deg) translateY(-2px)' }} />
                </button>
            </div>

            <div className="actions-right">
                <button 
                    className={`post-action-btn-main ${post.isSaved ? 'active' : ''}`} 
                    onClick={(e) => { e.preventDefault(); onSave(); }}
                >
                    <Bookmark fill={post.isSaved ? 'currentColor' : 'none'} />
                </button>
                <PostMoreMenu
                    post={post}
                    isOwner={isOwner}
                    onAction={onAction}
                />
            </div>
        </div>
    );
}
