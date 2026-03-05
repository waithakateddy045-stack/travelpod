import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function OAuthCallbackPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { loadUser } = useAuth();

    useEffect(() => {
        const accessToken = params.get('accessToken');
        const refreshToken = params.get('refreshToken');
        const onboarding = params.get('onboarding');

        if (accessToken) {
            localStorage.setItem('travelpod_token', accessToken);
            if (refreshToken) localStorage.setItem('travelpod_refresh', refreshToken);
            loadUser().then(() => {
                // onboarding param is 'true' when onboarding IS complete (comes from backend)
                navigate(onboarding === 'true' ? '/feed' : '/onboarding', { replace: true });
            });
        } else {
            // No token was returned — oauth failed
            navigate('/auth/login?error=oauth_failed', { replace: true });
        }
    }, [params, navigate, loadUser]);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, border: '3px solid var(--border-primary)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto var(--space-4)' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Completing sign in...</p>
            </div>
        </div>
    );
}
