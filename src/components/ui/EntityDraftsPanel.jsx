import EmptyState from './EmptyState';

export default function EntityDraftsPanel({
  title,
  items = [],
  renderItem,
  actions,
  emptyText = 'Пока нет черновиков',
  className = '',
}) {
  return (
    <section className={`rounded-aspectum-card border border-aspectum-border bg-aspectum-surface-muted p-3 ${className}`.trim()}>
      {(title || actions) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title && <p className="text-sm font-medium text-aspectum-text">{title}</p>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState title={emptyText} className="p-2" />
      ) : (
        <div className="flex flex-wrap gap-2">{items.map(renderItem)}</div>
      )}
    </section>
  );
}
