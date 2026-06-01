import { useCallback, useEffect, useState } from 'react';
import { eventTicketTypePricesAPI } from '../../../api/booking';
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

function createEmpty() {
  return { id: null, event: '', ticket_type: '', base_price: '', currency: 'EUR', is_active: true };
}

export default function BasePricesCatalogPage() {
  const { setMobileActions } = useLayoutActions();
  const { page, setPage } = useCatalogFilters();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [eventFilter, setEventFilter] = useState('');
  const { eventOptions, eventsLoading } = useEventOptions();
  const { ticketTypeOptions, ticketTypesLoading } = useTicketTypeOptions(eventFilter);
  const { ticketTypeOptions: formTTOptions, ticketTypesLoading: formTTLoading } = useTicketTypeOptions('');

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
      const r = await eventTicketTypePricesAPI.list({
        page: p, page_size: PAGE_SIZE,
        ...(eventFilter ? { event: eventFilter } : {}),
        ordering: 'event,ticket_type',
      });
      const data = r?.data;
      setRows(normalizeListResponse(data, ['results', 'data']));
      setTotal(data?.count ?? data?.total ?? 0);
    } catch (e) {
      setListError(parseApiError(e, 'Ошибка загрузки базовых цен'));
    } finally {
      setLoading(false);
    }
  }, [page, eventFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [eventFilter, setPage]);

  useEffect(() => {
    const actions = editing ? [
      { id: 'close', label: 'Закрыть', onClick: () => setEditing(null), variant: 'secondary' },
    ] : [
      { id: 'create', label: 'Создать базовую цену', onClick: () => { setSaveError(null); setEditing(createEmpty()); }, variant: 'primary' },
    ];
    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [editing, setMobileActions]);

  const eventLabel = (id) => {
    const ev = eventOptions.find((e) => String(e.id) === String(id));
    return ev ? getMultiLangValue(ev.title) || String(id) : String(id);
  };
  const ttLabel = (id) => {
    for (const tt of [...ticketTypeOptions, ...editingTTOptions]) {
      if (String(tt.id) === String(id)) return getMultiLangValue(tt.name) || tt.code || String(id);
    }
    return String(id);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editing) return;
    const payload = {
      event: editing.event || null,
      ticket_type: editing.ticket_type || null,
      base_price: Number(editing.base_price) || 0,
      currency: (editing.currency || 'EUR').toUpperCase(),
      is_active: !!editing.is_active,
    };
    try {
      setSaving(true); setSaveError(null);
      editing.id
        ? await eventTicketTypePricesAPI.update(editing.id, payload)
        : await eventTicketTypePricesAPI.create(payload);
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
      await eventTicketTypePricesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await load(page);
    } catch (err) {
      setListError(parseApiError(err, 'Ошибка удаления'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'event', label: 'Событие',
      render: (v) => <span className="text-sm text-gray-700">{eventLabel(v)}</span>,
    },
    {
      key: 'ticket_type', label: 'Тип билета',
      render: (v) => <span className="text-sm text-gray-700">{ttLabel(v)}</span>,
    },
    {
      key: 'base_price', label: 'Базовая цена',
      render: (v, row) => (
        <span className="font-medium text-gray-900">{v} <span className="text-xs text-gray-400">{row.currency}</span></span>
      ),
    },
    {
      key: 'is_active', label: 'Статус',
      render: (v) => <StatusBadge active={v} />,
    },
  ];

  return (
    <Layout>
      <CatalogPageHeader
        title="Базовые цены"
        description="Цена по умолчанию для пары событие + тип билета (используется ценовым движком как fallback)"
        createLabel="Создать базовую цену"
        onCreate={() => { setSaveError(null); setEditing(createEmpty()); }}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={listError}
        emptyIcon="💰"
        isFiltered={!!eventFilter}
        emptyText="Базовых цен пока нет"
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
          <TableRowActions
            onEdit={() => { setSaveError(null); setEditing({ id: row.id, event: String(row.event), ticket_type: String(row.ticket_type), base_price: String(row.base_price), currency: row.currency || 'EUR', is_active: row.is_active !== false }); }}
            onDelete={() => setDeleteTarget(row)}
          />
        )}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Редактировать базовую цену' : 'Создать базовую цену'}
        size="md"
      >
        {editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <FormErrorAlert message={saveError} />

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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Базовая цена" required>
                <TextInput
                  type="number" step="0.01" min={0}
                  value={editing.base_price}
                  onChange={(e) => setEditing((p) => ({ ...p, base_price: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Валюта">
                <TextInput
                  value={editing.currency}
                  onChange={(e) => setEditing((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
                  maxLength={3}
                  placeholder="EUR"
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
        title="Удалить базовую цену?"
        message="Ценовой движок перестанет использовать этот fallback для данной пары событие+тип."
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </Layout>
  );
}
