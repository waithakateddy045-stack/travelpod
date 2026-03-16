import React, { useState, useRef } from 'react';
import {
    HiOutlineMegaphone,
    HiOutlineSparkles,
    HiOutlineCheck,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlineVideoCamera,
    HiOutlinePhoto,
    HiOutlineMapPin,
    HiOutlineTag
} from 'react-icons/hi2';
import { toast } from 'react-hot-toast';
import api from '../../../services/api';
import './BroadcastPostWizard.css';

const STEPS = ['Content', 'Targeting', 'Publish'];
const SECTORS = ['All', 'Hospitality', 'Transport', 'Destinations', 'Associations', 'Adventure', 'Airlines', 'Travel Agencies'];

export default function BroadcastPostWizard({ onComplete, onCancel }) {
    const [step, setStep] = useState(1);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [sectorTargeting, setSectorTargeting] = useState('All');
    const [region, setRegion] = useState('');
    
    const [videoFile, setVideoFile] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    const [imageFiles, setImageFiles] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const videoInputRef = useRef(null);
    const imageInputRef = useRef(null);

    const handleVideoSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setVideoFile(file);
        }
    };

    const handleImagesSelect = (e) => {
        const files = Array.from(e.target.files).slice(0, 4);
        setImageFiles(files);
    };

    // Lifecycle management for Blob URLs
    React.useEffect(() => {
        const vUrl = videoFile ? URL.createObjectURL(videoFile) : null;
        setVideoPreview(vUrl);

        const iUrls = imageFiles.map(f => URL.createObjectURL(f));
        setPreviews(iUrls);

        return () => {
            if (vUrl) URL.revokeObjectURL(vUrl);
            iUrls.forEach(URL.revokeObjectURL);
        };
    }, [videoFile, imageFiles]);

    const handlePublish = async () => {
        if (!title.trim()) return toast.error("Title is required");
        setUploading(true);
        const formData = new FormData();
        formData.append('title', title);
        formData.append('message', message);
        formData.append('sectorTargeting', sectorTargeting);
        formData.append('region', region);
        
        if (videoFile) formData.append('video', videoFile);
        imageFiles.forEach(file => formData.append('images', file));

        try {
            const { data } = await api.post('/broadcasts', formData, {
                onUploadProgress: (e) => setProgress(Math.round((e.loaded / e.total) * 100))
            });
            if (data.success) {
                toast.success("📢 Broadcast published successfully!");
                onComplete?.(data.broadcast);
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to publish broadcast");
            setUploading(false);
        }
    };

    return (
        <div className="wizard-container broadcast-wizard">
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
                    <div className="step-content">
                        <h3>Create Broadcast</h3>
                        <div className="tp-input-group">
                            <label>Headline</label>
                            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="E.g. Special Offer for Summer!" />
                        </div>
                        <div className="tp-input-group">
                            <label>Description</label>
                            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your broadcast message..." rows={4} />
                        </div>
                        
                        <div className="media-upload-section">
                            <div className="media-btns">
                                <button className={`media-btn ${videoFile ? 'active' : ''}`} onClick={() => videoInputRef.current.click()}>
                                    <HiOutlineVideoCamera /> {videoFile ? 'Video Added' : 'Add Video'}
                                </button>
                                <button className={`media-btn ${imageFiles.length > 0 ? 'active' : ''}`} onClick={() => imageInputRef.current.click()}>
                                    <HiOutlinePhoto /> {imageFiles.length > 0 ? `${imageFiles.length} Photos` : 'Add Photos'}
                                </button>
                            </div>
                            <input type="file" ref={videoInputRef} onChange={handleVideoSelect} accept="video/*" hidden />
                            <input type="file" ref={imageInputRef} onChange={handleImagesSelect} accept="image/*" multiple hidden />
                            
                            {videoPreview && (
                                <div className="video-preview-container">
                                    <video src={videoPreview} controls muted />
                                    <button className="remove-media-btn" onClick={() => setVideoFile(null)}>×</button>
                                </div>
                            )}

                            {previews.length > 0 && (
                                <div className="media-previews-strip">
                                    {previews.map((p, i) => (
                                        <div key={i} className="image-preview-wrapper">
                                            <img src={p} alt="" className="media-preview-tiny" />
                                            <button className="remove-media-btn-small" onClick={() => setImageFiles(prev => prev.filter((_, idx) => idx !== i))}>×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button className="action-btn-main" onClick={() => setStep(2)} disabled={!title}>Next <HiOutlineChevronRight /></button>
                    </div>
                )}

                {step === 2 && (
                    <div className="step-content">
                        <h3>Targeting</h3>
                        <div className="tp-input-group">
                            <label>Sector</label>
                            <select value={sectorTargeting} onChange={e => setSectorTargeting(e.target.value)}>
                                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="tp-input-group">
                            <label><HiOutlineMapPin /> Region (Optional)</label>
                            <input value={region} onChange={e => setRegion(e.target.value)} placeholder="E.g. East Africa" />
                        </div>
                        
                        <div className="targeting-tip">
                            <HiOutlineSparkles />
                            <p>Targeted broadcasts reach users interested in your specific travel sector.</p>
                        </div>
                        
                        <button className="action-btn-main" onClick={() => setStep(3)}>Review <HiOutlineChevronRight /></button>
                    </div>
                )}

                {step === 3 && (
                    <div className="step-content">
                        <h3>Ready to Broadcast?</h3>
                        <div className="broadcast-review-card">
                            <div className="review-icon-large"><HiOutlineMegaphone /></div>
                            <div className="review-text">
                                <h4>{title}</h4>
                                <p>{message.substring(0, 150)}{message.length > 150 ? '...' : ''}</p>
                                <div className="meta-compact">
                                    <span>🎯 {sectorTargeting}</span>
                                    {region && <span>📍 {region}</span>}
                                </div>
                            </div>
                        </div>

                        {uploading ? (
                            <div className="upload-progress-container">
                                <div className="progress-track"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
                                <p>Publishing... {progress}%</p>
                            </div>
                        ) : (
                            <button className="publish-btn-huge" onClick={handlePublish}>🚀 Launch Broadcast</button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
