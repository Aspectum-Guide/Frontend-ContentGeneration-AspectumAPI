import { useCallback, useEffect, useState } from 'react';
import { activationCodesAPI, subscriptionTypesAPI } from '../../../api/subscription';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { Field, FormActions, TextInput, Textarea } from '../../../components/ui/FormField';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import ActiveCheckboxField from '../shared/components/ActiveCheckboxField';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import FormHint from '../shared/components/FormHint';
import StatusBadge from '../shared/components/StatusBadge';
import TableRowActions from '../shared/components/TableRowActions';

const PAGE_SIZE = 20;

function createEmptyCode() {
  return {
    id: null,
    code: '',
    subscription_type: '',
    product_name: '',
    description: '',
    expiry_date: '',
    max_uses: '',
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
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function createEmptyBulkGenerate() {
  return {
    prefix: '',
    count: 50,
    subscription_type: '',
    max_uses: '',
    expiry_days: '',
    product_name: '',
    description: '',
  };
}

export default function ActivationCodesCatalogPage() {
  const { setMobileActions } = useLayoutActions();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [subscriptionTypeFilter, setSubscriptionTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [subscriptionTypes, setSubscriptionTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);

  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(createEmptyBulkGenerate());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);

  const loadSubscriptionTypes = useCallback(async () => {
    try {
      setTypesLoading(true);
      const response = await subscriptionTypesAPI.list({ page_size: 500, ordering: 'name' });
      const data = response?.data;
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setSubscriptionTypes(list);
    } catch {
      setSubscriptionTypes([]);
    } finally {
      setTypesLoading(false);
    }
  }, []);

  const loadItems = useCallback(async (paramsState) => {
    const state = paramsState || { search, statusFilter, subscriptionTypeFilter, page };

    try {
      setLoading(true);
      setError(null);
      const params = {
        search: state.search || undefined,
        is_active: state.statusFilter === 'active' ? 'true' : state.statusFilter === 'inactive' ? 'false' : undefined,
        subscription_type: state.subscriptionTypeFilter || undefined,
        page: state.page,
        page_size: PAGE_SIZE,
        ordering: '-created_at',
      };

      const response = await activationCodesAPI.list(params);
      const data = response?.data;
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(list);
      setTotalCount(data?.count ?? list.length);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки кодов активации'));
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, subscriptionTypeFilter, page]);

  useEffect(() => {
    loadSubscriptionTypes();
  }, [loadSubscriptionTypes]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadItems({ search, statusFilter, subscriptionTypeFilter, page: 1 });
    }, 350);
    return () => clearTimeout(timer);
  }, [search, statusFilter, subscriptionTypeFilter, loadItems]);

  useEffect(() => {
    const actions = [
      {
        id: 'create-activation-code',
        label: editingItem ? 'Новый код' : 'Создать код',
        onClick: () => {
          setSaveError(null);
          setEditingItem(createEmptyCode());
        },
        variant: editingItem ? 'secondary' : 'primary',
      },
      {
        id: 'bulk-generate-activation-codes',
        label: 'Сгенерировать пачку',
        onClick: () => {
          setBulkError(null);
          setBulkResult(null);
          setBulkForm(createEmptyBulkGenerate());
          setBulkOpen(true);
        },
        variant: 'secondary',
      },
    ];

    if (editingItem) {
      actions.push({
        id: 'close-activation-code-editor',
        label: 'Закрыть форму',
        onClick: () => setEditingItem(null),
        variant: 'secondary',
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [editingItem, setMobileActions]);

  const handleBulkGenerate = async (e) => {
    e?.preventDefault();

    const payload = {
      prefix: bulkForm.prefix?.trim() || '',
      count: Number(bulkForm.count),
      subscription_type: bulkForm.subscription_type,
      max_uses: bulkForm.max_uses === '' ? null : Number(bulkForm.max_uses),
      expiry_days: bulkForm.expiry_days === '' ? null : Number(bulkForm.expiry_days),
      product_name: bulkForm.product_name || '',
      description: bulkForm.description || '',
    };

    try {
      setBulkSaving(true);
      setBulkError(null);
      const resp = await activationCodesAPI.bulkGenerate(payload);
      setBulkResult(resp?.data || { success: true });
      await loadItems();
    } catch (err) {
      setBulkError(parseApiError(err, 'Ошибка массовой генерации кодов'));
    } finally {
      setBulkSaving(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingItem) return;

    const payload = {
      code: editingItem.code?.trim() || undefined,
      subscription_type: editingItem.subscription_type || null,
      product_name: editingItem.product_name || '',
      description: editingItem.description || '',
      expiry_date: parseInputToIso(editingItem.expiry_date),
      max_uses: editingItem.max_uses === '' ? null : Number(editingItem.max_uses),
      is_active: !!editingItem.is_active,
    };

    try {
      setSaving(true);
      setSaveError(null);
      if (editingItem.id) {
        await activationCodesAPI.update(editingItem.id, payload);
      } else {
        await activationCodesAPI.create(payload);
      }
      setEditingItem(null);
      await loadItems();
    } catch (err) {
      setSaveError(parseApiError(err, editingItem.id ? 'Ошибка сохранения кода' : 'Ошибка создания кода'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;

    try {
      setDeleting(true);
      await activationCodesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadItems();
    } catch (err) {
      alert(parseApiError(err, 'Ошибка удаления кода'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Код',
      render: (value) => <span className="font-mono text-xs text-gray-700">{value || '—'}</span>,
    },
    {
      key: 'subscription_type',
      label: 'Тип подписки',
      render: (value) => {
        const item = subscriptionTypes.find((st) => st.id === value);
        return <span className="text-sm text-gray-700">{item?.name || '—'}</span>;
      },
    },
    {
      key: 'max_uses',
      label: 'Лимит/Использовано',
      render: (_, row) => (
        <span className="text-sm text-gray-700">
          {row.max_uses ?? '∞'} / {row.current_uses ?? 0}
        </span>
      ),
    },
    {
      key: 'can_be_used',
      label: 'Доступность',
      render: (canBeUsed) => (
        <StatusBadge
          active={!!canBeUsed}
          activeLabel="Можно использовать"
          inactiveLabel="Недоступен"
          inactiveTone="red"
        />
      ),
    },
  ];

  return (
    <Layout>
      <CatalogPageHeader
        title="Справочник кодов активации"
        description="Коды для активации подписки"
        createLabel="Создать код"
        onCreate={() => {
          setSaveError(null);
          setEditingItem(createEmptyCode());
        }}
        secondaryActions={[
          {
            label: 'Сгенерировать пачку',
            onClick: () => {
              setBulkError(null);
              setBulkResult(null);
              setBulkForm(createEmptyBulkGenerate());
              setBulkOpen(true);
            },
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        error={error}
        emptyIcon="🔐"
        emptyText={search || statusFilter || subscriptionTypeFilter ? 'По запросу ничего не найдено' : 'Кодов активации пока нет'}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по коду, продукту, описанию..."
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={(
          <>
            <select
              value={subscriptionTypeFilter}
              onChange={(e) => setSubscriptionTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={typesLoading}
            >
              <option value="">Все типы подписки</option>
              {subscriptionTypes.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
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
          <TableRowActions
            onEdit={() => {
              setSaveError(null);
              setEditingItem({
                id: row.id,
                code: row.code || '',
                subscription_type: row.subscription_type || '',
                product_name: row.product_name || '',
                description: row.description || '',
                expiry_date: formatIsoForInput(row.expiry_date),
                max_uses: row.max_uses ?? '',
                is_active: row.is_active !== false,
              });
            }}
            onDelete={() => setDeleteTarget(row)}
          />
        )}
      />

      <Modal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        title={editingItem?.id ? 'Редактировать код активации' : 'Создать код активации'}
        size="lg"
      >
        {editingItem && (
          <form onSubmit={handleSave} className="space-y-4">
            <FormErrorAlert message={saveError} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Код (опционально)">
                <TextInput
                  value={editingItem.code}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="Оставьте пустым для авто-генерации"
                  maxLength={50}
                />
              </Field>

              <Field label="Тип подписки">
                <select
                  value={editingItem.subscription_type}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, subscription_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Не выбрано</option>
                  {subscriptionTypes.map((st) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Продукт">
                <TextInput
                  value={editingItem.product_name}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, product_name: e.target.value }))}
                  maxLength={200}
                />
              </Field>

              <Field label="Лимит использований">
                <TextInput
                  type="number"
                  min={1}
                  value={editingItem.max_uses}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, max_uses: e.target.value }))}
                  placeholder="Пусто = без лимита"
                />
              </Field>
            </div>

            <Field label="Дата истечения">
              <TextInput
                type="datetime-local"
                value={editingItem.expiry_date || ''}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, expiry_date: e.target.value }))}
              />
            </Field>

            <Field label="Описание">
              <Textarea
                rows={3}
                value={editingItem.description || ''}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, description: e.target.value }))}
              />
            </Field>

            <ActiveCheckboxField
              checked={editingItem.is_active}
              onChange={(next) => setEditingItem((prev) => ({ ...prev, is_active: next }))}
              text="Активный код"
            />

            <FormHint>
              Если поле &quot;Код&quot; пустое, бэкенд сгенерирует уникальный код автоматически.
            </FormHint>

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
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить код активации?"
        message={`Код «${deleteTarget?.code || deleteTarget?.id || ''}» будет удален без возможности восстановления.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Массовая генерация кодов"
        size="lg"
      >
        <form onSubmit={handleBulkGenerate} className="space-y-4">
          <FormErrorAlert message={bulkError} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Префикс (опционально)">
              <TextInput
                value={bulkForm.prefix}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                placeholder="ASD"
                maxLength={10}
              />
            </Field>

            <Field label="Количество">
              <TextInput
                type="number"
                min={1}
                max={1000}
                value={bulkForm.count}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, count: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Тип подписки">
            <select
              value={bulkForm.subscription_type}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, subscription_type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
              disabled={typesLoading}
            >
              <option value="">Выберите тип подписки</option>
              {subscriptionTypes.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Лимит использований (опционально)">
              <TextInput
                type="number"
                min={1}
                value={bulkForm.max_uses}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, max_uses: e.target.value }))}
                placeholder="Пусто = без лимита"
              />
            </Field>

            <Field label="Истекает через N дней (опционально)">
              <TextInput
                type="number"
                min={1}
                max={3650}
                value={bulkForm.expiry_days}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, expiry_days: e.target.value }))}
                placeholder="Пусто = бессрочно"
              />
            </Field>
          </div>

          <Field label="Продукт (опционально)">
            <TextInput
              value={bulkForm.product_name}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, product_name: e.target.value }))}
              maxLength={200}
            />
          </Field>

          <Field label="Описание (база)">
            <Textarea
              rows={3}
              value={bulkForm.description}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </Field>

          {bulkResult?.examples?.length ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm font-medium text-gray-800">Примеры кодов</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {bulkResult.examples.map((c) => (
                  <span key={c} className="font-mono text-xs px-2 py-1 rounded bg-white border border-gray-200">
                    {c}
                  </span>
                ))}
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Сгенерировано: {bulkResult.count ?? '—'}
              </div>
            </div>
          ) : null}

          <FormActions
            saving={bulkSaving}
            saveLabel="Сгенерировать"
            onCancel={() => setBulkOpen(false)}
          />
        </form>
      </Modal>
    </Layout>
  );
}
