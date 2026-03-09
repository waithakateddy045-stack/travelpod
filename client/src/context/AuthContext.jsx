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
        await secureStorage.setItem('travelpod_token', data.accessToken);
        await secureStorage.setItem('travelpod_refresh', data.refreshToken);
        setUser(data.user);
        return data.user;
    };

    const register = async (email, password, accountType) => {
        const { data } = await api.post('/auth/register', { email, password, accountType });
        await secureStorage.setItem('travelpod_token', data.accessToken);
        await secureStorage.setItem('travelpod_refresh', data.refreshToken);
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        const refreshToken = await secureStorage.getItem('travelpod_refresh');
        try { await api.post('/auth/logout', { refreshToken }); } catch { }
        await secureStorage.removeItem('travelpod_token');
        await secureStorage.removeItem('travelpod_refresh');
        setUser(null);
    };

    const [isMuted, setIsMuted] = useState(() => {
        const saved = localStorage.getItem('travelpod_is_muted');
        return saved === null ? true : saved === 'true';
    });

    const [unreadCount, setUnreadCount] = useState(0);

    const checkNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await api.get('/notifications/unread-count');
            setUnreadCount(data.count || 0);
        } catch { }
    }, [user]);

    useEffect(() => {
        localStorage.setItem('travelpod_is_muted', isMuted);
    }, [isMuted]);

    useEffect(() => {
        if (user) {
            checkNotifications();
            const interval = setInterval(checkNotifications, 30000); // Poll every 30s
            return () => clearInterval(interval);
        } else {
            setUnreadCount(0);
        }
    }, [user, checkNotifications]);

    return (
        <AuthContext.Provider value={{
            user, setUser, loading, login, register, logout, loadUser,
            isMuted, setIsMuted,
            unreadCount, setUnreadCount, checkNotifications
        }}>
            {children}
        </AuthContext.Provider>
    );
};
