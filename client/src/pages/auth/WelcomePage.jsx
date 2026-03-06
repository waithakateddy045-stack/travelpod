import { useNavigate } from 'react-router-dom';
import {
    HiOutlineGlobeAlt,
    HiOutlineBuildingOffice2,
    HiOutlineBuildingStorefront,
    HiOutlineMapPin,
    HiOutlinePaperAirplane,
    HiOutlineUserGroup,
    HiOutlineDevicePhoneMobile
} from 'react-icons/hi2';
import './WelcomePage.css';

const accountTypes = [
    { label: 'Traveler', icon: <HiOutlineGlobeAlt /> },
    { label: 'Travel Agency', icon: <HiOutlineBuildingStorefront /> },
    { label: 'Hotel or Resort', icon: <HiOutlineBuildingOffice2 /> },
    { label: 'Destination', icon: <HiOutlineMapPin /> },
    { label: 'Airline', icon: <HiOutlinePaperAirplane /> },
    { label: 'Association', icon: <HiOutlineUserGroup /> },
];

export default function WelcomePage() {
    const navigate = useNavigate();
    const isNonIOS = !(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    const handleGetStarted = () => {
        navigate('/auth/register');
    };

    return (
        <div className="welcome-page">
            {/* Animated background */}
            <div className="welcome-bg">
                <div className="orb orb-1" />
                <div className="orb orb-2" />
                <div className="orb orb-3" />
            </div>

            {/* Content */}
            <div className="welcome-content">
                <div className="welcome-logo">
                    <div className="welcome-logo-icon">✈️</div>
                    <span className="welcome-logo-text">Travelpod</span>
                </div>

                <h1 className="welcome-tagline">
                    The world's first video-first travel platform
                </h1>

                <p className="welcome-description">
                    Discover honest video reviews, connect with travel businesses,
                    and plan your next adventure — all in one place.
                </p>

                <p className="welcome-free">
                    <span className="check-icon">✓</span>
                    Free to join. Always.
                </p>

                <button
                    id="get-started-btn"
                    className="welcome-cta"
                    onClick={handleGetStarted}
                >
                    Get Started
                    <span className="arrow">→</span>
                </button>

                {/* Account types preview */}
                <div className="welcome-types">
                    {accountTypes.map((type) => (
                        <div key={type.label} className="welcome-type-chip">
                            {type.icon}
                            {type.label}
                        </div>
                    ))}
                </div>
            </div>

            {isNonIOS && (
                <a
                    href="https://github.com/waithakateddy045-stack/travelpod/releases/download/v1.0.0/app-debug.apk"
                    download
                    title="Download Android App"
                    style={{
                        position: 'absolute',
                        top: 'var(--space-5)',
                        right: 'var(--space-5)',
                        background: '#22c55e',
                        color: 'white',
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        zIndex: 10,
                        boxShadow: '0 4px 12px rgba(34,197,94,0.3)'
                    }}
                >
                    <HiOutlineDevicePhoneMobile size={24} />
                </a>
            )}
        </div>
    );
}
