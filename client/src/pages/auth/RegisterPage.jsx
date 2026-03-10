import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    HiOutlineGlobeAlt,
    HiOutlineBuildingOffice2,
    HiOutlineBuildingStorefront,
    HiOutlineMapPin,
    HiOutlinePaperAirplane,
    HiOutlineUserGroup,
    HiExclamationCircle,
} from 'react-icons/hi2';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../context/AuthContext';
import './AuthPage.css';

const ACCOUNT_TYPES = [
    { value: 'TRAVELER', label: 'Traveler', icon: <HiOutlineGlobeAlt /> },
    { value: 'TRAVEL_AGENCY', label: 'Travel Agency', icon: <HiOutlineBuildingStorefront /> },
    { value: 'HOTEL_RESORT', label: 'Hotel / Resort', icon: <HiOutlineBuildingOffice2 /> },
    { value: 'DESTINATION', label: 'Destination', icon: <HiOutlineMapPin /> },
    { value: 'AIRLINE', label: 'Airline', icon: <HiOutlinePaperAirplane /> },
    { value: 'ASSOCIATION', label: 'Association', icon: <HiOutlineUserGroup /> },
];

export default function RegisterPage() {
    const navigate = useNavigate();
    const isCapacitor = typeof window !== 'undefined' && Capacitor.isNativePlatform();
    const { register } = useAuth();
    const [step, setStep] = useState(1); // 1 = credentials, 2 = account type
    const [formData, setFormData] = useState({ email: '', password: '', accountType: '' });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [apiError, setApiError] = useState('');

    const validate = () => {
        const errs = {};
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errs.email = 'Enter a valid email address';
        }
        if (!formData.password || formData.password.length < 8) {
            errs.password = 'Password must be at least 8 characters';
        } else if (!/\d/.test(formData.password)) {
            errs.password = 'Password must contain at least one number';
        }
        return errs;
    };

    const handleNext = (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setErrors({});
        setStep(2);
    };

    const handleSubmit = async () => {
        if (!formData.accountType) {
            setApiError('Please select your account type');
            return;
        }
        setSubmitting(true);
        setApiError('');
        try {
            const user = await register(formData.email, formData.password, formData.accountType);
            toast.success('Account created! Let\'s set up your profile.');
            const returnUrl = sessionStorage.getItem('returnUrl') || '/feed';
            sessionStorage.removeItem('returnUrl');
            navigate(user.onboardingComplete ? returnUrl : '/onboarding');
        } catch (err) {
            setApiError(err.response?.data?.error || 'Registration failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleRegister = () => {
        const baseUrl = import.meta.env.VITE_API_URL || 'https://travelpod-production.up.railway.app/api';
        window.location.href = isCapacitor ? `${baseUrl}/auth/google?source=app` : `${baseUrl}/auth/google`;
    };

    return (
        <div className="auth-page">
            <div className="auth-bg">
                <div className="orb orb-1" /><div className="orb orb-2" />
            </div>
            <div className="auth-card">
                <Link to="/" className="auth-logo">
                    <div className="auth-logo-icon">✈️</div>
                    <span className="auth-logo-text">Travelpod</span>
                </Link>

                {step === 1 ? (
                    <>
                        <h1 className="auth-title">Create your account</h1>
                        <p className="auth-subtitle">Join thousands of travel creators and businesses</p>

                        {apiError && (
                            <div className="auth-alert error" style={{ marginBottom: 'var(--space-5)' }}>
                                <HiExclamationCircle /> {apiError}
                            </div>
                        )}

                        <form className="auth-form" onSubmit={handleNext}>
                            <div className="form-field">
                                <label className="form-label">Email address</label>
                                <input
                                    id="register-email"
                                    type="email"
                                    className={`form-input${errors.email ? ' error' : ''}`}
                                    placeholder="you@example.com"
                                    value={formData.email}
                                    onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                                    autoComplete="email"
                                />
                                {errors.email && <span className="form-error"><HiExclamationCircle />{errors.email}</span>}
                            </div>

                            <div className="form-field">
                                <label className="form-label">Password</label>
                                <input
                                    id="register-password"
                                    type="password"
                                    className={`form-input${errors.password ? ' error' : ''}`}
                                    placeholder="Min. 8 characters, at least one number"
                                    value={formData.password}
                                    onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                                    autoComplete="new-password"
                                />
                                {errors.password && <span className="form-error"><HiExclamationCircle />{errors.password}</span>}
                            </div>

                            <button id="register-next-btn" type="submit" className="auth-submit">
                                Continue →
                            </button>
                        </form>

                        <div className="auth-divider">
                            <span>or</span>
                        </div>

                        <button className="auth-google" onClick={handleGoogleRegister} type="button">
                            <img src="https://www.google.com/favicon.ico" alt="Google" />
                            Continue with Google
                        </button>

                        <p className="auth-footer">
                            Already have an account? <Link to="/auth/login">Sign in</Link>
                        </p>
                    </>
                ) : (
                    <>
                        <h1 className="auth-title">I am a...</h1>
                        <p className="auth-subtitle">Choose the account type that best describes you</p>

                        {apiError && (
                            <div className="auth-alert error" style={{ marginBottom: 'var(--space-5)' }}>
                                <HiExclamationCircle /> {apiError}
                            </div>
                        )}

                        <div className="role-grid">
                            {ACCOUNT_TYPES.map(type => (
                                <button
                                    key={type.value}
                                    id={`role-${type.value.toLowerCase()}`}
                                    type="button"
                                    className={`role-option${formData.accountType === type.value ? ' selected' : ''}`}
                                    onClick={() => setFormData(f => ({ ...f, accountType: type.value }))}
                                >
                                    {type.icon}
                                    {type.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                            <button
                                type="button"
                                className="auth-submit"
                                style={{ background: 'var(--bg-elevated)', flex: '0 0 auto', width: 48, borderRadius: 'var(--radius-full)' }}
                                onClick={() => setStep(1)}
                            >←</button>
                            <button
                                id="register-submit-btn"
                                type="button"
                                className="auth-submit"
                                style={{ flex: 1 }}
                                onClick={handleSubmit}
                                disabled={submitting || !formData.accountType}
                            >
                                {submitting ? 'Creating account...' : 'Create Account'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
