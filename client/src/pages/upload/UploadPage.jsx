import { AuthContext } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import { 
    HiOutlineCloudArrowUp, HiOutlineSparkles, HiOutlinePhoto, 
    HiOutlineArrowPath, HiOutlineCheck, HiOutlineXMark, HiOutlineTag, 
    HiOutlineMapPin, HiOutlineChatBubbleBottomCenterText 
} from 'react-icons/hi2';
import './UploadPage.css';

const API = import.meta.env.VITE_API_URL || '';

export default function UploadPage() {
    const { user, token } = useContext(AuthContext);
    const locationState = useLocation();
    
    // Parse query params for linked business (reviews)
    const searchParams = new URLSearchParams(locationState.search);
    const initialBusinessId = searchParams.get('linkedBusinessId');
    const initialBusinessName = searchParams.get('businessName');

    const [step, setStep] = useState(1); // 1=Select, 2=Thumbnail, 3=Details, 4=Review
    const [file, setFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [isVideo, setIsVideo] = useState(false);
    const [isTextPost, setIsTextPost] = useState(false);
    const [duration, setDuration] = useState(0);

    // Thumbnail
    const [thumbnails, setThumbnails] = useState([]);
    const [selectedThumb, setSelectedThumb] = useState(0);

    // Details
    const [title, setTitle] = useState(initialBusinessName ? `Review: ${initialBusinessName}` : '');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState(initialBusinessId ? ['review', 'verified-review'] : []);
    const [tagInput, setTagInput] = useState('');
    const [location, setLocation] = useState('');
    const [category, setCategory] = useState(initialBusinessId ? 'Reviews' : '');
    const [linkedBusinessId] = useState(initialBusinessId);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiGenerated, setAiGenerated] = useState(false);
    const [titleOptions, setTitleOptions] = useState([]);

    // Publish
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [agreed, setAgreed] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);

    const fileRef = useRef(null);

    const CATEGORIES = ['Destinations', 'Hotels & Resorts', 'Restaurants & Food', 'Adventures & Activities', 'Travel Tips', 'Flight Reviews', 'Safari', 'Beach', 'City Life', 'Culture & History', 'Nightlife', 'Wellness'];
    const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB

    // ─── STEP 1: File Selection ──────────────────────────────
    const handleFileSelect = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;

        const isVid = f.type.startsWith('video/');
        const maxSize = isVid ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

        if (f.size > maxSize) {
            toast.error(`File too large. Max ${isVid ? '500MB' : '10MB'}`);
            return;
        }

        setFile(f);
        setIsVideo(isVid);
        setFilePreview(URL.createObjectURL(f));

        if (isVid) {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                setDuration(Math.round(video.duration));
                URL.revokeObjectURL(video.src);
                // Generate placeholder thumbnails
                setThumbnails([
                    `Thumbnail at ${Math.round(video.duration * 0.1)}s`,
                    `Thumbnail at ${Math.round(video.duration * 0.5)}s`,
                    `Thumbnail at ${Math.round(video.duration * 0.9)}s`,
                ]);
            };
            video.src = URL.createObjectURL(f);
        } else {
            setThumbnails([]);
        }
        setStep(isVid ? 2 : 3);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) {
            const input = fileRef.current;
            const dt = new DataTransfer();
            dt.items.add(f);
            input.files = dt.files;
            handleFileSelect({ target: { files: dt.files } });
        }
    };

    // ─── STEP 3: Gemini AI Suggestions ──────────────────────
    const generateAI = async () => {
        if (isTextPost && !title.trim() && !description.trim()) {
            toast.error('Add a title or description for AI to help');
            return;
        }
        setAiLoading(true);
        try {
            const res = await api.post('/upload/suggestions', {
                fileName: file?.name || (isTextPost ? 'text-post' : 'travel-content'),
                fileType: isVideo ? 'video' : isTextPost ? 'text' : 'image',
                duration: duration || null,
                existingTitle: title,
                existingDesc: description
            });

            const s = res.data.suggestions;
            setTitleOptions(s.titles || []);
            setTitle(s.titles?.[0] || '');
            setDescription(s.description || '');
            setTags(s.tags || []);
            setLocation(s.location || '');
            setCategory(s.category || '');
            setAiGenerated(true);
            toast.success('✨ AI suggestions generated!');
        } catch {
            toast.error('AI suggestions unavailable');
        }
        setAiLoading(false);
    };

    const addTag = () => {
        const t = tagInput.trim().toLowerCase();
        if (t && !tags.includes(t) && tags.length < 10) {
            setTags([...tags, t]);
            setTagInput('');
        }
    };

    const removeTag = (t) => setTags(tags.filter(x => x !== t));

    // ─── STEP 4: Upload ─────────────────────────────────────
    const handlePublish = async () => {
        if (!file || !title.trim() || !agreed) {
            toast.error('Please fill in all required fields and agree to the terms');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        if (file) formData.append('media', file);
        formData.append('title', title.trim());
        formData.append('description', description);
        formData.append('locationTag', location);
        formData.append('category', category);
        formData.append('tags', JSON.stringify(tags));
        formData.append('isTextPost', isTextPost);
        if (linkedBusinessId) formData.append('linkedBusinessId', linkedBusinessId);

        if (isVideo && thumbnails.length > 0) {
            formData.append('thumbnailIndex', selectedThumb);
        }

        try {
            const res = await api.post('/posts', formData, {
                onUploadProgress: (e) => {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    setUploadProgress(pct);
                },
            });

            setUploadResult({
                postId: res.data.post?.id,
                originalSize: file?.size || 0,
                compressedSize: res.data.post?.compressedSize || (file?.size ? file.size * 0.7 : 0),
            });
            toast.success('🎉 Published successfully!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Upload failed');
            setUploading(false);
        }
    };

    const formatSize = (bytes) => {
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / 1024).toFixed(0) + ' KB';
    };

    const resetForm = () => {
        setStep(1); setFile(null); setFilePreview(null); setIsVideo(false); setIsTextPost(false); setDuration(0);
        setThumbnails([]); setSelectedThumb(0); setTitle(''); setDescription('');
        setTags([]); setTagInput(''); setLocation(''); setCategory('');
        setAiGenerated(false); setTitleOptions([]); setUploading(false);
        setUploadProgress(0); setAgreed(false); setUploadResult(null);
    };

    // ─── Render ─────────────────────────────────────────────
    return (
        <div className="upload-page">
            <div className="upload-container">
                <div className="upload-header">
                    <h1>Create Post</h1>
                    <div className="upload-steps">
                        {['Select', isVideo ? 'Thumbnail' : null, 'Details', 'Publish'].filter(Boolean).map((s, i) => {
                            const stepNum = isVideo ? i + 1 : (i === 0 ? 1 : i + 2);
                            return (
                                <span key={s} className={`upload-step ${step === stepNum ? 'active' : step > stepNum ? 'done' : ''}`}>
                                    {step > stepNum ? <HiOutlineCheck /> : stepNum}
                                    <span className="step-label">{s}</span>
                                </span>
                            );
                        })}
                    </div>
                </div>

                {/* STEP 1 — File Selection */}
                {step === 1 && (
                    <div className="upload-step-content">
                        <div className="upload-options-grid">
                            <div
                                className="upload-dropzone"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                onClick={() => fileRef.current?.click()}
                            >
                                <HiOutlineCloudArrowUp className="dropzone-icon" />
                                <p className="dropzone-title">Media Post</p>
                                <p className="dropzone-sub">Photo or Video</p>
                            </div>

                            <div
                                className="upload-dropzone text-type"
                                onClick={() => { setIsTextPost(true); setStep(3); }}
                            >
                                <HiOutlineChatBubbleBottomCenterText className="dropzone-icon" />
                                <p className="dropzone-title">Text Post</p>
                                <p className="dropzone-sub">Thoughts & Reviews</p>
                            </div>
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="video/mp4,video/quicktime,video/x-msvideo,image/jpeg,image/png,image/webp"
                            onChange={handleFileSelect}
                            hidden
                        />
                    </div>
                )}

                {/* STEP 2 — Thumbnail Selection (video only) */}
                {step === 2 && isVideo && (
                    <div className="upload-step-content">
                        <h2>Choose a Cover</h2>
                        <p className="step-subtitle">Select a thumbnail for your video</p>

                        <div className="thumbnail-grid">
                            {[0, 1, 2].map(i => (
                                <div
                                    key={i}
                                    className={`thumb-card ${selectedThumb === i ? 'selected' : ''}`}
                                    onClick={() => setSelectedThumb(i)}
                                >
                                    <div className="thumb-preview">
                                        <video src={filePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <div className="thumb-overlay">
                                            {selectedThumb === i && <HiOutlineCheck className="thumb-check" />}
                                        </div>
                                    </div>
                                    <span className="thumb-label">
                                        {i === 0 ? 'Beginning' : i === 1 ? 'Middle' : 'End'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="step-actions">
                            <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
                            <button className="btn-primary" onClick={() => setStep(3)}>Continue</button>
                        </div>
                    </div>
                )}

                {/* STEP 3 — Details with Gemini AI */}
                {step === 3 && (
                    <div className="upload-step-content">
                        <button className="ai-generate-btn" onClick={generateAI} disabled={aiLoading}>
                            <HiOutlineSparkles />
                            {aiLoading ? 'Generating...' : '✨ Generate with AI'}
                        </button>

                        {aiGenerated && (
                            <div className="ai-badge">
                                <HiOutlineSparkles /> Generated by Gemini AI
                                <button className="ai-refresh" onClick={generateAI} title="Regenerate">
                                    <HiOutlineArrowPath />
                                </button>
                            </div>
                        )}

                        {titleOptions.length > 0 && (
                            <div className="title-chips">
                                {titleOptions.map((t, i) => (
                                    <button
                                        key={i}
                                        className={`title-chip ${title === t ? 'active' : ''}`}
                                        onClick={() => setTitle(t)}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="form-group">
                            <label>Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Give your post a title"
                                maxLength={100}
                            />
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Tell people about this content..."
                                rows={3}
                            />
                        </div>

                        <div className="form-group">
                            <label><HiOutlineTag /> Tags</label>
                            <div className="tag-input-wrap">
                                <div className="tag-pills">
                                    {tags.map(t => (
                                        <span key={t} className="tag-pill">
                                            {t}
                                            <button onClick={() => removeTag(t)}><HiOutlineXMark /></button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                    placeholder="Add a tag..."
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label><HiOutlineMapPin /> Location</label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={e => setLocation(e.target.value)}
                                    placeholder="e.g. Masai Mara, Kenya"
                                />
                            </div>
                            <div className="form-group">
                                <label><HiOutlinePhoto /> Category</label>
                                <select value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="">Select category</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="step-actions">
                            <button className="btn-secondary" onClick={() => setStep(isVideo ? 2 : 1)}>Back</button>
                            <button className="btn-primary" onClick={() => setStep(4)} disabled={!title.trim()}>Review</button>
                        </div>
                    </div>
                )}

                {/* STEP 4 — Review & Publish */}
                {step === 4 && !uploadResult && (
                    <div className="upload-step-content">
                        <h2>Review & Publish</h2>

                        <div className="review-card">
                            <div className="review-preview">
                                {isTextPost ? (
                                    <div className="review-media text-placeholder">
                                        <HiOutlineChatBubbleBottomCenterText />
                                        <span>Text Post</span>
                                    </div>
                                ) : isVideo ? (
                                    <video src={filePreview} className="review-media" muted />
                                ) : (
                                    <img src={filePreview} className="review-media" alt="preview" />
                                )}
                            </div>
                            <div className="review-meta">
                                <h3>{title}</h3>
                                {description && <p>{description}</p>}
                                <div className="review-details">
                                    {category && <span className="review-cat">{category}</span>}
                                    {location && <span className="review-loc"><HiOutlineMapPin /> {location}</span>}
                                    {isVideo && <span>{duration}s</span>}
                                    {!isTextPost && <span>{formatSize(file?.size || 0)}</span>}
                                </div>
                                {tags.length > 0 && (
                                    <div className="review-tags">
                                        {tags.map(t => <span key={t}>#{t}</span>)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <label className="agree-check">
                            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                            <span>✅ I created this content and it's ready to share</span>
                        </label>

                        {uploading && (
                            <div className="upload-progress">
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                                </div>
                                <span>{uploadProgress}%</span>
                            </div>
                        )}

                        <div className="step-actions">
                            <button className="btn-secondary" onClick={() => setStep(3)} disabled={uploading}>Back</button>
                            <button className="btn-publish" onClick={handlePublish} disabled={!agreed || uploading}>
                                {uploading ? 'Publishing...' : '🚀 Publish'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Upload Success */}
                {uploadResult && (
                    <div className="upload-step-content upload-success">
                        <div className="success-icon">🎉</div>
                        <h2>Published!</h2>
                        <p>Your content is now live on Travelpod</p>
                        {uploadResult.originalSize && (
                            <div className="compression-stats">
                                <div className="stat">
                                    <span className="stat-label">Original</span>
                                    <span className="stat-value">{formatSize(uploadResult.originalSize)}</span>
                                </div>
                                <div className="stat">
                                    <span className="stat-label">Compressed</span>
                                    <span className="stat-value">{formatSize(uploadResult.compressedSize)}</span>
                                </div>
                                <div className="stat highlight">
                                    <span className="stat-label">Saved</span>
                                    <span className="stat-value">
                                        {Math.round((1 - uploadResult.compressedSize / uploadResult.originalSize) * 100)}%
                                    </span>
                                </div>
                            </div>
                        )}
                        <div className="step-actions">
                            <button className="btn-secondary" onClick={resetForm}>Create Another</button>
                            <button className="btn-primary" onClick={() => window.location.href = '/feed'}>View Feed</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
