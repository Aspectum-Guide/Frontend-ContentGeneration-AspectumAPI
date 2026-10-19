import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { audioQueueAPI } from '../../api/generation';
import Layout from '../../components/Layout';
import { parseApiError } from '../../utils/apiError';

// Очередь пакетной озвучки по всем сессиям: что идёт, что ждёт и почему.
// Сервер держит очередь сам; страница только показывает её состояние.

const POLL_INTERVAL = 10000;

const PERIODS = [
  { hours: 24, label: 'Сутки' },
  { hours: 72, label: '3 дня' },
  { hours: 168, label: 'Неделя' },
];

const STATE_STYLES = {
  running: { label: 'Озвучивается', className: 'bg-blue-100 text-blue-800' },
  stalled: { label: 'Нет признаков жизни', className: 'bg-amber-100 text-amber-800' },
  waiting_worker: { label: 'Ждёт свободный воркер', className: 'bg-purple-100 text-purple-800' },
  queued: { label: 'В очереди', className: 'bg-gray-100 text-gray-700' },
  completed: { label: 'Готово', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Ошибка', className: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Отменено', className: 'bg-gray-100 text-gray-500' },
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
    <div className="py-3 border-t border-gray-100 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-10 font-mono text-sm font-semibold text-gray-900">
          {(item.language_code || '??').toUpperCase()}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.className}`}>
          {item.state === 'queued' ? `${style.label} · №${item.queue_position}` : style.label}
        </span>
        {item.total > 0 && (
          <span className="text-sm text-gray-700">
            {item.processed} из {item.total}
            {item.failed > 0 && <span className="ml-1 text-red-600">· ошибок {item.failed}</span>}
          </span>
        )}
        {eta && <span className="text-sm text-gray-500">· осталось ≈ {eta}</span>}
        {item.resume_attempts > 0 && (
          <span className="text-xs text-amber-700">перезапусков: {item.resume_attempts}</span>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {item.completed_at
            ? `закончено ${formatTime(item.completed_at)}`
            : item.started_at
              ? `начато ${formatTime(item.started_at)}`
              : `поставлено ${formatTime(item.created_at)}`}
        </span>
      </div>
      {item.total > 0 && item.state !== 'completed' && (
        <div className="mt-2 ml-12 h-1.5 bg-gray-100 rounded">
          <div className="h-1.5 bg-blue-500 rounded" style={{ width: `${percent}%` }} />
        </div>
      )}
      {hint && <p className="mt-1 ml-12 text-xs text-gray-500">{hint}</p>}
      {item.failed_guides.length > 0 && (
        <details className="mt-1 ml-12 text-xs text-red-700">
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
          <h1 className="text-2xl font-bold text-gray-900">Очередь озвучки</h1>
          <p className="mt-1 text-sm text-gray-500">
            Автообновление каждые {POLL_INTERVAL / 1000} сек.
            {lastUpdated && <span className="ml-2 text-gray-400">· {lastUpdated.toLocaleTimeString('ru-RU')}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map((period) => (
            <button
              key={period.hours}
              type="button"
              onClick={() => setHours(period.hours)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${hours === period.hours ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {period.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => load()}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            ↻ Обновить
          </button>
        </div>
      </div>

      {overview && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Очередь ведёт сервер, вкладку можно закрыть. В одной сессии одновременно озвучиваются
          не больше {overview.max_parallel_per_session} языков, остальные ждут и стартуют сами.
          Если озвучка замолкла дольше {overview.resume_after_minutes} мин, она перезапускается
          автоматически и продолжает с того гида, на котором остановилась.
        </div>
      )}

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && !overview && <div className="text-sm text-gray-500">Загрузка…</div>}

      {overview && sessions.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
          За выбранный период озвучки не было.
        </div>
      )}

      {overview && sessions.length > 0 && (
        <p className="mb-2 text-sm text-gray-600">
          {activeCount ? `Сейчас в работе сессий: ${activeCount}` : 'Сейчас ничего не озвучивается'}
        </p>
      )}

      <div className="space-y-4">
        {sessions.map((group) => (
          <div key={group.session_id} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div className="mb-1 flex flex-wrap items-baseline gap-2">
              <Link to={`/generation/${group.session_id}`} className="text-lg font-semibold text-blue-700 hover:underline">
                {group.place_name}
              </Link>
              {group.place_name !== group.session_name && (
                <span className="text-sm text-gray-400">{group.session_name}</span>
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
