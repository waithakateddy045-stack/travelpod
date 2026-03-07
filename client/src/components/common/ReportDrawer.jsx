import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { HiOutlineXMark, HiOutlineFlag, HiOutlineChatBubbleLeftEllipsis, HiOutlineUser, HiOutlinePlayCircle } from 'react-icons/hi2';
import api from '../../services/api';

const REPORT_REASONS = [
    { id: 'SPAM', label: 'Spam or commercial advertising', description: 'Misleading links, scams, or unwanted promotion' },
    { id: 'INAPPROPRIATE', label: 'Inappropriate content', description: 'Violence, sexually explicit, or graphic content' },
    { id: 'HARASSMENT', label: 'Harassment or bullying', description: 'Targeted hate speech or personal attacks' },
    { id: 'MISLEADING', label: 'Misinformation', description: 'Fake news, health misinformation, or false claims' },
    { id: 'OTHER', label: 'Other', description: 'Something else that violates community guidelines' },
];

export default function ReportDrawer({ isOpen, onClose, entityId, entityType, title = 'Content', preview }) {
    const [reason, setReason] = useState('');
    const [detail, setDetail] = useState('');
    const [loading, setLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            document.body.style.overflow = 'unset';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason) { toast.error('Please select a reason'); return; }
        setLoading(true);
        try {
            await api.post('/reports', { entityId, entityType, reason, detail });
            toast.success('Report submitted to moderation.');
            onClose();
        } catch (err) {
            toast.error('Submission failed. Try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isVisible && !isOpen) return null;

    return (
        <div className={`report-drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
            <div className={`report-drawer ${isOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
                {/* Drawer Header */}
                <div className="drawer-header">
                    <div className="drawer-title-area">
                        <div className="moderation-icon">
                            <HiOutlineChatBubbleLeftEllipsis />
                        </div>
                        <div>
                            <h3>Moderation Support</h3>
                            <p>Reporting {title}</p>
                        </div>
                    </div>
                    <button className="drawer-close" onClick={onClose}>
                        <HiOutlineXMark />
                    </button>
                </div>

                {/* Content Preview */}
                {preview && (
                    <div className="content-preview-card">
                        <div className="preview-media">
                            {preview.type === 'video' ? (
                                <img src={preview.url} alt="Preview" />
                            ) : (
                                <div className="preview-placeholder"><HiOutlineUser /></div>
                            )}
                        </div>
                        <div className="preview-info">
                            <span className="preview-label">Reporting {entityType.toLowerCase()}</span>
                            <span className="preview-id">ID: {entityId.substring(0, 8)}...</span>
                        </div>
                    </div>
                )}

                <div className="drawer-body">
                    <p className="instruction-text">
                        Hi, we're here to help. Why are you reporting this {entityType.toLowerCase()}?
                    </p>

                    <div className="reason-list">
                        {REPORT_REASONS.map(r => (
                            <button
                                key={r.id}
                                className={`reason-item ${reason === r.id ? 'active' : ''}`}
                                onClick={() => setReason(r.id)}
                            >
                                <div className="reason-radio"><div className="radio-inner" /></div>
                                <div className="reason-text">
                                    <span className="reason-label">{r.label}</span>
                                    <p className="reason-desc">{r.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="detail-area">
                        <label>Additional Context (Optional)</label>
                        <textarea
                            placeholder="Type a message to the moderation team..."
                            value={detail}
                            onChange={e => setDetail(e.target.value)}
                            rows={4}
                        />
                    </div>
                </div>

                <div className="drawer-footer">
                    <button
                        className="btn-submit-report"
                        disabled={loading || !reason}
                        onClick={handleSubmit}
                    >
                        {loading ? 'Sending...' : 'Send Report to Admin'}
                    </button>
                    <p className="footer-note">
                        Your report is anonymous. We'll review this within 24 hours.
                    </p>
                </div>
            </div>

            <style>{`
                .report-drawer-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0);
                    z-index: 1000; transition: background 0.3s ease;
                    pointer-events: none;
                }
                .report-drawer-overlay.open {
                    background: rgba(0,0,0,0.6);
                    pointer-events: auto;
                    backdrop-filter: blur(4px);
                }
                .report-drawer {
                    position: fixed; top: 0; right: -420px; bottom: 0;
                    width: 400px; max-width: 90%;
                    background: #111; border-left: 1px solid #333;
                    box-shadow: -10px 0 30px rgba(0,0,0,0.5);
                    transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex; flexDirection: column;
                    padding: 0;
                }
                .report-drawer.open { right: 0; }
                
                .drawer-header {
                    padding: 24px; border-bottom: 1px solid #222;
                    display: flex; justify-content: space-between; align-items: center;
                }
                .drawer-title-area { display: flex; gap: 16px; align-items: center; }
                .moderation-icon {
                    width: 44px; height: 44px; border-radius: 12px;
                    background: rgba(108, 99, 255, 0.1); color: #6c63ff;
                    display: flex; alignItems: center; justifyContent: center;
                    fontSize: 1.4rem;
                }
                .drawer-title-area h3 { margin: 0; font-size: 1.1rem; color: #fff; }
                .drawer-title-area p { margin: 0; font-size: 0.8rem; color: #777; }
                .drawer-close { background: none; border: none; color: #555; font-size: 1.5rem; cursor: pointer; }
                
                .content-preview-card {
                    margin: 20px 24px 0; padding: 12px;
                    background: #1a1a1a; border-radius: 16px; border: 1px solid #333;
                    display: flex; gap: 12px; align-items: center;
                }
                .preview-media { width: 48px; height: 48px; border-radius: 8px; overflow: hidden; background: #222; flex-shrink: 0; }
                .preview-media img { width: 100%; height: 100%; object-fit: cover; }
                .preview-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #444; }
                .preview-info { display: flex; flexDirection: column; gap: 2px; }
                .preview-label { font-size: 0.75rem; color: #777; text-transform: uppercase; letter-spacing: 0.05em; }
                .preview-id { font-size: 0.85rem; color: #fff; font-family: monospace; }
                
                .drawer-body { flex: 1; overflow-y: auto; padding: 24px; }
                .instruction-text { font-size: 0.95rem; color: #eee; margin-bottom: 24px; line-height: 1.5; }
                
                .reason-list { display: flex; flexDirection: column; gap: 12px; }
                .reason-item {
                    background: #1a1a1a; border: 1px solid #333; borderRadius: 16px;
                    padding: 16px; text-align: left; cursor: pointer;
                    display: flex; gap: 16px; transition: all 0.2s ease; width: 100%;
                }
                .reason-item:hover { border-color: #444; background: #222; }
                .reason-item.active { border-color: #6c63ff; background: rgba(108, 99, 255, 0.05); }
                
                .reason-radio {
                    width: 20px; height: 20px; border-radius: 50%; border: 2px solid #444;
                    flex-shrink: 0; marginTop: 2px; display: flex; alignItems: center; justifyContent: center;
                }
                .reason-item.active .reason-radio { border-color: #6c63ff; }
                .radio-inner { width: 10px; height: 10px; border-radius: 50%; background: transparent; transform: scale(0.5); transition: all 0.2s; }
                .reason-item.active .radio-inner { background: #6c63ff; transform: scale(1); }
                
                .reason-text { display: flex; flexDirection: column; gap: 4px; }
                .reason-label { font-size: 0.95rem; font-weight: 600; color: #fff; }
                .reason-desc { font-size: 0.8rem; color: #777; margin: 0; }
                
                .detail-area { marginTop: 32px; }
                .detail-area label { display: block; margin-bottom: 12px; font-size: 0.9rem; color: #999; font-weight: 500; }
                .detail-area textarea {
                    width: 100%; background: #1a1a1a; border: 1px solid #333; borderRadius: 12px;
                    padding: 16px; color: #fff; font-size: 0.9rem; resize: none;
                    transition: border-color 0.2s;
                }
                .detail-area textarea:focus { border-color: #6c63ff; outline: none; }
                
                .drawer-footer { padding: 24px; border-top: 1px solid #222; background: #111; }
                .btn-submit-report {
                    width: 100%; padding: 16px; border-radius: 12px;
                    background: #6c63ff; color: #fff; font-weight: 700; border: none;
                    cursor: pointer; font-size: 1rem; transition: transform 0.2s, opacity 0.2s;
                }
                .btn-submit-report:hover { transform: translateY(-2px); opacity: 0.9; }
                .btn-submit-report:disabled { background: #333; cursor: not-allowed; transform: none; }
                .footer-note { text-align: center; font-size: 0.75rem; color: #555; margin-top: 16px; }
            `}</style>
        </div>
    );
}
