import './Input.css';

export function Input({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  hint,
  disabled = false,
  required = false,
  id,
  name,
  className = '',
  ...props
}) {
  const inputId = id || name;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="required" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        className={`form-input ${error ? 'error' : ''}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy}
        {...props}
      />
      {error && (
        <span id={errorId} className="form-error" role="alert">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={hintId} className="form-hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export function Textarea({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  hint,
  disabled = false,
  required = false,
  id,
  name,
  rows = 4,
  className = '',
  ...props
}) {
  const inputId = id || name;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="required" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        rows={rows}
        className={`form-input form-textarea ${error ? 'error' : ''}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy}
        {...props}
      />
      {error && (
        <span id={errorId} className="form-error" role="alert">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={hintId} className="form-hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export function Select({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  hint,
  disabled = false,
  required = false,
  id,
  name,
  options = [],
  className = '',
  ...props
}) {
  const inputId = id || name;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="required" aria-hidden="true">*</span>}
        </label>
      )}
      <select
        id={inputId}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        className={`form-input form-select ${error ? 'error' : ''}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={errorId} className="form-error" role="alert">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={hintId} className="form-hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export default Input;