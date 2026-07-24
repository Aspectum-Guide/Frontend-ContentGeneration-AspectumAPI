import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import Modal from '../../../components/ui/Modal';
import { ConfirmModal } from '../../../components/ui/Modal';
import { Field, TextInput, FormActions } from '../../../components/ui/FormField';
import Toast, { useToast } from '../../../components/ui/Toast.jsx';
import { appLanguagesAPI, cityFiltersAPI, eventFiltersAPI } from './api';
import { isNotFoundError, parseApiError } from '../../../utils/apiError';
import MultiLangInput from '../../../components/forms/MultiLangInput';
import { getMultiLangValue } from '../shared/i18n';
import {
  DEFAULT_APP_LANGUAGES,
  ensureAppLanguages,
  flattenEventFilterTree,
  mapAppLanguagesForMultiLangInput,
  normalizeListResponse,
  parseAppLanguagesResponse,
  unwrapEnvelope,
} from '../shared/normalize';
import {
  buildCityTagCreatePayload,
  buildCityTagUpdatePayload,
  buildEventFilterCreatePayload,
  buildEventFilterUpdatePayload,
  mapCityTagCatalogRow,
  mapEventFilterCatalogRow,
  applyLocalFilterDeletion,
  mergeFlatFilterListWithLocalOverlays,
  normalizeCreatedFilter,
  unwrapCreatedFilter,
  upsertFlatFilterRow,
} from '../shared/tagCatalog';

const DEFAULT_TAG_LANG = 'ru';

function hasAnyTitleText(titleObj) {
  if (!titleObj || typeof titleObj !== 'object') return false;
  return Object.values(titleObj).some((v) => String(v ?? '').trim());
}

function useFilters(api, locallyDeletedFilterIdsRef, locallyCreatedFilterRowsRef) {
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
      const merged = mergeFlatFilterListWithLocalOverlays(
        list,
        locallyCreatedFilterRowsRef.current,
        locallyDeletedFilterIdsRef.current,
      );
      setFilters(merged);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [api, locallyDeletedFilterIdsRef, locallyCreatedFilterRowsRef]);

  useEffect(() => { load(); }, [load]);

  return { filters, setFilters, loading, error, reload: load };
}

function initialNewFilter(mode) {
  if (mode === 'event') {
    return { name: {}, emoji: '', kind: 'folder', parent_folder_id: '' };
  }
  return { name: {}, emoji: '' };
}

