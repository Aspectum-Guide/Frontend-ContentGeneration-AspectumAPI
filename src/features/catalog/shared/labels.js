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

export function getEventLabel(event) {
  if (!event) return '';
  return getMultiLangValue(event.title) || String(event.id || '');
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
