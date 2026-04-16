import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/Modal';
import { MultiLangField, Field, TextInput, FormActions } from '../../components/ui/FormField';
import { cityFiltersAPI, eventFiltersAPI } from '../../api/generation';

function getMultiLang(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.ru || val.en || val.it || Object.values(val).find(Boolean) || '';
}

const LANGS = ['ru', 'en', 'it'];

function useFilters(api) {
  const [filters, setFilters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await api.list();
      const data = r?.data;
      const list = Array.isArray(data?.filters) ? data.filters
        : Array.isArray(data?.results) ? data.results
        : Array.isArray(data?.tags) ? data.tags
        : Array.isArray(data) ? data : [];
      setFilters(list);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  return { filters, loading, error, reload: load };
}

function FilterTab({ api, icon, emptyText, createLabel }) {
  const { filters, loading, error, reload } = useFilters(api);
  const [search, setSearch] = useState('');
  const [editingFilter, setEditingFilter] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Create
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [newFilter, setNewFilter] = useState({ name: {}, emoji: '' });

  const filtered = filters.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return getMultiLang(f.name).toLowerCase().includes(q) ||
      (f.slug || '').toLowerCase().includes(q);
  });

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingFilter?.id) return;
    try {
      setSaving(true);
      setSaveError(null);
      const payload = { title: editingFilter.name };
      if (editingFilter.emoji) payload.emoji = editingFilter.emoji;
      if (editingFilter.description && typeof editingFilter.description === 'object') {
        payload.description = editingFilter.description;
      }
      await api.update(editingFilter.id, payload);
      setEditingFilter(null);
      await reload();
    } catch (err) {
      setSaveError(err?.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e?.preventDefault();
    try {
      setCreating(true);
      setCreateError(null);

      const payload = {
        title: newFilter?.name || {},
      };
      if (newFilter?.emoji?.trim()) {
        payload.emoji = newFilter.emoji.trim();
      }

      await api.create(payload);
      setCreateModalOpen(false);
      setNewFilter({ name: {}, emoji: '' });
      await reload();
    } catch (err) {
      setCreateError(err?.response?.data?.error || err.message || 'Ошибка создания');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.delete(deleteTarget.id);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      alert(err?.response?.data?.error || 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Название',
      render: (name) => (
        <div>
          <div className="font-medium text-gray-900 text-sm">{getMultiLang(name) || '—'}</div>
          {name && typeof name === 'object' && (
            <div className="text-xs text-gray-400 mt-0.5">
              {Object.entries(name).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'slug',
      label: 'Slug',
      className: 'font-mono text-xs text-gray-500',
      render: (v) => v || '—',
    },
  ];

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setNewFilter({ name: {}, emoji: '' });
            setCreateModalOpen(true);
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          disabled={creating}
        >
          {createLabel || 'Создать тег'}
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        error={error}
        emptyIcon={icon}
        emptyText={search ? 'По запросу не найдено' : emptyText}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск..."
        actions={(row) => (
          <>
            <button
              onClick={() => { setEditingFilter({ ...row }); setSaveError(null); }}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              Ред.
            </button>
            <button
              onClick={() => setDeleteTarget(row)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
            >
              Удалить
            </button>
          </>
        )}
      />

      {/* Create Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={createLabel || 'Создать тег'}
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {createError}
            </div>
          )}

          <MultiLangField
            label="Название"
            value={newFilter.name}
            onChange={(v) => setNewFilter((p) => ({ ...p, name: v }))}
            langs={LANGS}
          />

          <Field label="Эмодзи (опционально)">
            <TextInput
              value={newFilter.emoji || ''}
              onChange={(e) => setNewFilter((p) => ({ ...p, emoji: e.target.value }))}
              placeholder="🏙️"
              maxLength={4}
            />
          </Field>

          <FormActions saving={creating} onCancel={() => setCreateModalOpen(false)} saveLabel="Создать" />
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editingFilter}
        onClose={() => setEditingFilter(null)}
        title="Редактировать фильтр"
        size="md"
      >
        {editingFilter && (
          <form onSubmit={handleSave} className="space-y-4">
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {saveError}
              </div>
            )}
            <MultiLangField
              label="Название"
              value={typeof editingFilter.name === 'object' ? editingFilter.name : {}}
              onChange={(v) => setEditingFilter((p) => ({ ...p, name: v }))}
              langs={LANGS}
            />
            <Field label="Эмодзи (опционально)">
              <TextInput
                value={editingFilter.emoji || ''}
                onChange={(e) => setEditingFilter((p) => ({ ...p, emoji: e.target.value }))}
                placeholder="🏙️"
                maxLength={4}
              />
            </Field>
            <Field label="Slug (ID)">
              <TextInput
                value={editingFilter.slug || ''}
                readOnly
                className="font-mono bg-gray-50 text-gray-400 cursor-not-allowed"
              />
            </Field>
            <FormActions saving={saving} onCancel={() => setEditingFilter(null)} />
          </form>
        )}
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить фильтр?"
        message={`Фильтр «${getMultiLang(deleteTarget?.name) || deleteTarget?.slug || deleteTarget?.id}» будет удалён.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </>
  );
}

export default function TagsFilters() {
  const [activeTab, setActiveTab] = useState('city');

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Теги и фильтры</h1>
        <p className="mt-1 text-sm text-gray-500">Управление тегами городов и событий</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'city', label: '🏙️ Теги городов' },
          { key: 'event', label: '🎪 Теги событий' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'city' ? (
        <FilterTab
          key="city"
          api={cityFiltersAPI}
          icon="🏙️"
          emptyText="Тегов городов нет"
          createLabel="Создать тег города"
        />
      ) : (
        <FilterTab
          key="event"
          api={eventFiltersAPI}
          icon="🎪"
          emptyText="Тегов событий нет"
          createLabel="Создать тег ивента"
        />
      )}
    </Layout>
  );
}
