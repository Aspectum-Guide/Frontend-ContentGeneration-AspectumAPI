import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eventSlotAvailabilitiesAPI, ticketPricesAPI, ticketTypesAPI } from '../../../api/booking';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { Field, FormActions, TextInput } from '../../../components/ui/FormField';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { useCatalogResource } from '../core/useCatalogResource';
import { useEventOptions, useTicketTypeOptions } from '../shared/bookingOptions';
import ActiveCheckboxField from '../shared/components/ActiveCheckboxField';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import FormHint from '../shared/components/FormHint';
import StatusBadge from '../shared/components/StatusBadge';
import TableRowActions from '../shared/components/TableRowActions';
import { getMultiLangValue } from '../shared/i18n';

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
    price_value: '',
    price_currency: 'EUR',
    price_is_active: true,
  };
}

function buildSlotDatetimesFromInterval({ startIso, endIso, stepMinutes }) {
  const start = startIso ? new Date(startIso) : null;
  const end = endIso ? new Date(endIso) : null;
  const step = Number(stepMinutes || 0);
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (!Number.isFinite(step) || step <= 0) return [];

  const out = [];
  for (let t = start.getTime(); t <= end.getTime(); t += step * 60 * 1000) {
    out.push(new Date(t).toISOString());
    if (out.length >= 1000) break;
  }
  return out;
}

function parseSlotDatetimesText(text) {
  const raw = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out = [];
  for (const line of raw) {
    // Accept:
    // - ISO strings
    // - "YYYY-MM-DD HH:mm"
    // - "YYYY-MM-DDTHH:mm"
    const normalized = line.replace(' ', 'T');
    const d = new Date(normalized);
    if (!Number.isNaN(d.getTime())) {
      out.push(d.toISOString());
    }
    if (out.length >= 1000) break;
  }
  // de-dupe
  return Array.from(new Set(out));
}

