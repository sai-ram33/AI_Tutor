import './ErrorMessage.css';

export function ErrorMessage({ message, onRetry, className = '', ...props }) {
  return (
    <div
      className={`error-message ${className}`}
      role="alert"
      {...props}
    >
      <div className="error-content">
        <svg className="error-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div className="error-text-group">
          <p className="error-title">Couldn't reach AI Teacher</p>
          <p className="error-description">{message || 'Please check your connection and try again.'}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          className="error-retry"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function SessionExpiredBanner({ onLogin, className = '', ...props }) {
  return (
    <div
      className={`session-banner ${className}`}
      role="alert"
      {...props}
    >
      <svg className="banner-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <p className="banner-text">
        Your session ended — {onLogin ? (
          <button type="button" onClick={onLogin} className="banner-link-btn">log in again</button>
        ) : (
          <a href="/login" className="banner-link">log in again</a>
        )} to continue.
      </p>
    </div>
  );
}

export default ErrorMessage;