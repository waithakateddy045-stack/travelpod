import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    HiOutlineMagnifyingGlass, HiOutlineUser, HiOutlineArrowLeft,
    HiOutlineFilm, HiOutlineStar, HiOutlineMapPin
} from 'react-icons/hi2';
import api from '../../services/api';
import './ExplorePage.css';

const CATEGORIES = [
    'Destinations', 'Hotels & Resorts', 'Restaurants & Food',
    'Adventures & Activities', 'Travel Tips', 'Flight Reviews',
    'Safari', 'Beach', 'City Life', 'Culture & History', 'Nightlife', 'Wellness',
];

export default function ExplorePage() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState('posts');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const doSearch = useCallback(async (q) => {
        if (!q.trim()) { setResults([]); setSearched(false); return; }
        setLoading(true);
        setSearched(true);
        try {
            const { data } = await api.get(`/search?q=${encodeURIComponent(q)}&type=${searchType}`);
            setResults(data.results || []);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [searchType]);

    useEffect(() => {
        const delay = setTimeout(() => { if (query.trim()) doSearch(query); }, 400);
        return () => clearTimeout(delay);
    }, [query, doSearch]);

    return (
        <div className="explore-page">
            <nav className="explore-nav">
                <button className="explore-back" onClick={() => navigate(-1)}>
                    <HiOutlineArrowLeft />
                </button>
                <div className="explore-search-wrap">
                    <HiOutlineMagnifyingGlass className="explore-search-icon" />
                    <input
                        id="explore-search-input"
                        className="explore-search-input"
                        type="text"
                        autoFocus
                        placeholder="Search videos, places, creators..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    {query && (
                        <button className="explore-clear" onClick={() => { setQuery(''); setResults([]); setSearched(false); }}>✕</button>
                    )}
                </div>
            </nav>

            {/* Type toggle */}
            <div className="explore-tabs">
                {['posts', 'users'].map(t => (
                    <button
                        key={t}
                        className={`explore-tab${searchType === t ? ' active' : ''}`}
                        onClick={() => { setSearchType(t); if (query.trim()) doSearch(query); }}
                    >
                        {t === 'posts' ? <><HiOutlineFilm /> Videos</> : <><HiOutlineUser /> Creators</>}
                    </button>
                ))}
            </div>

            {/* Discovery categories (show when no search active) */}
            {!searched && (
                <div className="explore-categories">
                    <h2 className="explore-section-title">Browse by Category</h2>
                    <div className="explore-category-grid">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                className="explore-category-chip"
                                onClick={() => { setQuery(cat); setSearchType('posts'); }}
                            >
                                <HiOutlineMapPin />
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Results */}
            {loading && (
                <div className="explore-loading">
                    <div className="explore-spinner" />
                    <p>Searching...</p>
                </div>
            )}

            {!loading && searched && results.length === 0 && (
                <div className="explore-empty">
                    <div className="explore-empty-icon">🔍</div>
                    <p>No results found for <strong>"{query}"</strong></p>
                    <span>Try different keywords or browse categories above</span>
                </div>
            )}

            {!loading && results.length > 0 && (
                <div className="explore-results">
                    {searchType === 'posts' && results.map(post => (
                        <Link key={post.id} to={`/post/${post.id}`} className="explore-post-card">
                            {post.thumbnailUrl ? (
                                <img src={post.thumbnailUrl} alt={post.title} className="explore-post-thumb" />
                            ) : (
                                <div className="explore-post-thumb explore-thumb-placeholder">
                                    <HiOutlineFilm />
                                </div>
                            )}
                            <div className="explore-post-info">
                                <h3 className="explore-post-title">{post.title}</h3>
                                <div className="explore-post-meta">
                                    {post.user?.profile?.handle && (
                                        <span className="explore-post-author">@{post.user.profile.handle}</span>
                                    )}
                                    {post.category && <span className="explore-post-cat">{post.category}</span>}
                                </div>
                                <div className="explore-post-stats">
                                    <span>❤️ {post.likeCount || 0}</span>
                                    {post.location && <span><HiOutlineMapPin /> {post.location}</span>}
                                </div>
                            </div>
                        </Link>
                    ))}

                    {searchType === 'users' && results.map(profile => (
                        <Link key={profile.handle} to={`/profile/${profile.handle}`} className="explore-user-card">
                            <div className="explore-user-avatar">
                                {profile.avatarUrl
                                    ? <img src={profile.avatarUrl} alt={profile.displayName} />
                                    : <HiOutlineUser />}
                            </div>
                            <div className="explore-user-info">
                                <div className="explore-user-name">{profile.displayName}</div>
                                <div className="explore-user-handle">@{profile.handle}</div>
                                <div className="explore-user-meta">
                                    {profile.followerCount > 0 && <span>{profile.followerCount} followers</span>}
                                    {profile.businessProfile?.verificationStatus === 'APPROVED' && (
                                        <span className="explore-verified">✓ Verified</span>
                                    )}
                                    {profile.businessProfile?.starRating > 0 && (
                                        <span><HiOutlineStar /> {profile.businessProfile.starRating.toFixed(1)}</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
