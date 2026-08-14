import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { ConfirmModal } from '../../../components/ui/Modal';
import Toast from '../../../components/ui/Toast';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { iapAdminAPI } from '../../../api/generation';
import { parseApiError } from '../../../utils/apiError';
import { getMultiLangValue } from '../shared/i18n';
import CityEditorModal from './CityEditorModal';
import { useCitiesCatalog } from './useCitiesCatalog';

export default function CitiesCatalogPage() {
  const { setMobileActions } = useLayoutActions();
  const c = useCitiesCatalog();
  const [toggleConfirm, setToggleConfirm] = useState(null); // { id, field, value, label }
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkSyncNote, setBulkSyncNote] = useState(null);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const sid = String(id);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const handleBulkSync = async (all = false) => {
    setBulkSyncing(true);
    setBulkSyncNote(null);
    try {
      const cityIds = all ? [] : [...selectedIds];
      const r = await iapAdminAPI.bulkSync(cityIds);
      const queued = r?.data?.queued ?? 0;
      setBulkSyncNote({ type: 'success', text: `В очередь поставлено: ${queued} город(ов)` });
    } catch (err) {
      setBulkSyncNote({ type: 'error', text: parseApiError(err, 'Ошибка bulk sync') });
    } finally {
      setBulkSyncing(false);
    }
  };

  const requestToggle = (id, field, value, label) => {
    if (!value) {
      // отключение — спрашиваем подтверждение
      setToggleConfirm({ id, field, value, label });
    } else {
      c.toggleFlag(id, field, value);
    }
  };

  const columns = [
    {
      key: '_select',
      label: '',
      render: (_, row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(String(row.id))}
          onChange={() => toggleSelected(row.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Выбрать город"
        />
      ),
    },
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
    {
      key: 'country',
      label: 'Страна',
      render: (country, row) => (
        <span className="text-sm text-gray-600">{row.display_country || getMultiLangValue(country) || '—'}</span>
      ),
    },
    {
      key: 'lat',
      label: 'Коорд.',
      render: (lat, row) => (
        <span className="text-xs font-mono text-gray-400">
          {lat != null ? `${parseFloat(lat).toFixed(3)}, ${parseFloat(row.lon).toFixed(3)}` : '—'}
        </span>
      ),
    },
    {
      key: 'iap_price_usd',
      label: 'Цена',
      render: (price) => (
        <span className="text-sm text-gray-600">{price ? `$${price}` : '—'}</span>
      ),
    },
    {
      key: 'is_show',
      label: 'Виден',
      render: (v, row) => {
        const loading = c.togglingIds.has(`${row.id}-is_show`);
        return (
          <button
            type="button"
            role="switch"
            aria-checked={v}
            aria-label={v ? 'Скрыть город' : 'Показать город'}
            onClick={() => !loading && requestToggle(row.id, 'is_show', !v, `Скрыть «${getMultiLangValue(row.name) || row.id}»?`)}
            disabled={loading}
            className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none disabled:opacity-50 ${v ? 'bg-blue-500' : 'bg-gray-300'}`}
          >
            {loading
              ? <span className="absolute inset-0 flex items-center justify-center"><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /></span>
              : <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${v ? 'left-4' : 'left-0.5'}`} />
            }
          </button>
        );
      },
    },
    {
      key: 'parent_city',
      label: 'Спец. гид',
      render: (parentCity) =>
        parentCity ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            Спец. гид
          </span>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        ),
    },
    {
      key: 'id',
      label: 'ID',
      className: 'font-mono text-xs text-gray-400',
      render: (id) => String(id).slice(0, 12) + '…',
    },
  ];

  useEffect(() => {
    if (c.editingCity) return;
    setMobileActions([
      { id: 'create-city', label: 'Создать город', onClick: c.openCreate, variant: 'primary' },
      { id: 'create-city-session', label: 'Через сессию', onClick: c.openNewSession, variant: 'secondary' },
      { id: 'create-city-tag', label: 'Создать тег города', onClick: c.openTags, variant: 'secondary' },
      { id: 'open-sessions', label: 'Открыть сессии', onClick: c.openSessions },
      { id: 'refresh-cities', label: 'Обновить справочник', onClick: c.reload },
    ]);
    return () => setMobileActions([]);
  }, [c.editingCity, c.openCreate, c.openNewSession, c.openTags, c.openSessions, c.reload, setMobileActions]);

  useEffect(() => {
    if (!c.editingCity) return;
    const actions = [
      {
        id: 'save-city',
        label: c.saving
          ? (c.editingCity?.id ? 'Сохранение...' : 'Создание...')
          : (c.editingCity?.id ? 'Сохранить город' : 'Создать город'),
        onClick: () => { if (!c.saving) c.handleSave(); },
        disabled: c.saving,
        variant: 'primary',
      },
      {
        id: 'close-editor',
        label: 'Закрыть форму',
        onClick: () => c.setEditingCity(null),
      },
    ];

    if (!c.imageUploading) {
      actions.push({
        id: 'open-commons-picker',
        label: 'Открыть Wikimedia Commons',
        onClick: () => {
          c.setActiveEditTab('media');
          c.setCommonsModalOpen(true);
        },
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [c.editingCity, c.saving, c.imageUploading, c.handleSave, c.setEditingCity, c.setActiveEditTab, c.setCommonsModalOpen, setMobileActions]);

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleBulkSync(false)}
          disabled={bulkSyncing || selectedIds.size === 0}
          className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          {bulkSyncing ? 'Синк...' : `Синк выбранных (${selectedIds.size})`}
        </button>
        <button
          type="button"
          onClick={() => handleBulkSync(true)}
          disabled={bulkSyncing}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          Синк всех с SKU
        </button>
        {bulkSyncNote && (
          <span className={`text-sm ${bulkSyncNote.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
            {bulkSyncNote.text}
          </span>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={c.rows}
        loading={c.loading}
        error={c.error}
        emptyIcon="🏙️"
        isFiltered={!!c.search}
        emptyText="Городов нет"
        search={c.search}
        onSearch={c.setSearch}
        searchPlaceholder="Поиск по названию, стране..."
        page={c.page}
        totalCount={c.totalCount}
        pageSize={c.pageSize}
        onPage={c.setPage}
        actions={(row) => (
          <>
            <button
              onClick={() => c.openEdit(row)}
              disabled={c.preparingEdit}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-60"
            >
              {c.preparingEdit ? 'Загрузка...' : 'Ред.'}
            </button>
            <button
              onClick={() => c.requestDelete(row)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
            >
              Удалить
            </button>
          </>
        )}
      />

      <CityEditorModal
        open={!!c.editingCity}
        onClose={() => c.setEditingCity(null)}
        city={c.editingCity}
        setCity={c.setEditingCity}
        preparing={c.preparingEdit}
        activeLang={c.activeLang}
        setActiveLang={c.setActiveLang}
        activeTab={c.activeEditTab}
        setActiveTab={c.setActiveEditTab}
        saving={c.saving}
        saveError={c.saveError}
        onSave={c.handleSave}
        imageInputRef={c.imageInputRef}
        imageUploading={c.imageUploading}
        commonsModalOpen={c.commonsModalOpen}
        setCommonsModalOpen={c.setCommonsModalOpen}
        onImageUpload={c.handleImageUpload}
        onCommonsSelect={c.handleCommonsImageSelect}
        allFilters={c.allFilters}
        toggleFilter={c.toggleFilter}
        allCities={c.allCities}
        syncIap={c.syncIap}
        syncingIap={c.syncingIap}
        syncIapNote={c.syncIapNote}
      />

      <ConfirmModal
        open={!!toggleConfirm}
        onClose={() => setToggleConfirm(null)}
        onConfirm={() => {
          c.toggleFlag(toggleConfirm.id, toggleConfirm.field, toggleConfirm.value);
          setToggleConfirm(null);
        }}
        title={toggleConfirm?.label || 'Подтвердите действие'}
        message="Город исчезнет из мобильного приложения и поиска."
        confirmLabel="Да, скрыть"
        danger
      />

      <ConfirmModal
        open={!!c.deleteTarget}
        onClose={() => c.setDeleteTarget(null)}
        onConfirm={c.confirmDelete}
        title="Удалить город?"
        message={
          c.deleteError
            ? `Ошибка: ${c.deleteError}`
            : `Город «${getMultiLangValue(c.deleteTarget?.name) || c.deleteTarget?.id}» будет удалён безвозвратно.`
        }
        confirmLabel="Удалить"
        danger
        loading={c.deleting}
      />
      <Toast note={c.toastNote} />
    </Layout>
  );
}