function FilterTab({
  api,
  mode,
  icon,
  emptyText,
  createLabel,
  showNote,
  appLanguages,
  defaultLang = DEFAULT_TAG_LANG,
}) {
  const multiLangLanguages = useMemo(
    () => mapAppLanguagesForMultiLangInput(appLanguages),
    [appLanguages],
  );
  const locallyDeletedFilterIdsRef = useRef(new Set());
  const locallyCreatedFilterRowsRef = useRef(new Map());
  const { filters, setFilters, loading, error, reload } = useFilters(
    api,
    locallyDeletedFilterIdsRef,
    locallyCreatedFilterRowsRef,
  );
  const [search, setSearch] = useState('');
  const [editingFilter, setEditingFilter] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingFilterIds, setDeletingFilterIds] = useState(() => new Set());

  const markDeleting = (id) => {
    setDeletingFilterIds((prev) => {
      const next = new Set(prev);
      next.add(String(id));
      return next;
    });
  };

  const unmarkDeleting = (id) => {
    setDeletingFilterIds((prev) => {
      const next = new Set(prev);
      next.delete(String(id));
      return next;
    });
  };

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const quickCreatePendingRef = useRef(new Set());
  const deletePendingRef = useRef(new Set());
  const [createError, setCreateError] = useState(null);
  const [newFilter, setNewFilter] = useState(() => initialNewFilter(mode));
  const [createTitle, setCreateTitle] = useState('');
  const [createEmoji, setCreateEmoji] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

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

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingFilter?.id) return;
    if (!hasAnyTitleText(editingFilter.name)) {
      setSaveError('Введите название хотя бы на одном языке');
      return;
    }
    try {
      setSaving(true);
      setSaveError(null);
      const merged = {
        ...editingFilter,
        name: ensureAppLanguages(editingFilter.name, appLanguages, defaultLang),
        emoji: editEmoji,
      };
      await api.update(editingFilter.id, merged);
      setEditingFilter(null);
      setEditEmoji('');
      await reload();
    } catch (err) {
      setSaveError(err?.response?.data?.error || err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e?.preventDefault();
    if (creatingRef.current || creating) {
      return;
    }
    if (!createTitle.trim()) {
      setCreateError('Введите название');
      return;
    }
    if (mode === 'event' && newFilter.kind === 'tag' && !String(newFilter.parent_folder_id || '').trim()) {
      setCreateError('Выберите папку');
      return;
    }

    const scopeKey = `catalog-create:${mode}:${newFilter.kind}`;
    if (quickCreatePendingRef.current.has(scopeKey)) {
      return;
    }

    quickCreatePendingRef.current.add(scopeKey);
    creatingRef.current = true;
    try {
      setCreating(true);
      setCreateError(null);
      const payload = {
        ...newFilter,
        name: ensureAppLanguages(
          { [defaultLang]: createTitle.trim() },
          appLanguages,
          defaultLang,
        ),
        emoji: createEmoji,
      };
      const res = await api.create(payload);
      const created = normalizeCreatedFilter(unwrapCreatedFilter(res), appLanguages);

      if (created?.id != null) {
        const row =
          mode === 'city'
            ? mapCityTagCatalogRow(created, appLanguages)
            : mapEventFilterCatalogRow(created, appLanguages);
        const idStr = String(row.id);
        locallyDeletedFilterIdsRef.current.delete(idStr);
        locallyCreatedFilterRowsRef.current.set(idStr, row);
        setFilters((prev) => upsertFlatFilterRow(prev, row));
      }

      setCreateModalOpen(false);
      setNewFilter(initialNewFilter(mode));
      setCreateTitle('');
      setCreateEmoji('');
      showNote?.('Создано', 'success');
    } catch (err) {
      setCreateError(err?.response?.data?.error || err.message || 'Ошибка создания');
    } finally {
      quickCreatePendingRef.current.delete(scopeKey);
      creatingRef.current = false;
      setCreating(false);
      void reload().catch((e) => {
        console.error('Catalog reload after create failed', e);
      });
    }
  };

  const handleCreateTitleKeyDown = (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    if (event.repeat) {
      return;
    }

    handleCreate(event);
  };

  const resetCreateModal = () => {
    setCreateModalOpen(false);
    setCreateTitle('');
    setCreateEmoji('');
    setCreateError(null);
    setNewFilter(initialNewFilter(mode));
  };

  const closeEditModal = () => {
    setEditingFilter(null);
    setEditEmoji('');
    setSaveError(null);
  };

  const createNameLabel =
    mode === 'city'
      ? 'Название'
      : newFilter.kind === 'folder'
        ? 'Название папки'
        : 'Название тега';

  const editNameLabel =
    mode === 'event' && editingFilter?.type === 'folder'
      ? 'Название папки'
      : mode === 'event'
        ? 'Название тега'
        : 'Название';

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const id = deleteTarget.id;
    const idStr = String(id);

    if (deletePendingRef.current.has(idStr)) {
      return;
    }

    const applyLocalRemove = () => {
      applyLocalFilterDeletion(
        idStr,
        locallyDeletedFilterIdsRef.current,
        locallyCreatedFilterRowsRef.current,
      );
      setFilters((prev) => prev.filter((item) => String(item.id) !== idStr));
      setDeleteTarget(null);
    };

    deletePendingRef.current.add(idStr);
    markDeleting(id);

    try {
      await api.delete(id);
      applyLocalRemove();
      showNote?.('Удалено', 'success');
    } catch (err) {
      if (isNotFoundError(err)) {
        applyLocalRemove();
        showNote?.('Элемент уже удалён', 'success');
      } else {
        showNote?.(parseApiError(err, 'Ошибка удаления'), 'error');
      }
    } finally {
      deletePendingRef.current.delete(idStr);
      unmarkDeleting(id);
      void reload().catch((e) => {
        console.error('Catalog reload after delete failed', e);
      });
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
                {appLanguages
                  .filter(({ code }) => name[code])
                  .map(({ code, label }) => `${label || code}: ${name[code]}`)
                  .join(' · ')}
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
  }, [mode, appLanguages]);

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setCreateTitle('');
            setCreateEmoji('');
            setNewFilter(initialNewFilter(mode));
            setCreateModalOpen(true);
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          disabled={creating}
        >
          {creating ? 'Создание…' : (createLabel || 'Создать тег')}
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
              onClick={() => {
                setSaveError(null);
                setEditEmoji(row.emoji || '');
                setEditingFilter({
                  ...row,
                  name: ensureAppLanguages(row.name, appLanguages, defaultLang),
                });
              }}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              Ред.
            </button>
            <button
              type="button"
              disabled={deletingFilterIds.has(String(row.id))}
              onClick={(event) => {
                event.stopPropagation();
                setDeleteTarget(row);
              }}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              Удалить
            </button>
          </>
        )}
      />

      <Modal
        open={createModalOpen}
        onClose={resetCreateModal}
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

          <Field label={createNameLabel} required>
            <TextInput
              type="text"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              onKeyDown={handleCreateTitleKeyDown}
              disabled={creating}
              autoFocus
              placeholder="Введите название"
            />
          </Field>

          {mode === 'event' && newFilter.kind === 'tag' && (
            <Field label="Папка" required>
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

          <Field label="Эмодзи (опционально)">
            <TextInput
              value={createEmoji}
              onChange={(e) => setCreateEmoji(e.target.value)}
              placeholder="🏙️"
              maxLength={4}
            />
          </Field>

          <FormActions
            saving={creating}
            onCancel={resetCreateModal}
            saveLabel={creating ? 'Создание…' : 'Создать'}
          />
        </form>
      </Modal>

      <Modal
        open={!!editingFilter}
        onClose={closeEditModal}
        title="Редактировать фильтр"
        size="lg"
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
            <MultiLangInput
              label={editNameLabel}
              required
              languages={multiLangLanguages}
              value={editingFilter.name || {}}
              onChange={(name) => setEditingFilter((prev) => ({ ...prev, name }))}
            />
            <Field label="Эмодзи (опционально)">
              <TextInput
                value={editEmoji}
                onChange={(e) => setEditEmoji(e.target.value)}
                placeholder="🏙️"
                maxLength={4}
              />
            </Field>
            <Field label="Имя (API)">
              <TextInput
                value={editingFilter.slug || ''}
                readOnly
                className="font-mono bg-gray-50 text-gray-400 cursor-not-allowed"
              />
            </Field>
            <FormActions saving={saving} onCancel={closeEditModal} />
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
        loading={!!deleteTarget && deletingFilterIds.has(String(deleteTarget.id))}
      />
    </>
  );
}

