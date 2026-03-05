import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    HiOutlineArrowLeft, HiOutlineBell, HiOutlineUser,
    HiOutlineChatBubbleOvalLeft, HiOutlineHeart, HiOutlineCheckCircle, HiCheckCircle
} from 'react-icons/hi2';
import api from '../../services/api';
import './NotificationsPage.css';

export default function NotificationsPage() {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    const loadNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/notifications');
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
        } catch {
            toast.error('Failed to load notifications');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadNotifications(); }, [loadNotifications]);

    const handleMarkAllRead = async () => {
        try {
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
            setUnreadCount(0);
        } catch {
            toast.error('Failed to mark all as read');
        }
    };

    const handleNotificationClick = async (notif) => {
        if (!notif.readAt) {
            try {
                await api.put(`/notifications/${notif.id}/read`);
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch { }
        }

        // Routing logic based on type and related entities
        if (notif.type === 'new_follower' && notif.relatedEntityType === 'user') {
            navigate(`/profile/${notif.relatedEntityId}`); // NOTE: Need handle, not ID, but we only have ID in schema. Might just go to generic profile or the user's own followers list. For now, no route if we don't have handle.
        } else if (notif.type === 'new_enquiry') {
            navigate('/enquiries');
        } else if (notif.type === 'welcome_profile_setup') {
            navigate('/settings');
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'new_follower': return <HiOutlineUser className="notif-icon-user" />;
            case 'post_liked': return <HiOutlineHeart className="notif-icon-like" />;
            case 'post_commented': return <HiOutlineChatBubbleOvalLeft className="notif-icon-comment" />;
            case 'welcome_profile_setup': return <HiOutlineCheckCircle className="notif-icon-welcome" />;
            case 'new_enquiry': return <div className="notif-icon-enquiry">✉️</div>;
            default: return <HiOutlineBell />;
        }
    };

    return (
        <div className="notifications-page">
            <nav className="notifications-nav">
                <button className="notifications-back" onClick={() => navigate(-1)}>
                    <HiOutlineArrowLeft />
                </button>
                <span className="notifications-title">Notifications</span>
                {unreadCount > 0 && (
                    <button className="notifications-read-all" onClick={handleMarkAllRead}>
                        <HiCheckCircle /> Mark All Read
                    </button>
                )}
            </nav>

            <div className="notifications-list">
                {loading ? (
                    <div className="notifications-loading">
                        <div className="notif-spinner" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="notifications-empty">
                        <HiOutlineBell className="empty-bell" />
                        <h3>You're all caught up!</h3>
                        <p>No new notifications right now.</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <div
                            key={notif.id}
                            className={`notification-item ${!notif.readAt ? 'unread' : ''}`}
                            onClick={() => handleNotificationClick(notif)}
                        >
                            <div className="notif-icon-wrapper">
                                {getIcon(notif.type)}
                            </div>
                            <div className="notif-content">
                                <h4 className="notif-title">{notif.title}</h4>
                                {notif.body && <p className="notif-body">{notif.body}</p>}
                                <span className="notif-time">{new Date(notif.createdAt).toLocaleDateString()}</span>
                            </div>
                            {!notif.readAt && <div className="notif-unread-dot" />}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
