import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    HiOutlineArrowLeft, HiOutlineHeart, HiHeart, HiOutlineBookmark, HiBookmark,
    HiOutlineMapPin, HiOutlineFilm, HiOutlinePlusCircle, HiOutlineCheckBadge,
    HiOutlineFunnel, HiOutlineSparkles, HiOutlineClock
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import AuthPromptModal from '../../components/auth/AuthPromptModal';
import api from '../../services/api';
import './BoardsFeedPage.css';

const DESTINATIONS = [
    'All', 'Kenya', 'Tanzania', 'South Africa', 'Morocco', 'Egypt',
    'Thailand', 'Japan', 'Italy', 'Indonesia', 'Peru', 'Greece',
    'UAE', 'Maldives', 'Portugal', 'Rwanda', 'Mexico', 'Iceland',
    'Ethiopia', 'Uganda', 'Vietnam', 'Colombia', 'Sri Lanka', 'Mauritius',
];

export default function BoardsFeedPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [destination, setDestination] = useState('All');
    const [sort, setSort] = useState('newest');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [authModal, setAuthModal] = useState({ isOpen: false, message: '' });

    const loadBoards = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 20, sort });
            if (destination && destination !== 'All') params.set('destination', destination);
            const { data } = await api.get(`/boards/feed?${params}`);
            setBoards(data.boards || []);
            setTotalPages(data.totalPages || 1);
        } catch {
            setBoards([]);
        } finally {
            setLoading(false);
        }
    }, [page, destination, sort]);

    useEffect(() => { loadBoards(); }, [loadBoards]);

    const handleLike = async (e, boardId) => {
        e.preventDefault(); e.stopPropagation();
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Like trip boards to save them for later' });
            return;
        }
        try {
            const { data } = await api.post(`/boards/${boardId}/like`);
            setBoards(prev => prev.map(b => b.id === boardId ? { ...b, isLiked: data.liked, likeCount: b.likeCount + (data.liked ? 1 : -1) } : b));
        } catch { }
    };

    const handleSave = async (e, boardId) => {
        e.preventDefault(); e.stopPropagation();
        if (!user) {
            setAuthModal({ isOpen: true, message: 'Save videos to your trip boards' });
            return;
        }
        try {
            const { data } = await api.post(`/boards/${boardId}/save`);
            setBoards(prev => prev.map(b => b.id === boardId ? { ...b, isSaved: data.saved, saveCount: b.saveCount + (data.saved ? 1 : -1) } : b));
        } catch { }
    };

    return (
        <div className="boards-feed-page">
            {/* Header */}
            <nav className="boards-nav">
                <button className="boards-back" onClick={() => navigate('/feed')}>
                    <HiOutlineArrowLeft />
                </button>
                <h1 className="boards-title">Trip Boards</h1>
                {user && (
                    <button className="boards-create-btn" onClick={() => navigate('/boards/create')}>
                        <HiOutlinePlusCircle />
                    </button>
                )}
            </nav>

            {/* Sort toggle */}
            <div className="boards-sort-bar">
                <button className={`sort-btn ${sort === 'newest' ? 'active' : ''}`} onClick={() => { setSort('newest'); setPage(1); }}>
                    <HiOutlineClock /> Newest
                </button>
                <button className={`sort-btn ${sort === 'popular' ? 'active' : ''}`} onClick={() => { setSort('popular'); setPage(1); }}>
                    <HiOutlineSparkles /> Most Popular
                </button>
            </div>

            {/* Destination pills */}
            <div className="boards-dest-bar">
                {DESTINATIONS.map(d => (
                    <button
                        key={d}
                        className={`dest-pill ${destination === d ? 'active' : ''}`}
                        onClick={() => { setDestination(d); setPage(1); }}
                    >
                        {d !== 'All' && <HiOutlineMapPin />}
                        {d}
                    </button>
                ))}
            </div>

            {/* Board grid */}
            {loading ? (
                <div className="boards-loading">
                    <div className="boards-spinner" />
                    <p>Loading boards...</p>
                </div>
            ) : boards.length === 0 ? (
                <div className="boards-empty">
                    <div className="boards-empty-icon">🗺️</div>
                    <h3>No boards found</h3>
                    <p>Be the first to create a board for this destination!</p>
                </div>
            ) : (
                <div className="boards-grid">
                    {boards.map(board => (
                        <Link key={board.id} to={`/boards/${board.id}`} className="board-card">
                            <div className="board-cover">
                                {board.coverImage ? (
                                    <img src={board.coverImage} alt={board.title} />
                                ) : (
                                    <div className="board-cover-placeholder">
                                        <HiOutlineMapPin />
                                    </div>
                                )}
                                {board.destination && (
                                    <span className="board-dest-badge">
                                        <HiOutlineMapPin /> {board.destination}
                                    </span>
                                )}
                            </div>
                            <div className="board-body">
                                <h3 className="board-card-title">{board.title}</h3>
                                {board.description && (
                                    <p className="board-card-desc">{board.description}</p>
                                )}
                                <div className="board-creator">
                                    <div className="board-creator-avatar">
                                        {board.user?.profile?.avatarUrl
                                            ? <img src={board.user.profile.avatarUrl} alt="" />
                                            : <span>👤</span>}
                                    </div>
                                    <span className="board-creator-name">
                                        {board.user?.profile?.displayName || 'Unknown'}
                                        {board.user?.profile?.businessProfile?.verificationStatus === 'APPROVED' && (
                                            <HiOutlineCheckBadge className="board-verified" />
                                        )}
                                    </span>
                                </div>
                                <div className="board-stats">
                                    <span><HiOutlineFilm /> {board.videoCount || 0} videos</span>
                                    <span className="board-stat-dot">·</span>
                                    <button className="board-stat-btn" onClick={(e) => handleLike(e, board.id)}>
                                        {board.isLiked ? <HiHeart className="liked" /> : <HiOutlineHeart />} {board.likeCount || 0}
                                    </button>
                                    <button className="board-stat-btn" onClick={(e) => handleSave(e, board.id)}>
                                        {board.isSaved ? <HiBookmark className="saved" /> : <HiOutlineBookmark />} {board.saveCount || 0}
                                    </button>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="boards-pagination">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                    <span>Page {page} / {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
            )}

            <AuthPromptModal
                isOpen={authModal.isOpen}
                onClose={() => setAuthModal({ isOpen: false, message: '' })}
                message={authModal.message}
            />
        </div>
    );
}
