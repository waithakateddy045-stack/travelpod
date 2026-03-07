import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    HiOutlineCloudArrowUp, HiOutlineFilm,
    HiOutlineMapPin, HiOutlineTag, HiOutlineArrowLeft,
    HiOutlineStar, HiStar, HiOutlineMagnifyingGlass,
    HiOutlinePhoto,
} from 'react-icons/hi2';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './UploadPage.css';
import '../auth/AuthPage.css';

const CATEGORIES = [
    'Destinations', 'Hotels & Resorts', 'Restaurants & Food',
    'Adventures & Activities', 'Travel Tips', 'Flight Reviews',
    'Safari', 'Beach', 'City Life', 'Culture & History', 'Nightlife', 'Wellness',
];

const SECTORS = [
    { id: 'TRAVELER', label: 'Travelers' },
    { id: 'TRAVEL_AGENCY', label: 'Travel Agencies' },
    { id: 'HOTEL_RESORT', label: 'Hotels & Resorts' },
    { id: 'DESTINATION', label: 'Destinations' },
    { id: 'AIRLINE', label: 'Airlines' },
    { id: 'ASSOCIATION', label: 'Associations' },
];

const REGIONS = ['East Africa', 'West Africa', 'Southern Africa', 'Northern Africa', 'Europe', 'North America', 'Asia', 'Middle East', 'Global'];

