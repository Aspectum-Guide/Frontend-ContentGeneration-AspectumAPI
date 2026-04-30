import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eventSlotAvailabilitiesAPI, ticketTypesAPI } from '../../../api/booking';
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
  }, [avail, eventFilter, ticketTypeFilter]);

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
    </Layout>
  );
}

