import { useState, useEffect, useCallback } from 'react';
import './AdminPage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── API helpers ──────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('admin_token');

const apiCall = async (endpoint, options = {}) => {
    // Agent log removed

    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
            ...options.headers,
        },
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
        // Agent log error fallback removed
        throw new Error(data?.message || `Request failed (${res.status})`);
    }
    return data;
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, accent, sub }) => (
    <div className={`stat-card stat-${accent}`}>
        <div className="stat-icon">{icon}</div>
        <div className="stat-info">
            <div className="stat-value">{value?.toLocaleString() ?? '—'}</div>
            <div className="stat-label">{label}</div>
            {sub && <div className="stat-sub">{sub}</div>}
        </div>
    </div>
);

const Badge = ({ type, small }) => {
    const map = {
        TRAVELER: { label: 'Traveler', cls: 'traveler' },
        TRAVEL_AGENCY: { label: 'Agency', cls: 'agency' },
        HOTEL_RESORT: { label: 'Hotel', cls: 'hotel' },
        DESTINATION: { label: 'Destination', cls: 'destination' },
        AIRLINE: { label: 'Airline', cls: 'airline' },
        ASSOCIATION: { label: 'Association', cls: 'association' },
        ADMIN: { label: 'Admin', cls: 'admin' },
        APPROVED: { label: '✓ Verified', cls: 'verified' },
        PENDING: { label: '⏳ Pending', cls: 'pending' },
        UNVERIFIED: { label: 'Unverified', cls: 'unverified' },
        REJECTED: { label: 'Rejected', cls: 'rejected' },
    };
    const m = map[type] || { label: type, cls: 'default' };
    return <span className={`badge badge-${m.cls}${small ? ' badge-sm' : ''}`}>{m.label}</span>;
};

const Pagination = ({ page, totalPages, onChange }) => (
    <div className="pagination">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}>← Prev</button>
        <span>Page {page} / {totalPages || 1}</span>
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
);

