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
          <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center z-20 pointer-events-none">
            <div className="text-sm text-gray-700 font-medium">{busyLabel}</div>
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
