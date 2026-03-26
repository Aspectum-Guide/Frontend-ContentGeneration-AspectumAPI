import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { tasksAPI } from '../../api/generation';

const POLL_INTERVAL = 8000;

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS = {
  pending: 'Ожидание',
  processing: 'Выполняется',
  running: 'Выполняется',
  completed: 'Завершена',
  failed: 'Ошибка',
  cancelled: 'Отменена',
};

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const intervalRef = useRef(null);

  const loadTasks = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const response = await tasksAPI.list();
      const data = response?.data;
      const list = Array.isArray(data?.tasks) ? data.tasks
        : Array.isArray(data) ? data
        : Array.isArray(data?.results) ? data.results : [];
      setTasks(list);
      setLastUpdated(new Date());
    } catch (err) {
      if (!silent) setError(err?.response?.data?.error || err.message || 'Ошибка загрузки задач');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    intervalRef.current = setInterval(() => loadTasks(true), POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [loadTasks]);

  const filtered = tasks.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (t.task_type_display || t.task_type || '').toLowerCase().includes(q) ||
      (t.status_display || t.status || '').toLowerCase().includes(q) ||
      (t.current_step || '').toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      key: 'task_type',
      label: 'Тип задачи',
      render: (type, row) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {row.task_type_display || type || '—'}
          </div>
          {row.session_id && (
            <div className="text-xs text-gray-400 font-mono mt-0.5">
              Сессия: {String(row.session_id).slice(0, 12)}…
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Статус',
      render: (status, row) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
          {(status === 'running' || status === 'processing') && (
            <span className="animate-spin w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full inline-block" />
          )}
          {row.status_display || STATUS_LABELS[status] || status}
        </span>
      ),
    },
    {
      key: 'progress',
      label: 'Прогресс',
      render: (progress) =>
        progress != null ? (
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-gray-500 shrink-0">{progress}%</span>
          </div>
        ) : <span className="text-gray-300">—</span>,
    },
    {
      key: 'current_step',
      label: 'Текущий шаг',
      className: 'text-xs text-gray-500 max-w-xs',
      render: (step) => step
        ? <span className="truncate block" title={step}>{step}</span>
        : <span className="text-gray-300">—</span>,
    },
    {
      key: 'created_at',
      label: 'Создана',
      className: 'whitespace-nowrap text-xs text-gray-500',
      render: (v) => v ? new Date(v).toLocaleString('ru-RU') : '—',
    },
  ];

  const hasActive = tasks.some((t) => t.status === 'running' || t.status === 'processing' || t.status === 'pending');

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Задачи генерации</h1>
          <p className="mt-1 text-sm text-gray-500">
            Автообновление каждые {POLL_INTERVAL / 1000} сек.
            {hasActive && (
              <span className="ml-2 inline-flex items-center gap-1 text-blue-600">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse inline-block" />
                Есть активные
              </span>
            )}
            {lastUpdated && (
              <span className="ml-2 text-gray-400">
                · {lastUpdated.toLocaleTimeString('ru-RU')}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => loadTasks()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ↻ Обновить
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        error={error}
        emptyIcon="📋"
        emptyText={search ? 'Задач по запросу нет' : 'Задач пока нет'}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по типу, шагу..."
      />
    </Layout>
  );
}
