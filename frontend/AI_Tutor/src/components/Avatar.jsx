import './Avatar.css';

export function Avatar({
  name = '',
  src,
  alt,
  size = 'md',
  className = '',
  ...props
}) {
  const safeName = typeof name === 'string' ? name.trim() : '';
  const parts = safeName.split(/\s+/).filter(Boolean);
  const initials = parts.length > 0
    ? parts.map((part) => part[0]).join('').toUpperCase().slice(0, 2)
    : (alt ? alt.slice(0, 2).toUpperCase() : 'U');

  const sizeClasses = {
    sm: 'avatar-sm',
    md: 'avatar-md',
    lg: 'avatar-lg',
  };

  return (
    <div
      className={`avatar ${sizeClasses[size]} ${className}`}
      {...props}
      role="img"
      aria-label={safeName || alt || 'User avatar'}
    >
      {src ? (
        <img src={src} alt={alt || safeName} className="avatar-image" />
      ) : (
        <span className="avatar-initials">{initials}</span>
      )}
    </div>
  );
}

export default Avatar;