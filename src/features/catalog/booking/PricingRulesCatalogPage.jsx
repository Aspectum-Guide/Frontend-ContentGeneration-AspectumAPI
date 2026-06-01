import { useCallback, useEffect, useState } from 'react';
import { pricingRulesAPI } from '../../../api/booking';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { Field, FormActions, TextInput } from '../../../components/ui/FormField';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { useEventOptions, useTicketTypeOptions } from '../shared/bookingOptions';
import ActiveCheckboxField from '../shared/components/ActiveCheckboxField';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import StatusBadge from '../shared/components/StatusBadge';
import TableRowActions from '../shared/components/TableRowActions';
import { getMultiLangValue } from '../shared/i18n';
import { normalizeListResponse } from '../shared/normalize';

const PAGE_SIZE = 20;

const WEEKDAYS = [
  { bit: 0, label: 'Пн' },
  { bit: 1, label: 'Вт' },
  { bit: 2, label: 'Ср' },
  { bit: 3, label: 'Чт' },
  { bit: 4, label: 'Пт' },
  { bit: 5, label: 'Сб' },
  { bit: 6, label: 'Вс' },
];

function maskToLabels(mask) {
  if (mask == null) return 'Любой день';
  return WEEKDAYS.filter((d) => mask & (1 << d.bit)).map((d) => d.label).join(', ') || '—';
}

function createEmpty() {
  return {
    id: null, event: '', ticket_type: '',
    price: '', currency: 'EUR', priority: 0, is_active: true,
    weekdays_mask: null,
    specific_date: '', date_from: '', date_to: '',
    time_from: '', time_to: '',
  };
}

