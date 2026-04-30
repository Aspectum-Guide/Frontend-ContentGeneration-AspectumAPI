import { useCallback, useEffect, useState } from 'react';
import { subscriptionTypesAPI } from '../../../api/subscription';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { Field, FormActions, TextInput, Textarea } from '../../../components/ui/FormField';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import ActiveCheckboxField from '../shared/components/ActiveCheckboxField';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import StatusBadge from '../shared/components/StatusBadge';
import TableRowActions from '../shared/components/TableRowActions';

const PAGE_SIZE = 20;

function createEmptyType() {
  return {
    id: null,
    name: '',
    description: '',
    is_active: true,
  };
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
      is_active: !!editingItem.is_active,
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

    try {
      setDeleting(true);
      await subscriptionTypesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadItems();
    } catch (err) {
      alert(parseApiError(err, 'Ошибка удаления типа подписки'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Название',
      render: (value) => <span className="text-sm font-medium text-gray-900">{value || '—'}</span>,
    },
    {
      key: 'description',
      label: 'Описание',
      render: (value) => <span className="text-sm text-gray-700">{value || '—'}</span>,
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
        title="Справочник типов подписки"
        description="Типы подписок для активационных кодов"
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
        emptyText={search || statusFilter ? 'По запросу ничего не найдено' : 'Типов подписки пока нет'}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по названию или описанию..."
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={(
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Любой статус</option>
            <option value="active">Активные</option>
            <option value="inactive">Отключенные</option>
          </select>
        )}
        actions={(row) => (
          <TableRowActions
            onEdit={() => {
              setSaveError(null);
              setEditingItem({
                id: row.id,
                name: row.name || '',
                description: row.description || '',
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
        title={editingItem?.id ? 'Редактировать тип подписки' : 'Создать тип подписки'}
        size="lg"
      >
        {editingItem && (
          <form onSubmit={handleSave} className="space-y-4">
            <FormErrorAlert message={saveError} />

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

            <ActiveCheckboxField
              checked={editingItem.is_active}
              onChange={(next) => setEditingItem((prev) => ({ ...prev, is_active: next }))}
              text="Активный тип подписки"
            />

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
        title="Удалить тип подписки?"
        message={`Тип «${deleteTarget?.name || deleteTarget?.id || ''}» будет удален без возможности восстановления.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </Layout>
  );
}
