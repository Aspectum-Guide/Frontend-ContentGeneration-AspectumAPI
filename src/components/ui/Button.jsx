export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'lg',
  disabled = false,
  className = '',
  ...props
}) {
  // Размер задаёт только геометрию; цвет и состояние задаются variant.
  const sizes = {
    xxs: 'px-1.5 py-0.5 text-[10px] rounded',
    xs: 'px-1 py-0.5 text-xs rounded',
    iconXs: 'w-5 h-5 p-0 text-sm rounded-aspectum-compact',
    iconSm: 'p-1.5 text-xs rounded-aspectum-compact',
    iconMd: 'w-8 h-8 p-0 text-lg rounded-aspectum-control',
    iconOverlay: 'w-7 h-7 p-0 text-sm rounded-full',
    pillSm: 'px-2.5 py-1 text-xs rounded-full',
    sidebarRail: 'flex-col gap-1.5 px-2 py-3 text-xs rounded-aspectum-card',
    sm: 'px-2.5 py-1 text-xs rounded-aspectum-compact',
    md: 'px-4 py-2 text-sm rounded-aspectum-control',
    lg: 'px-4 py-2.5 text-base sm:text-sm rounded-aspectum-control min-h-[44px]',
    xl: 'px-8 py-3 text-lg rounded-aspectum-control min-h-[48px]',
  };

  const variants = {
    primary: 'bg-aspectum-primary text-aspectum-on-accent hover:bg-aspectum-primary-hover',
    secondary: 'bg-aspectum-surface-muted text-aspectum-text hover:bg-aspectum-text/10',
    outline: 'bg-aspectum-surface border border-aspectum-border text-aspectum-text hover:bg-aspectum-surface-muted',
    outlineDashed: 'bg-aspectum-surface border-2 border-dashed border-aspectum-border text-aspectum-text-muted hover:border-aspectum-primary hover:text-aspectum-primary',
    outlineDanger: 'bg-aspectum-surface border border-aspectum-danger-border text-aspectum-danger-emphasis hover:bg-aspectum-danger-muted',
    selectable: 'bg-aspectum-surface border border-aspectum-border text-aspectum-text-strong hover:border-aspectum-primary-border-strong hover:bg-aspectum-primary-soft',
    selectableActive: 'bg-aspectum-primary-soft border border-aspectum-primary-border-strong text-aspectum-primary-hover',
    mediaTile: 'bg-aspectum-surface-muted border border-aspectum-border hover:ring-2 hover:ring-aspectum-primary/30',
    dashedTile: 'bg-aspectum-surface border-2 border-dashed border-aspectum-border text-aspectum-text-muted hover:border-aspectum-primary hover:text-aspectum-primary',
    textTile: 'text-aspectum-text hover:bg-aspectum-primary-soft',
    copyField: 'bg-aspectum-surface-muted border border-aspectum-border text-aspectum-text-emphasis hover:bg-aspectum-surface-subtle',
    joinedGhost: 'text-aspectum-text-muted hover:bg-aspectum-surface-muted rounded-none border-l border-aspectum-primary-muted',
    danger: 'bg-aspectum-danger text-aspectum-on-accent hover:bg-aspectum-danger/90',
    success: 'bg-aspectum-success text-aspectum-on-accent hover:bg-aspectum-success/90',
    dark: 'bg-aspectum-surface-inverse text-aspectum-on-accent hover:bg-aspectum-surface-inverse-hover',
    soft: 'bg-aspectum-primary-soft text-aspectum-primary hover:bg-aspectum-primary/10',
    softStrong: 'bg-aspectum-primary/10 text-aspectum-primary-hover hover:bg-aspectum-primary/20',
    softDanger: 'bg-aspectum-danger-soft text-aspectum-danger hover:bg-aspectum-danger/10',
    ghost: 'text-aspectum-text-muted hover:bg-aspectum-surface-muted',
    ghostPrimary: 'text-aspectum-text-faint hover:bg-aspectum-primary-soft hover:text-aspectum-focus',
    ghostSuccess: 'text-aspectum-success hover:bg-aspectum-success-soft hover:text-aspectum-success-strong',
    ghostDanger: 'text-aspectum-danger-subtle hover:bg-aspectum-danger-soft hover:text-aspectum-danger-strong',
    ghostWarning: 'text-aspectum-text-muted hover:bg-aspectum-warning-soft hover:text-aspectum-warning',
    ghostOnAccent: 'text-aspectum-on-accent/90 hover:bg-aspectum-surface/15 hover:text-aspectum-on-accent',
    overlay: 'bg-aspectum-overlay-heavy text-aspectum-on-accent hover:bg-aspectum-overlay-opaque',
    link: 'text-aspectum-primary hover:text-aspectum-primary-hover hover:underline',
    linkDanger: 'text-aspectum-danger hover:text-aspectum-danger-strong hover:underline',
    // accents (не подгонять под primary)
    purple: 'bg-aspectum-purple text-aspectum-on-accent hover:bg-aspectum-purple/90',
    softPurple: 'bg-aspectum-purple/10 text-aspectum-purple hover:bg-aspectum-purple/20',
    outlinePurple: 'bg-aspectum-surface border border-aspectum-violet/40 text-aspectum-violet hover:bg-aspectum-violet/10',
    indigo: 'bg-aspectum-indigo text-aspectum-on-accent hover:bg-aspectum-indigo/90',
    softIndigo: 'bg-aspectum-indigo/10 text-aspectum-indigo border border-aspectum-indigo/20 hover:bg-aspectum-indigo/20',
    softIndigoStrong: 'bg-aspectum-indigo-soft text-aspectum-indigo-strong border border-aspectum-indigo-border hover:bg-aspectum-indigo-muted',
    violet: 'bg-aspectum-violet text-aspectum-on-accent hover:bg-aspectum-violet/90',
    softViolet: 'bg-aspectum-violet/10 text-aspectum-violet hover:bg-aspectum-violet/20',
    linkViolet: 'text-aspectum-violet hover:underline',
    amber: 'bg-aspectum-warning text-aspectum-on-accent hover:bg-aspectum-warning/90',
    emerald: 'bg-aspectum-success text-aspectum-on-accent hover:bg-aspectum-success/90',
    linkEmerald: 'text-aspectum-success hover:underline',
    softOrange: 'bg-aspectum-orange/10 text-aspectum-orange hover:bg-aspectum-orange/20',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 ${sizes[size] || sizes.lg} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
