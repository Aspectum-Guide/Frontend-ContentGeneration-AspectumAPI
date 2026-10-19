import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { audioQueueAPI } from '../../api/generation';
import Layout from '../../components/Layout';
import { parseApiError } from '../../utils/apiError';
import { Glyph } from '@aspectum/admin-ui-web';

// Очередь пакетной озвучки по всем сессиям: что идёт, что ждёт и почему.
// Сервер держит очередь сам; страница только показывает её состояние.

const POLL_INTERVAL = 10000;

const PERIODS = [
  { hours: 24, label: 'Сутки' },
  { hours: 72, label: '3 дня' },
  { hours: 168, label: 'Неделя' },
];

const STATE_STYLES = {
  running: { label: 'Озвучивается', className: 'bg-aspectum-primary-muted text-aspectum-primary-strong' },
  stalled: { label: 'Нет признаков жизни', className: 'bg-aspectum-warning-muted text-aspectum-warning-emphasis' },
  waiting_worker: { label: 'Ждёт свободный воркер', className: 'bg-aspectum-purple-muted text-aspectum-purple-emphasis' },
  queued: { label: 'В очереди', className: 'bg-aspectum-surface-subtle text-aspectum-text-strong' },
  completed: { label: 'Готово', className: 'bg-aspectum-positive-muted text-aspectum-positive-emphasis' },
  failed: { label: 'Ошибка', className: 'bg-aspectum-danger-muted text-aspectum-danger-emphasis' },
  cancelled: { label: 'Отменено', className: 'bg-aspectum-surface-subtle text-aspectum-text-muted' },
};

