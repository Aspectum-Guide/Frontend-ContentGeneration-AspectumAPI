import { useCallback, useEffect, useState } from 'react';
import { bookingReservationsAPI, eventSlotAvailabilitiesAPI } from '../../../api/booking';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { Field } from '../../../components/ui/FormField';
import Modal from '../../../components/ui/Modal';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { useCatalogPagedReload } from '../core/useCatalogPagedReload';
import { useCatalogResource } from '../core/useCatalogResource';
import { useEventOptions, useTicketTypeMap, useTicketTypeOptions } from '../shared/bookingOptions';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import EventSelect from '../shared/components/EventSelect';
import TicketTypeSelect from '../shared/components/TicketTypeSelect';
import { formatMoney } from '../shared/currencies';
import { getEventLabelById } from '../shared/labels';
import { normalizeListResponse } from '../shared/normalize';

const PAGE_SIZE = 20;

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function stringifyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? '');
  }
}

export default function BookingReservationsCatalogPage() {
  const { setMobileActions } = useLayoutActions();
  const { page, setPage, search, setSearch, debouncedSearch } = useCatalogFilters();

  const reservations = useCatalogResource({
    listRequest: bookingReservationsAPI.list,
    listKeys: ['results'],
    defaultErrorMessage: 'Ошибка загрузки резервов',
  });

  const { eventOptions, eventsLoading } = useEventOptions();
  const [eventFilter, setEventFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ticketTypeFilter, setTicketTypeFilter] = useState('');

  const { ticketTypeOptions, ticketTypesLoading } = useTicketTypeOptions(eventFilter);

  const [slotOptions, setSlotOptions] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotFilter, setSlotFilter] = useState('');

  const [detail, setDetail] = useState(null);

  const ticketTypeLabelById = useTicketTypeMap(ticketTypeOptions);

  const loadSlots = useCallback(async (eventId) => {
    const normalizedEventId = eventId || '';
    if (!normalizedEventId) {
      setSlotOptions([]);
      return;
    }
    try {
      setSlotsLoading(true);
      const response = await eventSlotAvailabilitiesAPI.list({
        event: normalizedEventId,
        page_size: 500,
        ordering: 'slot_datetime',
      });
      const data = response?.data;
      const list = normalizeListResponse(data, ['results', 'data']);
      setSlotOptions(list.map((s) => ({
        id: String(s.id),
        label: s.slot_datetime ? new Date(s.slot_datetime).toLocaleString() : String(s.id),
      })));
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlots(eventFilter);
  }, [eventFilter, loadSlots]);

  // NOTE: avoid importing slot API here to keep this page lightweight; we can show slot id if not loaded.
  useEffect(() => {
    // reset dependent filters when event changes
    setTicketTypeFilter('');
    setSlotFilter('');
    setSlotOptions([]);
  }, [eventFilter]);

  const reload = useCallback(async (pageNum) => {
    await reservations.load(
      {
        page: pageNum,
        page_size: PAGE_SIZE,
        ordering: '-created_at',
        event: eventFilter || undefined,
        status: statusFilter || undefined,
        ticket_type: ticketTypeFilter || undefined,
        slot: slotFilter || undefined,
        search: debouncedSearch || undefined,
      },
      (err) => parseApiError(err, 'Ошибка загрузки резервов')
    );
  }, [reservations.load, eventFilter, statusFilter, ticketTypeFilter, slotFilter, debouncedSearch]);

  useCatalogPagedReload({
    page,
    setPage,
    reload,
    filterSignature: `${eventFilter}|${statusFilter}|${ticketTypeFilter}|${slotFilter}|${debouncedSearch}`,
  });

  useEffect(() => {
    setMobileActions([]);
    return () => setMobileActions([]);
  }, [setMobileActions]);

  const STATUS_STYLE = {
    reserved:  'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
    expired:   'bg-gray-100 text-gray-500',
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Создан',
      render: (v) => <span className="text-sm text-gray-700">{formatDate(v)}</span>,
    },
    {
      key: 'status',
      label: 'Статус',
      render: (v) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[v] || 'bg-gray-100 text-gray-500'}`}>
          {v || '—'}
        </span>
      ),
    },
    {
      key: 'event',
      label: 'Событие',
      render: (id) => <span className="text-sm text-gray-700">{getEventLabelById(eventOptions, id) || id || '—'}</span>,
    },
    {
      key: 'ticket_type',
      label: 'Тип',
      render: (id) => (
        <span className="text-sm text-gray-700">
          {id ? (ticketTypeLabelById.get(String(id))?.title || String(id)) : '—'}
        </span>
      ),
    },
    {
      key: 'qty',
      label: 'Кол-во',
      render: (v) => <span className="text-sm text-gray-700">{Number.isFinite(v) ? v : Number(v || 0)}</span>,
    },
    {
      key: 'total_price',
      label: 'Сумма',
      render: (v, row) => (
        <span className="text-sm font-medium text-gray-900">
          {v != null ? formatMoney(Number(v).toFixed(2), row.currency) : '—'}
        </span>
      ),
    },
    {
      key: 'guest_email',
      label: 'Гость',
      render: (v) => <span className="text-xs text-gray-500 font-mono">{v || '—'}</span>,
    },
  ];

  return (
    <Layout>
      <CatalogPageHeader
        title="Резервы (люди)"
        description="История резервов: user/guest, слот, типы и клиенты"
      />

      <DataTable
        columns={columns}
        rows={reservations.items}
        loading={reservations.loading}
        error={reservations.error}
        isFiltered={!!(eventFilter || statusFilter || ticketTypeFilter || slotFilter || debouncedSearch)}
        emptyIcon="🧾"
        emptyText="Резервов пока нет"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск (локально/по списку)..."
        page={page}
        totalCount={reservations.total}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        onRowClick={(row) => setDetail(row)}
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

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Любой статус</option>
              <option value="reserved">reserved</option>
              <option value="cancelled">cancelled</option>
              <option value="expired">expired</option>
            </select>

            <TicketTypeSelect
              value={ticketTypeFilter}
              onChange={setTicketTypeFilter}
              options={ticketTypeOptions}
              disabled={!eventFilter || ticketTypesLoading}
              placeholder={eventFilter ? 'Все типы' : 'Сначала выберите событие'}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <select
              value={slotFilter}
              onChange={(e) => setSlotFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={!eventFilter || slotsLoading || !slotOptions.length}
            >
              <option value="">{eventFilter ? 'Все слоты' : 'Сначала выберите событие'}</option>
              {slotOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label || s.id}
                </option>
              ))}
            </select>
          </>
        )}
      />

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.id ? `Резерв ${String(detail.id).slice(0, 8)}` : 'Резерв'}
        size="lg"
      >
        {detail ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Создан">
                <div className="text-sm text-gray-700">{formatDate(detail.created_at)}</div>
              </Field>
              <Field label="Статус">
                <div className="text-sm text-gray-700">{detail.status || '—'}</div>
              </Field>
              <Field label="Событие">
                <div className="text-sm text-gray-700">{getEventLabelById(eventOptions, detail.event) || detail.event || '—'}</div>
              </Field>
              <Field label="Слот">
                <div className="text-sm text-gray-700 font-mono">{detail.slot || '—'}</div>
              </Field>
              <Field label="Тип (single)">
                <div className="text-sm text-gray-700">{detail.ticket_type ? (ticketTypeLabelById.get(String(detail.ticket_type))?.title || detail.ticket_type) : '—'}</div>
              </Field>
              <Field label="Кол-во">
                <div className="text-sm text-gray-700">{detail.qty ?? '—'}</div>
              </Field>
              <Field label="Гость email">
                <div className="text-sm text-gray-700">{detail.guest_email || '—'}</div>
              </Field>
              <Field label="User">
                <div className="text-sm text-gray-700 font-mono">{detail.user || '—'}</div>
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Items (JSON)">
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-64">{stringifyJson(detail.items)}</pre>
              </Field>
              <Field label="Clients (JSON)">
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-64">{stringifyJson(detail.clients)}</pre>
              </Field>
            </div>
          </div>
        ) : null}
      </Modal>
    </Layout>
  );
}

