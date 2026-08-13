import { useEffect, useMemo, useState } from 'react';
import { Field, TextInput } from '../../../components/ui/FormField';
import { eventsCatalogAPI } from '../../../features/catalog/events/api';
import { useCatalogFilters } from '../../../features/catalog/core/useCatalogFilters';
import {
  filterPersistedSessionAttractions,
  getAttrName,
  normalizeId,
} from './sessionWizardShared.jsx';

/**
 * ai-tasks-august.md section 5 ("Связанное") — same "связать с" picker as
 * RelatedEventsField (catalog events), but for the session wizard's
 * attraction editor: attractions here aren't published Events yet, so a
 * cross-link can point at either an existing catalog event or another
 * attraction still being drafted in this same session. The session-local
 * search is a client-side filter of the already-loaded `attractions` list
 * (no request); the catalog search reuses eventsCatalogAPI.list exactly like
 * RelatedEventsField does.
 */
function getDisplayTitle(item) {
  const value = item?.title ?? item?.name;
  if (!value) return item?.id || '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return (
      value.ru ||
      value.en ||
      value.it ||
      Object.values(value).find((v) => typeof v === 'string' && v.trim()) ||
      item?.id ||
      ''
    );
  }
  return item?.id || '';
}

export default function SessionWizardAttractionRelatedEventsPicker({
  currentAttrId,
  relatedEvents = [],
  attractions = [],
  onAdd,
  onRemove,
}) {
  const { search, setSearch, debouncedSearch } = useCatalogFilters({ debounceMs: 300 });
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const selectedIds = useMemo(
    () => new Set((relatedEvents || []).map((e) => normalizeId(e.id))),
    [relatedEvents],
  );

  const sessionResults = useMemo(() => {
    const q = String(debouncedSearch || '').trim().toLowerCase();
    if (!q) return [];
    return filterPersistedSessionAttractions(attractions)
      .filter((attr) => normalizeId(attr.id) !== normalizeId(currentAttrId))
      .filter((attr) => !selectedIds.has(normalizeId(attr.id)))
      .filter((attr) => getAttrName(attr).toLowerCase().includes(q))
      .slice(0, 10);
  }, [attractions, currentAttrId, debouncedSearch, selectedIds]);

  useEffect(() => {
    const query = debouncedSearch.trim();
    if (!query) {
      setCatalogResults([]);
      return;
    }
    let active = true;
    setCatalogLoading(true);
    eventsCatalogAPI
      .list({ search: query, page_size: 10 })
      .then((r) => {
        if (!active) return;
        const rows = r?.data?.events || [];
        setCatalogResults(
          rows.filter(
            (row) =>
              normalizeId(row.id) !== normalizeId(currentAttrId) &&
              !selectedIds.has(normalizeId(row.id)),
          ),
        );
      })
      .catch(() => {
        if (active) setCatalogResults([]);
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, currentAttrId]);

  const handlePick = (row, kind) => {
    onAdd?.({ id: row.id, title: row.title ?? row.name ?? {}, kind });
    setSearch('');
  };

  const hasResults = sessionResults.length > 0 || catalogResults.length > 0;

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
            {getDisplayTitle(ev)}
            {ev.kind === 'session' && (
              <span className="text-purple-400">· в сессии</span>
            )}
            <button
              type="button"
              onClick={() => onRemove?.(ev.id)}
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
        <div className="mt-1 max-h-56 overflow-y-auto border border-gray-200 rounded-lg bg-white">
          {catalogLoading && !hasResults && (
            <p className="p-2 text-xs text-gray-400">Поиск...</p>
          )}
          {!catalogLoading && !hasResults && (
            <p className="p-2 text-xs text-gray-400">Ничего не найдено</p>
          )}

          {sessionResults.length > 0 && (
            <div className="border-b border-gray-100 last:border-b-0">
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                В этой сессии
              </div>
              {sessionResults.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => handlePick(row, 'session')}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-purple-50 border-b border-gray-100 last:border-0"
                >
                  <span className="truncate">{getAttrName(row)}</span>
                </button>
              ))}
            </div>
          )}

          {catalogResults.length > 0 && (
            <div className="border-b border-gray-100 last:border-b-0">
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                Существующие
              </div>
              {catalogResults.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => handlePick(row, 'published')}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-purple-50 border-b border-gray-100 last:border-0"
                >
                  <span className="truncate">{getDisplayTitle(row)}</span>
                  {row.city_display_name && (
                    <span className="text-xs text-gray-400 shrink-0">{row.city_display_name}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Field>
  );
}
