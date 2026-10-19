import { Button, Modal, RadioGroup, Spinner } from '@aspectum/ui';

const CLOSE_OPTIONS = [
  {
    mode: 'save',
    title: 'Сохранить',
    desc: 'Данные сессии сохранятся, можно будет опубликовать позже',
    cls: 'border-aspectum-focus bg-aspectum-primary-soft',
  },
  {
    mode: 'discard',
    title: 'Отменить',
    desc: 'Данные сессии будут удалены без сохранения',
    cls: 'border-aspectum-danger-subtle bg-aspectum-danger-soft',
  },
];

/**
 * Закрытие сессии с выбором режима (сохранить / отменить).
 */
export default function SessionCloseDialog({
  open,
  session,
  closeMode,
  onCloseModeChange,
  closing,
  onBackdropClick,
  onCancel,
  onConfirm,
}) {
  if (!session) return null;

  return (
    <Modal
      open={open}
      onClose={closing ? undefined : onBackdropClick}
      title="Закрыть сессию"
      size="sm"
      footer={(
        <>
          <Button
            type="button"
            onClick={onCancel}
            disabled={closing}
            variant="outline"
            size="md"
          >
            Отмена
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={closing}
            variant={closeMode === 'discard' ? 'danger' : 'primary'}
            size="md"
          >
            {closing ? (
              <span className="flex items-center gap-1.5">
                <Spinner size="sm" className="border-aspectum-on-accent" />
                Закрытие...
              </span>
            ) : closeMode === 'discard' ? (
              'Закрыть без сохранения'
            ) : (
              'Закрыть с сохранением'
            )}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="text-sm text-aspectum-text-subtle">
          Сессия{' '}
          <span className="font-medium">
            «{session.name || session.uuid || session.id}»
          </span>{' '}
          будет закрыта. Выберите режим:
        </p>

        <RadioGroup
          name="closeMode"
          value={closeMode}
          onChange={onCloseModeChange}
          options={CLOSE_OPTIONS.map((opt) => ({
            value: opt.mode,
            label: opt.title,
            description: opt.desc,
            activeClass: opt.cls,
          }))}
        />
      </div>
    </Modal>
  );
}
