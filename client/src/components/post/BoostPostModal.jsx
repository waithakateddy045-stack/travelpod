import { useState, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AuthContext } from '../../context/AuthContext';
import { HiOutlineX, HiOutlineRocketLaunch } from 'react-icons/hi2';
import './BoostPostModal.css';

const API = import.meta.env.VITE_API_URL || '';

export default function BoostPostModal({ postId, onClose }) {
    const { token } = useContext(AuthContext);
    const [duration, setDuration] = useState(1);
    const [targetRegion, setTargetRegion] = useState('');
    const [tier, setTier] = useState('BRONZE');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post(`${API}/api/featured/boost`, {
                postId,
                duration,
                targetRegion: targetRegion || null,
                tier
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            toast.success('Boost request submitted! Awaiting admin approval.');
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to submit boost request');
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="boost-modal">
                <div className="modal-header">
                    <h2><HiOutlineRocketLaunch /> Boost Post</h2>
                    <button className="modal-close" onClick={onClose}><HiOutlineX /></button>
                </div>

                <form className="boost-form" onSubmit={handleSubmit}>
                    <p className="boost-subtitle">Promote your content to reach more travelers on the feed.</p>

                    <div className="form-group">
                        <label>Duration (days)</label>
                        <select value={duration} onChange={e => setDuration(Number(e.target.value))}>
                            <option value={1}>1 Day</option>
                            <option value={3}>3 Days</option>
                            <option value={7}>1 Week</option>
                            <option value={14}>2 Weeks</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Target Region (Optional)</label>
                        <input 
                            type="text" 
                            placeholder="e.g. Kenya, East Africa, Global" 
                            value={targetRegion}
                            onChange={e => setTargetRegion(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label>Boost Tier</label>
                        <div className="tier-selector">
                            {['BRONZE', 'SILVER', 'GOLD'].map(t => (
                                <button 
                                    key={t}
                                    type="button"
                                    className={`tier-btn ${tier === t ? 'active' : ''} tier-${t.toLowerCase()}`}
                                    onClick={() => setTier(t)}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={submitting}>
                            {submitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
