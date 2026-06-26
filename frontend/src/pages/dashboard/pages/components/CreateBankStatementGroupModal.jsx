import React, { useState, useEffect } from 'react';
import './CreateBankStatementGroupModal.css';
import axios from 'axios';
import useAuthStore from "../../../../store/useAuthStore";
import { apiUrl } from '../../../../utils/api';

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export function CreateBankStatementGroupModal({ isOpen, onClose, onUploadSuccess }) {
  const token = useAuthStore(state => state.token);
  const [formData, setFormData] = useState({
    name: '',
    month: months[new Date().getMonth()],
    year: currentYear,
    bankAccountId: ''
  });

  const [files, setFiles] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch bank accounts from settings API
    const fetchBankAccounts = async () => {
      try {
        const response = await axios.get(apiUrl('/settings/data'), {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        console.log('Settings data response:', response.data);
        const accounts = response.data.bankAccounts || [];
        console.log('Bank accounts found:', accounts);
        setBankAccounts(accounts);
      } catch (err) {
        console.error('Error fetching bank accounts:', err);
        setBankAccounts([]);
      }
    };
    fetchBankAccounts();
  }, []);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const csvFiles = selectedFiles.filter(file => file.type === 'text/csv' || file.name.endsWith('.csv'));

    if (csvFiles.length !== selectedFiles.length) {
      setError('Only CSV files are allowed');
    } else {
      setError('');
    }

    setFiles(csvFiles);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!files.length) {
      setError('Please select at least one CSV file');
      return;
    }

    if (!formData.bankAccountId) {
      setError('Please select a bank account');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('month', months.indexOf(formData.month) + 1);
      formDataToSend.append('year', formData.year);
      formDataToSend.append('bankAccountId', formData.bankAccountId);
      formDataToSend.append('statementCsv', files[0]); // Submit first file

      const response = await axios.post(apiUrl('/bank-statement/upload'), formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });

      console.log('Upload successful:', response.data);

      // Notify parent component of successful upload
      if (onUploadSuccess) {
        onUploadSuccess(response.data.bankStatementGroup);
      }

      // Reset form
      setFormData({
        name: '',
        month: months[new Date().getMonth()],
        year: currentYear,
        bankAccountId: ''
      });
      setFiles([]);
      onClose();
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Upload failed';
      setError(errorMessage);
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <h2>Create New Statement Group</h2>
          <button className="btn-close" onClick={onClose} disabled={loading}>&times;</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>Group Name</label>
            <input
              type="text"
              required
              placeholder="e.g., April Bankbook"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Month</label>
              <select
                className="form-select"
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                disabled={loading}
              >
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="form-group flex-1">
              <label>Year</label>
              <select
                className="form-select"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                disabled={loading}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Linked Bank Account</label>
            {bankAccounts.length === 0 ? (
              <div className="no-accounts-message">
                <p>📋 No bank accounts found!</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#666' }}>
                  Please add a bank account first in <strong>Settings → Bank Accounts</strong>
                </p>
              </div>
            ) : (
              <select
                className="form-select"
                required
                value={formData.bankAccountId}
                onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                disabled={loading}
              >
                <option value="" disabled>Select an account...</option>
                {bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_name} {acc.account_nickname && `(${acc.account_nickname})`} (•••• {acc.account_last_four || '****'})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label>Upload CSV File</label>
            <div className="file-dropzone">
              <input
                type="file"
                id="bank-statement-files"
                accept=".csv"
                onChange={handleFileChange}
                className="file-input-hidden"
                disabled={loading}
              />
              <label htmlFor="bank-statement-files" className="file-dropzone-label">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="upload-icon">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p>Click to browse CSV files</p>
                <span className="file-count">
                  {files.length > 0 ? `${files[0].name} selected` : 'No file selected'}
                </span>
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Uploading...' : 'Create Group'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}