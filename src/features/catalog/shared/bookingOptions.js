import { useCallback, useEffect, useState } from 'react';
import { bookingReferenceAPI, ticketTypesAPI } from '../../../api/booking';
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
        ordering: 'name_primary',
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