function formatDuration(seconds) {
  if (seconds == null) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function minutesSince(value) {
  if (!value) return null;
  return Math.round((Date.now() - new Date(value).getTime()) / 60000);
}

function stateHint(item, group, overview) {
  switch (item.state) {
    case 'queued': {
      const busy = group.busy_languages.map((code) => code.toUpperCase()).join(', ');
      return busy
        ? `№${item.queue_position} в очереди. Сейчас озвучиваются ${busy}: в одной сессии идёт не больше ${overview.max_parallel_per_session} языков сразу. Начнётся сам.`
        : `№${item.queue_position} в очереди. Начнётся сам в течение нескольких минут.`;
    }
    case 'waiting_worker':
      return 'Отдана на озвучку, но все потоки сервера заняты другими сессиями. Начнётся, как только один освободится.';
    case 'stalled':
      return `Не отвечает ${minutesSince(item.updated_at)} мин. Если молчит дольше ${overview.resume_after_minutes} мин, перезапустится сама и продолжит с того же места.`;
    case 'failed':
      return item.error_message || 'Задача завершилась с ошибкой.';
    default:
      return item.current_step;
  }
}

function LanguageRow({ item, group, overview }) {
  const style = STATE_STYLES[item.state] || STATE_STYLES.queued;
  const percent = item.total ? Math.min(100, Math.round((item.processed / item.total) * 100)) : 0;
  const eta = formatDuration(item.eta_seconds);
  const hint = stateHint(item, group, overview);

  return (
    <div className="py-3 border-t border-aspectum-border-subtle first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-10 font-mono text-sm font-semibold text-aspectum-text">
          {(item.language_code || '??').toUpperCase()}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.className}`}>
          {item.state === 'queued' ? `${style.label} · №${item.queue_position}` : style.label}
        </span>
        {item.total > 0 && (
          <span className="text-sm text-aspectum-text-strong">
            {item.processed} из {item.total}
            {item.failed > 0 && <span className="ml-1 text-aspectum-danger">· ошибок {item.failed}</span>}
          </span>
        )}
        {eta && <span className="text-sm text-aspectum-text-muted">· осталось ≈ {eta}</span>}
        {item.resume_attempts > 0 && (
          <span className="text-xs text-aspectum-warning-strong">перезапусков: {item.resume_attempts}</span>
        )}
        <span className="ml-auto text-xs text-aspectum-text-disabled">
          {item.completed_at
            ? `закончено ${formatTime(item.completed_at)}`
            : item.started_at
              ? `начато ${formatTime(item.started_at)}`
              : `поставлено ${formatTime(item.created_at)}`}
        </span>
      </div>
      {item.total > 0 && item.state !== 'completed' && (
        <div className="mt-2 ml-12 h-1.5 bg-aspectum-surface-subtle rounded">
          <div className="h-1.5 bg-aspectum-primary-light rounded" style={{ width: `${percent}%` }} />
        </div>
      )}
      {hint && <p className="mt-1 ml-12 text-xs text-aspectum-text-muted">{hint}</p>}
      {item.failed_guides.length > 0 && (
        <details className="mt-1 ml-12 text-xs text-aspectum-danger-strong">
          <summary className="cursor-pointer">
            Не озвучены ({item.failed_guides.length}) — запустите озвучку этих гидов ещё раз
          </summary>
          <ul className="mt-1 list-disc pl-5">
            {item.failed_guides.map((name) => <li key={name}>{name}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function AudioQueue() {
  const [overview, setOverview] = useState(null);
  const [hours, setHours] = useState(24);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await audioQueueAPI.overview({ hours });
      setOverview(response.data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (!silent) setError(parseApiError(err, 'Не удалось загрузить очередь озвучки'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  const sessions = overview?.sessions || [];
  const activeCount = sessions.filter((group) => group.active).length;

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-aspectum-text">Очередь озвучки</h1>
          <p className="mt-1 text-sm text-aspectum-text-muted">
            Автообновление каждые {POLL_INTERVAL / 1000} сек.
            {lastUpdated && <span className="ml-2 text-aspectum-text-disabled">· {lastUpdated.toLocaleTimeString('ru-RU')}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map((period) => (
            <button
              key={period.hours}
              type="button"
              onClick={() => setHours(period.hours)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${hours === period.hours ? 'bg-aspectum-primary text-aspectum-on-accent' : 'bg-aspectum-surface-subtle text-aspectum-text-strong hover:bg-aspectum-border'}`}
            >
              {period.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => load()}
            className="px-3 py-1.5 text-sm font-medium text-aspectum-text-strong bg-aspectum-surface border border-aspectum-border-strong rounded-md hover:bg-aspectum-surface-muted"
          >
            <Glyph name="↻" /> Обновить
          </button>
        </div>
      </div>

      {overview && (
        <div className="mb-4 rounded-lg border border-aspectum-primary-muted bg-aspectum-primary-soft px-4 py-3 text-sm text-aspectum-primary-emphasis">
          Очередь ведёт сервер, вкладку можно закрыть. В одной сессии одновременно озвучиваются
          не больше {overview.max_parallel_per_session} языков, остальные ждут и стартуют сами.
          Если озвучка замолкла дольше {overview.resume_after_minutes} мин, она перезапускается
          автоматически и продолжает с того гида, на котором остановилась.
        </div>
      )}

      {error && <div className="mb-4 rounded-lg bg-aspectum-danger-soft px-4 py-3 text-sm text-aspectum-danger-strong">{error}</div>}
      {loading && !overview && <div className="text-sm text-aspectum-text-muted">Загрузка…</div>}

      {overview && sessions.length === 0 && (
        <div className="rounded-lg border border-aspectum-border bg-aspectum-surface px-4 py-6 text-center text-sm text-aspectum-text-muted">
          За выбранный период озвучки не было.
        </div>
      )}

      {overview && sessions.length > 0 && (
        <p className="mb-2 text-sm text-aspectum-text-subtle">
          {activeCount ? `Сейчас в работе сессий: ${activeCount}` : 'Сейчас ничего не озвучивается'}
        </p>
      )}

      <div className="space-y-4">
        {sessions.map((group) => (
          <div key={group.session_id} className="rounded-lg border border-aspectum-border bg-aspectum-surface px-4 py-3">
            <div className="mb-1 flex flex-wrap items-baseline gap-2">
              <Link to={`/generation/${group.session_id}`} className="text-lg font-semibold text-aspectum-primary-strong hover:underline">
                {group.place_name}
              </Link>
              {group.place_name !== group.session_name && (
                <span className="text-sm text-aspectum-text-disabled">{group.session_name}</span>
              )}
            </div>
            {group.items.map((item) => (
              <LanguageRow key={item.task_id} item={item} group={group} overview={overview} />
            ))}
          </div>
        ))}
      </div>
    </Layout>
  );
}
