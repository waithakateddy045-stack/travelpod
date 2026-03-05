import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    HiOutlineUser,
    HiOutlineCamera,
    HiOutlineGlobeAlt,
    HiOutlineBuildingOffice2,
    HiOutlineCheckCircle,
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './OnboardingPage.css';
import '../auth/AuthPage.css';

const PERSONALITY_TAGS = [
    'Adventure Seeker', 'Culture Explorer', 'Foodie', 'Beach Lover',
    'City Hopper', 'Nature Enthusiast', 'Luxury Traveler', 'Budget Backpacker',
    'Solo Traveler', 'Family Vacationer', 'Photography Fan', 'Wellness & Spa',
];

const REGION_TAGS = [
    'East Africa', 'West Africa', 'Southern Africa', 'North Africa',
    'Southeast Asia', 'Middle East', 'Europe', 'Caribbean',
    'South America', 'North America', 'Pacific Islands', 'Central Asia',
];

const CONTENT_PREFS = [
    'Hotel Reviews', 'Destination Guides', 'Food & Dining', 'Adventure Activities',
    'Travel Tips', 'Flight Reviews', 'Safari Experiences', 'Beach Getaways',
    'City Walks', 'Cultural Experiences', 'Nightlife', 'Budget Travel',
];

const BUSINESS_TYPES = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];

