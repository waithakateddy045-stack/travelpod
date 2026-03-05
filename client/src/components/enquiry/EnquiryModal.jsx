import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { HiOutlineXMark } from 'react-icons/hi2';
import api from '../../services/api';
import './EnquiryModal.css';

export default function EnquiryModal({ businessId, businessName, isOpen, onClose }) {
    const [loading, setLoading] = useState(false);
    const [travelDates, setTravelDates] = useState('');
    const [groupSize, setGroupSize] = useState('2');
    const [budgetRange, setBudgetRange] = useState('$1000 - $3000');
    const [requirements, setRequirements] = useState('');
    const [message, setMessage] = useState('');

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
            toast.success('Enquiry sent successfully! The business will reply shortly.');
            onClose();
            // Reset for next time
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
            <div className="enquiry-modal-content" onClick={e => e.stopPropagation()}>
                <div className="enquiry-modal-header">
                    <h2>Enquire with {businessName}</h2>
                    <button className="enquiry-modal-close" onClick={onClose}>
                        <HiOutlineXMark />
                    </button>
                </div>

                <form className="enquiry-form" onSubmit={handleSubmit}>
                    <p className="enquiry-instructions">
                        Send a booking request or ask for more information. Tell them what you are looking for!
                    </p>

                    <div className="form-row two-col">
                        <div className="form-group">
                            <label>Travel Dates</label>
                            <input
                                type="text"
                                placeholder="e.g. Dec 15 - Dec 28"
                                value={travelDates}
                                onChange={e => setTravelDates(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Group Size</label>
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
                        <label>Budget Range (Total)</label>
                        <select value={budgetRange} onChange={e => setBudgetRange(e.target.value)}>
                            <option>Under $1000</option>
                            <option>$1000 - $3000</option>
                            <option>$3000 - $5000</option>
                            <option>$5000 - $10000</option>
                            <option>$10000+</option>
                            <option>Flexible</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Special Requirements (Optional)</label>
                        <input
                            type="text"
                            placeholder="e.g. Dietary needs, accessibility, celebrations..."
                            value={requirements}
                            onChange={e => setRequirements(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label>Message</label>
                        <textarea
                            rows={4}
                            placeholder="Tell the business a bit more about your ideal trip..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            required
                        />
                    </div>

                    <div className="enquiry-form-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Enquiry'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
