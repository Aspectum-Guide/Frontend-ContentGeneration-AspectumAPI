import { useCallback, useEffect, useState } from 'react';
import { activationCodesAPI, subscriptionTypesAPI } from '../../../api/subscription';
import Layout from '../../../components/Layout';
import { Select, Alert, BulkActionModal, CheckboxField, FormHint, PageHeader, ConfirmModal, DataTable, Field, FormActions, Modal, Panel, StatusBadge, TableRowActions, Textarea, TextInput, formGridClassName } from '@aspectum/admin-ui-web';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { useCatalogCrud } from '../core/useCatalogCrud';
import { formatIsoForInput, parseInputToIso } from '../shared/scheduleParsers';

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

  const mapRowToEdit = useCallback(
    (row) => ({
      id: row.id,
      code: row.code || '',
      subscription_type: row.subscription_type || '',
      product_name: row.product_name || '',
      description: row.description || '',
      expiry_date: formatIsoForInput(row.expiry_date),
      max_uses: row.max_uses ?? '',
      is_active: row.is_active !== false,
    }),
    []
  );

  const mapEditToPayload = useCallback((editingItem) => {
    return {
      code: editingItem.code?.trim() || undefined,
      subscription_type: editingItem.subscription_type || null,
      product_name: editingItem.product_name || '',
      description: editingItem.description || '',
      expiry_date: parseInputToIso(editingItem.expiry_date) || null,
      max_uses: editingItem.max_uses === '' ? null : Number(editingItem.max_uses),
      is_active: !!editingItem.is_active,
    };
  }, []);

  const parseCrudError = useCallback((err, fallback) => parseApiError(err, fallback), []);

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

  const crud = useCatalogCrud({
    createEmpty: createEmptyCode,
    createRequest: activationCodesAPI.create,
    updateRequest: activationCodesAPI.update,
    deleteRequest: activationCodesAPI.delete,
    mapRowToEdit,
    mapEditToPayload,
    onAfterSave: loadItems,
    onAfterDelete: loadItems,
    parseError: parseCrudError,
    createErrorMessage: 'Ошибка создания кода',
    updateErrorMessage: 'Ошибка сохранения кода',
    deleteErrorMessage: 'Ошибка удаления кода',
  });

  const [bulkOpen, setBulkOpen] = useState(false);

  const editingItem = crud.editingItem;
  const openCreate = crud.openCreate;
  const closeEdit = crud.closeEdit;
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
          openCreate();
        },
        variant: editingItem ? 'secondary' : 'primary',
      },
      {
        id: 'bulk-generate-activation-codes',
        label: 'Сгенерировать пачку',
        onClick: () => {
          setBulkOpen(true);
        },
        variant: 'secondary',
      },
    ];

    if (editingItem) {
      actions.push({
        id: 'close-activation-code-editor',
        label: 'Закрыть форму',
        onClick: () => closeEdit(),
        variant: 'secondary',
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [editingItem, openCreate, closeEdit, setMobileActions]);

  const columns = [
    {
      key: 'code',
      label: 'Код',
      render: (value) => <span className="font-mono text-xs text-aspectum-text-strong">{value || '—'}</span>,
    },
    {
      key: 'subscription_type',
      label: 'Тип подписки',
      render: (value) => {
        const item = subscriptionTypes.find((st) => st.id === value);
        return <span className="text-sm text-aspectum-text-strong">{item?.name || '—'}</span>;
      },
    },
    {
      key: 'max_uses',
      label: 'Лимит/Использовано',
      render: (_, row) => (
        <span className="text-sm text-aspectum-text-strong">
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
      <PageHeader
        title="Справочник кодов активации"
        description="Коды для активации подписки"
        createLabel="Создать код"
        onCreate={() => {
          crud.openCreate();
        }}
        secondaryActions={[
          {
            label: 'Сгенерировать пачку',
            onClick: () => {
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
        isFiltered={!!(search || statusFilter || subscriptionTypeFilter)}
        emptyText="Кодов активации пока нет"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по коду, продукту, описанию..."
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={(
          <>
            <Select value={subscriptionTypeFilter} onChange={(e) => setSubscriptionTypeFilter(e.target.value)} disabled={typesLoading}>
              <option value="">Все типы подписки</option>
              {subscriptionTypes.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </Select>

            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Любой статус</option>
              <option value="active">Активные</option>
              <option value="inactive">Отключенные</option>
            </Select>
          </>
        )}
        actions={(row) => (
          <TableRowActions
            onEdit={() => crud.openEdit(row)}
            onDelete={() => crud.askDelete(row)}
          />
        )}
      />

      <Modal
        open={!!crud.editingItem}
        onClose={() => crud.closeEdit()}
        title={crud.editingItem?.id ? 'Редактировать код активации' : 'Создать код активации'}
        size="lg"
      >
        {crud.editingItem && (
          <form onSubmit={crud.save} className="space-y-4">
            <Alert tone="error">{crud.saveError}</Alert>

            <div className={formGridClassName()}>
              <Field label="Код (опционально)">
                <TextInput
                  value={crud.editingItem.code}
                  onChange={(e) => crud.setEditingItem((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="Оставьте пустым для авто-генерации"
                  maxLength={50}
                />
              </Field>

              <Field label="Тип подписки">
                <Select value={crud.editingItem.subscription_type} onChange={(e) => crud.setEditingItem((prev) => ({ ...prev, subscription_type: e.target.value }))}>
                  <option value="">Не выбрано</option>
                  {subscriptionTypes.map((st) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className={formGridClassName()}>
              <Field label="Продукт">
                <TextInput
                  value={crud.editingItem.product_name}
                  onChange={(e) => crud.setEditingItem((prev) => ({ ...prev, product_name: e.target.value }))}
                  maxLength={200}
                />
              </Field>

              <Field label="Лимит использований">
                <TextInput
                  type="number"
                  min={1}
                  value={crud.editingItem.max_uses}
                  onChange={(e) => crud.setEditingItem((prev) => ({ ...prev, max_uses: e.target.value }))}
                  placeholder="Пусто = без лимита"
                />
              </Field>
            </div>

            <Field label="Дата истечения">
              <TextInput
                type="datetime-local"
                value={crud.editingItem.expiry_date || ''}
                onChange={(e) => crud.setEditingItem((prev) => ({ ...prev, expiry_date: e.target.value }))}
              />
            </Field>

            <Field label="Описание">
              <Textarea
                rows={3}
                value={crud.editingItem.description || ''}
                onChange={(e) => crud.setEditingItem((prev) => ({ ...prev, description: e.target.value }))}
              />
            </Field>

            <CheckboxField
              checked={crud.editingItem.is_active}
              onChange={(next) => crud.setEditingItem((prev) => ({ ...prev, is_active: next }))}
              text="Активный код"
            />

            <FormHint>
              Если поле &quot;Код&quot; пустое, бэкенд сгенерирует уникальный код автоматически.
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
        onConfirm={crud.confirmDelete}
        title="Удалить код активации?"
        message={crud.deleteError || `Код «${crud.deleteTarget?.code || crud.deleteTarget?.id || ''}» будет удален без возможности восстановления.`}
        confirmLabel="Удалить"
        danger
        loading={crud.deleting}
      />

      <BulkActionModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Массовая генерация кодов"
        initialValues={createEmptyBulkGenerate()}
        submitLabel="Сгенерировать"
        parseError={(err) => parseApiError(err, 'Ошибка массовой генерации кодов')}
        onSubmit={async (values) => {
          const payload = {
            prefix: values.prefix?.trim() || '',
            count: Number(values.count),
            subscription_type: values.subscription_type,
            max_uses: values.max_uses === '' ? null : Number(values.max_uses),
            expiry_days: values.expiry_days === '' ? null : Number(values.expiry_days),
            product_name: values.product_name || '',
            description: values.description || '',
          };
          const resp = await activationCodesAPI.bulkGenerate(payload);
          await loadItems();
          return resp?.data || { success: true };
        }}
        renderFields={({ values, setValues, error }) => (
          <>
            <Alert tone="error">{error}</Alert>

            <div className={formGridClassName()}>
              <Field label="Префикс (опционально)">
                <TextInput
                  value={values.prefix}
                  onChange={(e) => setValues((prev) => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                  placeholder="ASD"
                  maxLength={10}
                />
              </Field>

              <Field label="Количество">
                <TextInput
                  type="number"
                  min={1}
                  max={1000}
                  value={values.count}
                  onChange={(e) => setValues((prev) => ({ ...prev, count: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Тип подписки">
              <Select value={values.subscription_type} onChange={(e) => setValues((prev) => ({ ...prev, subscription_type: e.target.value }))} required disabled={typesLoading}>
                <option value="">Выберите тип подписки</option>
                {subscriptionTypes.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </Select>
            </Field>

            <div className={formGridClassName()}>
              <Field label="Лимит использований (опционально)">
                <TextInput
                  type="number"
                  min={1}
                  value={values.max_uses}
                  onChange={(e) => setValues((prev) => ({ ...prev, max_uses: e.target.value }))}
                  placeholder="Пусто = без лимита"
                />
              </Field>

              <Field label="Истекает через N дней (опционально)">
                <TextInput
                  type="number"
                  min={1}
                  max={3650}
                  value={values.expiry_days}
                  onChange={(e) => setValues((prev) => ({ ...prev, expiry_days: e.target.value }))}
                  placeholder="Пусто = бессрочно"
                />
              </Field>
            </div>

            <Field label="Продукт (опционально)">
              <TextInput
                value={values.product_name}
                onChange={(e) => setValues((prev) => ({ ...prev, product_name: e.target.value }))}
                maxLength={200}
              />
            </Field>

            <Field label="Описание (база)">
              <Textarea
                rows={3}
                value={values.description}
                onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
              />
            </Field>
          </>
        )}
        renderResult={({ result }) =>
          result?.examples?.length ? (
            <Panel tone="muted" className="p-3">
              <div className="text-sm font-medium text-aspectum-text-emphasis">Примеры кодов</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.examples.map((c) => (
                  <span key={c} className="font-mono text-xs px-2 py-1 rounded bg-aspectum-surface border border-aspectum-border">
                    {c}
                  </span>
                ))}
              </div>
              <div className="mt-2 text-xs text-aspectum-text-subtle">
                Сгенерировано: {result.count ?? '—'}
              </div>
            </Panel>
          ) : null
        }
      />
    </Layout>
  );
}
