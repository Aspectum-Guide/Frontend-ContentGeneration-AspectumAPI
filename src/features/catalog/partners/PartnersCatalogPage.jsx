import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { partnersAdminAPI } from '../../../api/partners';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import PartnerFormModal from './PartnerFormModal';
import { PARTNER_STATUSES } from './partnerFormat';

function statusLabel(value) {
  return PARTNER_STATUSES.find((item) => item.value === value)?.label || value;
}

export default function PartnersCatalogPage() {
  const navigate = useNavigate();
  const { setMobileActions } = useLayoutActions();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await partnersAdminAPI.list();
      const data = response?.data;
      setItems(Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось загрузить партнёров'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setMobileActions([{ id: 'create-partner', label: 'Новый партнёр', onClick: () => setCreating(true), variant: 'primary' }]);
    return () => setMobileActions([]);
  }, [setMobileActions]);

  const needle = search.trim().toLowerCase();
  const rows = needle
    ? items.filter((item) => [item.name, item.legal_name, item.inn, item.contact_email]
      .some((value) => (value || '').toLowerCase().includes(needle)))
    : items;

  const columns = [
    { key: 'name', label: 'Партнёр', render: (value) => <span className="text-sm font-medium text-gray-900">{value}</span> },
    {
      key: 'status',
      label: 'Статус',
      render: (value) => (
        <span className={`text-xs px-2 py-0.5 rounded-full ${value === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
          {statusLabel(value)}
        </span>
      ),
    },
    {
      key: 'commission_percent',
      label: 'Комиссия',
      render: (value) => <span className="text-sm text-gray-700">{value ? `${String(value).replace('.', ',')} %` : 'не задана'}</span>,
    },
    { key: 'attribution_months', label: 'Срок, мес.', render: (value) => <span className="text-sm text-gray-700">{value}</span> },
    { key: 'clients_count', label: 'Клиентов', render: (value) => <span className="text-sm text-gray-700">{value ?? 0}</span> },
    { key: 'codes_count', label: 'Кодов', render: (value) => <span className="text-sm text-gray-700">{value ?? 0}</span> },
    {
      key: 'members',
      label: 'Доступ к кабинету',
      render: (value) => {
        const members = Array.isArray(value) ? value : [];
        const active = members.filter((member) => member.status === 'active').length;
        const invited = members.filter((member) => member.status === 'invited').length;
        if (!active && !invited) return <span className="text-sm text-gray-400">никого</span>;
        return <span className="text-sm text-gray-700">{active} есть{invited ? `, ${invited} ждут` : ''}</span>;
      },
    },
  ];

  return (
    <Layout>
      <CatalogPageHeader
        title="Партнёры"
        description="Партнёры раздают коды; клиенты, активировавшие их, закрепляются за партнёром, а их покупки идут в реестр с комиссией"
        createLabel="Новый партнёр"
        onCreate={() => setCreating(true)}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        emptyIcon="🤝"
        isFiltered={!!needle}
        emptyText="Партнёров пока нет"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Название, юр. название, ИНН, почта..."
        onRowClick={(row) => navigate(`/catalog/partners/${row.id}`)}
      />

      <PartnerFormModal
        open={creating}
        partner={null}
        onClose={() => setCreating(false)}
        onSaved={(saved) => {
          setCreating(false);
          navigate(`/catalog/partners/${saved.id}`);
        }}
      />
    </Layout>
  );
}
