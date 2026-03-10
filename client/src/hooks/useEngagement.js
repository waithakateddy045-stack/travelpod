import { useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';

export function useEngagement(initialPost) {
    const [post, setPost] = useState(initialPost);
    const [loading, setLoading] = useState(false);

    const handleLike = async () => {
        if (!post) return;
        const originalPost = { ...post };
        // Optimistic update
        setPost(prev => ({ 
            ...prev, 
            isLiked: !prev.isLiked, 
            likeCount: prev.isLiked ? Math.max(0, (prev.likeCount || 0) - 1) : (prev.likeCount || 0) + 1 
        }));

        try {
            if (originalPost.isLiked) {
                await api.delete(`/engagement/like/${post.id}`);
            } else {
                await api.post(`/engagement/like/${post.id}`);
            }
        } catch (err) {
            setPost(originalPost); // Rollback
            toast.error('Failed to update like');
        }
    };

    const handleSave = async (boardId = null) => {
        if (!post) return;
        const originalPost = { ...post };
        
        if (!boardId) {
            // Optimistic toggle for general save
            setPost(prev => ({ 
                ...prev, 
                isSaved: !prev.isSaved, 
                saveCount: prev.isSaved ? Math.max(0, (prev.saveCount || 0) - 1) : (prev.saveCount || 0) + 1 
            }));
        }

        try {
            if (boardId) {
                await api.post(`/boards/${boardId}/videos`, { postId: post.id });
                toast.success('Saved to board');
            } else {
                if (originalPost.isSaved) {
                    await api.delete(`/engagement/save/${post.id}`);
                } else {
                    await api.post(`/engagement/save/${post.id}`);
                    toast.success('Saved to profile');
                }
            }
        } catch (err) {
            if (!boardId) setPost(originalPost); // Rollback
            toast.error('Failed to save');
        }
    };

    const handleRepost = async () => {
        if (!post) return;
        try {
            await api.post(`/posts/${post.id}/repost`);
            setPost(prev => ({ ...prev, repostCount: (prev.repostCount || 0) + 1 }));
            toast.success('Added to your feed');
        } catch (err) {
            toast.error('Failed to repost');
        }
    };

    const sharePost = () => {
        if (!post) return;
        const url = `${window.location.origin}/post/${post.id}`;
        navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
        if (navigator.share) {
            navigator.share({
                title: post.title,
                text: post.description,
                url: url
            }).catch(() => {});
        }
    };

    return {
        post,
        setPost,
        handleLike,
        handleSave,
        handleRepost,
        sharePost,
        loading
    };
}
