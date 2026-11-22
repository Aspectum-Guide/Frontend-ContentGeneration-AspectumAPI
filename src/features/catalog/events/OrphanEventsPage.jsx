import { useCallback, useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import { Alert, Button, ConfirmModal, DataTable, Modal, PageHeader, Select, Tabs, Toast, useToast } from '@aspectum/admin-ui-web';
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
          <div className="font-medium text-aspectum-text text-sm">{getMultiLangValue(title) || '—'}</div>
          {row.description && (
            <div className="mt-0.5 text-xs text-aspectum-text-muted line-clamp-2">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'image_url',
      label: 'Фото',
      render: (url) => (url
        ? <img src={url} alt="" className="w-10 h-10 object-cover rounded-aspectum-compact" />
        : <span className="text-aspectum-text-faint text-xs">—</span>),
    },
    {
      key: 'info_count',
      label: 'Содержимое',
      render: (_, row) => (
        <span className="text-xs text-aspectum-text-subtle">
          блоков {row.info_count} · лента {row.feed_count} · 🎧 {row.audio_guide_count}
        </span>
      ),
    },
    {
      key: 'subscription_count',
      label: 'Связи',
      render: (_, row) => (
        <span className={`text-xs ${row.booking_refs ? 'text-aspectum-danger font-medium' : 'text-aspectum-text-subtle'}`}>
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
                <span key={d.id} className="text-xs text-aspectum-warning-strong bg-aspectum-warning-soft rounded px-1.5 py-0.5">
                  {d.city_display_name} · 🎧 {d.audio_guide_count}
                </span>
              ))}
            </div>
          )
          : <span className="text-aspectum-text-faint text-xs">нет</span>),
      }
      : {
        key: 'archived_at',
        label: 'В корзине с',
        render: (v) => <span className="text-xs text-aspectum-text-subtle">{v ? new Date(v).toLocaleString() : '—'}</span>,
      },
  ];

  return (
    <Layout>
      <PageHeader
        title="События без города и корзина"
        description="Привяжите событие к городу или отправьте в корзину. Из корзины событие можно вернуть или удалить насовсем."
        spacing="sm"
      />

      <Tabs items={TABS} value={tab} onChange={switchTab} className="mb-4" />

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
              <Button type="button" variant="soft" size="sm" disabled={busyId === row.id}
                onClick={() => { setAssignCityId(''); setAssignTarget(row); }}>
                К городу
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={busyId === row.id}
                onClick={() => setArchiveTarget(row)}>
                В корзину
              </Button>
            </>
          )
          : (
            <>
              <Button type="button" variant="soft" size="sm" disabled={busyId === row.id}
                onClick={() => run(row.id, () => orphanEventsAPI.restore(row.id), 'Событие возвращено (скрытым)')}>
                Вернуть
              </Button>
              <Button type="button" variant="softDanger" size="sm"
                disabled={busyId === row.id || row.booking_refs > 0}
                title={row.booking_refs > 0 ? 'Есть связанные бронирования/билеты' : undefined}
                onClick={() => setPurgeTarget(row)}>
                Удалить насовсем
              </Button>
            </>
          ))}
      />

      <Modal
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        title="Привязать к городу"
        footer={(
          <>
            <Button type="button" variant="ghost" size="md" onClick={() => setAssignTarget(null)}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={!assignCityId}
              onClick={async () => {
                const target = assignTarget;
                setAssignTarget(null);
                await run(target.id, () => orphanEventsAPI.assignCity(target.id, assignCityId), 'Событие привязано к городу');
              }}
            >
              Привязать
            </Button>
          </>
        )}
      >
        <p className="mb-3 text-sm text-aspectum-text-subtle">
          «{getMultiLangValue(assignTarget?.title) || assignTarget?.id}»
        </p>
        {assignTarget?.duplicates?.length > 0 && (
          <Alert tone="warning" className="mb-3 text-sm px-3 py-2">
            Событие с таким названием уже есть в городах: {assignTarget.duplicates.map((d) => d.city_display_name).join(', ')}.
            Возможно, это дубль — тогда лучше отправить в корзину.
          </Alert>
        )}
        <Select value={assignCityId} onChange={(evt) => setAssignCityId(evt.target.value)}>
          <option value="">Выберите город</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{getMultiLangValue(c.name) || c.id}</option>
          ))}
        </Select>
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
