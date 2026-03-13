import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { secureStorage } from '../utils/secureStorage';

export const AuthContext = createContext(null);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authModal, setAuthModal] = useState({ isOpen: false, message: '', type: null });
    const [pendingAction, setPendingAction] = useState(null);

    const loadUser = useCallback(async () => {
        const token = await secureStorage.getItem('travelpod_token');
        if (!token) { setLoading(false); return; }
        try {
            const { data } = await api.get('/auth/me');
            setUser(data.user);
        } catch (error) {
            if (error.response?.status === 401) {
                await secureStorage.removeItem('travelpod_token');
                await secureStorage.removeItem('travelpod_refresh');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadUser(); }, [loadUser]);

    const login = async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        
        if (data.requiresMfa) {
             return { requiresMfa: true, email: data.email || email, targetEmail: data.targetEmail };
        }

        if (data.sessionToken) {
            await secureStorage.setItem('travelpod_token', data.sessionToken);
        }
        await secureStorage.setItem('travelpod_refresh', data.refreshToken);
        setUser(data.user);

        // Auto-replay pending action
        if (pendingAction) {
            setTimeout(() => {
                pendingAction();
                setPendingAction(null);
            }, 500);
        }

        return data.user;
    };

    const register = async (email, password, accountType) => {
        const { data } = await api.post('/auth/register', { email, password, accountType });
        return data;
    };

    const logout = async () => {
        const refreshToken = await secureStorage.getItem('travelpod_refresh');
        try { await api.post('/auth/logout', { refreshToken }); } catch { }
        await secureStorage.removeItem('travelpod_token');
        await secureStorage.removeItem('travelpod_access');
        await secureStorage.removeItem('travelpod_refresh');
        setUser(null);
    };

    /**
     * Helper to gate interactions. Shows AuthPromptModal if not logged in.
     */
    const showAuthPrompt = useCallback((message, action = null) => {
        if (user) {
            if (action) action();
            return;
        }
        setPendingAction(() => action);
        setAuthModal({ isOpen: true, message, type: 'INTERACTION' });
    }, [user]);

    const [isMuted, setIsMuted] = useState(() => {
        const saved = localStorage.getItem('travelpod_is_muted');
        return saved === null ? true : saved === 'true';
    });

    const [notificationCount, setNotificationCount] = useState(0);
    const [messageCount, setMessageCount] = useState(0);

    const checkCounts = useCallback(async () => {
        if (!user) return;
        try {
            const [notifRes, msgRes] = await Promise.all([
                api.get('/notifications/unread-count'),
                api.get('/messages/unread-count')
            ]);
            setNotificationCount(notifRes.data.count || 0);
            setMessageCount(msgRes.data.count || 0);
        } catch { }
    }, [user]);

    useEffect(() => {
        localStorage.setItem('travelpod_is_muted', isMuted);
    }, [isMuted]);

    useEffect(() => {
        if (user) {
            checkCounts();
            const interval = setInterval(checkCounts, 30000); // Poll every 30s
            return () => clearInterval(interval);
        } else {
            setNotificationCount(0);
            setMessageCount(0);
        }
    }, [user, checkCounts]);

    return (
        <AuthContext.Provider value={{
            user, setUser, loading, login, register, logout, loadUser,
            isMuted, setIsMuted,
            notificationCount, setNotificationCount,
            messageCount, setMessageCount,
            checkCounts,
            authModal, setAuthModal, showAuthPrompt, pendingAction
        }}>
            {children}
            {/* Global Auth Prompt Modal */}
            <AuthPromptModal
                isOpen={authModal.isOpen}
                onClose={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
                message={authModal.message}
            />
        </AuthContext.Provider>
    );
};

// Import component here to avoid circular dependency if it was in components
import AuthPromptModal from '../components/auth/AuthPromptModal';
