import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function GlobalNotificationsWatcher() {
    const { notificationCount, messageCount, user } = useAuth();
    const prevNotifCount = useRef(notificationCount);
    const prevMsgCount = useRef(messageCount);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return;

        // Notification alert
        if (notificationCount > prevNotifCount.current) {
            toast('New notification!', {
                icon: '🔔',
                onClick: () => navigate('/notifications'),
                style: { cursor: 'pointer' }
            });
        }
        prevNotifCount.current = notificationCount;

        // Message alert
        if (messageCount > prevMsgCount.current) {
            toast('New message received!', {
                icon: '✉️',
                onClick: () => navigate('/messages'),
                style: { cursor: 'pointer' }
            });
        }
        prevMsgCount.current = messageCount;
    }, [notificationCount, messageCount, user, navigate]);

    return null;
}
