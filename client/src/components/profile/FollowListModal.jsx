import { useState, useEffect } from 'react';
import { HiOutlineXMark, HiOutlineUser } from 'react-icons/hi2';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import './FollowListModal.css';

export default function FollowListModal({ isOpen, onClose, userId, type, title }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !userId) return;

        const fetchUsers = async () => {
            setLoading(true);
            try {
                const endpoint = type === 'followers'
                    ? `/follow/${userId}/followers`
                    : `/follow/${userId}/following`;
                const { data } = await api.get(endpoint);
                setUsers(type === 'followers' ? data.followers : data.following);
            } catch (error) {
                console.error('Failed to fetch users', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [isOpen, userId, type]);

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="follow-modal" onClick={e => e.stopPropagation()}>
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
                            {users.map(u => (
                                <Link
                                    key={u.id}
                                    to={`/profile/${u.profile.handle}`}
                                    className="follow-user-item"
                                    onClick={onClose}
                                >
                                    <div className="follow-avatar">
                                        {u.profile.avatarUrl ? (
                                            <img src={u.profile.avatarUrl} alt={u.profile.displayName} />
                                        ) : (
                                            <HiOutlineUser />
                                        )}
                                    </div>
                                    <div className="follow-info">
                                        <div className="follow-name">{u.profile.displayName}</div>
                                        <div className="follow-handle">@{u.profile.handle}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
