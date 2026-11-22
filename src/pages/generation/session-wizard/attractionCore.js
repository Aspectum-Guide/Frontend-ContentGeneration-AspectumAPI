import {
  DEFAULT_LOCALE_DEFS,
  getLocaleInfo,
  normalizeId,
  normalizeTagIds,
  resolveSessionEntityImageCopyright,
  resolveSessionEntityImageId,
  resolveSessionEntityImageOriginalUrl,
  resolveSessionEntityImageUrl,
  stripLegacyImageFields,
} from './sessionWizardShared.jsx';
import { normalizeDraftId } from './useSessionWizardHelpers.js';

export function sortAttractionLocaleEntries(entries) {
  if (!Array.isArray(entries) || entries.length <= 1) return entries;
  const defaults = DEFAULT_LOCALE_DEFS
    .map((locale) => locale.lang || locale.key?.split('-')?.[0]).filter(Boolean);
  const byLang = new Map();
  entries.forEach(([key, locale]) => {
    const lang = String(locale?.lang || key?.split('-')?.[0] || '').trim().toLowerCase();
    if (lang && !byLang.has(lang)) byLang.set(lang, [key, locale]);
  });
  const languages = [...byLang.keys()];
  return [
    ...defaults.filter((lang) => languages.includes(lang)),
    ...languages.filter((lang) => !defaults.includes(lang)),
  ].map((lang) => byLang.get(lang));
}

export function makeAttractionLocaleEntries(langKeys = []) {
  const languages = [...new Set(
    langKeys.map((lang) => String(lang || '').trim().toLowerCase()).filter(Boolean),
  )];
  const defaults = DEFAULT_LOCALE_DEFS
    .map((locale) => locale.lang || locale.key?.split('-')?.[0]).filter(Boolean);
  const ordered = [
    ...defaults.filter((lang) => languages.includes(lang)),
    ...languages.filter((lang) => !defaults.includes(lang)),
  ];
  return ordered.map((lang) => {
    const definition = DEFAULT_LOCALE_DEFS.find((locale) => locale.lang === lang);
    if (definition) {
      return [definition.key, {
        lang: definition.lang,
        code: definition.code,
        langName: definition.langName,
        isDefault: Boolean(definition.isDefault),
      }];
    }
    const info = getLocaleInfo(lang);
    return [`${lang}-${info.code}`, {
      lang, code: info.code, langName: info.name, isDefault: false, isCustom: true,
    }];
  });
}

export function getAttractionName(attraction) {
  const name = attraction?.name || {};
  return name.ru || name.en || name.it || Object.values(name).find(Boolean) || '(без названия)';
}

export function normalizeAttraction(attraction = {}) {
  const index = Number(attraction.index ?? attraction.order ?? 0);
  const cityId = attraction.city_id ?? attraction.city ?? null;
  const sessionCityId = attraction.session_city_id ?? attraction.session_city ?? null;
  let assignedCityType = attraction.assigned_city_type ?? 'none';
  if (!attraction.assigned_city_type) {
    if (cityId) assignedCityType = 'database';
    else if (sessionCityId) assignedCityType = 'draft';
  }
  const imageId = resolveSessionEntityImageId(attraction) || null;
  const imageUrl = resolveSessionEntityImageUrl(attraction);
  const imageOriginalUrl = resolveSessionEntityImageOriginalUrl(attraction);
  const imageCopyright = resolveSessionEntityImageCopyright(attraction);
  return {
    ...stripLegacyImageFields(attraction),
    id: attraction.id ?? null,
    name: attraction.name ?? {},
    description: attraction.description ?? {},
    lat: attraction.lat ?? null,
    lon: attraction.lon ?? null,
    index,
    order: index,
    rank: Number(attraction.rank ?? 0),
    city: cityId,
    city_id: cityId,
    session_city: sessionCityId,
    session_city_id: sessionCityId,
    assigned_city_type: assignedCityType,
    assigned_city_name: attraction.assigned_city_name ?? null,
    image_id: imageId,
    image_url: imageUrl,
    imagePreview: imageUrl,
    image_original_url: imageOriginalUrl,
    imageOriginalUrl,
    image_copyright: imageCopyright,
    imageCopyright,
    image: null,
    contents: attraction.contents ?? {},
    tags: normalizeTagIds(attraction.tags ?? []),
    related_event_ids: normalizeTagIds(attraction.related_event_ids ?? []),
    related_events: attraction.related_events ?? [],
  };
}

export function collectAttractionLocaleTexts(localeData) {
  const name = {};
  const description = {};
  Object.values(localeData || {}).forEach((locale) => {
    if (!locale?.lang || (!locale.name && !locale.description)) return;
    name[locale.lang] = locale.name || '';
    description[locale.lang] = locale.description || '';
  });
  return { name, description };
}

export function buildAttractionPayload(attraction, name, description) {
  const assignedType = attraction.assigned_city_type ?? 'none';
  const city = assignedType === 'database'
    ? normalizeId(attraction.city_id ?? attraction.city) || null : null;
  const sessionCity = assignedType === 'draft'
    ? normalizeDraftId(attraction.session_city_id ?? attraction.session_city) || null : null;
  const index = Number(attraction.index ?? attraction.order ?? 0);
  return {
    name: name ?? attraction.name ?? {},
    description: description ?? attraction.description ?? {},
    lat: attraction.lat === '' ? null : attraction.lat,
    lon: attraction.lon === '' ? null : attraction.lon,
    index,
    rank: Number(attraction.rank ?? 0),
    assigned_city_type: assignedType,
    city,
    city_id: city,
    session_city: sessionCity,
    session_city_id: sessionCity,
    image_id: attraction.image_id ?? null,
    image_original_url: attraction.image_original_url ?? attraction.imageOriginalUrl ?? '',
    image_copyright: attraction.image_copyright ?? attraction.imageCopyright ?? '',
    order: index,
    tags: normalizeTagIds(attraction.tags ?? []),
    related_event_ids: normalizeTagIds(attraction.related_event_ids ?? []),
  };
}

export function buildAttractionPersistSnapshot(attraction, localeData) {
  if (!attraction?.id) return null;
  const { name, description } = collectAttractionLocaleTexts(localeData);
  const contents = {};
  Object.values(localeData || {}).forEach((locale) => {
    if (locale?.lang) contents[locale.lang] = locale.contentText || '';
  });
  return JSON.stringify({
    payload: buildAttractionPayload(normalizeAttraction(attraction), name, description),
    contents,
  });
}