export default function OnboardingPage() {
    const navigate = useNavigate();
    const { user, setUser } = useAuth();
    const fileInputRef = useRef(null);
    const isBusiness = BUSINESS_TYPES.includes(user?.accountType);
    const totalSteps = isBusiness ? 4 : 3; // business accounts get an extra step

    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const [form, setForm] = useState({
        displayName: '',
        handle: '',
        personalityTags: [],
        preferredRegions: [],
        contentPreferences: [],
        country: '',
        description: '',
        websiteUrl: '',
    });

    const toggleTag = (field, tag) => {
        setForm(f => ({
            ...f,
            [field]: f[field].includes(tag) ? f[field].filter(t => t !== tag) : [...f[field], tag],
        }));
    };

    const handleAvatarSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    };

    const handleNext = async () => {
        setSubmitting(true);
        try {
            if (step === 1) {
                // Validate
                if (!form.displayName.trim()) { toast.error('Display name is required'); setSubmitting(false); return; }
                if (!form.handle.trim()) { toast.error('Handle is required'); setSubmitting(false); return; }
                if (!/^[a-z0-9_]{3,30}$/.test(form.handle)) {
                    toast.error('Handle: 3–30 chars, lowercase + numbers + underscores only');
                    setSubmitting(false); return;
                }
                // Save profile
                await api.post('/onboarding/profile', {
                    displayName: form.displayName.trim(),
                    handle: form.handle.trim(),
                    personalityTags: form.personalityTags,
                    preferredRegions: form.preferredRegions,
                    contentPreferences: form.contentPreferences,
                });
                setStep(2);
            } else if (step === 2) {
                // Upload avatar if selected
                if (avatarFile) {
                    const fd = new FormData();
                    fd.append('avatar', avatarFile);
                    await api.post('/onboarding/avatar', fd, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                }
                setStep(3);
            } else if (step === 3 && isBusiness) {
                // Save business details
                await api.post('/onboarding/business', {
                    country: form.country.trim(),
                    description: form.description.trim(),
                    websiteUrl: form.websiteUrl.trim(),
                });
                setStep(4);
            } else {
                // Final step — complete onboarding
                await api.post('/onboarding/complete');
                setUser(prev => ({ ...prev, onboardingComplete: true }));
                toast.success('Welcome to Travelpod! 🎉');
                navigate('/feed', { replace: true });
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const renderProgressDots = () => (
        <div className="onboarding-progress">
            {Array.from({ length: totalSteps }, (_, i) => (
                <span key={i}>
                    {i > 0 && <span className={`step-connector${i < step ? ' completed' : ''}`} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 2px' }} />}
                    <span className={`step-dot${i + 1 === step ? ' active' : ''}${i + 1 < step ? ' completed' : ''}`} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                </span>
            ))}
        </div>
    );

    return (
        <div className="onboarding-page">
            <div className="onboarding-bg">
                <div className="orb orb-1" /><div className="orb orb-2" />
            </div>
            <div className="onboarding-card">
                {renderProgressDots()}

                {/* ─── Step 1: Profile basics ─── */}
                {step === 1 && (
                    <>
                        <h1 className="onboarding-title">Set up your profile</h1>
                        <p className="onboarding-subtitle">Tell us who you are</p>
                        <div className="onboarding-form">
                            <div className="form-field">
                                <label className="form-label">Display name</label>
                                <input
                                    id="onboarding-name"
                                    className="form-input"
                                    placeholder="Your name or brand"
                                    value={form.displayName}
                                    onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                                />
                            </div>
                            <div className="form-field">
                                <label className="form-label">Handle</label>
                                <input
                                    id="onboarding-handle"
                                    className="form-input"
                                    placeholder="your_handle"
                                    value={form.handle}
                                    onChange={e => setForm(f => ({ ...f, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                                    maxLength={30}
                                />
                            </div>

                            <div className="form-field">
                                <label className="form-label">What kind of traveler are you? <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(pick a few)</span></label>
                                <div className="tag-grid">
                                    {PERSONALITY_TAGS.map(tag => (
                                        <button
                                            key={tag} type="button"
                                            className={`tag-chip${form.personalityTags.includes(tag) ? ' selected' : ''}`}
                                            onClick={() => toggleTag('personalityTags', tag)}
                                        >{tag}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-field">
                                <label className="form-label">Preferred regions</label>
                                <div className="tag-grid">
                                    {REGION_TAGS.map(tag => (
                                        <button
                                            key={tag} type="button"
                                            className={`tag-chip${form.preferredRegions.includes(tag) ? ' selected' : ''}`}
                                            onClick={() => toggleTag('preferredRegions', tag)}
                                        >{tag}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-field">
                                <label className="form-label">Content you want to see</label>
                                <div className="tag-grid">
                                    {CONTENT_PREFS.map(tag => (
                                        <button
                                            key={tag} type="button"
                                            className={`tag-chip${form.contentPreferences.includes(tag) ? ' selected' : ''}`}
                                            onClick={() => toggleTag('contentPreferences', tag)}
                                        >{tag}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="onboarding-actions">
                                <button
                                    id="onboarding-next-1"
                                    className="onboarding-btn primary"
                                    onClick={handleNext}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Saving...' : 'Continue →'}
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* ─── Step 2: Avatar ─── */}
                {step === 2 && (
                    <>
                        <h1 className="onboarding-title">Add a profile photo</h1>
                        <p className="onboarding-subtitle">Help others recognize you</p>
                        <div className="onboarding-form">
                            <div className="avatar-upload">
                                <div
                                    className={`avatar-preview${avatarPreview ? ' has-image' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Avatar" />
                                    ) : (
                                        <HiOutlineCamera />
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    style={{ display: 'none' }}
                                    onChange={handleAvatarSelect}
                                />
                                <span className="avatar-hint">JPEG, PNG, or WebP — max 5MB</span>
                            </div>

                            <div className="onboarding-actions">
                                <button className="onboarding-btn secondary" onClick={() => setStep(1)}>← Back</button>
                                <button
                                    id="onboarding-next-2"
                                    className="onboarding-btn primary"
                                    onClick={handleNext}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Uploading...' : 'Continue →'}
                                </button>
                            </div>
                            <button className="onboarding-skip" onClick={() => { setStep(isBusiness ? 3 : totalSteps); }}>
                                Skip for now
                            </button>
                        </div>
                    </>
                )}

                {/* ─── Step 3: Business details (only for business accounts) ─── */}
                {step === 3 && isBusiness && (
                    <>
                        <h1 className="onboarding-title">Business details</h1>
                        <p className="onboarding-subtitle">Help travelers find and trust your business</p>
                        <div className="onboarding-form">
                            <div className="form-field">
                                <label className="form-label">Country</label>
                                <input
                                    id="onboarding-country"
                                    className="form-input"
                                    placeholder="e.g. Kenya"
                                    value={form.country}
                                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                                />
                            </div>
                            <div className="form-field">
                                <label className="form-label">Description</label>
                                <textarea
                                    id="onboarding-description"
                                    className="form-input"
                                    placeholder="Brief description of your business..."
                                    rows={3}
                                    style={{ resize: 'vertical' }}
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                />
                            </div>
                            <div className="form-field">
                                <label className="form-label">Website <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                                <input
                                    id="onboarding-website"
                                    className="form-input"
                                    placeholder="https://yourbusiness.com"
                                    value={form.websiteUrl}
                                    onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))}
                                />
                            </div>

                            <div className="onboarding-actions">
                                <button className="onboarding-btn secondary" onClick={() => setStep(2)}>← Back</button>
                                <button
                                    id="onboarding-next-3"
                                    className="onboarding-btn primary"
                                    onClick={handleNext}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Saving...' : 'Continue →'}
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* ─── Final Step: Confirmation ─── */}
                {((step === 3 && !isBusiness) || step === 4) && (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                            <div style={{ fontSize: '3.5rem', marginBottom: 'var(--space-4)' }}>
                                <HiOutlineCheckCircle style={{ color: 'var(--color-success)' }} />
                            </div>
                            <h1 className="onboarding-title">You're all set!</h1>
                            <p className="onboarding-subtitle">
                                Your profile is ready. Start exploring travel content from creators and businesses around the world.
                            </p>
                        </div>

                        <div className="onboarding-actions">
                            <button
                                id="onboarding-complete"
                                className="onboarding-btn primary"
                                style={{ width: '100%' }}
                                onClick={handleNext}
                                disabled={submitting}
                            >
                                {submitting ? 'Finishing up...' : 'Start Exploring 🚀'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
