export const LOCALE_FLAGS = {
  US: '🇺🇸', IT: '🇮🇹', RU: '🇷🇺', FR: '🇫🇷', DE: '🇩🇪', ES: '🇪🇸',
  JP: '🇯🇵', CN: '🇨🇳', KR: '🇰🇷', GB: '🇬🇧', UA: '🇺🇦', NL: '🇳🇱',
  PL: '🇵🇱', PT: '🇵🇹', TR: '🇹🇷', BR: '🇧🇷', CA: '🇨🇦', AU: '🇦🇺',
};

export const LOCALE_INFO_MAP = {
  ru: { code: 'RU', name: 'Русский' }, en: { code: 'US', name: 'Английский' },
  it: { code: 'IT', name: 'Итальянский' }, fr: { code: 'FR', name: 'Французский' },
  de: { code: 'DE', name: 'Немецкий' }, es: { code: 'ES', name: 'Испанский' },
  pl: { code: 'PL', name: 'Польский' }, pt: { code: 'PT', name: 'Португальский' },
  nl: { code: 'NL', name: 'Нидерландский' }, zh: { code: 'CN', name: 'Китайский' },
  ja: { code: 'JP', name: 'Японский' }, ko: { code: 'KR', name: 'Корейский' },
  tr: { code: 'TR', name: 'Турецкий' }, uk: { code: 'UA', name: 'Украинский' },
};

export const DEFAULT_LOCALE_DEFS = [
  { key: 'ru-RU', lang: 'ru', code: 'RU', langName: 'Русский', isDefault: true },
  { key: 'en-US', lang: 'en', code: 'US', langName: 'Английский', isDefault: true },
];

export function getLocaleInfo(lang) {
  const code = (lang || '').toLowerCase().substring(0, 2);
  return LOCALE_INFO_MAP[code] || { code: (lang || 'XX').toUpperCase().substring(0, 2), name: lang || 'Язык' };
}

export function getFlag(code) {
  return LOCALE_FLAGS[(code || '').toUpperCase()] || '🌍';
}

export function getCityDraftName(draft) {
  const name = draft?.name || {};
  return name.ru || name.en || name.it || Object.values(name).find(Boolean) || 'Новый город';
}

export function getAttrName(attr) {
  const name = attr?.name || {};
  return name.ru || name.en || name.it || Object.values(name).find(Boolean) || '(без названия)';
}

export const normalizeId = (value) => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    return String(value.id ?? value.uuid ?? value.pk ?? '').trim();
  }

  return String(value).trim();
};

export const getSessionAttractionIdFromItem = (item) =>
  normalizeId(
    item?.session_attraction_id ??
      item?.session_attraction ??
      item?.sessionAttractionId ??
      item?.sessionAttraction
  );

export const getDatabaseAttractionIdFromItem = (item) =>
  normalizeId(
    item?.event_id ??
      item?.event ??
      item?.attraction_id ??
      item?.attraction
  );

/** Whether a nested entity belongs to the opened session/database attraction. */
export const itemBelongsToActiveAttraction = (
  item,
  { activeAttractionId = '', activeEventId = '' } = {}
) => {
  if (!activeAttractionId && !activeEventId) {
    return true;
  }

  const assignedType = item?.assigned_attraction_type || 'none';

  if (assignedType === 'draft' && activeAttractionId) {
    return getSessionAttractionIdFromItem(item) === activeAttractionId;
  }

  if (assignedType === 'database' && activeEventId) {
    return getDatabaseAttractionIdFromItem(item) === activeEventId;
  }

  if (assignedType === 'none' || !assignedType) {
    const sessionAttrId = getSessionAttractionIdFromItem(item);
    if (sessionAttrId && activeAttractionId) {
      return sessionAttrId === activeAttractionId;
    }

    const eventId = getDatabaseAttractionIdFromItem(item);
    if (eventId && activeEventId) {
      return eventId === activeEventId;
    }
  }

  return false;
};

export const filterItemsForActiveAttraction = (
  items,
  { activeAttractionId = '', activeEventId = '' } = {}
) => {
  if (!activeAttractionId && !activeEventId) {
    return items || [];
  }

  return (items || []).filter((item) =>
    itemBelongsToActiveAttraction(item, { activeAttractionId, activeEventId })
  );
};

export const getSessionCityIdFromItem = (item) =>
  normalizeId(
    item?.session_city_id ??
      item?.session_city ??
      item?.sessionCityId ??
      item?.sessionCity
  );

export const getDatabaseCityIdFromItem = (item) =>
  normalizeId(item?.city_id ?? item?.city);

/** Whether city useful info belongs to the opened session/database city draft. */
export const itemBelongsToActiveCityDraft = (
  item,
  { activeCityDraftId = '', activeDatabaseCityId = '' } = {}
) => {
  const normalizedDraftId = normalizeId(activeCityDraftId);

  if (!normalizedDraftId || normalizedDraftId === 'legacy') {
    if (!activeDatabaseCityId) {
      return true;
    }
  }

  const assignedType = item?.assigned_city_type || 'none';

  if (assignedType === 'draft' && normalizedDraftId && normalizedDraftId !== 'legacy') {
    return getSessionCityIdFromItem(item) === normalizedDraftId;
  }

  if (assignedType === 'database' && activeDatabaseCityId) {
    return getDatabaseCityIdFromItem(item) === activeDatabaseCityId;
  }

  if (assignedType === 'none' || !assignedType) {
    const sessionCityId = getSessionCityIdFromItem(item);
    if (
      sessionCityId &&
      normalizedDraftId &&
      normalizedDraftId !== 'legacy'
    ) {
      return sessionCityId === normalizedDraftId;
    }

    const databaseCityId = getDatabaseCityIdFromItem(item);
    if (databaseCityId && activeDatabaseCityId) {
      return databaseCityId === activeDatabaseCityId;
    }
  }

  return false;
};

export const filterCityInfosForActiveDraft = (
  items,
  { activeCityDraftId = '', activeDatabaseCityId = '' } = {}
) => {
  const normalizedDraftId = normalizeId(activeCityDraftId);

  if (!normalizedDraftId || normalizedDraftId === 'legacy') {
    if (!activeDatabaseCityId) {
      return items || [];
    }
  }

  return (items || []).filter((item) =>
    itemBelongsToActiveCityDraft(item, { activeCityDraftId, activeDatabaseCityId })
  );
};

export { SessionStatusBadge as StatusBadge } from '../../../components/ui/StatusBadge.jsx';
