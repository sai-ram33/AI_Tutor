import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import './MessageInput.css';

export const MessageInput = forwardRef(function MessageInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Write a message...",
  disabled = false,
  autoFocus = false,
  className = '',
  responseMode = 'explain',
  onResponseModeChange,
  ariaLabel = "Your question",
}, ref) {
  const textareaRef = useRef(null);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const modeMenuRef = useRef(null);

  // Expose focus and reset methods to parent via forwarded ref
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    reset: () => {
      if (textareaRef.current) {
        textareaRef.current.value = '';
        textareaRef.current.style.height = 'auto';
      }
    },
  }));

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.(e);
    }
  };

  // Close mode menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target)) {
        setIsModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const modeLabel = responseMode === 'explain' ? 'Explain Mode' : 'Guide Mode';

  const handleModeSelect = (mode) => {
    onResponseModeChange?.(mode);
    setIsModeMenuOpen(false);
  };

  return (
    <div className={`message-input-container ${className}`}>
      <form className="input-pill" onSubmit={onSubmit}>
        <div className="input-main">
          <textarea
            ref={textareaRef}
            className="message-input"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            aria-label={ariaLabel}
          />
        </div>
        <div className="input-footer">
          <div className="input-footer-left">
            {/* "+" Attachment icon - disabled placeholder */}
            <button
              type="button"
              className="input-action-btn disabled"
              disabled
              aria-disabled="true"
              title="Coming soon"
              aria-label="Attach file (coming soon)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
          <div className="input-footer-right">
            {/* Mode dropdown - replaces segmented control */}
            <div className="mode-dropdown" ref={modeMenuRef}>
              <button
                type="button"
                className="mode-dropdown-trigger"
                onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                aria-haspopup="true"
                aria-expanded={isModeMenuOpen}
                aria-label={`Current mode: ${modeLabel}. Click to change.`}
              >
                <span className="mode-dropdown-label">{modeLabel}</span>
                <svg className="mode-dropdown-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {isModeMenuOpen && (
                <div className="mode-dropdown-menu" role="menu">
                  <button
                    className={`mode-dropdown-item ${responseMode === 'explain' ? 'active' : ''}`}
                    role="menuitem"
                    onClick={() => handleModeSelect('explain')}
                    aria-pressed={responseMode === 'explain'}
                  >
                    Explain Mode
                  </button>
                  <button
                    className={`mode-dropdown-item ${responseMode === 'guide' ? 'active' : ''}`}
                    role="menuitem"
                    onClick={() => handleModeSelect('guide')}
                    aria-pressed={responseMode === 'guide'}
                  >
                    Guide Mode
                  </button>
                </div>
              )}
            </div>
            {/* Microphone icon - disabled placeholder */}
            <button
              type="button"
              className="input-action-btn disabled"
              disabled
              aria-disabled="true"
              title="Coming soon"
              aria-label="Voice input (coming soon)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>
            {/* Waveform icon - disabled placeholder for voice mode */}
            <button
              type="button"
              className="input-action-btn disabled"
              disabled
              aria-disabled="true"
              title="Coming soon"
              aria-label="Voice mode (coming soon)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 13a3 3 0 0 0 0-6h1a2 2 0 0 1 0 4H4a1 1 0 0 0 0 2h1"></path>
                <path d="M8 11a5 5 0 0 1 0-10h1a4 4 0 0 0 0 8H8a1 1 0 0 0 0 2h1"></path>
                <path d="M12 19v-6"></path>
                <path d="M16 5a5 5 0 0 1 0 10h1a4 4 0 0 0 0-8h-1"></path>
                <path d="M20 5a3 3 0 0 1 0 6h1a2 2 0 0 0 0-4h-1"></path>
              </svg>
            </button>
            {/* Send button - circular icon button */}
            <button
              type="submit"
              className="send-btn"
              disabled={!value.trim() || disabled}
              aria-label="Send message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
});

MessageInput.displayName = 'MessageInput';