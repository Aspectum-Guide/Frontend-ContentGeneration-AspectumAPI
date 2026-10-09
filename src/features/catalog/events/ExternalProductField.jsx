import { useEffect, useState } from 'react';
import { Field, TextInput } from '../../../components/ui/FormField';
import { getMultiLangValue } from '../shared/i18n';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { eventsCatalogAPI } from './api';

/**
 * BookingAPI.ExternalProduct.event (OneToOne) — search-and-pick, same search
 * pattern as RelatedEventsField, but single-value and saved immediately on
 * pick/clear (there is no field for this on update_event's PATCH — the
 * backend has its own dedicated sub-endpoint, see onPick/onClear props).
 * Candidates already linked to a different event are shown disabled with
 * that event's title instead of being pickable, so picking one never hits
 * the backend's 400 for that case.
 */
export default function ExternalProductField({
  eventId,
  externalProduct,
  onPick,
  onClear,
  saving,
  error,
}) {
  const { search, setSearch, debouncedSearch } = useCatalogFilters({ debounceMs: 300 });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = debouncedSearch.trim();
    if (!query) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    eventsCatalogAPI
      .listExternalProducts({ search: query, page_size: 10, event_id: eventId })
      .then((r) => {
        if (!active) return;
        setResults(r?.data?.external_products || []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, eventId]);

  return (
    <Field label="Внешний продукт поставщика">
      <p className="mb-2 text-xs text-gray-400">
        Привязка к BookingAPI.ExternalProduct — выбор существующего продукта помечает его
        editorial-маппингом: синк от поставщика больше не затирает контент этого события.
      </p>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {externalProduct ? (
        <div className="flex items-center gap-1 mb-2">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            {getMultiLangValue(externalProduct.title) || externalProduct.external_id || externalProduct.id}
            <button
              type="button"
              onClick={onClear}
              disabled={saving}
              className="ml-0.5 text-purple-400 hover:text-purple-700 disabled:opacity-50"
              aria-label="Отвязать внешний продукт"
            >
              ×
            </button>
          </span>
          {saving && <span className="text-xs text-gray-400">Сохранение...</span>}
        </div>
      ) : (
        <>
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск внешнего продукта..."
            disabled={saving}
          />
          {search.trim() && (
            <div className="mt-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
              {loading && <p className="p-2 text-xs text-gray-400">Поиск...</p>}
              {!loading && results.length === 0 && (
                <p className="p-2 text-xs text-gray-400">Ничего не найдено</p>
              )}
              {!loading &&
                results.map((row) => {
                  const linkedElsewhere = Boolean(row.already_linked_event_id);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      disabled={linkedElsewhere || saving}
                      onClick={() => {
                        onPick(row);
                        setSearch('');
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-purple-50 border-b border-gray-100 last:border-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                      <span className="flex flex-col truncate">
                        <span className="truncate">
                          {getMultiLangValue(row.title) || row.external_id || row.id}
                        </span>
                        {linkedElsewhere && (
                          <span className="text-xs text-gray-400">
                            Уже привязан к: {getMultiLangValue(row.already_linked_event_title) || row.already_linked_event_id}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
                        {row.city_display_name}
                        {row.status && <span className="rounded bg-gray-100 px-1.5 py-0.5">{row.status}</span>}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </>
      )}
    </Field>
  );
}
