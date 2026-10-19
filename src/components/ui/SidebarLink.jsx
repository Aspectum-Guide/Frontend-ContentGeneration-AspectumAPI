/**
 * One navigation entry: icon + label (+ badge). In the collapsed rail only the icon
 * is shown and the label moves to the tooltip/aria-label. The router is not a
 * dependency of the kit: pass the link component through `as` (e.g. react-router
 * `Link`) together with its own props such as `to`.
 */
export default function SidebarLink({
  as: Component = 'a',
  icon: Icon,
  label,
  badge,
  badgeClassName = '',
  active = false,
  collapsed = false,
  className = '',
  ...props
}) {
  return (
    <Component
      {...props}
      data-ui="sidebar-link"
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-2.5 rounded-aspectum-control py-1.5 text-sm font-medium transition-colors ${collapsed ? 'justify-center px-1' : 'px-2'} ${active ? 'bg-aspectum-primary-muted text-aspectum-primary-strong' : 'text-aspectum-text hover:bg-aspectum-surface-subtle'} ${className}`.trim()}
    >
      {Icon && <Icon className={`size-4 shrink-0 ${active ? '' : 'text-aspectum-text-muted'}`} aria-hidden="true" />}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {badge && !collapsed && (
        <span className={`ml-auto shrink-0 rounded-aspectum-compact px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-aspectum-on-accent ${badgeClassName || 'bg-aspectum-primary'}`}>
          {badge}
        </span>
      )}
    </Component>
  );
}
