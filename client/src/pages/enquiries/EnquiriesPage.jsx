import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlineBriefcase, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlinePaperAirplane } from 'react-icons/hi2';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './EnquiriesPage.css';

const BUSINESS_TYPES = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];

export default function EnquiriesPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [enquiries, setEnquiries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyContent, setReplyContent] = useState('');

    const isBusiness = BUSINESS_TYPES.includes(user?.accountType);

    const loadEnquiries = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/enquiries');
            setEnquiries(data.enquiries || []);
        } catch {
            toast.error('Failed to load enquiries');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadEnquiries(); }, [loadEnquiries]);

    const handleReply = async (id) => {
        if (!replyContent.trim()) return;
        try {
            await api.post(`/enquiries/${id}/respond`, { content: replyContent });
            toast.success('Response sent! A direct message thread was started.');
            setReplyingTo(null);
            setReplyContent('');
            loadEnquiries();
            // Could redirect to /messages here, but letting them stay is fine
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send response');
        }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await api.put(`/enquiries/${id}/status`, { status });
            toast.success(`Enquiry marked as ${status.toLowerCase()}`);
            loadEnquiries();
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    const getStatusChip = (status) => {
        switch (status) {
            case 'PENDING': return <span className="enquiry-status pending">Pending</span>;
            case 'REPLIED': return <span className="enquiry-status replied"><HiOutlineCheckCircle /> Replied</span>;
            case 'DECLINED': return <span className="enquiry-status declined"><HiOutlineXCircle /> Declined</span>;
            case 'CLOSED': return <span className="enquiry-status closed">Closed</span>;
            default: return null;
        }
    };

    return (
        <div className="enquiries-page">
            <nav className="enquiries-nav">
                <button className="enquiries-back" onClick={() => navigate('/feed')}>
                    <HiOutlineArrowLeft />
                </button>
                <div className="enquiries-header-info">
                    <h1 className="enquiries-title">{isBusiness ? 'Booking Requests' : 'My Enquiries'}</h1>
                    <p className="enquiries-subtitle">{isBusiness ? 'Manage requests from travelers' : 'Track your trip requests'}</p>
                </div>
            </nav>

            <div className="enquiries-content">
                {loading ? (
                    <div className="enquiries-loading"><div className="spin-loader" /></div>
                ) : enquiries.length === 0 ? (
                    <div className="enquiries-empty">
                        <HiOutlineBriefcase className="empty-icon" />
                        <h2>No enquiries yet</h2>
                        <p>{isBusiness ? 'When travelers request booking packages, they will appear here.' : "You haven't sent any booking requests yet."}</p>
                        {!isBusiness && (
                            <button className="btn-primary" onClick={() => navigate('/explore')}>Find Destinations</button>
                        )}
                    </div>
                ) : (
                    <div className="enquiries-list">
                        {enquiries.map(enq => {
                            const otherUser = isBusiness ? enq.traveler : enq.business;
                            const profile = otherUser?.profile;

                            return (
                                <div key={enq.id} className="enquiry-card">
                                    <div className="enquiry-header">
                                        <div className="enquiry-user">
                                            <div className="enq-avatar">
                                                {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <HiOutlineBriefcase />}
                                            </div>
                                            <div>
                                                <Link to={`/profile/${profile?.handle}`} className="enq-name">{profile?.displayName || 'Unknown'}</Link>
                                                <p className="enq-handle">@{profile?.handle}</p>
                                            </div>
                                        </div>
                                        {getStatusChip(enq.status)}
                                    </div>

                                    <div className="enquiry-details">
                                        <div className="enq-detail-row">
                                            <span className="enq-label">Dates:</span>
                                            <span className="enq-value">{enq.travelDates}</span>
                                        </div>
                                        <div className="enq-detail-row">
                                            <span className="enq-label">Group Size:</span>
                                            <span className="enq-value">{enq.groupSize} people</span>
                                        </div>
                                        <div className="enq-detail-row">
                                            <span className="enq-label">Budget:</span>
                                            <span className="enq-value">{enq.budgetRange}</span>
                                        </div>
                                        {enq.requirements && (
                                            <div className="enq-detail-row">
                                                <span className="enq-label">Special Req:</span>
                                                <span className="enq-value">{enq.requirements}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="enquiry-message-box">
                                        <p className="enq-msg-title">Initial Message</p>
                                        <p className="enq-msg-content">"{enq.message}"</p>
                                        <span className="enq-date">{new Date(enq.submittedAt).toLocaleDateString()}</span>
                                    </div>

                                    {enq.response && (
                                        <div className="enquiry-response-box">
                                            <p className="enq-msg-title">Response</p>
                                            <p className="enq-msg-content">{enq.response.content}</p>
                                            <span className="enq-date">{new Date(enq.response.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    {enq.status === 'PENDING' && isBusiness && replyingTo !== enq.id && (
                                        <div className="enquiry-actions">
                                            <button className="btn-reply" onClick={() => setReplyingTo(enq.id)}>
                                                Reply & Start Chat
                                            </button>
                                            <button className="btn-decline" onClick={() => handleUpdateStatus(enq.id, 'DECLINED')}>
                                                Decline
                                            </button>
                                        </div>
                                    )}

                                    {/* Reply Form */}
                                    {replyingTo === enq.id && (
                                        <div className="enquiry-reply-form">
                                            <textarea
                                                placeholder="Write your response... This will also create a direct message thread with the traveler."
                                                value={replyContent}
                                                onChange={(e) => setReplyContent(e.target.value)}
                                                rows={4}
                                            />
                                            <div className="reply-form-actions">
                                                <button className="btn-cancel" onClick={() => { setReplyingTo(null); setReplyContent(''); }}>Cancel</button>
                                                <button className="btn-send" onClick={() => handleReply(enq.id)}>
                                                    <HiOutlinePaperAirplane /> Send Response
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {enq.status !== 'CLOSED' && enq.status !== 'DECLINED' && !isBusiness && (
                                        <div className="enquiry-actions-traveler">
                                            <button className="btn-cancel" onClick={() => handleUpdateStatus(enq.id, 'CLOSED')}>
                                                Close Request
                                            </button>
                                            {enq.status === 'REPLIED' && (
                                                <button className="btn-reply" onClick={() => navigate('/messages')}>
                                                    Go to Messages
                                                </button>
                                            )}
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
