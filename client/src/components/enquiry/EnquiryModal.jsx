import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { HiOutlineXMark, HiOutlineCalendar, HiOutlineUsers, HiOutlineBanknotes, HiOutlineChatBubbleBottomCenterText } from 'react-icons/hi2';
import api from '../../services/api';
import './EnquiryModal.css';

export default function EnquiryModal({ businessId, businessName, isOpen, onClose }) {
    const [loading, setLoading] = useState(false);
    const [travelDates, setTravelDates] = useState('');
    const [groupSize, setGroupSize] = useState('2');
    const [budgetRange, setBudgetRange] = useState('$1000 - $3000');
    const [requirements, setRequirements] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await api.post('/enquiries', {
                businessId,
                travelDates,
                groupSize,
                budgetRange,
                requirements,
                message
            });
            toast.success('Enquiry sent! The business will reach out soon.');
            onClose();
            // Reset fields
            setTravelDates('');
            setMessage('');
            setRequirements('');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send enquiry');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="enquiry-modal-overlay" onClick={onClose}>
            <div className="enquiry-modal-content animate-scaleIn" onClick={e => e.stopPropagation()}>
                <div className="enquiry-modal-header">
                    <div className="enquiry-header-title">
                        <h2>Enquire with {businessName}</h2>
                        <p>Plan your perfect getaway</p>
                    </div>
                    <button className="enquiry-modal-close" onClick={onClose}>
                        <HiOutlineXMark />
                    </button>
                </div>

                <form className="enquiry-form" onSubmit={handleSubmit}>
                    <div className="form-row two-col">
                        <div className="form-group">
                            <label><HiOutlineCalendar /> Travel Dates</label>
                            <input
                                type="text"
                                placeholder="e.g. Dec 15 - Dec 28"
                                value={travelDates}
                                onChange={e => setTravelDates(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label><HiOutlineUsers /> Group Size</label>
                            <input
                                type="number"
                                min="1"
                                value={groupSize}
                                onChange={e => setGroupSize(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label><HiOutlineBanknotes /> Budget Range (Total)</label>
                        <select value={budgetRange} onChange={e => setBudgetRange(e.target.value)}>
                            <option>Flexible</option>
                            <option>Under $1000</option>
                            <option>$1000 - $3000</option>
                            <option>$3000 - $5000</option>
                            <option>$5000 - $10000</option>
                            <option>$10000+</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Special Requirements</label>
                        <input
                            type="text"
                            placeholder="Dietary, accessibility, celebrations..."
                            value={requirements}
                            onChange={e => setRequirements(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label><HiOutlineChatBubbleBottomCenterText /> Your Message</label>
                        <textarea
                            rows={3}
                            placeholder="Tell them more about what you're looking for..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            required
                        />
                    </div>

                    <div className="enquiry-form-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-submit" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Enquiry'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
