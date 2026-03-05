import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadUser = useCallback(async () => {
        const token = localStorage.getItem('travelpod_token');
        if (!token) { setLoading(false); return; }
        try {
            const { data } = await api.get('/auth/me');
            setUser(data.user);
        } catch {
            localStorage.removeItem('travelpod_token');
            localStorage.removeItem('travelpod_refresh');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadUser(); }, [loadUser]);

    const login = async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('travelpod_token', data.accessToken);
        localStorage.setItem('travelpod_refresh', data.refreshToken);
        setUser(data.user);
        return data.user;
    };

    const register = async (email, password, accountType) => {
        const { data } = await api.post('/auth/register', { email, password, accountType });
        localStorage.setItem('travelpod_token', data.accessToken);
        localStorage.setItem('travelpod_refresh', data.refreshToken);
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        const refreshToken = localStorage.getItem('travelpod_refresh');
        try { await api.post('/auth/logout', { refreshToken }); } catch { }
        localStorage.removeItem('travelpod_token');
        localStorage.removeItem('travelpod_refresh');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, loadUser }}>
            {children}
        </AuthContext.Provider>
    );
};
