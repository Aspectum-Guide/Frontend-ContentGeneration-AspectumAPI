import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import { Alert, Button, ConfirmModal, DataTable, PageHeader, Select, Switch, TableRowActions, Toast, Glyph } from '@aspectum/ui';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { adminAPI } from '../../../api/generation';
import { parseApiError } from '../../../utils/apiError';
import { getMultiLangValue } from '../shared/i18n';
import EventEditorModal from './EventEditorModal';
import { useEventsCatalog } from './useEventsCatalog';

export default function EventsCatalogPage() {
  const { setMobileActions } = useLayoutActions();
  const navigate = useNavigate();
  const e = useEventsCatalog();
  const [toggleConfirm, setToggleConfirm] = useState(null); // { id, field, value, label }
  const [nearestLoading, setNearestLoading] = useState(false);
  const [nearestNote, setNearestNote] = useState(null);
  const cityFilter = e.cityFilter;

  const handleCalculateNearest = useCallback(async () => {
    setNearestLoading(true);
    setNearestNote(null);
    try {
      const r = await adminAPI.calculateNearestEvents(cityFilter || undefined);
      const msg = r?.data?.message || r?.data?.status || 'Расчёт ближайших событий запущен';
      setNearestNote({ type: 'success', text: String(msg) });
    } catch (err) {
      setNearestNote({ type: 'error', text: parseApiError(err, 'Ошибка расчёта ближайших событий') });
    } finally {
      setNearestLoading(false);
    }
  }, [cityFilter]);

  const requestToggle = (id, field, value, label) => {
    if (!value) {
      // отключение — спрашиваем подтверждение
      setToggleConfirm({ id, field, value, label });
    } else {
      e.toggleFlag(id, field, value);
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Название',
      render: (title, row) => (
        <div>
          <div className="flex items-center gap-1.5 font-medium text-aspectum-text text-sm">
            {getMultiLangValue(title) || '—'}
            {row.audio_guide_count > 0 && (
              <Button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  navigate(`/catalog/audio-guides?event_id=${row.id}`);
                }}
                variant="link"
                size="sm"
                title={`${row.audio_guide_count} аудиогид(ов)`}
              >
                🎧{row.audio_guide_count}
              </Button>
            )}
          </div>
          {row.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {row.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-aspectum-purple-soft text-aspectum-purple-strong rounded text-xs">
                  {tag}
                </span>
              ))}
              {row.tags.length > 3 && (
                <span className="text-xs text-aspectum-text-disabled">+{row.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'city_display_name',
      label: 'Город',
      render: (v) => <span className="text-sm text-aspectum-text-subtle">{v || '—'}</span>,
    },
    {
      key: 'is_show',
      label: 'Виден',
      render: (v, row) => {
        const loading = e.togglingIds.has(`${row.id}-is_show`);
        return (
          <Switch
            checked={Boolean(v)}
            loading={loading}
            aria-label={v ? 'Скрыть событие' : 'Показать событие'}
            onChange={(next) => requestToggle(row.id, 'is_show', next, `Скрыть «${getMultiLangValue(row.title) || row.id}»?`)}
          />
        );
      },
    },
    {
      key: 'is_bookable',
      label: 'В сторе',
      render: (v, row) => {
        const loading = e.togglingIds.has(`${row.id}-is_bookable`);
        return (
          <Switch
            checked={Boolean(v)}
            loading={loading}
            color="green"
            aria-label={v ? 'Убрать из стора' : 'Добавить в стор'}
            onChange={(next) => requestToggle(row.id, 'is_bookable', next, `Убрать «${getMultiLangValue(row.title) || row.id}» из стора?`)}
          />
        );
      },
    },
    {
      key: 'image_url',
      label: 'Фото',
      render: (url) => url
        ? <img src={url} alt="" className="w-10 h-10 object-cover rounded-aspectum-compact" />
        : <span className="text-aspectum-text-faint text-xs">—</span>,
    },
  ];

  const openCreate = e.openCreate;
  const eventSaving = e.saving;
  const editingEvent = e.editingEvent;
  const handleSave = e.handleSave;
  const setEditingEvent = e.setEditingEvent;
  useEffect(() => {
    const actions = [
      {
        id: 'create-event',
        label: 'Создать событие',
        onClick: openCreate,
        disabled: eventSaving,
        variant: editingEvent ? 'secondary' : 'primary',
      },
      {
        id: 'create-event-tag',
        label: 'Создать тег ивента',
        onClick: () => navigate('/catalog/tags?tab=event'),
        variant: 'secondary',
      },
      {
        id: 'calculate-nearest-events',
        label: nearestLoading ? 'Расчёт...' : 'Рассчитать ближайшие',
        onClick: () => { if (!nearestLoading) handleCalculateNearest(); },
        disabled: nearestLoading,
        variant: 'secondary',
      },
    ];

    if (editingEvent) {
      actions.push(
        {
          id: 'save-event',
          label: eventSaving
            ? (editingEvent?.id ? 'Сохранение...' : 'Создание...')
            : (editingEvent?.id ? 'Сохранить событие' : 'Создать событие'),
          onClick: () => { if (!eventSaving) handleSave(); },
          disabled: eventSaving,
          variant: 'primary',
        },
        {
          id: 'close-event-editor',
          label: 'Закрыть форму',
          onClick: () => setEditingEvent(null),
        }
      );
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [openCreate, eventSaving, editingEvent, handleSave, setEditingEvent, handleCalculateNearest, navigate, nearestLoading, setMobileActions]);

  return (
    <Layout>
      <PageHeader
        title="Справочник событий"
        description="Просмотр и редактирование событий"
        className="flex-wrap"
        actions={<Button
          type="button"
          variant="soft"
          size="md"
          onClick={handleCalculateNearest}
          disabled={nearestLoading}
        >
          {nearestLoading ? 'Расчёт...' : 'Рассчитать ближайшие'}
        </Button>}
      />

      {nearestNote && (
        <Alert tone={nearestNote.type === 'error' ? 'error' : 'success'} className="mb-4 text-sm px-3 py-2">
          {nearestNote.text}
        </Alert>
      )}

      {(e.cityOptionsError || e.filtersError) && (
        <div className="mb-4 flex flex-col gap-1">
          {e.cityOptionsError && (
            <Alert tone="warning" className="text-sm px-3 py-2">
              <Glyph name="⚠" /> {e.cityOptionsError} — фильтр по городу недоступен
            </Alert>
          )}
          {e.filtersError && (
            <Alert tone="warning" className="text-sm px-3 py-2">
              <Glyph name="⚠" /> {e.filtersError} — теги в форме недоступны
            </Alert>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={e.events}
        loading={e.loading}
        error={e.error}
        emptyIcon="🎪"
        isFiltered={!!(e.search || e.cityFilter)}
        emptyText="Событий нет"
        search={e.search}
        onSearch={e.setSearch}
        searchPlaceholder="Поиск по названию..."
        page={e.page}
        totalCount={e.totalCount}
        pageSize={e.pageSize}
        onPage={e.setPage}
        filters={
          e.cityOptions.length > 0 && (
            <Select value={e.cityFilter} onChange={(evt) => e.setCityFilter(evt.target.value)}>
              <option value="">Все города</option>
              {e.cityOptions.map((c) => (
                <option key={c.id} value={c.id}>{getMultiLangValue(c.name) || c.id}</option>
              ))}
            </Select>
          )
        }
        actions={(row) => (
          <>
            <TableRowActions
              onEdit={() => e.openEdit(row)}
              onDelete={() => e.requestDelete(row)}
            />
          </>
        )}
      />

      <EventEditorModal
        open={!!e.editingEvent}
        onClose={() => e.setEditingEvent(null)}
        event={e.editingEvent}
        setEvent={e.setEditingEvent}
        editLoading={e.editLoading}
        activeLang={e.activeLang}
        setActiveLang={e.setActiveLang}
        saving={e.saving}
        saveError={e.saveError}
        onSave={e.handleSave}
        cityOptions={e.cityOptions}
        allEventFilters={e.allEventFilters}
        toggleTag={e.toggleTag}
        onPatchMedia={e.patchEventMedia}
        mediaSaving={e.mediaSaving}
        mediaError={e.mediaError}
        onPatchExternalProduct={e.patchExternalProduct}
        externalProductSaving={e.externalProductSaving}
        externalProductError={e.externalProductError}
      />

      <ConfirmModal
        open={!!toggleConfirm}
        onClose={() => setToggleConfirm(null)}
        onConfirm={() => {
          e.toggleFlag(toggleConfirm.id, toggleConfirm.field, toggleConfirm.value);
          setToggleConfirm(null);
        }}
        title={toggleConfirm?.label || 'Подтвердите действие'}
        message={
          toggleConfirm?.field === 'is_show'
            ? 'Ивент исчезнет из публичного приложения.'
            : 'Покупка билетов на этот ивент будет остановлена.'
        }
        confirmLabel="Да, отключить"
        danger
      />

      <ConfirmModal
        open={!!e.deleteTarget}
        onClose={() => e.setDeleteTarget(null)}
        onConfirm={e.confirmDelete}
        title="Удалить событие?"
        message={
          e.deleteError
            ? `Ошибка: ${e.deleteError}`
            : `Событие «${getMultiLangValue(e.deleteTarget?.title || e.deleteTarget?.name) || e.deleteTarget?.id}» будет удалено безвозвратно.`
        }
        confirmLabel="Удалить"
        danger
        loading={e.deleting}
      />
      <Toast note={e.toastNote} />
    </Layout>
  );
}
