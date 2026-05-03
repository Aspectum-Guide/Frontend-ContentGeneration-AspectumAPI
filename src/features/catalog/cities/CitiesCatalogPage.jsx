import { useEffect } from 'react';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { ConfirmModal } from '../../../components/ui/Modal';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { getMultiLangValue } from '../shared/i18n';
import CityEditorModal from './CityEditorModal';
import { useCitiesCatalog } from './useCitiesCatalog';

export default function CitiesCatalogPage() {
  const { setMobileActions } = useLayoutActions();
  const c = useCitiesCatalog();

  const columns = [
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
      key: 'id',
      label: 'ID',
      className: 'font-mono text-xs text-gray-400',
      render: (id) => String(id).slice(0, 12) + '…',
    },
  ];

  useEffect(() => {
    if (c.editingCity) return;
    setMobileActions([
      { id: 'create-city-session', label: 'Создать город', onClick: c.openNewSession, variant: 'primary' },
      { id: 'create-city-tag', label: 'Создать тег города', onClick: c.openTags, variant: 'secondary' },
      { id: 'open-sessions', label: 'Открыть сессии', onClick: c.openSessions },
      { id: 'refresh-cities', label: 'Обновить справочник', onClick: c.reload },
    ]);
    return () => setMobileActions([]);
  }, [c.editingCity, c.openNewSession, c.openTags, c.openSessions, c.reload, setMobileActions]);

  useEffect(() => {
    if (!c.editingCity) return;
    const actions = [
      {
        id: 'save-city',
        label: c.saving ? 'Сохранение...' : 'Сохранить город',
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
      <DataTable
        columns={columns}
        rows={c.rows}
        loading={c.loading}
        error={c.error}
        emptyIcon="🏙️"
        emptyText={c.search ? 'По запросу городов не найдено' : 'Городов нет'}
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
    </Layout>
  );
}

