export default function MediaPreview({ src, alt = '', placeholder = 'Нет изображения', children, fit = 'cover', className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-aspectum-card border border-aspectum-border bg-aspectum-surface-subtle ${className}`.trim()}>
      {src ? (
        <img src={src} alt={alt} className={`h-full w-full object-${fit}`} />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-2 text-center text-sm text-aspectum-text-disabled">
          {placeholder}
        </div>
      )}
      {children}
    </div>
  );
}
