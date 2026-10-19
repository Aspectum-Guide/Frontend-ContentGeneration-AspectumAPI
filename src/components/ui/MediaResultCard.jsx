export default function MediaResultCard({
  title = '',
  thumb = '',
  author = '',
  license = '',
  badge = '',
  onSelect,
  disabled = false,
}) {
  return (
    <button
      type="button"
      className="relative w-full text-left border border-aspectum-border rounded-aspectum-control overflow-hidden cursor-pointer hover:border-aspectum-primary hover:shadow-aspectum-card transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={onSelect}
      disabled={disabled}
      aria-label="Выбрать изображение"
    >
      {badge && <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-aspectum-overlay-strong text-aspectum-on-accent text-[10px] leading-none">{badge}</span>}
      <div className="aspect-square bg-aspectum-surface-muted overflow-hidden">
        {thumb ? <img src={thumb} alt={title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-aspectum-text-muted text-sm">Нет превью</div>}
      </div>
      <div className="p-2">
        <div className="text-xs font-medium text-aspectum-text truncate" title={title}>{title || 'Без названия'}</div>
        <div className="text-xs text-aspectum-text-muted truncate" title={author}>Автор: {author || '—'}</div>
        <div className="text-xs text-aspectum-text-muted truncate" title={license}>Лицензия: {license || '—'}</div>
      </div>
    </button>
  );
}
