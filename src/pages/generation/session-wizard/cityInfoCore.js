import { DEFAULT_LOCALE_DEFS, getLocaleInfo } from './sessionWizardShared.jsx';
import { normalizeDraftId } from './useSessionWizardHelpers.js';

export function getLocaleLang(localeKey) {
  const locale = DEFAULT_LOCALE_DEFS.find((item) => item.key === localeKey);
  return locale?.lang || localeKey?.split('-')?.[0] || 'ru';
}

export function getMultilangKeys(...objects) {
  const keys = new Set();
  objects.forEach((object) => {
    if (!object || typeof object !== 'object' || Array.isArray(object)) return;
    Object.keys(object).forEach((key) => {
      const lang = String(key || '').trim().toLowerCase();
      if (lang) keys.add(lang);
    });
  });
  return Array.from(keys);
}

export function sortLocaleSourceEntries(entries) {
  if (!Array.isArray(entries) || entries.length <= 1) return entries;
  const defaultOrder = DEFAULT_LOCALE_DEFS
    .map((locale) => locale.lang || locale.key?.split('-')?.[0])
    .filter(Boolean);
  const byLang = new Map();
  entries.forEach(([key, locale]) => {
    const lang = String(locale?.lang || key?.split('-')?.[0] || '').trim().toLowerCase();
    if (lang && !byLang.has(lang)) byLang.set(lang, [key, locale]);
  });
  const languages = [...byLang.keys()];
  return [
    ...defaultOrder.filter((lang) => languages.includes(lang)),
    ...languages.filter((lang) => !defaultOrder.includes(lang)),
  ].map((lang) => byLang.get(lang));
}

export function makeLocaleEntriesFromLangKeys(langKeys = []) {
  const languages = [...new Set(
    langKeys.map((lang) => String(lang || '').trim().toLowerCase()).filter(Boolean),
  )];
  const defaultOrder = DEFAULT_LOCALE_DEFS
    .map((locale) => locale.lang || locale.key?.split('-')?.[0])
    .filter(Boolean);
  const ordered = [
    ...defaultOrder.filter((lang) => languages.includes(lang)),
    ...languages.filter((lang) => !defaultOrder.includes(lang)),
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
      lang,
      code: info.code,
      langName: info.name,
      isDefault: false,
      isCustom: true,
    }];
  });
}

export function normalizeCityInfo(info = {}) {
  const cityId = info.city_id ?? info.city ?? null;
  const sessionCityId = info.session_city_id ?? info.session_city ?? null;
  let assignedCityType = info.assigned_city_type ?? 'none';
  if (!info.assigned_city_type) {
    if (cityId) assignedCityType = 'database';
    else if (sessionCityId) assignedCityType = 'draft';
  }
  return {
    ...info,
    id: info.id ?? null,
    name: info.name ?? info.title ?? {},
    description: info.description ?? {},
    city: cityId,
    city_id: cityId,
    session_city: sessionCityId,
    session_city_id: sessionCityId,
    assigned_city_type: assignedCityType,
    assigned_city_name: info.assigned_city_name ?? null,
  };
}

export function buildCityInfoPayload(info, name, description) {
  const assignedType = info.assigned_city_type ?? 'none';
  const city = assignedType === 'database' ? info.city_id ?? info.city ?? null : null;
  const sessionCity = assignedType === 'draft'
    ? info.session_city_id ?? info.session_city ?? null
    : null;
  return {
    name: name ?? info.name ?? {},
    description: description ?? info.description ?? {},
    assigned_city_type: assignedType,
    city,
    city_id: city,
    session_city: sessionCity,
    session_city_id: sessionCity,
  };
}

export function collectCityInfoLocaleTexts(localeData) {
  const name = {};
  const description = {};
  Object.values(localeData || {}).forEach((locale) => {
    if (!locale?.lang || (!locale.name && !locale.description)) return;
    name[locale.lang] = locale.name || '';
    description[locale.lang] = locale.description || '';
  });
  return { name, description };
}

export function buildCityInfoPersistSnapshot(info, localeData) {
  if (!info?.id) return null;
  const { name, description } = collectCityInfoLocaleTexts(localeData);
  return JSON.stringify(buildCityInfoPayload(normalizeCityInfo(info), name, description));
}

export function makeEmptyLocaleObject(sourceLocaleData = null) {
  const source = sourceLocaleData && Object.keys(sourceLocaleData).length > 0
    ? Object.entries(sourceLocaleData).map(([key, locale]) => ({ key, ...locale }))
    : DEFAULT_LOCALE_DEFS;
  return source.reduce((result, locale) => {
    const lang = locale.lang || locale.key?.split('-')?.[0] || 'ru';
    if (lang) result[lang] = '';
    return result;
  }, {});
}

export function createEmptyCityInfo({ activeDraftId = null, sourceLocaleData = null } = {}) {
  const draftId = normalizeDraftId(activeDraftId);
  const attachToDraft = Boolean(draftId && draftId !== 'legacy');
  return {
    id: `city-info-${Date.now()}`,
    name: makeEmptyLocaleObject(sourceLocaleData),
    description: makeEmptyLocaleObject(sourceLocaleData),
    assigned_city_type: attachToDraft ? 'draft' : 'none',
    city: null,
    city_id: null,
    session_city: attachToDraft ? draftId : null,
    session_city_id: attachToDraft ? draftId : null,
    isNew: true,
  };
}
