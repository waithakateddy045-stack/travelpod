import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEffect } from 'react';

export default function ProtectedRoute({ children, requireOnboarding = true }) {
    const { user, loading, showAuthPrompt } = useAuth();
    const location = useLocation();

    useEffect(() => {
        if (!loading && !user) {
            const msgs = {
                '/upload': 'Sign in to post your travel videos',
                '/messages': 'Log in to message creators',
                '/notifications': 'Sign in to see your updates',
                '/boards': 'Log in to see your trip boards',
                '/settings': 'Log in to manage your account',
                '/onboarding': 'Sign in to set up your profile',
            };
            showAuthPrompt(msgs[location.pathname] || 'Sign in to access this page');
        }
    }, [user, loading, location.pathname, showAuthPrompt]);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
                <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!user) return <Navigate to="/" replace />;
    if (requireOnboarding && !user.onboardingComplete) return <Navigate to="/onboarding" replace />;

    return children;
}
