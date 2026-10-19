const DEFAULT_SESSION_STATUS_MAP = {
  draft: { label: 'Черновик', cls: 'bg-aspectum-surface-muted text-aspectum-text' },
  in_progress: { label: 'В процессе', cls: 'bg-aspectum-warning-soft text-aspectum-warning' },
  completed: { label: 'Завершена', cls: 'bg-aspectum-success-soft text-aspectum-success' },
  published: { label: 'Опубликована', cls: 'bg-aspectum-primary-soft text-aspectum-primary-hover' },
  closed_saved: { label: 'Закрыта (сохранена)', cls: 'bg-aspectum-violet/10 text-aspectum-violet' },
  closed_discarded: { label: 'Закрыта (отменена)', cls: 'bg-aspectum-danger-soft text-aspectum-danger' },
  corrected: { label: 'Скорректирована', cls: 'bg-aspectum-teal/10 text-aspectum-teal' },
};

const TONE_CLASSES = {
  neutral: 'bg-aspectum-surface-muted text-aspectum-text-muted',
  success: 'bg-aspectum-success-muted text-aspectum-success-strong',
  warning: 'bg-aspectum-warning-muted text-aspectum-warning-strong',
  info: 'bg-aspectum-info-muted text-aspectum-info-strong',
  danger: 'bg-aspectum-danger-muted text-aspectum-danger-strong',
};

function isDefined(value) {
  return value !== undefined;
}

export default function StatusBadge(props) {
  // Mode C: generic semantic status (tone + label/children).
  if (isDefined(props?.tone)) {
    const { tone = 'neutral', label, children, className = '' } = props;
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone] || TONE_CLASSES.neutral} ${className}`.trim()}>
        {label ?? children}
      </span>
    );
  }

  // Mode A: session status badge (status + optional label).
  if (isDefined(props?.status)) {
    const {
      status,
      label,
      statusMap = DEFAULT_SESSION_STATUS_MAP,
      className = '',
    } = props;

    const state = statusMap?.[status] || { label: label || status, cls: 'bg-aspectum-surface-muted text-aspectum-text-muted' };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${state.cls} ${className}`.trim()}>
        {label || state.label}
      </span>
    );
  }

  // Mode B: active/inactive badge (catalog pages).
  const {
    active,
    activeLabel = 'Активен',
    inactiveLabel = 'Отключен',
    inactiveTone = 'gray',
    className = '',
  } = props || {};

  const inactiveClass = inactiveTone === 'red'
    ? 'bg-aspectum-danger-soft text-aspectum-danger'
    : 'bg-aspectum-surface-muted text-aspectum-text-muted';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-aspectum-success-soft text-aspectum-success' : inactiveClass} ${className}`.trim()}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function SessionStatusBadge({ status, label, className = '' }) {
  return <StatusBadge status={status} label={label} statusMap={DEFAULT_SESSION_STATUS_MAP} className={className} />;
}
