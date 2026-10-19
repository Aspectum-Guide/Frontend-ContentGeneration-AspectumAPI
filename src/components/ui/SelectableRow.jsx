export default function SelectableRow({
  children,
  selected = false,
  disabled = false,
  onClick,
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-selected={selected}
      onClick={onClick}
      className={`w-full text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'bg-aspectum-primary-soft' : 'hover:bg-aspectum-surface-muted'} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
