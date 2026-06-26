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

    // Fetch initial data
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
                <div className="form-group danger-zone">
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

            {/* 3. Bank Account Management */}
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