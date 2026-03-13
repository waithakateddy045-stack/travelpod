import { useState, useEffect } from 'react';
import { HiOutlineXMark, HiOutlineGlobeAlt, HiOutlineBuildingOffice2, HiOutlineCheckBadge, HiOutlinePhone } from 'react-icons/hi2';
import api from '../../services/api';
import './VerificationDetailsModal.css';

// Social media icons as inline SVG for simplicity
const InstagramIcon = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
);

const FacebookIcon = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

const LinkedInIcon = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
);

export default function VerificationDetailsModal({ userId, businessName, verification: initialVerification, businessProfile, isOwn, isOpen, onClose }) {
    const [verification, setVerification] = useState(initialVerification || null);
    const [loading, setLoading] = useState(!initialVerification);
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

    // Social links from the businessProfile
    const socials = businessProfile || {};

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
                                        {verification.registeredWebsite.replace(/^https?:\/\//, '')}
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

                {/* Social Links Section */}
                {(socials.instagramUrl || socials.facebookUrl || socials.linkedinUrl || socials.whatsappPhone) && (
                    <div className="vdm-socials">
                        <div className="vdm-socials-title">Connect</div>
                        <div className="vdm-socials-row">
                            {socials.instagramUrl && (
                                <a href={socials.instagramUrl} target="_blank" rel="noreferrer" className="vdm-social-btn vdm-instagram" title="Instagram">
                                    <InstagramIcon />
                                    <span>Instagram</span>
                                </a>
                            )}
                            {socials.facebookUrl && (
                                <a href={socials.facebookUrl} target="_blank" rel="noreferrer" className="vdm-social-btn vdm-facebook" title="Facebook">
                                    <FacebookIcon />
                                    <span>Facebook</span>
                                </a>
                            )}
                            {socials.linkedinUrl && (
                                <a href={socials.linkedinUrl} target="_blank" rel="noreferrer" className="vdm-social-btn vdm-linkedin" title="LinkedIn">
                                    <LinkedInIcon />
                                    <span>LinkedIn</span>
                                </a>
                            )}
                            {socials.whatsappPhone && (
                                <a href={`https://wa.me/${socials.whatsappPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="vdm-social-btn vdm-whatsapp" title="WhatsApp">
                                    <HiOutlinePhone />
                                    <span>WhatsApp</span>
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* Business Owner Quick Actions */}
                {isOwn && (
                    <div className="vdm-owner-actions">
                        <div className="vdm-socials-title">Quick Actions</div>
                        <div className="vdm-action-grid">
                            <button className="vdm-action-btn" onClick={() => { onClose(); window.location.href='/enquiries'; }}>
                                <div className="action-icon">💬</div>
                                <span>Enquiries</span>
                            </button>
                            <button className="vdm-action-btn" onClick={() => { onClose(); window.location.href='/promotions'; }}>
                                <div className="action-icon">🚀</div>
                                <span>Promotions</span>
                            </button>
                            <button className="vdm-action-btn" onClick={() => { onClose(); window.location.href='/profile?tab=analytics'; }}>
                                <div className="action-icon">📊</div>
                                <span>Analytics</span>
                            </button>
                        </div>
                    </div>
                )}

                <div className="vdm-trust">
                    <div className="vdm-trust-icon">🛡️</div>
                    <p>Travelpod has reviewed the official documents for this business and confirmed their registration details are valid. This verification is an indicator of legitimacy but does not constitute an endorsement of services.</p>
                </div>
            </div>
        </div>
    );
}
