import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { ConfirmModal } from '../../../components/ui/Modal';
import Toast from '../../../components/ui/Toast';
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

  const handleCalculateNearest = async () => {
    setNearestLoading(true);
    setNearestNote(null);
    try {
      const r = await adminAPI.calculateNearestEvents(e.cityFilter || undefined);
      const msg = r?.data?.message || r?.data?.status || 'Расчёт ближайших событий запущен';
      setNearestNote({ type: 'success', text: String(msg) });
    } catch (err) {
      setNearestNote({ type: 'error', text: parseApiError(err, 'Ошибка расчёта ближайших событий') });
    } finally {
      setNearestLoading(false);
    }
  };

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
          <div className="flex items-center gap-1.5 font-medium text-gray-900 text-sm">
            {getMultiLangValue(title) || '—'}
            {row.audio_guide_count > 0 && (
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  navigate(`/catalog/audio-guides?event_id=${row.id}`);
                }}
                className="text-xs text-blue-600 font-normal hover:underline"
                title={`${row.audio_guide_count} аудиогид(ов)`}
              >
                🎧{row.audio_guide_count}
              </button>
            )}
          </div>
          {row.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {row.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                  {tag}
                </span>
              ))}
              {row.tags.length > 3 && (
                <span className="text-xs text-gray-400">+{row.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'city_display_name',
      label: 'Город',
      render: (v) => <span className="text-sm text-gray-600">{v || '—'}</span>,
    },
    {
      key: 'is_show',
      label: 'Виден',
      render: (v, row) => {
        const loading = e.togglingIds.has(`${row.id}-is_show`);
        return (
          <button
            type="button"
            role="switch"
            aria-checked={v}
            aria-label={v ? 'Скрыть событие' : 'Показать событие'}
            onClick={() => !loading && requestToggle(row.id, 'is_show', !v, `Скрыть «${getMultiLangValue(row.title) || row.id}»?`)}
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
      key: 'is_bookable',
      label: 'В сторе',
      render: (v, row) => {
        const loading = e.togglingIds.has(`${row.id}-is_bookable`);
        return (
          <button
            type="button"
            role="switch"
            aria-checked={v}
            aria-label={v ? 'Убрать из стора' : 'Добавить в стор'}
            onClick={() => !loading && requestToggle(row.id, 'is_bookable', !v, `Убрать «${getMultiLangValue(row.title) || row.id}» из стора?`)}
            disabled={loading}
            className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none disabled:opacity-50 ${v ? 'bg-green-500' : 'bg-gray-300'}`}
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
      key: 'image_url',
      label: 'Фото',
      render: (url) => url
        ? <img src={url} alt="" className="w-10 h-10 object-cover rounded-md" />
        : <span className="text-gray-300 text-xs">—</span>,
    },
  ];

  useEffect(() => {
    const actions = [
      {
        id: 'create-event',
        label: 'Создать событие',
        onClick: e.openCreate,
        disabled: e.saving,
        variant: e.editingEvent ? 'secondary' : 'primary',
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

    if (e.editingEvent) {
      actions.push(
        {
          id: 'save-event',
          label: e.saving
            ? (e.editingEvent?.id ? 'Сохранение...' : 'Создание...')
            : (e.editingEvent?.id ? 'Сохранить событие' : 'Создать событие'),
          onClick: () => { if (!e.saving) e.handleSave(); },
          disabled: e.saving,
          variant: 'primary',
        },
        {
          id: 'close-event-editor',
          label: 'Закрыть форму',
          onClick: () => e.setEditingEvent(null),
        }
      );
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [e.openCreate, e.saving, e.editingEvent, e.handleSave, e.setEditingEvent, e.cityFilter, navigate, nearestLoading, setMobileActions]);

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Справочник событий</h1>
          <p className="mt-1 text-sm text-gray-500">Просмотр и редактирование событий</p>
        </div>
        <button
          type="button"
          onClick={handleCalculateNearest}
          disabled={nearestLoading}
          className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          {nearestLoading ? 'Расчёт...' : 'Рассчитать ближайшие'}
        </button>
      </div>

      {nearestNote && (
        <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${
          nearestNote.type === 'error'
            ? 'text-red-700 bg-red-50 border-red-200'
            : 'text-green-700 bg-green-50 border-green-200'
        }`}
        >
          {nearestNote.text}
        </div>
      )}

      {(e.cityOptionsError || e.filtersError) && (
        <div className="mb-4 flex flex-col gap-1">
          {e.cityOptionsError && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠ {e.cityOptionsError} — фильтр по городу недоступен
            </div>
          )}
          {e.filtersError && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠ {e.filtersError} — теги в форме недоступны
            </div>
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
            <select
              value={e.cityFilter}
              onChange={(evt) => e.setCityFilter(evt.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Все города</option>
              {e.cityOptions.map((c) => (
                <option key={c.id} value={c.id}>{getMultiLangValue(c.name) || c.id}</option>
              ))}
            </select>
          )
        }
        actions={(row) => (
          <>
            <button
              onClick={() => e.openEdit(row)}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              Ред.
            </button>
            <button
              onClick={() => e.requestDelete(row)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
            >
              Удалить
            </button>
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