function parseTimesText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const out = [];
  for (const line of lines) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(line);
    if (!m) continue;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) continue;
    out.push({ hh, mm, label: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` });
    if (out.length >= 48) break;
  }
  // de-dupe by label
  const seen = new Set();
  return out.filter((t) => (seen.has(t.label) ? false : (seen.add(t.label), true)));
}

function buildSlotDatetimesFromSchedule({ startDate, endDate, days, times }) {
  // startDate/endDate are "YYYY-MM-DD"
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end.getTime() < start.getTime()) return [];
  if (!times?.length) return [];

  const dayMap = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
  };

  const out = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    const key = dayMap[d.getDay()];
    if (!days?.[key]) continue;
    for (const t of times) {
      const dt = new Date(d);
      dt.setHours(t.hh, t.mm, 0, 0);
      out.push(dt.toISOString());
      if (out.length >= 1000) return Array.from(new Set(out));
    }
  }
  return Array.from(new Set(out));
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
  const [eventFilter, setEventFilter] = useState('');

  const { ticketTypeOptions, ticketTypesLoading } = useTicketTypeOptions(eventFilter);
  const [ticketTypeFilter, setTicketTypeFilter] = useState('');

  // Cache ticket type labels for table rendering (so we can show labels even when filters are empty).
  const ticketTypeCacheRef = useRef(new Map()); // id -> { title: string, primary: string }
  const [, setTicketTypeLabelVersion] = useState(0);

  const [editingAvailability, setEditingAvailability] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(createEmptyBulk());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);

  const eventLabelById = useMemo(() => {
    const map = new Map();
    for (const eventItem of eventOptions) {
      map.set(String(eventItem.id), getMultiLangValue(eventItem.title) || String(eventItem.id));
    }
    return map;
  }, [eventOptions]);

  const ticketTypeById = useMemo(() => {
    // start with cached (covers table rows)
    const map = new Map(ticketTypeCacheRef.current);
    // overlay currently loaded options for selects (event-filtered)
    for (const tt of ticketTypeOptions) {
      const id = String(tt?.id || '');
      if (!id) continue;
      const title = getMultiLangValue(tt?.name) || tt?.name_primary || id;
      const primary = String(tt?.name_primary || '').trim();
      map.set(id, { title, primary });
    }
    return map;
  }, [ticketTypeOptions]);

  useEffect(() => {
    // Prefetch ticket type labels for all events visible in current table page,
    // so the "Тип билета" column shows name_primary instead of UUID.
    const items = Array.isArray(avail.items) ? avail.items : [];
    const eventIds = Array.from(
      new Set(items.map((x) => String(x?.event || '')).filter(Boolean))
    );
    if (!eventIds.length) return;

    let cancelled = false;

    (async () => {
      try {
        const responses = await Promise.all(
          eventIds.map((eventId) =>
            ticketTypesAPI.list({
              event: eventId,
              page_size: 500,
              ordering: 'name_primary',
            })
          )
        );
        if (cancelled) return;

        let changed = false;
        for (const r of responses) {
          const data = r?.data;
          const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
          for (const tt of list) {
            const id = String(tt?.id || '');
            if (!id) continue;
            const title = getMultiLangValue(tt?.name) || tt?.name_primary || id;
            const primary = String(tt?.name_primary || '').trim();
            const prev = ticketTypeCacheRef.current.get(id);
            if (!prev || prev.title !== title || prev.primary !== primary) {
              ticketTypeCacheRef.current.set(id, { title, primary });
              changed = true;
            }
          }
        }
        if (changed) setTicketTypeLabelVersion((v) => v + 1);
      } catch {
        // ignore prefetch errors (table will fallback to UUID)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [avail.items]);

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
        label: editingAvailability ? 'Новый слот' : 'Создать слот',
        onClick: () => {
          setSaveError(null);
          setEditingAvailability(createEmptyAvailability());
        },
        variant: editingAvailability ? 'secondary' : 'primary',
      },
      {
        id: 'bulk-create-slot-availabilities',
        label: 'Массово слоты',
        onClick: () => {
          setBulkError(null);
          setBulkResult(null);
          setBulkForm(() => {
            const next = createEmptyBulk();
            // prefill with current filters
            next.event = eventFilter || '';
            next.ticket_types = ticketTypeFilter ? [ticketTypeFilter] : [];
            return next;
          });
          setBulkOpen(true);
        },
        variant: 'secondary',
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
  }, [editingAvailability, eventFilter, ticketTypeFilter, setMobileActions]);

  const handleBulkCreate = async (e) => {
    e?.preventDefault();

    const slot_datetimes =
      bulkForm.mode === 'interval'
        ? buildSlotDatetimesFromInterval({
            startIso: parseInputToIso(bulkForm.start_datetime),
            endIso: parseInputToIso(bulkForm.end_datetime),
            stepMinutes: bulkForm.step_minutes,
          })
        : bulkForm.mode === 'schedule'
          ? buildSlotDatetimesFromSchedule({
              startDate: bulkForm.schedule_start_date,
              endDate: bulkForm.schedule_end_date,
              days: bulkForm.schedule_days,
              times: parseTimesText(bulkForm.schedule_times_text),
            })
          : parseSlotDatetimesText(bulkForm.datetimes_text);

    const payload = {
      event: bulkForm.event,
      ticket_types: Array.isArray(bulkForm.ticket_types) ? bulkForm.ticket_types.filter(Boolean) : [],
      slot_datetimes,
      booking_closes_minutes_before: Number(bulkForm.booking_closes_minutes_before || 0),
      available_seats: Number(bulkForm.available_seats || 0),
      is_active: !!bulkForm.is_active,
    };

    try {
      setBulkSaving(true);
      setBulkError(null);
      setBulkResult(null);

      if (!payload.event) {
        throw new Error('Выберите событие');
      }
      if (!payload.slot_datetimes.length) {
        throw new Error('Нет дат/времени для создания слотов');
      }

      const resp = await eventSlotAvailabilitiesAPI.bulkCreate(payload);
      const result = resp?.data || null;
      setBulkResult(result);

      if (bulkForm.also_create_prices) {
        const priceNum = Number(bulkForm.price_value);
        if (!payload.ticket_types.length) {
          throw new Error('Для автосоздания цен выберите хотя бы один тип билета');
        }
        if (!Number.isFinite(priceNum) || priceNum < 0) {
          throw new Error('Укажите корректную цену (0 или больше)');
        }
        const slot_ids = Array.isArray(result?.created_ids) ? result.created_ids : [];
        if (!slot_ids.length) {
          throw new Error('Слоты не созданы — нечего прайсить');
        }
        await ticketPricesAPI.bulkCreate({
          event: payload.event,
          slot_ids,
          ticket_types: payload.ticket_types,
          price: priceNum,
          currency: (bulkForm.price_currency || 'EUR').toUpperCase(),
          is_active: !!bulkForm.price_is_active,
        });
      }

      await reload(page);
    } catch (err) {
      setBulkError(parseApiError(err, err?.message || 'Ошибка массового создания слотов'));
    } finally {
      setBulkSaving(false);
    }
  };

  const openEdit = useCallback(async (row) => {
    setSaveError(null);
    const base = {
      id: row?.id || null,
      event: row?.event ? String(row.event) : '',
      ticket_types: Array.isArray(row?.ticket_types) ? row.ticket_types.map((x) => String(x)) : [],
      slot_datetime: row?.slot_datetime || '',
      booking_closes_minutes_before: Number(row?.booking_closes_minutes_before ?? 60),
      available_seats: Number(row?.available_seats ?? 0),
      is_active: row?.is_active !== false,
    };

    setEditingAvailability(base);
    // Important: trigger ticket type options load for edit form
    setEventFilter(base.event || '');
    if (!row?.id) return;

    try {
      const r = await eventSlotAvailabilitiesAPI.get(row.id);
      const d = r?.data;
      if (d && typeof d === 'object') {
        setEditingAvailability((prev) => ({
          ...prev,
          event: d.event ? String(d.event) : prev.event,
          ticket_types: Array.isArray(d.ticket_types) ? d.ticket_types.map((x) => String(x)) : prev.ticket_types,
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
      ticket_types: Array.isArray(editingAvailability.ticket_types)
        ? editingAvailability.ticket_types.filter(Boolean)
        : [],
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
      key: 'ticket_types',
      label: 'Типы билетов',
      render: (ticketTypeIds) => (
        <div className="min-w-0">
          {(() => {
            const ids = Array.isArray(ticketTypeIds) ? ticketTypeIds.map((x) => String(x)) : [];
            if (!ids.length) return <div className="text-sm text-gray-400">—</div>;
            const titles = ids.map((id) => ticketTypeById.get(id)?.title || id).filter(Boolean);
            const primaries = ids.map((id) => ticketTypeById.get(id)?.primary || '').filter(Boolean);
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
          setSaveError(null);
          setEditingAvailability(createEmptyAvailability());
        }}
        secondaryActions={[
          {
            label: 'Массово слоты',
            onClick: () => {
              setBulkError(null);
              setBulkResult(null);
              setBulkForm(() => {
                const next = createEmptyBulk();
                next.event = eventFilter || '';
                next.ticket_types = ticketTypeFilter ? [ticketTypeFilter] : [];
                return next;
              });
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
                  {getMultiLangValue(tt.name) || tt.name_primary || tt.id}
                </option>
              ))}
            </select>
          </>
        )}
        actions={(row) => (
          <TableRowActions
            onEdit={() => openEdit(row)}
            onDelete={() => setDeleteTarget(row)}
          />
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
            <FormErrorAlert message={saveError} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Событие" required>
                <select
                  value={editingAvailability.event}
                  onChange={(e) => {
                    const nextEvent = e.target.value;
                    setEditingAvailability((prev) => ({ ...prev, event: nextEvent, ticket_types: [] }));
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

              <Field label="Типы билетов">
                <select
                  multiple
                  value={editingAvailability.ticket_types}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setEditingAvailability((prev) => ({ ...prev, ticket_types: selected }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={!editingAvailability.event || ticketTypesLoading}
                >
                  {!editingAvailability.event ? (
                    <option value="" disabled>Сначала выберите событие</option>
                  ) : null}
                  {ticketTypeOptions.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {getMultiLangValue(tt.name) || tt.name_primary || tt.id}
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
              <ActiveCheckboxField
                checked={editingAvailability.is_active}
                onChange={(next) => setEditingAvailability((prev) => ({ ...prev, is_active: next }))}
                text="Активен"
              />
            </div>

            <FormHint>
              Ограничение бэкенда: выбранный тип билета должен принадлежать этому событию.
            </FormHint>

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

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Массовое создание слотов"
        size="lg"
      >
        <form onSubmit={handleBulkCreate} className="space-y-4">
          <FormErrorAlert message={bulkError} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Событие" required>
              <select
                value={bulkForm.event}
                onChange={(e) => {
                  const nextEvent = e.target.value;
                  setBulkForm((prev) => ({ ...prev, event: nextEvent, ticket_types: [] }));
                  setEventFilter(nextEvent);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
                disabled={eventsLoading}
              >
                <option value="">Выберите событие</option>
                {eventOptions.map((eventItem) => (
                  <option key={eventItem.id} value={eventItem.id}>
                    {getMultiLangValue(eventItem.title) || eventItem.id}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Типы билетов (опционально)">
              <select
                multiple
                value={bulkForm.ticket_types}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setBulkForm((prev) => ({ ...prev, ticket_types: selected }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={!bulkForm.event || ticketTypesLoading}
              >
                {!bulkForm.event ? (
                  <option value="" disabled>Сначала выберите событие</option>
                ) : null}
                {ticketTypeOptions.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {getMultiLangValue(tt.name) || tt.name_primary || tt.id}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Мест">
              <TextInput
                type="number"
                min={0}
                value={bulkForm.available_seats ?? 0}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, available_seats: Number(e.target.value || 0) }))}
              />
            </Field>
            <Field label="Закрытие брони (мин)">
              <TextInput
                type="number"
                min={0}
                value={bulkForm.booking_closes_minutes_before ?? 60}
                onChange={(e) =>
                  setBulkForm((prev) => ({ ...prev, booking_closes_minutes_before: Number(e.target.value || 0) }))
                }
              />
            </Field>
            <ActiveCheckboxField
              checked={bulkForm.is_active}
              onChange={(next) => setBulkForm((prev) => ({ ...prev, is_active: next }))}
              text="Активны"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkForm((prev) => ({ ...prev, mode: 'interval' }))}
              className={`px-3 py-2 text-sm rounded-lg border ${bulkForm.mode === 'interval' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
            >
              Интервал
            </button>
            <button
              type="button"
              onClick={() => setBulkForm((prev) => ({ ...prev, mode: 'list' }))}
              className={`px-3 py-2 text-sm rounded-lg border ${bulkForm.mode === 'list' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
            >
              Список дат
            </button>
            <button
              type="button"
              onClick={() => setBulkForm((prev) => ({ ...prev, mode: 'schedule' }))}
              className={`px-3 py-2 text-sm rounded-lg border ${bulkForm.mode === 'schedule' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
            >
              Дни + время
            </button>
          </div>

          {bulkForm.mode === 'interval' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Начало" required>
                <TextInput
                  type="datetime-local"
                  value={bulkForm.start_datetime}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, start_datetime: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Конец" required>
                <TextInput
                  type="datetime-local"
                  value={bulkForm.end_datetime}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, end_datetime: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Шаг (мин)" required>
                <TextInput
                  type="number"
                  min={1}
                  value={bulkForm.step_minutes}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, step_minutes: Number(e.target.value || 0) }))}
                  required
                />
              </Field>
            </div>
          ) : bulkForm.mode === 'schedule' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Дата начала" required>
                  <TextInput
                    type="date"
                    value={bulkForm.schedule_start_date}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, schedule_start_date: e.target.value }))}
                    required
                  />
                </Field>
                <Field label="Дата конца" required>
                  <TextInput
                    type="date"
                    value={bulkForm.schedule_end_date}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, schedule_end_date: e.target.value }))}
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
                        checked={!!bulkForm.schedule_days?.[k]}
                        onChange={(e) =>
                          setBulkForm((prev) => ({
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
                  value={bulkForm.schedule_times_text}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, schedule_times_text: e.target.value }))}
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
                value={bulkForm.datetimes_text}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, datetimes_text: e.target.value }))}
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
                checked={!!bulkForm.also_create_prices}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, also_create_prices: e.target.checked }))}
              />
              Автоматически создать цены для созданных слотов
            </label>

            {bulkForm.also_create_prices ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Цена" required>
                  <TextInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={bulkForm.price_value}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, price_value: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </Field>
                <Field label="Валюта" required>
                  <TextInput
                    value={bulkForm.price_currency}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, price_currency: e.target.value }))}
                    maxLength={3}
                    required
                  />
                </Field>
                <ActiveCheckboxField
                  checked={bulkForm.price_is_active}
                  onChange={(next) => setBulkForm((prev) => ({ ...prev, price_is_active: next }))}
                  text="Цена активна"
                />
              </div>
            ) : null}
          </div>

          {bulkResult ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <div className="font-medium text-gray-800">Результат</div>
              <div className="mt-1">
                Создано: <span className="font-semibold">{bulkResult.created_count ?? 0}</span>, пропущено (уже было):{' '}
                <span className="font-semibold">{bulkResult.skipped_existing ?? 0}</span>
              </div>
              {Array.isArray(bulkResult.errors) && bulkResult.errors.length ? (
                <div className="mt-2 text-xs text-red-700">
                  Ошибки: {bulkResult.errors.length} (первые показаны в ответе API)
                </div>
              ) : null}
            </div>
          ) : null}

          <FormActions
            saving={bulkSaving}
            saveLabel="Создать слоты"
            onCancel={() => setBulkOpen(false)}
          />
        </form>
      </Modal>
    </Layout>
  );
}

