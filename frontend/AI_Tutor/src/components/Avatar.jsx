import './Avatar.css';

export function Avatar({
  name = '',
  src,
  alt,
  size = 'md',
  className = '',
  ...props
}) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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
      aria-label={name || alt || 'User avatar'}
    >
      {src ? (
        <img src={src} alt={alt || name} className="avatar-image" />
      ) : (
        <span className="avatar-initials">{initials}</span>
      )}
    </div>
  );
}

export default Avatar;