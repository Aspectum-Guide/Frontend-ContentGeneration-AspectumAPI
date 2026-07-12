import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventSlotAvailabilitiesAPI, ticketPricesAPI } from '../../../api/booking';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { Field, FormActions, TextInput } from '../../../components/ui/FormField';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { useCatalogCrud } from '../core/useCatalogCrud';
import { useCatalogResource } from '../core/useCatalogResource';
import BulkActionModal from '../../../components/bulk/BulkActionModal';
import { useEventOptions, useTicketTypeMapForEvents, useTicketTypeOptions } from '../shared/bookingOptions';
import ActiveCheckboxField from '../shared/components/ActiveCheckboxField';
import BlockingReservationsList from '../shared/components/BlockingReservationsList';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import EventSelect from '../shared/components/EventSelect';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import FormHint from '../shared/components/FormHint';
import StatusBadge from '../shared/components/StatusBadge';
import TableRowActions from '../shared/components/TableRowActions';
import TicketTypeSelect from '../shared/components/TicketTypeSelect';
import { DEFAULT_CURRENCY, normalizeCurrency } from '../shared/currencies';
import { getEventLabel, getTicketTypeLabel } from '../shared/labels';
import {
  buildFromInterval as buildSlotDatetimesFromInterval,
  buildSlotDatetimesFromSchedule,
  parseSlotDatetimesText,
  parseTimesText,
} from '../shared/scheduleParsers';

const PAGE_SIZE = 20;

