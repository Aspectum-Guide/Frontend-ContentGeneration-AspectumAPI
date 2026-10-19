export default function DataTableSurface({ children, className = '', ariaLabel = 'Таблица', ...props }) {
  return <div role="region" aria-label={ariaLabel} className={`overflow-x-auto rounded-aspectum-card border border-aspectum-border bg-aspectum-surface ${className}`.trim()} {...props}>{children}</div>;
}
