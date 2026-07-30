import { useState, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import zxcvbn from 'zxcvbn';
import { apiUrl } from '../utils/api';
import './Auth.css';

const BarChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
);

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  // Evaluate password strength using zxcvbn
  const strengthResult = useMemo(() => {
    if (!newPassword) return { score: 0, label: 'Very Weak', color: '#e5e7eb' };
    const res = zxcvbn(newPassword);
    const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
    const colors = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#059669'];
    return {
      score: res.score,
      label: labels[res.score],
      color: colors[res.score]
    };
  }, [newPassword]);

  // Individual criteria checks
  const criteria = useMemo(() => {
    return {
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword)
    };
  }, [newPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError('Password reset token is required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!criteria.length || !criteria.uppercase || !criteria.number || !criteria.special) {
      setError('Password does not meet all security criteria.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(apiUrl('/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/auth?mode=login');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <Link to="/" className="brand-back">
        <div className="brand-icon-wrapper">
          <BarChartIcon />
        </div>
        ReconFlow
      </Link>

      <div className="auth-card">
        <div className="auth-header">
          <h2>Reset Password</h2>
          <p>Enter your reset token and choose a strong new password.</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {!tokenFromUrl && (
            <div className="form-group">
              <label>Reset Token</label>
              <input
                type="text"
                placeholder="Enter reset token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            {newPassword && (
              <div className="strength-meter-container">
                <div className="strength-bar-track">
                  {[0, 1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className="strength-segment"
                      style={{
                        backgroundColor: level <= strengthResult.score ? strengthResult.color : '#e5e7eb'
                      }}
                    />
                  ))}
                </div>
                <span className="strength-label" style={{ color: strengthResult.color }}>
                  Strength: {strengthResult.label}
                </span>
              </div>
            )}

            <div className="password-criteria-list">
              <div className={`criterion-item ${criteria.length ? 'valid' : ''}`}>
                <span>{criteria.length ? '✓' : '○'}</span> 8+ Characters
              </div>
              <div className={`criterion-item ${criteria.uppercase ? 'valid' : ''}`}>
                <span>{criteria.uppercase ? '✓' : '○'}</span> 1 Upper (A-Z)
              </div>
              <div className={`criterion-item ${criteria.number ? 'valid' : ''}`}>
                <span>{criteria.number ? '✓' : '○'}</span> 1 Number (0-9)
              </div>
              <div className={`criterion-item ${criteria.special ? 'valid' : ''}`}>
                <span>{criteria.special ? '✓' : '○'}</span> 1 Special (!@#)
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-auth-submit" disabled={isLoading}>
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="auth-toggle">
          Remember your password?
          <Link to="/auth?mode=login" style={{ color: 'var(--primary)', fontWeight: 600, marginLeft: '0.25rem' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
