import {
  DEFAULT_LOCALE_DEFS,
  normalizeLocaleCountryForSave,
  normalizeLocaleDescriptionForSave,
  normalizeTagIds,
} from './sessionWizardShared.jsx';
import { normalizeDraftId } from './useSessionWizardHelpers.js';

export const makeLocaleData = () => Object.fromEntries(
  DEFAULT_LOCALE_DEFS.map((locale) => [
    locale.key,
    {
      code: locale.code,
      lang: locale.lang,
      langName: locale.langName,
      isDefault: locale.isDefault,
      name: '',
      description: '',
      country: '',
    },
  ]),
);

const BACKEND_SUPPORTED_LOCALE_NAMES = {
  it: ['итальянский', 'italian', 'it'],
  en: ['английский', 'english', 'en'],
  ru: ['русский', 'russian', 'ru'],
  fr: ['французский', 'french', 'fr'],
  de: ['немецкий', 'german', 'de'],
  es: ['испанский', 'spanish', 'es'],
};

export function resolveBackendLanguageCode(langName) {
  const normalized = (langName || '').toString().trim().toLowerCase();
  if (!normalized) return '';
  if (/^[a-z]{2}$/i.test(normalized) && BACKEND_SUPPORTED_LOCALE_NAMES[normalized]) {
    return normalized;
  }
  return Object.keys(BACKEND_SUPPORTED_LOCALE_NAMES).find(
    (code) => BACKEND_SUPPORTED_LOCALE_NAMES[code].includes(normalized),
  ) || '';
}

export function parseMapCoord(value) {
  if (value === null || value === undefined) return NaN;
  return parseFloat(String(value).trim().replace(',', '.'));
}

export function hasValidMapCoords(latValue, lonValue) {
  const lat = parseMapCoord(latValue);
  const lon = parseMapCoord(lonValue);
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function buildCityStepPayload({
  localeData,
  defaultLocale,
  lat,
  lon,
  cityTags,
  imageId,
  imageOriginalUrl,
  parentCityId,
  authorIds,
  activeCityDraftId,
  baseUpdatedAt,
}) {
  const name = {};
  const description = {};
  const country = {};
  Object.values(localeData || {}).forEach((locale) => {
    if (!locale?.lang) return;
    name[locale.lang] = locale.name != null ? String(locale.name).trim() : '';
    description[locale.lang] = normalizeLocaleDescriptionForSave(locale.description);
    country[locale.lang] = normalizeLocaleCountryForSave(locale.country, locale.code);
  });
  const draftId = normalizeDraftId(activeCityDraftId);
  return {
    name,
    description,
    country,
    lat: lat ? parseFloat(lat) : null,
    lon: lon ? parseFloat(lon) : null,
    default_language: localeData?.[defaultLocale]?.lang || null,
    tags: normalizeTagIds(cityTags),
    image_id: imageId,
    image_original_url: imageOriginalUrl || '',
    parent_city: parentCityId || null,
    author_ids: authorIds || [],
    ...(draftId && draftId !== 'legacy' ? { draft_id: draftId } : {}),
    ...(baseUpdatedAt ? { base_updated_at: baseUpdatedAt } : {}),
  };
}

export function upsertCityDraft(drafts = [], draft) {
  const draftId = normalizeDraftId(draft?.id);
  if (!draftId) return drafts;
  const next = drafts
    .filter((item) => normalizeDraftId(item?.id) !== 'legacy')
    .filter((item) => normalizeDraftId(item?.id) !== draftId);
  return [...next, draft].sort((a, b) => {
    const orderA = Number.isFinite(Number(a?.order)) ? Number(a.order) : 0;
    const orderB = Number.isFinite(Number(b?.order)) ? Number(b.order) : 0;
    if (orderA !== orderB) return orderA - orderB;
    return String(a?.created_at || '').localeCompare(String(b?.created_at || ''));
  });
}

export function normalizeCityDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = normalizeDraftId(raw.id);
  if (!id) return null;
  const next = { ...raw, tags: normalizeTagIds(raw.tags ?? raw.city_tags ?? []) };
  delete next.isPending;
  return next;
}

export function parseCreatedCityDraftResponse(response) {
  const data = response?.data;
  if (!data || typeof data !== 'object') return null;
  const nested = data.draft ?? data.city_draft ??
    (data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : null);
  if (nested) return nested;
  if (data.id != null && typeof data.name === 'object' && data.name !== null && !Array.isArray(data.name)) {
    return data;
  }
  if (data.draft_id == null) return null;
  return {
    id: String(data.draft_id),
    name: typeof data.name === 'object' && data.name ? data.name : {},
    description: typeof data.description === 'object' && data.description ? data.description : {},
    country: typeof data.country === 'object' && data.country ? data.country : {},
    order: data.order ?? 0,
    is_primary: Boolean(data.is_primary),
  };
}
