import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { HiOutlineEnvelope } from 'react-icons/hi2';
import api from '../../services/api';
import './AuthPage.css';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email) { toast.error('Please enter your email address'); return; }
        setSubmitting(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setSent(true);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send reset email. Please try again.');
        } finally {
            setSubmitting(false);
        }
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

                {sent ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📧</div>
                        <h1 className="auth-title">Check your inbox</h1>
                        <p className="auth-subtitle" style={{ marginBottom: 'var(--space-6)' }}>
                            If <strong>{email}</strong> has an account, we've sent password reset instructions to it.
                        </p>
                        <Link to="/auth/login" style={{ color: 'var(--color-primary-light)', fontWeight: 500 }}>
                            ← Back to sign in
                        </Link>
                    </div>
                ) : (
                    <>
                        <h1 className="auth-title">Reset your password</h1>
                        <p className="auth-subtitle">Enter your email and we'll send reset instructions</p>

                        <form className="auth-form" onSubmit={handleSubmit}>
                            <div className="form-field">
                                <label className="form-label">Email address</label>
                                <div style={{ position: 'relative' }}>
                                    <HiOutlineEnvelope style={{
                                        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                                        color: 'var(--text-tertiary)', pointerEvents: 'none', fontSize: '1.1rem'
                                    }} />
                                    <input
                                        id="forgot-email"
                                        type="email"
                                        className="form-input"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        style={{ paddingLeft: '2.5rem' }}
                                        autoComplete="email"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                id="forgot-submit-btn"
                                type="submit"
                                className="auth-submit"
                                disabled={submitting}
                            >
                                {submitting ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </form>

                        <div className="auth-footer">
                            <Link to="/auth/login">← Back to sign in</Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
