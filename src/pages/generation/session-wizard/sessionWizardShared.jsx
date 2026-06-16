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

/** True when locale field has real words, not only punctuation/whitespace. */
export function isMeaningfulLocaleText(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  return /[^\s.,!?;:\-—–_~*()[\]{}'"«»/\\|]+/u.test(text);
}

/** True when country value equals locale UI code (US/ES/DE), not a real country name. */
export function isLocaleCodeUsedAsCountry(countryValue, localeCode) {
  const country = String(countryValue ?? '').trim().toUpperCase();
  const code = String(localeCode ?? '').trim().toUpperCase();
  return Boolean(country && code && country === code);
}

/** Country text safe to persist: empty if missing or only a locale code placeholder. */
export function normalizeLocaleCountryForSave(countryValue, localeCode) {
  const trimmed = String(countryValue ?? '').trim();
  if (!trimmed || isLocaleCodeUsedAsCountry(trimmed, localeCode)) {
    return '';
  }
  return trimmed;
}

/** Description for API save — preserves punctuation-only values such as "." */
export function normalizeLocaleDescriptionForSave(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

export function getCityDraftName(draft) {
  const name = draft?.name || {};
  const display =
    name.ru || name.en || name.it || Object.values(name).find((v) => v != null && String(v).trim() !== '');
  if (display != null && String(display).trim() !== '') {
    return String(display);
  }
  return 'без названия';
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when a string looks like a renderable image src, not a bare image id. */
export function isLikelyImageUrl(value) {
  const v = String(value ?? '').trim();
  if (!v) return false;
  if (UUID_RE.test(v)) return false;
  if (/^\d+$/.test(v)) return false;

  return (
    v.startsWith('http://') ||
    v.startsWith('https://') ||
    v.startsWith('/') ||
    v.startsWith('media/') ||
    v.startsWith('data:') ||
    v.startsWith('blob:')
  );
}

/** Prefer published media paths over stale session draft paths when several URLs exist. */
function scoreSessionEntityImageUrl(url) {
  const u = String(url || '');
  if (/\/media\/(il|events)\//i.test(u)) return 4;
  if (/\/media\//i.test(u)) return 3;
  if (u.startsWith('blob:') || u.startsWith('data:')) return 3;
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/')) return 2;
  if (u.startsWith('media/')) return 2;
  return 1;
}

/** Remove legacy preview/FK fields before spreading entity state (avoids UUID in img src). */
export function stripLegacyImageFields(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  /* eslint-disable no-unused-vars */
  const {
    image,
    imagePreview,
    image_preview,
    photoPreview,
    photo_preview,
    ...rest
  } = raw;
  /* eslint-enable no-unused-vars */

  return rest;
}

/** Preview URL from API/session entity — uses image_url, never a bare image id. */
export function resolveSessionEntityImageUrl(raw = {}) {
  const candidates = [];

  const pushCandidate = (value) => {
    const v = String(value ?? '').trim();
    if (isLikelyImageUrl(v)) {
      candidates.push(v);
    }
  };

  [
    raw.image_url,
    raw.imageUrl,
    raw.image_preview,
    raw.imagePreview,
    raw.localUrl,
    raw.local_url,
    raw.photo_url,
    raw.photoUrl,
  ].forEach(pushCandidate);

  if (raw.image && typeof raw.image === 'object') {
    [
      raw.image.url,
      raw.image.file,
      raw.image.src,
      raw.image.preview_url,
      raw.image.previewUrl,
    ].forEach(pushCandidate);
  }

  if (candidates.length === 0) {
    return '';
  }

  const unique = [...new Set(candidates)];
  unique.sort(
    (a, b) => scoreSessionEntityImageUrl(b) - scoreSessionEntityImageUrl(a),
  );
  return unique[0];
}

export function resolveSessionEntityImageId(raw = {}) {
  const direct = normalizeId(raw.image_id ?? raw.imageId);
  if (direct) return direct;

  if (raw.image && typeof raw.image === 'object') {
    const nested = normalizeId(raw.image.id ?? raw.image.uuid);
    if (nested) return nested;
  }

  if (typeof raw.image === 'string' && UUID_RE.test(raw.image.trim())) {
    return raw.image.trim();
  }

  return '';
}

export function resolveSessionEntityImageOriginalUrl(raw = {}) {
  return String(
    raw.image_original_url ??
      raw.imageOriginalUrl ??
      raw.original_image_url ??
      raw.originalImageUrl ??
      raw.image?.original_url ??
      raw.image?.source_url ??
      raw.image?.file_page_url ??
      '',
  ).trim();
}

export function resolveSessionEntityImageCopyright(raw = {}) {
  return String(
    raw.image_copyright ??
      raw.imageCopyright ??
      raw.copyright ??
      raw.photo_copyright ??
      raw.photoCopyright ??
      raw.image?.copyright ??
      '',
  ).trim();
}

export function getSessionEntityImagePreview(entity) {
  return resolveSessionEntityImageUrl(entity);
}

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

export const normalizeTagIds = (value) => {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((item) => {
        if (item == null) return '';

        if (typeof item === 'object') {
          return String(item.id ?? item.uuid ?? item.pk ?? '');
        }

        return String(item);
      })
      .filter(Boolean)
  )];
};

export { SessionStatusBadge as StatusBadge } from '../../../components/ui/StatusBadge.jsx';

/** Shared AI generation modal layout: `components/generation/AiGenerationModal.jsx` */
