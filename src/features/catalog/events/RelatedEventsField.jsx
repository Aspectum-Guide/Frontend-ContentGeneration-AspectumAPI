import { useEffect, useState } from 'react';
import { Field, TextInput } from '../../../components/ui/FormField';
import { getMultiLangValue } from '../shared/i18n';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { eventsCatalogAPI } from './api';

/**
 * ai-tasks-august.md section 5 ("Связанное") — "связать с" picker.
 * Search reuses the same `search` param as the events catalog list/grid
 * (list_reference_events on the backend), no dedicated search endpoint.
 */
export default function RelatedEventsField({ eventId, relatedEvents, onAdd, onRemove }) {
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
      .list({ search: query, page_size: 10 })
      .then((r) => {
        if (!active) return;
        const rows = r?.data?.events || [];
        const selectedIds = new Set((relatedEvents || []).map((e) => String(e.id)));
        setResults(
          rows.filter((row) => String(row.id) !== String(eventId) && !selectedIds.has(String(row.id)))
        );
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
    <Field label="Связанные события («Связанное»)">
      <div className="flex flex-wrap gap-2 mb-2">
        {(relatedEvents || []).length === 0 && (
          <p className="text-xs text-gray-400">Ничего не привязано</p>
        )}
        {(relatedEvents || []).map((ev) => (
          <span
            key={ev.id}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200"
          >
            {getMultiLangValue(ev.title) || ev.id}
            <button
              type="button"
              onClick={() => onRemove(ev.id)}
              className="ml-0.5 text-purple-400 hover:text-purple-700"
              aria-label="Убрать связь"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <TextInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск события для связи..."
      />

      {search.trim() && (
        <div className="mt-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
          {loading && <p className="p-2 text-xs text-gray-400">Поиск...</p>}
          {!loading && results.length === 0 && (
            <p className="p-2 text-xs text-gray-400">Ничего не найдено</p>
          )}
          {!loading &&
            results.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  onAdd(row);
                  setSearch('');
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-purple-50 border-b border-gray-100 last:border-0"
              >
                <span className="truncate">{getMultiLangValue(row.title) || row.id}</span>
                {row.city_display_name && (
                  <span className="text-xs text-gray-400 shrink-0">{row.city_display_name}</span>
                )}
              </button>
            ))}
        </div>
      )}
    </Field>
  );
}
