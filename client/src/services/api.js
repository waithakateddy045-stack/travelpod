import axios from 'axios';
import { secureStorage } from '../utils/secureStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
    async (config) => {
        const token = await secureStorage.getItem('travelpod_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor — handle auth errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await secureStorage.removeItem('travelpod_token');
            // Optionally redirect to login
            if (window.location.pathname !== '/' && !window.location.pathname.startsWith('/auth')) {
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
