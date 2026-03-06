import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    HiOutlineBell, HiOutlineLockClosed, HiOutlineTrash,
    HiOutlineArrowLeft, HiOutlineShieldCheck, HiOutlineArrowDownTray,
    HiOutlineUser, HiOutlineGlobeAlt, HiOutlineDevicePhoneMobile
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Capacitor } from '@capacitor/core';
import '../auth/AuthPage.css';

const NOTIF_PREFS = [
    { key: 'notifLikes', label: 'Likes on your posts' },
    { key: 'notifComments', label: 'Comments on your posts' },
    { key: 'notifFollows', label: 'New followers' },
    { key: 'notifMessages', label: 'Direct messages' },
    { key: 'notifEnquiries', label: 'Enquiries (Business accounts)' },
    { key: 'notifReviews', label: 'New reviews on your business' },
];

export default function SettingsPage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [activeSection, setActiveSection] = useState('notifications');
    const [notifPrefs, setNotifPrefs] = useState({
        notifLikes: true,
        notifComments: true,
        notifFollows: true,
        notifMessages: true,
        notifEnquiries: true,
        notifReviews: true,
    });
    const [privacy, setPrivacy] = useState({ privateAccount: false, disableDirectMessages: false });
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [loading, setLoading] = useState(false);

    // Load prefs from localStorage as simple persistence
    useEffect(() => {
        const stored = localStorage.getItem('notif_prefs');
        if (stored) setNotifPrefs(JSON.parse(stored));
        const storedPrivacy = localStorage.getItem('privacy_prefs');
        if (storedPrivacy) setPrivacy(JSON.parse(storedPrivacy));
    }, []);

    const saveNotifPrefs = () => {
        localStorage.setItem('notif_prefs', JSON.stringify(notifPrefs));
        toast.success('Notification preferences saved');
    };

    const savePrivacy = () => {
        localStorage.setItem('privacy_prefs', JSON.stringify(privacy));
        toast.success('Privacy settings saved');
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('New passwords do not match'); return;
        }
        if (passwordForm.newPassword.length < 8) {
            toast.error('Password must be at least 8 characters'); return;
        }
        setLoading(true);
        try {
            await api.put('/settings/password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
            });
            toast.success('Password updated successfully');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update password');
        } finally { setLoading(false); }
    };

    const handleExportData = () => {
        // Build a simple JSON export of profile data
        const exportData = {
            exportedAt: new Date().toISOString(),
            user: { email: user?.email, accountType: user?.accountType },
            profile: user?.profile,
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'travelpod_data_export.json'; a.click();
        URL.revokeObjectURL(url);
        toast.success('Data export downloaded');
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirm !== 'DELETE') { toast.error('Type DELETE to confirm'); return; }
        setLoading(true);
        try {
            await api.delete('/settings/account', { data: { password: '' } });
            toast.success('Account deleted');
            logout();
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete account');
        } finally { setLoading(false); }
    };

    const [socialLinks, setSocialLinks] = useState({
        instagramUrl: '', facebookUrl: '', linkedinUrl: '', whatsappPhone: ''
    });
    const [socialLoading, setSocialLoading] = useState(false);

    useEffect(() => {
        if (!user) return;
        const BUSINESS_TYPES = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];
        if (!BUSINESS_TYPES.includes(user?.accountType)) return;
        api.get('/profile/' + user?.profile?.handle).then(res => {
            const bp = res.data?.profile?.businessProfile;
            if (bp) setSocialLinks({ instagramUrl: bp.instagramUrl || '', facebookUrl: bp.facebookUrl || '', linkedinUrl: bp.linkedinUrl || '', whatsappPhone: bp.whatsappPhone || '' });
        }).catch(() => { });
    }, [user]);

    const saveSocialLinks = async () => {
        setSocialLoading(true);
        try {
            await api.put('/settings/social', socialLinks);
            toast.success('Social links saved');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save');
        } finally { setSocialLoading(false); }
    };

    const isBusiness = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'].includes(user?.accountType);
    const isNonIOS = !(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const isCapacitor = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform();

    const SECTIONS = [
        { key: 'notifications', label: 'Notifications', icon: <HiOutlineBell /> },
        { key: 'privacy', label: 'Privacy & Safety', icon: <HiOutlineShieldCheck /> },
        { key: 'security', label: 'Security', icon: <HiOutlineLockClosed /> },
        ...(isBusiness ? [{ key: 'social', label: 'Social Links', icon: <HiOutlineGlobeAlt /> }] : []),
        ...(isNonIOS ? [{ key: 'app', label: 'Get the App', icon: <HiOutlineDevicePhoneMobile /> }] : []),
        { key: 'data', label: 'Data & Export', icon: <HiOutlineArrowDownTray /> },
        { key: 'account', label: 'Account', icon: <HiOutlineUser /> },
    ];

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: 720, padding: 'var(--space-6) var(--space-4)' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                    <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', padding: 4 }}>
                        <HiOutlineArrowLeft />
                    </button>
                    <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Settings</h1>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
                    {/* Sidebar */}
                    <nav style={{ width: 180, flexShrink: 0 }}>
                        {SECTIONS.map(s => (
                            <button
                                key={s.key}
                                id={`settings-nav-${s.key}`}
                                onClick={() => setActiveSection(s.key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                    width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)',
                                    border: 'none', cursor: 'pointer', textAlign: 'left',
                                    background: activeSection === s.key ? 'var(--bg-elevated)' : 'transparent',
                                    color: activeSection === s.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    fontWeight: activeSection === s.key ? 600 : 400,
                                    marginBottom: 'var(--space-1)',
                                    fontSize: 'var(--text-sm)',
                                }}
                            >
                                {s.icon} {s.label}
                            </button>
                        ))}
                    </nav>

                    {/* Content */}
                    <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', border: '1px solid var(--border-primary)' }}>

                        {/* Notifications */}
                        {activeSection === 'notifications' && (
                            <div>
                                <h2 style={{ marginBottom: 'var(--space-4)', fontWeight: 700 }}>Notification Preferences</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                                    Choose what you get notified about.
                                </p>
                                {NOTIF_PREFS.map(pref => (
                                    <div key={pref.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-primary)' }}>
                                        <span style={{ fontSize: 'var(--text-sm)' }}>{pref.label}</span>
                                        <button
                                            id={`notif-toggle-${pref.key}`}
                                            onClick={() => setNotifPrefs(p => ({ ...p, [pref.key]: !p[pref.key] }))}
                                            style={{
                                                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                                                background: notifPrefs[pref.key] ? 'var(--color-primary)' : 'var(--border-primary)',
                                                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                                            }}
                                        >
                                            <span style={{
                                                position: 'absolute', top: 2, left: notifPrefs[pref.key] ? 22 : 2,
                                                width: 20, height: 20, borderRadius: '50%', background: 'white',
                                                transition: 'left 0.2s', display: 'block',
                                            }} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    className="auth-submit"
                                    onClick={saveNotifPrefs}
                                    style={{ marginTop: 'var(--space-6)', width: 'auto', padding: '10px 28px' }}
                                >
                                    Save Preferences
                                </button>
                            </div>
                        )}

                        {/* Privacy */}
                        {activeSection === 'privacy' && (
                            <div>
                                <h2 style={{ marginBottom: 'var(--space-4)', fontWeight: 700 }}>Privacy & Safety</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                                    Control who can interact with you.
                                </p>
                                {[
                                    { key: 'privateAccount', label: 'Private Account', desc: 'Only followers can see your posts' },
                                    { key: 'disableDirectMessages', label: 'Disable Direct Messages', desc: 'Nobody can send you messages' },
                                ].map(item => (
                                    <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-primary)' }}>
                                        <div>
                                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{item.label}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{item.desc}</div>
                                        </div>
                                        <button
                                            id={`privacy-toggle-${item.key}`}
                                            onClick={() => setPrivacy(p => ({ ...p, [item.key]: !p[item.key] }))}
                                            style={{
                                                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                                                background: privacy[item.key] ? 'var(--color-primary)' : 'var(--border-primary)',
                                                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                                            }}
                                        >
                                            <span style={{
                                                position: 'absolute', top: 2, left: privacy[item.key] ? 22 : 2,
                                                width: 20, height: 20, borderRadius: '50%', background: 'white',
                                                transition: 'left 0.2s', display: 'block',
                                            }} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    className="auth-submit"
                                    onClick={savePrivacy}
                                    style={{ marginTop: 'var(--space-6)', width: 'auto', padding: '10px 28px' }}
                                >
                                    Save Settings
                                </button>
                            </div>
                        )}

                        {/* Security */}
                        {activeSection === 'security' && (
                            <div>
                                <h2 style={{ marginBottom: 'var(--space-4)', fontWeight: 700 }}>Change Password</h2>
                                <form onSubmit={handleChangePassword}>
                                    {[
                                        { id: 'settings-current-password', label: 'Current Password', key: 'currentPassword' },
                                        { id: 'settings-new-password', label: 'New Password', key: 'newPassword' },
                                        { id: 'settings-confirm-password', label: 'Confirm New Password', key: 'confirmPassword' },
                                    ].map(field => (
                                        <div className="form-field" key={field.key}>
                                            <label className="form-label">{field.label}</label>
                                            <input
                                                id={field.id}
                                                type="password"
                                                className="form-input"
                                                value={passwordForm[field.key]}
                                                onChange={e => setPasswordForm(f => ({ ...f, [field.key]: e.target.value }))}
                                                required
                                            />
                                        </div>
                                    ))}
                                    <button type="submit" className="auth-submit" disabled={loading} style={{ width: 'auto', padding: '10px 28px' }}>
                                        {loading ? 'Updating...' : 'Update Password'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Social Links */}
                        {activeSection === 'social' && (
                            <div>
                                <h2 style={{ marginBottom: 'var(--space-4)', fontWeight: 700 }}>Social Links</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                                    Display your social presence on your verified Business Profile.
                                </p>
                                <div className="form-field">
                                    <label className="form-label">Instagram URL</label>
                                    <input type="url" className="form-input" placeholder="https://instagram.com/yourhandle" value={socialLinks.instagramUrl} onChange={e => setSocialLinks(s => ({ ...s, instagramUrl: e.target.value }))} />
                                </div>
                                <div className="form-field">
                                    <label className="form-label">Facebook URL</label>
                                    <input type="url" className="form-input" placeholder="https://facebook.com/yourpage" value={socialLinks.facebookUrl} onChange={e => setSocialLinks(s => ({ ...s, facebookUrl: e.target.value }))} />
                                </div>
                                <div className="form-field">
                                    <label className="form-label">LinkedIn URL</label>
                                    <input type="url" className="form-input" placeholder="https://linkedin.com/company/yourcompany" value={socialLinks.linkedinUrl} onChange={e => setSocialLinks(s => ({ ...s, linkedinUrl: e.target.value }))} />
                                </div>
                                <div className="form-field">
                                    <label className="form-label">WhatsApp Phone (with Country Code)</label>
                                    <input type="tel" className="form-input" placeholder="+1234567890" value={socialLinks.whatsappPhone} onChange={e => setSocialLinks(s => ({ ...s, whatsappPhone: e.target.value }))} />
                                </div>
                                <button className="auth-submit" onClick={saveSocialLinks} disabled={socialLoading} style={{ marginTop: 'var(--space-4)', width: 'auto', padding: '10px 28px' }}>
                                    {socialLoading ? 'Saving...' : 'Save Social Links'}
                                </button>
                            </div>
                        )}

                        {/* Get the App */}
                        {activeSection === 'app' && isNonIOS && !isCapacitor && (
                            <div>
                                <h2 style={{ marginBottom: 'var(--space-4)', fontWeight: 700 }}>Get the App</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                                    Download the official Travelpod Android application for the best experience.
                                </p>
                                <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 'var(--space-6)', border: '1px solid var(--border-primary)', marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                    <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>
                                        <div style={{ width: 80, height: 80, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(16,185,129,0.4)' }}>
                                            <span style={{ fontSize: '2.5rem' }}>✈️</span>
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: 8 }}>Travelpod for Android</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)', maxWidth: 320 }}>
                                        Experience immersive travel videos, faster load times, and native push notifications.
                                    </div>
                                    <a
                                        href="https://github.com/waithakateddy045-stack/travelpod/releases/download/v1.0.1/Travelpod.apk"
                                        download
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', textDecoration: 'none', fontSize: 'var(--text-md)', fontWeight: 600, transition: 'transform 0.2s', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>✈️</span>
                                        <span>Download App</span>
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Data & Export */}
                        {activeSection === 'data' && (
                            <div>
                                <h2 style={{ marginBottom: 'var(--space-4)', fontWeight: 700 }}>Your Data</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                                    Download a copy of your Travelpod data.
                                </p>
                                <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', border: '1px solid var(--border-primary)', marginBottom: 'var(--space-4)' }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Profile Export</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                                        Downloads your profile, preferences, and account info as a JSON file.
                                    </div>
                                    <button
                                        id="settings-export-data"
                                        onClick={handleExportData}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600 }}
                                    >
                                        <HiOutlineArrowDownTray /> Download Data
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Account Deletion */}
                        {activeSection === 'account' && (
                            <div>
                                <h2 style={{ marginBottom: 'var(--space-4)', fontWeight: 700, color: '#ef4444' }}>Delete Account</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                                    This action is permanent and cannot be undone. All your posts, followers, and data will be removed.
                                </p>
                                <div className="form-field">
                                    <label className="form-label">Type <strong>DELETE</strong> to confirm</label>
                                    <input
                                        id="settings-delete-confirm"
                                        className="form-input"
                                        value={deleteConfirm}
                                        onChange={e => setDeleteConfirm(e.target.value)}
                                        placeholder="DELETE"
                                    />
                                </div>
                                <button
                                    id="settings-delete-account"
                                    onClick={handleDeleteAccount}
                                    disabled={loading || deleteConfirm !== 'DELETE'}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 'var(--radius-md)', border: 'none', background: deleteConfirm === 'DELETE' ? '#ef4444' : 'var(--bg-elevated)', color: deleteConfirm === 'DELETE' ? 'white' : 'var(--text-tertiary)', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'default', fontWeight: 600, marginTop: 'var(--space-4)' }}
                                >
                                    <HiOutlineTrash /> Delete My Account
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
