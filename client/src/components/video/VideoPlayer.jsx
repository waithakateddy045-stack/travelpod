import { useRef, useState, useEffect, useCallback } from 'react';
import { HiOutlinePlay, HiOutlinePause, HiOutlineSpeakerWave, HiOutlineSpeakerXMark } from 'react-icons/hi2';
import './VideoPlayer.css';

export default function VideoPlayer({ src, poster, autoPlay = false, muted = true, loop = true, onView }) {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const [playing, setPlaying] = useState(autoPlay);
    const [isMuted, setIsMuted] = useState(muted);
    const [progress, setProgress] = useState(0);
    const [viewCounted, setViewCounted] = useState(false);

    // Intersection Observer — autoplay/pause when scrolling in/out of view
    useEffect(() => {
        const video = videoRef.current;
        const container = containerRef.current;
        if (!video || !container) return;

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
    }, []);

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

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) { video.play(); setPlaying(true); }
        else { video.pause(); setPlaying(false); }
    };

    const toggleMute = (e) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
    };

    return (
        <div ref={containerRef} className="video-player" onClick={togglePlay}>
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                muted={isMuted}
                loop={loop}
                playsInline
                preload="metadata"
                onTimeUpdate={handleTimeUpdate}
            />

            {/* Play/Pause overlay */}
            {!playing && (
                <div className="video-overlay play-overlay">
                    <HiOutlinePlay />
                </div>
            )}

            {/* Mute toggle */}
            <button className="video-mute-btn" onClick={toggleMute}>
                {isMuted ? <HiOutlineSpeakerXMark /> : <HiOutlineSpeakerWave />}
            </button>

            {/* Progress bar */}
            <div className="video-progress">
                <div className="video-progress-fill" style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
}
