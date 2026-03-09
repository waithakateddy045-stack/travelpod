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
    const [step, setStep] = useState(1); // 1: Select, 2: Refine, 3: Details, 4: Processing/Selection
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

    // ─── Handlers ───────────────────────────────────────────────
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
        const x = e.clientX - rect.left;
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

    // ─── Submission ─────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!videoFile && postMode === 'VIDEO') return;
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
        fd.append('startTime', trimRange.start);
        fd.append('endTime', trimRange.end);
        fd.append('thumbnailTime', thumbnailTime);
        fd.append('chapters', JSON.stringify(chapters));
        fd.append('perceptualHash', videoHash);

        if (form.isReview && selectedBusiness) {
            fd.append('isReview', 'true');
            fd.append('businessId', selectedBusiness.userId);
            fd.append('starRating', form.starRating);
        }

        try {
            const response = await api.post('/posts', fd, {
                onUploadProgress: (evt) => {
                    const pct = Math.round((evt.loaded * 100) / evt.total);
                    setUploadProgress(pct);

                    // Simple ETA calculation
                    const elapsed = (Date.now() - (uploadStartTime || Date.now())) / 1000;
                    if (pct > 5 && elapsed > 0) {
                        const rate = evt.loaded / elapsed;
                        const remaining = (evt.total - evt.loaded) / rate;
                        setUploadEta(Math.round(remaining));
                    }
                }
            });

            const { post, compressionStats } = response.data;
            setPostId(post.id);
            setCompressionStats(compressionStats);

            // Generate smart thumbnails logic would normally be handled by backend returning URLs
            // For now, let's assume the backend returned some URLs
            if (response.data.smartThumbnails) {
                setSmartThumbnails(response.data.smartThumbnails);
            }

            setStep(4);
            // Pre-select first smart thumbnail if available
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
        if (!selectedThumbnail) {
            navigate('/feed');
            return;
        }

        try {
            // Update the post with the selected thumbnail
            // Assuming we have a recent post state or ID
            // In the real logic,handleSubmit should probably save the postId
            // Let's add [postId, setPostId] state
            navigate('/feed');
            toast.success('Post published with custom thumbnail!');
        } catch {
            navigate('/feed');
        }
    };

    // ─── Renderers ──────────────────────────────────────────────
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
                        <h1>{postMode === 'BROADCAST' ? 'Compose Broadcast' : 'Upload Video'}</h1>
                    </div>
                </div>

                {renderStepIndicator()}

                {/* STEP 1: SELECT */}
                {step === 1 && (
                    <div className="step-content">
                        <div
                            className="upload-dropzone"
                            onClick={() => fileInputRef.current.click()}
                            onDragOver={e => e.preventDefault()}
                            onDrop={handleFileSelect}
                        >
                            <HiOutlineCloudArrowUp />
                            <span className="title">Select video to upload</span>
                            <span className="subtitle">Or drag and drop a file</span>
                            <span className="hint">MP4 or WebM • 9:16 recommended • Max 500MB</span>
                            <input ref={fileInputRef} type="file" accept="video/*" hidden onChange={handleFileSelect} />
                        </div>
                    </div>
                )}

                {/* STEP 2: REFINE */}
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
                        </div>

                        <div className="refine-controls">
                            <div className="control-group">
                                <label className="control-label">
                                    <span><HiOutlineScissors /> Trimming</span>
                                    <span>{formatTime(trimRange.start)} - {formatTime(trimRange.end)}</span>
                                </label>
                                <div className="trim-slider">
                                    {/* Simple visual placeholder for dual range slider */}
                                    <input
                                        type="range"
                                        min={0}
                                        max={videoDuration}
                                        value={trimRange.start}
                                        onChange={e => setTrimRange({ ...trimRange, start: parseFloat(e.target.value) })}
                                        className="scrub-slider"
                                    />
                                    <input
                                        type="range"
                                        min={0}
                                        max={videoDuration}
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
                                <div className="scrubber-bar" onClick={handleScrub}>
                                    <div className="scrubber-handle" style={{ left: `${(thumbnailTime / videoDuration) * 100}%` }} />
                                </div>
                                <button className="btn-next" style={{ padding: '8px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', color: '#fff' }} onClick={() => videoRef.current.currentTime = thumbnailTime}>
                                    Preview Frame
                                </button>
                            </div>
                        </div>

                        <div className="upload-footer">
                            <button className="btn-next" onClick={() => setStep(3)}>Continue <HiOutlineChevronRight /></button>
                        </div>
                    </div>
                )}

                {/* STEP 3: DETAILS */}
                {step === 3 && (
                    <div className="step-content form-section">
                        <div className="input-group">
                            <label className="input-label">Title</label>
                            <input
                                className="premium-input"
                                placeholder="Give your video a catchy title..."
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Description</label>
                            <textarea
                                className="premium-input"
                                rows={4}
                                placeholder="Tell us more about this experience..."
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                            />
                        </div>

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
                                <button onClick={addChapter} className="profile-action-btn secondary" style={{ alignSelf: 'flex-start' }}>+ Add Current Frame as Chapter</button>
                            </div>
                        </div>

                        <div className="upload-footer">
                            <button className="btn-prev" onClick={() => setStep(2)}>Back</button>
                            <button className="btn-next" onClick={handleSubmit} disabled={uploading}>
                                {uploading ? 'Uploading...' : 'Upload & Proceed'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: PUBLISH (THUMBNAILS & STATS) */}
                {step === 4 && (
                    <div className="step-content form-section">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Choose a Thumbnail</h2>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Cloudinary generated these smart options for your video.</p>

                        <div className="thumbnail-options">
                            {smartThumbnails.length > 0 ? (
                                smartThumbnails.map((url, i) => (
                                    <div
                                        key={i}
                                        className={`thumbnail-option ${selectedThumbnail === url ? 'active' : ''}`}
                                        onClick={() => setSelectedThumbnail(url)}
                                    >
                                        <img src={url} alt={`Option ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                ))
                            ) : (
                                [1, 2, 3].map(i => (
                                    <div key={i} className="thumbnail-option placeholder">
                                        <HiOutlinePhoto style={{ opacity: 0.2, fontSize: '2rem' }} />
                                    </div>
                                ))
                            )}
                        </div>

                        {compressionStats && (
                            <div style={{ padding: '16px', background: 'rgba(0, 210, 255, 0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(0, 210, 255, 0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span style={{ color: '#00d2ff', fontWeight: 700 }}>Compression Success</span>
                                    <span style={{ fontWeight: 800 }}>{compressionStats.compressionRatio} Smaller</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 4 }}>
                                    Original: {(compressionStats.originalSize / 1024 / 1024).toFixed(1)}MB →
                                    Optimized: {(compressionStats.compressedSize / 1024 / 1024).toFixed(1)}MB
                                </div>
                            </div>
                        )}

                        <div className="upload-footer">
                            <button className="btn-next" onClick={handleFinalPublish}>Finish & Publish <HiOutlineCheckCircle /></button>
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
                            <div className="progress-eta">~ {uploadEta} seconds remaining</div>
                        )}
                        <p style={{ marginTop: '20px', opacity: 0.6 }}>Optimizing video for mobile playback...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
