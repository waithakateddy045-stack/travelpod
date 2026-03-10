import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';
let flagCache = null;
let fetchPromise = null;

async function fetchFlags() {
    if (flagCache) return flagCache;
    if (fetchPromise) return fetchPromise;

    fetchPromise = axios.get(`${API}/features`)
        .then(res => {
            const map = {};
            (res.data.features || []).forEach(f => { map[f.name] = f.isEnabled; });
            flagCache = map;
            return map;
        })
        .catch(() => {
            flagCache = {};
            return {};
        });

    return fetchPromise;
}

export default function useFeatureFlag(flagName) {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFlags().then(flags => {
            setEnabled(!!flags[flagName]);
            setLoading(false);
        });
    }, [flagName]);

    return { enabled, loading };
}

// Force re-fetch (e.g. after admin toggle)
export function clearFeatureFlagCache() {
    flagCache = null;
    fetchPromise = null;
}
