import React, { useEffect, useState } from 'react';
import './BankStatementsPage.css';
import { useOutletContext, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CreateBankStatementGroupModal } from "./components/CreateBankStatementGroupModal";
import useAuthStore from "../../../store/useAuthStore";
import { apiUrl } from '../../../utils/api';

export const BankStatementsPage = () => {
  const { showCreateModalOverlay, setShowCreateModalOverlay } = useOutletContext();
  const navigate = useNavigate();
  const token = useAuthStore(state => state.token);
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStatements = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(apiUrl('/bank-statement/groups'), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setStatements(response.data.groups || []);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch bank statements';
      setError(errorMessage);
      console.error('Error fetching bank statements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  const handleUploadSuccess = (newStatement) => {
    fetchStatements(); // Refresh the list
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this bank statement? This action cannot be undone.')) {
      try {
        await axios.delete(apiUrl(`/bank-statement/groups/${id}`), {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        fetchStatements();
      } catch (err) {
        console.error('Failed to delete:', err);
        alert('Failed to delete bank statement.');
      }
    }
  };

  const formatDate = (dateObj) => {
    if (!dateObj) return '';
    const date = new Date(dateObj);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <>
      {showCreateModalOverlay && (
        <CreateBankStatementGroupModal 
          isOpen={showCreateModalOverlay} 
          onClose={() => setShowCreateModalOverlay(false)}
          onUploadSuccess={handleUploadSuccess}
        />
      )}

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-container">
          <p>Loading bank statements...</p>
        </div>
      ) : (
        <div className="ledger-table-container">
          {statements.length === 0 ? (
            <div className="empty-state">
              <p>No bank statements yet. Create one to get started!</p>
            </div>
          ) : (
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Bank Account</th>
                  <th>Period</th>
                  <th>Entries</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((statement) => (
                  <tr key={statement.id} onClick={() => navigate(statement.id.toString())}>
                    <td className="cell-name">{statement.name}</td>
                    <td className="cell-bank">{statement.bankAccount}</td>
                    <td>
                      {monthNumberToName(statement.month)} {statement.year}
                    </td>
                    <td className="cell-entries">{statement.entries}</td>
                    <td>{formatDate(statement.createdAt)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={(e) => handleDelete(e, statement.id)}
                        className="delete-button"
                        style={{
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
};

const monthNumberToName = (month) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
};