export default function UploadPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);

    const [videoFile, setVideoFile] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    const [videoDuration, setVideoDuration] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Review toggle state
    const [isReview, setIsReview] = useState(false);
    const [starRating, setStarRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [businessQuery, setBusinessQuery] = useState('');
    const [businessResults, setBusinessResults] = useState([]);
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [searchingBusiness, setSearchingBusiness] = useState(false);

    // Thumbnail state (frame selection)
    const [thumbnailTime, setThumbnailTime] = useState(0);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);

    // Broadcast mode state
    const [postMode, setPostMode] = useState('VIDEO'); // 'VIDEO' or 'BROADCAST'
    const [targetSectors, setTargetSectors] = useState([]);
    const [targetRegion, setTargetRegion] = useState('Global');

    const canBroadcast = user?.accountType === 'ASSOCIATION' || user?.accountType === 'ADMIN';

    const [form, setForm] = useState({
        title: '',
        description: '',
        category: '',
        location: '',
        tags: '',
    });

    // ─── Video file handling ───────────────────────────────────
    const handleFileDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
        if (!file) return;
        if (file.size > 200 * 1024 * 1024) { toast.error('Video must be under 200MB'); return; }
        if (!file.type.startsWith('video/')) { toast.error('Please select a video file'); return; }
        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(file));
        setThumbnailPreview(null);
    };

    const handleVideoLoaded = () => {
        const v = videoRef.current;
        if (!v) return;
        setVideoDuration(v.duration || 0);
    };

    // ─── Thumbnail capture ────────────────────────────────────
    const captureThumbnail = useCallback(() => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = thumbnailTime;
        const onSeeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            canvas.getContext('2d').drawImage(v, 0, 0);
            setThumbnailPreview(canvas.toDataURL('image/jpeg', 0.8));
            v.removeEventListener('seeked', onSeeked);
        };
        v.addEventListener('seeked', onSeeked);
    }, [thumbnailTime]);

    // ─── Business search (debounced) ──────────────────────────
    const searchBusinesses = useCallback(async (q) => {
        if (q.length < 2) { setBusinessResults([]); return; }
        setSearchingBusiness(true);
        try {
            const { data } = await api.get(`/search?q=${encodeURIComponent(q)}&type=users`);
            // Filter to only business account types
            const biz = (data.results || []).filter(r =>
                ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'].includes(r.user?.accountType)
            );
            setBusinessResults(biz);
        } catch { setBusinessResults([]); }
        finally { setSearchingBusiness(false); }
    }, []);

    // ─── Submit ───────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        const isBroadcast = postMode === 'BROADCAST';

        if (isBroadcast && !canBroadcast) {
            toast.error('Only associations can send broadcasts');
            return;
        }

        if (!videoFile && !isBroadcast) { toast.error('Please select a video'); return; }
        if (!form.title.trim()) { toast.error('Title is required'); return; }
        if (isReview && !selectedBusiness) { toast.error('Please select the business you are reviewing'); return; }
        if (isReview && !starRating) { toast.error('Please give a star rating'); return; }

        setUploading(true);
        setUploadProgress(0);

        const fd = new FormData();
        if (videoFile) fd.append('video', videoFile);
        fd.append('title', form.title.trim());
        if (form.description) fd.append('description', form.description.trim());
        if (form.category) fd.append('category', form.category);
        if (form.location) fd.append('locationTag', form.location.trim());
        if (form.tags) fd.append('tags', form.tags.trim());

        if (isBroadcast) {
            fd.append('postType', 'BROADCAST');
            fd.append('sectorTargeting', JSON.stringify(targetSectors));
            fd.append('region', targetRegion);
        } else if (isReview && selectedBusiness) {
            fd.append('isReview', 'true');
            fd.append('businessId', selectedBusiness.userId);
            fd.append('starRating', String(starRating));
            fd.append('postType', 'REVIEW');
        }

        try {
            await api.post('/posts', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (evt) => {
                    const pct = Math.round((evt.loaded * 100) / evt.total);
                    setUploadProgress(pct);
                },
            });

            if (isBroadcast) {
                toast.success('Broadcast published! Targeted members will see it in their feed.');
            } else {
                toast.success('Video uploaded! It will appear once reviewed.');
            }
            navigate('/feed', { replace: true });
        } catch (err) {
            toast.error(err.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="upload-page">
            <div className="upload-container">
                <div className="upload-header">
                    <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>
                        <HiOutlineArrowLeft />
                    </button>
                    <h1>{postMode === 'BROADCAST' ? 'Compose Broadcast' : 'Upload Video'}</h1>
                </div>

                {/* Mode Selector */}
                {canBroadcast && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', background: 'var(--bg-secondary)', padding: 4, borderRadius: 'var(--radius-lg)' }}>
                        <button
                            type="button"
                            onClick={() => setPostMode('VIDEO')}
                            style={{
                                flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                                background: postMode === 'VIDEO' ? 'var(--color-primary)' : 'transparent',
                                color: postMode === 'VIDEO' ? 'white' : 'var(--text-secondary)',
                                fontWeight: 600, fontSize: 'var(--text-sm)', transition: 'all 0.2s'
                            }}
                        >
                            Video Post
                        </button>
                        <button
                            type="button"
                            onClick={() => setPostMode('BROADCAST')}
                            style={{
                                flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                                background: postMode === 'BROADCAST' ? 'var(--color-primary)' : 'transparent',
                                color: postMode === 'BROADCAST' ? 'white' : 'var(--text-secondary)',
                                fontWeight: 600, fontSize: 'var(--text-sm)', transition: 'all 0.2s'
                            }}
                        >
                            Broadcast Post
                        </button>
                    </div>
                )}

                {/* Dropzone / Preview (Optional for Broadcast) */}
                {(!videoPreview && (postMode === 'VIDEO' || (postMode === 'BROADCAST' && !videoFile))) ? (
                    <div
                        className={`upload-dropzone${dragOver ? ' drag-over' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleFileDrop}
                        style={{ opacity: postMode === 'BROADCAST' ? 0.7 : 1 }}
                    >
                        <HiOutlineCloudArrowUp />
                        <p>{postMode === 'BROADCAST' ? 'Click to add video (Optional)' : 'Drag & drop your video here'}</p>
                        <p className="hint">MP4, MOV, AVI — max 200MB</p>
                        <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleFileDrop} />
                    </div>
                ) : videoPreview ? (
                    <div className="upload-preview">
                        <video
                            ref={videoRef}
                            src={videoPreview}
                            controls
                            playsInline
                            onLoadedMetadata={handleVideoLoaded}
                        />
                        <button className="upload-change" onClick={() => { setVideoFile(null); setVideoPreview(null); setThumbnailPreview(null); }}>
                            Change
                        </button>
                    </div>
                ) : null}

                {/* Thumbnail Selector (only if video loaded) */}
                {videoPreview && videoDuration > 0 && (
                    <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
                        <label className="form-label"><HiOutlinePhoto style={{ marginRight: 4, verticalAlign: 'middle' }} /> Thumbnail</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <input
                                type="range"
                                min={0}
                                max={videoDuration}
                                step={0.1}
                                value={thumbnailTime}
                                onChange={e => setThumbnailTime(Number(e.target.value))}
                                style={{ flex: 1 }}
                            />
                            <button
                                type="button"
                                onClick={captureThumbnail}
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-md)', padding: '4px 12px', cursor: 'pointer', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}
                            >
                                Capture Frame
                            </button>
                        </div>
                        {thumbnailPreview && (
                            <div style={{ marginTop: 'var(--space-2)' }}>
                                <img src={thumbnailPreview} alt="Thumbnail preview" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }} />
                                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 4 }}>Custom thumbnail selected ✓</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Form */}
                <form className="upload-form" onSubmit={handleSubmit}>
                    <div className="form-field">
                        <label className="form-label">Title *</label>
                        <input
                            id="upload-title"
                            className="form-input"
                            placeholder="Give your video a catchy title"
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            maxLength={120}
                        />
                    </div>

                    <div className="form-field">
                        <label className="form-label">{postMode === 'BROADCAST' ? 'Message Body' : 'Description'}</label>
                        <textarea
                            className="form-input"
                            placeholder={postMode === 'BROADCAST' ? "Share your thoughts, news, or updates here..." : "Tell viewers about this video..."}
                            rows={6}
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    {postMode === 'BROADCAST' && (
                        <div style={{ padding: 'var(--space-4)', background: 'rgba(108,99,255,0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', marginBottom: 'var(--space-4)' }}>
                            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--color-primary)' }}>Target Audience</h3>

                            <div className="form-field">
                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Account Types</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {SECTORS.map(s => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => setTargetSectors(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                                            style={{
                                                padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)', cursor: 'pointer',
                                                background: targetSectors.includes(s.id) ? 'var(--color-primary)' : 'var(--bg-elevated)',
                                                color: targetSectors.includes(s.id) ? 'white' : 'var(--text-secondary)',
                                                border: '1px solid var(--border-primary)'
                                            }}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-field" style={{ marginTop: 'var(--space-3)' }}>
                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Region</label>
                                <select
                                    className="form-input"
                                    value={targetRegion}
                                    onChange={e => setTargetRegion(e.target.value)}
                                    style={{ fontSize: 'var(--text-sm)', height: 36 }}
                                >
                                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="form-field">
                        <label className="form-label"><HiOutlineFilm style={{ marginRight: 4, verticalAlign: 'middle' }} /> Category</label>
                        <select
                            className="form-input"
                            value={form.category}
                            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                            style={{ cursor: 'pointer' }}
                        >
                            <option value="">Select a category</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="form-field">
                        <label className="form-label"><HiOutlineMapPin style={{ marginRight: 4, verticalAlign: 'middle' }} /> Location</label>
                        <input
                            className="form-input"
                            placeholder="e.g. Nairobi, Kenya"
                            value={form.location}
                            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                        />
                    </div>

                    <div className="form-field">
                        <label className="form-label"><HiOutlineTag style={{ marginRight: 4, verticalAlign: 'middle' }} /> Tags</label>
                        <input
                            className="form-input"
                            placeholder="Comma separated: safari, wildlife, kenya"
                            value={form.tags}
                            onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                        />
                    </div>

                    {/* Review Toggle */}
                    <div className="form-field">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <label className="form-label" style={{ margin: 0 }}>This is a business review</label>
                            <button
                                id="upload-review-toggle"
                                type="button"
                                onClick={() => { setIsReview(r => !r); setSelectedBusiness(null); setStarRating(0); }}
                                style={{
                                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                                    background: isReview ? 'var(--color-primary)' : 'var(--border-primary)',
                                    position: 'relative', transition: 'background 0.2s',
                                }}
                            >
                                <span style={{
                                    position: 'absolute', top: 2, left: isReview ? 22 : 2,
                                    width: 20, height: 20, borderRadius: '50%', background: 'white',
                                    transition: 'left 0.2s', display: 'block',
                                }} />
                            </button>
                        </div>
                    </div>

                    {/* Review Fields (conditional) */}
                    {isReview && (
                        <>
                            <div className="form-field">
                                <label className="form-label"><HiOutlineMagnifyingGlass style={{ marginRight: 4, verticalAlign: 'middle' }} /> Search Business</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        id="upload-business-search"
                                        className="form-input"
                                        placeholder="Type hotel, agency, or destination name..."
                                        value={businessQuery}
                                        onChange={e => {
                                            setBusinessQuery(e.target.value);
                                            searchBusinesses(e.target.value);
                                            if (selectedBusiness) setSelectedBusiness(null);
                                        }}
                                        autoComplete="off"
                                    />
                                    {searchingBusiness && (
                                        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: 12 }}>Searching…</div>
                                    )}
                                    {businessResults.length > 0 && !selectedBusiness && (
                                        <div style={{
                                            position: 'absolute', top: '100%', left: 0, right: 0,
                                            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                                            borderRadius: 'var(--radius-md)', zIndex: 50, maxHeight: 200, overflowY: 'auto',
                                        }}>
                                            {businessResults.map(b => (
                                                <button
                                                    key={b.handle}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedBusiness(b);
                                                        setBusinessQuery(b.displayName);
                                                        setBusinessResults([]);
                                                    }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                                        padding: '10px 14px', border: 'none', background: 'none',
                                                        cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left',
                                                        borderBottom: '1px solid var(--border-primary)',
                                                    }}
                                                >
                                                    {b.avatarUrl ? <img src={b.avatarUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-elevated)' }} />}
                                                    <span style={{ fontWeight: 600 }}>{b.displayName}</span>
                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>@{b.handle}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {selectedBusiness && (
                                    <div style={{ marginTop: 6, color: 'var(--color-success)', fontSize: 'var(--text-sm)' }}>
                                        ✓ Reviewing: <strong>{selectedBusiness.displayName}</strong>
                                    </div>
                                )}
                            </div>

                            <div className="form-field">
                                <label className="form-label"><HiOutlineStar style={{ marginRight: 4, verticalAlign: 'middle' }} /> Star Rating</label>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <button
                                            key={n}
                                            type="button"
                                            id={`upload-star-${n}`}
                                            onClick={() => setStarRating(n)}
                                            onMouseEnter={() => setHoverRating(n)}
                                            onMouseLeave={() => setHoverRating(0)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: n <= (hoverRating || starRating) ? '#f5a623' : 'var(--border-primary)', fontSize: '1.5rem' }}
                                        >
                                            {n <= (hoverRating || starRating) ? <HiStar /> : <HiOutlineStar />}
                                        </button>
                                    ))}
                                    {starRating > 0 && (
                                        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', alignSelf: 'center', marginLeft: 6 }}>
                                            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][starRating]}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {uploading && (
                        <div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                                Uploading... {uploadProgress}%
                            </div>
                            <div className="upload-progress-bar">
                                <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
                            </div>
                        </div>
                    )}

                    <button
                        id="upload-submit"
                        type="submit"
                        className="auth-submit"
                        disabled={uploading || (!videoFile && postMode === 'VIDEO')}
                    >
                        {uploading ? 'Publishing...' : postMode === 'BROADCAST' ? 'Send Broadcast' : isReview ? 'Publish Review' : 'Publish Video'}
                    </button>
                </form>
            </div>
        </div>
    );
}
