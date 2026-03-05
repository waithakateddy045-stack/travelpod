import { Link } from 'react-router-dom';
import { HiOutlineArrowLeft, HiOutlineGlobeAlt } from 'react-icons/hi2';

export default function NotFoundPage() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            textAlign: 'center',
            padding: '2rem',
            fontFamily: 'var(--font-body)',
        }}>
            <HiOutlineGlobeAlt style={{ fontSize: '4rem', color: 'var(--color-primary)', marginBottom: '1rem' }} />
            <h1 style={{ fontSize: '5rem', fontWeight: 800, background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
                404
            </h1>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                Lost in Transit
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: 380 }}>
                This destination doesn't exist on Travelpod. Let's get you back on track.
            </p>
            <Link
                to="/feed"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '10px 24px',
                    borderRadius: '9999px',
                    background: 'var(--gradient-brand)',
                    color: 'white',
                    fontWeight: 600,
                    textDecoration: 'none',
                    boxShadow: 'var(--shadow-glow)',
                }}
            >
                <HiOutlineArrowLeft /> Back to Feed
            </Link>
        </div>
    );
}
