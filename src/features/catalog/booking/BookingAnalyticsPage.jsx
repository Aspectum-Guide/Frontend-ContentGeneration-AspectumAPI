import { useEffect, useState } from 'react';
import { bookingAnalyticsAPI } from '../../../api/booking';
import Layout from '../../../components/Layout';
import { useEventOptions } from '../shared/bookingOptions';
import EventSelect from '../shared/components/EventSelect';
import { DEFAULT_CURRENCY, normalizeCurrency } from '../shared/currencies';
import { getMultiLangValue } from '../shared/i18n';
import { parseApiError } from '../../../utils/apiError';
import { Alert, DataTable, EmptyState, MetricCard, PageHeader, SectionHeader, Spinner } from '@aspectum/admin-ui-web';

export default function BookingAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventFilter, setEventFilter] = useState('');

  const { eventOptions, eventsLoading } = useEventOptions();

  const load = async (evId) => {
    setLoading(true);
    setError(null);
    try {
      const params = evId ? { event: evId } : {};
      const r = await bookingAnalyticsAPI.summary(params);
      setData(r?.data);
    } catch (e) {
      setError(parseApiError(e, 'Ошибка загрузки аналитики'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(eventFilter); }, [eventFilter]);

  const currency = normalizeCurrency(data?.by_event?.[0]?.currency || DEFAULT_CURRENCY);

  return (
    <Layout>
      <PageHeader
        title="Аналитика бронирований"
        description="Только подтверждённые резервации"
        className="flex-wrap"
        actions={<EventSelect
          value={eventFilter}
          onChange={setEventFilter}
          options={eventOptions}
          disabled={eventsLoading}
          placeholder={eventsLoading ? 'Загрузка…' : 'Все события'}
          className={eventsLoading ? 'opacity-60 cursor-wait' : undefined}
        />}
      />

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      {loading ? (
        <EmptyState icon={<Spinner className="border-aspectum-focus" />} title="Загрузка..." spacing="md" />
      ) : data && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard
              label="Резерваций"
              value={data.total_reservations ?? 0}
            />
            <MetricCard
              label="Билетов продано"
              value={data.total_qty ?? 0}
            />
            <MetricCard
              label="Выручка"
              value={`${Number(data.total_revenue ?? 0).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${currency}`}
            />
          </div>

          {/* По коду типа билета */}
          {data.by_code?.length > 0 && (
            <div>
              <SectionHeader title="По типу билета" size="xs" className="mb-2" />
              <DataTable
                rows={data.by_code}
                columns={[
                  { key: 'code', label: 'Тип', className: 'font-medium text-aspectum-text-emphasis' },
                  { key: 'code', label: 'Код', className: 'font-mono text-xs text-aspectum-text-disabled' },
                  { key: 'reservations', label: 'Резерваций', className: 'text-right text-aspectum-text-strong', headerClass: 'text-right' },
                  { key: 'qty', label: 'Билетов', className: 'text-right text-aspectum-text-strong', headerClass: 'text-right' },
                  {
                    key: 'revenue',
                    label: 'Выручка',
                    className: 'text-right font-medium text-aspectum-text',
                    headerClass: 'text-right',
                    render: (value) => Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2 }),
                  },
                ]}
              />
            </div>
          )}

          {/* По ивентам */}
          {data.by_event?.length > 0 && !eventFilter && (
            <div>
              <SectionHeader title="По событиям" size="xs" className="mb-2" />
              <DataTable
                rows={data.by_event}
                columns={[
                  {
                    key: 'event__title',
                    label: 'Событие',
                    className: 'font-medium text-aspectum-text-emphasis',
                    render: (value, row) => getMultiLangValue(
                      typeof value === 'string'
                        ? (() => { try { return JSON.parse(value); } catch { return {}; } })()
                        : value,
                    ) || row.event_id,
                  },
                  { key: 'reservations', label: 'Резерваций', className: 'text-right text-aspectum-text-strong', headerClass: 'text-right' },
                  { key: 'qty', label: 'Билетов', className: 'text-right text-aspectum-text-strong', headerClass: 'text-right' },
                  {
                    key: 'revenue',
                    label: 'Выручка',
                    className: 'text-right font-medium text-aspectum-text',
                    headerClass: 'text-right',
                    render: (value) => Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2 }),
                  },
                  { key: 'currency', label: 'Валюта', className: 'text-xs text-aspectum-text-disabled' },
                ]}
              />
            </div>
          )}

          {data.total_reservations === 0 && (
            <EmptyState icon="🎟️" title="Подтверждённых бронирований пока нет" />
          )}
        </div>
      )}
    </Layout>
  );
}
