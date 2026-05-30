import { useEffect, useState } from 'react';
import { bookingAnalyticsAPI } from '../../../api/booking';
import Layout from '../../../components/Layout';
import { useEventOptions } from '../shared/bookingOptions';
import { getMultiLangValue } from '../shared/i18n';
import { parseApiError } from '../../../utils/apiError';

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

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

  const currency = data?.by_event?.[0]?.currency || 'EUR';

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Аналитика бронирований</h1>
          <p className="mt-1 text-sm text-gray-500">Только подтверждённые резервации</p>
        </div>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className={`px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${eventsLoading ? 'opacity-60' : ''}`}
          disabled={eventsLoading}
        >
          <option value="">{eventsLoading ? 'Загрузка…' : 'Все события'}</option>
          {eventOptions.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {getMultiLangValue(ev.title) || ev.id}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
          <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
          Загрузка...
        </div>
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
              <h2 className="text-sm font-semibold text-gray-700 mb-2">По типу билета</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Тип</th>
                      <th className="px-4 py-2 text-left">Код</th>
                      <th className="px-4 py-2 text-right">Резерваций</th>
                      <th className="px-4 py-2 text-right">Билетов</th>
                      <th className="px-4 py-2 text-right">Выручка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.by_code.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800">{row.name_primary || '—'}</td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-400">{row.code || '—'}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{row.reservations}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{row.qty}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900">
                          {Number(row.revenue).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* По ивентам */}
          {data.by_event?.length > 0 && !eventFilter && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">По событиям</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Событие</th>
                      <th className="px-4 py-2 text-right">Резерваций</th>
                      <th className="px-4 py-2 text-right">Билетов</th>
                      <th className="px-4 py-2 text-right">Выручка</th>
                      <th className="px-4 py-2 text-left">Валюта</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.by_event.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800">
                          {getMultiLangValue(
                            typeof row.event__title === 'string'
                              ? (() => { try { return JSON.parse(row.event__title); } catch { return {}; } })()
                              : row.event__title
                          ) || row.event_id}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">{row.reservations}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{row.qty}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900">
                          {Number(row.revenue).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-400">{row.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.total_reservations === 0 && (
            <div className="text-center py-12 text-sm text-gray-400">
              Подтверждённых бронирований пока нет
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
