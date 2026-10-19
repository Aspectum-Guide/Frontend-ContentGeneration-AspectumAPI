import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { tasksAPI, aiAPI } from '../../api/generation';
import Layout from '../../components/Layout';
import { Button, Alert, DataTable, Heading, Modal, PageHeader, Panel, ProgressBar, Spinner, formGridClassName } from '@aspectum/ui';
import { useLayoutActions } from '../../context/useLayoutActions';
import { parseApiError } from '../../utils/apiError';

const POLL_INTERVAL = 8000;

const STATUS_STYLES = {
  pending: 'bg-aspectum-caution-muted text-aspectum-caution-emphasis',
  processing: 'bg-aspectum-primary-muted text-aspectum-primary-strong',
  running: 'bg-aspectum-primary-muted text-aspectum-primary-strong',
  completed: 'bg-aspectum-positive-muted text-aspectum-positive-emphasis',
  failed: 'bg-aspectum-danger-muted text-aspectum-danger-emphasis',
  cancelled: 'bg-aspectum-surface-subtle text-aspectum-text-muted',
};

const STATUS_LABELS = {
  pending: 'Ожидание',
  processing: 'Выполняется',
  running: 'Выполняется',
  completed: 'Завершена',
  failed: 'Ошибка',
  cancelled: 'Отменена',
};

