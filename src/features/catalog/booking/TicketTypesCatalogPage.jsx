import { useCallback, useEffect, useMemo, useState } from 'react';
import { ticketTypesAPI } from '../../../api/booking';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { Field, FormActions, TextInput, Textarea } from '../../../components/ui/FormField';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { useLayoutActions } from '../../../context/LayoutActionsContext';
import { parseApiError } from '../../../utils/apiError';
import { useEventOptions } from '../shared/bookingOptions';
import { getMultiLangValue } from '../shared/i18n';

const PAGE_SIZE = 20;

function createEmptyTicketType() {
  return {
    id: null,
    event: '',
    name: '',
    description: '',
    sort_order: 0,
    is_active: true,
  };
}

export default function TicketTypesCatalog() {
  const { setMobileActions } = useLayoutActions();
  const [ticketTypes, setTicketTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { eventOptions, eventsLoading } = useEventOptions();

  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ordering, setOrdering] = useState('sort_order');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [editingType, setEditingType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const eventMap = useMemo(() => {
    const map = new Map();
    for (const eventItem of eventOptions) {
      map.set(String(eventItem.id), getMultiLangValue(eventItem.title) || String(eventItem.id));
    }
    return map;
  }, [eventOptions]);

  const loadTicketTypes = useCallback(async (paramsState) => {
    const state = paramsState || {
      page,
      search,
      eventFilter,
      statusFilter,
      ordering,
    };

    try {
      setLoading(true);

      const params = {
        event: state.eventFilter || undefined,
        is_active:
          state.statusFilter === 'active'
            ? 'true'
            : state.statusFilter === 'inactive'
              ? 'false'
              : undefined,
        search: state.search || undefined,
        ordering: state.ordering || undefined,
        page: state.page,
        page_size: PAGE_SIZE,
      };

      const response = await ticketTypesAPI.list(params);
      const data = response?.data;

      if (Array.isArray(data?.results)) {
        setTicketTypes(data.results);
        setTotalCount(data.count ?? data.results.length);
      } else {
        const list = Array.isArray(data) ? data : [];
        const start = (state.page - 1) * PAGE_SIZE;
        setTicketTypes(list.slice(start, start + PAGE_SIZE));
        setTotalCount(list.length);
      }
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки типов билетов'));
      setTicketTypes([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [eventFilter, ordering, page, search, statusFilter]);

  useEffect(() => {
    loadTicketTypes();
  }, [loadTicketTypes]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadTicketTypes({
        page: 1,
        search,
        eventFilter,
        statusFilter,
        ordering,
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [search, eventFilter, statusFilter, ordering, loadTicketTypes]);

  useEffect(() => {
    const actions = [
      {
        id: 'create-ticket-type',
        label: editingType ? 'Новый тип' : 'Создать тип билета',
        onClick: () => {
          setSaveError(null);
          setEditingType(createEmptyTicketType());
        },
        variant: editingType ? 'secondary' : 'primary',
      },
    ];

    if (editingType) {
      actions.push({
        id: 'close-ticket-type-editor',
        label: 'Закрыть форму',
        onClick: () => setEditingType(null),
        variant: 'secondary',
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [editingType, setMobileActions]);

  const openEdit = useCallback((row) => {
    setSaveError(null);
    setEditingType({
      id: row.id,
      event: row.event || '',
      name: row.name || '',
      description: row.description || '',
      sort_order: Number.isFinite(row.sort_order) ? row.sort_order : 0,
      is_active: row.is_active !== false,
    });
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingType) return;

    const payload = {
      event: editingType.event,
      name: editingType.name,
      description: editingType.description || '',
      sort_order: Number(editingType.sort_order || 0),
      is_active: !!editingType.is_active,
    };

    try {
      setSaving(true);
      setSaveError(null);
      if (editingType.id) {
        await ticketTypesAPI.update(editingType.id, payload);
      } else {
        await ticketTypesAPI.create(payload);
      }
      setEditingType(null);
      await loadTicketTypes();
    } catch (err) {
      setSaveError(parseApiError(err, editingType.id ? 'Ошибка сохранения типа билета' : 'Ошибка создания типа билета'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;

    try {
      setDeleting(true);
      await ticketTypesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadTicketTypes();
    } catch (err) {
      alert(parseApiError(err, 'Ошибка удаления типа билета'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Тип билета',
      render: (value, row) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{value || '—'}</div>
          {row.description ? (
            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{row.description}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'event',
      label: 'Событие',
      render: (eventId) => (
        <span className="text-sm text-gray-700">{eventMap.get(String(eventId)) || eventId || '—'}</span>
      ),
    },
    {
      key: 'sort_order',
      label: 'Порядок',
      className: 'text-sm text-gray-700',
      render: (value) => <span>{Number.isFinite(value) ? value : 0}</span>,
    },
    {
      key: 'is_active',
      label: 'Статус',
      render: (active) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
          {active ? 'Активен' : 'Отключен'}
        </span>
      ),
    },
  ];

  return (
    <Layout>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Справочник типов билетов</h1>
          <p className="mt-1 text-sm text-gray-500">Управление типами билетов для событий</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSaveError(null);
            setEditingType(createEmptyTicketType());
          }}
          className="hidden md:inline-flex px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Создать тип билета
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={ticketTypes}
        loading={loading}
        error={error}
        emptyIcon="🎟️"
        emptyText={search || eventFilter || statusFilter ? 'По запросу ничего не найдено' : 'Типов билетов пока нет'}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по названию или описанию..."
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={(
          <>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={eventsLoading}
            >
              <option value="">Все события</option>
              {eventOptions.map((eventItem) => (
                <option key={eventItem.id} value={eventItem.id}>
                  {getMultiLangValue(eventItem.title) || eventItem.id}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Любой статус</option>
              <option value="active">Активные</option>
              <option value="inactive">Отключенные</option>
            </select>

            <select
              value={ordering}
              onChange={(e) => setOrdering(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="sort_order">Сортировка: порядок ↑</option>
              <option value="-sort_order">Сортировка: порядок ↓</option>
              <option value="name">Сортировка: название А-Я</option>
              <option value="-name">Сортировка: название Я-А</option>
            </select>
          </>
        )}
        actions={(row) => (
          <>
            <button
              type="button"
              onClick={() => openEdit(row)}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              Ред.
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(row)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
            >
              Удалить
            </button>
          </>
        )}
      />

      <Modal
        open={!!editingType}
        onClose={() => setEditingType(null)}
        title={editingType?.id ? `Редактировать тип билета: ${editingType.name || ''}` : 'Создать тип билета'}
        size="lg"
      >
        {editingType && (
          <form onSubmit={handleSave} className="space-y-4">
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Событие" required>
                <select
                  value={editingType.event}
                  onChange={(e) => setEditingType((prev) => ({ ...prev, event: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  <option value="">Выберите событие</option>
                  {eventOptions.map((eventItem) => (
                    <option key={eventItem.id} value={eventItem.id}>
                      {getMultiLangValue(eventItem.title) || eventItem.id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Порядок сортировки">
                <TextInput
                  type="number"
                  min={0}
                  value={editingType.sort_order}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = raw === '' ? '' : Number(raw);
                    setEditingType((prev) => ({
                      ...prev,
                      sort_order: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
                    }));
                  }}
                />
              </Field>
            </div>

            <Field label="Название" required>
              <TextInput
                value={editingType.name}
                onChange={(e) => setEditingType((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Например: VIP"
                required
                maxLength={100}
              />
            </Field>

            <Field label="Описание">
              <Textarea
                rows={3}
                value={editingType.description || ''}
                onChange={(e) => setEditingType((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Краткое описание типа билета"
              />
            </Field>

            <Field label="Статус">
              <label className="flex items-center gap-2 select-none cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={!!editingType.is_active}
                  onChange={(e) => setEditingType((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Активный тип билета</span>
              </label>
            </Field>

            <FormActions
              saving={saving}
              saveLabel={editingType.id ? 'Сохранить' : 'Создать'}
              onCancel={() => setEditingType(null)}
            />
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить тип билета?"
        message={`Тип «${deleteTarget?.name || deleteTarget?.id || ''}» будет удален без возможности восстановления.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </Layout>
  );
}
