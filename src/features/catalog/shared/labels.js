import { getMultiLangValue } from './i18n';

/**
 * Common label helpers for catalog rows / dropdowns.
 * Always returns a non-empty string (falls back to id, then '').
 */

export function getTicketTypeLabel(tt) {
  if (!tt) return '';
  const name = getMultiLangValue(tt.name);
  if (name) return name;
  if (tt.code) return String(tt.code);
  return String(tt.id || '');
}

/** UUID события из поля ticket type (строка или nested object). */
export function resolveTicketTypeEventId(tt) {
  if (!tt?.event) return '';
  if (typeof tt.event === 'object') {
    return String(tt.event.id || tt.event.pk || '');
  }
  return String(tt.event);
}

/** Типы, применимые к событию: событийные + глобальные без дубля по code. */
export function filterTicketTypesForEvent(ticketTypes, eventId) {
  const evId = String(eventId || '');
  if (!evId) return [];

  const applicable = (ticketTypes || []).filter((tt) => {
    const ttEventId = resolveTicketTypeEventId(tt);
    return !ttEventId || ttEventId === evId;
  });

  const ownedCodes = new Set(
    applicable
      .filter((tt) => resolveTicketTypeEventId(tt) === evId)
      .map((tt) => (tt.code || '').trim().toLowerCase())
      .filter(Boolean),
  );

  return applicable.filter((tt) => {
    const ttEventId = resolveTicketTypeEventId(tt);
    if (ttEventId === evId) return true;
    const code = (tt.code || '').trim().toLowerCase();
    return code && !ownedCodes.has(code);
  });
}

export function getCityLabel(city) {
  if (!city) return '';
  if (typeof city === 'string') return city;
  return getMultiLangValue(city.name || city.city_name) || String(city.id || '');
}

export function getEventLabel(event) {
  if (!event) return '';
  if (typeof event === 'string') return event;
  return getMultiLangValue(event.title || event.name) || String(event.id || '');
}

export function getEventLabelById(events, id) {
  if (!id) return '';
  const found = (events || []).find((e) => String(e.id) === String(id));
  return found ? getEventLabel(found) : String(id);
}

export function getTicketTypeLabelById(ticketTypes, id) {
  if (!id) return '';
  const found = (ticketTypes || []).find((t) => String(t.id) === String(id));
  return found ? getTicketTypeLabel(found) : String(id);
}
