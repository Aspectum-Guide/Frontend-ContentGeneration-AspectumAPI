import { DEFAULT_LOCALE_DEFS, normalizeId } from './sessionWizardShared.jsx';
import {
  getMultilangKeys,
  normalizeDraftId,
} from './useSessionWizardHelpers.js';
import {
  makeAttractionLocaleEntries,
  sortAttractionLocaleEntries,
} from './attractionCore.js';

function toLocaleData(sourceEntries, makeFields) {
  return sourceEntries.reduce((result, [key, locale]) => {
    const lang = locale.lang || key?.split('-')?.[0] || 'ru';
    result[key] = {
      lang,
      code: locale.code || key?.split('-')?.[1] || '',
      langName: locale.langName || locale.name || lang.toUpperCase(),
      isDefault: Boolean(locale.isDefault),
      isCustom: Boolean(locale.isCustom),
      ...makeFields(key, lang),
    };
    return result;
  }, {});
}

function fallbackLocaleEntries(entries) {
  return entries.length > 0
    ? entries
    : DEFAULT_LOCALE_DEFS.map((locale) => [locale.key, locale]);
}

export function buildAttractionInfoLocaleData({
  info,
  currentAttraction,
  attractionLocaleData,
  attractions = [],
  referenceAttractions = [],
}) {
  if (!info) return {};
  const assignedType = info.assigned_attraction_type || 'none';
  let sourceEntries = [];
  if (assignedType === 'draft') {
    const infoAttractionId = normalizeId(info.session_attraction_id ?? info.session_attraction);
    const activeAttractionId = normalizeId(currentAttraction?.id);
    if (infoAttractionId && activeAttractionId && infoAttractionId === activeAttractionId) {
      sourceEntries = sortAttractionLocaleEntries(
        Object.entries(attractionLocaleData || {})
          .filter(([, locale]) => locale?.lang)
          .map(([key, locale]) => [key, {
            lang: locale.lang,
            code: locale.code,
            langName: locale.langName,
            isDefault: locale.isDefault,
            isCustom: locale.isCustom,
          }]),
      );
    } else if (infoAttractionId) {
      const attraction = attractions.find((item) => normalizeId(item.id) === infoAttractionId);
      sourceEntries = makeAttractionLocaleEntries(getMultilangKeys(
        attraction?.name, attraction?.description, attraction?.contents,
      ));
    }
  } else if (assignedType === 'database') {
    const eventId = normalizeId(info.event_id ?? info.event ?? info.attraction_id ?? info.attraction);
    const attraction = referenceAttractions.find((item) => normalizeId(item.id) === eventId);
    sourceEntries = makeAttractionLocaleEntries(getMultilangKeys(
      attraction?.name, attraction?.title, attraction?.description,
    ));
  } else if (assignedType === 'none') {
    sourceEntries = makeAttractionLocaleEntries(getMultilangKeys(info.name, info.description));
  }
  return toLocaleData(fallbackLocaleEntries(sourceEntries), (_key, lang) => ({
    name: info.name?.[lang] || '',
    description: info.description?.[lang] || '',
  }));
}

