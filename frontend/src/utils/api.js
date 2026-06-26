const DEFAULT_BASE_URL = '/api/v1';

const normalizeBaseUrl = (value) => {
    if (!value) {
        return DEFAULT_BASE_URL;
    }

    const trimmed = String(value).trim().replace(/\/$/, '');
    return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
};

export const API_BASE_URL = normalizeBaseUrl(
    import.meta.env.VITE_API_BASE_URL
    || import.meta.env.VITE_BACKEND_URL
    || import.meta.env.VITE_RENDER_API_URL
);

export const apiUrl = (endpoint) => `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;