// ─── Login Screen ─────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
    const [email, setEmail] = useState('admin@travelpod.com');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [mfaRequired, setMfaRequired] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [tempToken, setTempToken] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (mfaRequired) {
            try {
                const data = await fetch(`${API_BASE}/auth/verify-admin-mfa`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tempToken}`
                    },
                    body: JSON.stringify({ email, code: otpCode }),
                }).then(r => r.json());

                if (!data.success) throw new Error(data.message || 'MFA Verification failed');

                localStorage.setItem('admin_token', data.accessToken);
                localStorage.setItem('admin_user', JSON.stringify(data.user));
                onLogin(data.user);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
            return;
        }

        try {
            const data = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            }).then(r => r.json());

            if (!data.success) throw new Error(data.message || 'Login failed');

            if (data.requiresMfa) {
                setMfaRequired(true);
                setTempToken(data.tempToken);
                setLoading(false);
                return;
            }

            if (data.user?.accountType !== 'ADMIN' && !data.user?.isAdmin) {
                throw new Error('Access denied — admin accounts only');
            }

            localStorage.setItem('admin_token', data.accessToken);
            localStorage.setItem('admin_user', JSON.stringify(data.user));
            onLogin(data.user);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-screen">
            <div className="login-card">
                <div className="login-logo">
                    <div className="logo-icon">✈</div>
                    <h1>Travelpod <span>Admin</span></h1>
                    <p>Platform Management Console</p>
                </div>
                <form onSubmit={handleSubmit} className="login-form">
                    {error && <div className="login-error">{error}</div>}
                    
                    {!mfaRequired ? (
                        <>
                            <div className="form-group">
                                <label>Admin Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                            </div>
                        </>
                    ) : (
                        <div className="form-group">
                            <label>MFA OTP Code</label>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                A security code was sent to the administrator's email.
                            </p>
                            <input 
                                type="text" 
                                value={otpCode} 
                                onChange={e => setOtpCode(e.target.value)} 
                                placeholder="000000" 
                                required 
                                autoFocus
                            />
                            <button 
                                type="button" 
                                className="text-btn" 
                                onClick={() => setMfaRequired(false)}
                                style={{ marginTop: '8px', fontSize: '12px', background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}
                            >
                                ← Back to Login
                            </button>
                        </div>
                    )}

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Processing...' : mfaRequired ? 'Verify & Enter' : 'Sign In to Admin Console'}
                    </button>
                </form>
                <p className="login-footer">This panel is restricted to Travelpod administrators only.</p>
            </div>
        </div>
    );
};

// ─── Dashboard Overview ───────────────────────────────────────────────────────
const DashboardTab = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiCall('/admin/stats').then(d => setStats(d.stats)).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-state"><div className="spinner" /><p>Loading stats...</p></div>;
    if (!stats) return <div className="error-state">Failed to load stats.</div>;

    return (
        <div className="tab-content">
            <div className="section-header">
                <h2>Platform Overview</h2>
                <p>Live statistics for the Travelpod platform</p>
            </div>

            <div className="stats-grid">
                <StatCard icon="👥" label="Total Users" value={stats.totalUsers} accent="blue" sub={`${stats.suspendedUsers} suspended`} />
                <StatCard icon="🎬" label="Total Posts" value={stats.totalPosts} accent="purple" sub={`${stats.recentPosts} this week`} />
                <StatCard icon="📁" label="Trip Boards" value={stats.totalBoards} accent="teal" />
                <StatCard icon="💬" label="Enquiries" value={stats.totalEnquiries} accent="orange" />
                <StatCard icon="✅" label="Approved Posts" value={stats.approvedPosts} accent="green" />
                <StatCard icon="📋" label="Pending Verifications" value={stats.pendingVerifications} accent="teal" />
                <StatCard icon="🚩" label="Reports" value={stats.totalReports} accent="red" />
            </div>

            <div className="section-header" style={{ marginTop: 32 }}>
                <h2>Account Type Distribution</h2>
            </div>
            <div className="account-breakdown">
                {stats.accountBreakdown.map(item => (
                    <div key={item.type} className="breakdown-row">
                        <Badge type={item.type} />
                        <div className="breakdown-bar-wrap">
                            <div
                                className="breakdown-bar"
                                style={{ width: `${Math.min(100, (item.count / stats.totalUsers) * 100)}%` }}
                            />
                        </div>
                        <span className="breakdown-count">{item.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Content Management ─────────────────────────────────────────────────────────
const ContentManagementTab = () => {
    const [posts, setPosts] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [previewPost, setPreviewPost] = useState(null);

    const load = useCallback(async (p, statusVar) => {
        setLoading(true);
        try {
            const d = await apiCall(`/admin/moderation?page=${p}&limit=15&status=${statusVar}`);
            setPosts(d.posts);
            setTotal(d.total);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(page, filterStatus); }, [page, filterStatus, load]);

    const act = async (postId, action) => {
        setActionLoading(postId + action);
        try {
            await apiCall(`/admin/moderation/${postId}`, {
                method: 'PUT',
                body: JSON.stringify({ action }),
            });
            // Reflect the local state change without needing full reload immediately
            if (filterStatus !== 'ALL' && filterStatus !== 'REPORTED') {
                setPosts(prev => prev.filter(p => p.id !== postId));
                setTotal(prev => prev - 1);
            } else {
                setPosts(prev => prev.map(p => p.id === postId ? { ...p, moderationStatus: action === 'RESTORED' ? 'APPROVED' : (action === 'REJECTED' ? 'REMOVED' : action) } : p));
            }
        } catch (e) { alert('Action failed: ' + e.message); }
        finally { setActionLoading(null); }
    };

    return (
        <div className="tab-content">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Content Management</h2>
                    <p>{total} videos found • Manage platform content like a TikTok admin</p>
                </div>
                <select
                    value={filterStatus}
                    onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                    className="admin-select"
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                    <option value="ALL">All Videos</option>
                    <option value="PENDING">Pending Review</option>
                    <option value="APPROVED">Live (Approved)</option>
                    <option value="REMOVED">Taken Down</option>
                    <option value="REPORTED">Reported by Users</option>
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner" /><p>Loading videos...</p></div>
            ) : posts.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🎉</div>
                    <p>No videos found for this filter.</p>
                </div>
            ) : (
                <>
                    {previewPost && (
                        <div className="video-modal-overlay" onClick={() => setPreviewPost(null)}>
                            <div className="video-modal" onClick={e => e.stopPropagation()}>
                                <button className="modal-close" onClick={() => setPreviewPost(null)}>✕</button>
                                <video
                                    src={previewPost.videoUrl}
                                    controls
                                    autoPlay
                                    style={{ width: '100%', borderRadius: 12, maxHeight: 400, background: '#000' }}
                                />
                                <div className="modal-info">
                                    <strong>{previewPost.title}</strong>
                                    <p>Status: <Badge type={previewPost.moderationStatus} small /></p>
                                    <p className="modal-author">by {previewPost.user?.profile?.displayName || 'Unknown'} (@{previewPost.user?.profile?.handle})</p>
                                    <a
                                        href={`/post/${previewPost.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ display: 'inline-block', marginTop: 12, padding: '6px 16px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', textDecoration: 'none', borderRadius: 20, fontSize: 14, fontWeight: 500, border: '1px solid var(--border-primary)' }}
                                    >
                                        Open Full Post ↗
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mod-grid">
                        {posts.map(post => (
                            <div key={post.id} className="mod-card">
                                <div className="mod-thumb" onClick={() => setPreviewPost(post)}>
                                    <video src={post.videoUrl} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <div className="mod-play">▶</div>
                                    <div className="mod-duration">{post.duration}s</div>
                                    {post._count?.reports > 0 && (
                                        <div style={{ position: 'absolute', top: 8, right: 8, background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 'bold' }}>
                                            {post._count.reports} Reports
                                        </div>
                                    )}
                                </div>
                                <div className="mod-info">
                                    <div className="mod-title">
                                        {post.title}
                                    </div>
                                    <div className="mod-meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <Badge type={post.moderationStatus} small />
                                        <span>👤 @{post.user?.handle || '—'}</span>
                                        <span>📅 {new Date(post.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="mod-actions" style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12 }}>
                                    {post.moderationStatus === 'PENDING' && (
                                        <>
                                            <button className="btn-approve" onClick={() => act(post.id, 'APPROVED')} disabled={!!actionLoading} style={{ flex: 1 }}>{actionLoading === post.id + 'APPROVED' ? '...' : 'Approve'}</button>
                                            <button className="btn-reject" onClick={() => act(post.id, 'REMOVED')} disabled={!!actionLoading} style={{ flex: 1 }}>{actionLoading === post.id + 'REMOVED' ? '...' : 'Reject'}</button>
                                        </>
                                    )}
                                    {post.moderationStatus === 'APPROVED' && post._count?.reports > 0 && filterStatus === 'REPORTED' && (
                                        <>
                                            <button className="btn-approve" onClick={() => act(post.id, 'CLEAR_REPORTS')} disabled={!!actionLoading} style={{ flex: 1, background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}>
                                                {actionLoading === post.id + 'CLEAR_REPORTS' ? '...' : 'Clear Reports'}
                                            </button>
                                            <button className="btn-reject" onClick={() => act(post.id, 'REMOVED')} disabled={!!actionLoading} style={{ flex: 1 }}>
                                                {actionLoading === post.id + 'REMOVED' ? '...' : 'Take Down'}
                                            </button>
                                        </>
                                    )}
                                    {post.moderationStatus === 'APPROVED' && filterStatus !== 'REPORTED' && (
                                        <button className="btn-reject" onClick={() => act(post.id, 'REMOVED')} disabled={!!actionLoading} style={{ flex: 1 }}>
                                            {actionLoading === post.id + 'REMOVED' ? '...' : 'Take Down'}
                                        </button>
                                    )}
                                    {post.moderationStatus === 'REMOVED' && (
                                        <button className="btn-approve" onClick={() => act(post.id, 'RESTORED')} disabled={!!actionLoading} style={{ flex: 1 }}>
                                            {actionLoading === post.id + 'RESTORED' ? '...' : 'Restore'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <Pagination page={page} totalPages={Math.ceil(total / 15)} onChange={setPage} />
                </>
            )}
        </div>
    );
};

// ─── Users Management ─────────────────────────────────────────────────────────
const UsersTab = () => {
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const q = new URLSearchParams({ page, limit: 20 });
            if (search) q.set('search', search);
            if (filterType) q.set('accountType', filterType);
            if (filterStatus) q.set('status', filterStatus);
            const d = await apiCall(`/admin/users?${q}`);
            setUsers(d.users);
            setTotal(d.total);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [page, search, filterType, filterStatus]);

    useEffect(() => { load(); }, [load]);

    const toggleSuspend = async (user) => {
        const action = user.isSuspended ? 'unsuspend' : 'suspend';
        setActionLoading(user.id);
        try {
            await apiCall(`/admin/users/${user.id}/${action}`, { method: 'PUT' });
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isSuspended: !u.isSuspended } : u));
        } catch (e) { alert('Failed: ' + e.message); }
        finally { setActionLoading(null); }
    };

    return (
        <div className="tab-content">
            <div className="section-header">
                <h2>User Management</h2>
                <p>{total} users total</p>
            </div>

            <div className="filter-bar">
                <input
                    type="text"
                    placeholder="Search by name, email, or handle..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="filter-search"
                />
                <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} className="filter-select">
                    <option value="">All Types</option>
                    <option value="TRAVELER">Traveler</option>
                    <option value="TRAVEL_AGENCY">Travel Agency</option>
                    <option value="HOTEL_RESORT">Hotel / Resort</option>
                    <option value="DESTINATION">Destination</option>
                    <option value="AIRLINE">Airline</option>
                    <option value="ASSOCIATION">Association</option>
                </select>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="filter-select">
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner" /><p>Loading users...</p></div>
            ) : (
                <>
                    <div className="users-table">
                        <div className="table-header">
                            <span>User</span>
                            <span>Type</span>
                            <span>Posts</span>
                            <span>Followers</span>
                            <span>Joined</span>
                            <span>Status</span>
                            <span>Action</span>
                        </div>
                        {users.length === 0 ? (
                            <div className="empty-state"><p>No users found.</p></div>
                        ) : users.map(user => (
                            <div key={user.id} className={`table-row ${user.isSuspended ? 'row-suspended' : ''}`}>
                                <div className="user-cell">
                                    <img
                                        src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                                        alt=""
                                        className="user-avatar"
                                        onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`; }}
                                    />
                                    <div>
                                        <div className="user-name">{user.displayName || 'No Name'}</div>
                                        <div className="user-handle">@{user.username || '—'}</div>
                                        <div className="user-email">{user.email}</div>
                                    </div>
                                </div>
                                <div><Badge type={user.accountType} small /></div>
                                <div className="cell-center">{user._count?.postsAuthored ?? 0}</div>
                                <div className="cell-center">{user.profile?.followerCount?.toLocaleString() ?? 0}</div>
                                <div className="cell-muted">{new Date(user.createdAt).toLocaleDateString()}</div>
                                <div>
                                    {user.isSuspended
                                        ? <span className="status-badge status-suspended">Suspended</span>
                                        : <span className="status-badge status-active">Active</span>}
                                </div>
                                <div>
                                    <button
                                        className={user.isSuspended ? 'btn-unsuspend' : 'btn-suspend'}
                                        onClick={() => toggleSuspend(user)}
                                        disabled={actionLoading === user.id}
                                    >
                                        {actionLoading === user.id ? '...' : user.isSuspended ? 'Unsuspend' : 'Suspend'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} />
                </>
            )}
        </div>
    );
};

// ─── Trip Boards Management ─────────────────────────────────────────────────────
const TripBoardsTab = () => {
    const [boards, setBoards] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const load = useCallback(async (p) => {
        setLoading(true);
        try {
            const d = await apiCall(`/admin/boards?page=${p}&limit=15`);
            setBoards(d.boards);
            setTotal(d.total);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(page); }, [page, load]);

    const actToggleStatus = async (boardId, action) => {
        const confirmMsg = action === 'REMOVED'
            ? 'Are you sure you want to take down this Trip Board?'
            : 'Restore this Trip Board?';
        if (!window.confirm(confirmMsg)) return;

        setActionLoading(boardId);
        try {
            await apiCall(`/admin/boards/${boardId}`, {
                method: 'PUT',
                body: JSON.stringify({ action })
            });
            setBoards(prev => prev.map(b => b.id === boardId ? { ...b, moderationStatus: action === 'RESTORED' ? 'ACTIVE' : 'REMOVED' } : b));
        } catch (e) { alert('Action failed: ' + e.message); }
        finally { setActionLoading(null); }
    };

    return (
        <div className="tab-content">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Trip Boards</h2>
                    <p>{total} boards found • Monitor and manage user-generated trip boards</p>
                </div>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner" /><p>Loading trip boards...</p></div>
            ) : boards.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📁</div>
                    <p>No trip boards found on the platform.</p>
                </div>
            ) : (
                <>
                    <div className="users-table">
                        <div className="table-header" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 100px' }}>
                            <span>Title</span>
                            <span>Creator</span>
                            <span>Videos</span>
                            <span>Created At</span>
                            <span>Action</span>
                        </div>
                        {boards.map(board => (
                            <div key={board.id} className="table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 100px', alignItems: 'center', cursor: 'default' }}>
                                <div style={{ fontWeight: '600' }}>{board.title}</div>
                                <div>
                                    <div className="user-name">{board.user?.displayName || 'Unknown'}</div>
                                    <div className="user-handle" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{board.user?.username || '—'}</div>
                                </div>
                                <div className="cell-center">{board._count?.videos ?? 0}</div>
                                <div className="cell-muted">{new Date(board.createdAt).toLocaleDateString()}</div>
                                <div>
                                    {board.moderationStatus === 'REMOVED' ? (
                                        <button
                                            className="btn-approve"
                                            style={{ padding: '6px 12px', width: '100%', fontSize: 12 }}
                                            onClick={() => actToggleStatus(board.id, 'RESTORED')}
                                            disabled={actionLoading === board.id}
                                        >
                                            {actionLoading === board.id ? '...' : 'Restore'}
                                        </button>
                                    ) : (
                                        <button
                                            className="btn-reject"
                                            style={{ padding: '6px 12px', width: '100%', fontSize: 12 }}
                                            onClick={() => actToggleStatus(board.id, 'REMOVED')}
                                            disabled={actionLoading === board.id}
                                        >
                                            {actionLoading === board.id ? '...' : 'Take Down'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination page={page} totalPages={Math.ceil(total / 15)} onChange={setPage} />
                </>
            )}
        </div>
    );
};

// ─── Verification Tab ─────────────────────────────────────────────────────────
const VerificationTab = () => {
    const [apps, setApps] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('PENDING');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const d = await apiCall(`/admin/business-verifications?page=${page}&status=${statusFilter}&limit=15`);
            setApps(d.verifications);
            setTotal(d.total);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [page, statusFilter]);

    useEffect(() => { load(); }, [load]);

    const decide = async (id, decision) => {
        const adminNotes = prompt('Admin notes (optional but recommended for rejection):');
        if (decision === 'REJECTED' && adminNotes === null) return; // cancelled prompt

        setActionLoading(id);
        try {
            const method = decision === 'APPROVED' ? 'approve' : 'reject';
            const body = { adminNotes };
            if (decision === 'APPROVED') {
                body.websiteVerified = window.confirm('Did you verify their website? (Click OK for Yes, Cancel for No)');
            }

            await apiCall(`/admin/business-verifications/${id}/${method}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
            setApps(prev => prev.filter(a => a.id !== id));
            setTotal(prev => prev - 1);
        } catch (e) { alert('Failed: ' + e.message); }
        finally { setActionLoading(null); }
    };

    return (
        <div className="tab-content">
            <div className="section-header">
                <h2>Business Verifications</h2>
                <p>Review and approve enhanced Business Verification applications.</p>
            </div>

            <div className="filter-bar">
                {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
                    <button
                        key={s}
                        className={`filter-pill ${statusFilter === s ? 'active' : ''}`}
                        onClick={() => { setStatusFilter(s); setPage(1); }}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner" /><p>Loading applications...</p></div>
            ) : apps.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <p>No {statusFilter.toLowerCase()} applications.</p>
                </div>
            ) : (
                <>
                    <div className="verif-grid">
                        {apps.map(app => {
                            const user = app.user;
                            const prof = user?.profile;
                            return (
                                <div key={app.id} className="verif-card" style={{ maxWidth: '600px' }}>
                                    <div className="verif-header">
                                        <img
                                            src={prof?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${app.id}`}
                                            alt=""
                                            className="verif-avatar"
                                            onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${app.id}`; }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div className="verif-name">{prof?.displayName || 'Unknown Business'}</div>
                                            <div className="verif-handle">@{prof?.handle || '—'}</div>
                                            {user && <Badge type={user.accountType} small />}
                                        </div>
                                        <Badge type={app.status} small />
                                    </div>

                                    <div className="verif-docs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div className="doc-row" style={{ gridColumn: '1 / -1' }}>
                                            <span className="doc-label">🏢 Business Reg #</span>
                                            <span className="doc-value">{app.businessRegistrationNumber}</span>
                                            <a href={app.businessRegistrationDocument} target="_blank" rel="noreferrer" className="doc-link" style={{ marginLeft: 8 }}>View Doc</a>
                                        </div>
                                        {app.associationName && (
                                            <div className="doc-row" style={{ gridColumn: '1 / -1' }}>
                                                <span className="doc-label">🤝 Association</span>
                                                <span className="doc-value">{app.associationName} ({app.associationMembershipNumber})</span>
                                                {app.associationDocument && <a href={app.associationDocument} target="_blank" rel="noreferrer" className="doc-link" style={{ marginLeft: 8 }}>View Doc</a>}
                                            </div>
                                        )}
                                        <div className="doc-row" style={{ gridColumn: '1 / -1' }}>
                                            <span className="doc-label">🌐 Website</span>
                                            <a href={app.registeredWebsite} target="_blank" rel="noreferrer" className="doc-link">{app.registeredWebsite}</a>
                                        </div>
                                        <div className="doc-row">
                                            <span className="doc-label">📅 Applied</span>
                                            <span className="doc-value">{new Date(app.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="doc-row">
                                            <span className="doc-label">✉️ Email</span>
                                            <span className="doc-value" style={{ wordBreak: 'break-all' }}>{user?.email}</span>
                                        </div>
                                    </div>

                                    {app.status === 'PENDING' && (
                                        <div className="verif-actions" style={{ marginTop: 16 }}>
                                            <button
                                                className="btn-approve"
                                                onClick={() => decide(app.id, 'APPROVED')}
                                                disabled={!!actionLoading}
                                            >
                                                {actionLoading === app.id ? '...' : '✓ Approve & Verify'}
                                            </button>
                                            <button
                                                className="btn-reject"
                                                onClick={() => decide(app.id, 'REJECTED')}
                                                disabled={!!actionLoading}
                                            >
                                                {actionLoading === app.id ? '...' : '✕ Reject'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <Pagination page={page} totalPages={Math.ceil(total / 15)} onChange={setPage} />
                </>
            )}
        </div>
    );
};

// ─── Promoted Posts / Boosts ─────────────────────────────────────────────────────────────
const PromotedPostsTab = () => {
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadPromotions = useCallback(async (status = '') => {
        try {
            setLoading(true);
            const data = await apiCall(`/featured/boosts${status ? `?status=${status}` : ''}`);
            setPromotions(data.boosts || []);
        } catch (err) {
            console.error('Failed to load boosts', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadPromotions(); }, [loadPromotions]);

    const handleAction = async (id, action) => {
        if (!window.confirm(`Are you sure you want to ${action} this boost?`)) return;
        try {
            await apiCall(`/featured/boosts/${id}/${action}`, { method: 'PATCH' });
            loadPromotions();
        } catch (err) { alert('Action failed'); }
    };

    return (
        <div className="tab-pane">
            <div className="tab-header">
                <h2>Sponsored Boost Requests</h2>
                <div className="tab-actions">
                    <select
                        onChange={(e) => loadPromotions(e.target.value)}
                        className="admin-select"
                        style={{ padding: '8px 16px', borderRadius: 8 }}
                    >
                        <option value="">All Boosts</option>
                        <option value="PENDING">Pending</option>
                        <option value="ACTIVE">Active</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="COMPLETED">Completed</option>
                    </select>
                </div>
            </div>
            {loading ? <div className="loading-state">Loading boosts...</div> : (
                <div className="cards-grid">
                    {promotions.map(promo => (
                        <div key={promo.id} className="admin-card">
                            <div className="card-top">
                                <strong>{promo.post?.title || 'Unknown Post'}</strong>
                                <Badge type={promo.status === 'ACTIVE' ? 'APPROVED' : promo.status} small />
                            </div>
                            <div className="card-body">
                                <p className="meta-text">User: @{promo.user?.profile?.handle}</p>
                                <p className="meta-text">Tier: {promo.tier} • Duration: {promo.duration} days</p>
                                {promo.targetAudience && <p className="meta-text">Target: {promo.targetAudience}</p>}
                                <div className="stats-row" style={{ marginTop: '12px' }}>
                                    <div className="stat-mini"><span>👁️</span> {promo.impressions} Views</div>
                                    <div className="stat-mini"><span>🔗</span> {promo.clicks || 0} Clicks</div>
                                </div>
                                {promo.status === 'ACTIVE' && promo.startDate && promo.endDate && (
                                    <div className="meta-text" style={{ marginTop: '8px', fontSize: '0.75rem' }}>
                                        {new Date(promo.startDate).toLocaleDateString()} - {new Date(promo.endDate).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                            <div className="card-actions">
                                {promo.status === 'PENDING' && (
                                    <>
                                        <button className="btn-approve" onClick={() => handleAction(promo.id, 'approve')}>Approve</button>
                                        <button className="btn-reject" onClick={() => handleAction(promo.id, 'reject')}>Reject</button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {promotions.length === 0 && <div className="empty-state">No boost requests found</div>}
                </div>
            )}
        </div>
    );
};

const CreateBroadcastModal = ({ onClose, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [sectorTargeting, setSectorTargeting] = useState([]);
    const [region, setRegion] = useState('');
    const [loading, setLoading] = useState(false);

    // Rich Media State
    const [images, setImages] = useState([]); // File objects
    const [video, setVideo] = useState(null); // File object
    const [previews, setPreviews] = useState([]);
    const [videoPreview, setVideoPreview] = useState(null);

    // Verification check
    const [verificationStatus, setVerificationStatus] = useState('LOADING');

    useEffect(() => {
        apiCall('/profile').then(data => {
            setVerificationStatus(data.profile?.businessProfile?.verificationStatus || 'UNVERIFIED');
        }).catch(() => setVerificationStatus('UNVERIFIED'));
    }, []);

    const sectors = ['TRAVELER', 'TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files).slice(0, 4 - images.length);
        if (files.length === 0) return;

        setImages(prev => [...prev, ...files]);
        const newPreviews = files.map(f => URL.createObjectURL(f));
        setPreviews(prev => [...prev, ...newPreviews]);
    };

    const handleVideoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setVideo(file);
        setVideoPreview(URL.createObjectURL(file));
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('title', title);
            fd.append('message', message);
            fd.append('sectorTargeting', JSON.stringify(sectorTargeting));
            fd.append('region', region);

            if (video) fd.append('video', video);
            images.forEach(img => fd.append('images', img));

            // Use fetch directly for FormData to avoid apiCall JSON stringify
            const res = await fetch(`${API_BASE}/admin/broadcasts`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${getToken()}`,
                },
                body: fd
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Send failed');

            onSuccess();
            onClose();
        } catch (err) {
            alert('Failed to send broadcast: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSector = (s) => {
        if (sectorTargeting.includes(s)) setSectorTargeting(sectorTargeting.filter(x => x !== s));
        else setSectorTargeting([...sectorTargeting, s]);
    };

    if (verificationStatus === 'LOADING') return <div className="admin-modal-overlay"><div className="admin-modal">Loading account status...</div></div>;

    if (verificationStatus !== 'APPROVED') {
        return (
            <div className="admin-modal-overlay" onClick={onClose}>
                <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                    <h2>Verification Required</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        Only verified businesses can send network broadcasts.
                        Please complete your verification in the "Verifications" tab or settings.
                    </p>
                    <div className="modal-footer" style={{ justifyContent: 'center' }}>
                        <button className="btn-primary" onClick={onClose}>Understood</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Compose Network Broadcast</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit} className="admin-form">
                    <div className="form-group">
                        <label>Broadcast Title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Platform Update: New Features" required />
                    </div>
                    <div className="form-group">
                        <label>Announcement Message</label>
                        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Write your announcement here..." rows={4} />
                    </div>

                    <div className="form-row" style={{ display: 'flex', gap: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Images (Max 4)</label>
                            <input type="file" accept="image/*" multiple onChange={handleImageChange} disabled={images.length >= 4} />
                            <div className="media-previews" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                {previews.map((p, i) => (
                                    <div key={i} className="preview-item" style={{ position: 'relative' }}>
                                        <img src={p} alt="" style={{ width: 60, height: 60, borderRadius: 4, objectFit: 'cover' }} />
                                        <button type="button" onClick={() => removeImage(i)} style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', border: 'none', width: 18, height: 18, fontSize: 10, cursor: 'pointer' }}>✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Video (Optional)</label>
                            <input type="file" accept="video/*" onChange={handleVideoChange} />
                            {videoPreview && <video src={videoPreview} style={{ width: '100%', height: 60, marginTop: 8, borderRadius: 4, background: '#000' }} controls />}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Sector Targeting (Empty for all)</label>
                        <div className="targeting-chips">
                            {sectors.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    className={`target-chip ${sectorTargeting.includes(s) ? 'active' : ''}`}
                                    onClick={() => toggleSector(s)}
                                >
                                    {s.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Region/Country Targeting (Optional)</label>
                        <input value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Kenya" />
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Sending...' : '🚀 Send Broadcast Now'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Broadcasts ─────────────────────────────────────────────────────────────
const BroadcastsTab = () => {
    const [broadcasts, setBroadcasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    const loadBroadcasts = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiCall('/admin/broadcasts');
            setBroadcasts(data.broadcasts || []);
        } catch (err) {
            console.error('Failed to load broadcasts', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadBroadcasts(); }, [loadBroadcasts]);

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this broadcast?')) return;
        try {
            await apiCall(`/admin/broadcasts/${id}`, { method: 'DELETE' });
            loadBroadcasts();
        } catch (err) { alert('Delete failed'); }
    };

    return (
        <div className="tab-pane">
            {showCreate && <CreateBroadcastModal onClose={() => setShowCreate(false)} onSuccess={loadBroadcasts} />}
            <div className="tab-header">
                <h2>Network Broadcasts</h2>
                <div className="tab-actions">
                    <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Broadcast</button>
                </div>
            </div>
            {loading ? <div className="loading-state">Loading broadcasts...</div> : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Sender</th>
                                <th>Message</th>
                                <th>Targets</th>
                                <th>Viewed</th>
                                <th>Sent At</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {broadcasts.map(b => (
                                <tr key={b.id}>
                                    <td>@{b.sender?.profile?.handle || 'Admin'}</td>
                                    <td>
                                        <div className="post-title" title={b.post?.description}>{b.post?.title || 'No Title'}</div>
                                        <div className="meta-text" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                                            {b.sectorTargeting?.length ? b.sectorTargeting.join(', ') : 'All Sectors'}
                                        </div>
                                    </td>
                                    <td>{b.targetCount}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>{b.viewedCount}</span>
                                            <div className="progress-bar-small">
                                                <div className="progress-fill" style={{ width: `${b.viewRate}%` }}></div>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{b.viewRate}%</span>
                                        </div>
                                    </td>
                                    <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <button className="btn-icon danger" onClick={() => handleDelete(b.id)} title="Delete">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {broadcasts.length === 0 && <div className="empty-state">No broadcasts found</div>}
                </div>
            )}
        </div>
    );
};

// ─── Reports ─────────────────────────────────────────────────────────────
const ReportsTab = () => {
    const [reports, setReports] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('PENDING');
    const [entityFilter, setEntityFilter] = useState('');
    const [actionLoading, setActionLoading] = useState(null);

    const loadReports = useCallback(async () => {
        try {
            setLoading(true);
            const q = new URLSearchParams({ page, limit: 15, status: statusFilter });
            if (entityFilter) q.set('entityType', entityFilter);
            const data = await apiCall(`/admin/reports?${q}`);
            setReports(data.reports || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to load reports', err);
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, entityFilter]);

    useEffect(() => { loadReports(); }, [loadReports]);

    const handleAction = async (reportId, action, reason) => {
        if (!window.confirm(`Perform "${action}" on this ${reports.find(r => r.id === reportId)?.entityType}?`)) return;
        setActionLoading(reportId + action);
        try {
            if (action === 'RESOLVE') {
                await apiCall(`/admin/reports/${reportId}/resolve`, { method: 'PUT' });
            } else {
                await apiCall('/admin/moderation/action', {
                    method: 'POST',
                    body: JSON.stringify({ reportId, action, reason })
                });
            }
            // Move item out of current list if it's pending
            if (statusFilter === 'PENDING') {
                setReports(prev => prev.filter(r => r.id !== reportId));
                setTotal(prev => prev - 1);
            } else {
                loadReports();
            }
            alert('Action completed successfully.');
        } catch (err) {
            alert('Action failed: ' + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="tab-pane">
            <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Moderation Center</h2>
                    <p>{total} {statusFilter.toLowerCase()} reports requiring attention</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <select
                        value={entityFilter}
                        onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
                        className="admin-select"
                    >
                        <option value="">All Types</option>
                        <option value="POST">Videos</option>
                        <option value="COMMENT">Comments</option>
                        <option value="USER">Profiles</option>
                    </select>
                    <div className="status-toggle" style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 20, padding: 4, border: '1px solid var(--border-primary)' }}>
                        {['PENDING', 'RESOLVED', 'ACTION_TAKEN'].map(s => (
                            <button
                                key={s}
                                className={`pill-btn ${statusFilter === s ? 'active' : ''}`}
                                onClick={() => { setStatusFilter(s); setPage(1); }}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: 16,
                                    border: 'none',
                                    background: statusFilter === s ? 'var(--accent-primary)' : 'transparent',
                                    color: statusFilter === s ? 'white' : 'var(--text-secondary)',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                {s.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? <div className="loading-state">Loading reports...</div> : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Reporter</th>
                                <th>Reason</th>
                                <th>Reported Content</th>
                                <th>Created</th>
                                {statusFilter === 'PENDING' && <th>Quick Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map(r => (
                                <tr key={r.id}>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{r.reporter?.displayName || 'Traveler'}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{r.reporter?.username}</div>
                                    </td>
                                    <td><Badge type={r.reason} small /></td>
                                    <td>
                                        <div className="entity-summary">
                                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: 4 }}>{r.entityType}</div>
                                            {r.entityType === 'POST' && (
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    {r.post?.thumbnailUrl && <img src={r.post.thumbnailUrl} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />}
                                                    <div>
                                                        <div className="post-title">{r.post?.title || 'Video Title'}</div>
                                                        <a href={`/post/${r.entityId}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent-primary)' }}>View Video ↗</a>
                                                    </div>
                                                </div>
                                            )}
                                            {r.entityType === 'COMMENT' && r.comment && (
                                                <div style={{ background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 8, borderLeft: '3px solid var(--border-primary)' }}>
                                                    <div style={{ fontStyle: 'italic', fontSize: 13 }}>"{r.comment.content}"</div>
                                                    <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-secondary)' }}>by @{r.comment.user?.username}</div>
                                                </div>
                                            )}
                                            {r.entityType === 'USER' && r.reportedUser && (
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <div className="admin-avatar" style={{ width: 32, height: 32, fontSize: 14 }}>👤</div>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>{r.reportedUser.displayName}</div>
                                                        <a href={`/profile/${r.reportedUser.username}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent-primary)' }}>View Profile ↗</a>
                                                    </div>
                                                </div>
                                            )}
                                            {r.detail && (
                                                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                                                    <strong>Reporter's Detail:</strong> {r.detail}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleString()}</td>
                                    {statusFilter === 'PENDING' && (
                                        <td>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    className="btn-outline success"
                                                    style={{ padding: '6px 12px', fontSize: 11 }}
                                                    onClick={() => handleAction(r.id, 'RESOLVE')}
                                                    disabled={!!actionLoading}
                                                >
                                                    Mark OK
                                                </button>
                                                <button
                                                    className="btn-reject"
                                                    style={{ padding: '6px 12px', fontSize: 11 }}
                                                    onClick={() => handleAction(r.id, 'TAKE_DOWN')}
                                                    disabled={!!actionLoading}
                                                >
                                                    {r.entityType === 'USER' ? 'Block (User)' : 'Take Down'}
                                                </button>
                                                {r.entityType !== 'USER' && (
                                                    <button
                                                        className="btn-reject"
                                                        style={{ padding: '6px 12px', fontSize: 11, background: '#7c3aed' }}
                                                        onClick={() => handleAction(r.id, 'SUSPEND_USER')}
                                                        disabled={!!actionLoading}
                                                    >
                                                        Suspend Author
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {reports.length === 0 && (
                        <div className="empty-state">
                            <div style={{ fontSize: 40, marginBottom: 16 }}>🛡️</div>
                            <h3>All Clear!</h3>
                            <p>No {statusFilter.toLowerCase()} reports at the moment.</p>
                        </div>
                    )}
                </div>
            )}
            <Pagination page={page} totalPages={Math.ceil(total / 15)} onChange={setPage} />
        </div>
    );
};

// ─── Publish Tab ─────────────────────────────────────────────────────────────
const PublishTab = () => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [postType, setPostType] = useState('STANDARD');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (postType === 'BROADCAST') {
                await apiCall('/admin/broadcasts', {
                    method: 'POST',
                    body: JSON.stringify({ title, message: content, sectorTargeting: [], region: '' }),
                });
            } else {
                // Publish as standard post
                await apiCall('/posts', {
                    method: 'POST',
                    body: JSON.stringify({
                        title,
                        description: content,
                        videoUrl: videoUrl || '',
                        duration: 0,
                        postType: 'STANDARD'
                    }),
                });
            }
            setTitle(''); setContent(''); setVideoUrl('');
            alert('Published successfully!');
        } catch (err) { alert('Failed: ' + err.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="tab-content">
            <div className="section-header">
                <h2>Official Publishing</h2>
                <p>Publish news, updates, or announcements as the official Travelpod account.</p>
            </div>

            <div className="publish-form-container">
                <form onSubmit={handleSubmit} className="admin-form full-width">
                    <div className="form-grid">
                        <div className="form-main">
                            <div className="form-group">
                                <label>Post Title</label>
                                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Main headline..." required />
                            </div>
                            <div className="form-group">
                                <label>Content</label>
                                <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="What's happening?" required rows={10} />
                            </div>
                        </div>
                        <div className="form-sidebar-box">
                            <div className="form-group">
                                <label>Post Type</label>
                                <select value={postType} onChange={e => setPostType(e.target.value)} className="admin-select">
                                    <option value="STANDARD">Standard Post (Feed)</option>
                                    <option value="BROADCAST">Network Broadcast (Inbox)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Video URL (Optional)</label>
                                <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://..." />
                            </div>
                            <button type="submit" className="login-btn" style={{ marginTop: 20, width: '100%' }} disabled={loading}>
                                {loading ? 'Publishing...' : '🚀 Publish Now'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

const HistoryTab = () => {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const loadLogs = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiCall(`/admin/logs?page=${page}&limit=20`);
            setLogs(data.logs || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to load logs', err);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { loadLogs(); }, [loadLogs]);

    return (
        <div className="tab-pane">
            <div className="tab-header">
                <h2>Administrative Audit Logs</h2>
                <p>History of all actions taken by administrators on the platform</p>
            </div>

            {loading ? <div className="loading-state">Loading history...</div> : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Admin</th>
                                <th>Action</th>
                                <th>Target</th>
                                <th>Detail/Reason</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{log.admin?.displayName || 'Admin'}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.admin?.email}</div>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${log.actionType.toLowerCase().includes('removal') ? 'rejected' : 'verified'}`} style={{ fontSize: 10 }}>
                                            {log.actionType.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: 12, fontWeight: 500 }}>{log.targetEntityType || 'ACCOUNT'}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{log.targetEntityId || log.targetAccountId}</div>
                                    </td>
                                    <td style={{ maxWidth: 240 }}>
                                        <div style={{ fontSize: 13 }}>{log.reason}</div>
                                        {log.durationDays && <div style={{ fontSize: 11, color: 'var(--orange)' }}>Duration: {log.durationDays} days</div>}
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(log.createdAt).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {logs.length === 0 && <div className="empty-state">No history recorded yet.</div>}
                </div>
            )}
            <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} />
        </div>
    );
};

// ─── Feature Flags Management ──────────────────────────────────────────────────
const FeatureFlagsTab = () => {
    const [flags, setFlags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const loadFlags = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiCall('/features');
            setFlags(data.features || []);
        } catch (err) {
            console.error('Failed to load flags', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadFlags(); }, [loadFlags]);

    const toggleFlag = async (name, currentStatus) => {
        setActionLoading(name);
        try {
            await apiCall(`/features/${name}`, {
                method: 'PATCH',
                body: JSON.stringify({ isEnabled: !currentStatus })
            });
            setFlags(prev => prev.map(f => f.name === name ? { ...f, isEnabled: !currentStatus } : f));
        } catch (err) {
            alert('Action failed: ' + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="tab-pane">
            <div className="tab-header">
                <h2>Feature Flags</h2>
                <p>Manage beta features and platform capabilities</p>
            </div>
            {loading ? <div className="loading-state">Loading flags...</div> : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Feature Name</th>
                                <th>Description</th>
                                <th>Status</th>
                                <th>Last Updated</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flags.map(flag => (
                                <tr key={flag.id}>
                                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{flag.name}</td>
                                    <td style={{ maxWidth: 300 }}>{flag.description}</td>
                                    <td>
                                        <Badge type={flag.isEnabled ? 'APPROVED' : 'REMOVED'} small />
                                    </td>
                                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(flag.updatedAt).toLocaleString()}</td>
                                    <td>
                                        <button
                                            className={flag.isEnabled ? 'btn-reject' : 'btn-approve'}
                                            onClick={() => toggleFlag(flag.name, flag.isEnabled)}
                                            disabled={actionLoading === flag.name}
                                            style={{ padding: '6px 12px', fontSize: 11 }}
                                        >
                                            {actionLoading === flag.name ? '...' : flag.isEnabled ? 'Disable' : 'Enable'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {flags.length === 0 && <div className="empty-state">No feature flags defined.</div>}
                </div>
            )}
        </div>
    );
};

// ─── Collaborations Overview ──────────────────────────────────────────────────
const CollaborationsTab = () => {
    const [collabs, setCollabs] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadCollabs = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiCall('/admin/collaborations');
            setCollabs(data.collaborations || []);
        } catch (err) {
            console.error('Failed to load collaborations', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadCollabs(); }, [loadCollabs]);

    return (
        <div className="tab-pane">
            <div className="tab-header">
                <h2>Collaborations Overview</h2>
                <p>Monitor collaboration requests between creators and businesses</p>
            </div>
            {loading ? <div className="loading-state">Loading collaborations...</div> : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Initiator</th>
                                <th>Receiver</th>
                                <th>Proposal Snippet</th>
                                <th>Compensation</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {collabs.map(collab => (
                                <tr key={collab.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{collab.initiator?.displayName}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{collab.initiator?.username}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{collab.receiver?.displayName}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{collab.receiver?.username}</div>
                                    </td>
                                    <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {collab.proposal}
                                    </td>
                                    <td>
                                        <Badge type={collab.compensationType} small />
                                    </td>
                                    <td>
                                        <Badge type={collab.status === 'ACCEPTED' ? 'APPROVED' : collab.status === 'COMPLETED' ? 'COMPLETED' : collab.status} small />
                                    </td>
                                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(collab.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {collabs.length === 0 && <div className="empty-state">No collaborations initiated yet.</div>}
                </div>
            )}
        </div>
    );
};

// ─── Gamification & Badges ────────────────────────────────────────────────────
const BadgesTab = () => {
    const [badges, setBadges] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadBadges = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiCall('/badges/all');
            setBadges(data.badges || []);
        } catch (err) {
            console.error('Failed to load badges', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadBadges(); }, [loadBadges]);

    return (
        <div className="tab-pane">
            <div className="tab-header">
                <h2>Gamification Badges</h2>
                <p>View platform badges available to users</p>
            </div>
            {loading ? <div className="loading-state">Loading badges...</div> : (
                <div className="cards-grid">
                    {badges.map(badge => (
                        <div key={badge.id} className="admin-card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            <div style={{ fontSize: '3rem' }}>{badge.icon}</div>
                            <div>
                                <h3 style={{ margin: '0 0 4px 0' }}>{badge.name}</h3>
                                <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{badge.description}</p>
                                <span className={`badge badge-${badge.tier.toLowerCase()}`} style={{ fontSize: 10 }}>{badge.tier}</span>
                            </div>
                        </div>
                    ))}
                    {badges.length === 0 && <div className="empty-state">No badges seeded yet.</div>}
                </div>
            )}
        </div>
    );
};

// ─── Main Admin App ───────────────────────────────────────────────────────────
export default function AdminPage() {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('admin_user');
        if (!stored) return null;
        try {
            const parsed = JSON.parse(stored);
            if (!['ADMIN', 'ASSOCIATION'].includes(parsed.accountType)) return null;
            if (!localStorage.getItem('admin_token')) return null;
            return parsed;
        } catch (e) { return null; }
    });
    const [activeTab, setActiveTab] = useState('dashboard');

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        setUser(null);
    };

    if (!user) return <LoginScreen onLogin={setUser} />;

    const isAdmin = user.accountType === 'ADMIN';

    const tabs = [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'publish', icon: '✍️', label: 'Publish', adminOnly: true },
        { id: 'moderation', icon: '🛡️', label: 'Content', adminOnly: true },
        { id: 'reports', icon: '🚩', label: 'Reports / Hub', adminOnly: true },
        { id: 'history', icon: '📜', label: 'Audit Trail', adminOnly: true },
        { id: 'promotions', icon: '🚀', label: 'Boosts & Promoted' },
        { id: 'collaborations', icon: '🤝', label: 'Collaborations', adminOnly: true },
        { id: 'badges', icon: '🏆', label: 'Badges', adminOnly: true },
        { id: 'broadcasts', icon: '📢', label: 'Broadcasts' },
        { id: 'boards', icon: '📁', label: 'Trip Boards', adminOnly: true },
        { id: 'users', icon: '👥', label: 'Users', adminOnly: true },
        { id: 'verifications', icon: '✓', label: 'Verifications' },
        { id: 'features', icon: '⚙️', label: 'Feature Flags', adminOnly: true },
    ].filter(t => isAdmin || !t.adminOnly);

    return (
        <div className="admin-app">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <div className="brand-icon">✈</div>
                    <div>
                        <div className="brand-name">Travelpod</div>
                        <div className="brand-sub">Admin Console</div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="nav-icon">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="admin-info">
                        <div className="admin-avatar">👑</div>
                        <div>
                            <div className="admin-label">Administrator</div>
                            <div className="admin-email">{user.email}</div>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
                </div>
            </aside>

            {/* Main content */}
            <main className="admin-main">
                <div className="admin-topbar">
                    <h1 className="page-title">
                        {tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}
                    </h1>
                    <div className="topbar-meta">
                        <span className="topbar-time">{new Date().toDateString()}</span>
                    </div>
                </div>

                <div className="admin-content">
                    {activeTab === 'dashboard' && <DashboardTab />}
                    {activeTab === 'publish' && <PublishTab />}
                    {activeTab === 'moderation' && <ContentManagementTab />}
                    {activeTab === 'promotions' && <PromotedPostsTab />}
                    {activeTab === 'broadcasts' && <BroadcastsTab />}
                    {activeTab === 'boards' && <TripBoardsTab />}
                    {activeTab === 'users' && <UsersTab />}
                    {activeTab === 'verifications' && <VerificationTab />}
                    {activeTab === 'reports' && <ReportsTab />}
                    {activeTab === 'history' && <HistoryTab />}
                    {activeTab === 'features' && <FeatureFlagsTab />}
                    {activeTab === 'collaborations' && <CollaborationsTab />}
                    {activeTab === 'badges' && <BadgesTab />}
                </div>
            </main>
        </div>
    );
}
