import './Chip.css';

export function Chip({ children, className = '', onClick, ...props }) {
  return (
    <span
      className={`chip ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </span>
  );
}

export default Chip;