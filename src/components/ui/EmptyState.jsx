export default function EmptyState({
  icon = '📄',
  title = 'Данных нет',
  description,
  actions,
  tone = 'neutral',
  spacing = 'lg',
  className = '',
}) {
  const titleTone = tone === 'danger' ? 'text-aspectum-danger' : 'text-aspectum-text';
  const spacingClass = { none: '', sm: 'p-3', md: 'p-6', lg: 'p-12' }[spacing] || 'p-12';

  return (
    <div className={`${spacingClass} text-center ${className}`.trim()}>
      {icon ? <div className="mb-3 text-4xl">{icon}</div> : null}
      <p className={`text-sm font-medium ${titleTone}`}>{title}</p>
      {description && <p className="mt-1 text-xs text-aspectum-text-muted">{description}</p>}
      {actions ? <div className="mt-4 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  );
}
