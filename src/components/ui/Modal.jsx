import { useEffect, useId, useRef, useState } from 'react';
import ModalPortal from './ModalPortal';
import Alert from './Alert';
import Button from './Button';
import Spinner from './Spinner';
import IconButton from './IconButton';
import { isTopModal, registerModal, unregisterModal } from './modalStack';
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Универсальный модальный диалог.
 *
 * Props:
 *   open      — boolean
 *   onClose   — () => void
 *   title     — string
 *   description — string | ReactNode (подзаголовок в шапке)
 *   children  — ReactNode
 *   size      — 'sm' | 'md' | 'ml' | 'lg' | 'xl'  (default 'md')
 *   footer    — ReactNode  (если задан — рендерится под children)
 *   toolbar   — ReactNode  (закреплённая область между шапкой и прокручиваемым телом)
 *   bodyRef   — ref прокручиваемого тела, например для infinite scroll
 *   bodyClassName — классы тела; при передаче заменяют стандартные padding-классы
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  footer,
  toolbar,
  bodyRef,
  bodyClassName,
  panelClassName = '',
  footerClassName = '',
  ariaLabelledBy,
  ariaLabel,
  priority = false,
}) {
  const panelRef = useRef(null);
  const modalTokenRef = useRef(Symbol('modal'));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const effectiveLabelledBy = ariaLabelledBy || (title ? generatedTitleId : undefined);

  useEffect(() => {
    if (!open) return;
    const token = modalTokenRef.current;
    const previouslyFocused = document.activeElement;
    registerModal(token);

    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      const initialTarget = panel.querySelector('[autofocus]') || panel.querySelector(FOCUSABLE_SELECTOR) || panel;
      initialTarget.focus();
    }

    const handler = (event) => {
      if (!isTopModal(token)) return;
      if (event.key === 'Escape') {
        if (onCloseRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      unregisterModal(token);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

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
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : effectiveLabelledBy}
        aria-describedby={description ? generatedDescriptionId : undefined}
        tabIndex={-1}
        className={`relative w-full ${maxW} mx-auto bg-aspectum-surface rounded-aspectum-modal shadow-aspectum-modal flex flex-col max-h-[min(90dvh,90vh)] min-w-0 ${panelClassName}`.trim()}
      >
        {(title || description || onClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-aspectum-border shrink-0">
            {(title || description) && (
              <div className="min-w-0">
                {title && <h2 id={generatedTitleId} className="text-base font-semibold text-aspectum-text">{title}</h2>}
                {description && <div id={generatedDescriptionId} className="mt-1 text-sm text-aspectum-text-muted">{description}</div>}
              </div>
            )}
            {onClose && (
              <IconButton
                onClick={onClose}
                label="Закрыть"
                className="ml-auto w-8 h-8"
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            )}
          </div>
        )}

        {toolbar && <div className="shrink-0">{toolbar}</div>}

        <div
          ref={bodyRef}
          className={`flex-1 overflow-y-auto overflow-x-hidden min-w-0 ${bodyClassName || 'px-6 py-4'}`}
        >
          {children}
        </div>

        {footer && (
          <div className={`shrink-0 px-6 py-4 border-t border-aspectum-border bg-aspectum-surface-muted rounded-b-aspectum-modal flex gap-3 ${footerClassName}`.trim()}>
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
  children,
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
        <p className="text-sm text-aspectum-text-muted whitespace-pre-line">{message}</p>
      )}
      {internalError && <Alert tone="error" className="mt-2">{internalError}</Alert>}
      {children}
      <div className="flex gap-3 mt-4">
        <Button
          onClick={handleConfirm}
          disabled={busy}
          variant={danger ? 'danger' : 'primary'}
          size="md"
          className="flex-1"
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" className="border-aspectum-on-accent" />
              Подождите...
            </span>
          ) : confirmLabel}
        </Button>
        <Button
          onClick={onClose}
          disabled={busy}
          variant="secondary"
          size="md"
          className="flex-1"
        >
          {cancelLabel}
        </Button>
      </div>
    </Modal>
  );
}