const APPLY_TASK_TYPES = {
  generate_attractions: {
    label: 'Добавить достопримечательности в сессию',
    apply: (taskId, sessionId) =>
      aiAPI.attractionsCreateFromTask(taskId, { session_id: sessionId }),
  },
  generate_interactive_locations: {
    label: 'Добавить интерактивные локации в сессию',
    apply: (taskId, sessionId) =>
      aiAPI.interactiveLocationsCreateFromTask(taskId, { session_id: sessionId }),
  },
  generate_city_info: {
    label: 'Добавить полезную информацию в сессию',
    apply: (taskId, sessionId) =>
      aiAPI.cityInfoCreateFromTask(taskId, { session_id: sessionId }),
  },
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
  const [applyingTask, setApplyingTask] = useState(false);
  const [applyMessage, setApplyMessage] = useState(null);
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
    setApplyMessage(null);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedTaskId(null);
    setTaskDetails(null);
    setDetailsError(null);
    setApplyMessage(null);
  };

  const applyTaskResultToSession = useCallback(async () => {
    if (!taskDetails?.id || !taskDetails?.status || taskDetails.status !== 'completed') return;

    const handler = APPLY_TASK_TYPES[taskDetails.task_type];
    if (!handler) return;

    const sessionId =
      taskDetails.session_id ||
      taskDetails.result_data?.target_session_id ||
      null;
    if (!sessionId) {
      setApplyMessage({ type: 'error', text: 'У задачи нет ID сессии' });
      return;
    }

    setApplyingTask(true);
    setApplyMessage(null);
    try {
      const response = await handler.apply(taskDetails.id, sessionId);
      const data = response?.data || {};
      const created = data.created_count ?? data.generated_count ?? data.attractions?.length ?? 0;
      setApplyMessage({
        type: 'success',
        text: data.warning || data.partial
          ? (data.warning || `Создано записей: ${created} (частично)`)
          : `Создано записей: ${created}`,
      });
      await loadTaskDetails(taskDetails.id, true);
    } catch (err) {
      setApplyMessage({
        type: 'error',
        text: parseApiError(err, 'Не удалось применить результат задачи к сессии'),
      });
    } finally {
      setApplyingTask(false);
    }
  }, [taskDetails, loadTaskDetails]);

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
          <div className="text-sm font-medium text-aspectum-text">
            {row.task_type_display || type || '—'}
          </div>
          {row.session_id && (
            <div className="text-xs text-aspectum-text-disabled font-mono mt-0.5">
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
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status] || 'bg-aspectum-surface-subtle text-aspectum-text-subtle'}`}>
          {(status === 'running' || status === 'processing') && (
            <Spinner size="xs" className="w-2.5 h-2.5 border-2 border-current" />
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
            <ProgressBar value={progress} size="sm" tone="focus" label="Прогресс задачи" className="flex-1" />
            <span className="text-xs text-aspectum-text-muted shrink-0">{progress}%</span>
          </div>
        ) : <span className="text-aspectum-text-faint">—</span>,
    },
    {
      key: 'current_step',
      label: 'Текущий шаг',
      className: 'text-xs text-aspectum-text-muted max-w-xs',
      render: (step) => step
        ? <span className="truncate block" title={step}>{step}</span>
        : <span className="text-aspectum-text-faint">—</span>,
    },
    {
      key: 'created_at',
      label: 'Создана',
      className: 'whitespace-nowrap text-xs text-aspectum-text-muted',
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
      <PageHeader
        title="Задачи генерации"
        description={(
          <>
            Автообновление каждые {POLL_INTERVAL / 1000} сек.
            {hasActive && (
              <span className="ml-2 inline-flex items-center gap-1 text-aspectum-primary">
                <span className="w-1.5 h-1.5 bg-aspectum-focus rounded-full animate-pulse inline-block" />
                Есть активные
              </span>
            )}
            {lastUpdated && (
              <span className="ml-2 text-aspectum-text-disabled">
                · {lastUpdated.toLocaleTimeString('ru-RU')}
              </span>
            )}
          </>
        )}
        secondaryActions={[{
          key: 'refresh',
          label: 'Обновить',
          onClick: () => loadTasks(),
        }]}
      />

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
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openDetails(row);
            }}
            variant="softStrong"
            size="sm"
          >
            Подробнее
          </Button>
        )}
      />

      <Modal
        open={detailsOpen}
        onClose={closeDetails}
        title={taskDetails?.task_type_display ? `Задача: ${taskDetails.task_type_display}` : 'Детали задачи'}
        size="xl"
      >
        {detailsError && (
          <Alert tone="error" className="mb-4">{detailsError}</Alert>
        )}

        {detailsLoading && !taskDetails ? (
          <div className="py-8 flex items-center justify-center text-sm text-aspectum-text-muted gap-2">
            <Spinner />
            Загрузка информации о задаче...
          </div>
        ) : taskDetails ? (
          <div className="space-y-4 text-sm">
            <div className={formGridClassName()}>
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
              <Alert tone="error">
                <Heading level={3} size="xs" className="mb-2">Ошибка</Heading>
                <pre className="text-xs whitespace-pre-wrap break-words">{taskDetails.error_message}</pre>
              </Alert>
            )}

            <Panel as="section" className="p-3">
              <Heading level={3} size="xs" className="mb-2">Логи / шаги выполнения</Heading>
              {extractTaskLogs(taskDetails).length > 0 ? (
                <div className="max-h-56 overflow-auto rounded border border-aspectum-border bg-aspectum-surface-muted p-2">
                  {extractTaskLogs(taskDetails).map((line, idx) => (
                    <div key={`${idx}-${line.slice(0, 20)}`} className="font-mono text-xs text-aspectum-text-strong py-0.5">
                      {line}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-aspectum-text-muted">Логи не были переданы сервером для этой задачи.</p>
              )}
            </Panel>

            <Panel as="section" className="p-3">
              <Heading level={3} size="xs" className="mb-2">result_data (полный JSON)</Heading>
              <pre className="text-xs text-aspectum-text-strong whitespace-pre-wrap break-words bg-aspectum-surface-muted rounded border border-aspectum-border p-2 max-h-64 overflow-auto">
                {JSON.stringify(taskDetails.result_data ?? null, null, 2)}
              </pre>
            </Panel>

            {taskDetails.status === 'completed' && APPLY_TASK_TYPES[taskDetails.task_type] && (
              <Panel as="section" tone="info" className="p-3 space-y-2">
                <Heading level={3} size="xs" tone="primary">Применить к сессии</Heading>
                <p className="text-xs text-aspectum-primary-strong">
                  Генерация только сохраняет JSON в задачу. Чтобы записи появились в сессии,
                  нажмите кнопку ниже (в визарде это происходит автоматически после генерации).
                </p>
                {applyMessage && (
                  <div
                    className={`text-xs rounded-aspectum-compact px-3 py-2 ${
                      applyMessage.type === 'error'
                        ? 'bg-aspectum-danger-muted text-aspectum-danger-emphasis border border-aspectum-danger-border'
                        : 'bg-aspectum-positive-muted text-aspectum-positive-emphasis border border-aspectum-positive-border'
                    }`}
                  >
                    {applyMessage.text}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={applyTaskResultToSession}
                    disabled={applyingTask}
                    variant="primary"
                    size="md"
                  >
                    {applyingTask ? 'Применение…' : APPLY_TASK_TYPES[taskDetails.task_type].label}
                  </Button>
                  {taskDetails.session_id && (
                    <Link
                      to={`/generation/${taskDetails.session_id}`}
                      className="px-3 py-2 text-sm font-medium text-aspectum-primary-hover border border-aspectum-primary-border-strong rounded-aspectum-compact hover:bg-aspectum-primary-muted"
                    >
                      Открыть сессию
                    </Link>
                  )}
                </div>
              </Panel>
            )}

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                onClick={() => loadTaskDetails(selectedTaskId)}
                variant="outline"
                size="md"
              >
                Обновить детали
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Layout>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="rounded-aspectum-compact border border-aspectum-border px-3 py-2 bg-aspectum-surface-muted">
      <div className="text-xs text-aspectum-text-muted mb-1">{label}</div>
      <div className={`text-sm text-aspectum-text break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </div>
    </div>
  );
}
