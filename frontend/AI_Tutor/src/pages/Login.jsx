import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Divider } from '../components/Divider';
import { api } from '../services/api';
import { getFirebaseErrorMessage } from '../services/firebase';
import './AuthPage.css';

export function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const validateField = (name, value) => {
    switch (name) {
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        return '';
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setResetMessage('');

    const newErrors = {};
    let hasErrors = false;
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key]);
      if (error) {
        newErrors[key] = error;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setErrors(newErrors);
      setTouched({ email: true, password: true });
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await api.login({
        email: formData.email,
        password: formData.password,
      });

      if (data.user?.level) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      setSubmitError(getFirebaseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitError('');
    setResetMessage('');
    setIsGoogleSubmitting(true);
    try {
      const data = await api.googleLogin();
      if (data.user?.level) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      setSubmitError(getFirebaseErrorMessage(err));
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email.trim()) {
      setSubmitError('Please enter your email above to receive a password reset link.');
      return;
    }
    try {
      await api.resetPassword(formData.email);
      setResetMessage(`Password reset link sent to ${formData.email}. Please check your inbox.`);
      setSubmitError('');
    } catch (err) {
      setSubmitError(getFirebaseErrorMessage(err));
    }
  };

  return (
    <div className="auth-page">
      <main className="auth-main">
        <div className="auth-card">
          <header className="auth-header">
            <div className="auth-logo">AI TEACHER</div>
            <h1 className="auth-title">Welcome back.</h1>
          </header>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {submitError && (
              <div className="auth-submit-error" role="alert">
                {submitError}
              </div>
            )}

            {resetMessage && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #10b981',
                color: '#10b981',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '14px',
              }}>
                {resetMessage}
              </div>
            )}

            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.email ? errors.email : undefined}
              required
              autoComplete="email"
              autoFocus
            />

            <div className="password-field-wrapper">
              <Input
                label="Password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.password ? errors.password : undefined}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="forgot-password-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onClick={handleForgotPassword}
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              block
              size="lg"
              loading={isSubmitting}
            >
              Log in
            </Button>
          </form>

          <Divider>or</Divider>

          <div className="google-btn-wrapper">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #334155)',
                background: 'var(--color-surface, #1e293b)',
                color: 'var(--color-text-primary, #f8fafc)',
                fontSize: '15px',
                fontWeight: 500,
                cursor: isGoogleSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              {isGoogleSubmitting ? 'Signing in with Google...' : 'Continue with Google'}
            </button>
          </div>

          <footer className="auth-footer">
            <p>
              New here?{' '}
              <Link to="/signup" className="auth-link">
                Create account
              </Link>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default Login;