export default function TagsFilters() {
  const [activeTab, setActiveTab] = useState('city');
  const [appLanguages, setAppLanguages] = useState(DEFAULT_APP_LANGUAGES);
  const { note, showNote } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await appLanguagesAPI.list();
        if (!cancelled) {
          setAppLanguages(parseAppLanguagesResponse(res));
        }
      } catch (e) {
        console.error('Failed to load app languages', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const cityCatalogApi = useMemo(() => ({
    list: async () => {
      const r = await cityFiltersAPI.getTags({ type: 'tag' });
      const raw = unwrapEnvelope(r?.data);
      const arr = Array.isArray(raw) ? raw : [];
      return { data: arr.map((row) => mapCityTagCatalogRow(row, appLanguages)) };
    },
    create: (nf) => cityFiltersAPI.create(buildCityTagCreatePayload(nf, appLanguages, DEFAULT_TAG_LANG)),
    update: (id, row) => cityFiltersAPI.update(id, buildCityTagUpdatePayload(row, appLanguages)),
    delete: (id) => cityFiltersAPI.delete(id),
  }), [appLanguages]);

  const eventCatalogApi = useMemo(() => ({
    list: async () => {
      const r = await eventFiltersAPI.getTree();
      const raw = unwrapEnvelope(r?.data);
      const tree = Array.isArray(raw) ? raw : [];
      const flat = flattenEventFilterTree(tree);
      return { data: flat.map((row) => mapEventFilterCatalogRow(row, appLanguages)) };
    },
    create: (nf) => eventFiltersAPI.create(buildEventFilterCreatePayload(nf, appLanguages, DEFAULT_TAG_LANG)),
    update: (id, row) => eventFiltersAPI.update(id, buildEventFilterUpdatePayload(row, appLanguages)),
    delete: (id) => eventFiltersAPI.delete(id),
  }), [appLanguages]);

  return (
    <Layout>
      <Toast note={note} />
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
          showNote={showNote}
          appLanguages={appLanguages}
          defaultLang={DEFAULT_TAG_LANG}
        />
      ) : (
        <FilterTab
          key="event"
          mode="event"
          api={eventCatalogApi}
          icon="🎪"
          emptyText="Папок и тегов событий нет"
          createLabel="Создать папку или тег"
          showNote={showNote}
          appLanguages={appLanguages}
          defaultLang={DEFAULT_TAG_LANG}
        />
      )}
    </Layout>
  );
}
