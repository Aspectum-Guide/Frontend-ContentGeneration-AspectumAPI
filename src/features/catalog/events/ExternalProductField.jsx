import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Field, TextInput } from '../../../components/ui/FormField';
import { getMultiLangValue } from '../shared/i18n';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { eventsCatalogAPI } from './api';

/**
 * BookingAPI.ExternalProduct.event (OneToOne) — привязка продукта поставщика
 * к ЭТОМУ событию. Сохраняется сразу при выборе (у update_event нет такого
 * поля, см. onPick/onClear/onSetOwnership).
 *
 * Без поиска показываем подсказки: продукты города события, самые похожие по
 * названию сверху. Продукт, висящий на «событии-проекции поставщика»,
 * выбрать можно — он переедет сюда, а старое событие скроется.
 */
function ProductRow({ row, saving, onPick, onDone }) {
  const blocked = Boolean(row.already_linked_event_id);
  const moves = Boolean(row.replaces_event_id);
  return (
    <button
      type="button"
      disabled={blocked || saving}
      onClick={() => {
        onPick(row);
        onDone?.();
      }}
      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-purple-50 border-b border-gray-100 last:border-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span className="flex flex-col min-w-0">
        <span className="flex items-center gap-2 min-w-0">
          <span className="truncate">{getMultiLangValue(row.title) || row.external_id || row.id}</span>
          {row.suggested && (
            <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
              похоже
            </span>
          )}
        </span>
        {blocked && (
          <span className="text-xs text-gray-400">
            Уже привязан к другому событию: {getMultiLangValue(row.already_linked_event_title) || row.already_linked_event_id}
          </span>
        )}
        {moves && (
          <span className="text-xs text-amber-600">
            Сейчас на событии «{getMultiLangValue(row.replaces_event_title) || row.replaces_event_id}» — оно будет скрыто, продукт переедет сюда
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
        {row.city_display_name}
        {row.status && <span className="rounded bg-gray-100 px-1.5 py-0.5">{row.status}</span>}
      </span>
    </button>
  );
}

export default function ExternalProductField({
  eventId,
  externalProduct,
  onPick,
  onClear,
  onSetOwnership,
  saving,
  error,
}) {
  const { search, setSearch, debouncedSearch } = useCatalogFilters({ debounceMs: 300 });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const linked = Boolean(externalProduct);

  useEffect(() => {
    if (linked) {
      setResults([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    eventsCatalogAPI
      .listExternalProducts({ search: debouncedSearch.trim() || undefined, page_size: 10, event_id: eventId })
      .then((r) => {
        if (active) setResults(r?.data?.external_products || []);
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch, eventId, linked]);

  const supplierText = externalProduct?.sync_event_content;
  const title = externalProduct
    ? getMultiLangValue(externalProduct.title) || externalProduct.external_id || externalProduct.id
    : '';

  return (
    <Field label="Бронирование у поставщика (Ventrata)">
      <div className="mb-3 rounded-lg border border-purple-100 bg-purple-50/50 p-3 text-xs text-gray-600 space-y-1">
        <p className="font-medium text-gray-700">Что это и что здесь нажимать</p>
        <p>
          Поставщик отдаёт билеты, цены и места. Эта привязка подключает их к <b>этому</b> событию:
          текст, фото и аудиогид остаются вашими, а кнопка «Забронировать» берёт цены и доступность у поставщика.
        </p>
        <p>
          Нет подходящего продукта в списке или нужно создать событие из продукта? Это делается на странице{' '}
          <Link className="text-purple-700 underline" to="/catalog/external-products/linking">
            «Внешние продукты → Привязка к событиям»
          </Link>.
        </p>
      </div>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {linked ? (
        <div className="rounded-lg border border-purple-200 bg-white p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    supplierText ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {supplierText ? 'Название и описание — от поставщика' : 'Название и описание — ваши'}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    externalProduct.is_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {externalProduct.is_enabled ? 'Продажи включены' : 'Продажи выключены'}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClear}
              disabled={saving}
              className="shrink-0 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Отвязать
            </button>
          </div>

          <p className="text-xs text-gray-500">
            {supplierText
              ? 'Каждая синхронизация перезаписывает название, описание и город события данными поставщика. Если вы редактируете текст сами — заберите его себе, иначе правки пропадут.'
              : 'Синхронизация не трогает текст события. Цены, места и доступность всё равно приходят от поставщика.'}
          </p>
          {!externalProduct.is_enabled && (
            <p className="text-xs text-amber-700">
              Продажи включаются в Django-админке (Внешние продукты → «Включено»). Пока выключено, кнопки бронирования в приложении нет.
            </p>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (supplierText) {
                onSetOwnership?.(externalProduct.id, false);
              } else if (
                window.confirm('Вернуть текст поставщику? Следующая синхронизация перезапишет название, описание и город этого события.')
              ) {
                onSetOwnership?.(externalProduct.id, true);
              }
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {supplierText ? 'Забрать текст себе' : 'Вернуть текст поставщику'}
          </button>
          {saving && <span className="ml-2 text-xs text-gray-400">Сохранение...</span>}
        </div>
      ) : (
        <>
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск продукта поставщика по названию..."
            disabled={saving}
          />
          <p className="mt-1 text-xs text-gray-400">
            {search.trim() ? 'Результаты поиска' : 'Подсказки: продукты этого города, похожие по названию — сверху'}
          </p>
          <div className="mt-1 max-h-56 overflow-y-auto border border-gray-200 rounded-lg bg-white">
            {loading && <p className="p-2 text-xs text-gray-400">Поиск...</p>}
            {!loading && results.length === 0 && (
              <p className="p-2 text-xs text-gray-400">
                {search.trim() ? 'Ничего не найдено' : 'Подходящих продуктов нет — у события должен быть указан город'}
              </p>
            )}
            {!loading &&
              results.map((row) => (
                <ProductRow
                  key={row.id}
                  row={row}
                  saving={saving}
                  onPick={onPick}
                  onDone={() => setSearch('')}
                />
              ))}
          </div>
        </>
      )}
    </Field>
  );
}
