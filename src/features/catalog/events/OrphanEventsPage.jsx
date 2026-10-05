import { useCallback, useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import Toast, { useToast } from '../../../components/ui/Toast';
import { citiesAPI } from '../../../api/generation';
import { parseApiError } from '../../../utils/apiError';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { getMultiLangValue } from '../shared/i18n';
import { normalizeListResponse } from '../shared/normalize';
import { orphanEventsAPI } from './orphansApi';

const PAGE_SIZE = 20;
const TABS = [
  { id: 'orphans', label: 'Без города' },
  { id: 'archived', label: 'Корзина' },
];

const btn = (tone) =>
  `px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${tone}`;

export default function OrphanEventsPage() {
  const { note, showNote } = useToast();
  const { page, setPage, search, setSearch, debouncedSearch } = useCatalogFilters({ debounceMs: 400 });
  const [tab, setTab] = useState('orphans');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cities, setCities] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const [assignTarget, setAssignTarget] = useState(null);
  const [assignCityId, setAssignCityId] = useState('');
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = tab === 'orphans' ? orphanEventsAPI.listOrphans : orphanEventsAPI.listArchived;
      const r = await fn({ page, page_size: PAGE_SIZE, ...(debouncedSearch ? { search: debouncedSearch } : {}) });
      setRows(r?.data?.events || []);
      setTotal(r?.data?.total || 0);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(parseApiError(err, 'Ошибка загрузки событий'));
    } finally {
      setLoading(false);
    }
  }, [tab, page, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    citiesAPI
      .list({ page_size: 300 })
      .then((r) => setCities(normalizeListResponse(r?.data, ['data', 'results'])))
      .catch(() => showNote('Не удалось загрузить список городов', 'error'));
  }, [showNote]);

  const switchTab = (id) => {
    setTab(id);
    setPage(1);
  };

  const run = async (id, fn, okMsg) => {
    setBusyId(id);
    try {
      await fn();
      showNote(okMsg, 'success');
      await load();
    } catch (err) {
      showNote(parseApiError(err, 'Операция не выполнена'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Название',
      render: (title, row) => (
        <div>
          <div className="font-medium text-gray-900 text-sm">{getMultiLangValue(title) || '—'}</div>
          {row.description && (
            <div className="mt-0.5 text-xs text-gray-500 line-clamp-2">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'image_url',
      label: 'Фото',
      render: (url) => (url
        ? <img src={url} alt="" className="w-10 h-10 object-cover rounded-md" />
        : <span className="text-gray-300 text-xs">—</span>),
    },
    {
      key: 'info_count',
      label: 'Содержимое',
      render: (_, row) => (
        <span className="text-xs text-gray-600">
          блоков {row.info_count} · лента {row.feed_count} · 🎧 {row.audio_guide_count}
        </span>
      ),
    },
    {
      key: 'subscription_count',
      label: 'Связи',
      render: (_, row) => (
        <span className={`text-xs ${row.booking_refs ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
          подписок {row.subscription_count} · букинг {row.booking_refs}
        </span>
      ),
    },
    tab === 'orphans'
      ? {
        key: 'duplicates',
        label: 'Похожие в городах',
        render: (dups) => (dups?.length
          ? (
            <div className="flex flex-col gap-0.5">
              {dups.map((d) => (
                <span key={d.id} className="text-xs text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
                  {d.city_display_name} · 🎧 {d.audio_guide_count}
                </span>
              ))}
            </div>
          )
          : <span className="text-gray-300 text-xs">нет</span>),
      }
      : {
        key: 'archived_at',
        label: 'В корзине с',
        render: (v) => <span className="text-xs text-gray-600">{v ? new Date(v).toLocaleString() : '—'}</span>,
      },
  ];

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">События без города и корзина</h1>
        <p className="mt-1 text-sm text-gray-500">
          Привяжите событие к городу или отправьте в корзину. Из корзины событие можно вернуть или удалить насовсем.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={`px-3 py-1.5 text-sm rounded-lg ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        emptyIcon={tab === 'orphans' ? '✅' : '🗑'}
        emptyText={tab === 'orphans' ? 'Событий без города нет' : 'Корзина пуста'}
        isFiltered={!!search}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по названию..."
        page={page}
        totalCount={total}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        actions={(row) => (tab === 'orphans'
          ? (
            <>
              <button
                disabled={busyId === row.id}
                onClick={() => { setAssignCityId(''); setAssignTarget(row); }}
                className={btn('text-blue-600 bg-blue-50 hover:bg-blue-100')}
              >
                К городу
              </button>
              <button
                disabled={busyId === row.id}
                onClick={() => setArchiveTarget(row)}
                className={btn('text-gray-700 bg-gray-100 hover:bg-gray-200')}
              >
                В корзину
              </button>
            </>
          )
          : (
            <>
              <button
                disabled={busyId === row.id}
                onClick={() => run(row.id, () => orphanEventsAPI.restore(row.id), 'Событие возвращено (скрытым)')}
                className={btn('text-blue-600 bg-blue-50 hover:bg-blue-100')}
              >
                Вернуть
              </button>
              <button
                disabled={busyId === row.id || row.booking_refs > 0}
                title={row.booking_refs > 0 ? 'Есть связанные бронирования/билеты' : undefined}
                onClick={() => setPurgeTarget(row)}
                className={btn('text-red-600 bg-red-50 hover:bg-red-100')}
              >
                Удалить насовсем
              </button>
            </>
          ))}
      />

      <Modal
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        title="Привязать к городу"
        footer={(
          <>
            <button
              type="button"
              onClick={() => setAssignTarget(null)}
              className="px-3 py-2 text-sm text-gray-600"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={!assignCityId}
              onClick={async () => {
                const target = assignTarget;
                setAssignTarget(null);
                await run(target.id, () => orphanEventsAPI.assignCity(target.id, assignCityId), 'Событие привязано к городу');
              }}
              className="px-3 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50"
            >
              Привязать
            </button>
          </>
        )}
      >
        <p className="mb-3 text-sm text-gray-600">
          «{getMultiLangValue(assignTarget?.title) || assignTarget?.id}»
        </p>
        {assignTarget?.duplicates?.length > 0 && (
          <p className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Событие с таким названием уже есть в городах: {assignTarget.duplicates.map((d) => d.city_display_name).join(', ')}.
            Возможно, это дубль — тогда лучше отправить в корзину.
          </p>
        )}
        <select
          value={assignCityId}
          onChange={(evt) => setAssignCityId(evt.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">Выберите город</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{getMultiLangValue(c.name) || c.id}</option>
          ))}
        </select>
      </Modal>

      <ConfirmModal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => {
          const target = archiveTarget;
          setArchiveTarget(null);
          await run(target.id, () => orphanEventsAPI.archive(target.id), 'Событие перенесено в корзину');
        }}
        title="Отправить в корзину?"
        message={`«${getMultiLangValue(archiveTarget?.title) || archiveTarget?.id}» будет скрыто везде. Из корзины его можно вернуть.`}
        confirmLabel="В корзину"
      />

      <ConfirmModal
        open={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        onConfirm={async () => {
          const target = purgeTarget;
          setPurgeTarget(null);
          await run(target.id, () => orphanEventsAPI.purge(target.id), 'Событие удалено');
        }}
        title="Удалить насовсем?"
        message={`«${getMultiLangValue(purgeTarget?.title) || purgeTarget?.id}» и всё его содержимое (блоки, лента, медиа) будут удалены безвозвратно. Подписок: ${purgeTarget?.subscription_count ?? 0}.`}
        confirmLabel="Удалить"
        danger
      />
      <Toast note={note} />
    </Layout>
  );
}
