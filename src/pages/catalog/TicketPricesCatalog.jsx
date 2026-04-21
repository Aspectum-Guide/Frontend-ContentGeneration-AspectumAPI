import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingReferenceAPI, eventSlotAvailabilitiesAPI, ticketPricesAPI, ticketTypesAPI } from '../../api/booking';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Field, FormActions, TextInput } from '../../components/ui/FormField';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { useLayoutActions } from '../../context/LayoutActionsContext';
import { getMultiLangValue } from '../../features/catalog/shared/i18n';
import { normalizeListResponse } from '../../features/catalog/shared/normalize';
import { useCatalogFilters } from '../../features/catalog/core/useCatalogFilters';
import { useCatalogResource } from '../../features/catalog/core/useCatalogResource';
import { parseApiError } from '../../utils/apiError';

const PAGE_SIZE = 20;

function createEmptyTicketPrice() {
  return {
    id: null,
    event: '',
    ticket_type: '',
    slot: '',
    price: '',
    currency: 'EUR',
    is_active: true,
  };
}

export default function TicketPricesCatalog() {
  const { setMobileActions } = useLayoutActions();
  const { page, setPage, search, setSearch, debouncedSearch } = useCatalogFilters();
  const prices = useCatalogResource({
    listRequest: ticketPricesAPI.list,
    removeRequest: ticketPricesAPI.delete,
    listKeys: ['results'],
    defaultErrorMessage: 'Ошибка загрузки цен',
  });

  const [eventOptions, setEventOptions] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const [eventFilter, setEventFilter] = useState('');
  const [ticketTypeFilter, setTicketTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [ticketTypeOptions, setTicketTypeOptions] = useState([]);
  const [ticketTypesLoading, setTicketTypesLoading] = useState(false);

  const [formTicketTypeOptions, setFormTicketTypeOptions] = useState([]);
  const [formTicketTypesLoading, setFormTicketTypesLoading] = useState(false);
  const [slotOptions, setSlotOptions] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [editingPrice, setEditingPrice] = useState(null);
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

  const loadFormTicketTypes = useCallback(async (eventId) => {
    const normalizedEventId = eventId || '';
    if (!normalizedEventId) {
      setFormTicketTypeOptions([]);
      return;
    }

    try {
      setFormTicketTypesLoading(true);
      const response = await ticketTypesAPI.list({ event: normalizedEventId, page_size: 500, ordering: 'name' });
      const data = response?.data;
      const list = normalizeListResponse(data, ['results', 'data']);
      setFormTicketTypeOptions(list);
    } catch {
      setFormTicketTypeOptions([]);
    } finally {
      setFormTicketTypesLoading(false);
    }
  }, []);

  const loadSlots = useCallback(async (eventId, ticketTypeId) => {
    const normalizedEventId = eventId || '';
    const normalizedTicketTypeId = ticketTypeId || '';
    if (!normalizedEventId || !normalizedTicketTypeId) {
      setSlotOptions([]);
      return;
    }

    try {
      setSlotsLoading(true);
      const response = await eventSlotAvailabilitiesAPI.list({
        event: normalizedEventId,
        ticket_type: normalizedTicketTypeId,
        page_size: 500,
        ordering: 'slot_datetime',
      });
      const data = response?.data;
      const list = normalizeListResponse(data, ['results', 'data']);
      setSlotOptions(list);
    } catch {
      setSlotOptions([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    loadTicketTypes(eventFilter);
    setTicketTypeFilter('');
  }, [eventFilter, loadTicketTypes]);

  useEffect(() => {
    const eventId = editingPrice?.event || '';
    const ticketTypeId = editingPrice?.ticket_type || '';
    loadFormTicketTypes(eventId);
    loadSlots(eventId, ticketTypeId);
  }, [editingPrice?.event, editingPrice?.ticket_type, loadFormTicketTypes, loadSlots]);

  const reload = useCallback(async (pageNum) => {
    const isActiveParam =
      statusFilter === 'active' ? 'true' : statusFilter === 'inactive' ? 'false' : undefined;

    await prices.load(
      {
        page: pageNum,
        page_size: PAGE_SIZE,
        event: eventFilter || undefined,
        ticket_type: ticketTypeFilter || undefined,
        is_active: isActiveParam,
        search: debouncedSearch || undefined,
        ordering: '-id',
      },
      (err) => parseApiError(err, 'Ошибка загрузки цен')
    );
  }, [prices.load, eventFilter, ticketTypeFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    reload(page);
  }, [page, reload]);

  useEffect(() => {
    setPage(1);
    reload(1);
  }, [eventFilter, ticketTypeFilter, statusFilter, debouncedSearch, reload, setPage]);

  useEffect(() => {
    const actions = [
      {
        id: 'create-ticket-price',
        label: editingPrice ? 'Новая цена' : 'Создать цену',
        onClick: () => {
          setSaveError(null);
          setEditingPrice(createEmptyTicketPrice());
        },
        variant: editingPrice ? 'secondary' : 'primary',
      },
    ];

    if (editingPrice) {
      actions.push({
        id: 'close-ticket-price-editor',
        label: 'Закрыть форму',
        onClick: () => setEditingPrice(null),
        variant: 'secondary',
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [editingPrice, setMobileActions]);

  const openEdit = useCallback(async (row) => {
    setSaveError(null);
    const base = {
      id: row?.id || null,
      event: row?.event ? String(row.event) : '',
      ticket_type: row?.ticket_type ? String(row.ticket_type) : '',
      slot: row?.slot ? String(row.slot) : '',
      price: row?.price != null ? String(row.price) : '',
      currency: row?.currency || 'EUR',
      is_active: row?.is_active !== false,
    };

    setEditingPrice(base);

    // best-effort: get fresh data
    if (!row?.id) return;
    try {
      const r = await ticketPricesAPI.get(row.id);
      const d = r?.data;
      if (d && typeof d === 'object') {
        setEditingPrice((prev) => ({
          ...prev,
          event: d.event ? String(d.event) : prev.event,
          ticket_type: d.ticket_type ? String(d.ticket_type) : prev.ticket_type,
          slot: d.slot ? String(d.slot) : prev.slot,
          price: d.price != null ? String(d.price) : prev.price,
          currency: d.currency || prev.currency || 'EUR',
          is_active: d.is_active !== false,
        }));
      }
    } catch {
      // ignore: editor will rely on row data
    }
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingPrice) return;

    const parsedPrice = Number(editingPrice.price);
    const payload = {
      event: editingPrice.event || null,
      ticket_type: editingPrice.ticket_type || null,
      slot: editingPrice.slot || null,
      price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
      currency: (editingPrice.currency || 'EUR').toUpperCase(),
      is_active: !!editingPrice.is_active,
    };

    try {
      setSaving(true);
      setSaveError(null);
      if (editingPrice.id) {
        await ticketPricesAPI.update(editingPrice.id, payload);
      } else {
        await ticketPricesAPI.create(payload);
      }
      setEditingPrice(null);
      await reload();
    } catch (err) {
      setSaveError(parseApiError(err, editingPrice.id ? 'Ошибка сохранения цены' : 'Ошибка создания цены'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;

    try {
      setDeleting(true);
      await ticketPricesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      prices.setError(parseApiError(err, 'Ошибка удаления цены'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'id',
      label: 'ID',
      render: (id) => (
        <span className="font-mono text-xs text-gray-500" title={String(id)}>
          {String(id).slice(0, 8)}…
        </span>
      ),
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
      label: 'Тип',
      render: (ticketTypeId) => (
        <span className="text-sm text-gray-700">
          {ticketTypeLabelById.get(String(ticketTypeId)) || String(ticketTypeId || '—')}
        </span>
      ),
    },
    {
      key: 'slot',
      label: 'Слот',
      render: (slotId) => (
        <span className="font-mono text-xs text-gray-500" title={String(slotId || '')}>
          {slotId ? `${String(slotId).slice(0, 8)}…` : '—'}
        </span>
      ),
    },
    {
      key: 'price',
      label: 'Цена',
      render: (price, row) => (
        <span className="text-sm text-gray-700">
          {price != null && price !== '' ? `${price} ${row?.currency || 'EUR'}` : '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Статус',
      render: (active) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${active
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-700'
          }`}>
          {active ? 'Активна' : 'Неактивна'}
        </span>
      ),
    },
  ];

  return (
    <Layout>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Справочник цен билетов</h1>
          <p className="mt-1 text-sm text-gray-500">Управление ценами по слотам и типам билетов</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSaveError(null);
            setEditingPrice(createEmptyTicketPrice());
          }}
          className="hidden md:inline-flex px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Создать цену
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={prices.items}
        loading={prices.loading}
        error={prices.error}
        emptyIcon="🎟️"
        emptyText={search || eventFilter || ticketTypeFilter || statusFilter ? 'По запросу ничего не найдено' : 'Цен пока нет'}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск..."
        page={page}
        totalCount={prices.total}
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

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Любой статус</option>
              <option value="active">Активные</option>
              <option value="inactive">Отключенные</option>
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
        open={!!editingPrice}
        onClose={() => setEditingPrice(null)}
        title={editingPrice?.id ? 'Редактировать цену' : 'Создать цену'}
        size="lg"
      >
        {editingPrice && (
          <form onSubmit={handleSave} className="space-y-4">
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Событие" required>
                <select
                  value={editingPrice.event}
                  onChange={(e) => {
                    const nextEvent = e.target.value;
                    setEditingPrice((prev) => ({ ...prev, event: nextEvent, ticket_type: '', slot: '' }));
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
                  value={editingPrice.ticket_type}
                  onChange={(e) => setEditingPrice((prev) => ({ ...prev, ticket_type: e.target.value, slot: '' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                  disabled={!editingPrice.event || formTicketTypesLoading}
                >
                  <option value="">{editingPrice.event ? 'Выберите тип' : 'Сначала выберите событие'}</option>
                  {formTicketTypeOptions.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name || tt.id}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Слот" required>
              <select
                value={editingPrice.slot}
                onChange={(e) => setEditingPrice((prev) => ({ ...prev, slot: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
                disabled={!editingPrice.ticket_type || slotsLoading}
              >
                <option value="">
                  {editingPrice.ticket_type ? 'Выберите слот' : 'Сначала выберите тип билета'}
                </option>
                {slotOptions.map((slotItem) => (
                  <option key={slotItem.id} value={slotItem.id}>
                    {new Date(slotItem.slot_datetime).toLocaleString()} | мест: {slotItem.available_seats}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Цена" required>
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingPrice.price}
                  onChange={(e) => setEditingPrice((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </Field>
              <Field label="Валюта" required>
                <TextInput
                  value={editingPrice.currency}
                  onChange={(e) => setEditingPrice((prev) => ({ ...prev, currency: e.target.value }))}
                  placeholder="EUR"
                  maxLength={3}
                  required
                />
              </Field>
              <Field label="Статус">
                <label className="flex items-center gap-2 select-none cursor-pointer w-fit pt-2">
                  <input
                    type="checkbox"
                    checked={!!editingPrice.is_active}
                    onChange={(e) => setEditingPrice((prev) => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Активна</span>
                </label>
              </Field>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
              Важно: в бэкенде цена должна ссылаться на слот и тип билета, причём слот обязан соответствовать этому типу билета.
            </div>

            <FormActions
              saving={saving}
              saveLabel={editingPrice.id ? 'Сохранить' : 'Создать'}
              onCancel={() => setEditingPrice(null)}
              />
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить цену?"
        message={`Цена «${deleteTarget?.id || ''}» будет удалена без возможности восстановления.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </Layout>
  );
}
