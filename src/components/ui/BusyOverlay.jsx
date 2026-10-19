import { createPortal } from 'react-dom';
import Spinner from './Spinner';
import { useModalScrollLock } from './useModalScrollLock';

/** Полноэкранное блокирующее состояние для подготовки данных вне модалки. */
export default function BusyOverlay({ open, label = 'Загрузка…', priority = false }) {
  useModalScrollLock(open);

  if (!open) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 bg-aspectum-surface/75 backdrop-blur-sm flex items-center justify-center"
      style={{ zIndex: priority ? 120 : 90 }}
    >
      <div className="px-4 py-3 rounded-aspectum-card border border-aspectum-border bg-aspectum-surface shadow-aspectum-card flex items-center gap-2 text-sm text-aspectum-text-strong">
        <Spinner size="sm" className="border-aspectum-focus" decorative />
        {label}
      </div>
    </div>,
    document.body,
  );
}
