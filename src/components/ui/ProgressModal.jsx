import Spinner from './Spinner';
import Modal from './Modal';
import ProgressBar from './ProgressBar';

/** Универсальная модалка с необязательным блокирующим прогрессом. */
export default function ProgressModal({
  open,
  onBackdropClick,
  titleId,
  busy = false,
  busyLabel = 'Загрузка…',
  progress = null,
  children,
  footer,
  maxWidthClass = 'max-w-lg',
}) {
  return (
    <Modal
      open={open}
      onClose={onBackdropClick}
      ariaLabelledBy={titleId}
      panelClassName={`${maxWidthClass} max-h-[min(100dvh-2rem,44rem)] min-h-0`}
      bodyClassName="p-6 space-y-4 pb-4"
      footer={footer}
      footerClassName="sticky bottom-0 z-10 bg-aspectum-surface shadow-aspectum-sticky-footer"
      priority
    >
        {busy && (
          <div className="absolute inset-0 bg-aspectum-surface/70 rounded-aspectum-modal flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
            <Spinner size="lg" className="border-aspectum-primary" />
            <div className="text-sm text-aspectum-text font-medium">{busyLabel}</div>
            {progress != null && (
              <div className="w-48">
                <ProgressBar value={progress} size="sm" transition="slow" label={busyLabel} />
                <div className="text-xs text-aspectum-text-muted text-center mt-1">{progress}%</div>
              </div>
            )}
          </div>
        )}
        {children}
    </Modal>
  );
}
