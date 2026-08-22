import './Divider.css';

export function Divider({ children, className = '', ...props }) {
  return (
    <div className={`divider ${className}`} {...props}>
      {children && <span className="divider-text">{children}</span>}
    </div>
  );
}

export default Divider;