import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import { Button, Checkbox, ConfirmModal, DataTable, Switch, TableRowActions, Toast } from '@aspectum/ui';
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
          <Checkbox
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
          <div className="font-medium text-aspectum-text text-sm">{getMultiLangValue(name) || '—'}</div>
          {name && typeof name === 'object' && (
            <div className="text-xs text-aspectum-text-disabled mt-0.5">
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
        <span className="text-sm text-aspectum-text-subtle">{row.display_country || getMultiLangValue(country) || '—'}</span>
      ),
    },
    {
      key: 'lat',
      label: 'Коорд.',
      render: (lat, row) => (
        <span className="text-xs font-mono text-aspectum-text-disabled">
          {lat != null ? `${parseFloat(lat).toFixed(3)}, ${parseFloat(row.lon).toFixed(3)}` : '—'}
        </span>
      ),
    },
    {
      key: 'iap_price_usd',
      label: 'Цена',
      render: (price) => (
        <span className="text-sm text-aspectum-text-subtle">{price ? `$${price}` : '—'}</span>
      ),
    },
    {
      key: 'is_show',
      label: 'Виден',
      render: (v, row) => {
        const loading = c.togglingIds.has(`${row.id}-is_show`);
        return (
          <Switch
            checked={Boolean(v)}
            loading={loading}
            aria-label={v ? 'Скрыть город' : 'Показать город'}
            onChange={(next) => requestToggle(row.id, 'is_show', next, `Скрыть «${getMultiLangValue(row.name) || row.id}»?`)}
          />
        );
      },
    },
    {
      key: 'parent_city',
      label: 'Спец. гид',
      render: (parentCity) =>
        parentCity ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-aspectum-purple-soft text-aspectum-purple-strong border border-aspectum-purple-border">
            Спец. гид
          </span>
        ) : (
          <span className="text-sm text-aspectum-text-faint">—</span>
        ),
    },
    {
      key: 'id',
      label: 'ID',
      className: 'font-mono text-xs text-aspectum-text-disabled',
      render: (id) => String(id).slice(0, 12) + '…',
    },
  ];

  const editingCity = c.editingCity;
  const citySaving = c.saving;
  const imageUploading = c.imageUploading;
  const handleSave = c.handleSave;
  const setEditingCity = c.setEditingCity;
  const setActiveEditTab = c.setActiveEditTab;
  const setCommonsModalOpen = c.setCommonsModalOpen;
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
    if (!editingCity) return;
    const actions = [
      {
        id: 'save-city',
        label: citySaving
          ? (editingCity?.id ? 'Сохранение...' : 'Создание...')
          : (editingCity?.id ? 'Сохранить город' : 'Создать город'),
        onClick: () => { if (!citySaving) handleSave(); },
        disabled: citySaving,
        variant: 'primary',
      },
      {
        id: 'close-editor',
        label: 'Закрыть форму',
        onClick: () => setEditingCity(null),
      },
    ];

    if (!imageUploading) {
      actions.push({
        id: 'open-commons-picker',
        label: 'Открыть Wikimedia Commons',
        onClick: () => {
          setActiveEditTab('media');
          setCommonsModalOpen(true);
        },
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [editingCity, citySaving, imageUploading, handleSave, setEditingCity, setActiveEditTab, setCommonsModalOpen, setMobileActions]);

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="soft"
          size="md"
          onClick={() => handleBulkSync(false)}
          disabled={bulkSyncing || selectedIds.size === 0}
        >
          {bulkSyncing ? 'Синк...' : `Синк выбранных (${selectedIds.size})`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => handleBulkSync(true)}
          disabled={bulkSyncing}
        >
          Синк всех с SKU
        </Button>
        {bulkSyncNote && (
          <span className={`text-sm ${bulkSyncNote.type === 'error' ? 'text-aspectum-danger' : 'text-aspectum-positive-strong'}`}>
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
            {c.preparingEdit ? (
              <Button type="button" variant="soft" size="sm" disabled>
                Загрузка...
              </Button>
            ) : (
              <TableRowActions
                onEdit={() => c.openEdit(row)}
                onDelete={() => c.requestDelete(row)}
              />
            )}
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
