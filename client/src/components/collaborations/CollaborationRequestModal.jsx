import { useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { HiOutlineXMark, HiOutlineUserGroup } from 'react-icons/hi2';
import './CollaborationRequestModal.css';

export default function CollaborationRequestModal({ receiverId, receiverName, postId, onClose }) {
    const [proposal, setProposal] = useState('');
    const [proposedDates, setProposedDates] = useState('');
    const [compensationType, setCompensationType] = useState('EXPOSURE');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!proposal.trim()) {
            toast.error('Please enter a proposal message');
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/collaborations', {
                receiverId,
                postId,
                proposal: proposal.trim(),
                proposedDates: proposedDates || null,
                compensationType
            });
            
            toast.success(`Collaboration request sent to ${receiverName}!`);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send request');
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="collab-modal">
                <div className="modal-header">
                    <h2><HiOutlineUserGroup /> Collaborate with {receiverName}</h2>
                    <button className="modal-close" onClick={onClose}><HiOutlineXMark /></button>
                </div>

                <form className="collab-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Your Proposal *</label>
                        <textarea 
                            rows="4" 
                            placeholder="Introduce yourself and share your idea for collaborating..."
                            value={proposal}
                            onChange={e => setProposal(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Proposed Dates (Optional)</label>
                        <input 
                            type="text" 
                            placeholder="e.g. Next month, Nov 15-20"
                            value={proposedDates}
                            onChange={e => setProposedDates(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label>Compensation / Value Exchange</label>
                        <select value={compensationType} onChange={e => setCompensationType(e.target.value)}>
                            <option value="EXPOSURE">Collab / Exposure only</option>
                            <option value="FREE_STAY">Free Stay / Experience</option>
                            <option value="COMMISSION">Commission / Affiliate</option>
                            <option value="PAID">Paid / Sponsored</option>
                            <option value="OTHER">Other / Negotiable</option>
                        </select>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={submitting}>
                            {submitting ? 'Sending...' : 'Send Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
