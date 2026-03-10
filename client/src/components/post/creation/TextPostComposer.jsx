import React, { useState, useEffect, useRef } from 'react';
import {
    HiOutlinePencilSquare,
    HiOutlineSparkles,
    HiOutlineMapPin,
    HiOutlineTag,
    HiOutlinePhoto,
    HiOutlineStar,
    HiOutlineCheck,
    HiOutlineMagnifyingGlass,
    HiOutlineXMark
} from 'react-icons/hi2';
import { toast } from 'react-hot-toast';
import api from '../../../services/api';
import './TextPostComposer.css';

const CATEGORIES = ['Destinations', 'Hotels & Resorts', 'Travel Tips', 'Culture', 'Food & Drink'];

export default function TextPostComposer({ onComplete, onCancel }) {
    const [textContent, setTextContent] = useState('');
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [location, setLocation] = useState('');
    const [category, setCategory] = useState('');

    // Business Review toggle
    const [isReview, setIsReview] = useState(false);
    const [starRating, setStarRating] = useState(5);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        if (!isReview) {
            setSelectedBusiness(null);
            setSearchQuery('');
        }
    }, [isReview]);

    const handleSearch = async (val) => {
        setSearchQuery(val);
        if (val.length < 2) return setSearchResults([]);
        setIsSearching(true);
        try {
            const res = await api.get(`/search?q=${val}&type=users`);
            // Filter only businesses
            const businesses = res.data.results.filter(r => r.user?.accountType !== 'TRAVELER');
            setSearchResults(businesses);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleGenerateAI = async () => {
        if (!textContent.trim()) return toast.error("Write something first!");
        setAiLoading(true);
        try {
            const res = await api.post('/ai/generate-details', {
                type: 'TEXT',
                context: textContent
            });
            if (res.data.success) {
                const { data } = res.data;
                // Suggest title if none
                if (!title) setTitle(data.title || '');
                setTags([...new Set([...tags, ...(data.tags || [])])]);
                if (!category) setCategory(data.category || '');
                toast.success("✨ AI suggestions applied!");
            }
        } catch (err) {
            toast.error("AI service unavailable");
        } finally {
            setAiLoading(false);
        }
    };

    const handlePublish = async () => {
        if (!textContent.trim()) return toast.error("Content cannot be empty");
        if (isReview && !selectedBusiness) return toast.error("Please select a business to review");

        setUploading(true);
        try {
            const res = await api.post('/posts', {
                postType: 'TEXT',
                title: title || textContent.substring(0, 50),
                textContent,
                tags: tags.join(','),
                locationTag: location,
                category,
                isReview: isReview,
                businessId: selectedBusiness?.handle, // Assuming handle works or we need userId
                starRating: isReview ? starRating : null
            });
            if (res.data.success) {
                toast.success("✍️ Published!");
                onComplete?.(res.data.post);
            }
        } catch (err) {
            toast.error("Publication failed");
            setUploading(false);
        }
    };

    return (
        <div className="composer-container">
            <div className="composer-header">
                <button className="close-btn-ghost" onClick={onCancel}>Cancel</button>
                <h2>New Post</h2>
                <button className="publish-btn-sm" onClick={handlePublish} disabled={uploading || !textContent.trim()}>
                    {uploading ? '...' : 'Post'}
                </button>
            </div>

            <div className="composer-body">
                <textarea
                    className="main-text-area"
                    placeholder="What's happening in your travel world?"
                    value={textContent}
                    onChange={e => setTextContent(e.target.value)}
                    autoFocus
                />

                <div className="composer-toolbar">
                    <button className="tool-btn" onClick={handleGenerateAI} disabled={aiLoading} title="AI Suggest">
                        <HiOutlineSparkles style={{ color: 'var(--accent-primary)' }} />
                        <span>AI Suggest</span>
                    </button>
                    <div className="tool-spacer" />
                    <button className={`tool-btn ${isReview ? 'active' : ''}`} onClick={() => setIsReview(!isReview)}>
                        <HiOutlineStar />
                        <span>Review</span>
                    </button>
                </div>

                {isReview && (
                    <div className="review-extension slide-in">
                        <div className="rating-row">
                            <span>Rate:</span>
                            {[1, 2, 3, 4, 5].map(s => (
                                <button key={s} onClick={() => setStarRating(s)}>
                                    {s <= starRating ? <HiOutlineStar style={{ fill: 'gold', stroke: 'gold' }} /> : <HiOutlineStar />}
                                </button>
                            ))}
                        </div>

                        {selectedBusiness ? (
                            <div className="selected-business-pill">
                                <span>Reviewing <b>@{selectedBusiness.handle}</b></span>
                                <button onClick={() => setSelectedBusiness(null)}><HiOutlineXMark /></button>
                            </div>
                        ) : (
                            <div className="business-search-wrap">
                                <HiOutlineMagnifyingGlass className="search-icon" />
                                <input
                                    placeholder="Search business to review..."
                                    value={searchQuery}
                                    onChange={e => handleSearch(e.target.value)}
                                />
                                {searchResults.length > 0 && (
                                    <div className="search-dropdown">
                                        {searchResults.map(b => (
                                            <div key={b.handle} className="search-result-item" onClick={() => setSelectedBusiness(b)}>
                                                <img src={b.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${b.handle}`} alt="" />
                                                <div className="res-info">
                                                    <span>{b.displayName}</span>
                                                    <small>@{b.handle}</small>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="meta-footer">
                    <div className="tp-input-group compact">
                        <label><HiOutlineMapPin /> Location</label>
                        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Where?" />
                    </div>
                    <div className="tp-input-group compact">
                        <label><HiOutlinePhoto /> Category</label>
                        <select value={category} onChange={e => setCategory(e.target.value)}>
                            <option value="">None</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                <div className="tag-section-composer">
                    <HiOutlineTag />
                    <div className="composer-tags">
                        {tags.map(t => <span key={t} className="tag-pill">#{t} <button onClick={() => setTags(tags.filter(x => x !== t))}>×</button></span>)}
                        <input
                            placeholder="Add tags..."
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && tagInput.trim()) {
                                    setTags([...new Set([...tags, tagInput.trim().replace(/^#/, '')])]);
                                    setTagInput('');
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
