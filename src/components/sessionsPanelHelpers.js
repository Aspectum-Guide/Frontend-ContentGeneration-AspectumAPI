// Status groups shown as filter chips. "all" hides sessions closed without saving.
export const STATUS_FILTERS = [
  { id: 'work', label: 'В работе', status: 'draft,in_progress' },
  { id: 'done', label: 'Готовые', status: 'completed,corrected,closed_saved' },
  { id: 'published', label: 'Опубл.', status: 'published' },
  { id: 'all', label: 'Все', status: 'draft,in_progress,completed,corrected,closed_saved,published' },
];

export const STATUS_LABELS = {
  draft: 'Черновик',
  in_progress: 'В работе',
  completed: 'Завершена',
  corrected: 'Скорректирована',
  closed_saved: 'Закрыта',
  closed_discarded: 'Закрыта без сохранения',
  published: 'Опубликована',
};

export const STATUS_DOT = {
  draft: 'bg-aspectum-text-disabled',
  in_progress: 'bg-aspectum-warning',
  completed: 'bg-aspectum-success',
  corrected: 'bg-aspectum-teal',
  closed_saved: 'bg-aspectum-violet',
  closed_discarded: 'bg-aspectum-danger-light',
  published: 'bg-aspectum-primary',
};


const relativeFormat = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat('ru', { numeric: 'auto', style: 'short' })
  : null;

export function formatRelative(iso, now = Date.now()) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const seconds = Math.round((time - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'только что';
  const steps = [[60, 'minute', 60], [3600, 'hour', 24], [86400, 'day', 30], [2592000, 'month', 12]];
  for (const [size, unit, limit] of steps) {
    const value = Math.round(seconds / size);
    if (Math.abs(value) < limit || unit === 'month') {
      return relativeFormat ? relativeFormat.format(value, unit) : `${Math.abs(value)} ${unit}`;
    }
  }
  return '';
}

// City first (a session is a working city), the technical session name as a fallback.
export function sessionTitle(row) {
  const city = (row.city_display_name || '').trim();
  if (city) return city;
  const name = (row.name || '').trim();
  return name || 'Сессия без названия';
}
