import axios from 'axios';
import { secureStorage } from '../utils/secureStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function debugLog(payload) {
    // #region agent log
    if (import.meta.env.DEV) {
        console.debug('API Debug Log:', payload);
    }
    // #endregion
}

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
    async (config) => {
        debugLog({
            runId: 'pre-fix',
            hypothesisId: 'H1',
            location: 'client/src/services/api.js:request',
            message: 'API request',
            data: {
                baseURL: API_BASE_URL,
                url: config?.url,
                method: config?.method,
            },
        });
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
        debugLog({
            runId: 'pre-fix',
            hypothesisId: 'H2',
            location: 'client/src/services/api.js:response',
            message: 'API error',
            data: {
                baseURL: API_BASE_URL,
                url: error?.config?.url,
                method: error?.config?.method,
                status: error?.response?.status || null,
                errorMessage: error?.message,
                responseMessage: error?.response?.data?.message,
            },
        });
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
