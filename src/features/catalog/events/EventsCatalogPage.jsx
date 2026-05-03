import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { ConfirmModal } from '../../../components/ui/Modal';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { getMultiLangValue } from '../shared/i18n';
import EventEditorModal from './EventEditorModal';
import { useEventsCatalog } from './useEventsCatalog';

export default function EventsCatalogPage() {
  const { setMobileActions } = useLayoutActions();
  const navigate = useNavigate();
  const e = useEventsCatalog();

  const columns = [
    {
      key: 'title',
      label: 'Название',
      render: (title, row) => (
        <div>
          <div className="font-medium text-gray-900 text-sm">{getMultiLangValue(title) || '—'}</div>
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
      label: 'Статус',
      render: (v) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
          {v ? 'Активно' : 'Скрыто'}
        </span>
      ),
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
  }, [e.openCreate, e.saving, e.editingEvent, e.handleSave, e.setEditingEvent, navigate, setMobileActions]);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Справочник событий</h1>
        <p className="mt-1 text-sm text-gray-500">Просмотр и редактирование событий</p>
      </div>

      <DataTable
        columns={columns}
        rows={e.events}
        loading={e.loading}
        error={e.error}
        emptyIcon="🎪"
        emptyText={e.search || e.cityFilter ? 'По запросу событий не найдено' : 'Событий нет'}
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
        onSetMedia={e.setEventMedia}
        mediaSaving={e.mediaSaving}
        mediaError={e.mediaError}
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
    </Layout>
  );
}

