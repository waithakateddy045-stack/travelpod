import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HiOutlineXMark } from 'react-icons/hi2';
import './AuthPromptModal.css';

export default function AuthPromptModal({ isOpen, onClose, message }) {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAuthAction = (path) => {
        sessionStorage.setItem('returnUrl', location.pathname + location.search);
        navigate(path);
        onClose();
    };

    return (
        <div className="auth-prompt-overlay" onClick={onClose}>
            <div className="auth-prompt-content animate-scaleIn" onClick={e => e.stopPropagation()}>
                <button className="auth-prompt-close" onClick={onClose} aria-label="Close">
                    <HiOutlineXMark />
                </button>

                <div className="auth-prompt-logo">✈️</div>
                <h2 className="auth-prompt-title">Join Travelpod</h2>
                <p className="auth-prompt-message">
                    {message || "Join Travelpod to unlock the full experience"}
                </p>

                <div className="auth-prompt-actions">
                    <button
                        className="auth-prompt-btn-primary"
                        onClick={() => handleAuthAction('/auth/register')}
                    >
                        Create Free Account
                    </button>
                    <button
                        className="auth-prompt-btn-secondary"
                        onClick={() => handleAuthAction('/auth/login')}
                    >
                        Log In
                    </button>
                </div>
            </div>
        </div>
    );
}
