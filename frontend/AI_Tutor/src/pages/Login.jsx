import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Divider } from '../components/Divider';
import { api } from '../services/api';
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
  const [submitError, setSubmitError] = useState('');
  const [googleError, setGoogleError] = useState('');

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

    // Clear error on change if field was touched
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

    // Validate all fields
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
      setSubmitError(err.message || 'Email or password is incorrect');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async ({ credential }) => {
    setGoogleError('');
    try {
      const data = await api.googleLogin(credential);
      if (data.user?.level) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      setGoogleError(err.message || 'Google sign-in failed, please try again.');
    }
  };

  const handleGoogleError = () => {
    setGoogleError('Google sign-in failed, please try again.');
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
                onClick={() => alert('Password reset: If you lost access, you can sign in with Google or register with a new email.')}
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
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              size="large"
              width="100%"
              text="continue_with"
              shape="rectangular"
            />
          </div>

          {googleError && (
            <div className="auth-submit-error" role="alert">
              {googleError}
            </div>
          )}

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