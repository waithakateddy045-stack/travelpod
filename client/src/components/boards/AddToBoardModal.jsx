import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { HiOutlineXMark, HiOutlinePlus, HiOutlineFolder, HiOutlineBookmark } from 'react-icons/hi2';
import api from '../../services/api';
import './SaveToBoardModal.css'; // Let's use a new CSS file for improved styles

export default function AddToBoardModal({ postId, onClose }) {
    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newBoardTitle, setNewBoardTitle] = useState('');
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => {
        loadBoards();
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    const loadBoards = async () => {
        try {
            const { data } = await api.get('/boards/user/me');
            setBoards(data.boards || []);
        } catch (err) {
            toast.error('Failed to load boards');
        } finally {
            setLoading(false);
        }
    };

    const handleAddToBoard = async (boardId) => {
        setActionLoading(boardId);
        try {
            await api.post(`/boards/${boardId}/videos`, { postId });
            toast.success('Successfully saved!');
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add to board');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCreateBoard = async (e) => {
        e.preventDefault();
        if (!newBoardTitle.trim()) return;
        setCreating(true);
        try {
            const { data } = await api.post('/boards', { title: newBoardTitle.trim(), isPublic: true });
            // After creation, immediately add the video
            await handleAddToBoard(data.board.id);
        } catch (err) {
            toast.error('Failed to create board');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="board-modal-overlay" onClick={onClose}>
            <div className="board-modal-content animate-scaleIn" onClick={e => e.stopPropagation()}>
                <div className="board-modal-header">
                    <div className="board-header-title">
                        <HiOutlineBookmark className="header-icon" />
                        <h2>Save to Board</h2>
                    </div>
                    <button className="board-modal-close" onClick={onClose}>
                        <HiOutlineXMark />
                    </button>
                </div>

                <div className="board-list">
                    {loading ? (
                        <div className="board-status">
                            <div className="spinner-sm" />
                            <span>Fetching your boards...</span>
                        </div>
                    ) : boards.length === 0 ? (
                        <div className="board-empty">
                            <div className="empty-icon">📂</div>
                            <p>You haven't created any boards yet.</p>
                        </div>
                    ) : (
                        <div className="board-grid">
                            {boards.map(board => (
                                <button
                                    key={board.id}
                                    className={`board-item ${actionLoading === board.id ? 'loading' : ''}`}
                                    onClick={() => handleAddToBoard(board.id)}
                                    disabled={actionLoading !== null}
                                >
                                    <div className="board-icon-wrapper">
                                        <HiOutlineFolder />
                                    </div>
                                    <div className="board-info">
                                        <span className="board-name">{board.title}</span>
                                        <span className="board-count">{board.videoCount || 0} items</span>
                                    </div>
                                    {actionLoading === board.id && <div className="spinner-xs" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="board-create-section">
                    <form onSubmit={handleCreateBoard} className="board-create-form">
                        <input
                            type="text"
                            placeholder="Create new board..."
                            value={newBoardTitle}
                            onChange={e => setNewBoardTitle(e.target.value)}
                            maxLength={30}
                        />
                        <button
                            type="submit"
                            disabled={creating || !newBoardTitle.trim()}
                            className="board-create-btn"
                        >
                            {creating ? <div className="spinner-xs" /> : <HiOutlinePlus />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
