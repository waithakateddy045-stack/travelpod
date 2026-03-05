import { useState, useEffect } from 'react';
import { HiOutlineXMark, HiOutlineGlobeAlt, HiOutlineBuildingOffice2, HiOutlineCheckBadge } from 'react-icons/hi2';
import api from '../../services/api';
import './VerificationDetailsModal.css';

export default function VerificationDetailsModal({ userId, businessName, isOpen, onClose }) {
    const [verification, setVerification] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!isOpen || !userId) return;
        setLoading(true);
        setError(false);
        api.get(`/verify/business/${userId}`)
            .then(({ data }) => setVerification(data.verification))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [isOpen, userId]);

    if (!isOpen) return null;

    return (
        <div className="vdm-overlay" onClick={onClose}>
            <div className="vdm-modal" onClick={e => e.stopPropagation()}>
                <button className="vdm-close" onClick={onClose}><HiOutlineXMark /></button>

                {/* Seal */}
                <div className="vdm-seal">
                    <div className="vdm-seal-ring">
                        <HiOutlineCheckBadge />
                    </div>
                </div>

                <h2 className="vdm-title">Verified Business</h2>
                <p className="vdm-subtitle">{businessName || 'This business'} is verified by Travelpod</p>

                {loading ? (
                    <div className="vdm-loading"><div className="vdm-spinner" /></div>
                ) : error ? (
                    <div className="vdm-error">Verification details are not available at this time.</div>
                ) : verification ? (
                    <div className="vdm-details">
                        <div className="vdm-row">
                            <div className="vdm-row-icon"><HiOutlineBuildingOffice2 /></div>
                            <div>
                                <div className="vdm-row-label">Business Registration Number</div>
                                <div className="vdm-row-value">{verification.businessRegistrationNumber}</div>
                            </div>
                        </div>

                        {verification.associationName && (
                            <div className="vdm-row">
                                <div className="vdm-row-icon">🏛️</div>
                                <div>
                                    <div className="vdm-row-label">Association</div>
                                    <div className="vdm-row-value">
                                        {verification.associationName}
                                        {verification.associationMembershipNumber && (
                                            <span className="vdm-membership"> (#{verification.associationMembershipNumber})</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {verification.registeredWebsite && (
                            <div className="vdm-row">
                                <div className="vdm-row-icon"><HiOutlineGlobeAlt /></div>
                                <div>
                                    <div className="vdm-row-label">
                                        Website {verification.websiteVerified && <span className="vdm-web-verified">✓ Verified</span>}
                                    </div>
                                    <a href={verification.registeredWebsite} target="_blank" rel="noreferrer" className="vdm-row-link">
                                        {verification.registeredWebsite}
                                    </a>
                                </div>
                            </div>
                        )}

                        {verification.verifiedAt && (
                            <div className="vdm-row">
                                <div className="vdm-row-icon">📅</div>
                                <div>
                                    <div className="vdm-row-label">Verified Since</div>
                                    <div className="vdm-row-value">{new Date(verification.verifiedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}

                <div className="vdm-trust">
                    <div className="vdm-trust-icon">🛡️</div>
                    <p>Travelpod has reviewed the official documents for this business and confirmed their registration details are valid. This verification is an indicator of legitimacy but does not constitute an endorsement of services.</p>
                </div>
            </div>
        </div>
    );
}
