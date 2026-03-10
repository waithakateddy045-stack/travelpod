import React, { useState } from 'react';
import {
    HiOutlineXMark,
    HiOutlineStar,
    HiOutlineMapPin
} from 'react-icons/hi2';
import { toast } from 'react-hot-toast';
import api from '../../../services/api';
import './CreateReviewModal.css';

export default function CreateReviewModal({ post, onClose, onComplete }) {
    const [textContent, setTextContent] = useState('');
    const [starRating, setStarRating] = useState(5);
    const [location, setLocation] = useState('');
    const [uploading, setUploading] = useState(false);

    const handlePublish = async () => {
        if (!textContent.trim()) return toast.error("Write a quick review first!");

        setUploading(true);
        try {
            const res = await api.post('/posts', {
                postType: 'REVIEW',
                title: `Review: ${post.title}`,
                textContent,
                reviewOfId: post.id,
                starRating,
                locationTag: location,
                businessId: post.author?.handle // Linking to post author as business if applicable
            });

            if (res.data.success) {
                toast.success("✍️ Review shared!");
                onComplete?.(res.data.post);
                onClose();
            }
        } catch (err) {
            toast.error("Failed to share review");
            setUploading(false);
        }
    };

    return (
        <div className="review-modal-overlay" onClick={onClose}>
            <div className="review-modal-content" onClick={e => e.stopPropagation()}>
                <div className="rev-modal-header">
                    <h2>Share a Review</h2>
                    <button className="close-rev-btn" onClick={onClose}><HiOutlineXMark /></button>
                </div>

                <div className="original-post-reference">
                    <img src={post.thumbnailUrl || post.mediaUrls?.[0]} alt="" />
                    <div className="ref-info">
                        <strong>{post.title}</strong>
                        <span>by @{post.author?.profile?.handle}</span>
                    </div>
                </div>

                <div className="rev-body">
                    <div className="rev-rating-section">
                        <span>How was it?</span>
                        <div className="stars-input">
                            {[1, 2, 3, 4, 5].map(s => (
                                <button key={s} onClick={() => setStarRating(s)}>
                                    {s <= starRating ? <HiOutlineStar style={{ fill: 'gold', stroke: 'gold' }} /> : <HiOutlineStar />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <textarea
                        className="rev-textarea"
                        placeholder="Write your thoughts..."
                        value={textContent}
                        onChange={e => setTextContent(e.target.value)}
                        autoFocus
                    />

                    <div className="tp-input-group compact">
                        <label><HiOutlineMapPin /> Location Tag</label>
                        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Where was this?" />
                    </div>
                </div>

                <div className="rev-footer">
                    <button className="action-btn-main" onClick={handlePublish} disabled={uploading || !textContent.trim()}>
                        {uploading ? 'Sharing...' : 'Share Review'}
                    </button>
                </div>
            </div>
        </div>
    );
}
