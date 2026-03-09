import { useState, useEffect } from 'react';
import { HiOutlineXMark, HiOutlineUser, HiOutlineMagnifyingGlass, HiOutlineStar } from 'react-icons/hi2';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function RecommendModal({ post, onClose }) {
    const { user } = useAuth();
    const [followers, setFollowers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(null);

    useEffect(() => {
        if (user) {
            api.get(`/users/${user.profile?.handle}/followers`)
                .then(res => setFollowers(res.data.followers || []))
                .catch(() => toast.error('Failed to load followers'))
                .finally(() => setLoading(false));
        }
    }, [user]);

    const filtered = followers.filter(f =>
        f.profile?.displayName?.toLowerCase().includes(search.toLowerCase()) ||
        f.profile?.handle?.toLowerCase().includes(search.toLowerCase())
    );

    const handleRecommend = async (targetUserId) => {
        setSending(targetUserId);
        try {
            await api.post(`/posts/${post.id}/recommend`, { targetUserId });
            toast.success('Recommended!');
            onClose();
        } catch (err) {
            toast.error('Failed to recommend');
        } finally {
            setSending(null);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2100, backdropFilter: 'blur(10px)'
        }}>
            <div className="modal-box glass-card" onClick={e => e.stopPropagation()} style={{
                width: '100%', maxWidth: 400, borderRadius: 28, padding: 24,
                maxHeight: '70vh', display: 'flex', flexDirection: 'column',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Recommend to Follower</h3>
                    <button onClick={onClose} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>
                        <HiOutlineXMark />
                    </button>
                </div>

                <div style={{ position: 'relative', marginBottom: 20 }}>
                    <HiOutlineMagnifyingGlass style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        type="text"
                        placeholder="Search for a follower..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '12px 16px 12px 40px', borderRadius: 12,
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white', outline: 'none'
                        }}
                    />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 20 }}>Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)' }}>No followers found</div>
                    ) : (
                        filtered.map(f => (
                            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                                    {f.profile?.avatarUrl ? (
                                        <img src={f.profile.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><HiOutlineUser /></div>}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{f.profile?.displayName}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>@{f.profile?.handle}</div>
                                </div>
                                <button
                                    onClick={() => handleRecommend(f.id)}
                                    disabled={sending === f.id}
                                    style={{
                                        padding: '8px 16px', borderRadius: 12, border: 'none',
                                        background: 'var(--color-primary)', color: 'white',
                                        fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        transition: 'transform 0.2s'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <HiOutlineStar /> {sending === f.id ? '...' : 'Recommend'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
