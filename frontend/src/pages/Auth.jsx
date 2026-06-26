import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { apiUrl } from '../utils/api';

import './Auth.css';

const BarChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
);

function Auth() {

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);


  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode');

  const [isLogin, setIsLogin] = useState(mode !== 'signup');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true }); // ? The user should not be able to come to this page even if they click undo button 
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // ? If there is no mode then we manually set it to login
    if (!mode)
      setSearchParams({ mode: "login" });
    else
      setIsLogin(mode !== 'signup');
  }, [mode]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';

    try {
      // ! Hard coded backend port
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLogin ? { email, password } : { username, email, password })
      });

      const data = await response.json();

      console.log(data);

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      if (isLogin) {
        // Success Login
        login(data.user, data.token); // ? This is from zustand and token is being saved in localStorage by default
        setSuccess('Login successful! Redirecting...');


        setTimeout(() => {
          navigate('/dashboard'); // ? Takes some time for no reason 
        }, 1000);

      } else {
        // Success Registration

        setSuccess('Registration successful! Please log in.');
        setTimeout(() => {
          setIsLogin(true); // Switch view to login directly
          setPassword(''); // clear password for safety
          setSuccess(null);
        }, 2000);
      }
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
          <h2>{isLogin ? 'Welcome Back' : 'Create an Account'}</h2>
          <p>{isLogin ? 'Log in to manage your automated reconciliations.' : 'Automate your financial processing today.'}</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="Enter Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="6"
            />
          </div>

          <button type="submit" className="btn-auth-submit" disabled={isLoading}>
            {isLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-toggle">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <span onClick={() => {
            const newMode = isLogin ? 'signup' : 'login';
            setSearchParams({ mode: newMode });

            setError(null);
            setSuccess(null);
          }}>
            {isLogin ? 'Sign Up' : 'Log In'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Auth;
