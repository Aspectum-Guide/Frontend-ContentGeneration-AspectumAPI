import { useCallback, useEffect, useState } from 'react';
import { codeUsageLogsAPI } from '../../../api/subscription';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import StatusBadge from '../shared/components/StatusBadge';
import { formatDateTime } from './subscriptionLabels';

const PAGE_SIZE = 20;

export default function CodeUsageLogsCatalogPage() {
  const { setMobileActions } = useLayoutActions();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadItems = useCallback(async (paramsState) => {
    const state = paramsState || { search, successFilter, page };
    try {
      setLoading(true);
      setError(null);
      const response = await codeUsageLogsAPI.list({
        search: state.search || undefined,
        success: state.successFilter === 'success'
          ? 'true'
          : state.successFilter === 'failed'
            ? 'false'
            : undefined,
        page: state.page,
        page_size: PAGE_SIZE,
        ordering: '-used_at',
      });
      const data = response?.data;
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(list);
      setTotalCount(data?.count ?? list.length);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки логов активации'));
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [search, successFilter, page]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadItems({ search, successFilter, page: 1 });
    }, 350);
    return () => clearTimeout(timer);
  }, [search, successFilter, loadItems]);

  useEffect(() => {
    setMobileActions([]);
    return () => setMobileActions([]);
  }, [setMobileActions]);

  const columns = [
    {
      key: 'used_at',
      label: 'Когда',
      render: (v) => <span className="text-sm text-gray-700">{formatDateTime(v)}</span>,
    },
    {
      key: 'activation_code_value',
      label: 'Код',
      render: (v) => <span className="font-mono text-xs text-gray-800">{v || '—'}</span>,
    },
    {
      key: 'subscription_type_name',
      label: 'Тип подписки',
      render: (v) => <span className="text-sm text-gray-700">{v || '—'}</span>,
    },
    {
      key: 'success',
      label: 'Результат',
      render: (v) => (
        <StatusBadge
          active={!!v}
          activeLabel="Успех"
          inactiveLabel="Ошибка"
          inactiveTone="red"
        />
      ),
    },
    {
      key: 'user_info',
      label: 'Пользователь / контекст',
      render: (v) => <span className="text-xs text-gray-600 break-all">{v || '—'}</span>,
    },
    {
      key: 'notes',
      label: 'Заметки',
      render: (v) => <span className="text-xs text-gray-600">{v || '—'}</span>,
    },
  ];

  return (
    <Layout>
      <CatalogPageHeader
        title="Логи активации кодов"
        description="Read-only журнал использования activation codes. Заменяет Django admin → Code usage logs."
      />

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        error={error}
        emptyIcon="📜"
        isFiltered={!!(search || successFilter)}
        emptyText="Логов пока нет"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по коду, user_info, notes..."
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={(
          <select
            value={successFilter}
            onChange={(e) => setSuccessFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Любой результат</option>
            <option value="success">Только успешные</option>
            <option value="failed">Только ошибки</option>
          </select>
        )}
      />
    </Layout>
  );
}
