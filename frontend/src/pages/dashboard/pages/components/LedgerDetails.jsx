import { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import useAuthStore from "../../../../store/useAuthStore";
import "./LedgerDetails.css";
import { apiUrl } from '../../../../utils/api';

export function LedgerDetails() {
    const { id } = useParams();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const token = useAuthStore((state) => state.token);
    const fileInputRef = useRef(null);
    const [showAddEntryModal, setShowAddEntryModal] = useState(false);
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    /* ── Fetch records ── */
    useEffect(() => {
        const fetchRecords = async () => {
            if (!token) return;
            try {
                setLoading(true);
                const response = await fetch(apiUrl(`/ledger/${id}/records`), {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await response.json();
                if (data.success) {
                    const formatted = data.data.map(record => ({
                        id:            record.id,
                        transactionId: record.transaction_id || '',
                        reconciled:    record.is_reconciled ? 'Yes' : 'No',
                        date:          record.transaction_date
                                           ? new Date(record.transaction_date).toISOString().split('T')[0]
                                           : '',
                        debit:         record.transaction_type === 'debit'  ? record.amount : '',
                        credit:        record.transaction_type === 'credit' ? record.amount : '',
                        description:   record.description || '',
                        fileName:      record.file_path ? record.file_path.split(/[\\\/]/).pop() : ''
                    }));
                    setTransactions(formatted);
                } else {
                    setError("Failed to fetch ledger records");
                }
            } catch (err) {
                console.error(err);
                setError("Error fetching ledger records");
            } finally {
                setLoading(false);
            }
        };
        fetchRecords();
    }, [id, token]);

    /* ── handleTransactionUpdate — sync edit back to API ── */
    const handleTransactionUpdate = async (recordId, field, value) => {
        setTransactions(prev =>
            prev.map(txn => txn.id === recordId ? { ...txn, [field]: value } : txn)
        );
        if (!token) return;
        try {
            await fetch(apiUrl(`/ledger/record/${recordId}`), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ field, value })
            });
        } catch (err) {
            console.error("Failed to sync transaction update", err);
        }
    };

    /* ── handleAddRow — insert blank editable row ── */
    const handleAddRow = () => {
        const newRow = {
            id:            Date.now().toString(),
            transactionId: '',
            reconciled:    'No',
            date:          '',
            debit:         '',
            credit:        '',
            description:   '',
            fileName:      ''
        };
        setTransactions(prev => [...prev, newRow]);
    };

    /* ── Modal helpers ── */
    const closeAddEntryModal = () => {
        setShowAddEntryModal(false);
        setFiles([]);
        setError("");
        setUploading(false);
    };

    /* ── handleManualEntry — add blank row & close modal ── */
    const handleManualEntry = () => {
        handleAddRow();
        closeAddEntryModal();
    };

    const handleFileChange = (e) => {
        const selected = Array.from(e.target.files || []);
        setFiles(prev => {
            const existing = prev.map(f => f.name);
            return [...prev, ...selected.filter(f => !existing.includes(f.name))];
        });
        e.target.value = "";
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const dropped = Array.from(e.dataTransfer.files || []);
        setFiles(prev => {
            const existing = prev.map(f => f.name);
            return [...prev, ...dropped.filter(f => !existing.includes(f.name))];
        });
    };

    const removeFile = (index) =>
        setFiles(prev => prev.filter((_, i) => i !== index));

    const handleUploadInvoices = async () => {
        if (files.length === 0) { setError("Please select at least one invoice file."); return; }
        if (!token)             { setError("Authentication token missing. Please login again."); return; }

        setUploading(true);
        setError("");
        try {
            const formPayload = new FormData();
            files.forEach(file => formPayload.append("files", file));

            const response = await fetch(`${API}/ledger/${id}/files`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formPayload
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Failed to upload invoices");

            const newRows = [];
            data.files.forEach(fileData => {
                if (fileData.records && fileData.records.length > 0) {
                    fileData.records.forEach(record => {
                        newRows.push({
                            id:            record.recordId || `${Date.now()}-${Math.random()}`,
                            transactionId: record.transaction_id || '',
                            reconciled:    'No',
                            date:          record.transaction_date
                                               ? new Date(record.transaction_date).toISOString().split('T')[0]
                                               : '',
                            debit:         record.transaction_type === 'debit'  ? record.amount : '',
                            credit:        record.transaction_type === 'credit' ? record.amount : '',
                            description:   record.description || '',
                            fileName:      fileData.originalName
                        });
                    });
                } else {
                    newRows.push({
                        id:            `${Date.now()}-${Math.random()}`,
                        transactionId: '',
                        reconciled:    'No',
                        date:          '',
                        debit:         '',
                        credit:        '',
                        description:   '',
                        fileName:      fileData.originalName
                    });
                }
            });
            setTransactions(prev => [...prev, ...newRows]);
            closeAddEntryModal();
        } catch (uploadError) {
            setError(uploadError.message || "Could not upload invoices.");
        } finally {
            setUploading(false);
        }
    };

    const getFileIcon = (name) => {
        const ext = name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf')                return '📄';
        if (['xls','xlsx'].includes(ext)) return '📊';
        if (ext === 'csv')                return '📋';
        return '📁';
    };

    /* ── Render ── */
    return (
        <>
            <div className="transactions-view">
                <div className="ledger-table-container">
                    {loading && (
                        <p style={{ textAlign: 'center', padding: '20px' }}>Loading records...</p>
                    )}
                    {!loading && (
                        <table className="ledger-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '50px'  }}>#</th>
                                    <th>Transaction ID</th>
                                    <th style={{ width: '120px' }}>Reconciled</th>
                                    <th style={{ width: '150px' }}>Date</th>
                                    <th style={{ width: '120px' }}>Debit</th>
                                    <th style={{ width: '120px' }}>Credit</th>
                                    <th>Description</th>
                                    <th>File Name</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                                            No records found. Add a new entry or upload an invoice.
                                        </td>
                                    </tr>
                                ) : transactions.map((txn, index) => (
                                    <tr key={txn.id}>
                                        <td>{index + 1}</td>

                                        <td>{txn.transactionId || '-'}</td>
                                        <td>{txn.reconciled}</td>
                                        <td>{txn.date || '-'}</td>
                                        <td>{txn.debit || '0.00'}</td>
                                        <td>{txn.credit || '0.00'}</td>
                                        <td>{txn.description || '-'}</td>
                                        <td>{txn.fileName || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Add New Entry button ── */}
                <button className="add-row-btn" onClick={() => setShowAddEntryModal(true)}>
                    Add New Entry
                </button>
            </div>

            {/* ── Add New Entry modal ── */}
            {showAddEntryModal && (
                <div className="entry-modal-overlay" onClick={closeAddEntryModal}>
                    <div className="entry-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="entry-modal-header">
                            <h2>Add New Entry</h2>
                            <button
                                type="button"
                                className="entry-btn-close"
                                onClick={closeAddEntryModal}
                                disabled={uploading}
                            >
                                &times;
                            </button>
                        </div>

                        {error && (
                            <div className="entry-modal-error">
                                <span>{error}</span>
                                <button type="button" onClick={() => setError("")}>✕</button>
                            </div>
                        )}

                        {/* Manual Entry option */}
                        <div className="entry-option-grid">
                            <button
                                type="button"
                                className="entry-option-card"
                                onClick={handleManualEntry}
                                disabled={uploading}
                            >
                                <h3>Manual Entry</h3>
                                <p>Add a blank row and fill details manually.</p>
                            </button>
                        </div>

                        {/* File upload section */}
                        <div className="entry-form-group">
                            <label>
                                Upload Invoice <span className="entry-label-optional">(PDF, Excel, CSV)</span>
                            </label>
                            <div
                                className={`entry-file-dropzone ${uploading ? 'entry-dropzone-disabled' : ''}`}
                                onDrop={handleDrop}
                                onDragOver={e => e.preventDefault()}
                                onClick={() => !uploading && fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.csv,.xls,.xlsx"
                                    onChange={handleFileChange}
                                    className="entry-file-input-hidden"
                                    disabled={uploading}
                                />
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                    strokeLinejoin="round" className="entry-upload-icon">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                <p>Click to browse or drag files here</p>
                                <span className="entry-file-count">
                                    {files.length > 0 ? `${files.length} file(s) selected` : "No files selected"}
                                </span>
                            </div>

                            {files.length > 0 && (
                                <ul className="entry-file-list">
                                    {files.map((file, i) => (
                                        <li key={`${file.name}-${i}`} className="entry-file-list-item">
                                            <span className="entry-file-icon">{getFileIcon(file.name)}</span>
                                            <span className="entry-file-name" title={file.name}>{file.name}</span>
                                            <button
                                                type="button"
                                                className="entry-file-remove-btn"
                                                onClick={() => removeFile(i)}
                                                disabled={uploading}
                                            >
                                                ✕
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="entry-modal-actions">
                            <button
                                type="button"
                                className="entry-btn-cancel"
                                onClick={closeAddEntryModal}
                                disabled={uploading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="entry-btn-submit"
                                onClick={handleUploadInvoices}
                                disabled={uploading}
                            >
                                {uploading ? "Uploading..." : "Upload Invoice"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}