import { useCallback, useEffect, useState } from 'react';
import { ilCatalogAPI } from '../../../api/generation';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { getMultiLangValue } from '../shared/i18n';

const PAGE_SIZE = 20;

export default function InteractiveLocationsCatalogPage() {
  const { setMobileActions } = useLayoutActions();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [showFilter, setShowFilter] = useState('');
  const [cities, setCities] = useState([]);

  // collect cities from rows
  useEffect(() => {
    const map = new Map();
    for (const r of rows) {
      if (r.city_id && r.city_name) map.set(r.city_id, r.city_name);
    }
    setCities((prev) => {
      const merged = new Map(prev.map((c) => [c.id, c.name]));
      map.forEach((name, id) => merged.set(id, name));
      return [...merged.entries()].map(([id, name]) => ({ id, name }));
    });
  }, [rows]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const r = await ilCatalogAPI.list({
        page: p, page_size: PAGE_SIZE,
        ...(search ? { search } : {}),
        ...(cityFilter ? { city_id: cityFilter } : {}),
        ...(showFilter ? { is_show: showFilter } : {}),
      });
      const data = r?.data;
      setRows(data?.results || []);
      setTotal(data?.total ?? 0);
      setPage(p);
    } catch (e) {
      setError(parseApiError(e, 'Ошибка загрузки'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, cityFilter, showFilter]);

  useEffect(() => { load(1); setPage(1); }, [search, cityFilter, showFilter]);
  useEffect(() => { load(page); }, [page]);

  useEffect(() => { setMobileActions([]); return () => setMobileActions([]); }, [setMobileActions]);

  const toggleShow = async (row) => {
    const next = !row.is_show;
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, is_show: next } : r));
    try {
      await ilCatalogAPI.update(row.id, { is_show: next });
    } catch {
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, is_show: !next } : r));
    }
  };

  const isFiltered = !!(search || cityFilter || showFilter);

  const columns = [
    {
      key: 'title',
      label: 'Название',
      render: (v, row) => (
        <div className="flex items-center gap-3">
          {row.image_url
            ? <img src={row.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
            : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 shrink-0 text-lg">📍</div>
          }
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{getMultiLangValue(v) || '—'}</p>
            {row.lat != null && (
              <p className="text-xs text-gray-400 font-mono">{Number(row.lat).toFixed(4)}, {Number(row.lon).toFixed(4)}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'city_name',
      label: 'Город',
      render: (v) => <span className="text-sm text-gray-600">{v || '—'}</span>,
    },
    {
      key: 'index',
      label: 'Индекс',
      render: (v) => <span className="text-sm text-gray-500">{v ?? '—'}</span>,
    },
    {
      key: 'is_show',
      label: 'Виден',
      render: (v, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleShow(row); }}
          className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none ${v ? 'bg-blue-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${v ? 'left-4' : 'left-0.5'}`} />
        </button>
      ),
    },
  ];

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Интерактивные локации</h1>
        <p className="mt-1 text-sm text-gray-500">Опубликованные interactive locations из сессий</p>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        isFiltered={isFiltered}
        emptyIcon="📍"
        emptyText="Интерактивных локаций нет"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по названию…"
        page={page}
        totalCount={total}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={(
          <>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Все города</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={showFilter}
              onChange={(e) => setShowFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Любая видимость</option>
              <option value="true">Видимые</option>
              <option value="false">Скрытые</option>
            </select>
          </>
        )}
      />
    </Layout>
  );
}
