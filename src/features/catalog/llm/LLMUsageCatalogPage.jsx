import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { parseApiError } from '../../../utils/apiError';
import { llmAPI } from '../../../api/llm';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';

const PAGE_SIZES = [10, 20, 50];

function parseModelKey(modelKey) {
  // modelKey format: "<provider>/<model>"
  if (typeof modelKey !== 'string') return { provider: '—', model: modelKey };
  const [provider, ...rest] = modelKey.split('/');
  return { provider: provider || '—', model: rest.join('/') || '—' };
}

export default function LLMUsageCatalogPage() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [summary, setSummary] = useState(null);

  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await llmAPI.usage.summary({ days });
      setSummary(resp?.data ?? resp ?? null);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки usage'));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const providerOptions = useMemo(() => {
    const byModel = summary?.by_model || {};
    const set = new Set();
    for (const modelKey of Object.keys(byModel)) {
      const { provider } = parseModelKey(modelKey);
      if (provider && provider !== '—') set.add(provider);
    }
    return Array.from(set).sort();
  }, [summary]);

  const rows = useMemo(() => {
    const byModel = summary?.by_model || {};
    const entries = Object.entries(byModel).map(([modelKey, v]) => {
      const { provider, model } = parseModelKey(modelKey);
      return {
        id: modelKey,
        provider,
        model,
        cost_usd: v?.cost ?? '0',
        tokens: v?.tokens ?? 0,
        requests: v?.requests ?? 0,
      };
    });

    let filtered = entries;
    const q = (search || '').trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((r) => `${r.provider}/${r.model}`.toLowerCase().includes(q));
    }
    if (providerFilter) {
      filtered = filtered.filter((r) => r.provider === providerFilter);
    }

    // Сортировка по стоимости убыв.
    filtered.sort((a, b) => Number(b.cost_usd || 0) - Number(a.cost_usd || 0));
    return filtered;
  }, [summary, search, providerFilter]);

  const columns = useMemo(
    () => [
      {
        key: 'model',
        label: 'Модель',
        render: (value, row) => (
          <span className="text-sm font-medium text-gray-900">
            <span className="text-gray-500 font-normal">{row.provider}/</span>
            {value || '—'}
          </span>
        ),
      },
      {
        key: 'tokens',
        label: 'Токены',
        render: (v) => <span className="text-sm text-gray-700">{v ?? 0}</span>,
      },
      {
        key: 'requests',
        label: 'Запросы',
        render: (v) => <span className="text-sm text-gray-700">{v ?? 0}</span>,
      },
      {
        key: 'cost_usd',
        label: 'Стоимость (USD)',
        render: (v) => <span className="text-sm text-gray-700 font-mono">{v ?? '0'}</span>,
      },
    ],
    []
  );

  return (
    <Layout>
      <CatalogPageHeader
        title="Использование моделей (LLMAPI)"
        description="Показывает tokens/requests и стоимость по моделям за последние N дней."
      />

      {/* Controls */}
      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Период:</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {[7, 30, 90].map((d) => (
                <option key={d} value={d}>
                  {d} дней
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Провайдер:</span>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Все</option>
              {providerOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Всего cost</div>
            <div className="text-lg font-bold text-gray-900 mt-1 font-mono">{summary?.total_cost_usd ?? (loading ? '—' : '0')}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Всего tokens</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{summary?.total_tokens ?? (loading ? '—' : 0)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Всего requests</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{summary?.total_requests ?? (loading ? '—' : 0)}</div>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        emptyIcon="📈"
        emptyText="Нет данных по моделям за выбранный период"
        isFiltered={!!(search || providerFilter)}
        page={1}
        totalCount={rows.length}
        pageSize={PAGE_SIZES[0]}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по модели (provider/model)..."
        actions={null}
      />
    </Layout>
  );
}

