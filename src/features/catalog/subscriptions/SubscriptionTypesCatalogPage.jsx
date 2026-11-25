import { useCallback, useEffect, useState } from 'react';
import { citiesAPI } from '../../../api/generation';
import { listAllStaffEvents } from '../../../api/staffCatalog';
import { subscriptionTypesAPI } from '../../../api/subscription';
import Layout from '../../../components/Layout';
import { Select, Alert, CheckboxField, PageHeader, ConfirmModal, DataTable, Field, FormActions, Modal, StatusBadge, TableRowActions, Textarea, TextInput } from '@aspectum/admin-ui-web';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { getCityLabel, getEventLabel } from './subscriptionLabels';

const PAGE_SIZE = 20;

// Что открывает код этого типа. «Один город на выбор»: человек при активации
// сам выбирает город — из списка ниже, а пустой список значит «любой город».
const ACCESS_MODES = [
  { value: 'fixed', label: 'Набор городов' },
  { value: 'choose_city', label: 'Один город на выбор' },
];

// Срок доступа (access_hours): пусто — навсегда, иначе код открывает города
// на столько часов с момента активации (Антон 24.11, временные коды).
const ACCESS_HOURS_PRESETS = [
  { value: '', label: 'Навсегда' },
  { value: '1', label: '1 час' },
  { value: '2', label: '2 часа' },
  { value: '3', label: '3 часа' },
  { value: '6', label: '6 часов' },
  { value: '12', label: '12 часов' },
  { value: '24', label: '1 день' },
  { value: '48', label: '2 дня' },
  { value: '72', label: '3 дня' },
];
const CUSTOM_HOURS = 'custom';

