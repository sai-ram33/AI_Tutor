import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Divider } from '../components/Divider';
import { api } from '../services/api';
import './AuthPage.css';

export function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [googleError, setGoogleError] = useState('');

  // Get pre-filled question from location state
  useEffect(() => {
    if (location.state?.question) {
      sessionStorage.setItem('pendingQuestion', location.state.question);
    }
  }, [location]);

  const validateField = (name, value) => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return '';
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
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
      setTouched({ name: true, email: true, password: true });
      return;
    }

    setIsSubmitting(true);

    try {
      await api.signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      // Redirect to onboarding to select learning level
      navigate('/onboarding');
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
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
            <h1 className="auth-title">Start learning, free.</h1>
          </header>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {submitError && (
              <div className="auth-submit-error" role="alert">
                {submitError}
              </div>
            )}

            <Input
              label="Name"
              name="name"
              type="text"
              placeholder="Your name"
              value={formData.name}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.name ? errors.name : undefined}
              required
              autoComplete="name"
              autoFocus
            />

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
            />

            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="Create a password"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.password ? errors.password : undefined}
              required
              hint="At least 8 characters"
              autoComplete="new-password"
            />

            <Button
              type="submit"
              variant="primary"
              block
              size="lg"
              loading={isSubmitting}
            >
              Create account
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
              text="signup_with"
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
              Already have an account?{' '}
              <Link to="/login" className="auth-link">
                Log in
              </Link>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default Signup;