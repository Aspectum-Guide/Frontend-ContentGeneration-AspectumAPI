import { useEffect } from 'react';

/**
 * Универсальный модальный диалог.
 *
 * Props:
 *   open      — boolean
 *   onClose   — () => void
 *   title     — string
 *   children  — ReactNode
 *   size      — 'sm' | 'md' | 'lg' | 'xl'  (default 'md')
 *   footer    — ReactNode  (если задан — рендерится под children)
 */
export default function Modal({ open, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const maxW = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size] || 'max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className={`relative w-full ${maxW} bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]`}>
        {/* Header */}
        {(title || onClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            {title && (
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="ml-auto text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Диалог подтверждения.
 *
 * Props:
 *   open      — boolean
 *   onClose   — () => void
 *   onConfirm — () => void | Promise<void>
 *   title     — string
 *   message   — string | ReactNode
 *   confirmLabel  — string  (default 'Подтвердить')
 *   cancelLabel   — string  (default 'Отмена')
 *   danger    — boolean  (красная кнопка подтверждения)
 *   loading   — boolean
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Подтвердите действие',
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  loading = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {message && (
        <p className="text-sm text-gray-600">{message}</p>
      )}
      <div className="flex gap-3 mt-4">
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
            danger
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? 'Подождите...' : confirmLabel}
        </button>
        <button
          onClick={onClose}
          disabled={loading}
          className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      </div>
    </Modal>
  );
}
