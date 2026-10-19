import { Button, Modal } from '@aspectum/ui';

/**
 * Подтверждение удаления города из сессии или всей сессии (список сессий).
 */
export default function SessionDeleteDialog({
  open,
  isDraftDelete,
  cityRow,
  session: targetSession,
  deleting,
  onBackdropClick,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      onClose={deleting ? undefined : onBackdropClick}
      title={isDraftDelete ? 'Удалить город?' : 'Удалить сессию?'}
      size="sm"
      footer={(
        <>
          <Button type="button" onClick={onCancel} disabled={deleting} variant="outline" size="md">
            Отмена
          </Button>
          <Button type="button" onClick={onConfirm} disabled={deleting} variant="danger" size="md">
            {deleting ? 'Удаление...' : isDraftDelete ? 'Удалить город' : 'Удалить сессию'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        {isDraftDelete ? (
          <p className="text-sm text-aspectum-text-subtle">
            Город{' '}
            <span className="font-medium">
              «{cityRow?.cityName || cityRow?.cityDraftId || 'Без названия'}»
            </span>{' '}
            будет удалён из сессии{' '}
            <span className="font-medium">
              «{targetSession?.name || targetSession?.uuid || targetSession?.id}»
            </span>.
            <br />
            Сама сессия останется.
          </p>
        ) : (
          <p className="text-sm text-aspectum-text-subtle">
            Сессия{' '}
            <span className="font-medium">
              «{targetSession?.name || targetSession?.uuid || targetSession?.id}»
            </span>{' '}
            будет удалена безвозвратно.
          </p>
        )}

      </div>
    </Modal>
  );
}
