import { useState, useEffect } from 'react';
import { X, Mail, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import './AuthPromptModal.css';

const ACCOUNT_TYPES = [
    { id: 'TRAVELER', label: 'Traveler', description: 'Discover and save spots' },
    { id: 'TRAVEL_AGENCY', label: 'Travel Agency', description: 'Promote travel packages' },
    { id: 'HOTEL_RESORT', label: 'Hotel/Resort', description: 'Showcase your property' },
    { id: 'DESTINATION', label: 'Destination', description: 'Official tourism board' },
    { id: 'AIRLINE', label: 'Airline', description: 'Fly with the world' },
    { id: 'ASSOCIATION', label: 'Association', description: 'Trade bodies & groups' }
];

export default function AuthPromptModal({ isOpen, onClose, message }) {
    const { login, register } = useAuth();
    const [mode, setMode] = useState('LOGIN'); // 'LOGIN' | 'SIGNUP'
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        accountType: 'TRAVELER'
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setMode('LOGIN'); // Default to login on open
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === 'LOGIN') {
                await login(formData.email, formData.password);
                toast.success('Logged in successfully!');
            } else {
                await register(formData.email, formData.password, formData.accountType);
                toast.success('Welcome to Travelpod!');
            }
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        window.location.href = `${API_URL}/auth/google?source=web`;
    };

    return (
        <div className="auth-prompt-overlay" onClick={onClose}>
            <div className="auth-prompt-content animate-scaleIn" onClick={e => e.stopPropagation()}>
                <button className="auth-prompt-close" onClick={onClose} aria-label="Close">
                    <X />
                </button>

                <div className="auth-prompt-header">
                    <div className="auth-prompt-logo">travelpod</div>
                    <h2 className="auth-prompt-title">{mode === 'LOGIN' ? 'Welcome Back' : 'Join Travelpod'}</h2>
                    <p className="auth-prompt-message">
                        {message || "Sign in to unlock the full experience"}
                    </p>
                </div>

                <div className="auth-prompt-tabs">
                    <button
                        className={`auth-tab ${mode === 'LOGIN' ? 'active' : ''}`}
                        onClick={() => setMode('LOGIN')}
                    >
                        Log In
                    </button>
                    <button
                        className={`auth-tab ${mode === 'SIGNUP' ? 'active' : ''}`}
                        onClick={() => setMode('SIGNUP')}
                    >
                        Sign Up
                    </button>
                </div>

                <form className="auth-prompt-form" onSubmit={handleSubmit}>
                    <div className="auth-input-group">
                        <label>Email Address</label>
                        <div className="auth-input-wrapper">
                            <Mail className="auth-input-icon" />
                            <input
                                type="email"
                                placeholder="name@example.com"
                                required
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="auth-input-group">
                        <label>Password</label>
                        <div className="auth-input-wrapper">
                            <Lock className="auth-input-icon" />
                            <input
                                type="password"
                                placeholder="••••••••"
                                required
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                    </div>

                    {mode === 'SIGNUP' && (
                        <div className="auth-input-group">
                            <label>Account Type</label>
                            <select
                                className="auth-select"
                                value={formData.accountType}
                                onChange={e => setFormData({ ...formData, accountType: e.target.value })}
                            >
                                {ACCOUNT_TYPES.map(type => (
                                    <option key={type.id} value={type.id}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        className="auth-submit-btn"
                        disabled={loading}
                        type="submit"
                    >
                        {loading ? 'Processing...' : (mode === 'LOGIN' ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>or</span>
                </div>

                <button className="auth-google-btn" onClick={handleGoogleLogin}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
                    Continue with Google
                </button>

                <p className="auth-legal">
                    By continuing, you agree to Travelpod's <span>Terms of Service</span> and <span>Privacy Policy</span>.
                </p>
            </div>
        </div>
    );
}
