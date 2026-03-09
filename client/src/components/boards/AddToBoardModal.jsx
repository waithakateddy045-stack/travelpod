import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { HiOutlineXMark, HiOutlinePlus, HiOutlineFolder } from 'react-icons/hi2';
import api from '../../services/api';

export default function AddToBoardModal({ postId, onClose }) {
    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newBoardTitle, setNewBoardTitle] = useState('');
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => {
        loadBoards();
    }, []);

    const loadBoards = async () => {
        try {
            const { data } = await api.get('/boards/user/me'); // Assuming an endpoint for current user boards
            setBoards(data.boards || []);
        } catch (err) {
            // Fallback: search for handle if /me doesn't exist or similar
            toast.error('Failed to load boards');
        } finally {
            setLoading(false);
        }
    };

    const handleAddToBoard = async (boardId) => {
        setActionLoading(boardId);
        try {
            await api.post(`/boards/${boardId}/videos`, { postId });
            toast.success('Added to board!');
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
            toast.success('Board created!');
            // Now add post to this new board
            await handleAddToBoard(data.board.id);
        } catch (err) {
            toast.error('Failed to create board');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, backdropFilter: 'blur(8px)'
        }}>
            <div className="modal-box glass-card" onClick={e => e.stopPropagation()} style={{
                width: '100%', maxWidth: 400, borderRadius: 24, padding: 24,
                maxHeight: '80vh', display: 'flex', flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Save to Board</h3>
                    <button onClick={onClose} style={{ color: 'var(--text-secondary)', fontSize: '1.5rem' }}>
                        <HiOutlineXMark />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 20 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 20 }}>Loading boards...</div>
                    ) : boards.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>You don't have any boards yet.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {boards.map(board => (
                                <button
                                    key={board.id}
                                    onClick={() => handleAddToBoard(board.id)}
                                    disabled={actionLoading === board.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)', color: 'white',
                                        textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                >
                                    <HiOutlineFolder style={{ fontSize: 20, color: 'var(--color-primary)' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600 }}>{board.title}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{board.videoCount || 0} videos</div>
                                    </div>
                                    {actionLoading === board.id && <div className="spinner-xs" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <form onSubmit={handleCreateBoard} style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20 }}>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="New Board Title..."
                            value={newBoardTitle}
                            onChange={e => setNewBoardTitle(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: 12,
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white', outline: 'none'
                            }}
                        />
                        <button
                            type="submit"
                            disabled={creating || !newBoardTitle.trim()}
                            style={{
                                position: 'absolute', right: 8, top: 8, bottom: 8,
                                background: 'var(--color-primary)', border: 'none', borderRadius: 8,
                                color: 'white', px: 12, fontSize: 13, fontWeight: 700,
                                opacity: !newBoardTitle.trim() || creating ? 0.5 : 1
                            }}
                        >
                            {creating ? '...' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
