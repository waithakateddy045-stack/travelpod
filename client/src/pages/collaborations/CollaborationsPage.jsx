import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import useFeatureFlag from '../../hooks/useFeatureFlag';
import { HiOutlineLockClosed, HiOutlineCheck, HiOutlineX, HiOutlineClock, HiOutlineUserGroup } from 'react-icons/hi';
import './CollaborationsPage.css';

const API = import.meta.env.VITE_API_URL || '';

const COMPENSATION_LABELS = {
    PAID: '💰 Paid',
    FREE_STAY: '🏨 Free Stay',
    COMMISSION: '📊 Commission',
    EXPOSURE: '📸 Exposure',
    OTHER: '📌 Other',
};

const STATUS_COLORS = {
    PENDING: '#f59e0b',
    ACCEPTED: '#10b981',
    DECLINED: '#ef4444',
    COMPLETED: '#6366f1',
    CANCELLED: '#94a3b8',
};

export default function CollaborationsPage() {
    const { token } = useContext(AuthContext);
    const { enabled: collabEnabled } = useFeatureFlag('collaborations');
    const [tab, setTab] = useState('received');
    const [collabs, setCollabs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!collabEnabled || !token) return;
        setLoading(true);
        axios.get(`${API}/api/collaborations?tab=${tab}`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(res => {
            setCollabs(res.data.collaborations || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [collabEnabled, token, tab]);

    const handleAction = async (id, action) => {
        try {
            await axios.patch(`${API}/api/collaborations/${id}/${action}`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setCollabs(collabs.map(c => c.id === id ? { ...c, status: action === 'accept' ? 'ACCEPTED' : 'DECLINED' } : c));
        } catch {}
    };

    if (!collabEnabled) {
        return (
            <div className="collabs-page">
                <div className="collabs-disabled">
                    <HiOutlineLockClosed className="disabled-icon" />
                    <h2>Collaborations Coming Soon</h2>
                    <p>This feature is not yet active. Stay tuned!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="collabs-page">
            <div className="collabs-container">
                <h1><HiOutlineUserGroup /> Collaborations</h1>

                <div className="collabs-tabs">
                    <button className={`collab-tab ${tab === 'received' ? 'active' : ''}`} onClick={() => setTab('received')}>Received</button>
                    <button className={`collab-tab ${tab === 'sent' ? 'active' : ''}`} onClick={() => setTab('sent')}>Sent</button>
                </div>

                {loading ? (
                    <div className="collabs-loading"><div className="collabs-spinner" /></div>
                ) : collabs.length === 0 ? (
                    <div className="collabs-empty">
                        <p>No {tab} collaborations yet</p>
                    </div>
                ) : (
                    <div className="collabs-list">
                        {collabs.map(c => {
                            const other = tab === 'received' ? c.initiator : c.receiver;
                            const profile = other?.profile;
                            return (
                                <div key={c.id} className="collab-card">
                                    <div className="collab-avatar">
                                        {profile?.avatarUrl ? (
                                            <img src={profile.avatarUrl} alt="" />
                                        ) : (
                                            <span>👤</span>
                                        )}
                                    </div>
                                    <div className="collab-info">
                                        <div className="collab-header">
                                            <span className="collab-name">{profile?.displayName || 'User'}</span>
                                            <span className="collab-handle">@{profile?.handle}</span>
                                            {profile?.businessProfile?.verificationStatus === 'APPROVED' && (
                                                <span className="collab-verified">✓</span>
                                            )}
                                        </div>
                                        <p className="collab-proposal">{c.proposal}</p>
                                        <div className="collab-meta">
                                            <span className="collab-compensation">{COMPENSATION_LABELS[c.compensationType] || c.compensationType}</span>
                                            {c.proposedDates && <span><HiOutlineClock /> {c.proposedDates}</span>}
                                            <span className="collab-status" style={{ color: STATUS_COLORS[c.status] }}>
                                                {c.status}
                                            </span>
                                        </div>
                                    </div>
                                    {tab === 'received' && c.status === 'PENDING' && (
                                        <div className="collab-actions">
                                            <button className="collab-accept" onClick={() => handleAction(c.id, 'accept')}>
                                                <HiOutlineCheck /> Accept
                                            </button>
                                            <button className="collab-decline" onClick={() => handleAction(c.id, 'decline')}>
                                                <HiOutlineX /> Decline
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
