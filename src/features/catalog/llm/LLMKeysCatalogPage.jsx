import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { Field, FormActions, TextInput } from '../../../components/ui/FormField';
import { parseApiError } from '../../../utils/apiError';
import { llmAPI } from '../../../api/llm';
import ActiveCheckboxField from '../shared/components/ActiveCheckboxField';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import TableRowActions from '../shared/components/TableRowActions';
import StatusBadge from '../shared/components/StatusBadge';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';

const PAGE_SIZE = 50;

function createEmptyKey() {
  return {
    id: null,
    provider: 'openai',
    name: '',
    api_key: '',
    base_url: '',
    is_active: true,
    rate_limit_tpm: 0,
    rate_limit_rpm: 0,
  };
}

export default function LLMKeysCatalogPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await llmAPI.keys.list();
      const list = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
      setItems(list);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки LLM keys'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const columns = useMemo(
    () => [
      {
        key: 'provider',
        label: 'Провайдер',
        render: (value) => <span className="text-sm font-medium text-gray-900">{value || '—'}</span>,
      },
      {
        key: 'name',
        label: 'Название',
        render: (value) => <span className="text-sm text-gray-700">{value || '—'}</span>,
      },
      {
        key: 'has_api_key',
        label: 'API Key',
        render: (hasKey) =>
          hasKey ? (
            <span className="text-xs text-green-700">✅ сохранён</span>
          ) : (
            <span className="text-xs text-amber-600">⚠️ не задан</span>
          ),
      },
      {
        key: 'base_url',
        label: 'Base URL',
        render: (value) => <span className="text-sm text-gray-700 font-mono">{value || '—'}</span>,
      },
      {
        key: 'is_active',
        label: 'Активен',
        render: (active) => <StatusBadge active={active} />,
      },
      {
        key: 'rate_limit_tpm',
        label: 'TPM',
        render: (v) => <span className="text-sm text-gray-700">{v ?? 0}</span>,
      },
      {
        key: 'rate_limit_rpm',
        label: 'RPM',
        render: (v) => <span className="text-sm text-gray-700">{v ?? 0}</span>,
      },
    ],
    []
  );

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!editingItem) return;

    const payload = {
      provider: editingItem.provider,
      name: editingItem.name,
      base_url: editingItem.base_url || '',
      is_active: !!editingItem.is_active,
      rate_limit_tpm: Number(editingItem.rate_limit_tpm || 0),
      rate_limit_rpm: Number(editingItem.rate_limit_rpm || 0),
    };

    // api_key: только если пользователь ввёл значение (для обновления)
    if (editingItem.api_key && String(editingItem.api_key).trim()) {
      payload.api_key = String(editingItem.api_key).trim();
    }

    try {
      setSaving(true);
      setSaveError(null);

      if (editingItem.id) {
        await llmAPI.keys.update(editingItem.id, payload);
      } else {
        // Для create api_key обязателен backend-ом.
        if (!payload.api_key) throw new Error('Введите API key');
        await llmAPI.keys.create(payload);
      }

      setEditingItem(null);
      await loadItems();
    } catch (err) {
      setSaveError(parseApiError(err, 'Ошибка сохранения LLM key'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      setDeleteError(null);
      setDeleting(true);
      await llmAPI.keys.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadItems();
    } catch (err) {
      setDeleteError(parseApiError(err, 'Ошибка удаления LLM key'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <CatalogPageHeader
        title="Ключи LLM API"
        description="Список provider keys. Сами значения ключей не отображаются — только статус наличия."
        createLabel="Создать ключ"
        onCreate={() => {
          setSaveError(null);
          setEditingItem(createEmptyKey());
        }}
      />

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        error={error}
        emptyIcon="🔑"
        emptyText="Ключей пока нет"
        isFiltered={false}
        page={1}
        totalCount={items.length}
        pageSize={PAGE_SIZE}
        // У ключей нет пагинации на бэке — отключаем действия страницы
        actions={(row) => (
          <TableRowActions
            onEdit={() => setEditingItem({ ...row })}
            onDelete={() => setDeleteTarget(row)}
          />
        )}
      />

      <Modal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        title={editingItem?.id ? 'Редактировать ключ' : 'Создать ключ'}
        size="lg"
      >
        {editingItem && (
          <form onSubmit={handleSave} className="space-y-4">
            <FormErrorAlert message={saveError} />

            <Field label="Провайдер" required>
              <TextInput
                value={editingItem.provider}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, provider: e.target.value }))}
                maxLength={50}
                required
              />
            </Field>

            <Field label="Название" required>
              <TextInput
                value={editingItem.name}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, name: e.target.value }))}
                maxLength={255}
                required
              />
            </Field>

            <Field label="Base URL">
              <TextInput
                value={editingItem.base_url}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, base_url: e.target.value }))}
                maxLength={255}
              />
            </Field>

            <Field label="API key (для создания/обновления)">
              <TextInput
                type="password"
                autoComplete="new-password"
                value={editingItem.api_key || ''}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, api_key: e.target.value }))}
                maxLength={512}
                placeholder={editingItem.id ? 'Оставьте пустым, чтобы не менять' : 'Введите новый key'}
              />
              {editingItem.id && (
                <p className="text-xs text-gray-500 mt-1">
                  {editingItem.has_api_key ? '✅ Ключ уже сохранён' : '⚠️ Ключ не задан'}
                </p>
              )}
            </Field>

            <ActiveCheckboxField
              label="Активен"
              checked={editingItem.is_active}
              onChange={(next) => setEditingItem((prev) => ({ ...prev, is_active: next }))}
              text="Включить этот ключ"
            />

            <Field label="Rate limit TPM">
              <TextInput
                value={String(editingItem.rate_limit_tpm ?? 0)}
                onChange={(e) =>
                  setEditingItem((prev) => ({ ...prev, rate_limit_tpm: e.target.value }))
                }
                inputMode="numeric"
              />
            </Field>

            <Field label="Rate limit RPM">
              <TextInput
                value={String(editingItem.rate_limit_rpm ?? 0)}
                onChange={(e) =>
                  setEditingItem((prev) => ({ ...prev, rate_limit_rpm: e.target.value }))
                }
                inputMode="numeric"
              />
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
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Удалить ключ?"
        message={
          deleteError ||
          `Ключ «${deleteTarget?.name || deleteTarget?.id || ''}» будет удалён без восстановления.`
        }
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </Layout>
  );
}

