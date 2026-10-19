import { ChevronRight } from 'lucide-react';

/**
 * Collapsible navigation group. Controlled: the parent owns `open` so it can open
 * the group that contains the current route and remember the rest. In the
 * collapsed rail the header disappears and a thin divider separates the groups.
 */
export default function SidebarGroup({
  title,
  icon: Icon,
  open = true,
  onToggle,
  collapsed = false,
  children,
  className = '',
}) {
  const panelId = `sidebar-group-${String(title).replace(/\s+/g, '-').toLowerCase()}`;

  if (collapsed) {
    return (
      <div data-ui="sidebar-group" data-collapsed="true" className={`space-y-0.5 border-t border-aspectum-border-subtle pt-2 first:border-t-0 first:pt-0 ${className}`.trim()}>
        {children}
      </div>
    );
  }

  return (
    <div data-ui="sidebar-group" className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 rounded-aspectum-control px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-aspectum-text-disabled transition-colors hover:text-aspectum-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-aspectum-focus"
      >
        {Icon && <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate text-left">{title}</span>
        <ChevronRight className={`size-3 shrink-0 opacity-70 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="ml-3.5 mt-0.5 space-y-0.5 border-l border-aspectum-border pl-1.5">
          {children}
        </div>
      )}
    </div>
  );
}