function createEmptyAvailability() {
  return {
    id: null,
    event: '',
    ticket_types: [],
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

function createEmptyBulk() {
  return {
    mode: 'interval', // interval | list | schedule
    event: '',
    ticket_types: [],
    start_datetime: '',
    end_datetime: '',
    step_minutes: 60,
    datetimes_text: '',
    // schedule mode
    schedule_start_date: '',
    schedule_end_date: '',
    schedule_days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
    schedule_times_text: '10:00\n12:00\n14:00',
    booking_closes_minutes_before: 60,
    available_seats: 0,
    is_active: true,
    // optional prices auto-create
    also_create_prices: false,
    price_mode: 'single', // single | per_type
    price_value: '',
    price_currency: DEFAULT_CURRENCY,
    price_is_active: true,
    price_by_ticket_type: {}, // { [ticketTypeId]: string|number }
  };
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

  const { eventOptions, eventsLoading } = useEventOptions();
  const [forceDeleteTarget, setForceDeleteTarget] = useState(null);
  const [forceDeleteError, setForceDeleteError] = useState('');
  const [eventFilter, setEventFilter] = useState('');

  // Slots only ever accept global ticket types (event-owned ones are invisible
  // to customers on the public API — backend also rejects them, see #9).
  const { ticketTypeOptions, ticketTypesLoading } = useTicketTypeOptions(eventFilter, 500, {
    globalOnly: true,
  });
  const [ticketTypeFilter, setTicketTypeFilter] = useState('');

  const crud = useCatalogCrud({
    createEmpty: createEmptyAvailability,
    createRequest: eventSlotAvailabilitiesAPI.create,
    updateRequest: eventSlotAvailabilitiesAPI.update,
    deleteRequest: eventSlotAvailabilitiesAPI.delete,
    mapRowToEdit: (row) => ({
      id: row?.id || null,
      event: row?.event ? String(row.event) : '',
      ticket_types: Array.isArray(row?.ticket_types) ? row.ticket_types.map((x) => String(x)) : [],
      slot_datetime: row?.slot_datetime || '',
      booking_closes_minutes_before: Number(row?.booking_closes_minutes_before ?? 60),
      available_seats: Number(row?.available_seats ?? 0),
      is_active: row?.is_active !== false,
    }),
    mapEditToPayload: (editingAvailability) => ({
      event: editingAvailability.event || null,
      ticket_types: Array.isArray(editingAvailability.ticket_types)
        ? editingAvailability.ticket_types.filter(Boolean)
        : [],
      slot_datetime: editingAvailability.slot_datetime || null,
      booking_closes_minutes_before: Number(editingAvailability.booking_closes_minutes_before || 0),
      available_seats: Number(editingAvailability.available_seats || 0),
      is_active: !!editingAvailability.is_active,
    }),
    onAfterSave: async () => {
      await reload(page);
    },
    onAfterDelete: async () => {
      await reload(page);
    },
    parseError: (err, fallback) => parseApiError(err, fallback),
    createErrorMessage: 'Ошибка создания слота',
    updateErrorMessage: 'Ошибка сохранения слота',
    deleteErrorMessage: 'Ошибка удаления слота',
  });

  const [bulkOpen, setBulkOpen] = useState(false);

  const eventLabelById = useMemo(() => {
    const map = new Map();
    for (const eventItem of eventOptions) {
      map.set(String(eventItem.id), getEventLabel(eventItem));
    }
    return map;
  }, [eventOptions]);

  // Prefetch ticket type labels for all events visible in current table page,
  // so the "Тип билета" column shows code/name instead of UUID.
  const visibleEventIds = useMemo(() => {
    const items = Array.isArray(avail.items) ? avail.items : [];
    return Array.from(new Set(items.map((x) => String(x?.event || '')).filter(Boolean)));
  }, [avail.items]);
  const ticketTypeById = useTicketTypeMapForEvents(visibleEventIds);

  useEffect(() => {
    setTicketTypeFilter('');
  }, [eventFilter]);

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
        label: crud.editingItem ? 'Новый слот' : 'Создать слот',
        onClick: () => {
          crud.openCreate();
        },
        variant: crud.editingItem ? 'secondary' : 'primary',
      },
      {
        id: 'bulk-create-slot-availabilities',
        label: 'Массово слоты',
        onClick: () => {
          setBulkOpen(true);
        },
        variant: 'secondary',
      },
    ];

    if (crud.editingItem) {
      actions.push({
        id: 'close-slot-availability-editor',
        label: 'Закрыть форму',
        onClick: () => crud.closeEdit(),
        variant: 'secondary',
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [crud, eventFilter, ticketTypeFilter, setMobileActions]);

  const openEdit = useCallback(async (row) => {
    await crud.openEdit(row);
    const baseEvent = row?.event ? String(row.event) : '';
    // trigger ticket type options load for edit form
    setEventFilter(baseEvent || '');
  }, [crud]);

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
      key: 'ticket_types',
      label: 'Типы билетов',
      render: (ticketTypeIds) => (
        <div className="min-w-0">
          {(() => {
            const ids = Array.isArray(ticketTypeIds) ? ticketTypeIds.map((x) => String(x)) : [];
            if (!ids.length) return <div className="text-sm text-gray-400">—</div>;
            const titles = ids.map((id) => ticketTypeById.get(id)?.title || id).filter(Boolean);
            const primaries = ids.map((id) => ticketTypeById.get(id)?.code || '').filter(Boolean);
            return (
              <>
                <div className="text-sm text-gray-700 truncate">{titles.join(', ')}</div>
                {primaries.length ? (
                  <div className="text-xs text-gray-400 truncate">{primaries.join(', ')}</div>
                ) : null}
              </>
            );
          })()}
        </div>
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
      render: (active) => <StatusBadge active={active} />,
    },
  ];

  return (
    <Layout>
      <CatalogPageHeader
        title="Справочник слотов (доступность)"
        description="Слоты по событиям и типам билетов"
        createLabel="Создать слот"
        onCreate={() => {
          crud.openCreate();
        }}
        secondaryActions={[
          {
            label: 'Массово слоты',
            onClick: () => {
              setBulkOpen(true);
            },
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={avail.items}
        loading={avail.loading}
        error={avail.error}
        emptyIcon="🕒"
        isFiltered={!!(eventFilter || ticketTypeFilter)}
        emptyText="Слотов пока нет"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск (локально, по таблице)..."
        page={page}
        totalCount={avail.total}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={(
          <>
            <EventSelect
              value={eventFilter}
              onChange={setEventFilter}
              options={eventOptions}
              disabled={eventsLoading}
              placeholder="Все события"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <TicketTypeSelect
              value={ticketTypeFilter}
              onChange={setTicketTypeFilter}
              options={ticketTypeOptions}
              disabled={!eventFilter || ticketTypesLoading}
              placeholder={eventFilter ? 'Все типы' : 'Сначала выберите событие'}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </>
        )}
        actions={(row) => (
          <TableRowActions
            onEdit={() => openEdit(row)}
            onDelete={() => crud.askDelete(row)}
          />
        )}
      />

      <Modal
        open={!!crud.editingItem}
        onClose={() => crud.closeEdit()}
        title={crud.editingItem?.id ? 'Редактировать слот' : 'Создать слот'}
        size="lg"
      >
        {crud.editingItem && (
          <form onSubmit={crud.save} className="space-y-4">
            <FormErrorAlert message={crud.saveError} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Событие" required>
                <EventSelect
                  value={crud.editingItem.event}
                  onChange={(v) => {
                    crud.setEditingItem((prev) => ({ ...prev, event: v, ticket_types: [] }));
                    setEventFilter(v);
                  }}
                  options={eventOptions}
                  required
                />
              </Field>

              <Field label="Типы билетов">
                <TicketTypeSelect
                  multiple
                  value={crud.editingItem.ticket_types}
                  onChange={(selected) => crud.setEditingItem((prev) => ({ ...prev, ticket_types: selected }))}
                  options={ticketTypeOptions}
                  disabled={!crud.editingItem.event || ticketTypesLoading}
                />
              </Field>
            </div>

            <Field label="Дата и время слота" required>
              <TextInput
                type="datetime-local"
                value={formatIsoForInput(crud.editingItem.slot_datetime)}
                onChange={(e) => crud.setEditingItem((prev) => ({ ...prev, slot_datetime: parseInputToIso(e.target.value) }))}
                required
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field
                label="Доступно мест"
                hint="Один общий пул на весь слот — делится между всеми выбранными типами билетов, а не считается отдельно для каждого."
              >
                <TextInput
                  type="number"
                  min={0}
                  value={crud.editingItem.available_seats ?? 0}
                  onChange={(e) => crud.setEditingItem((prev) => ({ ...prev, available_seats: Number(e.target.value || 0) }))}
                />
              </Field>
              <Field label="Закрытие брони (мин)">
                <TextInput
                  type="number"
                  min={0}
                  value={crud.editingItem.booking_closes_minutes_before ?? 60}
                  onChange={(e) => crud.setEditingItem((prev) => ({ ...prev, booking_closes_minutes_before: Number(e.target.value || 0) }))}
                />
              </Field>
              <ActiveCheckboxField
                checked={crud.editingItem.is_active}
                onChange={(next) => crud.setEditingItem((prev) => ({ ...prev, is_active: next }))}
                text="Активен"
              />
            </div>

            <FormHint>
              Можно выбирать только глобальные типы билетов; событие задает контекст только для слота и цен.
            </FormHint>

            <FormActions
              saving={crud.saving}
              saveLabel={crud.editingItem.id ? 'Сохранить' : 'Создать'}
              onCancel={() => crud.closeEdit()}
            />
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!crud.deleteTarget}
        onClose={() => crud.cancelDelete()}
        onConfirm={async () => {
          try {
            await crud.confirmDelete();
          } catch (e) {
            avail.setError(crud.deleteError || parseApiError(e, 'Ошибка удаления слота'));
          }
        }}
        title="Удалить слот?"
        message={`Слот «${crud.deleteTarget?.id || ''}» будет удалён без возможности восстановления.`}
        confirmLabel="Удалить"
        danger
        loading={crud.deleting}
      >
        <BlockingReservationsList details={crud.deleteErrorDetails} />
        {crud.deleteErrorDetails?.blocking_count ? (
          <button
            type="button"
            onClick={() => {
              setForceDeleteError('');
              setForceDeleteTarget(crud.deleteTarget);
            }}
            className="mt-2 text-xs text-red-700 underline hover:no-underline"
          >
            Удалить принудительно вместе с этими бронированиями
          </button>
        ) : null}
      </ConfirmModal>

      <ConfirmModal
        open={!!forceDeleteTarget}
        onClose={() => setForceDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await eventSlotAvailabilitiesAPI.forceDelete(forceDeleteTarget.id);
            setForceDeleteTarget(null);
            crud.cancelDelete();
            await reload(page);
          } catch (err) {
            const msg = parseApiError(err, 'Ошибка принудительного удаления');
            setForceDeleteError(msg);
            throw new Error(msg);
          }
        }}
        title="Удалить принудительно?"
        message={
          forceDeleteError
          || `Это безвозвратно удалит слот «${forceDeleteTarget?.id || ''}» И все связанные с ним бронирования (историю заказов). Отменить нельзя.`
        }
        confirmLabel="Удалить всё"
        danger
      />

      <BulkActionModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Массовое создание слотов"
        submitLabel="Создать слоты"
        parseError={(err) => parseApiError(err, err?.message || 'Ошибка массового создания слотов')}
        initialValues={(() => {
          const next = createEmptyBulk();
          next.event = eventFilter || '';
          next.ticket_types = ticketTypeFilter ? [ticketTypeFilter] : [];
          return next;
        })()}
        onSubmit={async (values) => {
          const slot_datetimes =
            values.mode === 'interval'
              ? buildSlotDatetimesFromInterval({
                  startIso: parseInputToIso(values.start_datetime),
                  endIso: parseInputToIso(values.end_datetime),
                  stepMinutes: values.step_minutes,
                })
              : values.mode === 'schedule'
                ? buildSlotDatetimesFromSchedule({
                    startDate: values.schedule_start_date,
                    endDate: values.schedule_end_date,
                    days: values.schedule_days,
                    times: parseTimesText(values.schedule_times_text),
                  })
                : parseSlotDatetimesText(values.datetimes_text);

          const payload = {
            event: values.event,
            ticket_types: Array.isArray(values.ticket_types) ? values.ticket_types.filter(Boolean) : [],
            slot_datetimes,
            booking_closes_minutes_before: Number(values.booking_closes_minutes_before || 0),
            available_seats: Number(values.available_seats || 0),
            is_active: !!values.is_active,
          };

          if (!payload.event) throw new Error('Выберите событие');
          if (!payload.slot_datetimes.length) throw new Error('Нет дат/времени для создания слотов');

          const resp = await eventSlotAvailabilitiesAPI.bulkCreate(payload);
          const result = resp?.data || null;

          if (values.also_create_prices) {
            if (!payload.ticket_types.length) {
              throw new Error('Для автосоздания цен выберите хотя бы один тип билета');
            }
            const slot_ids = Array.isArray(result?.created_ids) ? result.created_ids : [];
            if (!slot_ids.length) throw new Error('Слоты не созданы — нечего прайсить');

            const currency = normalizeCurrency(values.price_currency);
            const is_active = !!values.price_is_active;

            if ((values.price_mode || 'single') === 'per_type') {
              const priceMap = values.price_by_ticket_type || {};
              for (const ttId of payload.ticket_types) {
                const raw = priceMap?.[ttId];
                const priceNum = Number(raw);
                if (!Number.isFinite(priceNum) || priceNum < 0) {
                  throw new Error(`Укажите корректную цену для типа билета ${ttId} (0 или больше)`);
                }
                await ticketPricesAPI.bulkCreate({
                  event: payload.event,
                  slot_ids,
                  ticket_types: [ttId],
                  price: priceNum,
                  currency,
                  is_active,
                });
              }
            } else {
              const priceNum = Number(values.price_value);
              if (!Number.isFinite(priceNum) || priceNum < 0) {
                throw new Error('Укажите корректную цену (0 или больше)');
              }
              await ticketPricesAPI.bulkCreate({
                event: payload.event,
                slot_ids,
                ticket_types: payload.ticket_types,
                price: priceNum,
                currency,
                is_active,
              });
            }
          }

          await reload(page);
          return result;
        }}
        renderFields={({ values, setValues, error }) => (
          <>
            <FormErrorAlert message={error} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Событие" required>
                <EventSelect
                  value={values.event}
                  onChange={(v) => {
                    setValues((prev) => ({ ...prev, event: v, ticket_types: [] }));
                    setEventFilter(v);
                  }}
                  options={eventOptions}
                  required
                  disabled={eventsLoading}
                />
              </Field>

              <Field label="Типы билетов (опционально)">
                {!values.event ? (
                  <div className="text-sm text-gray-500">Сначала выберите событие</div>
                ) : ticketTypesLoading ? (
                  <div className="text-sm text-gray-500">Загрузка типов билетов…</div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
                        onClick={() =>
                          setValues((prev) => ({
                            ...prev,
                            ticket_types: ticketTypeOptions.map((x) => String(x.id)),
                          }))
                        }
                        disabled={!ticketTypeOptions.length}
                      >
                        Выбрать все
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
                        onClick={() => setValues((prev) => ({ ...prev, ticket_types: [] }))}
                        disabled={!values.ticket_types?.length}
                      >
                        Снять выбор
                      </button>
                      <div className="text-xs text-gray-500 self-center">
                        Выбрано: {Array.isArray(values.ticket_types) ? values.ticket_types.length : 0}
                      </div>
                    </div>

                    <div className="max-h-48 overflow-auto rounded-lg border border-gray-200 p-2 bg-white">
                      {ticketTypeOptions.length ? (
                        <div className="space-y-1">
                          {ticketTypeOptions.map((tt) => {
                            const id = String(tt.id);
                            const label = getTicketTypeLabel(tt) || tt.id;
                            const checked = Array.isArray(values.ticket_types)
                              ? values.ticket_types.includes(id)
                              : false;
                            return (
                              <label key={id} className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const nextChecked = e.target.checked;
                                    setValues((prev) => {
                                      const curr = Array.isArray(prev.ticket_types) ? prev.ticket_types : [];
                                      if (nextChecked) {
                                        return { ...prev, ticket_types: Array.from(new Set([...curr, id])) };
                                      }
                                      return { ...prev, ticket_types: curr.filter((x) => x !== id) };
                                    });
                                  }}
                                />
                                <span className="min-w-0 truncate">{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Для события нет типов билетов</div>
                      )}
                    </div>
                  </div>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field
                label="Мест"
                hint="Общий пул на каждый создаваемый слот — делится между всеми выбранными типами билетов."
              >
                <TextInput
                  type="number"
                  min={0}
                  value={values.available_seats ?? 0}
                  onChange={(e) => setValues((prev) => ({ ...prev, available_seats: Number(e.target.value || 0) }))}
                />
              </Field>
              <Field label="Закрытие брони (мин)">
                <TextInput
                  type="number"
                  min={0}
                  value={values.booking_closes_minutes_before ?? 60}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, booking_closes_minutes_before: Number(e.target.value || 0) }))
                  }
                />
              </Field>
              <ActiveCheckboxField
                checked={values.is_active}
                onChange={(next) => setValues((prev) => ({ ...prev, is_active: next }))}
                text="Активны"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setValues((prev) => ({ ...prev, mode: 'interval' }))}
                className={`px-3 py-2 text-sm rounded-lg border ${values.mode === 'interval' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                Интервал
              </button>
              <button
                type="button"
                onClick={() => setValues((prev) => ({ ...prev, mode: 'list' }))}
                className={`px-3 py-2 text-sm rounded-lg border ${values.mode === 'list' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                Список дат
              </button>
              <button
                type="button"
                onClick={() => setValues((prev) => ({ ...prev, mode: 'schedule' }))}
                className={`px-3 py-2 text-sm rounded-lg border ${values.mode === 'schedule' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                Дни + время
              </button>
            </div>

            {values.mode === 'interval' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Начало" required>
                  <TextInput
                    type="datetime-local"
                    value={values.start_datetime}
                    onChange={(e) => setValues((prev) => ({ ...prev, start_datetime: e.target.value }))}
                    required
                  />
                </Field>
                <Field label="Конец" required>
                  <TextInput
                    type="datetime-local"
                    value={values.end_datetime}
                    onChange={(e) => setValues((prev) => ({ ...prev, end_datetime: e.target.value }))}
                    required
                  />
                </Field>
                <Field label="Шаг (мин)" required>
                  <TextInput
                    type="number"
                    min={1}
                    value={values.step_minutes}
                    onChange={(e) => setValues((prev) => ({ ...prev, step_minutes: Number(e.target.value || 0) }))}
                    required
                  />
                </Field>
              </div>
            ) : values.mode === 'schedule' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Дата начала" required>
                    <TextInput
                      type="date"
                      value={values.schedule_start_date}
                      onChange={(e) => setValues((prev) => ({ ...prev, schedule_start_date: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Дата конца" required>
                    <TextInput
                      type="date"
                      value={values.schedule_end_date}
                      onChange={(e) => setValues((prev) => ({ ...prev, schedule_end_date: e.target.value }))}
                      required
                    />
                  </Field>
                </div>

                <Field label="Дни недели">
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['mon', 'Пн'],
                      ['tue', 'Вт'],
                      ['wed', 'Ср'],
                      ['thu', 'Чт'],
                      ['fri', 'Пт'],
                      ['sat', 'Сб'],
                      ['sun', 'Вс'],
                    ].map(([k, label]) => (
                      <label key={k} className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!values.schedule_days?.[k]}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              schedule_days: { ...(prev.schedule_days || {}), [k]: e.target.checked },
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="Времена (HH:mm, по строке)" required>
                  <textarea
                    rows={5}
                    value={values.schedule_times_text}
                    onChange={(e) => setValues((prev) => ({ ...prev, schedule_times_text: e.target.value }))}
                    placeholder={'Например:\n10:00\n12:30\n15:00'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    required
                  />
                </Field>
              </div>
            ) : (
              <Field label="Даты/время (по одной строке)" required>
                <textarea
                  rows={6}
                  value={values.datetimes_text}
                  onChange={(e) => setValues((prev) => ({ ...prev, datetimes_text: e.target.value }))}
                  placeholder={'Примеры:\n2026-05-10 10:00\n2026-05-10 12:00\n2026-05-11T09:30'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  required
                />
              </Field>
            )}

            <div className="rounded-lg border border-gray-200 p-3 space-y-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={!!values.also_create_prices}
                  onChange={(e) => setValues((prev) => ({ ...prev, also_create_prices: e.target.checked }))}
                />
                Автоматически создать цены для созданных слотов
              </label>

              {values.also_create_prices ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setValues((prev) => ({ ...prev, price_mode: 'single' }))}
                      className={`px-3 py-1.5 text-xs rounded-lg border ${
                        (values.price_mode || 'single') === 'single'
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700'
                      }`}
                    >
                      Одна цена на все типы
                    </button>
                    <button
                      type="button"
                      onClick={() => setValues((prev) => ({ ...prev, price_mode: 'per_type' }))}
                      className={`px-3 py-1.5 text-xs rounded-lg border ${
                        values.price_mode === 'per_type'
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700'
                      }`}
                      disabled={!Array.isArray(values.ticket_types) || !values.ticket_types.length}
                      title={
                        Array.isArray(values.ticket_types) && values.ticket_types.length
                          ? ''
                          : 'Сначала выберите типы билетов'
                      }
                    >
                      Разные цены по типам
                    </button>
                  </div>

                  {values.price_mode === 'per_type' ? (
                    <div className="rounded-lg border border-gray-200 p-2 bg-white space-y-2">
                      {(Array.isArray(values.ticket_types) ? values.ticket_types : []).map((ttId) => {
                        const tt = ticketTypeOptions.find((x) => String(x.id) === String(ttId));
                        const label = getTicketTypeLabel(tt) || String(ttId);
                        const v = values.price_by_ticket_type?.[ttId] ?? '';
                        return (
                          <div key={ttId} className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2 items-center">
                            <div className="text-sm text-gray-700 truncate" title={label}>
                              {label}
                            </div>
                            <TextInput
                              type="number"
                              step="0.01"
                              min="0"
                              value={v}
                              onChange={(e) =>
                                setValues((prev) => ({
                                  ...prev,
                                  price_by_ticket_type: {
                                    ...(prev.price_by_ticket_type || {}),
                                    [ttId]: e.target.value,
                                  },
                                }))
                              }
                              placeholder="0.00"
                              required
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Field label="Цена" required>
                        <TextInput
                          type="number"
                          step="0.01"
                          min="0"
                          value={values.price_value}
                          onChange={(e) => setValues((prev) => ({ ...prev, price_value: e.target.value }))}
                          placeholder="0.00"
                          required
                        />
                      </Field>
                      <Field label="Валюта" required>
                        <TextInput
                          value={values.price_currency}
                          onChange={(e) => setValues((prev) => ({ ...prev, price_currency: e.target.value }))}
                          maxLength={3}
                          required
                        />
                      </Field>
                      <ActiveCheckboxField
                        checked={values.price_is_active}
                        onChange={(next) => setValues((prev) => ({ ...prev, price_is_active: next }))}
                        text="Цена активна"
                      />
                    </div>
                  )}

                  {values.price_mode === 'per_type' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Валюта" required>
                        <TextInput
                          value={values.price_currency}
                          onChange={(e) => setValues((prev) => ({ ...prev, price_currency: e.target.value }))}
                          maxLength={3}
                          required
                        />
                      </Field>
                      <ActiveCheckboxField
                        checked={values.price_is_active}
                        onChange={(next) => setValues((prev) => ({ ...prev, price_is_active: next }))}
                        text="Цена активна"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        )}
        renderResult={({ result }) =>
          result ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <div className="font-medium text-gray-800">Результат</div>
              <div className="mt-1">
                Создано: <span className="font-semibold">{result.created_count ?? 0}</span>, пропущено (уже было):{' '}
                <span className="font-semibold">{result.skipped_existing ?? 0}</span>
              </div>
              {Array.isArray(result.errors) && result.errors.length ? (
                <div className="mt-2 text-xs text-red-700">
                  Ошибки: {result.errors.length} (первые показаны в ответе API)
                </div>
              ) : null}
              {Array.isArray(result.overlap_warnings) && result.overlap_warnings.length ? (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                  <div className="font-medium">
                    ⚠️ Слоты слишком близко друг к другу ({result.overlap_warnings.length}):
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {result.overlap_warnings.slice(0, 5).map((w) => (
                      <div key={w.slot_datetime}>
                        {new Date(w.slot_datetime).toLocaleString()} — рядом:{' '}
                        {(w.close_to || []).map((c) => new Date(c).toLocaleString()).join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null
        }
      />
    </Layout>
  );
}

