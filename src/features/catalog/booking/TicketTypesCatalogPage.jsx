import { useCallback, useEffect, useMemo, useState } from 'react';
import { ticketTypesAPI } from '../../../api/booking';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { Field, FormActions, TextInput } from '../../../components/ui/FormField';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { useEventOptions } from '../shared/bookingOptions';
import ActiveCheckboxField from '../shared/components/ActiveCheckboxField';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import StatusBadge from '../shared/components/StatusBadge';
import TableRowActions from '../shared/components/TableRowActions';
import { buildLangOptions, getMultiLangValue, pickPrimaryLangCode } from '../shared/i18n';
import { LangBlock, LangTabs } from '../shared/LangFields';

const PAGE_SIZE = 20;

function createEmptyTicketType() {
  return {
    id: null,
    event: '',
    name: {},
    name_primary: '',
    description: {},
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
  const [activeLang, setActiveLang] = useState('');
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
    setActiveLang(pickPrimaryLangCode([row?.name]));
    setEditingType({
      id: row.id,
      event: row.event || '',
      name: typeof row.name === 'object' && row.name ? row.name : (row.name ? { ru: String(row.name) } : {}),
      name_primary: row.name_primary || '',
      description: typeof row.description === 'object' && row.description ? row.description : (row.description ? { ru: String(row.description) } : {}),
      sort_order: Number.isFinite(row.sort_order) ? row.sort_order : 0,
      is_active: row.is_active !== false,
    });
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingType) return;

    const payload = {
      event: editingType.event,
      name: editingType.name || {},
      description: editingType.description || {},
      name_primary: (editingType.name_primary || '').trim(),
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
          <div className="text-sm font-medium text-gray-900">
            {getMultiLangValue(row?.name) || row?.name_primary || value || '—'}
          </div>
          {row.description ? (
            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
              {getMultiLangValue(row.description) || (typeof row.description === 'string' ? row.description : '')}
            </div>
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
      render: (active) => <StatusBadge active={active} />,
    },
  ];

  return (
    <Layout>
      <CatalogPageHeader
        title="Справочник типов билетов"
        description="Управление типами билетов для событий"
        createLabel="Создать тип билета"
        onCreate={() => {
          setSaveError(null);
          setActiveLang('');
          setEditingType(createEmptyTicketType());
        }}
      />

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
              <option value="name_primary">Сортировка: название А-Я</option>
              <option value="-name_primary">Сортировка: название Я-А</option>
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
        open={!!editingType}
        onClose={() => setEditingType(null)}
        title={editingType?.id
          ? `Редактировать тип билета: ${getMultiLangValue(editingType.name) || editingType.name_primary || ''}`
          : 'Создать тип билета'}
        size="lg"
      >
        {editingType && (
          <form onSubmit={handleSave} className="space-y-4">
            <FormErrorAlert message={saveError} />

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

              <Field
                label="Ключ (name_primary)"
                hint="Используется для сортировки/поиска/фильтрации. Если оставить пустым — будет взят из переводов."
              >
                <TextInput
                  value={editingType.name_primary || ''}
                  onChange={(e) => setEditingType((prev) => ({ ...prev, name_primary: e.target.value }))}
                  placeholder="Например: adult / child / vip"
                />
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

            {(() => {
              const nameVal = typeof editingType?.name === 'object' ? editingType.name : {};
              const descVal = typeof editingType?.description === 'object' ? editingType.description : {};
              const langOptions = buildLangOptions([nameVal, descVal], ['ru', 'en', 'it']);
              return (
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Переводы</p>
                    <LangTabs
                      active={activeLang}
                      onSwitch={setActiveLang}
                      value={nameVal}
                      langOptions={langOptions}
                      onAddLang={(code) => {
                        setEditingType((p) => ({
                          ...p,
                          name: { ...(p?.name || {}), [code]: p?.name?.[code] ?? '' },
                          description: { ...(p?.description || {}), [code]: p?.description?.[code] ?? '' },
                        }));
                      }}
                      onRemoveLang={(code) => {
                        setEditingType((p) => {
                          const nextName = { ...(p?.name || {}) };
                          const nextDesc = { ...(p?.description || {}) };
                          delete nextName[code];
                          delete nextDesc[code];
                          return { ...p, name: nextName, description: nextDesc };
                        });
                      }}
                    />
                  </div>
                  <LangBlock
                    label="Название"
                    value={nameVal}
                    onChange={(v) => setEditingType((prev) => ({ ...prev, name: v }))}
                    activeLang={activeLang}
                    required
                  />
                  <LangBlock
                    label="Описание"
                    value={descVal}
                    onChange={(v) => setEditingType((prev) => ({ ...prev, description: v }))}
                    activeLang={activeLang}
                    multiline
                    rows={3}
                  />
                </div>
              );
            })()}

            <ActiveCheckboxField
              checked={editingType.is_active}
              onChange={(next) => setEditingType((prev) => ({ ...prev, is_active: next }))}
              text="Активный тип билета"
            />

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
        message={`Тип «${getMultiLangValue(deleteTarget?.name) || deleteTarget?.name_primary || deleteTarget?.id || ''}» будет удален без возможности восстановления.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </Layout>
  );
}
