import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { HiOutlineSparkles, HiOutlineXMark, HiOutlinePaperAirplane, HiOutlineChatBubbleBottomCenterText, HiOutlineMinus, HiOutlineChevronUp } from 'react-icons/hi2';
import api from '../../services/api';
import './AICopilot.css';
import { useAuth } from '../../context/AuthContext';

export default function AICopilot() {
    const { user } = useAuth();
    const location = useLocation();
    
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const messagesEndRef = useRef(null);
    const sessionId = useRef(`session-${Date.now()}`);

    const isBusiness = user?.profile?.accountType && ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'].includes(user.profile.accountType);

    // Initial greeting based on context
    useEffect(() => {
        if (!isOpen && messages.length === 0) {
            setMessages([{
                role: 'model',
                text: isBusiness 
                    ? `Hi ${user?.profile?.displayName || 'there'}! I'm your Travelpod Copilot. Need help drafting a broadcast or optimizing your profile?`
                    : `Hi ${user?.profile?.displayName || 'there'}! I'm your Travelpod Copilot. Need travel recommendations or help writing a review?`
            }]);
        }
    }, [isOpen, isBusiness, user, messages.length]);

    // Contextual suggestions based on route
    const getSuggestions = () => {
        const path = location.pathname;
        if (path.includes('/upload')) {
            return isBusiness 
                ? ["Help me write a professional broadcast", "Generate engaging captions for a post", "Suggest tags for my hotel"]
                : ["Write a catchy title for my travel video", "Help me review a restaurant", "Suggest popular travel tags"];
        }
        if (path.includes('/feed')) {
            return ["What are the top travel destinations right now?", "Find me luxury resorts", "Suggest a weekend getaway itinerary"];
        }
        if (path.includes('/profile')) {
            return isBusiness
                ? ["How can I improve my business bio?", "What type of content drives engagement?"]
                : ["How do I get the 'Explorer' badge?", "Help me write a fun bio"];
        }
        return ["Suggest a travel destination", "How do I grow my audience?", "Tell me a travel fact"];
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen && !isMinimized) {
            scrollToBottom();
        }
    }, [messages, isOpen, isMinimized]);

    const handleSend = async (text = inputValue) => {
        if (!text.trim() || isLoading) return;

        const userMsg = { role: 'user', text: text.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const { data } = await api.post('/ai/chat', { 
                message: text.trim(),
                sessionId: sessionId.current
            });
            
            setMessages(prev => [...prev, { role: 'model', text: data.reply }]);
        } catch (err) {
            setMessages(prev => [...prev, { 
                role: 'model', 
                text: "I'm having trouble connecting to the network right now. Please try again later.",
                isError: true 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null; // Only show for logged in users

    if (!isOpen) {
        return (
            <button className="copilot-fab" onClick={() => { setIsOpen(true); setIsMinimized(false); }}>
                <HiOutlineSparkles className="fab-icon" />
                <span className="fab-tooltip">Travelpod AI</span>
            </button>
        );
    }

    return (
        <div className={`copilot-window ${isMinimized ? 'minimized' : ''}`}>
            {/* Header */}
            <div className="copilot-header" onClick={() => setIsMinimized(!isMinimized)}>
                <div className="copilot-title">
                    <div className="copilot-avatar">
                        <HiOutlineSparkles />
                    </div>
                    <div>
                        <h3>Travelpod Copilot</h3>
                        <span className="copilot-status">Online</span>
                    </div>
                </div>
                <div className="copilot-controls">
                    <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
                        {isMinimized ? <HiOutlineChevronUp /> : <HiOutlineMinus />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                        <HiOutlineXMark />
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            {!isMinimized && (
                <>
                    <div className="copilot-messages">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`message-wrapper ${msg.role}`}>
                                {msg.role === 'model' && (
                                    <div className="message-avatar model-avatar"><HiOutlineSparkles/></div>
                                )}
                                <div className={`message-bubble ${msg.role} ${msg.isError ? 'error' : ''}`}>
                                    {msg.text}
                                </div>
                                {msg.role === 'user' && (
                                    <img src={user.profile?.avatarUrl || `https://ui-avatars.com/api/?name=${user.profile?.handle}`} alt="" className="message-avatar user-avatar" />
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="message-wrapper model">
                                <div className="message-avatar model-avatar"><HiOutlineSparkles/></div>
                                <div className="message-bubble model typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Suggestions */}
                    {messages.length < 3 && !isLoading && (
                        <div className="copilot-suggestions">
                            {getSuggestions().map((s, i) => (
                                <button key={i} onClick={() => handleSend(s)} className="suggestion-chip">
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="copilot-input-area">
                        <input 
                            type="text" 
                            placeholder="Ask Copilot..." 
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button 
                            className={`send-btn ${inputValue.trim() ? 'active' : ''}`} 
                            onClick={() => handleSend()}
                            disabled={!inputValue.trim() || isLoading}
                        >
                            <HiOutlinePaperAirplane className="send-icon" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
