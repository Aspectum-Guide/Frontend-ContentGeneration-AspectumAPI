import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import Modal from '../../../components/ui/Modal';
import { ConfirmModal } from '../../../components/ui/Modal';
import { MultiLangField, Field, TextInput, FormActions } from '../../../components/ui/FormField';
import { cityFiltersAPI, eventFiltersAPI } from '../../../api/generation';
import { extractLangCodes, getMultiLangValue } from '../shared/i18n';
import { flattenEventFilterTree, normalizeListResponse, unwrapEnvelope } from '../shared/normalize';
import {
  buildCityTagCreatePayload,
  buildCityTagUpdatePayload,
  buildEventFilterCreatePayload,
  buildEventFilterUpdatePayload,
  mapCityTagCatalogRow,
  mapEventFilterCatalogRow,
} from '../shared/tagCatalog';

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
      const list = Array.isArray(data) ? data : normalizeListResponse(data, ['filters', 'results', 'tags']);
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

function initialNewFilter(mode) {
  if (mode === 'event') {
    return { name: {}, emoji: '', kind: 'folder', parent_folder_id: '' };
  }
  return { name: {}, emoji: '' };
}

function FilterTab({ api, mode, icon, emptyText, createLabel }) {
  const { filters, loading, error, reload } = useFilters(api);
  const [search, setSearch] = useState('');
  const [editingFilter, setEditingFilter] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [newFilter, setNewFilter] = useState(() => initialNewFilter(mode));

  const folderOptions = useMemo(
    () => filters.filter((f) => f.type === 'folder'),
    [filters]
  );

  const filtered = filters.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = getMultiLangValue(f.name).toLowerCase().includes(q);
    const slugMatch = (f.slug || '').toLowerCase().includes(q);
    const typeMatch = mode === 'event' && (f.type || '').toLowerCase().includes(q);
    return nameMatch || slugMatch || typeMatch;
  });

  const dynamicLangs = extractLangCodes(
    [
      ...filters.map((f) => f?.name),
      editingFilter?.name,
      newFilter?.name,
    ]
  );

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingFilter?.id) return;
    try {
      setSaving(true);
      setSaveError(null);
      await api.update(editingFilter.id, editingFilter);
      setEditingFilter(null);
      await reload();
    } catch (err) {
      setSaveError(err?.response?.data?.error || err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e?.preventDefault();
    try {
      setCreating(true);
      setCreateError(null);
      await api.create(newFilter);
      setCreateModalOpen(false);
      setNewFilter(initialNewFilter(mode));
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
      alert(err?.response?.data?.error || err.message || 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo(() => {
    const base = [
      {
        key: 'name',
        label: 'Название',
        render: (name) => (
          <div>
            <div className="font-medium text-gray-900 text-sm">{getMultiLangValue(name) || '—'}</div>
            {name && typeof name === 'object' && (
              <div className="text-xs text-gray-400 mt-0.5">
                {Object.entries(name).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </div>
            )}
          </div>
        ),
      },
    ];
    if (mode === 'event') {
      base.push({
        key: 'type',
        label: 'Тип',
        className: 'text-xs text-gray-600 capitalize',
        render: (v) => (v === 'folder' ? 'Папка' : v === 'tag' ? 'Тег' : v || '—'),
      });
    }
    base.push({
      key: 'slug',
      label: 'Имя (API)',
      className: 'font-mono text-xs text-gray-500',
      render: (v) => v || '—',
    });
    return base;
  }, [mode]);

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setNewFilter(initialNewFilter(mode));
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
              type="button"
              onClick={() => { setEditingFilter({ ...row }); setSaveError(null); }}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              Ред.
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(row)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
            >
              Удалить
            </button>
          </>
        )}
      />

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

          {mode === 'event' && (
            <Field label="Тип">
              <select
                value={newFilter.kind}
                onChange={(e) => setNewFilter((p) => ({
                  ...p,
                  kind: e.target.value,
                  parent_folder_id: e.target.value === 'folder' ? '' : p.parent_folder_id,
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="folder">Папка</option>
                <option value="tag">Тег (внутри папки)</option>
              </select>
            </Field>
          )}

          {mode === 'event' && newFilter.kind === 'tag' && (
            <Field label="Папка">
              <select
                value={newFilter.parent_folder_id}
                onChange={(e) => setNewFilter((p) => ({ ...p, parent_folder_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              >
                <option value="">— выберите папку —</option>
                {folderOptions.map((f) => (
                  <option key={String(f.id)} value={String(f.id)}>
                    {getMultiLangValue(f.name) || f.slug || f.id}
                  </option>
                ))}
              </select>
              {folderOptions.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">Сначала создайте папку, затем теги внутри неё.</p>
              )}
            </Field>
          )}

          <MultiLangField
            label="Название"
            value={newFilter.name}
            onChange={(v) => setNewFilter((p) => ({ ...p, name: v }))}
            langs={dynamicLangs}
          />

          {!(mode === 'event' && newFilter.kind === 'folder') && (
            <Field label="Эмодзи (опционально)">
              <TextInput
                value={newFilter.emoji || ''}
                onChange={(e) => setNewFilter((p) => ({ ...p, emoji: e.target.value }))}
                placeholder="🏙️"
                maxLength={4}
              />
            </Field>
          )}

          <FormActions saving={creating} onCancel={() => setCreateModalOpen(false)} saveLabel="Создать" />
        </form>
      </Modal>

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
            {mode === 'event' && (
              <Field label="Тип">
                <TextInput
                  value={editingFilter.type === 'folder' ? 'Папка' : 'Тег'}
                  readOnly
                  className="bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </Field>
            )}
            <MultiLangField
              label="Название"
              value={typeof editingFilter.name === 'object' ? editingFilter.name : {}}
              onChange={(v) => setEditingFilter((p) => ({ ...p, name: v }))}
              langs={dynamicLangs}
            />
            {!(mode === 'event' && editingFilter.type === 'folder') && (
              <Field label="Эмодзи (опционально)">
                <TextInput
                  value={editingFilter.emoji || ''}
                  onChange={(e) => setEditingFilter((p) => ({ ...p, emoji: e.target.value }))}
                  placeholder="🏙️"
                  maxLength={4}
                />
              </Field>
            )}
            <Field label="Имя (API)">
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

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить фильтр?"
        message={`Фильтр «${getMultiLangValue(deleteTarget?.name) || deleteTarget?.slug || deleteTarget?.id}» будет удалён.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </>
  );
}

export default function TagsFilters() {
  const [activeTab, setActiveTab] = useState('city');

  const cityCatalogApi = useMemo(() => ({
    list: async () => {
      const r = await cityFiltersAPI.getTags({ type: 'tag' });
      const raw = unwrapEnvelope(r?.data);
      const arr = Array.isArray(raw) ? raw : [];
      return { data: arr.map(mapCityTagCatalogRow) };
    },
    create: (nf) => cityFiltersAPI.create(buildCityTagCreatePayload(nf)),
    update: (id, row) => cityFiltersAPI.update(id, buildCityTagUpdatePayload(row)),
    delete: (id) => cityFiltersAPI.delete(id),
  }), []);

  const eventCatalogApi = useMemo(() => ({
    list: async () => {
      const r = await eventFiltersAPI.getTree();
      const raw = unwrapEnvelope(r?.data);
      const tree = Array.isArray(raw) ? raw : [];
      const flat = flattenEventFilterTree(tree);
      return { data: flat.map(mapEventFilterCatalogRow) };
    },
    create: (nf) => eventFiltersAPI.create(buildEventFilterCreatePayload(nf)),
    update: (id, row) => eventFiltersAPI.update(id, buildEventFilterUpdatePayload(row)),
    delete: (id) => eventFiltersAPI.delete(id),
  }), []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Теги и фильтры</h1>
        <p className="mt-1 text-sm text-gray-500">Управление тегами городов и событий (CityAPI / EventsAPI)</p>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'city', label: '🏙️ Теги городов' },
          { key: 'event', label: '🎪 Теги событий' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
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
          mode="city"
          api={cityCatalogApi}
          icon="🏙️"
          emptyText="Тегов городов нет"
          createLabel="Создать тег города"
        />
      ) : (
        <FilterTab
          key="event"
          mode="event"
          api={eventCatalogApi}
          icon="🎪"
          emptyText="Папок и тегов событий нет"
          createLabel="Создать папку или тег"
        />
      )}
    </Layout>
  );
}
