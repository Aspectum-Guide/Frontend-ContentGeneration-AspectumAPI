export default function SelectableCard({ children, onSelect, disabled = false, className = '', ariaLabel }) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onClick={() => !disabled && onSelect?.()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onSelect?.();
        }
      }}
      className={`rounded-aspectum-card focus-visible:outline-2 focus-visible:outline-aspectum-primary focus-visible:outline-offset-2 ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
