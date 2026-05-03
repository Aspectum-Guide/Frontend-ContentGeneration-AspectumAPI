const DEFAULT_SESSION_STATUS_MAP = {
  draft: { label: 'Черновик', cls: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'В процессе', cls: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Завершена', cls: 'bg-green-100 text-green-800' },
  published: { label: 'Опубликована', cls: 'bg-blue-100 text-blue-800' },
  closed_saved: { label: 'Закрыта (сохранена)', cls: 'bg-purple-100 text-purple-700' },
  closed_discarded: { label: 'Закрыта (отменена)', cls: 'bg-red-100 text-red-700' },
  corrected: { label: 'Скорректирована', cls: 'bg-teal-100 text-teal-700' },
};

function isDefined(value) {
  return value !== undefined;
}

export default function StatusBadge(props) {
  // Mode A: session status badge (status + optional label).
  if (isDefined(props?.status)) {
    const {
      status,
      label,
      statusMap = DEFAULT_SESSION_STATUS_MAP,
      className = '',
    } = props;

    const state = statusMap?.[status] || { label: label || status, cls: 'bg-gray-100 text-gray-600' };

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
    ? 'bg-red-100 text-red-700'
    : 'bg-gray-100 text-gray-500';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-green-100 text-green-700' : inactiveClass} ${className}`.trim()}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function SessionStatusBadge({ status, label, className = '' }) {
  return <StatusBadge status={status} label={label} statusMap={DEFAULT_SESSION_STATUS_MAP} className={className} />;
}

export function getDefaultSessionStatusMap() {
  return DEFAULT_SESSION_STATUS_MAP;
}
