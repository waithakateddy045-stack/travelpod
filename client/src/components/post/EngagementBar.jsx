import { HiOutlineHeart, HiHeart, HiOutlineChatBubbleOvalLeft, HiOutlineBookmark, HiBookmark, HiOutlinePaperAirplane } from 'react-icons/hi2';
import PostMoreMenu from './PostMoreMenu';
import { toast } from 'react-hot-toast';

export default function EngagementBar({ post, onLike, onSave, onComment, isOwner, onAction }) {
    if (!post) return null;

    return (
        <div className="post-actions-refined-linear">
            <div className="actions-left">
                <button 
                    className={`post-action-btn-main ${post.isLiked ? 'active' : ''}`} 
                    onClick={(e) => { e.preventDefault(); onLike(); }}
                >
                    {post.isLiked ? <HiHeart /> : <HiOutlineHeart />}
                    <span className="action-count">{post.likeCount || 0}</span>
                </button>
                <button 
                    className="post-action-btn-main"
                    onClick={(e) => { e.preventDefault(); onComment?.(); }}
                >
                    <HiOutlineChatBubbleOvalLeft />
                    <span className="action-count">{post.commentCount || 0}</span>
                </button>
                <button
                    className="post-action-btn-main"
                    onClick={(e) => {
                        e.preventDefault();
                        navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
                        toast.success('Link copied!');
                    }}
                >
                    <HiOutlinePaperAirplane style={{ transform: 'rotate(-20deg) translateY(-2px)' }} />
                </button>
            </div>

            <div className="actions-right">
                <button 
                    className={`post-action-btn-main ${post.isSaved ? 'active' : ''}`} 
                    onClick={(e) => { e.preventDefault(); onSave(); }}
                >
                    {post.isSaved ? <HiBookmark /> : <HiOutlineBookmark />}
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
