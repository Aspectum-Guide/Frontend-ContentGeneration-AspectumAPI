import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eventsAPI } from '../../../api/generation';
import { bookingReferenceAPI, ticketTypesAPI } from '../../../api/booking';
import { getTicketTypeLabel, filterTicketTypesForEvent } from './labels';
import { normalizeListResponse } from './normalize';

const REFERENCE_PAGE_SIZE = 100;

async function loadAllReferenceEvents(pageSize = REFERENCE_PAGE_SIZE) {
  const allEvents = [];
  let cities = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const response = await eventsAPI.list({ page, page_size: pageSize });
    const data = response?.data;
    const list = normalizeListResponse(data, ['events', 'results', 'data']);
    allEvents.push(...list);
    totalPages = Number(data?.total_pages) || 1;
    if (Array.isArray(data?.reference?.cities) && data.reference.cities.length) {
      cities = data.reference.cities;
    }
    page += 1;
  }

  return { events: allEvents, cities };
}

export function useEventOptions(pageSize = REFERENCE_PAGE_SIZE) {
  const [eventOptions, setEventOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState('');

  const loadEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      setEventsError('');
      const { events, cities } = await loadAllReferenceEvents(pageSize);
      setEventOptions(events);

      const cityRows = cities.length
        ? cities.map((c) => ({
            id: String(c.id),
            label: String(c.name || c.display_name || c.id),
          }))
        : [];
      if (cityRows.length) {
        setCityOptions(cityRows.sort((a, b) => a.label.localeCompare(b.label, 'ru')));
      } else {
        const unique = new Map();
        for (const ev of events) {
          const id = String(ev.city_id || '');
          if (!id) continue;
          const label = String(ev.city_display_name || ev.city_name || id);
          if (!unique.has(id)) unique.set(id, label);
        }
        setCityOptions(
          Array.from(unique.entries())
            .map(([id, label]) => ({ id, label }))
            .sort((a, b) => a.label.localeCompare(b.label, 'ru')),
        );
      }
    } catch (err) {
      setEventOptions([]);
      setCityOptions([]);
      setEventsError(err?.message || 'Не удалось загрузить события');
    } finally {
      setEventsLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return { eventOptions, cityOptions, eventsLoading, eventsError, reloadEvents: loadEvents };
}

export function useBookableEventOptions(pageSize = 500) {
  const [bookableEvents, setBookableEvents] = useState([]);
  const [bookableLoading, setBookableLoading] = useState(true);

  useEffect(() => {
    setBookableLoading(true);
    bookingReferenceAPI.events({ page_size: pageSize, is_bookable: true })
      .then((r) => {
        const list = normalizeListResponse(r?.data, ['events', 'results', 'data']);
        setBookableEvents(list);
      })
      .catch(() => setBookableEvents([]))
      .finally(() => setBookableLoading(false));
  }, [pageSize]);

  return { bookableEvents, bookableLoading };
}

/**
 * @param {string} eventId
 * @param {number} [pageSize]
 * @param {{ globalOnly?: boolean }} [opts] `globalOnly` — only global
 *   (event=NULL) types. Use this for pickers that attach types to a *slot*:
 *   the public event API only ever shows global types to customers, so an
 *   event-owned type attached to a slot is silently invisible on booking —
 *   the backend also rejects this, but filtering it out of the picker avoids
 *   the round-trip error entirely.
 */
export function useTicketTypeOptions(eventId, pageSize = 500, opts = {}) {
  const { globalOnly = false } = opts;
  const [ticketTypeOptions, setTicketTypeOptions] = useState([]);
  const [ticketTypesLoading, setTicketTypesLoading] = useState(false);

  const loadTicketTypes = useCallback(async () => {
    if (!eventId) {
      setTicketTypeOptions([]);
      return;
    }
    try {
      setTicketTypesLoading(true);
      const response = await ticketTypesAPI.list({
        event: eventId,
        page_size: pageSize,
        ordering: 'sort_order',
        is_active: 'true',
        ...(globalOnly ? { global: '1' } : {}),
      });
      const data = response?.data;
      const list = filterTicketTypesForEvent(
        normalizeListResponse(data, ['results', 'data']),
        eventId,
      );
      setTicketTypeOptions(list);
    } catch {
      setTicketTypeOptions([]);
    } finally {
      setTicketTypesLoading(false);
    }
  }, [eventId, pageSize, globalOnly]);

  useEffect(() => {
    loadTicketTypes();
  }, [loadTicketTypes]);

  return { ticketTypeOptions, ticketTypesLoading, reloadTicketTypes: loadTicketTypes };
}

/**
 * Build a stable `Map<id, { title, code }>` for ticket types.
 * - `title` is `name || code || id` (via `getTicketTypeLabel`).
 * - `code` is the bare code (or '' if none).
 * - When `cache` is true, ids missing in the current options list still resolve
 *   to previously seen values (useful for table rows that reference old types).
 */
export function useTicketTypeMap(ticketTypeOptions, { cache = true } = {}) {
  const cacheRef = useRef(new Map());

  return useMemo(() => {
    const next = cache ? new Map(cacheRef.current) : new Map();
    for (const tt of ticketTypeOptions || []) {
      const id = String(tt?.id || '');
      if (!id) continue;
      next.set(id, {
        title: getTicketTypeLabel(tt),
        code: String(tt?.code || '').trim(),
      });
    }
    if (cache) cacheRef.current = next;
    return next;
  }, [ticketTypeOptions, cache]);
}

/**
 * Prefetch ticket type labels for the given event ids and accumulate them in a
 * persistent `Map<id, { title, code }>`. Useful for table rows that may
 * reference ticket types across many events.
 *
 * The result map is updated incrementally; the returned reference changes only
 * when new entries are added (so memoised columns/render functions can rely on it).
 */
export function useTicketTypeMapForEvents(eventIds, pageSize = 500) {
  const cacheRef = useRef(new Map());
  const [version, setVersion] = useState(0);

  const idsKey = useMemo(() => {
    if (!Array.isArray(eventIds)) return '';
    return Array.from(new Set(eventIds.map((x) => String(x || '')).filter(Boolean)))
      .sort()
      .join('|');
  }, [eventIds]);

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;

    (async () => {
      try {
        const responses = [
          await ticketTypesAPI.list({ page_size: pageSize, ordering: 'code' }),
        ];
        if (cancelled) return;

        let changed = false;
        for (const r of responses) {
          const data = r?.data;
          const list = Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data)
              ? data
              : [];
          for (const tt of list) {
            const id = String(tt?.id || '');
            if (!id) continue;
            const title = getTicketTypeLabel(tt);
            const code = String(tt?.code || '').trim();
            const prev = cacheRef.current.get(id);
            if (!prev || prev.title !== title || prev.code !== code) {
              cacheRef.current.set(id, { title, code });
              changed = true;
            }
          }
        }
        if (changed) setVersion((v) => v + 1);
      } catch {
        // ignore prefetch errors (callers will fallback to ids)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idsKey, pageSize]);

  return useMemo(() => new Map(cacheRef.current), [version]);
}

