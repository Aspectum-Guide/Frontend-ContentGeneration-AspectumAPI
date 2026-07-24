import { normalizeCurrency } from '../shared/currencies';
import { getTicketTypeLabel } from '../shared/labels';

/** Слот доступен для бронирования (как в shop-events на бэкенде). */
export function isSlotBookable(slot) {
  if (!slot?.is_active) return false;
  if (Number(slot.available_seats ?? 0) <= 0) return false;
  const dt = new Date(slot.slot_datetime);
  if (!Number.isFinite(dt.getTime())) return false;
  const closesMin = Number(slot.booking_closes_minutes_before ?? 60);
  const closesAt = dt.getTime() - closesMin * 60 * 1000;
  return Date.now() < closesAt;
}

export function buildRulesCountByType(rules) {
  const map = {};
  for (const rule of rules || []) {
    const tid = String(rule.ticket_type || '');
    if (!tid) continue;
    map[tid] = (map[tid] || 0) + 1;
  }
  return map;
}

export function buildSlotPriceMap(slotPrices) {
  const map = new Map();
  for (const row of slotPrices || []) {
    map.set(`${row.slot}:${row.ticket_type}`, row);
  }
  return map;
}

export function countSlotOnlyPrices(slotPrices, typeId, hasBase) {
  if (hasBase) return 0;
  return (slotPrices || []).filter((p) => String(p.ticket_type) === String(typeId)).length;
}

/**
 * @returns {{ kind: 'saved'|'draft'|'rules'|'slots'|'empty', label: string }}
 */
export function getPriceRowStatus({
  row,
  savedBase,
  isDirty,
  rulesCount = 0,
  slotOnlyCount = 0,
}) {
  const price = Number(row?.price);
  const hasDraftValue = Number.isFinite(price) && price >= 0;

  if (isDirty && hasDraftValue) {
    return { kind: 'draft', label: 'черновик' };
  }
  if (savedBase) {
    const cur = normalizeCurrency(savedBase.currency || row?.currency || 'EUR');
    return { kind: 'saved', label: `в БД: ${savedBase.base_price} ${cur}` };
  }
  if (rulesCount > 0) {
    return {
      kind: 'rules',
      label: rulesCount === 1 ? 'только правила (1)' : `только правила (${rulesCount})`,
    };
  }
  if (slotOnlyCount > 0) {
    return {
      kind: 'slots',
      label: slotOnlyCount === 1 ? 'только на слотах (1)' : `только на слотах (${slotOnlyCount})`,
    };
  }
  if (hasDraftValue) {
    return { kind: 'draft', label: 'не сохранено' };
  }
  return { kind: 'empty', label: 'не задана' };
}

const STATUS_CLASS = {
  saved: 'bg-emerald-50 text-emerald-700',
  draft: 'bg-sky-50 text-sky-700',
  rules: 'bg-violet-50 text-violet-700',
  slots: 'bg-amber-50 text-amber-700',
  empty: 'bg-gray-100 text-gray-500',
};

export function priceStatusClass(kind) {
  return STATUS_CLASS[kind] || STATUS_CLASS.empty;
}

export const PRICE_SOURCE_LABELS = {
  base: 'базовая',
  rule: 'правило',
  ticket_price: 'слот',
};

export function buildReadinessItems({
  selectedEvent,
  usedTypesCount,
  savedBaseCount,
  openSlotsCount,
  slotsWithoutTypesCount,
  loading,
}) {
  const isShow = !!selectedEvent?.is_show;
  const isBookable = !!selectedEvent?.is_bookable;
  const slotsOk = openSlotsCount > 0;
  const slotTypesOk = slotsWithoutTypesCount === 0 && openSlotsCount > 0;
  const pricesOk = usedTypesCount > 0 && savedBaseCount >= usedTypesCount;
  const storeOk = isShow && isBookable && slotTypesOk && pricesOk && slotsOk;

  return [
    {
      id: 'slot-types',
      label: 'Типы привязаны к слотам',
      ok: slotTypesOk || !slotsOk,
      hint: !slotsOk
        ? 'Сначала создайте слоты'
        : slotTypesOk
          ? 'Все открытые слоты с типами'
          : `${slotsWithoutTypesCount} слотов без типов — нажмите «Синхр. типы»`,
    },
    {
      id: 'prices',
      label: 'Базовые цены сохранены',
      ok: pricesOk,
      hint: pricesOk
        ? `${savedBaseCount}/${usedTypesCount} в БД`
        : `Сохраните базовые цены (${savedBaseCount}/${usedTypesCount || '?'})`,
    },
    {
      id: 'slots',
      label: 'Есть открытые слоты с местами',
      ok: slotsOk,
      hint: slotsOk
        ? `${openSlotsCount} слотов`
        : 'Создайте слоты в будущем с available_seats > 0',
    },
    {
      id: 'store',
      label: 'Готово к магазину (shop-events)',
      ok: storeOk,
      hint: storeOk
        ? 'Ивент появится в каталоге приложения'
        : !isBookable
          ? 'Включите «В сторе» в справочнике ивентов'
          : !isShow
            ? 'Включите «Виден» в справочнике ивентов'
            : 'Выполните пункты выше',
      link: !isBookable || !isShow ? '/catalog/events' : null,
      linkLabel: 'Открыть ивенты',
    },
  ].map((item) => ({ ...item, loading }));
}

export function formatSlotLabel(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

export function collectDirtyPriceEntries(eventTicketTypes, priceByType, priceCurrency, dirtyIds) {
  const entries = [];
  const errors = [];
  for (const tt of eventTicketTypes) {
    const id = String(tt.id);
    if (!dirtyIds.has(id)) continue;
    const row = priceByType[id] || {};
    const price = Number(row.price);
    if (!Number.isFinite(price) || price < 0) {
      errors.push(getTicketTypeLabel(tt));
      continue;
    }
    entries.push({
      id,
      tt,
      price,
      currency: normalizeCurrency(row.currency || priceCurrency),
    });
  }
  return { entries, errors };
}
