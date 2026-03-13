import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Volume2, VolumeX, TriangleAlert, RotateCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './VideoPlayer.css';

export default function VideoPlayer({ src, poster, autoPlay = false, loop = true, onView, onClick }) {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const { isMuted, setIsMuted } = useAuth();
    const [playing, setPlaying] = useState(autoPlay);
    const [progress, setProgress] = useState(0);
    const [viewCounted, setViewCounted] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [retryCount, setRetryCount] = useState(0);

    // Sync muted state
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
        }
    }, [isMuted]);

    // Intersection Observer — autoplay/pause when scrolling in/out of view
    useEffect(() => {
        const video = videoRef.current;
        const container = containerRef.current;
        if (!video || !container || hasError) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    video.play().catch(() => { });
                    setPlaying(true);
                } else {
                    video.pause();
                    setPlaying(false);
                }
            },
            { threshold: 0.6 }
        );

        observer.observe(container);
        return () => observer.disconnect();
    }, [hasError, retryCount]);

    // Track progress for the progress bar
    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        const pct = (video.currentTime / video.duration) * 100;
        setProgress(pct || 0);

        // Count as "viewed" after 3 seconds
        if (!viewCounted && video.currentTime >= 3) {
            setViewCounted(true);
            onView?.();
        }
    }, [viewCounted, onView]);

    const togglePlay = (e) => {
        if (onClick) {
            onClick(e);
            return;
        }
        if (hasError) return;
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) { video.play().catch(() => { }); setPlaying(true); }
        else { video.pause(); setPlaying(false); }
    };

    const toggleMute = (e) => {
        e.stopPropagation();
        setIsMuted(!isMuted);
    };

    const handleError = () => {
        setHasError(true);
        setIsLoading(false);
        setPlaying(false);
    };

    const handleCanPlay = () => {
        setIsLoading(false);
        setHasError(false);
    };

    const handleRetry = (e) => {
        e.stopPropagation();
        setHasError(false);
        setIsLoading(true);
        setRetryCount(c => c + 1);
        const video = videoRef.current;
        if (video) {
            video.load();
        }
    };

    return (
        <div ref={containerRef} className="video-player" onClick={togglePlay}>
            {/* Loading skeleton */}
            {isLoading && !hasError && (
                <div className="video-overlay video-loading">
                    <div className="video-loading-spinner" />
                </div>
            )}

            {/* Error fallback */}
            {hasError && (
                <div className="video-error-container">
                    <div className="video-error-content">
                        <TriangleAlert className="video-error-icon" />
                        <p className="video-error-text">Video unavailable</p>
                        <p className="video-error-sub">This content may have been removed or is restricted.</p>
                        <button className="video-retry-btn" onClick={handleRetry}>
                            <RotateCw /> Try Again
                        </button>
                    </div>
                </div>
            )}

            <video
                key={retryCount}
                ref={videoRef}
                src={src}
                poster={poster}
                muted={isMuted}
                loop={loop}
                playsInline
                preload="metadata"
                onTimeUpdate={handleTimeUpdate}
                onError={handleError}
                onCanPlay={handleCanPlay}
                onLoadedData={handleCanPlay}
            />

            {/* Play/Pause overlay */}
            {!playing && !hasError && !isLoading && (
                <div className="video-overlay play-overlay">
                    <Play />
                </div>
            )}

            {/* Mute toggle */}
            {!hasError && (
                <button className="video-mute-btn" onClick={toggleMute}>
                    {isMuted ? <VolumeX /> : <Volume2 />}
                </button>
            )}

            {/* Progress bar */}
            {!hasError && (
                <div className="video-progress">
                    <div className="video-progress-fill" style={{ width: `${progress}%` }} />
                </div>
            )}
        </div>
    );
}
