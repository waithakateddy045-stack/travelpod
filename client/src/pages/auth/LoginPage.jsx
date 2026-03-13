import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { HiOutlineExclamationCircle } from 'react-icons/hi2';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../context/AuthContext';
import './AuthPage.css';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || '';
    const targetEmail = location.state?.targetEmail || email;
    const isCapacitor = typeof window !== 'undefined' && Capacitor.isNativePlatform();
    const { login } = useAuth();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [submitting, setSubmitting] = useState(false);
    const [apiError, setApiError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setApiError('');
        try {
            const result = await login(formData.email, formData.password);
            
            if (result.requiresMfa) {
                toast.success('Verification required');
                navigate('/verify-otp', { state: { email: result.email, targetEmail: result.targetEmail, devModeOtp: result.devModeOtp } });
                return;
            }

            toast.success('Welcome back!');
            const returnUrl = sessionStorage.getItem('returnUrl') || '/feed';
            sessionStorage.removeItem('returnUrl');
            navigate(result.onboardingComplete ? returnUrl : '/onboarding');
        } catch (err) {
            setApiError(err.response?.data?.error || 'Login failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleLogin = () => {
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

                <h1 className="auth-title">Welcome back</h1>
                <p className="auth-subtitle">Sign in to continue your journey</p>

                {apiError && (
                    <div className="auth-alert error" style={{ marginBottom: 'var(--space-5)' }}>
                        <HiOutlineExclamationCircle /> {apiError}
                    </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-field">
                        <label className="form-label">Email address</label>
                        <input
                            id="login-email"
                            type="email"
                            className="form-input"
                            placeholder="you@example.com"
                            value={formData.email}
                            onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div className="form-field">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label className="form-label">Password</label>
                            <Link to="/auth/forgot-password" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary-light)' }}>
                                Forgot password?
                            </Link>
                        </div>
                        <input
                            id="login-password"
                            type="password"
                            className="form-input"
                            placeholder="Your password"
                            value={formData.password}
                            onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                            autoComplete="current-password"
                            required
                        />
                    </div>

                    <button
                        id="login-submit-btn"
                        type="submit"
                        className="auth-submit"
                        disabled={submitting}
                    >
                        {submitting ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>or</span>
                </div>
                <button className="auth-google" onClick={handleGoogleLogin} type="button">
                    <img src="https://www.google.com/favicon.ico" alt="Google" />
                    Continue with Google
                </button>

                <div className="auth-footer">
                    Don't have an account? <Link to="/auth/register">Create one free</Link>
                </div>
            </div>
        </div>
    );
}
