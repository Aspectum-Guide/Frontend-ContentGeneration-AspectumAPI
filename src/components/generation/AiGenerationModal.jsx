import { ProgressModal } from '@aspectum/admin-ui-web';

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
  return (
    <ProgressModal
      open={open}
      onBackdropClick={onBackdropClick}
      titleId={titleId}
      busy={busy}
      busyLabel={busyLabel}
      progress={progress}
      footer={footer}
      maxWidthClass={maxWidthClass}
    >
      {children}
    </ProgressModal>
  );
}
