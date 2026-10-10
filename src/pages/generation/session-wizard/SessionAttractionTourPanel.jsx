import { useEffect, useState } from 'react';
import { attractionCommerceAPI, eventsAPI } from '../../../api/generation';
import { getMultiLangValue } from '../../../features/catalog/shared/i18n';
import { parseApiError } from '../../../utils/apiError';

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';

/**
 * «Привязать тур»: продукт поставщика (Ventrata), который продаётся на событии
 * этого места. Текст, фото и аудиогид остаются вашими, поставщик даёт цены,
 * места и доступность. До публикации сессии выбор только запоминается и
 * применяется при публикации; у уже опубликованного места привязка сразу.
 */
export default function SessionAttractionTourPanel({ sessionId, attractionId, attractionName, externalProduct, publishedEventId }) {
  const [tour, setTour] = useState(externalProduct || null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setTour(externalProduct || null);
    setOpen(false);
    setSearch('');
    setError('');
    setNotice('');
  }, [attractionId, externalProduct?.id]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    const term = search.trim() || getMultiLangValue(attractionName) || '';
    eventsAPI
      .listExternalProducts({
        search: term || undefined,
        page_size: 10,
        ...(publishedEventId && !search.trim() ? { event_id: publishedEventId } : {}),
      })
      .then((r) => active && setResults(r?.data?.external_products || []))
      .catch(() => active && setResults([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, search, attractionName, publishedEventId]);

  const save = async (product) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const r = await attractionCommerceAPI.setExternalProduct(sessionId, attractionId, product ? product.id : null);
      setTour(r?.data?.external_product || null);
      setOpen(false);
      setSearch('');
      if (product) {
        setNotice(
          r?.data?.linked_now
            ? 'Тур привязан к событию этого места.'
            : 'Тур запомнен — привяжется к событию при публикации сессии.',
        );
      }
    } catch (err) {
      const linkedTitle = getMultiLangValue(err?.response?.data?.linked_event_title);
      setError(
        linkedTitle
          ? `Этот тур уже привязан к другому вашему событию: «${linkedTitle}». Сначала отвяжите его там.`
          : parseApiError(err, 'Не удалось привязать тур'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 border border-gray-200 rounded-lg bg-white space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-800">Бронирование у поставщика (тур)</p>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            {tour ? 'Заменить тур' : 'Привязать тур'}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Тур — продукт поставщика (Ventrata): цены, билеты и места. Текст, фото и аудиогид остаются вашими.{' '}
        {publishedEventId
          ? 'Место уже опубликовано — тур привяжется к его событию сразу.'
          : 'Место ещё не опубликовано — тур привяжется к событию при публикации сессии.'}
      </p>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {notice && <p className="text-xs text-emerald-700">{notice}</p>}

      {tour && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-purple-200 bg-purple-50/40 p-2">
          <div className="min-w-0">
            <p className="truncate text-sm text-gray-900">{getMultiLangValue(tour.title) || tour.external_id || tour.id}</p>
            {tour.location_text && <p className="truncate text-xs text-gray-500">{tour.location_text}</p>}
            <p className="mt-1 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-medium ${tour.is_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {tour.is_enabled ? 'Продажи включены' : 'Продажи выключены'}
              </span>
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => save(null)}
            className="shrink-0 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Отвязать
          </button>
        </div>
      )}

      {open && (
        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
            placeholder="Название или адрес тура поставщика…"
            disabled={saving}
          />
          <p className="mt-1 text-xs text-gray-400">
            {search.trim() ? 'Результаты поиска' : 'Подсказки по названию места — похожие сверху'}
          </p>
          <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white">
            {loading && <p className="p-2 text-xs text-gray-400">Поиск…</p>}
            {!loading && results.length === 0 && <p className="p-2 text-xs text-gray-400">Ничего не найдено</p>}
            {!loading &&
              results.map((row) => {
                const blocked = Boolean(row.already_linked_event_id);
                return (
                  <button
                    key={row.id}
                    type="button"
                    disabled={blocked || saving}
                    onClick={() => save(row)}
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-purple-50 border-b border-gray-100 last:border-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate">{getMultiLangValue(row.title) || row.external_id || row.id}</span>
                      {row.suggested && (
                        <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">похоже</span>
                      )}
                    </span>
                    {row.location_text && <span className="truncate text-xs text-gray-400">{row.location_text}</span>}
                    {blocked && (
                      <span className="text-xs text-gray-400">
                        Уже привязан к другому событию: {getMultiLangValue(row.already_linked_event_title) || row.already_linked_event_id}
                      </span>
                    )}
                    {row.replaces_event_id && !blocked && (
                      <span className="text-xs text-amber-600">
                        Сейчас на событии «{getMultiLangValue(row.replaces_event_title) || row.replaces_event_id}» — оно будет скрыто, тур переедет к месту
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="mt-2 text-xs text-gray-500 hover:text-gray-700">
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
