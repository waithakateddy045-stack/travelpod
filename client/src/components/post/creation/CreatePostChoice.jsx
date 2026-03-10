import React from 'react';
import {
    HiOutlineVideoCamera,
    HiOutlinePhoto,
    HiOutlinePencilSquare,
    HiOutlineXMark
} from 'react-icons/hi2';
import './CreatePostChoice.css';

export default function CreatePostChoice({ onSelect, onClose }) {
    return (
        <div className="create-choice-overlay" onClick={onClose}>
            <div className="create-choice-sheet" onClick={e => e.stopPropagation()}>
                <div className="choice-header">
                    <h2>Create Post</h2>
                    <button className="close-btn" onClick={onClose}><HiOutlineXMark /></button>
                </div>

                <div className="choice-grid">
                    <button className="choice-card video" onClick={() => onSelect('VIDEO')}>
                        <div className="icon-wrap">
                            <HiOutlineVideoCamera />
                        </div>
                        <div className="choice-text">
                            <h3>Video</h3>
                            <p>Share a vertical travel clip</p>
                        </div>
                    </button>

                    <button className="choice-card photo" onClick={() => onSelect('PHOTO')}>
                        <div className="icon-wrap">
                            <HiOutlinePhoto />
                        </div>
                        <div className="choice-text">
                            <h3>Photo</h3>
                            <p>Carousel of up to 4 images</p>
                        </div>
                    </button>

                    <button className="choice-card text" onClick={() => onSelect('TEXT')}>
                        <div className="icon-wrap">
                            <HiOutlinePencilSquare />
                        </div>
                        <div className="choice-text">
                            <h3>Write</h3>
                            <p>Share thoughts or a review</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
