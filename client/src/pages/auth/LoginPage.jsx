import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { HiExclamationCircle } from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import './AuthPage.css';

export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [submitting, setSubmitting] = useState(false);
    const [apiError, setApiError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setApiError('');
        try {
            const user = await login(formData.email, formData.password);
            toast.success('Welcome back!');
            navigate(user.onboardingComplete ? '/feed' : '/onboarding');
        } catch (err) {
            setApiError(err.response?.data?.error || 'Login failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/google`;
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
                        <HiExclamationCircle /> {apiError}
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

                <div className="auth-divider">or</div>

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
