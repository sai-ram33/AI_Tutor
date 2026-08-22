import './Button.css';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  className = '',
  'aria-label': ariaLabel,
  ...props
}) {
  const classNames = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    block && 'btn-block',
    disabled && 'btn-disabled',
    loading && 'btn-loading',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classNames}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-busy={loading}
      {...props}
    >
      {loading && <span className="btn-spinner" aria-hidden="true"></span>}
      <span className="btn-text">{children}</span>
    </button>
  );
}

export default Button;