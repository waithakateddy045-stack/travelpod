import { HiOutlineShare, HiOutlineStar, HiOutlineFolderPlus, HiOutlineArrowPath, HiOutlineTrash, HiOutlineEllipsisHorizontal, HiOutlineFlag } from 'react-icons/hi2';
import { useState, useRef, useEffect } from 'react';

/**
 * Reusable More Menu for Posts
 * @param {Object} post - The post object
 * @param {Boolean} isOwner - Whether the current user is the owner
 * @param {Function} onAction - Callback for actions (type: 'repost' | 'recommend' | 'board' | 'download' | 'report' | 'delete')
 */
export default function PostMoreMenu({ post, isOwner, onAction }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAction = (type) => {
        onAction(type, post);
        setIsOpen(false);
    };

    return (
        <div className="more-menu-container" ref={menuRef}>
            <button
                className="action-btn-main"
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                title="More options"
            >
                <HiOutlineEllipsisHorizontal />
            </button>

            {isOpen && (
                <div className="more-context-sheet glass-card animate-scaleIn" style={{ bottom: '100%', right: 0, marginBottom: 8, zIndex: 100 }}>
                    <div className="sheet-handle" />

                    {!isOwner && (
                        <>
                            <button className="sheet-item" onClick={() => handleAction('repost')}>
                                <HiOutlineShare className="item-icon" /> Add to Feed
                            </button>
                            <button className="sheet-item" onClick={() => handleAction('recommend')}>
                                <HiOutlineStar className="item-icon" /> Recommend to Follower
                            </button>
                        </>
                    )}

                    <button className="sheet-item" onClick={() => handleAction('board')}>
                        <HiOutlineFolderPlus className="item-icon" /> Add to Trip Board
                    </button>

                    <button className="sheet-item" onClick={() => handleAction('download')}>
                        <HiOutlineArrowPath className="item-icon" /> Download Media
                    </button>

                    <div className="sheet-divider" />

                    {isOwner ? (
                        <button className="sheet-item danger" onClick={() => handleAction('delete')}>
                            <HiOutlineTrash className="item-icon" /> Delete Post
                        </button>
                    ) : (
                        <button className="sheet-item danger" onClick={() => handleAction('report')}>
                            <HiOutlineFlag className="item-icon" /> Report Content
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