function normalizeAccessHours(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function accessHoursLabel(value) {
  const hours = normalizeAccessHours(value);
  if (!hours) return 'навсегда';
  const preset = ACCESS_HOURS_PRESETS.find((item) => item.value === String(hours));
  if (preset) return preset.label;
  return hours % 24 === 0 ? `${hours / 24} дн.` : `${hours} ч`;
}

function accessModeLabel(value) {
  return ACCESS_MODES.find((mode) => mode.value === value)?.label || 'Набор городов';
}

function createEmptyType() {
  return {
    id: null,
    name: '',
    description: '',
    access_mode: 'fixed',
    access_hours: '',
    ai_prompts: 0,
    is_active: true,
    cities: [],
    events: [],
  };
}

function normalizeAiPrompts(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function unwrapList(response) {
  const data = response?.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

async function loadEventChoices() {
  try {
    return await listAllStaffEvents();
  } catch {
    return [];
  }
}

export default function SubscriptionTypesCatalogPage() {
  const { setMobileActions } = useLayoutActions();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [cities, setCities] = useState([]);
  const [events, setEvents] = useState([]);
  const [refsLoading, setRefsLoading] = useState(true);

  const loadRefs = useCallback(async () => {
    setRefsLoading(true);
    const [citiesResult, eventsResult] = await Promise.all([
      citiesAPI.list({ page_size: 1000, limit: 1000 }).then(unwrapList).catch(() => []),
      loadEventChoices(),
    ]);
    setCities(citiesResult);
    setEvents(eventsResult);
    setRefsLoading(false);
  }, []);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  const loadItems = useCallback(async (paramsState) => {
    const state = paramsState || { search, statusFilter, page };

    try {
      setLoading(true);
      setError(null);

      const params = {
        search: state.search || undefined,
        is_active: state.statusFilter === 'active' ? 'true' : state.statusFilter === 'inactive' ? 'false' : undefined,
        page: state.page,
        page_size: PAGE_SIZE,
        ordering: 'name',
      };

      const response = await subscriptionTypesAPI.list(params);
      const data = response?.data;
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(list);
      setTotalCount(data?.count ?? list.length);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки типов подписки'));
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadItems({ search, statusFilter, page: 1 });
    }, 350);
    return () => clearTimeout(timer);
  }, [search, statusFilter, loadItems]);

  useEffect(() => {
    const actions = [
      {
        id: 'create-subscription-type',
        label: editingItem ? 'Новый тип' : 'Создать тип подписки',
        onClick: () => {
          setSaveError(null);
          setEditingItem(createEmptyType());
        },
        variant: editingItem ? 'secondary' : 'primary',
      },
    ];

    if (editingItem) {
      actions.push({
        id: 'close-subscription-type-editor',
        label: 'Закрыть форму',
        onClick: () => setEditingItem(null),
        variant: 'secondary',
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [editingItem, setMobileActions]);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingItem) return;

    const payload = {
      name: editingItem.name,
      description: editingItem.description || '',
      access_mode: editingItem.access_mode || 'fixed',
      access_hours: normalizeAccessHours(editingItem.access_hours),
      ai_prompts: normalizeAiPrompts(editingItem.ai_prompts),
      is_active: !!editingItem.is_active,
      cities: normalizeIdList(editingItem.cities),
      events: normalizeIdList(editingItem.events),
    };

    try {
      setSaving(true);
      setSaveError(null);
      if (editingItem.id) {
        await subscriptionTypesAPI.update(editingItem.id, payload);
      } else {
        await subscriptionTypesAPI.create(payload);
      }
      setEditingItem(null);
      await loadItems();
    } catch (err) {
      setSaveError(parseApiError(err, editingItem.id ? 'Ошибка сохранения типа подписки' : 'Ошибка создания типа подписки'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleteError(null);
    try {
      setDeleting(true);
      await subscriptionTypesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadItems();
    } catch (err) {
      setDeleteError(parseApiError(err, 'Ошибка удаления типа подписки'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Название',
      render: (value) => <span className="text-sm font-medium text-aspectum-text">{value || '—'}</span>,
    },
    {
      key: 'description',
      label: 'Описание',
      render: (value) => <span className="text-sm text-aspectum-text-strong">{value || '—'}</span>,
    },
    {
      key: 'access_mode',
      label: 'Что открывает',
      render: (value) => <span className="text-sm text-gray-700">{accessModeLabel(value)}</span>,
    },
    {
      key: 'access_hours',
      label: 'Срок доступа',
      render: (value) => <span className="text-sm text-aspectum-text-strong">{accessHoursLabel(value)}</span>,
    },
    {
      key: 'cities',
      label: 'Города',
      render: (value, row) => {
        const count = Array.isArray(value) ? value.length : 0;
        if (row.access_mode === 'choose_city') {
          return <span className="text-sm text-aspectum-text-strong">{count ? `выбор из ${count}` : 'любой'}</span>;
        }
        return <span className="text-sm text-aspectum-text-strong">{count}</span>;
      },
    },
    {
      key: 'events',
      label: 'События',
      render: (value) => <span className="text-sm text-aspectum-text-strong">{Array.isArray(value) ? value.length : 0}</span>,
    },
    {
      key: 'ai_prompts',
      label: 'Запросов ИИ',
      render: (value) => <span className="text-sm text-aspectum-text-strong">{value > 0 ? value : 'только гид'}</span>,
    },
    {
      key: 'is_active',
      label: 'Статус',
      render: (active) => <StatusBadge active={active} />,
    },
  ];

  return (
    <Layout>
      <PageHeader
        title="Справочник типов подписки"
        description="Типы подписок: название, города, события, срок доступа, запросы ИИ, статус"
        createLabel="Создать тип подписки"
        onCreate={() => {
          setSaveError(null);
          setEditingItem(createEmptyType());
        }}
      />

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        error={error}
        emptyIcon="🧩"
        isFiltered={!!(search || statusFilter)}
        emptyText="Типов подписки пока нет"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по названию или описанию..."
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={(
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Любой статус</option>
            <option value="active">Активные</option>
            <option value="inactive">Отключенные</option>
          </Select>
        )}
        actions={(row) => (
          <TableRowActions
            onEdit={() => {
              setSaveError(null);
              setEditingItem({
                id: row.id,
                name: row.name || '',
                description: row.description || '',
                access_mode: row.access_mode || 'fixed',
                access_hours: row.access_hours ? String(row.access_hours) : '',
                ai_prompts: normalizeAiPrompts(row.ai_prompts),
                is_active: row.is_active !== false,
                cities: normalizeIdList(row.cities),
                events: normalizeIdList(row.events),
              });
            }}
            onDelete={() => setDeleteTarget(row)}
          />
        )}
      />

      <Modal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        title={editingItem?.id ? 'Редактировать тип подписки' : 'Создать тип подписки'}
        size="lg"
      >
        {editingItem && (
          <form onSubmit={handleSave} className="space-y-4">
            <Alert tone="error">{saveError}</Alert>

            <Field label="Название" required>
              <TextInput
                value={editingItem.name}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, name: e.target.value }))}
                maxLength={100}
                required
              />
            </Field>

            <Field label="Описание">
              <Textarea
                rows={3}
                value={editingItem.description || ''}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, description: e.target.value }))}
              />
            </Field>

            <Field
              label="Что открывает код"
              hint={editingItem.access_mode === 'choose_city'
                ? 'При активации человек сам выбирает один город. Ниже можно ограничить список городов; пустой список — любой опубликованный город.'
                : 'Код сразу открывает все города из списка ниже.'}
            >
              <Select
                value={editingItem.access_mode || 'fixed'}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, access_mode: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {ACCESS_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>{mode.label}</option>
                ))}
              </Select>
            </Field>

            <Field
              label="Срок доступа"
              hint="На сколько код открывает аудиогиды — с момента активации. «Навсегда» — как обычный код. После срока город снова закрыт, его можно купить или открыть новым кодом."
            >
              <Select
                value={
                  ACCESS_HOURS_PRESETS.some((item) => item.value === String(editingItem.access_hours ?? ''))
                    ? String(editingItem.access_hours ?? '')
                    : CUSTOM_HOURS
                }
                onChange={(e) => {
                  const next = e.target.value;
                  setEditingItem((prev) => ({
                    ...prev,
                    access_hours: next === CUSTOM_HOURS ? '4' : next,
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {ACCESS_HOURS_PRESETS.map((item) => (
                  <option key={item.value || 'forever'} value={item.value}>{item.label}</option>
                ))}
                <option value={CUSTOM_HOURS}>Другой срок…</option>
              </Select>
              {!ACCESS_HOURS_PRESETS.some((item) => item.value === String(editingItem.access_hours ?? '')) ? (
                <TextInput
                  type="number"
                  min={1}
                  step={1}
                  className="mt-2"
                  placeholder="Часов"
                  value={editingItem.access_hours ?? ''}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, access_hours: e.target.value }))}
                />
              ) : null}
            </Field>

            <Field label="Запросов ИИ" hint="Сколько запросов ИИ получает пользователь при активации кода. 0 — код открывает только диджитал-гид">
              <TextInput
                type="number"
                min={0}
                step={1}
                value={editingItem.ai_prompts ?? 0}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, ai_prompts: e.target.value }))}
              />
            </Field>

            <CheckboxField
              checked={editingItem.is_active}
              onChange={(next) => setEditingItem((prev) => ({ ...prev, is_active: next }))}
              text="Активный тип подписки"
            />

            <Field
              label={editingItem.access_mode === 'choose_city' ? 'Из каких городов выбирать' : 'Города'}
              hint={editingItem.access_mode === 'choose_city'
                ? 'Пусто — любой опубликованный город. Ctrl/Cmd + click для множественного выбора'
                : 'Ctrl/Cmd + click для множественного выбора'}
            >
              <Select
                multiple
                size={8}
                disabled={refsLoading}
                value={normalizeIdList(editingItem.cities)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setEditingItem((prev) => ({ ...prev, cities: selected }));
                }}
                className="min-h-0 text-sm"
              >
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{getCityLabel(city)}</option>
                ))}
              </Select>
            </Field>

            <Field label="События" hint="Ctrl/Cmd + click для множественного выбора">
              <Select
                multiple
                size={8}
                disabled={refsLoading}
                value={normalizeIdList(editingItem.events)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setEditingItem((prev) => ({ ...prev, events: selected }));
                }}
                className="min-h-0 text-sm"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{getEventLabel(event)}</option>
                ))}
              </Select>
            </Field>

            <FormActions
              saving={saving}
              saveLabel={editingItem.id ? 'Сохранить' : 'Создать'}
              onCancel={() => setEditingItem(null)}
            />
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
        onConfirm={handleDelete}
        title="Удалить тип подписки?"
        message={deleteError || `Тип «${deleteTarget?.name || deleteTarget?.id || ''}» будет удален без возможности восстановления. Тип с кодами удалить нельзя — его можно выключить. Открытые людьми города при удалении сохраняются.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </Layout>
  );
}
