import { useCallback, useEffect, useState } from 'react';
import { iapPurchasesAdminAPI } from '../../../api/subscription';
import Layout from '../../../components/Layout';
import { Button, TextInput, Select, PageHeader, DataTable, RawJsonModal } from '@aspectum/admin-ui-web';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { formatDateTime } from './subscriptionLabels';

const PAGE_SIZE = 20;

export default function IAPPurchasesCatalogPage() {
  const { setMobileActions } = useLayoutActions();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [savingId, setSavingId] = useState(null);
  const [rawTarget, setRawTarget] = useState(null);
  const [rawLoading, setRawLoading] = useState(false);

  const loadItems = useCallback(async (paramsState) => {
    const state = paramsState || { search, statusFilter, page };
    try {
      setLoading(true);
      setError(null);
      const response = await iapPurchasesAdminAPI.list({
        search: state.search || undefined,
        status: state.statusFilter || undefined,
        page: state.page,
        page_size: PAGE_SIZE,
        ordering: '-purchased_at',
      });
      const data = response?.data;
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(list);
      setTotalCount(data?.count ?? list.length);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки IAP покупок'));
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

  const handleUpdate = async (row, patch) => {
    try {
      setSavingId(row.id);
      await iapPurchasesAdminAPI.update(row.id, patch);
      await loadItems();
    } catch (err) {
      setError(parseApiError(err, 'Ошибка обновления IAP'));
    } finally {
      setSavingId(null);
    }
  };

  const openRawResponse = async (row) => {
    setRawLoading(true);
    try {
      const r = await iapPurchasesAdminAPI.get(row.id);
      setRawTarget(r?.data || row);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки raw_response'));
    } finally {
      setRawLoading(false);
    }
  };

  const columns = [
    {
      key: 'user_email',
      label: 'Пользователь',
      render: (v) => <span className="text-sm text-aspectum-text-emphasis">{v || '—'}</span>,
    },
    {
      key: 'product_id',
      label: 'Product ID',
      render: (v) => <span className="text-sm font-mono text-aspectum-text-emphasis">{v}</span>,
    },
    {
      key: 'platform',
      label: 'Платформа',
      render: (v) => <span className="text-sm text-aspectum-text-strong">{v}</span>,
    },
    {
      key: 'status',
      label: 'Статус',
      render: (v, row) => (
        <Select value={v} disabled={savingId === row.id} onChange={(e) => void handleUpdate(row, { status: e.target.value })}
        >
          <option value="active">active</option>
          <option value="expired">expired</option>
          <option value="refunded">refunded</option>
        </Select>
      ),
    },
    {
      key: 'expires_at',
      label: 'Истекает',
      render: (v, row) => (
        <TextInput type="datetime-local" defaultValue={v ? new Date(v).toISOString().slice(0, 16) : ''} disabled={savingId === row.id} onBlur={(e) => {
            const next = e.target.value ? new Date(e.target.value).toISOString() : null;
            const prev = v ? new Date(v).toISOString() : null;
            if (next !== prev) {
              void handleUpdate(row, { expires_at: next });
            }
          }}
        />
      ),
    },
    {
      key: 'purchased_at',
      label: 'Куплено',
      render: (v) => <span className="text-sm text-aspectum-text-subtle">{formatDateTime(v)}</span>,
    },
    {
      key: 'raw_response',
      label: 'Raw',
      render: (_, row) => (
        <Button
          type="button"
          onClick={() => openRawResponse(row)}
          disabled={rawLoading}
          variant="soft"
          size="sm"
        >
          JSON
        </Button>
      ),
    },
  ];

  return (
    <Layout>
      <PageHeader
        title="IAP покупки"
        description="Store purchases (Apple/Google). Правка status/expires_at для support и premium entitlement."
      />

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        error={error}
        emptyIcon="🛒"
        isFiltered={!!(search || statusFilter)}
        emptyText="IAP покупок пока нет"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по email, product_id, transaction..."
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={(
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Любой статус</option>
            <option value="active">active</option>
            <option value="expired">expired</option>
            <option value="refunded">refunded</option>
          </Select>
        )}
      />

      <RawJsonModal
        open={!!rawTarget}
        onClose={() => setRawTarget(null)}
        title={`raw_response — ${rawTarget?.product_id || ''}`}
        data={rawTarget?.raw_response}
      />
    </Layout>
  );
}
