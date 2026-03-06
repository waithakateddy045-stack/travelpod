import { Link, useLocation } from 'react-router-dom';
import { HiOutlineHome, HiOutlineMagnifyingGlass, HiOutlinePlusCircle, HiOutlineChatBubbleOvalLeftEllipsis, HiOutlineUser } from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import './BottomNav.css';

export default function BottomNav() {
    const { user } = useAuth();
    const location = useLocation();

    // Hide on auth pages, welcome page, onboarding, or admin
    if (!user || location.pathname === '/' || location.pathname.startsWith('/auth') || location.pathname.startsWith('/onboarding') || location.pathname.startsWith('/admin')) {
        return null;
    }

    return (
        <nav className="bottom-nav">
            <Link to="/feed" className={`nav-item ${location.pathname === '/feed' ? 'active' : ''}`}>
                <HiOutlineHome />
                <span>Home</span>
            </Link>
            <Link to="/explore" className={`nav-item ${location.pathname === '/explore' ? 'active' : ''}`}>
                <HiOutlineMagnifyingGlass />
                <span>Explore</span>
            </Link>
            <Link to="/upload" className="nav-item upload-btn">
                <div className="upload-icon-wrapper">
                    <HiOutlinePlusCircle />
                </div>
            </Link>
            <Link to="/messages" className={`nav-item ${location.pathname.startsWith('/messages') || location.pathname.startsWith('/notifications') ? 'active' : ''}`}>
                <HiOutlineChatBubbleOvalLeftEllipsis />
                <span>Inbox</span>
            </Link>
            <Link to={user.profile?.handle ? `/profile/${user.profile.handle}` : '#'} className={`nav-item ${location.pathname.startsWith('/profile') ? 'active' : ''}`}>
                <HiOutlineUser />
                <span>Profile</span>
            </Link>
        </nav>
    );
}
