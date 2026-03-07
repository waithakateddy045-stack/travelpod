import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { HiOutlineXMark, HiOutlineFlag } from 'react-icons/hi2';
import api from '../../services/api';

const REPORT_REASONS = [
    'Spam or commercial advertising',
    'Sexually explicit content',
    'Hate speech or discrimination',
    'Violence or dangerous behaviour',
    'Misinformation or false claims',
    'Impersonation',
    'Harassment or bullying',
    'Other',
];

export default function ReportModal({ entityId, entityType, title = 'Post', onClose }) {
    const [reason, setReason] = useState('');
    const [detail, setDetail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason) { toast.error('Please select a reason'); return; }
        setLoading(true);
        try {
            // Map the detailed reason to a generic category for backend enum compatibility
            const mappedReason = reason.includes('Spam') ? 'SPAM' :
                reason.includes('explicit') || reason.includes('Violence') ? 'INAPPROPRIATE' :
                    reason.includes('Harassment') ? 'HARASSMENT' :
                        reason.includes('Misinformation') ? 'MISLEADING' : 'SPAM';

            await api.post('/reports', { entityId, entityType, reason: mappedReason, detail });
            toast.success('Report submitted. Thank you for keeping Travelpod safe.');
            onClose();
        } catch {
            toast.error('Failed to submit report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 'var(--z-modal)', backdropFilter: 'blur(4px)',
        }}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%',
                maxWidth: 440, animation: 'scaleIn 0.2s ease-out',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                        <HiOutlineFlag style={{ color: 'var(--color-accent)' }} /> Report {title}
                    </div>
                    <button onClick={onClose} style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}>
                        <HiOutlineXMark />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: '1rem' }}>
                        Why are you reporting this {title.toLowerCase()}? We review all reports and take action on content that violates our community guidelines.
                    </p>

                    {/* Reason list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        {REPORT_REASONS.map(r => (
                            <label key={r} style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.75rem', borderRadius: 'var(--radius-md)',
                                border: `1px solid ${reason === r ? 'var(--color-primary)' : 'var(--border-primary)'}`,
                                background: reason === r ? 'rgba(108,99,255,0.08)' : 'var(--bg-tertiary)',
                                cursor: 'pointer', transition: 'all 0.15s ease', fontSize: 'var(--text-sm)',
                            }}>
                                <input
                                    type="radio"
                                    name="reason"
                                    value={r}
                                    checked={reason === r}
                                    onChange={() => setReason(r)}
                                    style={{ display: 'none' }}
                                />
                                <div style={{
                                    width: 16, height: 16, borderRadius: '50%',
                                    border: `2px solid ${reason === r ? 'var(--color-primary)' : 'var(--border-primary)'}`,
                                    background: reason === r ? 'var(--color-primary)' : 'transparent',
                                    flexShrink: 0, transition: 'all 0.15s',
                                }} />
                                {r}
                            </label>
                        ))}
                    </div>

                    {/* Optional detail */}
                    <textarea
                        placeholder="Additional details (optional)"
                        value={detail}
                        onChange={e => setDetail(e.target.value)}
                        rows={3}
                        style={{ resize: 'none', marginBottom: '1rem', fontSize: 'var(--text-sm)' }}
                    />

                    <button
                        type="submit"
                        disabled={loading || !reason}
                        style={{
                            width: '100%', padding: '10px 0', borderRadius: 'var(--radius-full)',
                            background: 'var(--color-accent)', color: 'white', fontWeight: 600,
                            opacity: loading || !reason ? 0.5 : 1, cursor: loading || !reason ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? 'Submitting…' : 'Submit Report'}
                    </button>
                </form>
            </div>
        </div>
    );
}
