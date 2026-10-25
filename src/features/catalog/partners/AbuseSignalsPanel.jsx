import { useEffect, useState } from 'react';
import { activationCodesAPI } from '../../../api/subscription';
import { parseApiError } from '../../../utils/apiError';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import { formatDate } from './partnerFormat';

// Признаки злоупотреблений кодами: само по себе не нарушение, а повод
// посмотреть. Если это злоупотребление — выключите код или партию.
export default function AbuseSignalsPanel({ partnerId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await activationCodesAPI.abuseSignals(partnerId ? { partner: partnerId } : undefined);
        if (!cancelled) setData(response.data);
      } catch (err) {
        if (!cancelled) setError(parseApiError(err, 'Не удалось загрузить сигналы'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partnerId]);

  const devices = data?.devices || [];
  const spikes = data?.codes || [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="text-sm font-medium text-gray-800">Подозрительная активность</div>
      <p className="text-xs text-gray-500">
        Устройства, с которых коды активировали три и больше аккаунта за {data?.days ?? 30} дней, и коды, у которых
        за сутки активаций втрое больше обычного. Многоразовый код на одном устройстве и так активируется один раз.
      </p>
      <FormErrorAlert message={error} />
      {data && devices.length === 0 && spikes.length === 0 ? (
        <p className="text-sm text-gray-400">Ничего подозрительного.</p>
      ) : null}

      {devices.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="text-xs font-medium text-gray-600 mb-1">Устройства с несколькими аккаунтами</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-3">Устройство</th>
                <th className="py-1 pr-3">Аккаунтов</th>
                <th className="py-1 pr-3">Активаций</th>
                <th className="py-1 pr-3">Коды</th>
                <th className="py-1">Последняя</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((row) => (
                <tr key={row.device} className="border-t border-gray-100">
                  <td className="py-1 pr-3 font-mono text-xs">{row.device}</td>
                  <td className="py-1 pr-3 text-amber-800 font-medium">{row.accounts}</td>
                  <td className="py-1 pr-3">{row.activations}</td>
                  <td className="py-1 pr-3 font-mono text-xs">{row.codes.join(', ')}</td>
                  <td className="py-1">{formatDate(row.last_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {spikes.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="text-xs font-medium text-gray-600 mb-1">Всплески активаций</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-3">Код</th>
                <th className="py-1 pr-3">Партнёр</th>
                <th className="py-1 pr-3">За сутки</th>
                <th className="py-1">Обычно в день</th>
              </tr>
            </thead>
            <tbody>
              {spikes.map((row) => (
                <tr key={row.code_id} className="border-t border-gray-100">
                  <td className="py-1 pr-3 font-mono text-xs">{row.code}</td>
                  <td className="py-1 pr-3">{row.partner_name || '—'}</td>
                  <td className="py-1 pr-3 text-amber-800 font-medium">{row.last_24h}</td>
                  <td className="py-1">{row.daily_avg_before}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
