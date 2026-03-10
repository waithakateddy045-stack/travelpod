import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { HiOutlineXMark, HiOutlineSparkles, HiOutlineCalendar, HiOutlineCurrencyDollar } from 'react-icons/hi2';
import api from '../../services/api';
import './CollaborationRequestModal.css';

export default function CollaborationRequestModal({ receiverId, receiverName, postId, isOpen, onClose }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        proposal: '',
        contentIdea: '',
        proposedDates: '',
        compensationType: 'PARTNERSHIP' // 'PARTNERSHIP' | 'EXPOSURE' | 'PAID'
    });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await api.post('/collaborations', {
                receiverId,
                postId,
                ...formData
            });
            toast.success('Collaboration request sent! They will see it in their collaborations tab.');
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="collab-modal-overlay" onClick={onClose}>
            <div className="collab-modal-content animate-scaleIn" onClick={e => e.stopPropagation()}>
                <div className="collab-modal-header">
                    <div className="collab-header-main">
                        <HiOutlineSparkles className="header-icon" />
                        <h2>Collaborate with {receiverName}</h2>
                    </div>
                    <button className="collab-modal-close" onClick={onClose}>
                        <HiOutlineXMark />
                    </button>
                </div>

                <form className="collab-form" onSubmit={handleSubmit}>
                    <p className="collab-intro">
                        Propose a partnership or creative collaboration. Be specific about your vision!
                    </p>

                    <div className="form-group">
                        <label>Your Proposal</label>
                        <textarea
                            rows={3}
                            placeholder="What do you have in mind? (e.g. 5x User Generated Content videos for your resort)"
                            value={formData.proposal}
                            onChange={e => setFormData({ ...formData, proposal: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Content Idea / Campaign</label>
                        <textarea
                            rows={3}
                            placeholder="Briefly describe the creative direction..."
                            value={formData.contentIdea}
                            onChange={e => setFormData({ ...formData, contentIdea: e.target.value })}
                        />
                    </div>

                    <div className="form-row two-col">
                        <div className="form-group">
                            <label><HiOutlineCalendar /> Proposed Dates</label>
                            <input
                                type="text"
                                placeholder="e.g. Summer 2026"
                                value={formData.proposedDates}
                                onChange={e => setFormData({ ...formData, proposedDates: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label><HiOutlineCurrencyDollar /> Compensation</label>
                            <select
                                value={formData.compensationType}
                                onChange={e => setFormData({ ...formData, compensationType: e.target.value })}
                            >
                                <option value="PARTNERSHIP">Partnership / Exchange</option>
                                <option value="PAID">Paid Collaboration</option>
                                <option value="EXPOSURE">Exposure Only</option>
                            </select>
                        </div>
                    </div>

                    <div className="collab-form-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>Not Now</button>
                        <button type="submit" className="btn-submit" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Magic Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
