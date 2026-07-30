import React, { useState, useEffect } from 'react';
import './SettingsPage.css';
import useAuthStore from "./../../../store/useAuthStore";
import { apiUrl } from '../../../utils/api';

export function SettingsPage() {
    const user = useAuthStore(state => state.user);
    const token = useAuthStore(state => state.token);
    const setLastActiveBusinessId = useAuthStore(state => state.setLastActiveBusinessId);
    const updateUser = useAuthStore(state => state.updateUser);
    const logout = useAuthStore(state => state.logout);

    const username = user?.username ?? 'User';

    const [newUsername, setNewUsername] = useState('');
    const [businesses, setBusinesses] = useState([]);
    const [newBusinessName, setNewBusinessName] = useState('');
    const [selectedBusinessId, setSelectedBusinessId] = useState(user?.lastActiveBusinessId || null);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [newBankDetails, setNewBankDetails] = useState({ bank_name: '', account_nickname: '', account_last_four: '' });

    // Team & Audit State
    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('viewer');
    const [inviteMessage, setInviteMessage] = useState(null);
    const [acceptToken, setAcceptToken] = useState('');
    const [acceptMessage, setAcceptMessage] = useState(null);

    // Fetch initial settings data
    useEffect(() => {
        const fetchData = async () => {
            if (!token) return;
            try {
                const res = await fetch(apiUrl('/settings/data'), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setBusinesses(data.businesses || []);
                    setBankAccounts(data.bankAccounts || []);

                    if (data.businesses && data.businesses.length > 0) {
                        const currentActive = user?.lastActiveBusinessId;
                        const activeExists = data.businesses.some(b => b.id === currentActive);
                        if (!activeExists) {
                            setSelectedBusinessId(data.businesses[0].id);
                            setLastActiveBusinessId(data.businesses[0].id, data.businesses[0].business_name);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching settings data:', error);
            }
        };
        fetchData();
    }, [token, user?.lastActiveBusinessId, setLastActiveBusinessId]);

    // Fetch Team Members, Invitations & Audit Logs whenever selectedBusinessId changes
    useEffect(() => {
        if (!token || !selectedBusinessId) return;

        const fetchTeamAndAudit = async () => {
            try {
                // Fetch members
                const mRes = await fetch(apiUrl(`/team/members?businessId=${selectedBusinessId}`), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (mRes.ok) {
                    const mData = await mRes.json();
                    setMembers(mData.members || []);
                }

                // Fetch pending invitations
                const iRes = await fetch(apiUrl(`/team/invitations?businessId=${selectedBusinessId}`), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (iRes.ok) {
                    const iData = await iRes.json();
                    setInvitations(iData.invitations || []);
                }

                // Fetch audit logs
                const aRes = await fetch(apiUrl(`/team/audit-logs?businessId=${selectedBusinessId}`), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (aRes.ok) {
                    const aData = await aRes.json();
                    setAuditLogs(aData.logs || []);
                }
            } catch (err) {
                console.error('Error loading team & audit data:', err);
            }
        };

        fetchTeamAndAudit();
    }, [token, selectedBusinessId]);

    // --- Handlers ---
    const handleUpdateUsername = async () => {
        if (!newUsername) return;
        try {
            const res = await fetch(apiUrl('/settings/username'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username: newUsername })
            });
            if (res.ok) {
                updateUser({ username: newUsername });
                setNewUsername('');
            }
        } catch (error) {
            console.error('Error updating username:', error);
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm("Are you sure you want to permanently delete your account?")) {
            try {
                const res = await fetch(apiUrl('/settings/account'), {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    logout();
                }
            } catch (error) {
                console.error('Error deleting account:', error);
            }
        }
    };

    const handleAddBusiness = async () => {
        if (!newBusinessName) return;
        try {
            const res = await fetch(apiUrl('/settings/business'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ business_name: newBusinessName })
            });
            if (res.ok) {
                const data = await res.json();
                const newBiz = { id: data.id, business_name: data.business_name, user_id: data.user_id };
                setBusinesses([...businesses, newBiz]);

                if (!selectedBusinessId) {
                    setSelectedBusinessId(newBiz.id);
                    setLastActiveBusinessId(newBiz.id, newBiz.business_name);
                }
                setNewBusinessName('');
            }
        } catch (error) {
            console.error('Error adding business:', error);
        }
    };

    const handleDeleteBusiness = async (id) => {
        if (window.confirm("Are you sure? This will delete the business and all linked bank accounts.")) {
            try {
                const res = await fetch(apiUrl(`/settings/business/${id}`), {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const updatedBusinesses = businesses.filter(biz => biz.id !== id);
                    setBusinesses(updatedBusinesses);

                    if (selectedBusinessId === id) {
                        const nextActiveBusiness = updatedBusinesses.length > 0 ? updatedBusinesses[0] : null;
                        const nextActiveBusinessId = nextActiveBusiness ? nextActiveBusiness.id : null;
                        setSelectedBusinessId(nextActiveBusinessId);
                        setLastActiveBusinessId(nextActiveBusinessId, nextActiveBusiness ? nextActiveBusiness.business_name : null);
                    }

                    setBankAccounts(bankAccounts.filter(acc => acc.business_id !== id));
                }
            } catch (error) {
                console.error('Error deleting business:', error);
            }
        }
    };

    const handleAddBankAccount = async () => {
        if (!newBankDetails.bank_name || !selectedBusinessId) return;
        try {
            const res = await fetch(apiUrl('/settings/bank-account'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    business_id: selectedBusinessId,
                    ...newBankDetails
                })
            });
            if (res.ok) {
                const data = await res.json();
                setBankAccounts([...bankAccounts, {
                    id: data.id,
                    business_id: data.business_id,
                    bank_name: data.bank_name,
                    account_nickname: data.account_nickname,
                    account_last_four: data.account_last_four
                }]);
                setNewBankDetails({ bank_name: '', account_nickname: '', account_last_four: '' });
            }
        } catch (error) {
            console.error('Error adding bank account:', error);
        }
    };

    const handleDeleteBankAccount = async (id) => {
        try {
            const res = await fetch(apiUrl(`/settings/bank-account/${id}`), {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setBankAccounts(bankAccounts.filter(acc => acc.id !== id));
            }
        } catch (error) {
            console.error('Error deleting bank account:', error);
        }
    };

    const handleInviteMember = async () => {
        if (!inviteEmail || !selectedBusinessId) return;
        setInviteMessage(null);
        try {
            const res = await fetch(apiUrl('/team/invite'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    businessId: selectedBusinessId,
                    email: inviteEmail,
                    role: inviteRole
                })
            });
            const data = await res.json();
            if (res.ok) {
                setInviteMessage({ type: 'success', text: `Invitation token created for ${inviteEmail}: ${data.invitation.token}` });
                setInvitations([data.invitation, ...invitations]);
                setInviteEmail('');
            } else {
                setInviteMessage({ type: 'error', text: data.message || 'Failed to send invitation' });
            }
        } catch (err) {
            console.error('Error sending invitation:', err);
            setInviteMessage({ type: 'error', text: 'Error creating invitation' });
        }
    };

    const handleAcceptInvite = async () => {
        if (!acceptToken) return;
        setAcceptMessage(null);
        try {
            const res = await fetch(apiUrl('/team/accept-invite'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token: acceptToken })
            });
            const data = await res.json();
            if (res.ok) {
                setAcceptMessage({ type: 'success', text: 'Invitation accepted! Business added to your access list.' });
                setAcceptToken('');
                // Refresh data
                window.location.reload();
            } else {
                setAcceptMessage({ type: 'error', text: data.message || 'Invalid or expired token' });
            }
        } catch (err) {
            setAcceptMessage({ type: 'error', text: 'Error accepting invitation' });
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm("Remove this user's access from the business?")) return;
        try {
            const res = await fetch(apiUrl(`/team/members/${userId}?businessId=${selectedBusinessId}`), {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setMembers(members.filter(m => m.user_id !== userId));
            }
        } catch (err) {
            console.error('Error removing member:', err);
        }
    };

    const handleActiveBusinessChange = (e) => {
        const businessId = Number(e.target.value);
        const selectedBusiness = businesses.find((biz) => biz.id === businessId);
        setSelectedBusinessId(businessId);
        setLastActiveBusinessId(businessId, selectedBusiness ? selectedBusiness.business_name : null);
    };

    // --- Derived Data ---
    const activeBusinessBankAccounts = bankAccounts.filter(acc => acc.business_id === selectedBusinessId);

    return (
        <div className="settings-container">
            {/* 1. Account Settings */}
            <section className="settings-section">
                <h3>Account Settings</h3>
                <div className="form-group">
                    <label>Current Username: {username}</label>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="New Username"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                        />
                        <button onClick={handleUpdateUsername} className="btn-primary">Update</button>
                    </div>
                </div>

                {/* Redeem Invitation */}
                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                    <label><strong>Have an Invitation Token?</strong></label>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Enter 64-char invitation token"
                            value={acceptToken}
                            onChange={(e) => setAcceptToken(e.target.value)}
                        />
                        <button onClick={handleAcceptInvite} className="btn-primary">Accept Invite</button>
                    </div>
                    {acceptMessage && (
                        <p style={{ color: acceptMessage.type === 'error' ? 'red' : 'green', marginTop: '0.5rem' }}>
                            {acceptMessage.text}
                        </p>
                    )}
                </div>

                <div className="form-group danger-zone" style={{ marginTop: '1.5rem' }}>
                    <button onClick={handleDeleteAccount} className="btn-danger">Delete Account</button>
                </div>
            </section>

            {/* 2. Business Management */}
            <section className="settings-section">
                <h3>Manage Businesses</h3>

                {/* Active Business Selector */}
                <div className="business-selector" style={{ marginBottom: '1.5rem' }}>
                    <label><strong>Select Active Business (Site-Wide):</strong></label>
                    {businesses.length === 0 ? (
                        <p style={{ color: 'red', marginTop: '0.5rem' }}>No businesses found. Please add one below.</p>
                    ) : (
                        <select
                            value={selectedBusinessId || ''}
                            onChange={handleActiveBusinessChange}
                        >
                            {businesses.map(biz => (
                                <option key={biz.id} value={biz.id}>{biz.business_name}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Business List */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label><strong>Your Businesses:</strong></label>
                    <ul className="settings-list" style={{ marginTop: '0.5rem' }}>
                        {businesses.map(biz => (
                            <li key={biz.id} className="settings-list-item">
                                <span>
                                    {biz.business_name}
                                    {selectedBusinessId === biz.id && <span className="badge-active">Active</span>}
                                </span>
                                <button onClick={() => handleDeleteBusiness(biz.id)} className="btn-danger-small">Remove</button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Add Business Form */}
                <div className="add-form-container">
                    <h4>Add New Business</h4>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="New Business Name"
                            value={newBusinessName}
                            onChange={(e) => setNewBusinessName(e.target.value)}
                        />
                        <button onClick={handleAddBusiness} className="btn-primary">Add</button>
                    </div>
                </div>
            </section>

            {/* 3. Team & Guests Management (RBAC) */}
            <section className="settings-section">
                <h3>Team & Guests (RBAC)</h3>
                {!selectedBusinessId ? (
                    <p style={{ color: 'red' }}>Select a business above to manage team members and viewers.</p>
                ) : (
                    <>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4>Active Members & Viewers</h4>
                            <ul className="settings-list" style={{ marginTop: '0.5rem' }}>
                                {members.map(m => (
                                    <li key={m.user_id} className="settings-list-item">
                                        <span>
                                            <strong>{m.username}</strong> ({m.email}) —{' '}
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                background: m.role === 'admin' ? '#ef4444' : m.role === 'accountant' ? '#2563eb' : '#6b7280',
                                                color: '#fff'
                                            }}>
                                                {m.role.toUpperCase()}
                                            </span>
                                            {m.is_owner ? ' (Owner)' : ''}
                                        </span>
                                        {!m.is_owner && (
                                            <button onClick={() => handleRemoveMember(m.user_id)} className="btn-danger-small">
                                                Remove
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Invite Viewers */}
                        <div className="add-form-container" style={{ marginBottom: '1.5rem' }}>
                            <h4>Invite New Guest / Viewer</h4>
                            <div className="input-group multi-input">
                                <input
                                    type="email"
                                    placeholder="Guest Email Address"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                />
                                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                                    <option value="viewer">Viewer (Read-Only)</option>
                                    <option value="accountant">Accountant (Manager)</option>
                                </select>
                                <button onClick={handleInviteMember} className="btn-primary">Send Invite</button>
                            </div>
                            {inviteMessage && (
                                <p style={{ color: inviteMessage.type === 'error' ? 'red' : 'green', marginTop: '0.5rem', wordBreak: 'break-all' }}>
                                    {inviteMessage.text}
                                </p>
                            )}
                        </div>

                        {/* Pending Invitations */}
                        {invitations.length > 0 && (
                            <div>
                                <h4>Pending Invitations</h4>
                                <ul className="settings-list" style={{ marginTop: '0.5rem' }}>
                                    {invitations.map(inv => (
                                        <li key={inv.id} className="settings-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <div>
                                                <strong>{inv.email}</strong> ({inv.role}) — Token: <code style={{ color: '#2563eb' }}>{inv.token}</code>
                                            </div>
                                            <small style={{ color: '#6b7280' }}>Invited by {inv.inviter_name}</small>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* 4. Audit Log */}
            <section className="settings-section">
                <h3>Audit Activity Log</h3>
                <p>Tracked actions for security and compliance.</p>
                {auditLogs.length === 0 ? (
                    <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>No audit activity recorded yet.</p>
                ) : (
                    <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>User</th>
                                    <th style={{ padding: '8px' }}>Action</th>
                                    <th style={{ padding: '8px' }}>Entity</th>
                                    <th style={{ padding: '8px' }}>IP Address</th>
                                    <th style={{ padding: '8px' }}>Date/Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                                        <td style={{ padding: '8px' }}>{log.username} ({log.email})</td>
                                        <td style={{ padding: '8px', fontWeight: 600, color: '#2563eb' }}>{log.action}</td>
                                        <td style={{ padding: '8px' }}>{log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}</td>
                                        <td style={{ padding: '8px' }}>{log.ip_address}</td>
                                        <td style={{ padding: '8px' }}>{new Date(log.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* 5. Bank Accounts */}
            <section className="settings-section">
                <h3>Bank Accounts</h3>
                {!selectedBusinessId ? (
                    <p style={{ color: 'red' }}>Please create and select a business to manage its bank accounts.</p>
                ) : (
                    <>
                        <p>Managing accounts for the currently active business.</p>

                        <ul className="settings-list" style={{ marginBottom: '1.5rem' }}>
                            {activeBusinessBankAccounts.map(acc => (
                                <li key={acc.id} className="settings-list-item">
                                    <span>{acc.bank_name} - {acc.account_nickname} (**** **** **** {acc.account_last_four})</span>
                                    <button onClick={() => handleDeleteBankAccount(acc.id)} className="btn-danger-small">Remove</button>
                                </li>
                            ))}
                        </ul>

                        <div className="add-form-container">
                            <h4>Add New Bank Account</h4>
                            <div className="input-group multi-input">
                                <input
                                    type="text"
                                    placeholder="Bank Name (e.g. HDFC)"
                                    value={newBankDetails.bank_name}
                                    onChange={(e) => setNewBankDetails({ ...newBankDetails, bank_name: e.target.value })}
                                />
                                <input
                                    type="text"
                                    placeholder="Nickname"
                                    value={newBankDetails.account_nickname}
                                    onChange={(e) => setNewBankDetails({ ...newBankDetails, account_nickname: e.target.value })}
                                />
                                <input
                                    type="text"
                                    maxLength="4"
                                    placeholder="Last 4 Digits"
                                    value={newBankDetails.account_last_four}
                                    onChange={(e) => setNewBankDetails({ ...newBankDetails, account_last_four: e.target.value })}
                                />
                                <button onClick={handleAddBankAccount} className="btn-primary">Add</button>
                            </div>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}