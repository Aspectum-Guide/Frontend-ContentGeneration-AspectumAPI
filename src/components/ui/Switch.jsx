import Spinner from './Spinner';

const ON_COLORS = {
  blue: 'bg-aspectum-primary',
  green: 'bg-aspectum-success',
};

/**
 * Переключатель видимости / флага.
 * size фиксирован (w-9 h-5) — как в каталоге.
 */
export default function Switch({
  checked = false,
  onChange,
  onClick,
  disabled = false,
  loading = false,
  color = 'blue',
  'aria-label': ariaLabel,
  className = '',
  ...props
}) {
  const onClass = ON_COLORS[color] || ON_COLORS.blue;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={ariaLabel}
      disabled={disabled || loading}
      onClick={(e) => {
        onClick?.(e);
        if (disabled || loading || e.defaultPrevented) return;
        onChange?.(!checked);
      }}
      className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        checked ? onClass : 'bg-aspectum-border'
      } ${className}`}
      {...props}
    >
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" className="h-3 w-3 border border-aspectum-on-accent border-t-transparent" />
        </span>
      ) : (
        <span
          className={`absolute top-0.5 w-4 h-4 bg-aspectum-surface rounded-full shadow transition-all ${
            checked ? 'left-4' : 'left-0.5'
          }`}
        />
      )}
    </button>
  );
}
