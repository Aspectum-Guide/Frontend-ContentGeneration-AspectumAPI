import { useEffect, useMemo, useState } from 'react';
import { eventsAPI } from '../../../api/generation';
import { partnersAdminAPI } from '../../../api/partners';
import { parseApiError } from '../../../utils/apiError';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import { formatDate, pickTitle } from './partnerFormat';

const SMALL_BUTTON = 'px-2.5 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50';
const SMALL_PRIMARY = 'px-2.5 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50';

/**
 * Экскурсии партнёра. Только по ним его сотрудники видят бронирования и гостей в
 * приложении «Аспектум Партнёр» (и на сайте /partner) и отмечают прибытие по
 * QR-билету. Привязывают наши сотрудники: поиск по каталогу и одна кнопка.
 */
export default function PartnerEventsTab({ partner, onChanged }) {
  const links = useMemo(() => partner.events || [], [partner.events]);
  const linkedIds = useMemo(() => new Set(links.map((link) => link.event_id)), [links]);
  const [search, setSearch] = useState('');
  const [onlyBookable, setOnlyBookable] = useState(true);
  const [found, setFound] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  // Поиск по каталогу с задержкой: не дёргаем сервер на каждую букву.
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const response = await eventsAPI.list({
          search: query,
          page_size: 20,
          ...(onlyBookable ? { is_bookable: true } : {}),
        });
        if (!cancelled) setFound(response.data?.events || []);
      } catch (err) {
        if (!cancelled) setError(parseApiError(err, 'Не удалось выполнить поиск экскурсий'));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, onlyBookable]);

  const results = search.trim().length < 2 ? [] : found;

  const link = async (event) => {
    try {
      setBusyId(event.id);
      setError(null);
      await partnersAdminAPI.addEvent(partner.id, event.id);
      onChanged();
    } catch (err) {
      setError(parseApiError(err, 'Не удалось привязать экскурсию'));
    } finally {
      setBusyId(null);
    }
  };

  const unlink = async (row) => {
    if (!window.confirm(`Отвязать экскурсию «${pickTitle(row.title)}» от партнёра? Сотрудники партнёра перестанут видеть бронирования по ней.`)) return;
    try {
      setBusyId(row.event_id);
      setError(null);
      await partnersAdminAPI.removeEvent(partner.id, row.event_id);
      onChanged();
    } catch (err) {
      setError(parseApiError(err, 'Не удалось отвязать экскурсию'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <FormErrorAlert message={error} />

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        Партнёр видит бронирования и списки гостей только по привязанным экскурсиям. Его сотрудники проверяют
        QR-билеты и отмечают прибытие гостей в приложении «Аспектум Партнёр» и на сайте в разделе /partner.
        Привязка не влияет на коды и расчёт вознаграждения.
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-2 text-sm font-medium text-gray-800">
          Привязанные экскурсии {links.length ? `(${links.length})` : ''}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-3">Экскурсия</th>
              <th className="py-1 pr-3">Город</th>
              <th className="py-1 pr-3">Бронирование</th>
              <th className="py-1 pr-3">Привязана</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {links.map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                <td className="py-1.5 pr-3 font-medium text-gray-900">{pickTitle(row.title) || row.event_id}</td>
                <td className="py-1.5 pr-3 text-gray-600">{row.city_name || '—'}</td>
                <td className="py-1.5 pr-3">
                  {row.is_bookable ? (
                    <span className="text-green-700">Включено</span>
                  ) : (
                    <span className="text-amber-700" title="Пока бронирование выключено, бронирований и билетов по экскурсии не будет">
                      Выключено
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-gray-600">{formatDate(row.created_at)}</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    disabled={busyId === row.event_id}
                    onClick={() => unlink(row)}
                  >
                    Отвязать
                  </button>
                </td>
              </tr>
            ))}
            {!links.length && (
              <tr>
                <td colSpan={5} className="py-2 text-gray-400">
                  Привязанных экскурсий нет. Найдите экскурсию в каталоге ниже.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="text-sm font-medium text-gray-800">Привязать экскурсию</div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Название экскурсии"
            className="flex-1 min-w-[16rem] px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={onlyBookable} onChange={(e) => setOnlyBookable(e.target.checked)} />
            Только с включённым бронированием
          </label>
        </div>
        {search.trim().length >= 2 && (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {searching && !results.length && <div className="p-3 text-sm text-gray-400">Поиск…</div>}
            {!searching && !results.length && <div className="p-3 text-sm text-gray-400">Ничего не найдено.</div>}
            {results.map((event) => {
              const linked = linkedIds.has(event.id);
              return (
                <div key={event.id} className="flex items-center justify-between gap-3 p-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{pickTitle(event.title) || event.id}</div>
                    <div className="text-xs text-gray-500">
                      {event.city_display_name || 'Город не указан'}
                      {event.is_bookable ? ' · бронирование включено' : ' · бронирование выключено'}
                    </div>
                  </div>
                  {linked ? (
                    <span className="shrink-0 text-xs text-green-700">Привязана</span>
                  ) : (
                    <button
                      type="button"
                      className={event.is_bookable ? SMALL_PRIMARY : SMALL_BUTTON}
                      disabled={busyId === event.id}
                      onClick={() => link(event)}
                    >
                      Привязать
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
