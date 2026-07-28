import { normalizeCurrency, DEFAULT_CURRENCY } from '../shared/currencies';
import { filterTicketTypesForEvent, getEventLabel, getTicketTypeLabel } from '../shared/labels';
import { isSlotBookable } from './bookingSetupPricingHelpers';

export function rowKey(eventId, ticketTypeId) {
  return `${eventId}:${ticketTypeId}`;
}

/** Map<eventId, { total, active }> — client-side grouping of one city-scoped slot fetch. */
export function groupSlotsByEvent(slots) {
  const map = new Map();
  for (const slot of slots || []) {
    const eventId = String(slot.event || '');
    if (!eventId) continue;
    const entry = map.get(eventId) || { total: 0, active: 0 };
    entry.total += 1;
    if (isSlotBookable(slot)) entry.active += 1;
    map.set(eventId, entry);
  }
  return map;
}

/**
 * One row per applicable (event, ticketType) pair across a city's events.
 * `savedBase` is the matching EventTicketTypePrice row, or null if unset.
 */
export function buildCityPriceRows({ events, ticketTypes, basePrices, slotsByEvent }) {
  const baseByKey = new Map();
  for (const row of basePrices || []) {
    baseByKey.set(rowKey(row.event, row.ticket_type), row);
  }

  const rows = [];
  for (const event of events || []) {
    const eventId = String(event.id);
    const applicable = filterTicketTypesForEvent(ticketTypes, eventId);
    const slotsSummary = slotsByEvent?.get(eventId) || { total: 0, active: 0 };
    for (const tt of applicable) {
      const ticketTypeId = String(tt.id);
      const key = rowKey(eventId, ticketTypeId);
      rows.push({
        key,
        eventId,
        eventLabel: getEventLabel(event),
        ticketTypeId,
        ticketTypeLabel: getTicketTypeLabel(tt),
        savedBase: baseByKey.get(key) || null,
        slotsSummary,
      });
    }
  }
  return rows;
}

/**
 * Build the `entries` payload for eventTicketTypePricesAPI.bulkUpsert from a
 * Map<rowKey, { price, currency? }> of rows the caller wants to submit.
 * Skips rows with a non-numeric/negative price (reported back as `skipped`).
 */
export function collectCityBulkEntries(rows, entriesByKey, fallbackCurrency = DEFAULT_CURRENCY) {
  const rowByKey = new Map((rows || []).map((r) => [r.key, r]));
  const entries = [];
  const skipped = [];

  for (const [key, draft] of entriesByKey.entries()) {
    const row = rowByKey.get(key);
    if (!row) continue;
    const price = Number(draft?.price);
    if (!Number.isFinite(price) || price < 0) {
      skipped.push(row);
      continue;
    }
    entries.push({
      event: row.eventId,
      ticket_type: row.ticketTypeId,
      base_price: price,
      currency: normalizeCurrency(draft?.currency || fallbackCurrency),
      is_active: true,
    });
  }

  return { entries, skipped };
}
