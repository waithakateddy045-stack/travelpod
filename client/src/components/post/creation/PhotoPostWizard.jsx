import React, { useState, useRef } from 'react';
import {
    HiOutlinePhoto,
    HiOutlinePlus,
    HiOutlineXMark,
    HiOutlineSparkles,
    HiOutlineCheck,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlineMapPin,
    HiOutlineTag
} from 'react-icons/hi2';
import { toast } from 'react-hot-toast';
import api from '../../../services/api';
import './PhotoPostWizard.css';

const STEPS = ['Photos', 'Details', 'Publish'];
const CATEGORIES = ['Destinations', 'Hotels & Resorts', 'Restaurants & Food', 'Adventures & Activities', 'Travel Tips', 'Flight Reviews', 'Safari', 'Beach', 'City Life', 'Culture & History', 'Nightlife', 'Wellness'];

export default function PhotoPostWizard({ onComplete, onCancel }) {
    const [step, setStep] = useState(1);
    const [files, setFiles] = useState([]);
    const [previews, setPreviews] = useState([]);
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

    const handleFileSelect = (e) => {
        const selected = Array.from(e.target.files);
        if (files.length + selected.length > 4) {
            return toast.error("Maximum 4 photos allowed");
        }

        const newFiles = [...files, ...selected];
        setFiles(newFiles);
        const newPreviews = selected.map(f => URL.createObjectURL(f));
        setPreviews([...previews, ...newPreviews]);
    };

    const removePhoto = (index) => {
        const newFiles = files.filter((_, i) => i !== index);
        const newPreviews = previews.filter((_, i) => i !== index);
        setFiles(newFiles);
        setPreviews(newPreviews);
    };

    const handleGenerateAI = async () => {
        setAiLoading(true);
        try {
            const res = await api.post('/ai/generate-details', {
                type: 'PHOTO',
                context: `${title || 'Travel photos'}. ${description}`
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
        files.forEach(f => formData.append('media', f));
        formData.append('postType', 'PHOTO');
        formData.append('title', title);
        formData.append('description', description);
        formData.append('tags', tags.join(','));
        formData.append('locationTag', location);
        formData.append('category', category);

        try {
            const res = await api.post('/posts', formData, {
                onUploadProgress: (e) => setProgress(Math.round((e.loaded / e.total) * 100))
            });
            if (res.data.success) {
                toast.success("📸 Photo carousel published!");
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
                        <div className="photo-grid">
                            {previews.map((u, i) => (
                                <div key={i} className="photo-preview-box">
                                    <img src={u} alt="preview" />
                                    <button className="remove-photo-btn" onClick={() => removePhoto(i)}><HiOutlineXMark /></button>
                                </div>
                            ))}
                            {files.length < 4 && (
                                <div className="add-photo-box" onClick={() => fileInputRef.current.click()}>
                                    <HiOutlinePlus />
                                    <span>Add Photo</span>
                                </div>
                            )}
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" multiple hidden />
                        <button
                            className="action-btn-main"
                            disabled={files.length === 0}
                            onClick={() => setStep(2)}
                            style={{ marginTop: '24px' }}
                        >
                            Next <HiOutlineChevronRight />
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="step-content details-form">
                        <div className="ai-trigger-banner" onClick={handleGenerateAI}>
                            <HiOutlineSparkles />
                            <span>{aiLoading ? 'Magic in progress...' : '✨ Generate with AI'}</span>
                        </div>

                        <div className="tp-input-group">
                            <label>Title</label>
                            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Captivating title..." />
                        </div>

                        <div className="tp-input-group">
                            <label>Description (optional)</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's the story?" />
                        </div>

                        <div className="tp-input-row">
                            <div className="tp-input-group">
                                <label><HiOutlineMapPin /> Location</label>
                                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Pin it" />
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

                        <button className="action-btn-main" onClick={() => setStep(3)} disabled={!title}>Review <HiOutlineChevronRight /></button>
                    </div>
                )}

                {step === 3 && (
                    <div className="step-content review-publish">
                        <div className="photo-carousel-preview">
                            <div className="carousel-track">
                                {previews.map((u, i) => (
                                    <img key={i} src={u} alt="preview" />
                                ))}
                            </div>
                            <div className="carousel-dots">
                                {previews.map((_, i) => <div key={i} className="dot" />)}
                            </div>
                        </div>

                        <div className="review-info-box">
                            <h4>{title}</h4>
                            <div className="meta-compact">
                                <span><HiOutlinePhoto /> {files.length} Photos</span>
                                <span><HiOutlineMapPin /> {location}</span>
                            </div>
                        </div>

                        {uploading ? (
                            <div className="upload-progress-container">
                                <div className="progress-track"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
                                <p>Uploading... {progress}%</p>
                            </div>
                        ) : (
                            <button className="publish-btn-huge" onClick={handlePublish}>🚀 Publish Carousel</button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
