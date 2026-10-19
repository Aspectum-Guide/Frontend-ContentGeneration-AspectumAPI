import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventSlotAvailabilitiesAPI, ticketPricesAPI } from '../../../api/booking';
import Layout from '../../../components/Layout';
import { FormLabel, Alert, BulkActionModal, Button, Checkbox, CheckboxField, ConfirmModal, DataTable, Field, FormActions, FormHint, InlineState, Modal, PageHeader, Panel, Select, StatusBadge, TableRowActions, Tabs, Textarea, TextInput, formGridClassName, Glyph } from '@aspectum/admin-ui-web';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { useCatalogCrud } from '../core/useCatalogCrud';
import { useCatalogPagedReload } from '../core/useCatalogPagedReload';
import { useCatalogResource } from '../core/useCatalogResource';
import { useAppLanguages } from '../../../hooks/useAppLanguages';
import { useEventOptions, useTicketTypeMapForEvents, useTicketTypeOptions } from '../shared/bookingOptions';
import BlockingReservationsList from '../shared/components/BlockingReservationsList';
import EventSelect from '../shared/components/EventSelect';
import TicketTypeSelect from '../shared/components/TicketTypeSelect';
import { DEFAULT_CURRENCY, normalizeCurrency } from '../shared/currencies';
import { getEventLabel, getTicketTypeLabel } from '../shared/labels';
import {
  buildFromInterval as buildSlotDatetimesFromInterval,
  buildSlotDatetimesFromSchedule,
  formatIsoForInput,
  parseInputToIso,
  parseSlotDatetimesText,
  parseTimesText,
} from '../shared/scheduleParsers';

const PAGE_SIZE = 20;

function todayDateInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// `date` inputs are local YYYY-MM-DD with no time — widen to the full day in
// local time before sending as the ISO bound the backend filters on.
function dateInputToIsoStart(value) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function dateInputToIsoEnd(value) {
  if (!value) return '';
  const d = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function createEmptyAvailability() {
  return {
    id: null,
    event: '',
    ticket_types: [],
    slot_datetime: '',
    booking_closes_minutes_before: 60,
    available_seats: 0,
    is_active: true,
    languages: [],
  };
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
    languages: [],
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
  const { languages: appLanguages } = useAppLanguages();
  const slotLanguageOptions = appLanguages.map((language) => [
    language.code,
    language.label || language.name || language.code,
  ]);
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
  // Defaults to hiding past slots — the table has no server-side search and
  // the event's full slot history otherwise buries upcoming slots on page 1
  // (ordering is slot_datetime ascending, oldest first).
  const [dateFrom, setDateFrom] = useState(todayDateInputValue);
  const [dateTo, setDateTo] = useState('');

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
      languages: Array.isArray(row?.languages) ? row.languages.map((x) => String(x)) : [],
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
      languages: Array.isArray(editingAvailability.languages)
        ? editingAvailability.languages.filter(Boolean)
        : [],
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
  const availabilityItems = avail.items;
  const loadAvailabilities = avail.load;
  const editingItem = crud.editingItem;
  const openCreate = crud.openCreate;
  const closeEdit = crud.closeEdit;
  const openCrudEdit = crud.openEdit;

  // Отдельный источник для формы редактирования/создания — раньше она
  // переиспользовала `eventFilter` таблицы, из-за чего открытие "Ред."
  // молча перефильтровывало и сбрасывало на 1-ю страницу основной список.
  const editEventId = crud.editingItem?.event || '';
  const { ticketTypeOptions: editTicketTypeOptions, ticketTypesLoading: editTicketTypesLoading } =
    useTicketTypeOptions(editEventId, 500, { globalOnly: true });

  const [bulkOpen, setBulkOpen] = useState(false);

  // BulkActionModal syncs this into its own state via a `[open, initialValues]`
  // effect — an unmemoized object literal here would give it a new reference
  // on every render (not just when the filters actually change), re-firing
  // that effect continuously while the modal is open.
  const bulkInitialValues = useMemo(() => {
    const next = createEmptyBulk();
    next.event = eventFilter || '';
    next.ticket_types = ticketTypeFilter ? [ticketTypeFilter] : [];
    return next;
  }, [eventFilter, ticketTypeFilter]);

  // `event.title` is a localized {code: text} map — an event is only
  // considered "multi-language" when 2+ of those are actually filled in
  // (matches BookingAPI.pricing_catalog.event_available_languages on the
  // backend, which is what drives the mobile app's language picker).
  const eventTitleLangCount = useCallback((eventId) => {
    const ev = eventOptions.find((e) => String(e.id) === String(eventId));
    const title = ev?.title;
    if (!title || typeof title !== 'object') return 0;
    return Object.values(title).filter(Boolean).length;
  }, [eventOptions]);

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
    const items = Array.isArray(availabilityItems) ? availabilityItems : [];
    return Array.from(new Set(items.map((x) => String(x?.event || '')).filter(Boolean)));
  }, [availabilityItems]);
  const ticketTypeById = useTicketTypeMapForEvents(visibleEventIds);

  useEffect(() => {
    setTicketTypeFilter('');
  }, [eventFilter]);

  const reload = useCallback(async (pageNum) => {
    await loadAvailabilities(
      {
        page: pageNum,
        page_size: PAGE_SIZE,
        event: eventFilter || undefined,
        ticket_type: ticketTypeFilter || undefined,
        date_from: dateInputToIsoStart(dateFrom) || undefined,
        date_to: dateInputToIsoEnd(dateTo) || undefined,
        ordering: 'slot_datetime',
      },
      (err) => parseApiError(err, 'Ошибка загрузки слотов')
    );
  }, [loadAvailabilities, eventFilter, ticketTypeFilter, dateFrom, dateTo]);

  useCatalogPagedReload({
    page,
    setPage,
    reload,
    filterSignature: `${eventFilter}|${ticketTypeFilter}|${dateFrom}|${dateTo}`,
  });

  // Do not depend on whole `crud`: inline mappers make it a new object every
  // render, and setMobileActions → LayoutActionsContext soft-loops
  // ("Maximum update depth exceeded").
  useEffect(() => {
    const actions = [
      {
        id: 'create-slot-availability',
        label: editingItem ? 'Новый слот' : 'Создать слот',
        onClick: () => {
          openCreate();
        },
        variant: editingItem ? 'secondary' : 'primary',
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

    if (editingItem) {
      actions.push({
        id: 'close-slot-availability-editor',
        label: 'Закрыть форму',
        onClick: () => closeEdit(),
        variant: 'secondary',
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [editingItem, openCreate, closeEdit, setMobileActions]);

  const openEdit = useCallback(async (row) => {
    await openCrudEdit(row);
  }, [openCrudEdit]);

  const columns = [
    {
      key: 'slot_datetime',
      label: 'Время слота',
      render: (iso) => <span className="text-sm text-aspectum-text-strong">{iso ? new Date(iso).toLocaleString() : '—'}</span>,
    },
    {
      key: 'event',
      label: 'Событие',
      render: (eventId) => (
        <span className="text-sm text-aspectum-text-strong">
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
            if (!ids.length) return <div className="text-sm text-aspectum-text-disabled">—</div>;
            const titles = ids.map((id) => ticketTypeById.get(id)?.title || id).filter(Boolean);
            const primaries = ids.map((id) => ticketTypeById.get(id)?.code || '').filter(Boolean);
            return (
              <>
                <div className="text-sm text-aspectum-text-strong truncate">{titles.join(', ')}</div>
                {primaries.length ? (
                  <div className="text-xs text-aspectum-text-disabled truncate">{primaries.join(', ')}</div>
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
      render: (v) => <span className="text-sm text-aspectum-text-strong">{Number.isFinite(v) ? v : 0}</span>,
    },
    {
      key: 'booking_closes_minutes_before',
      label: 'Закрытие (мин)',
      render: (v) => <span className="text-sm text-aspectum-text-strong">{Number.isFinite(v) ? v : 60}</span>,
    },
    {
      key: 'is_active',
      label: 'Статус',
      render: (active) => <StatusBadge active={active} />,
    },
    {
      key: 'languages',
      label: 'Языки',
      render: (langs) => {
        const codes = Array.isArray(langs) ? langs : [];
        if (!codes.length) return <span className="text-sm text-aspectum-text-disabled">любой</span>;
        return <span className="text-sm text-aspectum-text-strong">{codes.join(', ')}</span>;
      },
    },
  ];

  return (
    <Layout>
      <PageHeader
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
        isFiltered={!!(eventFilter || ticketTypeFilter || dateFrom || dateTo)}
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
            />

            <TicketTypeSelect
              value={ticketTypeFilter}
              onChange={setTicketTypeFilter}
              options={ticketTypeOptions}
              disabled={!eventFilter || ticketTypesLoading}
              placeholder={eventFilter ? 'Все типы' : 'Сначала выберите событие'}
            />

            <TextInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Слоты с этой даты" />
            <TextInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Слоты по эту дату" />
            {(dateFrom || dateTo) && (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
              >
                Сбросить даты
              </Button>
            )}
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
            <Alert tone="error">{crud.saveError}</Alert>

            <div className={formGridClassName()}>
              <Field label="Событие" required>
                <EventSelect
                  value={crud.editingItem.event}
                  onChange={(v) => {
                    crud.setEditingItem((prev) => ({ ...prev, event: v, ticket_types: [] }));
                  }}
                  options={eventOptions}
                  disabled={eventsLoading}
                  required
                />
              </Field>

              <Field label="Типы билетов">
                <TicketTypeSelect
                  multiple
                  value={crud.editingItem.ticket_types}
                  onChange={(selected) => crud.setEditingItem((prev) => ({ ...prev, ticket_types: selected }))}
                  options={editTicketTypeOptions}
                  disabled={!crud.editingItem.event || editTicketTypesLoading}
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

            <div className={formGridClassName({ columns: 3 })}>
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
              <CheckboxField
                checked={crud.editingItem.is_active}
                onChange={(next) => crud.setEditingItem((prev) => ({ ...prev, is_active: next }))}
                text="Активен"
              />
            </div>

            <Field
              label="Язык"
              hint={
                eventTitleLangCount(crud.editingItem.event) >= 2
                  ? 'У этого события несколько языков в заголовке — язык слота обязателен.'
                  : 'Один слот — один язык гида. Не выбрано — слот виден на любом языке.'
              }
            >
              <Select required={eventTitleLangCount(crud.editingItem.event) >= 2} value={(crud.editingItem.languages || [])[0] || ''} onChange={(e) => crud.setEditingItem((prev) => ({ ...prev, languages: e.target.value ? [e.target.value] : [], })) }>
                <option value="">Любой язык</option>
                {slotLanguageOptions.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </Select>
            </Field>

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
          <Button
            type="button"
            variant="linkDanger"
            size="sm"
            onClick={() => {
              setForceDeleteError('');
              setForceDeleteTarget(crud.deleteTarget);
            }}
            className="mt-2"
          >
            Удалить принудительно вместе с этими бронированиями
          </Button>
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
        initialValues={bulkInitialValues}
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
            languages: Array.isArray(values.languages) ? values.languages.filter(Boolean) : [],
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
            <Alert tone="error">{error}</Alert>

            <div className={formGridClassName()}>
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
                  <div className="text-sm text-aspectum-text-muted">Сначала выберите событие</div>
                ) : ticketTypesLoading ? (
                  <InlineState loading>Загрузка типов билетов…</InlineState>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setValues((prev) => ({
                            ...prev,
                            ticket_types: ticketTypeOptions.map((x) => String(x.id)),
                          }))
                        }
                        disabled={!ticketTypeOptions.length}
                      >
                        Выбрать все
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setValues((prev) => ({ ...prev, ticket_types: [] }))}
                        disabled={!values.ticket_types?.length}
                      >
                        Снять выбор
                      </Button>
                      <div className="text-xs text-aspectum-text-muted self-center">
                        Выбрано: {Array.isArray(values.ticket_types) ? values.ticket_types.length : 0}
                      </div>
                    </div>

                    <Panel tone="muted" className="max-h-48 overflow-auto p-2">
                      {ticketTypeOptions.length ? (
                        <div className="space-y-1">
                          {ticketTypeOptions.map((tt) => {
                            const id = String(tt.id);
                            const label = getTicketTypeLabel(tt) || tt.id;
                            const checked = Array.isArray(values.ticket_types)
                              ? values.ticket_types.includes(id)
                              : false;
                            return (
                              <FormLabel key={id}  layout="row" size="sm" tone="strong">
                                <Checkbox
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
                              </FormLabel>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-aspectum-text-muted">Для события нет типов билетов</div>
                      )}
                    </Panel>
                  </div>
                )}
              </Field>
            </div>

            <div className={formGridClassName({ columns: 3 })}>
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
              <CheckboxField
                checked={values.is_active}
                onChange={(next) => setValues((prev) => ({ ...prev, is_active: next }))}
                text="Активны"
              />
            </div>

            <Field
              label="Язык"
              hint={
                eventTitleLangCount(values.event) >= 2
                  ? 'У этого события несколько языков в заголовке — язык слота обязателен.'
                  : 'Один слот — один язык гида. Применится ко всем создаваемым слотам. Не выбрано — доступны на любом языке.'
              }
            >
              <Select required={eventTitleLangCount(values.event) >= 2} value={(values.languages || [])[0] || ''} onChange={(e) => setValues((prev) => ({ ...prev, languages: e.target.value ? [e.target.value] : [], })) }>
                <option value="">Любой язык</option>
                {slotLanguageOptions.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </Select>
            </Field>

            <Tabs
              items={[
                { id: 'interval', label: 'Интервал' },
                { id: 'list', label: 'Список дат' },
                { id: 'schedule', label: 'Дни + время' },
              ]}
              value={values.mode}
              onChange={(mode) => setValues((prev) => ({ ...prev, mode }))}
            />

            {values.mode === 'interval' ? (
              <div className={formGridClassName({ columns: 3 })}>
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
                <div className={formGridClassName()}>
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
                      <FormLabel key={k}  size="sm" tone="strong"  layout="inlineRow">
                        <Checkbox
                          checked={!!values.schedule_days?.[k]}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              schedule_days: { ...(prev.schedule_days || {}), [k]: e.target.checked },
                            }))
                          }
                        />
                        {label}
                      </FormLabel>
                    ))}
                  </div>
                </Field>

                <Field label="Времена (HH:mm, по строке)" required>
                  <Textarea className="font-mono" rows={5} value={values.schedule_times_text} onChange={(e) => setValues((prev) => ({ ...prev, schedule_times_text: e.target.value }))} placeholder={'Например:\n10:00\n12:30\n15:00'} required />
                </Field>
              </div>
            ) : (
              <Field label="Даты/время (по одной строке)" required>
                <Textarea className="font-mono" rows={6} value={values.datetimes_text} onChange={(e) => setValues((prev) => ({ ...prev, datetimes_text: e.target.value }))} placeholder={'Примеры:\n2026-05-10 10:00\n2026-05-10 12:00\n2026-05-11T09:30'} required />
              </Field>
            )}

            <Panel tone="muted" className="p-3 space-y-3">
              <FormLabel  size="sm" tone="emphasis"  layout="inlineRow">
                <Checkbox
                  checked={!!values.also_create_prices}
                  onChange={(e) => setValues((prev) => ({ ...prev, also_create_prices: e.target.checked }))}
                />
                Автоматически создать цены для созданных слотов
              </FormLabel>

              {values.also_create_prices ? (
                <div className="space-y-3">
                  <Tabs
                    items={[
                      { id: 'single', label: 'Одна цена на все типы' },
                      {
                        id: 'per_type',
                        label: 'Разные цены по типам',
                        disabled: !Array.isArray(values.ticket_types) || !values.ticket_types.length,
                      },
                    ]}
                    value={values.price_mode || 'single'}
                    onChange={(price_mode) => setValues((prev) => ({ ...prev, price_mode }))}
                  />

                  {values.price_mode === 'per_type' ? (
                    <Panel className="p-2 space-y-2">
                      {(Array.isArray(values.ticket_types) ? values.ticket_types : []).map((ttId) => {
                        const tt = ticketTypeOptions.find((x) => String(x.id) === String(ttId));
                        const label = getTicketTypeLabel(tt) || String(ttId);
                        const v = values.price_by_ticket_type?.[ttId] ?? '';
                        return (
                          <div key={ttId} className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2 items-center">
                            <div className="text-sm text-aspectum-text-strong truncate" title={label}>
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
                    </Panel>
                  ) : (
                    <div className={formGridClassName({ columns: 3 })}>
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
                      <CheckboxField
                        checked={values.price_is_active}
                        onChange={(next) => setValues((prev) => ({ ...prev, price_is_active: next }))}
                        text="Цена активна"
                      />
                    </div>
                  )}

                  {values.price_mode === 'per_type' ? (
                    <div className={formGridClassName()}>
                      <Field label="Валюта" required>
                        <TextInput
                          value={values.price_currency}
                          onChange={(e) => setValues((prev) => ({ ...prev, price_currency: e.target.value }))}
                          maxLength={3}
                          required
                        />
                      </Field>
                      <CheckboxField
                        checked={values.price_is_active}
                        onChange={(next) => setValues((prev) => ({ ...prev, price_is_active: next }))}
                        text="Цена активна"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Panel>
          </>
        )}
        renderResult={({ result }) =>
          result ? (
            <Panel tone="muted" className="p-3 text-sm">
              <div className="font-medium text-aspectum-text-emphasis">Результат</div>
              <div className="mt-1">
                Создано: <span className="font-semibold">{result.created_count ?? 0}</span>, пропущено (уже было):{' '}
                <span className="font-semibold">{result.skipped_existing ?? 0}</span>
              </div>
              {Array.isArray(result.errors) && result.errors.length ? (
                <div className="mt-2 text-xs text-aspectum-danger-strong">
                  Ошибки: {result.errors.length} (первые показаны в ответе API)
                </div>
              ) : null}
              {Array.isArray(result.overlap_warnings) && result.overlap_warnings.length ? (
                <Alert tone="warning" className="mt-2 text-xs px-2 py-1.5">
                  <div className="font-medium">
                    <Glyph name="⚠" /> Слоты слишком близко друг к другу ({result.overlap_warnings.length}):
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {result.overlap_warnings.slice(0, 5).map((w) => (
                      <div key={w.slot_datetime}>
                        {new Date(w.slot_datetime).toLocaleString()} — рядом:{' '}
                        {(w.close_to || []).map((c) => new Date(c).toLocaleString()).join(', ')}
                      </div>
                    ))}
                  </div>
                </Alert>
              ) : null}
            </Panel>
          ) : null
        }
      />
    </Layout>
  );
}
