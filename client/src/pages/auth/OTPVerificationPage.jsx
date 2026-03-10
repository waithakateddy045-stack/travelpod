import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { HiOutlineExclamationCircle, HiOutlineEnvelope } from 'react-icons/hi2';
import api from '../../services/api';
import './AuthPage.css';

export default function OTPVerificationPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || '';

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [submitting, setSubmitting] = useState(false);
    const [apiError, setApiError] = useState('');
    const [countdown, setCountdown] = useState(60);
    const inputRefs = useRef([]);

    useEffect(() => {
        if (!email) {
            navigate('/auth/register');
        }
    }, [email, navigate]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleChange = (index, value) => {
        if (isNaN(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text/plain').slice(0, 6);
        if (/^\d{1,6}$/.test(pastedData)) {
            const newOtp = [...otp];
            for (let i = 0; i < pastedData.length; i++) {
                newOtp[i] = pastedData[i];
            }
            setOtp(newOtp);
            if (pastedData.length === 6) {
                inputRefs.current[5].focus();
            } else {
                inputRefs.current[pastedData.length].focus();
            }
        }
    };

    const handleVerify = async (e) => {
        if (e) e.preventDefault();
        const code = otp.join('');
        if (code.length < 6) {
            setApiError('Please enter all 6 digits');
            return;
        }

        setSubmitting(true);
        setApiError('');
        try {
            const res = await api.post('/auth/verify-otp', { email, code });
            const { accessToken, user } = res.data;
            if (accessToken) {
                localStorage.setItem('accessToken', accessToken);
                toast.success('Email verified successfully!');
                navigate(user.onboardingComplete ? '/feed' : '/onboarding');
                window.location.reload();
            }
        } catch (err) {
            setApiError(err.response?.data?.error || 'Verification failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResend = async () => {
        if (countdown > 0) return;
        try {
            await api.post('/auth/resend-otp', { email });
            toast.success('Verification code resent');
            setCountdown(60);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to resend code');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-bg">
                <div className="orb orb-1" /><div className="orb orb-2" />
            </div>
            <div className="auth-card">
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', color: 'var(--accent-primary)', fontSize: 32, marginBottom: 16 }}>
                        <HiOutlineEnvelope />
                    </div>
                    <h1 className="auth-title">Verify your email</h1>
                    <p className="auth-subtitle">We've sent a 6-digit verification code to <strong>{email}</strong>. Entering it below helps keep your account secure.</p>
                </div>

                {apiError && (
                    <div className="auth-alert error" style={{ marginBottom: 'var(--space-5)' }}>
                        <HiOutlineExclamationCircle /> {apiError}
                    </div>
                )}

                <form className="auth-form" onSubmit={handleVerify}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => inputRefs.current[index] = el}
                                type="text"
                                inputMode="numeric"
                                maxLength="1"
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={handlePaste}
                                style={{
                                    width: '48px',
                                    height: '56px',
                                    textAlign: 'center',
                                    fontSize: '24px',
                                    fontWeight: 'bold',
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)'
                                }}
                            />
                        ))}
                    </div>

                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                        Code expires in 10 minutes
                    </p>

                    <button type="submit" className="auth-submit" disabled={submitting}>
                        {submitting ? 'Verifying...' : 'Verify Email'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '24px' }}>
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={countdown > 0}
                            style={{ background: 'none', border: 'none', color: countdown > 0 ? 'var(--text-muted)' : 'var(--accent-primary)', cursor: countdown > 0 ? 'default' : 'pointer', fontWeight: 'bold' }}
                        >
                            {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
