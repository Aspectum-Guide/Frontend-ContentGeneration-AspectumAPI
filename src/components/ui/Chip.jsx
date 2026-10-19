const VARIANTS = {
  neutral: 'bg-aspectum-surface-muted text-aspectum-text border-aspectum-border hover:bg-aspectum-text/10',
  blue: 'bg-aspectum-primary-soft text-aspectum-primary-hover border-aspectum-primary/20 hover:bg-aspectum-primary/10',
  purple: 'bg-aspectum-violet/10 text-aspectum-violet border-aspectum-violet/20 hover:bg-aspectum-violet/20',
  green: 'bg-aspectum-success-soft text-aspectum-success border-aspectum-success/20 hover:bg-aspectum-success/10',
  red: 'bg-aspectum-danger-soft text-aspectum-danger border-aspectum-danger/20 hover:bg-aspectum-danger/10',
};

export default function Chip({
  children,
  selected = false,
  removable = false,
  disabled = false,
  variant = 'neutral',
  onClick,
  onRemove,
  className = '',
  ...props
}) {
  const interactive = Boolean(onClick) && !disabled;
  const classes = selected
    ? 'bg-aspectum-primary text-aspectum-on-accent border-aspectum-primary hover:bg-aspectum-primary-hover'
    : VARIANTS[variant] || VARIANTS.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${classes} ${disabled ? 'opacity-50' : ''} ${interactive ? 'cursor-pointer' : ''} ${className}`.trim()}
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      {...props}
    >
      <span>{children}</span>
      {removable && (
        <button
          type="button"
          aria-label="Удалить"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onRemove?.();
          }}
          className="-mr-1 rounded-full px-0.5 leading-none hover:bg-aspectum-overlay-faint disabled:pointer-events-none"
        >
          ×
        </button>
      )}
    </span>
  );
}
