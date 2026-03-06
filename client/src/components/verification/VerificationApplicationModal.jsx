import { useState } from 'react';
import { HiOutlineXMark, HiOutlineDocumentCheck, HiOutlineBuildingOffice2, HiOutlineIdentification } from 'react-icons/hi2';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import './VerificationApplicationModal.css';

export default function VerificationApplicationModal({ isOpen, onClose, onApplySuccess }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form state
    const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
    const [operatingAddress, setOperatingAddress] = useState('');
    const [registeredWebsite, setRegisteredWebsite] = useState('');
    const [associationName, setAssociationName] = useState('');
    const [associationMembershipNumber, setAssociationMembershipNumber] = useState('');
    const [businessRegistrationDocument, setBusinessRegistrationDocument] = useState(''); // File URL placeholder
    const [associationDocument, setAssociationDocument] = useState(''); // File URL placeholder

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        // For demonstration, simulating file upload by setting dummy URLs if text is provided
        // In a full implementation, you'd use Cloudinary or S3 multipart uploads here first
        const payload = {
            businessRegistrationNumber,
            operatingAddress,
            registeredWebsite,
            associationName,
            associationMembershipNumber,
            businessRegistrationDocument: 'https://example.com/dummy-reg-doc.pdf', // Mock URL
            associationDocument: associationName ? 'https://example.com/dummy-assoc-doc.pdf' : null
        };

        setLoading(true);
        try {
            await api.post('/verify/business/apply', payload);
            toast.success('Verification application submitted successfully!');
            setStep(3); // Success step
            setTimeout(() => {
                onApplySuccess();
                onClose();
            }, 3000);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to submit application');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="vam-overlay" onClick={onClose}>
            <div className="vam-modal" onClick={e => e.stopPropagation()}>
                <button className="vam-close" onClick={onClose}><HiOutlineXMark /></button>

                {step === 1 && (
                    <div className="vam-step-intro">
                        <div className="vam-icon-large">
                            <HiOutlineDocumentCheck />
                        </div>
                        <h2>Get Your Business Verified</h2>
                        <p>Stand out to travelers and build trust by verifying your official business details. Verified businesses receive a permanent Gold Badge on their profile.</p>

                        <div className="vam-requirements">
                            <h3>What you'll need:</h3>
                            <ul>
                                <li><HiOutlineBuildingOffice2 /> Official Business Registration Number</li>
                                <li><HiOutlineIdentification /> Digital copy of your Registration Certificate</li>
                                <li>🌐 Your registered official website</li>
                                <li>🏛️ (Optional) Travel Association Membership details</li>
                            </ul>
                        </div>

                        <button className="vam-btn vam-btn-primary" onClick={() => setStep(2)}>
                            Start Application
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <form className="vam-form" onSubmit={handleSubmit}>
                        <h2>Business Details</h2>
                        <p className="vam-subtitle">Provide your official registration documents for review.</p>

                        <div className="vam-form-group">
                            <label>Business Registration Number *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. BRN-123456789"
                                value={businessRegistrationNumber}
                                onChange={e => setBusinessRegistrationNumber(e.target.value)}
                            />
                        </div>

                        <div className="vam-form-group">
                            <label>Official Registered Website *</label>
                            <input
                                type="url"
                                required
                                placeholder="https://www.yourbusiness.com"
                                value={registeredWebsite}
                                onChange={e => setRegisteredWebsite(e.target.value)}
                            />
                        </div>

                        <div className="vam-form-group">
                            <label>Primary Operating Address *</label>
                            <textarea
                                required
                                placeholder="Full physical address"
                                rows="2"
                                value={operatingAddress}
                                onChange={e => setOperatingAddress(e.target.value)}
                            />
                        </div>

                        <div className="vam-divider" />

                        <h3>Travel Associations (Optional)</h3>
                        <p className="vam-hint">Are you a member of IATA, ASTA, ABTA, or a local tourism board?</p>

                        <div className="vam-form-group">
                            <label>Association Name</label>
                            <input
                                type="text"
                                placeholder="e.g. IATA"
                                value={associationName}
                                onChange={e => setAssociationName(e.target.value)}
                            />
                        </div>

                        {associationName && (
                            <div className="vam-form-group">
                                <label>Membership/Registration Number</label>
                                <input
                                    type="text"
                                    placeholder="Your association ID"
                                    value={associationMembershipNumber}
                                    onChange={e => setAssociationMembershipNumber(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="vam-form-actions">
                            <button type="button" className="vam-btn vam-btn-secondary" onClick={() => setStep(1)} disabled={loading}>
                                Back
                            </button>
                            <button type="submit" className="vam-btn vam-btn-primary" disabled={loading}>
                                {loading ? 'Submitting...' : 'Submit Application'}
                            </button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <div className="vam-step-success">
                        <div className="vam-icon-large success-icon">✓</div>
                        <h2>Application Received!</h2>
                        <p>Our moderation team will review your business documents. You will receive an email once the review is complete.</p>
                        <p className="vam-redirecting">Closing automatically...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
