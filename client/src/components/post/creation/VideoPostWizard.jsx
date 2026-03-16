import React, { useState, useRef, useEffect } from 'react';
import {
    HiOutlineCloudArrowUp,
    HiOutlineSparkles,
    HiOutlineCheck,
    HiOutlineArrowPath,
    HiOutlineTag,
    HiOutlineMapPin,
    HiOutlinePhoto,
    HiOutlineVideoCamera,
    HiOutlineChevronLeft,
    HiOutlineChevronRight
} from 'react-icons/hi2';
import { toast } from 'react-hot-toast';
import api from '../../../services/api';
import './VideoPostWizard.css';

const STEPS = ['Media', 'Cover', 'Details', 'Publish'];
const CATEGORIES = ['Destinations', 'Hotels & Resorts', 'Restaurants & Food', 'Adventures & Activities', 'Travel Tips', 'Flight Reviews', 'Safari', 'Beach', 'City Life', 'Culture & History', 'Nightlife', 'Wellness'];

export default function VideoPostWizard({ onComplete, onCancel }) {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [duration, setDuration] = useState(0);
    const [thumbnailTime, setThumbnailTime] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    // Form fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [location, setLocation] = useState('');
    const [category, setCategory] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    const fileInputRef = useRef(null);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
        };
    }, []); // Empty dependency array for unmount only

    const handleFileSelect = (e) => {
        const selected = e.target.files[0];
        if (!selected) return;
        if (selected.size > 500 * 1024 * 1024) {
            return toast.error("File exceeds 500MB limit");
        }

        // Clean up previous blob URL before creating a new one
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        
        setFile(selected);
        const url = URL.createObjectURL(selected);
        setPreview(url);

        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            setDuration(Math.round(video.duration));
            URL.revokeObjectURL(video.src);
        };
        video.src = url;
        setStep(2);
    };



    const handleGenerateAI = async () => {
        setAiLoading(true);
        try {
            const res = await api.post('/upload/suggestions', {
                type: 'VIDEO',
                context: `${file?.name || ''}. ${description || ''}`
            });
            if (res.data.success) {
                const { data } = res.data;
                setTitle(data.title || title);
                setDescription(data.description || description);
                setTags([...new Set([...tags, ...(data.tags || [])])]);
                setCategory(data.category || category);
                toast.success("✨ AI suggestions applied!");
            }
        } catch (err) {
            toast.error("AI service temporarily unavailable");
        } finally {
            setAiLoading(false);
        }
    };

    const handlePublish = async () => {
        setUploading(true);
        const formData = new FormData();
        formData.append('media', file);
        formData.append('postType', 'VIDEO');
        formData.append('title', title);
        formData.append('description', description);
        formData.append('tags', tags.join(','));
        formData.append('locationTag', location);
        formData.append('category', category);
        formData.append('thumbnailTime', thumbnailTime);

        try {
            const res = await api.post('/posts', formData, {
                onUploadProgress: (e) => setProgress(Math.round((e.loaded / e.total) * 100))
            });
            if (res.data.success) {
                toast.success("🚀 Video published!");
                onComplete?.(res.data.post);
            }
        } catch (err) {
            toast.error("Upload failed. Please try again.");
            setUploading(false);
        }
    };

    return (
        <div className="wizard-container">
            <div className="wizard-header">
                <button className="back-btn" onClick={step === 1 ? onCancel : () => setStep(step - 1)}>
                    <HiOutlineChevronLeft />
                </button>
                <div className="wizard-steps">
                    {STEPS.map((s, i) => (
                        <div key={s} className={`step-item ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
                            <div className="step-dot">{step > i + 1 ? <HiOutlineCheck /> : i + 1}</div>
                            <span>{s}</span>
                        </div>
                    ))}
                </div>
                <button className="close-btn-ghost" onClick={onCancel}>Cancel</button>
            </div>

            <div className="wizard-body">
                {step === 1 && (
                    <div className="step-content select-media">
                        <div className="upload-box" onClick={() => fileInputRef.current.click()}>
                            <HiOutlineCloudArrowUp />
                            <p>Toss your travel video here</p>
                            <span>MP4, MOV up to 500MB</span>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="video/*" hidden />
                    </div>
                )}

                {step === 2 && (
                    <div className="step-content select-thumb">
                        <h3>Pick a thumb</h3>
                        <div className="thumb-picker">
                            <video src={preview} className="thumb-video-preview" />
                            <input
                                type="range"
                                min="0"
                                max={duration}
                                value={thumbnailTime}
                                onChange={e => setThumbnailTime(e.target.value)}
                            />
                            <p>Thumbnail at {thumbnailTime}s</p>
                        </div>
                        <button className="action-btn-main" onClick={() => setStep(3)}>Next <HiOutlineChevronRight /></button>
                    </div>
                )}

                {step === 3 && (
                    <div className="step-content details-form">


                        <div className="tp-input-group">
                            <label>Title</label>
                            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="E.g. Sunrise at Serengeti" />
                        </div>

                        <div className="tp-input-group">
                            <label>Description</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell the story..." />
                        </div>

                        <div className="tp-input-row">
                            <div className="tp-input-group">
                                <label><HiOutlineMapPin /> Location</label>
                                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Where was this?" />
                            </div>
                            <div className="tp-input-group">
                                <label><HiOutlinePhoto /> Category</label>
                                <select value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="">Select</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="tp-input-group">
                            <label><HiOutlineTag /> Tags</label>
                            <div className="tag-input-pill-box">
                                {tags.map(t => <span key={t} className="tag-pill">{t} <button onClick={() => setTags(tags.filter(x => x !== t))}>×</button></span>)}
                                <input
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && tagInput.trim()) {
                                            setTags([...new Set([...tags, tagInput.trim()])]);
                                            setTagInput('');
                                        }
                                    }}
                                    placeholder="Add tags..."
                                />
                            </div>
                        </div>

                        <button className="action-btn-main" onClick={() => setStep(4)} disabled={!title}>Review <HiOutlineChevronRight /></button>
                    </div>
                )}

                {step === 4 && (
                    <div className="step-content review-publish">
                        <div className="review-preview-card">
                            <video src={preview} muted />
                            <div className="review-info">
                                <h4>{title}</h4>
                                <p>{description.substring(0, 100)}...</p>
                                <div className="meta-compact">
                                    <span><HiOutlineMapPin /> {location}</span>
                                    <span>{category}</span>
                                </div>
                            </div>
                        </div>

                        {uploading ? (
                            <div className="upload-progress-container">
                                <div className="progress-track"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
                                <p>Uploading... {progress}%</p>
                            </div>
                        ) : (
                            <button className="publish-btn-huge" onClick={handlePublish}>🚀 Publish Video</button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
