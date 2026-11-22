import { useEffect, useMemo, useState } from 'react';
import { Chip, Field, InlineState, SearchSelect } from '@aspectum/admin-ui-web';
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

  const searchOptions = [
    ...sessionResults.map((row) => ({ ...row, __kind: 'session' })),
    ...catalogResults.map((row) => ({ ...row, __kind: 'published' })),
  ];

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
            onRemove={() => onRemove?.(ev.id)}
          >
            {getDisplayTitle(ev)}
            {ev.kind === 'session' && (
              <span className="text-aspectum-purple-light">· в сессии</span>
            )}
          </Chip>
        ))}
      </div>

      <SearchSelect
        value={search}
        onChange={setSearch}
        placeholder="Поиск события для связи..."
        options={searchOptions}
        loading={catalogLoading}
        emptyText="Ничего не найдено"
        onSelect={(row) => handlePick(row, row.__kind)}
        renderOption={(row) => (
          <>
            <span className="flex flex-col min-w-0">
              <span className="text-[10px] font-semibold text-aspectum-text-disabled">{row.__kind === 'session' ? 'В этой сессии' : 'Существующие'}</span>
              <span className="truncate">{row.__kind === 'session' ? getAttrName(row) : getDisplayTitle(row)}</span>
            </span>
            {row.city_display_name && <span className="text-xs text-aspectum-text-disabled shrink-0">{row.city_display_name}</span>}
          </>
        )}
      />
    </Field>
  );
}
