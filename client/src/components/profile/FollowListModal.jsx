import { useState, useEffect } from 'react';
import { HiOutlineXMark, HiOutlineUser } from 'react-icons/hi2';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import './FollowListModal.css';

export default function FollowListModal({ isOpen, onClose, username, type, title, asDropdown, inline }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !username) return;

        const fetchUsers = async () => {
            setLoading(true);
            try {
                const endpoint = type === 'followers'
                    ? `/users/${username}/followers`
                    : `/users/${username}/following`;
                const { data } = await api.get(endpoint);

                // Keep track of local following state for toggling without refetching
                const processedUsers = (type === 'followers' ? data.followers : data.following).map(u => ({
                    ...u,
                    isFollowingLocally: type === 'following' ? true : false // simplified assumption
                }));
                setUsers(processedUsers);
            } catch (error) {
                console.error('Failed to fetch users', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [isOpen, username, type]);

    const handleFollowToggle = async (e, targetUserId, index) => {
        e.preventDefault();
        e.stopPropagation();

        const user = users[index];
        const isFollowing = user.isFollowingLocally;

        try {
            if (isFollowing) {
                await api.delete(`/follow/${targetUserId}`);
            } else {
                await api.post(`/follow/${targetUserId}`);
            }
            // Optimistic update
            const newUsers = [...users];
            newUsers[index].isFollowingLocally = !isFollowing;
            setUsers(newUsers);
        } catch (err) {
            console.error('Follow toggle failed', err);
        }
    };

    if (!isOpen && !inline) return null;

    const modalContent = (
        <div className={asDropdown ? "follow-dropdown" : "follow-modal"} onClick={e => e.stopPropagation()}>
            <div className="follow-modal-header">
                <h2>{title}</h2>
                <button className="icon-btn" onClick={onClose}><HiOutlineXMark /></button>
            </div>

            <div className="follow-modal-body">
                {loading ? (
                    <div className="follow-loading">
                        <div className="spinner" />
                    </div>
                ) : users.length === 0 ? (
                    <div className="follow-empty">
                        <p>No {type} found.</p>
                    </div>
                ) : (
                    <div className="follow-list">
                        {users.map((u, index) => (
                            <div key={u.id} className="follow-user-item-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <Link
                                    to={u.profile?.handle ? `/profile/${u.profile.handle}` : '#'}
                                    className="follow-user-item"
                                    onClick={(e) => {
                                        if (!u.profile?.handle) e.preventDefault();
                                        onClose();
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit', flex: 1, cursor: u.profile?.handle ? 'pointer' : 'default' }}
                                >
                                    <div className="follow-avatar">
                                        {u.profile?.avatarUrl ? (
                                            <img src={u.profile.avatarUrl} alt={u.profile?.displayName || 'Traveler'} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <HiOutlineUser />
                                            </div>
                                        )}
                                    </div>
                                    <div className="follow-info">
                                        <div className="follow-name" style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.profile?.displayName || 'Onboarding User'}</div>
                                        {u.profile?.handle && (
                                            <div className="follow-handle" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>@{u.profile.handle}</div>
                                        )}
                                    </div>
                                </Link>

                                <button
                                    onClick={(e) => handleFollowToggle(e, u.id, index)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: 'var(--radius-pill)',
                                        fontSize: 'var(--text-xs)',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        border: u.isFollowingLocally ? '1px solid var(--border-primary)' : 'none',
                                        background: u.isFollowingLocally ? 'transparent' : 'var(--color-primary-light)',
                                        color: u.isFollowingLocally ? 'var(--text-primary)' : 'white'
                                    }}
                                >
                                    {u.isFollowingLocally ? 'Unfollow' : 'Follow Back'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    if (inline) {
        return (
            <div className="follow-list-inline">
                {users.length === 0 && !loading ? (
                    <div className="follow-empty">
                        <p>No {type} found.</p>
                    </div>
                ) : (
                    <div className="follow-list">
                        {users.map((u, index) => (
                            <div key={u.id} className="follow-user-item-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <Link
                                    to={u.profile?.handle ? `/profile/${u.profile.handle}` : '#'}
                                    className="follow-user-item"
                                    onClick={() => !inline && onClose()}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit', flex: 1, cursor: u.profile?.handle ? 'pointer' : 'default' }}
                                >
                                    <div className="follow-avatar">
                                        {u.profile?.avatarUrl ? (
                                            <img src={u.profile.avatarUrl} alt={u.profile?.displayName || 'Traveler'} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <HiOutlineUser />
                                            </div>
                                        )}
                                    </div>
                                    <div className="follow-info">
                                        <div className="follow-name" style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.profile?.displayName || 'Onboarding User'}</div>
                                        {u.profile?.handle && (
                                            <div className="follow-handle" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>@{u.profile.handle}</div>
                                        )}
                                    </div>
                                </Link>

                                <button
                                    onClick={(e) => handleFollowToggle(e, u.id, index)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: 'var(--radius-pill)',
                                        fontSize: 'var(--text-xs)',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        border: u.isFollowingLocally ? '1px solid var(--border-primary)' : 'none',
                                        background: u.isFollowingLocally ? 'transparent' : 'var(--color-primary-light)',
                                        color: u.isFollowingLocally ? 'var(--text-primary)' : 'white'
                                    }}
                                >
                                    {u.isFollowingLocally ? 'Unfollow' : 'Follow Back'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {loading && (
                    <div className="follow-loading">
                        <div className="spinner" />
                    </div>
                )}
            </div>
        );
    }

    if (asDropdown) {
        return (
            <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={onClose} />
                {modalContent}
            </>
        );
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            {modalContent}
        </div>
    );
}
