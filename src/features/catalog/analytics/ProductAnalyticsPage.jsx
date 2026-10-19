import { useEffect, useMemo, useState } from 'react';
import { productAnalyticsAPI } from '../../../api/analytics';
import Layout from '../../../components/Layout';
import { parseApiError } from '../../../utils/apiError';
import { TextInput, Select, Alert, DataTable, EmptyState, MetricCard, PageHeader, SectionHeader, Spinner } from '@aspectum/ui';

function toInputDate(d) {
  return d.toISOString().slice(0, 10);
}

export default function ProductAnalyticsPage() {
  const defaults = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 29);
    return { from: toInputDate(from), to: toInputDate(to) };
  }, []);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [brand, setBrand] = useState('');
  const [platform, setPlatform] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { from, to };
      if (brand) params.brand = brand;
      if (platform) params.platform = platform;
      const r = await productAnalyticsAPI.summary(params);
      setData(r?.data);
    } catch (e) {
      setError(parseApiError(e, 'Ошибка загрузки продуктовой аналитики'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, brand, platform]);

  return (
    <Layout>
      <PageHeader
        title="Продуктовая аналитика"
        description="События приложения: экраны, карта, аудио, booking, paywall"
        className="flex-wrap"
        actions={(
          <>
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Select value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Все бренды</option>
            <option value="aspectum">aspectum</option>
            <option value="aspectum-rus">aspectum-rus</option>
          </Select>
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">Все платформы</option>
            <option value="ios">ios</option>
            <option value="android">android</option>
          </Select>
          </>
        )}
      />

      {error && (
        <Alert tone="error" className="mb-4">{error}</Alert>
      )}

      {loading ? (
        <EmptyState icon={<Spinner size="sm" className="border-aspectum-focus" />} title="Загрузка..." spacing="md" />
      ) : data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Событий" value={data.total_events ?? 0} />
            <MetricCard label="Типов событий" value={data.by_event?.length ?? 0} />
            <MetricCard label="Дней с данными" value={data.by_day?.length ?? 0} />
            <MetricCard
              label="Источник"
              value={data.source === 'rollup' ? 'rollup' : 'raw'}
              sub={`${data.from} → ${data.to}`}
            />
          </div>

          {data.by_event?.length > 0 && (
            <div>
              <SectionHeader title="По событию" size="xs" className="mb-2" />
              <DataTable
                rows={data.by_event}
                columns={[
                  { key: 'event_name', label: 'Event', className: 'font-mono text-xs text-aspectum-text-emphasis' },
                  { key: 'count', label: 'Count', className: 'text-right font-medium text-aspectum-text', headerClass: 'text-right' },
                ]}
              />
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {data.by_brand?.length > 0 && (
              <div>
                <SectionHeader title="По бренду" size="xs" className="mb-2" />
                <DataTable
                  rows={data.by_brand}
                  columns={[
                    { key: 'brand', label: 'Brand', className: 'text-aspectum-text-emphasis' },
                    { key: 'count', label: 'Count', className: 'text-right', headerClass: 'text-right' },
                  ]}
                />
              </div>
            )}

            {data.by_platform?.length > 0 && (
              <div>
                <SectionHeader title="По платформе" size="xs" className="mb-2" />
                <DataTable
                  rows={data.by_platform}
                  columns={[
                    { key: 'platform', label: 'Platform', className: 'text-aspectum-text-emphasis' },
                    { key: 'count', label: 'Count', className: 'text-right', headerClass: 'text-right' },
                  ]}
                />
              </div>
            )}
          </div>

          {data.by_day?.length > 0 && (
            <div>
              <SectionHeader title="По дням" size="xs" className="mb-2" />
              <DataTable
                rows={data.by_day}
                columns={[
                  { key: 'day', label: 'Day', className: 'text-aspectum-text-emphasis' },
                  { key: 'count', label: 'Count', className: 'text-right', headerClass: 'text-right' },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
