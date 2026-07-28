import { useCallback, useEffect, useState } from 'react';
import { citySubscriptionsAPI } from '../../../api/subscription';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import StatusBadge from '../shared/components/StatusBadge';
import { formatDateTime, getCityLabel } from './subscriptionLabels';

const PAGE_SIZE = 20;

export default function CitySubscriptionsCatalogPage() {
  const { setMobileActions } = useLayoutActions();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadItems = useCallback(async (paramsState) => {
    const state = paramsState || { search, statusFilter, page };
    try {
      setLoading(true);
      setError(null);
      const response = await citySubscriptionsAPI.list({
        search: state.search || undefined,
        user_email: state.search || undefined,
        is_active: state.statusFilter === 'active'
          ? 'true'
          : state.statusFilter === 'inactive'
            ? 'false'
            : undefined,
        page: state.page,
        page_size: PAGE_SIZE,
        ordering: '-created_at',
      });
      const data = response?.data;
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(list);
      setTotalCount(data?.count ?? list.length);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки подписок на города'));
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadItems({ search, statusFilter, page: 1 });
    }, 350);
    return () => clearTimeout(timer);
  }, [search, statusFilter, loadItems]);

  useEffect(() => {
    setMobileActions([]);
    return () => setMobileActions([]);
  }, [setMobileActions]);

  const toggleActive = async (row) => {
    try {
      await citySubscriptionsAPI.update(row.id, { is_active: !row.is_active });
      await loadItems();
    } catch (err) {
      setError(parseApiError(err, 'Ошибка обновления подписки'));
    }
  };

  const columns = [
    {
      key: 'user_email',
      label: 'Пользователь',
      render: (v) => <span className="text-sm text-gray-800">{v || '—'}</span>,
    },
    {
      key: 'city_name',
      label: 'Город',
      render: (v) => <span className="text-sm text-gray-700">{getCityLabel({ name: v, city_name: v }) || '—'}</span>,
    },
    {
      key: 'subscription_type_name',
      label: 'Тип',
      render: (v) => <span className="text-sm text-gray-700">{v || '—'}</span>,
    },
    {
      key: 'activation_method',
      label: 'Метод',
      render: (v) => <span className="text-xs font-mono text-gray-600">{v || '—'}</span>,
    },
    {
      key: 'is_active',
      label: 'Статус',
      render: (v) => (
        <StatusBadge active={!!v} activeLabel="Активна" inactiveLabel="Отключена" />
      ),
    },
    {
      key: 'created_at',
      label: 'Создана',
      render: (v) => <span className="text-sm text-gray-600">{formatDateTime(v)}</span>,
    },
  ];

  return (
    <Layout>
      <CatalogPageHeader
        title="Все подписки на города"
        description="Глобальный список CitySubscription. Для выдачи доступа конкретному пользователю используйте «Подписки пользователей»."
      />

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        error={error}
        emptyIcon="🏙️"
        isFiltered={!!(search || statusFilter)}
        emptyText="Подписок пока нет"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по email, методу активации..."
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={(
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Любой статус</option>
            <option value="active">Активные</option>
            <option value="inactive">Отключенные</option>
          </select>
        )}
        actions={(row) => (
          <button
            type="button"
            onClick={() => void toggleActive(row)}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
          >
            {row.is_active ? 'Отключить' : 'Включить'}
          </button>
        )}
      />
    </Layout>
  );
}
