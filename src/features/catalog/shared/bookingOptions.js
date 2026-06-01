import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bookingReferenceAPI, ticketTypesAPI } from '../../../api/booking';
import { getTicketTypeLabel } from './labels';
import { normalizeListResponse } from './normalize';

export function useEventOptions(pageSize = 500) {
  const [eventOptions, setEventOptions] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      const response = await bookingReferenceAPI.events({ page_size: pageSize });
      const data = response?.data;
      const list = normalizeListResponse(data, ['results', 'data']);
      setEventOptions(list);
    } catch {
      setEventOptions([]);
    } finally {
      setEventsLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return { eventOptions, eventsLoading, reloadEvents: loadEvents };
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

export function useTicketTypeOptions(eventId, pageSize = 500) {
  const [ticketTypeOptions, setTicketTypeOptions] = useState([]);
  const [ticketTypesLoading, setTicketTypesLoading] = useState(false);

  const loadTicketTypes = useCallback(async () => {
    const normalizedEventId = eventId || '';
    if (!normalizedEventId) {
      setTicketTypeOptions([]);
      return;
    }

    try {
      setTicketTypesLoading(true);
      const response = await ticketTypesAPI.list({
        event: normalizedEventId,
        page_size: pageSize,
        ordering: 'code',
      });
      const data = response?.data;
      const list = normalizeListResponse(data, ['results', 'data']);
      setTicketTypeOptions(list);
    } catch {
      setTicketTypeOptions([]);
    } finally {
      setTicketTypesLoading(false);
    }
  }, [eventId, pageSize]);

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
    const ids = idsKey.split('|');
    let cancelled = false;

    (async () => {
      try {
        const responses = await Promise.all(
          ids.map((eventId) =>
            ticketTypesAPI.list({ event: eventId, page_size: pageSize, ordering: 'code' })
          )
        );
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

