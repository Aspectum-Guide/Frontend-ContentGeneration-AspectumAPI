import { useEffect, useState } from 'react';
import ModalPortal from './ModalPortal';

/**
 * Универсальный модальный диалог.
 *
 * Props:
 *   open      — boolean
 *   onClose   — () => void
 *   title     — string
 *   children  — ReactNode
 *   size      — 'sm' | 'md' | 'ml' | 'lg' | 'xl'  (default 'md')
 *   footer    — ReactNode  (если задан — рендерится под children)
 */
export default function Modal({ open, onClose, title, children, size = 'md', footer, priority = false }) {
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
    ml: 'max-w-xl',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size] || 'max-w-lg';

  const overlayZ = priority ? 110 : 100;

  return (
    <ModalPortal open={open} onClose={onClose} zIndex={overlayZ}>
      <div className={`relative w-full ${maxW} mx-auto bg-white rounded-2xl shadow-2xl flex flex-col max-h-[min(90dvh,90vh)] min-w-0`}>
        {(title || onClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            {title && (
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="ml-auto text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 min-w-0">{children}</div>

        {footer && (
          <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex gap-3">
            {footer}
          </div>
        )}
      </div>
    </ModalPortal>
  );
}

/**
 * Диалог подтверждения.
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
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState(null);

  useEffect(() => {
    if (open) setInternalError(null);
  }, [open]);

  const handleConfirm = async () => {
    setInternalError(null);
    setInternalLoading(true);
    try {
      await onConfirm();
    } catch (err) {
      setInternalError(err?.message || 'Произошла ошибка. Попробуйте ещё раз.');
    } finally {
      setInternalLoading(false);
    }
  };

  const busy = loading || internalLoading;

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={title} size="sm" priority>
      {message && (
        <p className="text-sm text-gray-600">{message}</p>
      )}
      {internalError && (
        <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{internalError}</p>
      )}
      <div className="flex gap-3 mt-4">
        <button
          onClick={handleConfirm}
          disabled={busy}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
            danger
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full inline-block" />
              Подождите...
            </span>
          ) : confirmLabel}
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      </div>
    </Modal>
  );
}
