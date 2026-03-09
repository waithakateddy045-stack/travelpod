import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    HiOutlineCloudArrowUp, HiOutlineFilm,
    HiOutlineMapPin, HiOutlineTag, HiOutlineArrowLeft,
    HiOutlineStar, HiStar, HiOutlineMagnifyingGlass,
    HiOutlinePhoto, HiOutlineScissors, HiOutlineClock,
    HiOutlineChevronRight, HiOutlineCheckCircle,
    HiOutlineChatBubbleLeft, HiOutlineAdjustmentsHorizontal,
    HiOutlineMusicalNote, HiOutlineGlobeAlt, HiOutlineSignal,
    HiOutlineUserGroup, HiOutlineArrowDownTray,
} from 'react-icons/hi2';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './UploadPage.css';

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

    // Wizard State
    const [step, setStep] = useState(1); // 1: Select, 2: Refine, 3: Details, 4: Thumbnail & Publish
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadEta, setUploadEta] = useState(null);
    const [uploadStartTime, setUploadStartTime] = useState(null);
    const [postId, setPostId] = useState(null);

    // Video State
    const [videoFile, setVideoFile] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    const [videoDuration, setVideoDuration] = useState(0);
    const [videoHash, setVideoHash] = useState(null);
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [importSource, setImportSource] = useState(null); // null | 'capcut'

    // Refinement State
    const [trimRange, setTrimRange] = useState({ start: 0, end: 0 });
    const [thumbnailTime, setThumbnailTime] = useState(0);
    const [smartThumbnails, setSmartThumbnails] = useState([]);
    const [selectedThumbnail, setSelectedThumbnail] = useState(null);

    // Metadata State
    const [form, setForm] = useState({
        title: '',
        description: '',
        category: '',
        location: '',
        tags: '',
        musicTitle: '',
        isReview: false,
        businessId: null,
        starRating: 0,
    });

    const [chapters, setChapters] = useState([{ time: 0, title: 'Introduction' }]);
    const [businessQuery, setBusinessQuery] = useState('');
    const [businessResults, setBusinessResults] = useState([]);
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [searchingBusiness, setSearchingBusiness] = useState(false);
    const [compressionStats, setCompressionStats] = useState(null);

    // Broadcast Mode
    const [postMode, setPostMode] = useState('VIDEO'); // 'VIDEO' or 'BROADCAST'
    const [targetSectors, setTargetSectors] = useState([]);
    const [targetRegion, setTargetRegion] = useState('Global');

    const canBroadcast = user?.accountType === 'ASSOCIATION' || user?.accountType === 'ADMIN';

    // ─── Utilities ──────────────────────────────────────────────
    const computeFileHash = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // ─── File Handling ──────────────────────────────────────────
    const handleFileSelect = async (e) => {
        const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
        if (!file) return;

        if (file.size > 500 * 1024 * 1024) {
            toast.error('Video must be under 500MB');
            return;
        }

        if (!file.type.startsWith('video/')) {
            toast.error('Please select a valid video file');
            return;
        }

        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(file));

        // Compute hash for duplicate check
        const hash = await computeFileHash(file);
        setVideoHash(hash);

        // Check for duplicates
        try {
            const { data } = await api.get(`/posts/check-duplicate?hash=${hash}`);
            if (data.isDuplicate) {
                setIsDuplicate(true);
                toast.error('Duplicate video detected! You already uploaded this.');
            }
        } catch (err) {
            console.warn('Duplicate check failed', err);
        }

        setStep(2);
    };

    const handleCapCutImport = () => {
        setImportSource('capcut');
        fileInputRef.current?.click();
    };

    const handleVideoLoaded = () => {
        const v = videoRef.current;
        if (!v) return;
        setVideoDuration(v.duration);
        setTrimRange({ start: 0, end: v.duration });
        setThumbnailTime(0);
    };

    const handleScrub = (e) => {
        const v = videoRef.current;
        if (!v) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        const time = pct * v.duration;
        v.currentTime = time;
        setThumbnailTime(time);
    };

    const addChapter = () => {
        setChapters([...chapters, { time: Math.floor(videoRef.current?.currentTime || 0), title: '' }]);
    };

    // ─── Business Search ────────────────────────────────────────
    const searchBusinesses = useCallback(async (q) => {
        if (q.length < 2) { setBusinessResults([]); return; }
        setSearchingBusiness(true);
        try {
            const { data } = await api.get(`/search?q=${encodeURIComponent(q)}&type=users`);
            const biz = (data.results || []).filter(r =>
                ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'].includes(r.user?.accountType)
            );
            setBusinessResults(biz);
        } catch { setBusinessResults([]); }
        finally { setSearchingBusiness(false); }
    }, []);

    // ─── Sector Toggle ──────────────────────────────────────────
    const toggleSector = (sectorId) => {
        setTargetSectors(prev =>
            prev.includes(sectorId) ? prev.filter(s => s !== sectorId) : [...prev, sectorId]
        );
    };

    // ─── Submission ─────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!videoFile && postMode === 'VIDEO') return;
        if (!form.title.trim()) { toast.error('Title is required'); return; }

        setUploading(true);
        setUploadProgress(0);
        setUploadStartTime(Date.now());

        const fd = new FormData();
        fd.append('video', videoFile);
        fd.append('title', form.title);
        fd.append('description', form.description);
        fd.append('category', form.category);
        fd.append('locationTag', form.location);
        fd.append('tags', form.tags);
        fd.append('musicTitle', form.musicTitle);
        fd.append('startTime', trimRange.start);
        fd.append('endTime', trimRange.end);
        fd.append('thumbnailTime', thumbnailTime);
        fd.append('chapters', JSON.stringify(chapters));
        fd.append('perceptualHash', videoHash);

        if (postMode === 'BROADCAST') {
            fd.append('postType', 'BROADCAST');
        }

        if (form.isReview && selectedBusiness) {
            fd.append('isReview', 'true');
            fd.append('businessId', selectedBusiness.userId);
            fd.append('starRating', form.starRating);
        }

        try {
            let response;

            if (postMode === 'BROADCAST') {
                // Use broadcast endpoint
                response = await api.post('/broadcasts', fd, {
                    onUploadProgress: (evt) => {
                        const pct = Math.round((evt.loaded * 100) / evt.total);
                        setUploadProgress(pct);
                        const elapsed = (Date.now() - (uploadStartTime || Date.now())) / 1000;
                        if (pct > 5 && elapsed > 0) {
                            const rate = evt.loaded / elapsed;
                            const remaining = (evt.total - evt.loaded) / rate;
                            setUploadEta(Math.round(remaining));
                        }
                    }
                });
                toast.success('Broadcast sent successfully!');
                navigate('/feed');
                return;
            }

            response = await api.post('/posts', fd, {
                onUploadProgress: (evt) => {
                    const pct = Math.round((evt.loaded * 100) / evt.total);
                    setUploadProgress(pct);
                    const elapsed = (Date.now() - (uploadStartTime || Date.now())) / 1000;
                    if (pct > 5 && elapsed > 0) {
                        const rate = evt.loaded / elapsed;
                        const remaining = (evt.total - evt.loaded) / rate;
                        setUploadEta(Math.round(remaining));
                    }
                }
            });

            const { post, compressionStats: stats } = response.data;
            setPostId(post.id);
            setCompressionStats(stats);

            if (response.data.smartThumbnails) {
                setSmartThumbnails(response.data.smartThumbnails);
            }

            setStep(4);
            if (response.data.smartThumbnails?.length > 0) {
                setSelectedThumbnail(response.data.smartThumbnails[0]);
            }
            toast.success('Video processed successfully!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Upload failed');
            setUploading(false);
        }
    };

    const handleFinalPublish = async () => {
        if (!selectedThumbnail || !postId) {
            navigate('/feed');
            return;
        }

        try {
            await api.patch(`/posts/${postId}`, { thumbnailUrl: selectedThumbnail });
            navigate('/feed');
            toast.success('Post published with custom thumbnail!');
        } catch (err) {
            console.error('Failed to save thumbnail:', err);
            navigate('/feed');
        }
    };

    // ─── Step Indicator ─────────────────────────────────────────
    const renderStepIndicator = () => (
        <div className="step-indicator">
            {[1, 2, 3, 4].map(s => (
                <div key={s} className={`step-dot ${step === s ? 'active' : step > s ? 'completed' : ''}`} />
            ))}
        </div>
    );

    return (
        <div className="upload-page">
            <div className="upload-container">
                <div className="upload-header">
                    <div className="upload-header-left">
                        <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)} className="btn-icon">
                            <HiOutlineArrowLeft />
                        </button>
                        <h1>{step === 1 ? 'Create' : postMode === 'BROADCAST' ? 'Compose Broadcast' : 'Upload Video'}</h1>
                    </div>
                </div>

                {renderStepIndicator()}

                {/* ═══════════════════════════════════════════════════
                   STEP 1 — Select Source
                   ═══════════════════════════════════════════════════ */}
                {step === 1 && (
                    <div className="step-content">
                        {/* Mode toggle for broadcast-capable users */}
                        {canBroadcast && (
                            <div className="mode-toggle">
                                <button
                                    className={`mode-toggle-btn ${postMode === 'VIDEO' ? 'active' : ''}`}
                                    onClick={() => setPostMode('VIDEO')}
                                >
                                    <HiOutlineFilm /> Video Post
                                </button>
                                <button
                                    className={`mode-toggle-btn ${postMode === 'BROADCAST' ? 'active' : ''}`}
                                    onClick={() => setPostMode('BROADCAST')}
                                >
                                    <HiOutlineSignal /> Broadcast
                                </button>
                            </div>
                        )}

                        <div
                            className="upload-dropzone"
                            onClick={() => fileInputRef.current.click()}
                            onDragOver={e => e.preventDefault()}
                            onDrop={handleFileSelect}
                        >
                            <HiOutlineCloudArrowUp />
                            <span className="dropzone-title">Select video to upload</span>
                            <span className="dropzone-subtitle">Or drag and drop a file</span>
                            <span className="dropzone-hint">MP4 or WebM • 9:16 recommended • Max 500MB</span>
                            <input ref={fileInputRef} type="file" accept="video/*" hidden onChange={handleFileSelect} />
                        </div>

                        <div className="import-options">
                            <button className="import-btn capcut" onClick={handleCapCutImport}>
                                <HiOutlineArrowDownTray />
                                <div className="import-btn-text">
                                    <span className="import-label">Import from CapCut</span>
                                    <span className="import-hint">Import your edited CapCut project</span>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                   STEP 2 — Refine (Trim + Cover Frame)
                   ═══════════════════════════════════════════════════ */}
                {step === 2 && (
                    <div className="step-content video-refine-container">
                        <div className="video-preview-large">
                            <video
                                ref={videoRef}
                                src={videoPreview}
                                onLoadedMetadata={handleVideoLoaded}
                                playsInline
                                muted
                                loop
                            />
                            {importSource === 'capcut' && (
                                <div className="import-badge">CapCut Import</div>
                            )}
                        </div>

                        <div className="refine-controls">
                            <div className="control-group">
                                <label className="control-label">
                                    <span><HiOutlineScissors /> Trimming</span>
                                    <span>{formatTime(trimRange.start)} – {formatTime(trimRange.end)}</span>
                                </label>
                                <div className="trim-slider">
                                    <input
                                        type="range"
                                        min={0}
                                        max={videoDuration}
                                        step={0.1}
                                        value={trimRange.start}
                                        onChange={e => setTrimRange({ ...trimRange, start: parseFloat(e.target.value) })}
                                        className="scrub-slider"
                                    />
                                    <input
                                        type="range"
                                        min={0}
                                        max={videoDuration}
                                        step={0.1}
                                        value={trimRange.end}
                                        onChange={e => setTrimRange({ ...trimRange, end: parseFloat(e.target.value) })}
                                        className="scrub-slider"
                                    />
                                </div>
                            </div>

                            <div className="control-group">
                                <label className="control-label">
                                    <span><HiOutlinePhoto /> Set Cover Frame</span>
                                    <span>{formatTime(thumbnailTime)}</span>
                                </label>
                                <div className="scrubber-bar" onClick={handleScrub} onTouchMove={handleScrub}>
                                    <div className="scrubber-track-fill" style={{ width: `${(thumbnailTime / (videoDuration || 1)) * 100}%` }} />
                                    <div className="scrubber-handle" style={{ left: `${(thumbnailTime / (videoDuration || 1)) * 100}%` }} />
                                </div>
                                <button className="btn-ghost" onClick={() => { if (videoRef.current) videoRef.current.currentTime = thumbnailTime; }}>
                                    Preview Frame
                                </button>
                            </div>
                        </div>

                        <div className="upload-footer">
                            <button className="btn-next" onClick={() => setStep(3)}>Continue <HiOutlineChevronRight /></button>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                   STEP 3 — Details & Targeting
                   ═══════════════════════════════════════════════════ */}
                {step === 3 && (
                    <div className="step-content form-section">
                        {/* Title */}
                        <div className="input-group">
                            <label className="input-label">Title *</label>
                            <input
                                className="premium-input"
                                placeholder="Give your video a catchy title..."
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                maxLength={100}
                            />
                        </div>

                        {/* Description */}
                        <div className="input-group">
                            <label className="input-label">Description</label>
                            <textarea
                                className="premium-input"
                                rows={3}
                                placeholder="Tell us more about this experience..."
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                maxLength={500}
                            />
                        </div>

                        {/* Category */}
                        <div className="input-group">
                            <label className="input-label"><HiOutlineAdjustmentsHorizontal /> Category</label>
                            <div className="category-chips">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        className={`category-chip ${form.category === cat ? 'active' : ''}`}
                                        onClick={() => setForm({ ...form, category: cat })}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Location */}
                        <div className="input-group">
                            <label className="input-label"><HiOutlineMapPin /> Location Tag</label>
                            <input
                                className="premium-input"
                                placeholder="e.g. Maasai Mara, Zanzibar, Dubai..."
                                value={form.location}
                                onChange={e => setForm({ ...form, location: e.target.value })}
                            />
                        </div>

                        {/* Tags */}
                        <div className="input-group">
                            <label className="input-label"><HiOutlineTag /> Tags</label>
                            <input
                                className="premium-input"
                                placeholder="safari, travel, adventure (comma-separated)"
                                value={form.tags}
                                onChange={e => setForm({ ...form, tags: e.target.value })}
                            />
                        </div>

                        {/* Music Title */}
                        <div className="input-group">
                            <label className="input-label"><HiOutlineMusicalNote /> Music / Sound</label>
                            <input
                                className="premium-input"
                                placeholder="Original sound or song name..."
                                value={form.musicTitle}
                                onChange={e => setForm({ ...form, musicTitle: e.target.value })}
                            />
                        </div>

                        {/* Video Chapters */}
                        <div className="input-group">
                            <label className="input-label"><HiOutlineClock /> Video Chapters</label>
                            <div className="chapters-container">
                                {chapters.map((c, i) => (
                                    <div key={i} className="chapter-item">
                                        <input className="premium-input chapter-time" value={formatTime(c.time)} readOnly />
                                        <input
                                            className="premium-input"
                                            placeholder="Chapter title..."
                                            value={c.title}
                                            onChange={e => {
                                                const newChapters = [...chapters];
                                                newChapters[i].title = e.target.value;
                                                setChapters(newChapters);
                                            }}
                                            style={{ flex: 1 }}
                                        />
                                    </div>
                                ))}
                                <button onClick={addChapter} className="btn-ghost chapter-add">+ Add Chapter at Current Frame</button>
                            </div>
                        </div>

                        {/* Business Review Toggle */}
                        <div className="input-group">
                            <label className="toggle-row" onClick={() => setForm({ ...form, isReview: !form.isReview })}>
                                <span className="input-label"><HiOutlineStar /> Review a Business</span>
                                <div className={`toggle-switch ${form.isReview ? 'active' : ''}`}>
                                    <div className="toggle-knob" />
                                </div>
                            </label>

                            {form.isReview && (
                                <div className="review-section">
                                    <div className="star-rating">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <button key={s} onClick={() => setForm({ ...form, starRating: s })} className="star-btn">
                                                {s <= form.starRating ? <HiStar className="star-filled" /> : <HiOutlineStar />}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        className="premium-input"
                                        placeholder="Search business to review..."
                                        value={businessQuery}
                                        onChange={e => { setBusinessQuery(e.target.value); searchBusinesses(e.target.value); }}
                                    />
                                    {businessResults.length > 0 && (
                                        <div className="business-results">
                                            {businessResults.map(r => (
                                                <button
                                                    key={r.userId}
                                                    className={`business-result-item ${selectedBusiness?.userId === r.userId ? 'active' : ''}`}
                                                    onClick={() => { setSelectedBusiness(r); setBusinessQuery(r.displayName || r.handle); setBusinessResults([]); }}
                                                >
                                                    {r.displayName || r.handle}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Broadcast Targeting (associations/admins only) ── */}
                        {postMode === 'BROADCAST' && canBroadcast && (
                            <div className="broadcast-targeting">
                                <h3 className="targeting-title"><HiOutlineUserGroup /> Broadcast Targeting</h3>

                                <div className="input-group">
                                    <label className="input-label">Target Audience</label>
                                    <div className="sector-chips">
                                        {SECTORS.map(s => (
                                            <button
                                                key={s.id}
                                                className={`sector-chip ${targetSectors.includes(s.id) ? 'active' : ''}`}
                                                onClick={() => toggleSector(s.id)}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="input-hint">{targetSectors.length === 0 ? 'All users (no filter)' : `Targeting: ${targetSectors.length} sector(s)`}</span>
                                </div>

                                <div className="input-group">
                                    <label className="input-label"><HiOutlineGlobeAlt /> Region</label>
                                    <select
                                        className="premium-input premium-select"
                                        value={targetRegion}
                                        onChange={e => setTargetRegion(e.target.value)}
                                    >
                                        {REGIONS.map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="upload-footer">
                            <button className="btn-prev" onClick={() => setStep(2)}>Back</button>
                            <button className="btn-next" onClick={handleSubmit} disabled={uploading || !form.title.trim()}>
                                {uploading ? 'Processing...' : postMode === 'BROADCAST' ? 'Send Broadcast' : 'Upload & Proceed'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                   STEP 4 — Thumbnail Selection & Publish
                   ═══════════════════════════════════════════════════ */}
                {step === 4 && (
                    <div className="step-content form-section">
                        <h2 className="section-heading">Choose a Thumbnail</h2>
                        <p className="section-subtext">Smart thumbnails generated from your video</p>

                        <div className="thumbnail-options">
                            {smartThumbnails.length > 0 ? (
                                smartThumbnails.map((url, i) => (
                                    <div
                                        key={i}
                                        className={`thumbnail-option ${selectedThumbnail === url ? 'active' : ''}`}
                                        onClick={() => setSelectedThumbnail(url)}
                                    >
                                        <img src={url} alt={`Thumbnail ${i + 1}`} />
                                        <span className="thumbnail-label">{['10%', '50%', '90%'][i] || `#${i + 1}`}</span>
                                    </div>
                                ))
                            ) : (
                                [1, 2, 3].map(i => (
                                    <div key={i} className="thumbnail-option placeholder">
                                        <HiOutlinePhoto className="placeholder-icon" />
                                    </div>
                                ))
                            )}
                        </div>

                        {compressionStats && (
                            <div className="compression-stats">
                                <div className="compression-header">
                                    <span className="compression-label">Compression Success</span>
                                    <span className="compression-ratio">{compressionStats.compressionRatio} Smaller</span>
                                </div>
                                <div className="compression-detail">
                                    Original: {(compressionStats.originalSize / 1024 / 1024).toFixed(1)}MB →
                                    Optimized: {(compressionStats.compressedSize / 1024 / 1024).toFixed(1)}MB
                                </div>
                            </div>
                        )}

                        <div className="upload-footer">
                            <button className="btn-next" onClick={handleFinalPublish}>
                                Publish <HiOutlineCheckCircle />
                            </button>
                        </div>
                    </div>
                )}

                {/* Progress Overlay */}
                {uploading && step !== 4 && (
                    <div className="upload-overlay">
                        <div className="progress-text">{uploadProgress}%</div>
                        <div className="premium-progress-bar">
                            <div className="premium-progress-fill" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        {uploadEta && (
                            <div className="progress-eta">~{uploadEta}s remaining</div>
                        )}
                        <p className="progress-message">Optimizing video for mobile playback...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
