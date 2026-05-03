import { useCallback, useState } from 'react';
import { ConfirmModal as DefaultConfirmModal } from './Modal.jsx';

/**
 * Промис-обёртка над модалкой подтверждения (аналог window.confirm).
 * Рендерите confirmModal рядом с корнём страницы.
 *
 * @param {React.ComponentType} ConfirmModalComponent — можно подменить через components.ConfirmModal
 */
export function useConfirmModal(ConfirmModalComponent = DefaultConfirmModal) {
  const C = ConfirmModalComponent;
  const [payload, setPayload] = useState(null);

  const confirm = useCallback((opts) => {
    const normalized = typeof opts === 'string' ? { message: opts } : (opts || {});

    return new Promise((resolve) => {
      setPayload({ ...normalized, resolve });
    });
  }, []);

  const finish = useCallback((result) => {
    setPayload((p) => {
      if (p?.resolve) p.resolve(result);
      return null;
    });
  }, []);

  const modal = payload ? (
    <C
      open
      onClose={() => finish(false)}
      onConfirm={() => finish(true)}
      title={payload.title ?? 'Подтвердите действие'}
      message={payload.message}
      danger={!!payload.danger}
      confirmLabel={payload.confirmLabel}
      cancelLabel={payload.cancelLabel}
      loading={!!payload.loading}
    />
  ) : null;

  return { confirm, confirmModal: modal };
}
