import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlinePaperAirplane, HiOutlineUser } from 'react-icons/hi2';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './MessagesPage.css';

// Optionally hook into Socket.IO if available globally, but we'll use polling for simplicity if socket isn't exposed yet
// import socket from '../../services/socket';

export default function MessagesPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [conversations, setConversations] = useState([]);
    const [activeConv, setActiveConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [text, setText] = useState('');
    const messagesEndRef = useRef(null);

    const loadConversations = useCallback(async () => {
        try {
            const { data } = await api.get('/messages/conversations');
            setConversations(data.conversations || []);
        } catch {
            toast.error('Failed to load conversations');
        } finally {
            setLoadingConvs(false);
        }
    }, []);

    useEffect(() => { loadConversations(); }, [loadConversations]);

    const loadMessages = useCallback(async (convId) => {
        try {
            setLoadingMsgs(true);
            const { data } = await api.get(`/messages/${convId}`);
            setMessages(data.messages || []);
            // Update unread count locally
            setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
            requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }));
        } catch {
            toast.error('Failed to load messages');
        } finally {
            setLoadingMsgs(false);
        }
    }, []);

    const handleSelectConv = (conv) => {
        setActiveConv(conv);
        loadMessages(conv.id);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!text.trim() || !activeConv) return;
        const bodyContent = text;
        setText('');

        try {
            const { data } = await api.post('/messages', {
                recipientId: activeConv.otherUser.id,
                content: bodyContent
            });
            setMessages(prev => [...prev, data.message]);

            // Update conversation to top with new preview
            setConversations(prev => {
                const updated = prev.map(c => c.id === activeConv.id ? {
                    ...c,
                    lastMessagePreview: bodyContent.substring(0, 50),
                    lastMessageAt: data.message.sentAt
                } : c);
                return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
            });
            requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
        } catch {
            toast.error('Failed to send message');
        }
    };

    // Polling for incoming messages gracefully every 3 seconds if active
    useEffect(() => {
        if (!activeConv) return;
        const interval = setInterval(async () => {
            try {
                const { data } = await api.get(`/messages/${activeConv.id}`);
                // Simple check if new messages arrived
                if (data.messages.length > messages.length) {
                    setMessages(data.messages);
                    requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
                }
            } catch { }
        }, 3000);
        return () => clearInterval(interval);
    }, [activeConv, messages.length]);

    return (
        <div className="messages-page">
            <div className="messages-layout">
                {/* Left Rail: Conversations List */}
                <div className={`conversations-rail ${activeConv ? 'hidden-mobile' : ''}`}>
                    <nav className="messages-nav">
                        <button className="messages-back" onClick={() => navigate('/feed')}>
                            <HiOutlineArrowLeft />
                        </button>
                        <h2>Messages</h2>
                    </nav>

                    <div className="conversations-list">
                        {loadingConvs ? (
                            <div className="msg-spinner-wrap"><div className="spin-loader" /></div>
                        ) : conversations.length === 0 ? (
                            <div className="conv-empty">
                                <p>No messages yet.</p>
                                <button className="btn-primary" onClick={() => navigate('/explore')}>Find users to chat</button>
                            </div>
                        ) : (
                            conversations.map(conv => {
                                const profile = conv.otherUser?.profile;
                                const isUnread = conv.unreadCount > 0;
                                return (
                                    <div
                                        key={conv.id}
                                        className={`conv-item ${activeConv?.id === conv.id ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
                                        onClick={() => handleSelectConv(conv)}
                                    >
                                        <div className="conv-avatar">
                                            {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <HiOutlineUser />}
                                        </div>
                                        <div className="conv-info">
                                            <div className="conv-top-row">
                                                <span className="conv-name">{profile?.displayName || 'Unknown'}</span>
                                                <span className="conv-date">{new Date(conv.lastMessageAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="conv-preview">{conv.lastMessagePreview || 'New chat'}</p>
                                        </div>
                                        {isUnread && <div className="conv-unread-badge">{conv.unreadCount}</div>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Main Area: Active Chat Area */}
                <div className={`active-chat-area ${!activeConv ? 'hidden-mobile' : ''}`}>
                    {!activeConv ? (
                        <div className="no-chat-selected">
                            <HiOutlinePaperAirplane className="empty-chat-icon" />
                            <h3>Your Messages</h3>
                            <p>Select a conversation or start a new one to begin chatting.</p>
                        </div>
                    ) : (
                        <>
                            <div className="chat-header">
                                <button className="chat-back" onClick={() => setActiveConv(null)}><HiOutlineArrowLeft /></button>
                                <div className="chat-header-user">
                                    <div className="chat-avatar">
                                        {activeConv.otherUser?.profile?.avatarUrl ? <img src={activeConv.otherUser.profile.avatarUrl} alt="" /> : <HiOutlineUser />}
                                    </div>
                                    <Link to={`/profile/${activeConv.otherUser?.profile?.handle}`} className="chat-name">
                                        {activeConv.otherUser?.profile?.displayName}
                                    </Link>
                                </div>
                            </div>

                            <div className="chat-messages">
                                {loadingMsgs ? (
                                    <div className="msg-spinner-wrap"><div className="spin-loader" /></div>
                                ) : (
                                    messages.map((msg, i) => {
                                        const isMine = msg.senderId === user.id;
                                        return (
                                            <div key={msg.id || i} className={`chat-bubble-wrapper ${isMine ? 'mine' : 'theirs'}`}>
                                                <div className="chat-bubble">
                                                    {msg.content}
                                                </div>
                                                <span className="chat-time">{new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <form className="chat-input-area" onSubmit={handleSend}>
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                />
                                <button type="submit" className="btn-send-msg" disabled={!text.trim()}>
                                    <HiOutlinePaperAirplane />
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
