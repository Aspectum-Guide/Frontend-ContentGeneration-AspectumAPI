import { useEffect, useState } from 'react';
import { Chip, Field, InlineState, SearchSelect } from '@aspectum/admin-ui-web';
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
          <InlineState size="xs" tone="disabled">Ничего не привязано</InlineState>
        )}
        {(relatedEvents || []).map((ev) => (
          <Chip
            key={ev.id}
            variant="purple"
            removable
            onRemove={() => onRemove(ev.id)}
          >
            {getMultiLangValue(ev.title) || ev.id}
          </Chip>
        ))}
      </div>

      <SearchSelect
        value={search}
        onChange={setSearch}
        placeholder="Поиск события для связи..."
        options={results}
        loading={loading}
        onSelect={(row) => {
          onAdd(row);
          setSearch('');
        }}
        renderOption={(row) => (
          <>
                <span className="truncate">{getMultiLangValue(row.title) || row.id}</span>
                {row.city_display_name && (
                  <span className="text-xs text-aspectum-text-disabled shrink-0">{row.city_display_name}</span>
                )}
          </>
        )}
      />
    </Field>
  );
}