export default function PricingRulesCatalogPage() {
  const { setMobileActions } = useLayoutActions();
  const { page, setPage } = useCatalogFilters();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [eventFilter, setEventFilter] = useState('');
  const { eventOptions, eventsLoading } = useEventOptions();

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { ticketTypeOptions: editingTTOptions, ticketTypesLoading: editingTTLoading } =
    useTicketTypeOptions(editing?.event || '');

  const load = useCallback(async (p = page) => {
    setLoading(true);
    setListError(null);
    try {
      const r = await pricingRulesAPI.list({
        page: p, page_size: PAGE_SIZE,
        ...(eventFilter ? { event: eventFilter } : {}),
        ordering: 'event,-priority',
      });
      const data = r?.data;
      setRows(normalizeListResponse(data, ['results', 'data']));
      setTotal(data?.count ?? data?.total ?? 0);
    } catch (e) {
      setListError(parseApiError(e, 'Ошибка загрузки правил'));
    } finally {
      setLoading(false);
    }
  }, [page, eventFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [eventFilter, setPage]);

  useEffect(() => {
    const actions = editing
      ? [{ id: 'close', label: 'Закрыть', onClick: () => setEditing(null), variant: 'secondary' }]
      : [{ id: 'create', label: 'Создать правило', onClick: () => { setSaveError(null); setEditing(createEmpty()); }, variant: 'primary' }];
    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [editing, setMobileActions]);

  const eventLabel = (id) => {
    const ev = eventOptions.find((e) => String(e.id) === String(id));
    return ev ? getMultiLangValue(ev.title) || String(id) : String(id);
  };

  const toggleWeekday = (bit) => {
    setEditing((p) => {
      const cur = p.weekdays_mask ?? 0;
      return { ...p, weekdays_mask: cur ^ (1 << bit) };
    });
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editing) return;
    const payload = {
      event: editing.event || null,
      ticket_type: editing.ticket_type || null,
      price: Number(editing.price) || 0,
      currency: (editing.currency || 'EUR').toUpperCase(),
      priority: Number(editing.priority) || 0,
      is_active: !!editing.is_active,
      weekdays_mask: editing.weekdays_mask,
      specific_date: editing.specific_date || null,
      date_from: editing.date_from || null,
      date_to: editing.date_to || null,
      time_from: editing.time_from || null,
      time_to: editing.time_to || null,
    };
    try {
      setSaving(true); setSaveError(null);
      editing.id
        ? await pricingRulesAPI.update(editing.id, payload)
        : await pricingRulesAPI.create(payload);
      setEditing(null);
      await load(page);
    } catch (err) {
      setSaveError(parseApiError(err, 'Ошибка сохранения'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      setDeleting(true);
      await pricingRulesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await load(page);
    } catch (err) {
      setListError(parseApiError(err, 'Ошибка удаления'));
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (row) => {
    setSaveError(null);
    setEditing({
      id: row.id,
      event: String(row.event || ''),
      ticket_type: String(row.ticket_type || ''),
      price: String(row.price ?? ''),
      currency: row.currency || 'EUR',
      priority: row.priority ?? 0,
      is_active: row.is_active !== false,
      weekdays_mask: row.weekdays_mask ?? null,
      specific_date: row.specific_date || '',
      date_from: row.date_from || '',
      date_to: row.date_to || '',
      time_from: row.time_from || '',
      time_to: row.time_to || '',
    });
  };

  const columns = [
    {
      key: 'event', label: 'Событие',
      render: (v) => <span className="text-sm text-gray-700">{eventLabel(v)}</span>,
    },
    {
      key: 'price', label: 'Цена',
      render: (v, row) => (
        <span className="font-medium text-gray-900">{v} <span className="text-xs text-gray-400">{row.currency}</span></span>
      ),
    },
    {
      key: 'weekdays_mask', label: 'Дни',
      render: (v) => <span className="text-xs text-gray-600">{maskToLabels(v)}</span>,
    },
    {
      key: 'priority', label: 'Приоритет',
      render: (v) => <span className="text-sm text-gray-600">{v ?? 0}</span>,
    },
    {
      key: 'is_active', label: 'Статус',
      render: (v) => <StatusBadge active={v} />,
    },
  ];

  return (
    <Layout>
      <CatalogPageHeader
        title="Правила ценообразования"
        description="Цены по условиям: дни недели, даты, время. Приоритет — выше число → правило главнее."
        createLabel="Создать правило"
        onCreate={() => { setSaveError(null); setEditing(createEmpty()); }}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={listError}
        emptyIcon="📋"
        isFiltered={!!eventFilter}
        emptyText="Правил пока нет"
        page={page}
        totalCount={total}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={(
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className={`px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${eventsLoading ? 'opacity-60 cursor-wait' : ''}`}
            disabled={eventsLoading}
          >
            <option value="">{eventsLoading ? 'Загрузка…' : 'Все события'}</option>
            {eventOptions.map((ev) => (
              <option key={ev.id} value={ev.id}>{getMultiLangValue(ev.title) || ev.id}</option>
            ))}
          </select>
        )}
        actions={(row) => (
          <TableRowActions onEdit={() => openEdit(row)} onDelete={() => setDeleteTarget(row)} />
        )}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Редактировать правило' : 'Создать правило'}
        size="lg"
      >
        {editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <FormErrorAlert message={saveError} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Событие" required>
                <select
                  value={editing.event}
                  onChange={(e) => setEditing((p) => ({ ...p, event: e.target.value, ticket_type: '' }))}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${eventsLoading ? 'opacity-60 cursor-wait' : ''}`}
                  required disabled={eventsLoading}
                >
                  <option value="">{eventsLoading ? 'Загрузка…' : 'Выберите событие'}</option>
                  {eventOptions.map((ev) => (
                    <option key={ev.id} value={ev.id}>{getMultiLangValue(ev.title) || ev.id}</option>
                  ))}
                </select>
              </Field>

              <Field label="Тип билета" required>
                <select
                  value={editing.ticket_type}
                  onChange={(e) => setEditing((p) => ({ ...p, ticket_type: e.target.value }))}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${editingTTLoading ? 'opacity-60 cursor-wait' : ''}`}
                  required disabled={!editing.event || editingTTLoading}
                >
                  <option value="">{editingTTLoading ? 'Загрузка…' : editing.event ? 'Выберите тип' : 'Сначала выберите событие'}</option>
                  {editingTTOptions.map((tt) => (
                    <option key={tt.id} value={tt.id}>{getMultiLangValue(tt.name) || tt.code || tt.id}</option>
                  ))}
                </select>
              </Field>

              <Field label="Цена" required>
                <TextInput
                  type="number" step="0.01" min={0}
                  value={editing.price}
                  onChange={(e) => setEditing((p) => ({ ...p, price: e.target.value }))}
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Валюта">
                  <TextInput
                    value={editing.currency}
                    onChange={(e) => setEditing((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
                    maxLength={3} placeholder="EUR"
                  />
                </Field>
                <Field label="Приоритет" hint="Больше = важнее">
                  <TextInput
                    type="number"
                    value={editing.priority}
                    onChange={(e) => setEditing((p) => ({ ...p, priority: Number(e.target.value) || 0 }))}
                  />
                </Field>
              </div>
            </div>

            {/* Дни недели */}
            <Field label="Дни недели" hint="Пусто = любой день">
              <div className="flex gap-1 flex-wrap">
                {WEEKDAYS.map((d) => {
                  const active = editing.weekdays_mask != null && !!(editing.weekdays_mask & (1 << d.bit));
                  return (
                    <button
                      key={d.bit}
                      type="button"
                      onClick={() => toggleWeekday(d.bit)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {d.label}
                    </button>
                  );
                })}
                {editing.weekdays_mask != null && (
                  <button
                    type="button"
                    onClick={() => setEditing((p) => ({ ...p, weekdays_mask: null }))}
                    className="px-2.5 py-1 rounded-md text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    сбросить
                  </button>
                )}
              </div>
            </Field>

            {/* Даты */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Конкретная дата">
                <TextInput
                  type="date"
                  value={editing.specific_date}
                  onChange={(e) => setEditing((p) => ({ ...p, specific_date: e.target.value, date_from: '', date_to: '' }))}
                />
              </Field>
              <Field label="Дата от">
                <TextInput
                  type="date"
                  value={editing.date_from}
                  onChange={(e) => setEditing((p) => ({ ...p, date_from: e.target.value, specific_date: '' }))}
                />
              </Field>
              <Field label="Дата до">
                <TextInput
                  type="date"
                  value={editing.date_to}
                  onChange={(e) => setEditing((p) => ({ ...p, date_to: e.target.value, specific_date: '' }))}
                />
              </Field>
            </div>

            {/* Время */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Время от">
                <TextInput
                  type="time"
                  value={editing.time_from}
                  onChange={(e) => setEditing((p) => ({ ...p, time_from: e.target.value }))}
                />
              </Field>
              <Field label="Время до">
                <TextInput
                  type="time"
                  value={editing.time_to}
                  onChange={(e) => setEditing((p) => ({ ...p, time_to: e.target.value }))}
                />
              </Field>
            </div>

            <ActiveCheckboxField
              checked={editing.is_active}
              onChange={(v) => setEditing((p) => ({ ...p, is_active: v }))}
            />

            <FormActions saving={saving} onCancel={() => setEditing(null)} saveLabel={editing.id ? 'Сохранить' : 'Создать'} />
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить правило?"
        message="Правило ценообразования будет удалено."
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </Layout>
  );
}
