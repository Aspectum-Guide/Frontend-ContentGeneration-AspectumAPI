/** Компактная шапка detail/workbench-экрана с навигацией, метаданными и действиями. */
export default function DetailHeader({
  leading,
  title,
  titleAdornment,
  metadata,
  status,
  actions,
  className = '',
}) {
  return (
    <header className={`mb-5 flex items-center justify-between gap-4 border-b border-aspectum-border pb-4 ${className}`.trim()}>
      <div className="flex min-w-0 items-center gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-bold text-aspectum-text">{title}</h1>
            {titleAdornment}
          </div>
          {metadata ? <div className="mt-0.5 flex items-center gap-3 text-xs text-aspectum-text-disabled">{metadata}</div> : null}
        </div>
      </div>
      {status || actions ? (
        <div className="flex shrink-0 items-center gap-3">
          {status}
          {actions}
        </div>
      ) : null}
    </header>
  );
}
