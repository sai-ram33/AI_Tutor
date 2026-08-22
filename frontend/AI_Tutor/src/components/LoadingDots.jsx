import './LoadingDots.css';

export function LoadingDots({ className = '', ...props }) {
  return (
    <div className={`loading-dots ${className}`} {...props} aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
  );
}

export default LoadingDots;