import React, { useEffect, useState } from 'react';
import './LedgerCollectionPage.css';
import { useOutletContext } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { CreateLedgerModal } from './components/CreateLedgerModal';
import useAuthStore from '../../../store/useAuthStore';
import { apiUrl } from '../../../utils/api';

export const LedgerCollectionPage = () => {
  const { showCreateModalOverlay, setShowCreateModalOverlay } = useOutletContext();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLedgers = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!token) {
          setLedgers([]);
          setError('Authentication token not found');
          return;
        }

        const response = await fetch(apiUrl('/ledger'), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to fetch ledgers');
        }

        setLedgers(data.data || []);
      } catch (err) {
        console.error('Error fetching ledgers:', err);
        setLedgers([]);
        setError(err.message || 'Failed to fetch ledgers. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchLedgers();
  }, [token, showCreateModalOverlay]);

  return (
    <>
      {showCreateModalOverlay && (
        <CreateLedgerModal
          isOpen={showCreateModalOverlay}
          onClose={() => {
            setShowCreateModalOverlay(false);
          }}
        />
      )}

      <div className="ledger-table-container">
        {loading && <p style={{ textAlign: 'center', padding: '20px' }}>Loading ledgers...</p>}
        {!loading && error && <p style={{ textAlign: 'center', padding: '20px', color: 'red' }}>{error}</p>}
        {!loading && !error && ledgers.length === 0 && (
          <p style={{ textAlign: 'center', padding: '20px' }}>No ledgers found. Create one to get started!</p>
        )}

        {!loading && ledgers.length > 0 && (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Bank Account</th>
                <th>Entries</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.map((ledger) => (
                <tr
                  key={ledger.id}
                  onClick={() => {
                    navigate(String(ledger.id));
                  }}
                >
                  <td>{ledger.month} {ledger.year}</td>
                  <td className="cell-bank">{ledger.bankAccount}</td>
                  <td className="cell-entries">{ledger.entries}</td>
                  <td>{ledger.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );

};

