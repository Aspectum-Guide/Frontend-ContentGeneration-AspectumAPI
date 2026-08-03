import { useEffect, useMemo, useState } from 'react';
import { productAnalyticsAPI } from '../../../api/analytics';
import Layout from '../../../components/Layout';
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
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Продуктовая аналитика</h1>
          <p className="mt-1 text-sm text-gray-500">
            События приложения: экраны, карта, аудио, booking, paywall
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Все бренды</option>
            <option value="aspectum">aspectum</option>
            <option value="aspectum-rus">aspectum-rus</option>
          </select>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Все платформы</option>
            <option value="ios">ios</option>
            <option value="android">android</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
          <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
          Загрузка...
        </div>
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
              <h2 className="text-sm font-semibold text-gray-700 mb-2">По событию</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Event</th>
                      <th className="px-4 py-2 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.by_event.map((row) => (
                      <tr key={row.event_name} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-xs text-gray-800">{row.event_name}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {data.by_brand?.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-2">По бренду</h2>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Brand</th>
                        <th className="px-4 py-2 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.by_brand.map((row) => (
                        <tr key={row.brand || '—'} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-800">{row.brand || '—'}</td>
                          <td className="px-4 py-2 text-right">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.by_platform?.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-2">По платформе</h2>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Platform</th>
                        <th className="px-4 py-2 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.by_platform.map((row) => (
                        <tr key={row.platform || '—'} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-800">{row.platform || '—'}</td>
                          <td className="px-4 py-2 text-right">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {data.by_day?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">По дням</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Day</th>
                      <th className="px-4 py-2 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.by_day.map((row) => (
                      <tr key={row.day} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-800">{row.day}</td>
                        <td className="px-4 py-2 text-right">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