export function buildAttractionFeedLocaleData({
  item,
  previousData = null,
  currentAttraction,
  attractionLocaleData,
  attractions = [],
  referenceAttractions = [],
}) {
  if (!item || item.item_type !== 'text') return {};
  const assignedType = item.assigned_attraction_type || 'none';
  let sourceEntries = [];
  if (assignedType === 'draft') {
    const feedAttractionId = normalizeId(item.session_attraction_id ?? item.session_attraction);
    const activeAttractionId = normalizeId(currentAttraction?.id);
    if (feedAttractionId && activeAttractionId && feedAttractionId === activeAttractionId) {
      sourceEntries = sortAttractionLocaleEntries(
        Object.entries(attractionLocaleData || {}).filter(([, locale]) => locale?.lang),
      );
    } else if (feedAttractionId) {
      const attraction = attractions.find((entry) => normalizeId(entry.id) === feedAttractionId);
      sourceEntries = makeAttractionLocaleEntries(getMultilangKeys(
        attraction?.name, attraction?.description, attraction?.contents,
      ));
    }
  } else if (assignedType === 'database') {
    const eventId = normalizeId(item.event_id ?? item.event ?? item.attraction_id ?? item.attraction);
    const attraction = referenceAttractions.find((entry) => normalizeId(entry.id) === eventId);
    sourceEntries = makeAttractionLocaleEntries(getMultilangKeys(
      attraction?.name, attraction?.title, attraction?.description,
    ));
  } else if (assignedType === 'none') {
    sourceEntries = makeAttractionLocaleEntries(getMultilangKeys(item.text));
  }
  return toLocaleData(fallbackLocaleEntries(sourceEntries), (key, lang) => ({
    text: item.text?.[lang] ?? previousData?.[key]?.text ?? '',
  }));
}

export function getAttractionLocaleLang(localeKey) {
  const locale = DEFAULT_LOCALE_DEFS.find((item) => item.key === localeKey);
  return locale?.lang || localeKey?.split('-')?.[0] || 'ru';
}

export function getAttractionInfoName(info) {
  const name = info?.name || {};
  if (typeof name === 'string') return name || '(без названия)';
  return name.ru || name.en || name.it || Object.values(name).find(Boolean) || '(без названия)';
}

export function getAttractionFeedItemName(item) {
  if (!item) return '(без названия)';
  if (item.item_type === 'image') {
    return item.image_copyright || item.image_original_url || 'Изображение';
  }
  const value = item.text || {};
  if (typeof value === 'string') return value.slice(0, 60) || '(без текста)';
  return value.ru || value.en || value.it || Object.values(value).find(Boolean) || '(без текста)';
}

export function resolveActiveAttractionCityDraftId(activeDraftId, cityDrafts = []) {
  const normalizedActiveId = normalizeDraftId(activeDraftId);
  if (normalizedActiveId && normalizedActiveId !== 'legacy') return normalizedActiveId;
  return cityDrafts
    .map((draft) => normalizeDraftId(draft?.id))
    .find((id) => id && id !== 'legacy') || '';
}

export function applyAttractionFeedBinding(item, { bindingSource, activeAttractionId } = {}) {
  const bound = { ...item };
  const source = bindingSource || null;
  const sessionAttractionId = source
    ? source.session_attraction_id ?? source.session_attraction ?? null
    : normalizeId(activeAttractionId) || null;
  const eventId = source
    ? source.event_id ?? source.event ?? source.attraction_id ?? source.attraction ?? null
    : null;
  bound.assigned_attraction_type = source?.assigned_attraction_type
    || (sessionAttractionId ? 'draft' : 'none');
  bound.event = eventId;
  bound.event_id = eventId;
  bound.attraction = null;
  bound.attraction_id = null;
  bound.session_attraction = sessionAttractionId;
  bound.session_attraction_id = sessionAttractionId;
  return bound;
}

export function resolveDefaultAttractionAiLang(localeData, activeDraftId, cityDrafts = []) {
  const firstLocale = Object.values(localeData || {})[0];
  const localeLang = String(firstLocale?.lang || '').trim().toLowerCase();
  if (localeLang) return localeLang.split('-')[0] || 'ru';
  const draftId = normalizeDraftId(activeDraftId);
  const draft = cityDrafts.find((item) => normalizeDraftId(item.id) === draftId);
  const findLanguage = (value) => {
    if (!value || typeof value !== 'object') return null;
    const key = Object.keys(value).find((candidate) => candidate && /^[a-z]{2}/i.test(candidate));
    return key ? key.split('-')[0].toLowerCase() : null;
  };
  return findLanguage(draft?.name)
    || findLanguage(draft?.description)
    || findLanguage(draft?.country)
    || 'ru';
}
