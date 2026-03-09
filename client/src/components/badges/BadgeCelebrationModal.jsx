import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { HiOutlineCheck, HiOutlineX } from 'react-icons/hi';
import './BadgeCelebrationModal.css';

export default function BadgeCelebrationModal({ badge, onClose }) {
    if (!badge) return null;

    return (
        <div className="modal-overlay">
            <div className="badge-celebration-modal">
                <button className="modal-close" onClick={onClose}><HiOutlineX /></button>
                <div className="celebration-content">
                    <div className="celebration-icon">{badge.icon}</div>
                    <h2>New Achievement Unlocked!</h2>
                    <h3 className={`tier-${badge.tier.toLowerCase()}`}>{badge.name}</h3>
                    <p>{badge.description}</p>
                    <div className="celebration-actions">
                        <button className="btn-primary" onClick={onClose}>Awesome!</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
