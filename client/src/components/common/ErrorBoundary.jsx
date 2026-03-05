import { Component } from 'react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[Travelpod] Uncaught error:', error, info);
    }

    render() {
        if (this.state.hasError) {
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
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✈️</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        Something went wrong
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: 400 }}>
                        We hit a turbulence — the page crashed unexpectedly. Try refreshing or head back to the feed.
                    </p>
                    <button
                        onClick={() => window.location.href = '/feed'}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '9999px',
                            background: 'var(--gradient-brand)',
                            color: 'white',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        Back to Feed
                    </button>
                    {process.env.NODE_ENV !== 'production' && this.state.error && (
                        <pre style={{
                            marginTop: '2rem',
                            padding: '1rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            textAlign: 'left',
                            maxWidth: 600,
                            overflow: 'auto',
                            color: 'var(--color-error)',
                        }}>
                            {this.state.error.toString()}
                        </pre>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}
