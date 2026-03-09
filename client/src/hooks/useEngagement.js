import { useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';

export function useEngagement(initialPost) {
    const [post, setPost] = useState(initialPost);
    const [loading, setLoading] = useState(false);

    const handleLike = async () => {
        if (!post) return;
        try {
            if (post.isLiked) {
                await api.delete(`/engagement/like/${post.id}`);
                setPost(prev => ({ ...prev, isLiked: false, likeCount: Math.max(0, (prev.likeCount || 0) - 1) }));
            } else {
                await api.post(`/engagement/like/${post.id}`);
                setPost(prev => ({ ...prev, isLiked: true, likeCount: (prev.likeCount || 0) + 1 }));
            }
        } catch (err) {
            toast.error('Failed to update like');
        }
    };

    const handleSave = async (boardId = null) => {
        if (!post) return;
        try {
            if (boardId) {
                // Save to specific board
                await api.post(`/boards/${boardId}/videos`, { postId: post.id });
                toast.success('Saved to board');
            } else {
                // Toggle general save
                if (post.isSaved) {
                    await api.delete(`/engagement/save/${post.id}`);
                    setPost(prev => ({ ...prev, isSaved: false, saveCount: Math.max(0, (prev.saveCount || 0) - 1) }));
                } else {
                    await api.post(`/engagement/save/${post.id}`);
                    setPost(prev => ({ ...prev, isSaved: true, saveCount: (prev.saveCount || 0) + 1 }));
                    toast.success('Saved to profile');
                }
            }
        } catch (err) {
            toast.error('Failed to save');
        }
    };

    const handleRepost = async () => {
        if (!post) return;
        setLoading(true);
        try {
            await api.post(`/posts/${post.id}/repost`);
            toast.success('Added to your feed!');
        } catch (err) {
            toast.error('Failed to repost');
        } finally {
            setLoading(false);
        }
    };

    return {
        post,
        setPost,
        handleLike,
        handleSave,
        handleRepost,
        loading
    };
}
