import { createPortal } from 'react-dom';
import { useModalScrollLock } from './useModalScrollLock';

/**
 * Полноэкранный оверлей + слот для диалога.
 * Backdrop фиксирован отдельно и не прокручивается вместе с длинным контентом.
 */
export default function ModalPortal({
  open,
  onClose,
  zIndex = 100,
  children,
}) {
  useModalScrollLock(open);

  if (!open) return null;

  const backdropZ = zIndex;
  const contentZ = zIndex + 1;

  return createPortal(
    <>
      <div
        role="presentation"
        aria-hidden="true"
        className="fixed top-0 left-0 w-screen h-[100dvh] min-h-screen bg-black/50"
        style={{ zIndex: backdropZ }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 left-0 w-screen h-[100dvh] min-h-screen overflow-y-auto pointer-events-none"
        style={{ zIndex: contentZ }}
      >
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="pointer-events-auto w-full min-w-0">{children}</div>
        </div>
      </div>
    </>,
    document.body,
  );
}
