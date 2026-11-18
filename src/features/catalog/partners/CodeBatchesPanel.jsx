import { useCallback, useEffect, useState } from 'react';
import { codeBatchesAPI } from '../../../api/subscription';
import { parseApiError } from '../../../utils/apiError';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import { downloadBatchXlsx } from './batchDownload';
import { formatDate } from './partnerFormat';
import { PARTNER_LANGS } from './partnerLangs';

const SMALL_BUTTON = 'px-2.5 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50';

function usage(batch) {
  const multiUse = batch.max_uses_per_code === null || batch.max_uses_per_code > 1;
  const base = `${batch.activated_codes} из ${batch.quantity}`;
  return multiUse ? `${base} · активаций ${batch.activations}` : base;
}

// Партии кодов: сколько выпущено и активировано, выгрузка для печати и
// выключение потерянной пачки — её коды сразу перестают активироваться.
export default function CodeBatchesPanel({ partnerId, refreshKey, title = 'Партии карточек' }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  // Язык Excel: для зарубежного партнёра и его типографии — не русский.
  const [excelLang, setExcelLang] = useState('ru');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await codeBatchesAPI.list(partnerId ? { partner: partnerId } : undefined);
      const data = response?.data;
      setBatches(Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось загрузить партии'));
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const exportBatch = async (batch) => {
    try {
      setBusyId(batch.id);
      setError(null);
      await downloadBatchXlsx(batch.id, excelLang);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось выгрузить партию'));
    } finally {
      setBusyId(null);
    }
  };

  const toggleBatch = async (batch) => {
    if (
      batch.is_active &&
      !window.confirm(
        `Выключить партию «${batch.name}»? Её коды сразу перестанут активироваться. Уже открытые города у людей останутся. Включить партию обратно можно в любой момент.`,
      )
    ) {
      return;
    }
    try {
      setBusyId(batch.id);
      setError(null);
      if (batch.is_active) {
        await codeBatchesAPI.deactivate(batch.id);
      } else {
        await codeBatchesAPI.reactivate(batch.id);
      }
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Не удалось изменить партию'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 overflow-x-auto space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-gray-800">
          {title} ({batches.length})
        </div>
        {batches.length > 0 ? (
          <label className="flex items-center gap-2 text-xs text-gray-600">
            Язык Excel
            <select
              value={excelLang}
              onChange={(e) => setExcelLang(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-md text-xs"
            >
              {PARTNER_LANGS.map((lang) => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <FormErrorAlert message={error} />
      {loading && batches.length === 0 ? <p className="text-sm text-gray-400">Загрузка…</p> : null}
      {!loading && batches.length === 0 ? <p className="text-sm text-gray-400">Партий пока нет.</p> : null}
      {batches.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-3">Партия</th>
              <th className="py-1 pr-3">Что открывает</th>
              <th className="py-1 pr-3">Активировано</th>
              <th className="py-1 pr-3">Действует до</th>
              <th className="py-1 pr-3">Статус</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id} className="border-t border-gray-100 align-top">
                <td className="py-1.5 pr-3">
                  <div className="font-medium text-gray-900">{batch.name}</div>
                  <div className="text-xs text-gray-500">
                    {formatDate(batch.created_at)} · {batch.quantity} шт.
                    {!partnerId && batch.partner_name ? ` · ${batch.partner_name}` : ''}
                  </div>
                </td>
                <td className="py-1.5 pr-3">
                  {batch.subscription_type_name}
                  {batch.access_mode === 'choose_city' && !/на выбор/i.test(batch.subscription_type_name || '')
                    ? ' (город на выбор)'
                    : ''}
                </td>
                <td className="py-1.5 pr-3">{usage(batch)}</td>
                <td className="py-1.5 pr-3">{batch.expiry_date ? formatDate(batch.expiry_date) : 'бессрочно'}</td>
                <td className="py-1.5 pr-3">
                  {batch.is_active ? (
                    <span className="text-green-700">активна</span>
                  ) : (
                    <span className="text-red-600">выключена</span>
                  )}
                </td>
                <td className="py-1.5 whitespace-nowrap text-right space-x-2">
                  <button type="button" className={SMALL_BUTTON} disabled={busyId === batch.id} onClick={() => exportBatch(batch)}>
                    Excel
                  </button>
                  <button type="button" className={SMALL_BUTTON} disabled={busyId === batch.id} onClick={() => toggleBatch(batch)}>
                    {batch.is_active ? 'Выключить' : 'Включить'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
