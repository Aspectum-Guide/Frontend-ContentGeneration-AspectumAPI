import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingReferenceAPI, eventSlotAvailabilitiesAPI, ticketTypesAPI } from '../../api/booking';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Field, FormActions, TextInput } from '../../components/ui/FormField';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { useLayoutActions } from '../../context/LayoutActionsContext';
import { useCatalogFilters } from '../../features/catalog/core/useCatalogFilters';
import { useCatalogResource } from '../../features/catalog/core/useCatalogResource';
import { getMultiLangValue } from '../../features/catalog/shared/i18n';
import { normalizeListResponse } from '../../features/catalog/shared/normalize';
import { parseApiError } from '../../utils/apiError';

const PAGE_SIZE = 20;

function createEmptyAvailability() {
  return {
    id: null,
    event: '',
    ticket_type: '',
    slot_datetime: '',
    booking_closes_minutes_before: 60,
    available_seats: 0,
    is_active: true,
  };
}

function formatIsoForInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function parseInputToIso(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

export default function SlotAvailabilitiesCatalog() {
  const { setMobileActions } = useLayoutActions();

  // note: search here is UI-only; API doesn't support search for this resource.
  const { page, setPage, search, setSearch } = useCatalogFilters();
  const avail = useCatalogResource({
    listRequest: eventSlotAvailabilitiesAPI.list,
    removeRequest: eventSlotAvailabilitiesAPI.delete,
    listKeys: ['results'],
    defaultErrorMessage: 'Ошибка загрузки слотов',
  });

  const [eventOptions, setEventOptions] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState('');

  const [ticketTypeOptions, setTicketTypeOptions] = useState([]);
  const [ticketTypesLoading, setTicketTypesLoading] = useState(false);
  const [ticketTypeFilter, setTicketTypeFilter] = useState('');

  const [editingAvailability, setEditingAvailability] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const eventLabelById = useMemo(() => {
    const map = new Map();
    for (const eventItem of eventOptions) {
      map.set(String(eventItem.id), getMultiLangValue(eventItem.title) || String(eventItem.id));
    }
    return map;
  }, [eventOptions]);

  const ticketTypeLabelById = useMemo(() => {
    const map = new Map();
    for (const tt of ticketTypeOptions) {
      map.set(String(tt.id), tt.name || String(tt.id));
    }
    return map;
  }, [ticketTypeOptions]);

  const loadEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      const response = await bookingReferenceAPI.events({ page_size: 500 });
      const data = response?.data;
      const list = normalizeListResponse(data, ['results', 'data']);
      setEventOptions(list);
    } catch {
      setEventOptions([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const loadTicketTypes = useCallback(async (eventId) => {
    const normalizedEventId = eventId || '';
    if (!normalizedEventId) {
      setTicketTypeOptions([]);
      return;
    }

    try {
      setTicketTypesLoading(true);
      const response = await ticketTypesAPI.list({ event: normalizedEventId, page_size: 500, ordering: 'name' });
      const data = response?.data;
      const list = normalizeListResponse(data, ['results', 'data']);
      setTicketTypeOptions(list);
    } catch {
      setTicketTypeOptions([]);
    } finally {
      setTicketTypesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    loadTicketTypes(eventFilter);
    setTicketTypeFilter('');
  }, [eventFilter, loadTicketTypes]);

  const reload = useCallback(async (pageNum) => {
    await avail.load(
      {
        page: pageNum,
        page_size: PAGE_SIZE,
        event: eventFilter || undefined,
        ticket_type: ticketTypeFilter || undefined,
        ordering: 'slot_datetime',
      },
      (err) => parseApiError(err, 'Ошибка загрузки слотов')
    );
  }, [avail.load, eventFilter, ticketTypeFilter]);

  useEffect(() => {
    reload(page);
  }, [page, reload]);

  useEffect(() => {
    setPage(1);
    reload(1);
  }, [eventFilter, ticketTypeFilter, reload, setPage]);

  useEffect(() => {
    const actions = [
      {
        id: 'create-slot-availability',
        label: editingAvailability ? 'Новый слот' : 'Создать слот',
        onClick: () => {
          setSaveError(null);
          setEditingAvailability(createEmptyAvailability());
        },
        variant: editingAvailability ? 'secondary' : 'primary',
      },
    ];

    if (editingAvailability) {
      actions.push({
        id: 'close-slot-availability-editor',
        label: 'Закрыть форму',
        onClick: () => setEditingAvailability(null),
        variant: 'secondary',
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [editingAvailability, setMobileActions]);

  const openEdit = useCallback(async (row) => {
    setSaveError(null);
    const base = {
      id: row?.id || null,
      event: row?.event ? String(row.event) : '',
      ticket_type: row?.ticket_type ? String(row.ticket_type) : '',
      slot_datetime: row?.slot_datetime || '',
      booking_closes_minutes_before: Number(row?.booking_closes_minutes_before ?? 60),
      available_seats: Number(row?.available_seats ?? 0),
      is_active: row?.is_active !== false,
    };

    setEditingAvailability(base);
    if (!row?.id) return;

    try {
      const r = await eventSlotAvailabilitiesAPI.get(row.id);
      const d = r?.data;
      if (d && typeof d === 'object') {
        setEditingAvailability((prev) => ({
          ...prev,
          event: d.event ? String(d.event) : prev.event,
          ticket_type: d.ticket_type ? String(d.ticket_type) : prev.ticket_type,
          slot_datetime: d.slot_datetime || prev.slot_datetime,
          booking_closes_minutes_before: Number(d.booking_closes_minutes_before ?? prev.booking_closes_minutes_before ?? 60),
          available_seats: Number(d.available_seats ?? prev.available_seats ?? 0),
          is_active: d.is_active !== false,
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingAvailability) return;

    const payload = {
      event: editingAvailability.event || null,
      ticket_type: editingAvailability.ticket_type || null,
      slot_datetime: editingAvailability.slot_datetime || null,
      booking_closes_minutes_before: Number(editingAvailability.booking_closes_minutes_before || 0),
      available_seats: Number(editingAvailability.available_seats || 0),
      is_active: !!editingAvailability.is_active,
    };

    try {
      setSaving(true);
      setSaveError(null);
      if (editingAvailability.id) {
        await eventSlotAvailabilitiesAPI.update(editingAvailability.id, payload);
      } else {
        await eventSlotAvailabilitiesAPI.create(payload);
      }
      setEditingAvailability(null);
      await reload();
    } catch (err) {
      setSaveError(parseApiError(err, editingAvailability.id ? 'Ошибка сохранения слота' : 'Ошибка создания слота'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      setDeleting(true);
      await eventSlotAvailabilitiesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      avail.setError(parseApiError(err, 'Ошибка удаления слота'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'slot_datetime',
      label: 'Время слота',
      render: (iso) => <span className="text-sm text-gray-700">{iso ? new Date(iso).toLocaleString() : '—'}</span>,
    },
    {
      key: 'event',
      label: 'Событие',
      render: (eventId) => (
        <span className="text-sm text-gray-700">
          {eventLabelById.get(String(eventId)) || String(eventId || '—')}
        </span>
      ),
    },
    {
      key: 'ticket_type',
      label: 'Тип билета',
      render: (ticketTypeId) => (
        <span className="text-sm text-gray-700">
          {ticketTypeLabelById.get(String(ticketTypeId)) || String(ticketTypeId || '—')}
        </span>
      ),
    },
    {
      key: 'available_seats',
      label: 'Мест',
      render: (v) => <span className="text-sm text-gray-700">{Number.isFinite(v) ? v : 0}</span>,
    },
    {
      key: 'booking_closes_minutes_before',
      label: 'Закрытие (мин)',
      render: (v) => <span className="text-sm text-gray-700">{Number.isFinite(v) ? v : 60}</span>,
    },
    {
      key: 'is_active',
      label: 'Статус',
      render: (active) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
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
          <h1 className="text-2xl font-bold text-gray-900">Справочник слотов (доступность)</h1>
          <p className="mt-1 text-sm text-gray-500">Слоты по событиям и типам билетов</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSaveError(null);
            setEditingAvailability(createEmptyAvailability());
          }}
          className="hidden md:inline-flex px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Создать слот
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={avail.items}
        loading={avail.loading}
        error={avail.error}
        emptyIcon="🕒"
        emptyText={eventFilter || ticketTypeFilter ? 'По запросу ничего не найдено' : 'Слотов пока нет'}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск (локально, по таблице)..."
        page={page}
        totalCount={avail.total}
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
              value={ticketTypeFilter}
              onChange={(e) => setTicketTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={!eventFilter || ticketTypesLoading}
            >
              <option value="">{eventFilter ? 'Все типы' : 'Сначала выберите событие'}</option>
              {ticketTypeOptions.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.name || tt.id}
                </option>
              ))}
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
        open={!!editingAvailability}
        onClose={() => setEditingAvailability(null)}
        title={editingAvailability?.id ? 'Редактировать слот' : 'Создать слот'}
        size="lg"
      >
        {editingAvailability && (
          <form onSubmit={handleSave} className="space-y-4">
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Событие" required>
                <select
                  value={editingAvailability.event}
                  onChange={(e) => {
                    const nextEvent = e.target.value;
                    setEditingAvailability((prev) => ({ ...prev, event: nextEvent, ticket_type: '' }));
                    setEventFilter(nextEvent);
                  }}
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

              <Field label="Тип билета" required>
                <select
                  value={editingAvailability.ticket_type}
                  onChange={(e) => setEditingAvailability((prev) => ({ ...prev, ticket_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                  disabled={!editingAvailability.event || ticketTypesLoading}
                >
                  <option value="">{editingAvailability.event ? 'Выберите тип' : 'Сначала выберите событие'}</option>
                  {ticketTypeOptions.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name || tt.id}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Дата и время слота" required>
              <TextInput
                type="datetime-local"
                value={formatIsoForInput(editingAvailability.slot_datetime)}
                onChange={(e) => setEditingAvailability((prev) => ({ ...prev, slot_datetime: parseInputToIso(e.target.value) }))}
                required
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Доступно мест">
                <TextInput
                  type="number"
                  min={0}
                  value={editingAvailability.available_seats ?? 0}
                  onChange={(e) => setEditingAvailability((prev) => ({ ...prev, available_seats: Number(e.target.value || 0) }))}
                />
              </Field>
              <Field label="Закрытие брони (мин)">
                <TextInput
                  type="number"
                  min={0}
                  value={editingAvailability.booking_closes_minutes_before ?? 60}
                  onChange={(e) => setEditingAvailability((prev) => ({ ...prev, booking_closes_minutes_before: Number(e.target.value || 0) }))}
                />
              </Field>
              <Field label="Статус">
                <label className="flex items-center gap-2 select-none cursor-pointer w-fit pt-2">
                  <input
                    type="checkbox"
                    checked={!!editingAvailability.is_active}
                    onChange={(e) => setEditingAvailability((prev) => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Активен</span>
                </label>
              </Field>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
              Ограничение бэкенда: выбранный тип билета должен принадлежать этому событию.
            </div>

            <FormActions
              saving={saving}
              saveLabel={editingAvailability.id ? 'Сохранить' : 'Создать'}
              onCancel={() => setEditingAvailability(null)}
            />
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить слот?"
        message={`Слот «${deleteTarget?.id || ''}» будет удалён без возможности восстановления.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </Layout>
  );
}

