import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import useFeatureFlag from '../../hooks/useFeatureFlag';
import { HiOutlineLockClosed } from 'react-icons/hi';
import './BadgesPage.css';

const API = import.meta.env.VITE_API_URL || '';

export default function BadgesPage() {
    const { token } = useContext(AuthContext);
    const { enabled: gamificationEnabled } = useFeatureFlag('gamification');
    const [allBadges, setAllBadges] = useState([]);
    const [myBadges, setMyBadges] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!gamificationEnabled) return;
        Promise.all([
            axios.get(`${API}/api/badges/all`),
            token ? axios.get(`${API}/api/badges/my`, { headers: { Authorization: `Bearer ${token}` } }) : Promise.resolve({ data: { badges: [] } }),
        ]).then(([allRes, myRes]) => {
            setAllBadges(allRes.data.badges || []);
            setMyBadges(myRes.data.badges || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [gamificationEnabled, token]);

    if (!gamificationEnabled) {
        return (
            <div className="badges-page">
                <div className="badges-disabled">
                    <HiOutlineLockClosed className="disabled-icon" />
                    <h2>Badges Coming Soon</h2>
                    <p>The gamification system is not yet active. Stay tuned!</p>
                </div>
            </div>
        );
    }

    const earnedIds = new Set(myBadges.map(b => b.badgeId));
    const TIER_ORDER = { BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4 };

    const sorted = [...allBadges].sort((a, b) => (TIER_ORDER[a.tier] || 0) - (TIER_ORDER[b.tier] || 0));

    return (
        <div className="badges-page">
            <div className="badges-container">
                <h1>🏅 Achievements</h1>
                <p className="badges-subtitle">
                    {myBadges.length} of {allBadges.length} badges earned
                </p>

                {loading ? (
                    <div className="badges-loading"><div className="badges-spinner" /></div>
                ) : (
                    <div className="badges-grid">
                        {sorted.map(badge => {
                            const earned = earnedIds.has(badge.id);
                            return (
                                <div key={badge.id} className={`badge-card ${earned ? 'earned' : 'locked'} tier-${badge.tier.toLowerCase()}`}>
                                    <div className="badge-icon">{badge.icon}</div>
                                    <div className="badge-info">
                                        <h3>{badge.name}</h3>
                                        <p>{badge.description}</p>
                                        <span className="badge-tier">{badge.tier}</span>
                                    </div>
                                    {!earned && <HiOutlineLockClosed className="badge-lock" />}
                                    {earned && <span className="badge-earned-tag">✓ Earned</span>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
