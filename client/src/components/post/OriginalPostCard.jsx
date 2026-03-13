import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HiCheckBadge, HiOutlineUser } from 'react-icons/hi2';
import './OriginalPostCard.css';

export default function OriginalPostCard({ post }) {
    const navigate = useNavigate();
    if (!post) return null;

    const author = post.author || post.user || {};
    const profile = author.profile || {
        displayName: author.displayName || author.username || 'Traveler',
        handle: author.username,
        avatarUrl: author.avatarUrl
    };
    const isVerified = !!profile.businessProfile?.verificationStatus || author.isVerified;

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/post/${post.id}`);
    };

    return (
        <div className="original-post-card" onClick={handleClick}>
            <div className="opc-content">
                <div className="opc-header">
                    <div className="opc-avatar">
                        {profile.avatarUrl ? (
                            <img src={profile.avatarUrl} alt="" />
                        ) : (
                            <HiOutlineUser />
                        )}
                    </div>
                    <div className="opc-author-info">
                        <span className="opc-name">
                            {profile.displayName}
                            {isVerified && <HiCheckBadge className="verified-badge-inline" />}
                        </span>
                        <span className="opc-handle">@{profile.handle}</span>
                    </div>
                </div>
                <div className="opc-body">
                    <h4 className="opc-title">{post.title}</h4>
                </div>
            </div>
            {(post.thumbnailUrl || (post.mediaUrls && post.mediaUrls[0])) && (
                <div className="opc-thumbnail">
                    <img src={post.thumbnailUrl || post.mediaUrls[0]} alt="" />
                </div>
            )}
        </div>
    );
}
