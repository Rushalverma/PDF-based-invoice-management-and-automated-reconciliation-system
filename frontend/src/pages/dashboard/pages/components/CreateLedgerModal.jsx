import React, { useState, useEffect, useRef } from 'react';
import './CreateLedgerModal.css';
import useAuthStore from '../../../../store/useAuthStore';
import { apiUrl } from '../../../../utils/api';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export function CreateLedgerModal({ isOpen, onClose }) {
  const token = useAuthStore(state => state.token);
  const fileInputRef = useRef(null);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    month: months[new Date().getMonth()],
    year: currentYear,
    bankAccountId: ''
  });
  const [files, setFiles] = useState([]);            // selected File objects
  const [bankAccounts, setBankAccounts] = useState([]);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // null | 'uploading' | 'done'
  const [error, setError] = useState(null);

  // ── Fetch bank accounts when modal opens ────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !token) return;

    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      setError(null);
      try {
        const res = await fetch(apiUrl('/settings/data'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load bank accounts');
        const data = await res.json();
        setBankAccounts(data.bankAccounts || []);
      } catch (err) {
        setError('Could not load bank accounts. Is the server running?');
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, [isOpen, token]);

  if (!isOpen) return null;

  // ── File selection handlers ─────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(prev => {
      const existing = prev.map(f => f.name);
      const fresh = selected.filter(f => !existing.includes(f.name));
      return [...prev, ...fresh];
    });
    // Reset input so same file can be re-selected if removed
    e.target.value = '';
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => {
      const existing = prev.map(f => f.name);
      const fresh = dropped.filter(f => !existing.includes(f.name));
      return [...prev, ...fresh];
    });
  };

  const handleDragOver = (e) => e.preventDefault();

  // ── Submit: 1) create ledger  2) upload files ───────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.bankAccountId) {
      setError('Please select a bank account.');
      return;
    }

    const targetMonth = months.indexOf(formData.month) + 1;

    setSubmitting(true);

    try {
      // Step 1 — Create the ledger
      const createRes = await fetch(apiUrl('/ledger'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bankAccountId: Number(formData.bankAccountId),
          targetMonth,
          targetYear: Number(formData.year)
        })
      });

      const createData = await createRes.json();
      if (!createRes.ok || !createData.success) {
        throw new Error(createData.message || 'Failed to create ledger');
      }

      const ledgerId = createData.ledgerId;

      // Step 2 — Upload files (if any)
      if (files.length > 0) {
        setUploadProgress('uploading');

        const formPayload = new FormData();
        files.forEach(f => formPayload.append('files', f));

        const uploadRes = await fetch(`${API}/ledger/${ledgerId}/files`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formPayload
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          // Ledger was created — warn but don't block
          console.warn('File upload failed:', uploadData.message);
          setError(`Ledger created, but file upload failed: ${uploadData.message}`);
          setUploadProgress(null);
          setSubmitting(false);
          return;
        }

        setUploadProgress('done');
      }

      // All done — close modal (parent re-fetches ledger list)
      onClose();

    } catch (err) {
      console.error('Create ledger error:', err);
      setError(err.message || 'Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    if (ext === 'csv') return '📋';
    return '📁';
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <h2>Create New Ledger</h2>
          <button className="btn-close" onClick={onClose} disabled={submitting}>&times;</button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="modal-error-banner">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <form className="modal-form" onSubmit={handleSubmit}>

          {/* Month + Year */}
          <div className="form-row">
            <div className="form-group flex-1">
              <label>Month</label>
              <select
                className="form-select"
                value={formData.month}
                onChange={e => setFormData({ ...formData, month: e.target.value })}
                disabled={submitting}
              >
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Year</label>
              <select
                className="form-select"
                value={formData.year}
                onChange={e => setFormData({ ...formData, year: e.target.value })}
                disabled={submitting}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Bank Account */}
          <div className="form-group">
            <label>Linked Bank Account</label>
            <select
              className="form-select"
              required
              value={formData.bankAccountId}
              onChange={e => setFormData({ ...formData, bankAccountId: e.target.value })}
              disabled={loadingAccounts || submitting}
            >
              <option value="" disabled>
                {loadingAccounts ? 'Loading accounts...' : 'Select an account...'}
              </option>
              {bankAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.bank_name}
                  {acc.account_nickname ? ` (${acc.account_nickname})` : ''}
                  {acc.account_last_four ? ` •••• ${acc.account_last_four}` : ''}
                </option>
              ))}
            </select>
            {!loadingAccounts && bankAccounts.length === 0 && !error && (
              <small className="form-hint">
                No bank accounts found — add one in Settings first.
              </small>
            )}
          </div>

          {/* File Upload */}
          <div className="form-group">
            <label>Upload Files <span className="label-optional">(PDF, Excel, CSV — optional)</span></label>

            {/* Drop zone */}
            <div
              className={`file-dropzone ${submitting ? 'dropzone-disabled' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => !submitting && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="ledger-files"
                multiple
                accept=".pdf,.csv,.xls,.xlsx"
                onChange={handleFileChange}
                className="file-input-hidden"
                disabled={submitting}
              />
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                strokeLinejoin="round" className="upload-icon">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p>Click to browse or drag files here</p>
              <span className="file-count">
                {files.length > 0 ? `${files.length} file(s) selected` : 'No files selected'}
              </span>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <ul className="file-list">
                {files.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="file-list-item">
                    <span className="file-icon">{getFileIcon(file.name)}</span>
                    <span className="file-name" title={file.name}>{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      className="file-remove-btn"
                      onClick={() => removeFile(i)}
                      disabled={submitting}
                      title="Remove file"
                    >✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Progress indicator */}
          {uploadProgress === 'uploading' && (
            <p className="upload-status uploading">⏳ Uploading {files.length} file(s)...</p>
          )}

          {/* Actions */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={submitting || loadingAccounts}
            >
              {submitting
                ? (uploadProgress === 'uploading' ? 'Uploading...' : 'Creating...')
                : 'Create Ledger'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}