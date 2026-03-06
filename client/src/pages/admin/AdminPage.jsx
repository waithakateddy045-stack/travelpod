import { useState, useEffect, useCallback } from 'react';
import './AdminPage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── API helpers ──────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('admin_token');

const apiCall = async (endpoint, options = {}) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
            ...options.headers,
        },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            }).then(r => r.json());

            if (!data.success) throw new Error(data.message || 'Login failed');
            if (data.user.accountType !== 'ADMIN') throw new Error('Access denied — admin accounts only');

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
                    <div className="form-group">
                        <label>Admin Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                    </div>
                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Sign In to Admin Console'}
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
                                        <span>👤 @{post.user?.profile?.handle || '—'}</span>
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
                                    {post.moderationStatus === 'APPROVED' && (
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
                                        src={user.profile?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                                        alt=""
                                        className="user-avatar"
                                        onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`; }}
                                    />
                                    <div>
                                        <div className="user-name">{user.profile?.displayName || 'No Name'}</div>
                                        <div className="user-handle">@{user.profile?.handle || '—'}</div>
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

    const actDelete = async (boardId) => {
        if (!window.confirm('Are you sure you want to permanently delete this Trip Board?')) return;
        setActionLoading(boardId);
        try {
            await apiCall(`/admin/boards/${boardId}`, { method: 'DELETE' });
            setBoards(prev => prev.filter(b => b.id !== boardId));
            setTotal(prev => prev - 1);
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
                                    <div className="user-name">{board.user?.profile?.displayName || 'Unknown'}</div>
                                    <div className="user-handle" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{board.user?.profile?.handle || '—'}</div>
                                </div>
                                <div className="cell-center">{board._count?.videos ?? 0}</div>
                                <div className="cell-muted">{new Date(board.createdAt).toLocaleDateString()}</div>
                                <div>
                                    <button
                                        className="btn-reject"
                                        style={{ padding: '6px 12px', width: '100%', fontSize: 12 }}
                                        onClick={() => actDelete(board.id)}
                                        disabled={actionLoading === board.id}
                                    >
                                        {actionLoading === board.id ? '...' : 'Take Down'}
                                    </button>
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

// ─── Main Admin App ───────────────────────────────────────────────────────────
export default function AdminPage() {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('admin_user');
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        if (parsed.accountType !== 'ADMIN') return null;
        if (!localStorage.getItem('admin_token')) return null;
        return parsed;
    });
    const [activeTab, setActiveTab] = useState('dashboard');

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        setUser(null);
    };

    if (!user) return <LoginScreen onLogin={setUser} />;

    const tabs = [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'moderation', icon: '🛡️', label: 'Content' },
        { id: 'boards', icon: '📁', label: 'Trip Boards' },
        { id: 'users', icon: '👥', label: 'Users' },
        { id: 'verifications', icon: '✓', label: 'Verifications' },
    ];

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
                    {activeTab === 'moderation' && <ContentManagementTab />}
                    {activeTab === 'boards' && <TripBoardsTab />}
                    {activeTab === 'users' && <UsersTab />}
                    {activeTab === 'verifications' && <VerificationTab />}
                </div>
            </main>
        </div>
    );
}
