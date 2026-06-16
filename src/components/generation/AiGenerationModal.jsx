export function WizardGenerationActionFooter({ children, className = '' }) {
  return (
    <div className={`flex justify-end gap-2 flex-wrap ${className}`.trim()}>
      {children}
    </div>
  );
}

export default function AiGenerationModal({
  open,
  onBackdropClick,
  titleId,
  busy = false,
  busyLabel = 'Генерация…',
  progress = null,
  children,
  footer,
  maxWidthClass = 'max-w-lg',
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white rounded-xl ${maxWidthClass} w-full shadow-xl relative flex flex-col max-h-[min(100dvh-2rem,44rem)] min-h-0 my-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {busy && (
          <div className="absolute inset-0 bg-white/70 rounded-xl flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            <div className="text-sm text-gray-700 font-medium">{busyLabel}</div>
            {progress != null && (
              <div className="w-48">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">{progress}%</div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-4 pb-4">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 sticky bottom-0 z-10 border-t border-gray-200 bg-white px-6 py-4 rounded-b-xl shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
