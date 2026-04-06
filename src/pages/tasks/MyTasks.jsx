import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { useLayoutActions } from '../../context/LayoutActionsContext';
import { tasksAPI } from '../../api/generation';
import { parseApiError } from '../../utils/apiError';

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
  const { setMobileActions } = useLayoutActions();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskDetails, setTaskDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const intervalRef = useRef(null);
  const detailsIntervalRef = useRef(null);

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
      if (!silent) setError(parseApiError(err, 'Ошибка загрузки задач'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    intervalRef.current = setInterval(() => loadTasks(true), POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [loadTasks]);

  const loadTaskDetails = useCallback(async (taskId, silent = false) => {
    if (!taskId) return;
    try {
      if (!silent) setDetailsLoading(true);
      setDetailsError(null);
      const response = await tasksAPI.get(taskId);
      setTaskDetails(response?.data || null);
    } catch (err) {
      if (!silent) {
        setDetailsError(parseApiError(err, 'Ошибка загрузки деталей задачи'));
      }
    } finally {
      if (!silent) setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!detailsOpen || !selectedTaskId) {
      if (detailsIntervalRef.current) clearInterval(detailsIntervalRef.current);
      return;
    }

    loadTaskDetails(selectedTaskId);
    detailsIntervalRef.current = setInterval(() => {
      const status = taskDetails?.status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') return;
      loadTaskDetails(selectedTaskId, true);
    }, 4000);

    return () => {
      if (detailsIntervalRef.current) clearInterval(detailsIntervalRef.current);
    };
  }, [detailsOpen, selectedTaskId, taskDetails?.status, loadTaskDetails]);

  const openDetails = (task) => {
    setSelectedTaskId(task.id);
    setTaskDetails(null);
    setDetailsError(null);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedTaskId(null);
    setTaskDetails(null);
    setDetailsError(null);
  };

  const formatDateTime = (value) => (value ? new Date(value).toLocaleString('ru-RU') : '—');

  const extractTaskLogs = (details) => {
    if (!details) return [];

    const candidates = [
      details.logs,
      details.log,
      details.result_data?.logs,
      details.result_data?.log,
      details.result_data?.messages,
      details.result_data?.events,
      details.result_data?.steps,
      details.result_data?.history,
      details.result_data?.trace,
    ];

    for (const value of candidates) {
      if (Array.isArray(value)) {
        return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).filter(Boolean);
      }
      if (typeof value === 'string' && value.trim()) {
        return value.split('\n').map((line) => line.trim()).filter(Boolean);
      }
    }

    return [];
  };

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

  useEffect(() => {
    const actions = [
      {
        id: 'refresh-tasks',
        label: 'Обновить список задач',
        onClick: () => loadTasks(),
        variant: 'primary',
      },
    ];

    if (detailsOpen && selectedTaskId) {
      actions.push({
        id: 'refresh-task-details',
        label: 'Обновить детали задачи',
        onClick: () => loadTaskDetails(selectedTaskId),
      });
      actions.push({
        id: 'close-task-details',
        label: 'Закрыть детали',
        onClick: closeDetails,
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [detailsOpen, selectedTaskId, setMobileActions, loadTasks, loadTaskDetails]);

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
        onRowClick={openDetails}
        actions={(row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openDetails(row);
            }}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
          >
            Подробнее
          </button>
        )}
      />

      <Modal
        open={detailsOpen}
        onClose={closeDetails}
        title={taskDetails?.task_type_display ? `Задача: ${taskDetails.task_type_display}` : 'Детали задачи'}
        size="xl"
      >
        {detailsError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {detailsError}
          </div>
        )}

        {detailsLoading && !taskDetails ? (
          <div className="py-8 flex items-center justify-center text-sm text-gray-500">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full mr-2" />
            Загрузка информации о задаче...
          </div>
        ) : taskDetails ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InfoRow label="ID задачи" value={taskDetails.id || '—'} mono />
              <InfoRow label="Celery Task ID" value={taskDetails.celery_task_id || '—'} mono />
              <InfoRow label="ID сессии" value={taskDetails.session_id || '—'} mono />
              <InfoRow label="Сессия" value={taskDetails.session_name || '—'} />
              <InfoRow label="Статус" value={taskDetails.status_display || STATUS_LABELS[taskDetails.status] || taskDetails.status || '—'} />
              <InfoRow label="Прогресс" value={taskDetails.progress != null ? `${taskDetails.progress}%` : '—'} />
              <InfoRow label="Текущий шаг" value={taskDetails.current_step || '—'} />
              <InfoRow label="Создана" value={formatDateTime(taskDetails.created_at)} />
              <InfoRow label="Старт" value={formatDateTime(taskDetails.started_at)} />
              <InfoRow label="Завершена" value={formatDateTime(taskDetails.completed_at)} />
              <InfoRow label="Длительность" value={taskDetails.duration_seconds != null ? `${taskDetails.duration_seconds} сек` : '—'} />
            </div>

            {taskDetails.error_message && (
              <section className="rounded-lg border border-red-200 bg-red-50 p-3">
                <h3 className="text-sm font-semibold text-red-800 mb-2">Ошибка</h3>
                <pre className="text-xs text-red-700 whitespace-pre-wrap break-words">{taskDetails.error_message}</pre>
              </section>
            )}

            <section className="rounded-lg border border-gray-200 p-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Логи / шаги выполнения</h3>
              {extractTaskLogs(taskDetails).length > 0 ? (
                <div className="max-h-56 overflow-auto rounded border border-gray-200 bg-gray-50 p-2">
                  {extractTaskLogs(taskDetails).map((line, idx) => (
                    <div key={`${idx}-${line.slice(0, 20)}`} className="font-mono text-xs text-gray-700 py-0.5">
                      {line}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Логи не были переданы сервером для этой задачи.</p>
              )}
            </section>

            <section className="rounded-lg border border-gray-200 p-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">result_data (полный JSON)</h3>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words bg-gray-50 rounded border border-gray-200 p-2 max-h-64 overflow-auto">
                {JSON.stringify(taskDetails.result_data ?? null, null, 2)}
              </pre>
            </section>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => loadTaskDetails(selectedTaskId)}
                className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Обновить детали
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Layout>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="rounded-md border border-gray-200 px-3 py-2 bg-gray-50">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-sm text-gray-900 break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </div>
    </div>
  );
}
