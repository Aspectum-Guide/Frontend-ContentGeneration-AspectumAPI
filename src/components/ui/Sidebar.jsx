/**
 * Layout-only sidebar shell. Navigation and application actions stay outside
 * the UI kit and are supplied as children.
 */
export default function Sidebar({
  children,
  className = '',
  side = 'left',
  mobile = false,
  label = 'Основная навигация',
  expanded,
}) {
  const sideClass = side === 'right' ? 'right-0 border-l' : 'left-0 border-r';

  return (
    <aside
      data-ui="sidebar"
      data-side={side}
      data-mobile={mobile ? 'true' : 'false'}
      aria-label={label}
      aria-expanded={expanded === undefined ? undefined : expanded}
      className={`${sideClass} ${className}`}
    >
      {children}
    </aside>
  );
}
